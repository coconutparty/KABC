import random

from .models import BattingStrategy, PitchType, Player, Team


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

PITCH_TYPE_DATA = {
    "직구": {"speed": [1.6, 1.65], "contactMod": 5, "controlMod": 5, "stamina": 1, "distanceMod": 1.1, "description": "구속 160~165%, 상대 컨택 +5%, 체력 -1"},
    "싱커": {"speed": [1.55, 1.6], "contactMod": 0, "controlMod": -2, "stamina": 1.2, "grounder": 30, "groundDistanceMod": 0.7, "description": "장타 -5%, 30% 땅볼, 체력 -1.2"},
    "투심": {"speed": [1.5, 1.55], "contactMod": 5, "controlMod": 0, "stamina": 1.2, "grounder": 25, "groundDistanceMod": 0.75, "description": "상대 컨택 +5%, 25% 땅볼, 체력 -1.2"},
    "커터": {"speed": [1.45, 1.5], "contactMod": 0, "controlMod": 0, "stamina": 1.2, "description": "10% 비거리 절반, 체력 -1.2"},
    "슬라이더": {"speed": [1.35, 1.4], "contactMod": -5, "controlMod": -5, "stamina": 1.2, "description": "상대 컨택 -5%, 데드볼 위험, 체력 -1.2"},
    "스플리터": {"speed": [1.3, 1.35], "contactMod": -7, "controlMod": -8, "stamina": 1.5, "grounder": 20, "description": "상대 컨택 -7%, 20% 땅볼, 체력 -1.5"},
    "포크볼": {"speed": [1.25, 1.3], "contactMod": -10, "controlMod": -8, "stamina": 1.5, "description": "상대 컨택 -10%, 폭투 위험, 체력 -1.5"},
    "커브": {"speed": [1.2, 1.25], "contactMod": 5, "controlMod": -3, "stamina": 1.4, "description": "상대 컨택 +5%, 비거리 억제 가능, 체력 -1.4"},
    "너클커브": {"speed": [1.15, 1.2], "contactMod": -3, "controlMod": -3, "stamina": 1.4, "description": "상대 컨택 -3%, 비거리 억제 가능, 체력 -1.4"},
    "체인지업": {"speed": [1.05, 1.15], "contactMod": -3, "controlMod": 0, "stamina": 1.1, "description": "상대 컨택 -3%, 직구 후 추가 효과, 체력 -1.1"},
    "서클체인지": {"speed": [1, 1.1], "contactMod": -2, "disciplineMod": -5, "controlMod": 0, "stamina": 1.1, "description": "컨택 -2%, 선구안 -5%, 체력 -1.1"},
    "팜볼": {"speed": [0.95, 1.05], "contactMod": 0, "disciplineMod": -5, "controlMod": -5, "stamina": 1.3, "distanceMod": 1.1, "description": "선구안 -5%, 타격 성공 시 비거리 +10%, 체력 -1.3"},
    "너클볼": {"speed": [0.8, 0.9], "contactMod": -15, "controlMod": -15, "stamina": 2, "description": "컨택 -15%, 포일/폭투 위험, 체력 -2"},
    "스크류볼": {"speed": [1.2, 1.3], "contactMod": -6, "controlMod": -4, "stamina": 1.3, "description": "상대 컨택 -6%, 체력 -1.3"},
}

BATTING_STRATEGY_DATA = {
    "contact": {"label": "컨택 위주", "stamina": 1, "contact": 1.1, "power": 0.9, "discipline": 1, "speed": 1, "distance": 0, "description": "컨택 +10% · 장타 -10%"},
    "wait": {"label": "공을 오래 본다", "stamina": 1, "contact": 0.95, "power": 1, "discipline": 1.15, "speed": 1, "distance": 0, "description": "컨택 -5% · 선구 +15%"},
    "power": {"label": "장타를 노린다", "stamina": 2, "contact": 0.9, "power": 1.2, "discipline": 1, "speed": 1, "distance": 5, "description": "컨택 -10% · 장타 +20% · 비거리 +5m"},
    "run": {"label": "적극 주루까지 노린다", "stamina": 2, "contact": 1.05, "power": 1, "discipline": 1, "speed": 1.1, "distance": 0, "description": "컨택 +5% · 속도 +10%"},
    "bunt": {"label": "번트를 노린다", "stamina": 0.6, "contact": 1.18, "power": 0.45, "discipline": 1.05, "speed": 1.05, "distance": -28, "description": "컨택 +18% · 장타 -55% · 비거리 -28m"},
    "steal": {"label": "도루를 노린다", "stamina": 1.2, "contact": 0.96, "power": 0.9, "discipline": 1.1, "speed": 1.18, "distance": -4, "description": "선구 +10% · 속도 +18% · 장타 -10%"},
    "pull": {"label": "당겨치기", "stamina": 1.4, "contact": 0.92, "power": 1.12, "discipline": 0.95, "speed": 1, "distance": 3, "description": "컨택 -8% · 장타 +12% · 비거리 +3m"},
    "opposite": {"label": "밀어치기", "stamina": 1, "contact": 1.06, "power": 0.92, "discipline": 1.05, "speed": 1, "distance": -2, "description": "컨택 +6% · 선구 +5% · 장타 -8%"},
    "aggressive": {"label": "초구 공략", "stamina": 1.2, "contact": 1.08, "power": 1.05, "discipline": 0.85, "speed": 1, "distance": 2, "description": "컨택 +8% · 장타 +5% · 선구 -15%"},
}

BATTING_STRATEGIES = list(BATTING_STRATEGY_DATA.keys())
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


def seed_skill_tables():
    for code, data in PITCH_TYPE_DATA.items():
        PitchType.objects.update_or_create(
            code=code,
            defaults={
                "label": code,
                "speed_min": data["speed"][0],
                "speed_max": data["speed"][1],
                "contact_mod": data.get("contactMod", 0),
                "discipline_mod": data.get("disciplineMod", 0),
                "control_mod": data.get("controlMod", 0),
                "stamina": data.get("stamina", 1),
                "distance_mod": data.get("distanceMod"),
                "grounder": data.get("grounder"),
                "ground_distance_mod": data.get("groundDistanceMod"),
                "description": data["description"],
            },
        )
    for code, data in BATTING_STRATEGY_DATA.items():
        BattingStrategy.objects.update_or_create(code=code, defaults={**data})


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


def batting_strategies_for(rng, batting):
    strategies = ["contact", "wait"]
    strategies.append("power" if batting["power"] >= 68 else "opposite")
    if batting["speed"] >= 68:
        strategies.append("steal")
    elif batting["contact"] >= 70 and batting["discipline"] >= 62:
        strategies.append("bunt")
    else:
        strategies.append(rng.choice(["run", "pull", "aggressive"]))
    unique = []
    for strategy in strategies:
        if strategy not in unique:
            unique.append(strategy)
    for strategy in rng.sample(BATTING_STRATEGIES, len(BATTING_STRATEGIES)):
        if len(unique) >= 4:
            break
        if strategy not in unique:
            unique.append(strategy)
    return unique[:4]


def make_player(rng, account, team, index, primary, is_kim=False):
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
    pitches = ["직구"] + rng.sample(PITCHES, 3) if "투수" in positions_for(primary) else []
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
    batting_strategies = ["contact", "wait", "power", "run"] if is_kim else batting_strategies_for(rng, batting)

    return Player(
        account=account,
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
        batting_strategies=batting_strategies,
        max_stamina=max_stamina,
        stamina=max_stamina,
        condition=rng.randint(58, 88),
        attendance=rng.randint(*attendance_range),
        dues_trait=rng.randint(35, 90),
        sponsor_trait=rng.randint(20, 95),
        traits=traits,
        meta={"career": career, "weekdayFatigue": fatigue_range, "seedRole": primary},
    )


def create_demo_league(account=None, seed=20260610):
    rng_seed = seed if account is None else seed + account.id * 9973
    rng = random.Random(rng_seed)
    teams = []
    for team_index, name in enumerate(TEAM_NAMES):
        team = Team.objects.create(
            account=account,
            name=name,
            is_player=team_index == 0,
            funds=3_000_000 if team_index == 0 else rng.randint(2_500_000, 5_500_000),
            recent_mood=60 if team_index == 0 else rng.randint(60, 70),
            bond=70 if team_index == 0 else rng.randint(60, 70),
            trust=70 if team_index == 0 else rng.randint(60, 70),
            fairness=70 if team_index == 0 else rng.randint(60, 70),
            meta={"tendency": rng.choice(["수비형", "공격형", "균형형", "투수력 중시"])},
        )
        teams.append(team)
        players = [
            make_player(rng, account, team, index, position, is_kim=(team_index == 0 and index == 0))
            for index, position in enumerate(POSITION_PLAN)
        ]
        Player.objects.bulk_create(players)
    return teams
