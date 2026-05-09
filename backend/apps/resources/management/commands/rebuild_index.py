"""
Usage: python manage.py rebuild_index
Rebuilds the Whoosh full-text index from scratch.
"""
from django.core.management.base import BaseCommand
from apps.resources.indexer import rebuild_index


class Command(BaseCommand):
    help = 'Rebuild the Whoosh search index for all validated resources'

    def handle(self, *args, **options):
        self.stdout.write('Rebuilding Whoosh index...')
        count = rebuild_index()
        self.stdout.write(self.style.SUCCESS(f'Done. Indexed {count} resources.'))
