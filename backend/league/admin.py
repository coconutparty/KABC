from django.contrib import admin

from .models import DemoAccount, GameRecord, GameSnapshot, Player, SeasonRule, Team

admin.site.register(Team)
admin.site.register(Player)
admin.site.register(SeasonRule)
admin.site.register(GameRecord)
admin.site.register(GameSnapshot)
admin.site.register(DemoAccount)
