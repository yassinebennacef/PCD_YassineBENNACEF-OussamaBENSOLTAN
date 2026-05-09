from django.core.management.base import BaseCommand
from apps.resources.models import Resource
from apps.resources.thumbnails import generate_thumbnail


class Command(BaseCommand):
    help = 'Generate thumbnails for existing video and PDF resources that have none.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                            help='Regenerate even if a thumbnail already exists')

    def handle(self, *args, **options):
        force = options['force']
        qs = Resource.objects.filter(is_active=True, format__in=['video', 'pdf'])
        if not force:
            qs = qs.filter(thumbnail='')
        total = qs.count()
        self.stdout.write(f'Processing {total} resource(s)…')
        ok = 0
        for r in qs:
            before = bool(r.thumbnail)
            generate_thumbnail(r, force=force)
            r.refresh_from_db(fields=['thumbnail'])
            if r.thumbnail:
                ok += 1
                self.stdout.write(self.style.SUCCESS(f'  OK [{r.format}] {r.title}'))
            else:
                self.stdout.write(self.style.WARNING(f'  -- [{r.format}] {r.title} (skipped - tool missing?)'))
        self.stdout.write(self.style.SUCCESS(f'Done: {ok}/{total} thumbnails generated.'))
