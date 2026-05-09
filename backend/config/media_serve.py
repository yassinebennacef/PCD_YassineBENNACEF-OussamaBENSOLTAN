import os
import re
import mimetypes
from django.conf import settings
from django.http import StreamingHttpResponse, Http404

_CHUNK = 64 * 1024  # 64 KB per chunk


def _stream(path, start, length):
    with open(path, 'rb') as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            data = f.read(min(_CHUNK, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def serve_media(request, path):
    """
    Serve media files with HTTP Range request support so that
    video seeking works for large files in the browser.
    """
    # Sanitise path — block traversal attempts
    safe = os.path.normpath(path)
    if safe.startswith('..') or safe.startswith('/') or safe.startswith('\\'):
        raise Http404

    full_path = os.path.join(settings.MEDIA_ROOT, safe)
    if not os.path.isfile(full_path):
        raise Http404

    file_size = os.path.getsize(full_path)
    content_type, _ = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    start, end = 0, file_size - 1
    status = 200

    range_header = request.META.get('HTTP_RANGE', '').strip()
    if range_header:
        m = re.fullmatch(r'bytes=(\d+)-(\d*)', range_header)
        if m:
            start = int(m.group(1))
            end   = int(m.group(2)) if m.group(2) else file_size - 1
            end   = min(end, file_size - 1)
            status = 206

    length = end - start + 1
    response = StreamingHttpResponse(
        _stream(full_path, start, length),
        status=status,
        content_type=content_type,
    )
    response['Content-Length'] = length
    response['Accept-Ranges']  = 'bytes'
    if status == 206:
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    return response
