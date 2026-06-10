from django.db import models


class Team(models.Model):
    account = models.ForeignKey("DemoAccount", related_name="teams", null=True, blank=True, on_delete=models.CASCADE)
    name = models.CharField(max_length=80)
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

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "name"], name="unique_team_name_per_account"),
        ]

    def __str__(self):
        return self.name


class Player(models.Model):
    account = models.ForeignKey("DemoAccount", related_name="players", null=True, blank=True, on_delete=models.CASCADE)
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
    account = models.ForeignKey("DemoAccount", related_name="game_records", null=True, blank=True, on_delete=models.CASCADE)
    played_at = models.DateTimeField(auto_now_add=True)
    home_team = models.ForeignKey(Team, related_name="home_games", on_delete=models.CASCADE)
    away_team = models.ForeignKey(Team, related_name="away_games", on_delete=models.CASCADE)
    home_score = models.IntegerField(default=0)
    away_score = models.IntegerField(default=0)
    result = models.CharField(max_length=20)
    cold_game = models.BooleanField(default=False)
    summary = models.JSONField(default=dict, blank=True)


class PitchType(models.Model):
    code = models.CharField(max_length=40, unique=True)
    label = models.CharField(max_length=40)
    speed_min = models.FloatField()
    speed_max = models.FloatField()
    contact_mod = models.FloatField(default=0)
    discipline_mod = models.FloatField(default=0)
    control_mod = models.FloatField(default=0)
    stamina = models.FloatField(default=1)
    distance_mod = models.FloatField(null=True, blank=True)
    grounder = models.FloatField(null=True, blank=True)
    ground_distance_mod = models.FloatField(null=True, blank=True)
    description = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.label


class BattingStrategy(models.Model):
    code = models.CharField(max_length=40, unique=True)
    label = models.CharField(max_length=60)
    stamina = models.FloatField(default=1)
    contact = models.FloatField(default=1)
    power = models.FloatField(default=1)
    discipline = models.FloatField(default=1)
    speed = models.FloatField(default=1)
    distance = models.FloatField(default=0)
    description = models.CharField(max_length=160)
    is_active = models.BooleanField(default=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.label


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
