from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('resources', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LLMCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('task_type', models.CharField(
                    choices=[
                        ('summary',       'Résumé'),
                        ('simplify',      'Simplification'),
                        ('variants',      'Variantes pédagogiques'),
                        ('learning_path', "Parcours d'apprentissage"),
                    ],
                    max_length=20,
                )),
                ('level',         models.CharField(blank=True, max_length=20)),
                ('cache_key',     models.CharField(db_index=True, max_length=64, unique=True)),
                ('response_text', models.TextField()),
                ('provider',      models.CharField(blank=True, max_length=60)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('resource', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='llm_cache',
                    to='resources.resource',
                )),
            ],
            options={
                'verbose_name':        'Cache LLM',
                'verbose_name_plural': 'Cache LLM',
                'ordering':            ['-created_at'],
            },
        ),
    ]
