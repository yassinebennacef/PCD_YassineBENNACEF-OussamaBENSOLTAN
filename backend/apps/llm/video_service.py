"""
Simplified video generation pipeline:
  1. DeepSeek  → script (JSON segments, max 7)
  2. DALL-E 3  → one image per segment (standard quality, $0.04 each)
  3. Pillow    → text overlay on each image
  4. TTS tts-1 → audio narration per segment ($0.015/1k chars)
  5. ffmpeg    → image + audio → clip, then concatenate all clips
"""
import os
import json
import logging
import tempfile
import subprocess
import textwrap
import threading
import shutil
from pathlib import Path

import requests as _requests
from django.conf import settings

from .extractors import extract_text_from_resource

logger = logging.getLogger(__name__)


def _openai_client():
    import openai
    key = getattr(settings, 'OPENAI_API_KEY', '')
    if not key:
        raise RuntimeError('OPENAI_API_KEY not set in .env')
    return openai.OpenAI(api_key=key)


LEVEL_LABELS = {'beginner': 'débutant', 'intermediate': 'intermédiaire', 'advanced': 'avancé'}


def _generate_script(title, description, excerpt, level='beginner'):
    from .client import get_llm_client
    level_label = LEVEL_LABELS.get(level, level)
    client = get_llm_client()
    prompt = (
        f'Tu es un professeur expert. Crée un script de vidéo pédagogique pour un étudiant de niveau {level_label}:\n'
        f'Titre: "{title}"\n'
        f'Description: {description or "Non disponible"}\n'
        f'Contenu: {excerpt[:2000] if excerpt else "Non disponible"}\n\n'
        f'Génère entre 5 et 7 segments adaptés au niveau {level_label}. Chaque segment doit avoir:\n'
        f'- "text": narration en français (60-80 mots, vocabulaire adapté au niveau {level_label})\n'
        f'- "image_prompt": description en anglais pour une illustration simple (max 40 mots)\n\n'
        f'Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après:\n'
        f'[{{"text":"...","image_prompt":"..."}},...]'
    )
    raw = client.generate(prompt, max_tokens=1500)
    start = raw.find('[')
    end = raw.rfind(']') + 1
    if start == -1 or end == 0:
        raise ValueError(f'LLM did not return valid JSON array. Got: {raw[:300]}')
    return json.loads(raw[start:end])


def _download_image(url):
    r = _requests.get(url, timeout=30)
    r.raise_for_status()
    f = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    f.write(r.content)
    f.close()
    return f.name


def _generate_image(prompt, oa_client):
    resp = oa_client.images.generate(
        model='dall-e-3',
        prompt=f'Simple clean educational illustration: {prompt}. Flat design, bright colors, no text in image.',
        size='1024x1024',
        quality='standard',
        n=1,
    )
    return _download_image(resp.data[0].url)


def _add_text_overlay(image_path, text):
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(image_path).convert('RGB')
    w, h = img.size

    font = None
    for path in [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        'C:/Windows/Fonts/arial.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
    ]:
        try:
            font = ImageFont.truetype(path, 26)
            break
        except Exception:
            pass
    if font is None:
        font = ImageFont.load_default()

    lines = textwrap.wrap(text, width=54)[:4]
    line_h = 34
    pad = 14
    box_h = len(lines) * line_h + pad * 2

    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    from PIL import ImageDraw as _ID
    _ID.Draw(overlay).rectangle([0, h - box_h - 10, w, h], fill=(0, 0, 0, 165))

    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        draw.text((pad + 8, h - box_h - 10 + pad + i * line_h), line, font=font, fill='white')

    out = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    img.save(out.name)
    out.close()
    return out.name


def _generate_audio(text, oa_client):
    resp = oa_client.audio.speech.create(
        model='tts-1',
        voice='nova',
        input=text,
    )
    f = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
    f.write(resp.content)
    f.close()
    return f.name


def _ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def _make_clip(image_path, audio_path):
    out = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    out.close()
    subprocess.run([
        _ffmpeg(), '-y',
        '-loop', '1', '-i', image_path,
        '-i', audio_path,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '96k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        out.name,
    ], check=True, capture_output=True)
    return out.name


def _concat_clips(clip_paths, output_path):
    lst = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    for p in clip_paths:
        lst.write(f"file '{p}'\n")
    lst.close()
    subprocess.run([
        _ffmpeg(), '-y',
        '-f', 'concat', '-safe', '0',
        '-i', lst.name,
        '-c', 'copy',
        output_path,
    ], check=True, capture_output=True)
    os.unlink(lst.name)


def _run_pipeline(resource_id, level):
    from .models import GeneratedVideo
    from apps.resources.models import Resource

    gv = GeneratedVideo.objects.get(resource_id=resource_id, level=level)
    tmp_files = []
    try:
        resource = Resource.objects.select_related('category').get(id=resource_id)
        excerpt = extract_text_from_resource(resource)

        segments = _generate_script(resource.title, resource.description or '', excerpt, level)
        segments = segments[:7]

        oa = _openai_client()
        clips = []

        for seg in segments:
            raw_img = _generate_image(seg.get('image_prompt', resource.title), oa)
            tmp_files.append(raw_img)

            overlay_img = _add_text_overlay(raw_img, seg['text'])
            tmp_files.append(overlay_img)

            audio = _generate_audio(seg['text'], oa)
            tmp_files.append(audio)

            clip = _make_clip(overlay_img, audio)
            tmp_files.append(clip)
            clips.append(clip)

        out_dir = Path(settings.MEDIA_ROOT) / 'generated_videos'
        out_dir.mkdir(exist_ok=True)
        out_path = str(out_dir / f'resource_{resource_id}_{level}.mp4')

        if len(clips) == 1:
            shutil.copy(clips[0], out_path)
        else:
            _concat_clips(clips, out_path)

        gv.file = f'generated_videos/resource_{resource_id}_{level}.mp4'
        gv.status = 'ready'
        gv.save()

    except Exception as exc:
        logger.error('Video generation failed for resource %s level %s: %s', resource_id, level, exc, exc_info=True)
        gv.status = 'failed'
        gv.error = str(exc)[:500]
        gv.save()
    finally:
        for f in tmp_files:
            try:
                os.unlink(f)
            except Exception:
                pass


def generate_video_async(resource_id, level):
    threading.Thread(target=_run_pipeline, args=(resource_id, level), daemon=True).start()
