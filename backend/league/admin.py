from django.contrib import admin

from .models import BattingStrategy, DemoAccount, GameRecord, GameSnapshot, PitchType, Player, SeasonRule, Team

admin.site.register(Team)
admin.site.register(Player)
admin.site.register(SeasonRule)
admin.site.register(GameRecord)
admin.site.register(GameSnapshot)
admin.site.register(DemoAccount)
admin.site.register(PitchType)
admin.site.register(BattingStrategy)
