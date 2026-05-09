"""
Whoosh full-text search index for educational resources.
Follows the indexation requirement from the cahier des charges.
"""

import os
from pathlib import Path
from django.conf import settings

from whoosh import index
from whoosh.fields import Schema, TEXT, ID, KEYWORD, NUMERIC, STORED
from whoosh.qparser import MultifieldParser, QueryParser
from whoosh.query import Every
from whoosh import sorting


# ─── Schema ───────────────────────────────────────────────────────────────────

RESOURCE_SCHEMA = Schema(
    id=ID(stored=True, unique=True),
    title=TEXT(stored=True),
    description=TEXT(stored=True),
    category=TEXT(stored=True),
    level=KEYWORD(stored=True, commas=True),
    format=KEYWORD(stored=True, commas=True),
    language=KEYWORD(stored=True, commas=True),
    tags=KEYWORD(stored=True, commas=True),
    dcat_keywords=KEYWORD(stored=True, commas=True),
    view_count=NUMERIC(stored=True, sortable=True),
    rating=NUMERIC(stored=True, numtype=float),
)

INDEX_DIR = Path(settings.WHOOSH_INDEX_PATH)


def _get_index():
    """Return (or create) the Whoosh index."""
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    if index.exists_in(str(INDEX_DIR)):
        return index.open_dir(str(INDEX_DIR))
    return index.create_in(str(INDEX_DIR), RESOURCE_SCHEMA)


# ─── Index Operations ─────────────────────────────────────────────────────────

def index_resource(resource):
    """Add or update a single resource in the index."""
    ix = _get_index()
    writer = ix.writer()
    writer.update_document(
        id=str(resource.id),
        title=resource.title,
        description=resource.description or '',
        category=resource.category.name if resource.category else '',
        level=resource.level,
        format=resource.format,
        language=resource.language,
        tags=','.join(resource.tags) if resource.tags else '',
        dcat_keywords=','.join(resource.dcat_keywords) if resource.dcat_keywords else '',
        view_count=resource.view_count,
        rating=resource.average_rating,
    )
    writer.commit()


def remove_resource(resource_id):
    """Remove a resource from the index by id."""
    ix = _get_index()
    writer = ix.writer()
    writer.delete_by_term('id', str(resource_id))
    writer.commit()


def rebuild_index():
    """Rebuild the entire index from the database (run via management command)."""
    from apps.resources.models import Resource
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    ix = index.create_in(str(INDEX_DIR), RESOURCE_SCHEMA)
    writer = ix.writer()
    for r in Resource.objects.filter(is_active=True, is_validated=True).select_related('category'):
        writer.add_document(
            id=str(r.id),
            title=r.title,
            description=r.description or '',
            category=r.category.name if r.category else '',
            level=r.level,
            format=r.format,
            language=r.language,
            tags=','.join(r.tags) if r.tags else '',
            dcat_keywords=','.join(r.dcat_keywords) if r.dcat_keywords else '',
            view_count=r.view_count,
            rating=r.average_rating,
        )
    writer.commit()
    return ix.doc_count()


# ─── Search ───────────────────────────────────────────────────────────────────

def search_resources(
    query_str,
    level=None,
    format_=None,
    language=None,
    category=None,
    sort_by='relevance',   # 'relevance' | 'rating' | 'views'
    page=1,
    per_page=20,
):
    """
    Full-text multi-criteria search.
    Returns a list of resource IDs in ranked order.
    """
    ix = _get_index()
    results_ids = []

    with ix.searcher() as searcher:
        # Build query
        if query_str and query_str.strip():
            parser = MultifieldParser(
                ['title', 'description', 'tags', 'dcat_keywords', 'category'],
                schema=ix.schema,
            )
            q = parser.parse(query_str)
        else:
            q = Every()

        # Filters
        filter_terms = []
        if level:
            from whoosh.query import Term
            filter_terms.append(Term('level', level))
        if format_:
            from whoosh.query import Term
            filter_terms.append(Term('format', format_))
        if language:
            from whoosh.query import Term
            filter_terms.append(Term('language', language))

        if filter_terms:
            from whoosh.query import And
            q = And([q] + filter_terms)

        # Sorting (only view_count is sortable in the index)
        sortedby = None
        if sort_by == 'views':
            sortedby = sorting.FieldFacet('view_count', reverse=True)

        results = searcher.search_page(
            q,
            pagenum=page,
            pagelen=per_page,
            sortedby=sortedby,
        )

        results_ids = [int(r['id']) for r in results]

    return results_ids
