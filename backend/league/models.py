from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=80, unique=True)
    is_player = models.BooleanField(default=False)
    funds = models.IntegerField(default=3_000_000)
    recent_mood = models.IntegerField(default=60)
    bond = models.IntegerField(default=70)
    trust = models.IntegerField(default=70)
    fairness = models.IntegerField(default=70)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    draws = models.IntegerField(default=0)
    meta = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name


class Player(models.Model):
    team = models.ForeignKey(Team, related_name="players", on_delete=models.CASCADE)
    number = models.IntegerField()
    name = models.CharField(max_length=80)
    age = models.IntegerField()
    job = models.CharField(max_length=40)
    batting_role = models.CharField(max_length=40)
    positions = models.JSONField(default=list)
    primary_position = models.CharField(max_length=30)
    batting_stats = models.JSONField(default=dict)
    fielding_stats = models.JSONField(default=dict)
    position_stats = models.JSONField(default=dict)
    pitches = models.JSONField(default=list, blank=True)
    batting_strategies = models.JSONField(default=list, blank=True)
    max_stamina = models.IntegerField()
    stamina = models.IntegerField()
    condition = models.IntegerField(default=70)
    attendance = models.IntegerField()
    dues_trait = models.IntegerField()
    sponsor_trait = models.IntegerField()
    traits = models.JSONField(default=list, blank=True)
    recent_games = models.JSONField(default=list, blank=True)
    consecutive_starts = models.IntegerField(default=0)
    missed_games = models.IntegerField(default=0)
    considering_leave = models.BooleanField(default=False)
    injured = models.BooleanField(default=False)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("team", "number")

    def __str__(self):
        return f"{self.team.name} #{self.number} {self.name}"


class SeasonRule(models.Model):
    name = models.CharField(max_length=80, unique=True)
    entry_fee = models.IntegerField(default=3_000_000)
    champion_reward = models.IntegerField(default=20_000_000)
    runner_up_reward = models.IntegerField(default=10_000_000)
    third_reward = models.IntegerField(default=5_000_000)
    weeks_in_demo = models.IntegerField(default=2)
    max_games_in_demo = models.IntegerField(default=8)
    meta = models.JSONField(default=dict, blank=True)


class GameRecord(models.Model):
    played_at = models.DateTimeField(auto_now_add=True)
    home_team = models.ForeignKey(Team, related_name="home_games", on_delete=models.CASCADE)
    away_team = models.ForeignKey(Team, related_name="away_games", on_delete=models.CASCADE)
    home_score = models.IntegerField(default=0)
    away_score = models.IntegerField(default=0)
    result = models.CharField(max_length=20)
    cold_game = models.BooleanField(default=False)
    summary = models.JSONField(default=dict, blank=True)


class GameSnapshot(models.Model):
    key = models.CharField(max_length=40, unique=True, default="default")
    state = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class DemoAccount(models.Model):
    username = models.CharField(max_length=30, unique=True)
    display_name = models.CharField(max_length=40)
    password_hash = models.CharField(max_length=128)
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username
