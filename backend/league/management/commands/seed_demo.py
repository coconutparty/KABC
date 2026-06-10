import random

from django.core.management.base import BaseCommand

from league.models import GameRecord, GameSnapshot, Player, SeasonRule, Team


JOBS = [
    ("공무원/공공기관", 14, (80, 95), (10, 18)),
    ("대기업 사무직", 14, (65, 85), (15, 28)),
    ("스타트업/중소기업", 16, (45, 75), (20, 38)),
    ("영업직", 12, (50, 80), (22, 40)),
    ("자영업자", 12, (45, 80), (25, 45)),
    ("프리랜서", 12, (70, 95), (8, 25)),
    ("무직/백수", 8, (85, 100), (0, 12)),
    ("야구교실 코치", 12, (75, 95), (15, 30)),
]

CAREERS = [
    ("초보", 10, (35, 45)),
    ("동호인", 45, (45, 60)),
    ("상급 동호인", 25, (60, 70)),
    ("선출 경험", 15, (70, 82)),
    ("세미프로급", 5, (80, 90)),
]

AGE_BUCKETS = [
    ((20, 24), 10),
    ((25, 29), 25),
    ((30, 34), 30),
    ((35, 39), 25),
    ((40, 44), 8),
    ((45, 49), 2),
]

PITCHES = [
    "싱커",
    "투심",
    "커터",
    "슬라이더",
    "스플리터",
    "포크볼",
    "커브",
    "너클커브",
    "체인지업",
    "서클체인지",
    "팜볼",
    "너클볼",
    "스크류볼",
]

TEAM_NAMES = ["복사골 피치브라더스", "인천 사이다즈", "제주 삼다스", "수원 갈비스"]
FIRST_NAMES = ["김", "박", "이", "최", "정", "강", "조", "윤", "장", "임", "한", "오"]
LAST_NAMES = ["철민", "민수", "지훈", "성호", "태윤", "준서", "도현", "현우", "상혁", "영재", "기범", "동현"]

POSITION_PLAN = [
    "투수",
    "투수",
    "투수",
    "포수",
    "포수",
    "내야수",
    "내야수",
    "내야수",
    "외야수",
    "외야수",
    "외야수",
    "유틸",
]


def weighted(rng, rows):
    total = sum(row[1] for row in rows)
    roll = rng.uniform(0, total)
    cursor = 0
    for row in rows:
        cursor += row[1]
        if roll <= cursor:
            return row
    return rows[-1]


def clamp(value, low=1, high=99):
    return max(low, min(high, round(value)))


def age_stamina(age):
    if age <= 24:
        return 115
    if age <= 29:
        return 110
    if age <= 34:
        return 100
    if age <= 39:
        return 90
    if age <= 44:
        return 80
    return 70


def job_stamina_bonus(rng, job):
    table = {
        "공무원/공공기관": 0,
        "대기업 사무직": -5,
        "스타트업/중소기업": 0,
        "영업직": 0,
        "자영업자": 5,
        "프리랜서": rng.randint(-5, 5),
        "무직/백수": -10,
        "야구교실 코치": 5,
    }
    return table[job]


def apply_position(stats, fielding, position_stats, position):
    if position == "투수":
        stats["contact"] -= 25
        stats["discipline"] -= 15
        stats["power"] -= 20
        stats["speed"] -= 10
        fielding["control"] += 10
        fielding["velocity"] = max(88, fielding["velocity"])
        fielding["awareness"] += 5
        position_stats["stuff"] += 10
    elif position == "포수":
        stats["contact"] -= 5
        stats["discipline"] += 5
        stats["power"] -= 5
        stats["speed"] -= 15
        fielding["control"] += 5
        fielding["velocity"] += 5
        fielding["awareness"] += 10
        position_stats["lead"] += 10
    elif position == "내야수":
        stats["contact"] += 5
        stats["power"] -= 5
        fielding["control"] += 5
        fielding["awareness"] += 5
        position_stats["range"] += 10
    elif position == "외야수":
        stats["power"] += 5
        stats["speed"] += 5
        fielding["velocity"] += 5
        fielding["awareness"] += 5
        position_stats["jump"] += 10
    elif position == "지명타자":
        stats["contact"] += 5
        stats["discipline"] += 5
        stats["power"] += 10
        stats["speed"] -= 5
        fielding["control"] -= 10
        fielding["velocity"] -= 10
        fielding["awareness"] -= 5


def positions_for(primary):
    if primary == "투수":
        return ["투수", "내야수"]
    if primary == "포수":
        return ["포수", "내야수"]
    if primary == "내야수":
        return ["1루수", "2루수", "3루수", "유격수"]
    if primary == "외야수":
        return ["좌익수", "중견수", "우익수"]
    if primary == "유틸":
        return ["투수", "포수", "내야수", "외야수"]
    return ["지명타자"]


def make_player(rng, team, index, primary, is_kim=False):
    age_range = weighted(rng, AGE_BUCKETS)[0]
    age = rng.randint(*age_range)
    job, _weight, attendance_range, fatigue_range = weighted(rng, JOBS)
    career, _career_weight, stat_range = weighted(rng, CAREERS)
    center = rng.randint(*stat_range)
    batting = {
        "contact": clamp(rng.gauss(center, 8)),
        "discipline": clamp(rng.gauss(center, 8)),
        "power": clamp(rng.gauss(center, 8)),
        "speed": clamp(rng.gauss(center, 8)),
    }
    fielding = {
        "control": clamp(rng.gauss(center, 8)),
        "velocity": clamp(rng.gauss(center + 20 if primary == "투수" else center, 8)),
        "awareness": clamp(rng.gauss(center, 8)),
    }
    position_stats = {
        "stuff": clamp(rng.gauss(center, 8)),
        "range": clamp(rng.gauss(center, 8)),
        "jump": clamp(rng.gauss(center, 8)),
        "lead": clamp(rng.gauss(center, 8)),
    }
    apply_position(batting, fielding, position_stats, primary)
    batting = {key: clamp(value, 5, 99) for key, value in batting.items()}
    fielding = {key: clamp(value, 5, 99) for key, value in fielding.items()}
    if primary == "투수":
        fielding["velocity"] = max(88, fielding["velocity"])
    position_stats = {key: clamp(value, 5, 99) for key, value in position_stats.items()}

    max_stamina = clamp(age_stamina(age) + job_stamina_bonus(rng, job), 55, 120)
    pitches = []
    if "투수" in positions_for(primary):
        pitches = ["직구"] + rng.sample(PITCHES, 3)

    name = "김철민" if is_kim else f"{rng.choice(FIRST_NAMES)}{rng.choice(LAST_NAMES)}"
    traits = rng.sample(["꾸준함", "승부근성", "분위기메이커", "강한 어깨", "선구안", "장타 본능"], rng.randint(1, 2))
    if is_kim:
        age = 32
        job = "청마루 감자탕 후계자"
        primary = "유틸"
        batting = {"contact": 68, "discipline": 66, "power": 72, "speed": 64}
        fielding = {"control": 67, "velocity": 91, "awareness": 70}
        position_stats = {"stuff": 66, "range": 67, "jump": 62, "lead": 58}
        pitches = ["직구", "슬라이더", "커브", "포크볼"]
        max_stamina = 100
        traits = ["주인공", "투타 겸업"]

    return Player(
        team=team,
        number=7 if is_kim else index + 10,
        name=name,
        age=age,
        job=job,
        batting_role="균형형" if primary != "투수" else "하위타선",
        positions=positions_for(primary),
        primary_position=primary,
        batting_stats=batting,
        fielding_stats=fielding,
        position_stats=position_stats,
        pitches=pitches,
        max_stamina=max_stamina,
        stamina=max_stamina,
        condition=rng.randint(58, 88),
        attendance=rng.randint(*attendance_range),
        dues_trait=rng.randint(35, 90),
        sponsor_trait=rng.randint(20, 95),
        traits=traits,
        meta={"career": career, "weekdayFatigue": fatigue_range, "seedRole": primary},
    )


class Command(BaseCommand):
    help = "Seed KABC tech demo teams and players."

    def handle(self, *args, **options):
        rng = random.Random(20260610)
        GameRecord.objects.all().delete()
        GameSnapshot.objects.all().delete()
        Player.objects.all().delete()
        Team.objects.all().delete()
        SeasonRule.objects.all().delete()

        SeasonRule.objects.create(name="Tech Demo 0.0.1")
        for team_index, name in enumerate(TEAM_NAMES):
            team = Team.objects.create(
                name=name,
                is_player=team_index == 0,
                funds=3_000_000 if team_index == 0 else rng.randint(2_500_000, 5_500_000),
                recent_mood=60 if team_index == 0 else rng.randint(60, 70),
                bond=70 if team_index == 0 else rng.randint(60, 70),
                trust=70 if team_index == 0 else rng.randint(60, 70),
                fairness=70 if team_index == 0 else rng.randint(60, 70),
                meta={"tendency": rng.choice(["수비형", "공격형", "균형형", "투수력 중시"])},
            )
            players = []
            for index, position in enumerate(POSITION_PLAN):
                players.append(make_player(rng, team, index, position, is_kim=(team_index == 0 and index == 0)))
            Player.objects.bulk_create(players)

        self.stdout.write(self.style.SUCCESS("Seeded KABC tech demo data."))
