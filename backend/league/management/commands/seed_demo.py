from django.core.management.base import BaseCommand

from league.demo_data import create_demo_league, seed_skill_tables
from league.models import GameRecord, GameSnapshot, Player, SeasonRule, Team


class Command(BaseCommand):
    help = "Seed KABC tech demo config and template league data."

    def handle(self, *args, **options):
        GameRecord.objects.all().delete()
        GameSnapshot.objects.all().delete()
        Player.objects.all().delete()
        Team.objects.all().delete()
        SeasonRule.objects.all().delete()

        seed_skill_tables()
        SeasonRule.objects.create(name="Tech Demo 0.0.1")
        create_demo_league(account=None)

        self.stdout.write(self.style.SUCCESS("Seeded KABC tech demo config and template data."))
