from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='learningprogress',
            name='last_position_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
