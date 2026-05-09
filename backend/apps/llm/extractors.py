"""
Text extraction from resource files to enrich LLM prompts with actual content.
PDF is supported via PyMuPDF; all other formats fall back to metadata only.
"""

import logging

logger = logging.getLogger(__name__)


def extract_text_from_resource(resource, max_chars: int = 3000) -> str:
    """Return a text excerpt from the resource file, or '' if unavailable."""
    if not resource.file or resource.format != 'pdf':
        return ''
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(resource.file.path)
        parts = []
        total = 0
        for page in doc:
            text = page.get_text()
            parts.append(text)
            total += len(text)
            if total >= max_chars:
                break
        doc.close()
        return ' '.join(parts)[:max_chars]
    except Exception as exc:
        logger.debug('PDF text extraction failed for resource %s: %s', resource.id, exc)
        return ''
