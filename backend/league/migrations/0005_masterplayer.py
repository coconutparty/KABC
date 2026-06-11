from django.db import migrations, models


def seed_master_players(apps, _schema_editor):
    from league.demo_data import MASTER_PLAYER_DATA

    MasterPlayer = apps.get_model("league", "MasterPlayer")
    for data in MASTER_PLAYER_DATA:
        MasterPlayer.objects.update_or_create(code=data["code"], defaults=data)


class Migration(migrations.Migration):
    dependencies = [
        ("league", "0004_battingstrategy_pitchtype_gamerecord_account_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="MasterPlayer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=60, unique=True)),
                ("name", models.CharField(max_length=80)),
                ("team_name", models.CharField(blank=True, max_length=80)),
                ("number", models.IntegerField()),
                ("age", models.IntegerField()),
                ("job", models.CharField(max_length=40)),
                ("batting_role", models.CharField(max_length=40)),
                ("positions", models.JSONField(default=list)),
                ("primary_position", models.CharField(max_length=30)),
                ("batting_stats", models.JSONField(default=dict)),
                ("fielding_stats", models.JSONField(default=dict)),
                ("position_stats", models.JSONField(default=dict)),
                ("pitches", models.JSONField(blank=True, default=list)),
                ("batting_strategies", models.JSONField(blank=True, default=list)),
                ("max_stamina", models.IntegerField()),
                ("condition", models.IntegerField(default=70)),
                ("attendance", models.IntegerField()),
                ("dues_trait", models.IntegerField()),
                ("sponsor_trait", models.IntegerField()),
                ("traits", models.JSONField(blank=True, default=list)),
                ("acquisition", models.CharField(default="initial", max_length=30)),
                ("is_active", models.BooleanField(default=True)),
                ("meta", models.JSONField(blank=True, default=dict)),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.RunPython(seed_master_players, migrations.RunPython.noop),
    ]
