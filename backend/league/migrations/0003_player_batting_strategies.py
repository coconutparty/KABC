from django.db import migrations, models


DEFAULT_STRATEGIES = ["contact", "wait", "power", "run"]
ALL_STRATEGIES = ["contact", "wait", "power", "run", "bunt", "steal", "pull", "opposite", "aggressive"]


def strategies_for(player):
    batting = player.batting_stats or {}
    contact = int(batting.get("contact", 60))
    discipline = int(batting.get("discipline", 60))
    power = int(batting.get("power", 60))
    speed = int(batting.get("speed", 60))

    if player.name == "김철민":
        return DEFAULT_STRATEGIES

    strategies = ["contact", "wait"]
    strategies.append("power" if power >= 68 else "opposite")
    if speed >= 68:
        strategies.append("steal")
    elif contact >= 70 and discipline >= 62:
        strategies.append("bunt")
    else:
        strategies.append("pull" if power >= contact else "aggressive")

    unique = []
    for strategy in strategies + ALL_STRATEGIES:
        if strategy not in unique:
            unique.append(strategy)
        if len(unique) >= 4:
            break
    return unique


def populate_batting_strategies(apps, _schema_editor):
    Player = apps.get_model("league", "Player")
    for player in Player.objects.all():
        if player.batting_strategies:
            continue
        player.batting_strategies = strategies_for(player)
        player.save(update_fields=["batting_strategies"])


class Migration(migrations.Migration):
    dependencies = [
        ("league", "0002_demoaccount"),
    ]

    operations = [
        migrations.AddField(
            model_name="player",
            name="batting_strategies",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(populate_batting_strategies, migrations.RunPython.noop),
    ]
