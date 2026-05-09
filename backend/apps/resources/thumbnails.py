import os
import subprocess
import tempfile
import logging
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def _save_thumbnail(resource, img_bytes):
    """Atomically replace the resource's thumbnail with new JPEG bytes."""
    if resource.thumbnail:
        try:
            resource.thumbnail.delete(save=False)
        except Exception:
            pass
    resource.thumbnail.save(
        f'thumb_{resource.pk}.jpg',
        ContentFile(img_bytes),
        save=False,
    )
    resource.save(update_fields=['thumbnail'])


def generate_video_thumbnail(resource):
    """
    Extract a single frame at ~5 s using ffmpeg and save as JPEG thumbnail.
    Falls back to 2 s then 0 s if the video is shorter.
    Silently skips if ffmpeg is not installed.
    """
    if not resource.file:
        return
    try:
        file_path = resource.file.path
    except (ValueError, NotImplementedError):
        return
    if not os.path.exists(file_path):
        return

    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix='.jpg')
        os.close(fd)

        succeeded = False
        for seek in ('00:00:05', '00:00:02', '00:00:00'):
            result = subprocess.run(
                [
                    'ffmpeg', '-y',
                    '-ss', seek,
                    '-i', file_path,
                    '-vframes', '1',
                    '-q:v', '3',
                    '-vf', 'scale=640:-2',
                    tmp_path,
                ],
                capture_output=True,
                timeout=30,
            )
            if result.returncode == 0 and os.path.getsize(tmp_path) > 0:
                succeeded = True
                break

        if not succeeded:
            return

        with open(tmp_path, 'rb') as f:
            _save_thumbnail(resource, f.read())

    except FileNotFoundError:
        logger.warning('ffmpeg not found — install it: sudo apt-get install ffmpeg')
    except subprocess.TimeoutExpired:
        logger.warning('ffmpeg timed out for resource %s', resource.pk)
    except Exception as exc:
        logger.warning('Video thumbnail failed for resource %s: %s', resource.pk, exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def generate_pdf_thumbnail(resource):
    """
    Render the first page of the PDF to a JPEG thumbnail.
    Requires PyMuPDF: pip install PyMuPDF
    Silently skips if the library is not installed.
    """
    if not resource.file:
        return
    try:
        file_path = resource.file.path
    except (ValueError, NotImplementedError):
        return
    if not os.path.exists(file_path):
        return

    try:
        import fitz  # PyMuPDF
        from io import BytesIO
        from PIL import Image as PILImage

        doc = fitz.open(file_path)
        if doc.page_count == 0:
            doc.close()
            return

        page = doc[0]
        # Scale so the rendered width is ~800 px (capped at 2× original to avoid huge images)
        scale = min(800 / max(page.rect.width, 1), 2.0)
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)

        img = PILImage.frombytes('RGB', [pix.width, pix.height], pix.samples)
        buf = BytesIO()
        img.save(buf, format='JPEG', quality=85, optimize=True)
        doc.close()

        _save_thumbnail(resource, buf.getvalue())

    except ImportError:
        logger.warning('PyMuPDF not installed — PDF thumbnails disabled. Run: pip install PyMuPDF')
    except Exception as exc:
        logger.warning('PDF thumbnail failed for resource %s: %s', resource.pk, exc)


def generate_thumbnail(resource, force=False):
    """
    Dispatch thumbnail generation based on resource format.

    force=False  skip if a thumbnail already exists (manual upload respected)
    force=True   overwrite existing thumbnail (use when file changes on update)
    """
    if resource.thumbnail and not force:
        return
    if not resource.file:
        return
    if resource.format == 'video':
        generate_video_thumbnail(resource)
    elif resource.format == 'pdf':
        generate_pdf_thumbnail(resource)
