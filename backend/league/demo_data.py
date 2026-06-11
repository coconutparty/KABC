from .models import BattingStrategy, MasterPlayer, PitchType, Player, Team


TEAM_NAMES = ["복사골 피치브라더스", "인천 사이다즈", "제주 삼다스", "수원 갈비스"]

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


def mp(code, team, number, name, age, job, primary, positions, batting, fielding, position_stats, pitches, strategies, stamina, condition, attendance, dues, sponsor, traits, acquisition="initial", role="균형형"):
    return {
        "code": code,
        "team_name": team,
        "number": number,
        "name": name,
        "age": age,
        "job": job,
        "batting_role": role,
        "positions": positions,
        "primary_position": primary,
        "batting_stats": batting,
        "fielding_stats": fielding,
        "position_stats": position_stats,
        "pitches": pitches,
        "batting_strategies": strategies,
        "max_stamina": stamina,
        "condition": condition,
        "attendance": attendance,
        "dues_trait": dues,
        "sponsor_trait": sponsor,
        "traits": traits,
        "acquisition": acquisition,
        "meta": {"source": "master"},
    }


MASTER_PLAYER_DATA = [
    mp("bpb-001", "복사골 피치브라더스", 7, "김철민", 32, "청마루 감자탕 후계자", "유틸", ["투수", "포수", "내야수", "외야수"], {"contact": 68, "discipline": 66, "power": 72, "speed": 64}, {"control": 67, "velocity": 91, "awareness": 70}, {"stuff": 66, "range": 67, "jump": 62, "lead": 58}, ["직구", "슬라이더", "커브", "포크볼"], ["contact", "wait", "power", "run"], 100, 76, 86, 72, 68, ["주인공", "투타 겸업"]),
    mp("bpb-002", "복사골 피치브라더스", 11, "박민수", 28, "공무원/공공기관", "투수", ["투수", "내야수"], {"contact": 41, "discipline": 45, "power": 38, "speed": 52}, {"control": 76, "velocity": 90, "awareness": 68}, {"stuff": 74, "range": 55, "jump": 48, "lead": 42}, ["직구", "투심", "슬라이더", "체인지업"], ["contact", "wait", "opposite", "run"], 110, 72, 92, 80, 45, ["제구 안정"]),
    mp("bpb-003", "복사골 피치브라더스", 12, "이준서", 35, "자영업자", "투수", ["투수", "내야수"], {"contact": 44, "discipline": 48, "power": 43, "speed": 46}, {"control": 70, "velocity": 93, "awareness": 62}, {"stuff": 78, "range": 50, "jump": 45, "lead": 40}, ["직구", "싱커", "커터", "스플리터"], ["contact", "wait", "pull", "run"], 95, 70, 68, 65, 84, ["강한 어깨"]),
    mp("bpb-004", "복사골 피치브라더스", 22, "최성호", 31, "대기업 사무직", "포수", ["포수", "내야수"], {"contact": 58, "discipline": 65, "power": 55, "speed": 42}, {"control": 67, "velocity": 72, "awareness": 78}, {"stuff": 50, "range": 56, "jump": 48, "lead": 80}, [], ["contact", "wait", "opposite", "bunt"], 100, 74, 77, 76, 54, ["리드 우수"]),
    mp("bpb-005", "복사골 피치브라더스", 27, "정태윤", 38, "영업직", "포수", ["포수", "내야수"], {"contact": 54, "discipline": 60, "power": 62, "speed": 38}, {"control": 61, "velocity": 75, "awareness": 72}, {"stuff": 45, "range": 50, "jump": 44, "lead": 73}, [], ["contact", "wait", "power", "pull"], 88, 67, 62, 58, 71, ["분위기메이커"]),
    mp("bpb-006", "복사골 피치브라더스", 15, "강도현", 26, "프리랜서", "2루수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 70, "discipline": 64, "power": 58, "speed": 76}, {"control": 66, "velocity": 67, "awareness": 72}, {"stuff": 44, "range": 78, "jump": 61, "lead": 42}, [], ["contact", "wait", "steal", "bunt"], 105, 80, 88, 62, 44, ["빠른 발"]),
    mp("bpb-007", "복사골 피치브라더스", 18, "조현우", 33, "스타트업/중소기업", "유격수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 62, "discipline": 60, "power": 60, "speed": 70}, {"control": 70, "velocity": 74, "awareness": 69}, {"stuff": 48, "range": 74, "jump": 58, "lead": 40}, [], ["contact", "wait", "steal", "opposite"], 98, 69, 64, 55, 48, ["수비 집중"]),
    mp("bpb-008", "복사골 피치브라더스", 24, "윤상혁", 40, "야구교실 코치", "3루수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 66, "discipline": 72, "power": 69, "speed": 48}, {"control": 72, "velocity": 78, "awareness": 76}, {"stuff": 52, "range": 68, "jump": 60, "lead": 58}, [], ["contact", "wait", "power", "pull"], 85, 82, 90, 86, 42, ["베테랑"]),
    mp("bpb-009", "복사골 피치브라더스", 31, "장영재", 24, "무직/백수", "좌익수", ["좌익수", "중견수", "우익수"], {"contact": 59, "discipline": 51, "power": 70, "speed": 72}, {"control": 55, "velocity": 76, "awareness": 58}, {"stuff": 40, "range": 58, "jump": 74, "lead": 35}, [], ["contact", "power", "steal", "aggressive"], 110, 73, 92, 40, 35, ["장타 본능"]),
    mp("bpb-010", "복사골 피치브라더스", 33, "임기범", 29, "프리랜서", "중견수", ["좌익수", "중견수", "우익수"], {"contact": 64, "discipline": 59, "power": 57, "speed": 82}, {"control": 60, "velocity": 73, "awareness": 68}, {"stuff": 42, "range": 62, "jump": 78, "lead": 36}, [], ["contact", "wait", "steal", "run"], 105, 79, 86, 61, 46, ["넓은 수비"]),
    mp("bpb-011", "복사골 피치브라더스", 44, "한동현", 36, "영업직", "우익수", ["좌익수", "중견수", "우익수"], {"contact": 61, "discipline": 57, "power": 74, "speed": 54}, {"control": 58, "velocity": 82, "awareness": 62}, {"stuff": 43, "range": 55, "jump": 68, "lead": 34}, [], ["contact", "power", "pull", "aggressive"], 90, 68, 60, 52, 76, ["강한 어깨"]),
    mp("bpb-012", "복사골 피치브라더스", 55, "오지훈", 30, "공무원/공공기관", "유틸", ["투수", "포수", "내야수", "외야수"], {"contact": 57, "discipline": 63, "power": 54, "speed": 60}, {"control": 64, "velocity": 88, "awareness": 65}, {"stuff": 60, "range": 61, "jump": 58, "lead": 61}, ["직구", "커브", "체인지업", "투심"], ["contact", "wait", "opposite", "bunt"], 100, 75, 91, 82, 50, ["멀티 포지션"]),
]

OPPONENT_BASES = [
    ("인천 사이다즈", "isd"),
    ("제주 삼다스", "jsd"),
    ("수원 갈비스", "sgb"),
]

for team_name, prefix in OPPONENT_BASES:
    MASTER_PLAYER_DATA.extend([
        mp(f"{prefix}-001", team_name, 10, f"{team_name[:2]}투수A", 29, "공무원/공공기관", "투수", ["투수", "내야수"], {"contact": 42, "discipline": 47, "power": 40, "speed": 52}, {"control": 74, "velocity": 91, "awareness": 68}, {"stuff": 73, "range": 52, "jump": 46, "lead": 40}, ["직구", "슬라이더", "체인지업", "커브"], ["contact", "wait", "opposite", "run"], 105, 72, 88, 78, 46, ["선발형"]),
        mp(f"{prefix}-002", team_name, 11, f"{team_name[:2]}투수B", 34, "자영업자", "투수", ["투수", "내야수"], {"contact": 39, "discipline": 43, "power": 42, "speed": 45}, {"control": 68, "velocity": 94, "awareness": 64}, {"stuff": 79, "range": 48, "jump": 44, "lead": 38}, ["직구", "싱커", "커터", "스플리터"], ["contact", "wait", "pull", "run"], 95, 70, 69, 62, 82, ["구위형"]),
        mp(f"{prefix}-003", team_name, 12, f"{team_name[:2]}투수C", 27, "프리랜서", "투수", ["투수", "내야수"], {"contact": 45, "discipline": 46, "power": 37, "speed": 57}, {"control": 70, "velocity": 89, "awareness": 66}, {"stuff": 69, "range": 55, "jump": 49, "lead": 41}, ["직구", "투심", "포크볼", "너클커브"], ["contact", "wait", "steal", "opposite"], 108, 74, 84, 60, 44, ["롱릴리프"]),
        mp(f"{prefix}-004", team_name, 20, f"{team_name[:2]}포수A", 32, "대기업 사무직", "포수", ["포수", "내야수"], {"contact": 59, "discipline": 66, "power": 56, "speed": 43}, {"control": 66, "velocity": 74, "awareness": 77}, {"stuff": 48, "range": 54, "jump": 47, "lead": 79}, [], ["contact", "wait", "opposite", "bunt"], 98, 74, 75, 74, 50, ["리드 우수"]),
        mp(f"{prefix}-005", team_name, 21, f"{team_name[:2]}포수B", 39, "야구교실 코치", "포수", ["포수", "내야수"], {"contact": 55, "discipline": 62, "power": 61, "speed": 39}, {"control": 62, "velocity": 76, "awareness": 73}, {"stuff": 46, "range": 49, "jump": 45, "lead": 74}, [], ["contact", "wait", "power", "pull"], 86, 69, 89, 84, 42, ["베테랑"]),
        mp(f"{prefix}-006", team_name, 30, f"{team_name[:2]}내야A", 25, "스타트업/중소기업", "2루수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 68, "discipline": 60, "power": 57, "speed": 77}, {"control": 65, "velocity": 68, "awareness": 70}, {"stuff": 42, "range": 77, "jump": 61, "lead": 38}, [], ["contact", "wait", "steal", "bunt"], 108, 77, 61, 54, 44, ["빠른 발"]),
        mp(f"{prefix}-007", team_name, 31, f"{team_name[:2]}내야B", 31, "영업직", "유격수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 63, "discipline": 58, "power": 62, "speed": 69}, {"control": 70, "velocity": 73, "awareness": 69}, {"stuff": 45, "range": 73, "jump": 57, "lead": 40}, [], ["contact", "wait", "steal", "opposite"], 99, 70, 64, 56, 66, ["수비 집중"]),
        mp(f"{prefix}-008", team_name, 32, f"{team_name[:2]}내야C", 36, "공무원/공공기관", "3루수", ["1루수", "2루수", "3루수", "유격수"], {"contact": 64, "discipline": 66, "power": 70, "speed": 50}, {"control": 69, "velocity": 79, "awareness": 74}, {"stuff": 50, "range": 66, "jump": 60, "lead": 44}, [], ["contact", "wait", "power", "pull"], 90, 73, 90, 80, 52, ["클러치"]),
        mp(f"{prefix}-009", team_name, 40, f"{team_name[:2]}외야A", 24, "무직/백수", "좌익수", ["좌익수", "중견수", "우익수"], {"contact": 58, "discipline": 52, "power": 72, "speed": 73}, {"control": 55, "velocity": 78, "awareness": 58}, {"stuff": 40, "range": 57, "jump": 75, "lead": 35}, [], ["contact", "power", "steal", "aggressive"], 112, 73, 93, 42, 35, ["장타 본능"]),
        mp(f"{prefix}-010", team_name, 41, f"{team_name[:2]}외야B", 28, "프리랜서", "중견수", ["좌익수", "중견수", "우익수"], {"contact": 65, "discipline": 59, "power": 58, "speed": 80}, {"control": 60, "velocity": 72, "awareness": 67}, {"stuff": 42, "range": 61, "jump": 79, "lead": 36}, [], ["contact", "wait", "steal", "run"], 106, 78, 86, 62, 46, ["넓은 수비"]),
        mp(f"{prefix}-011", team_name, 42, f"{team_name[:2]}외야C", 35, "자영업자", "우익수", ["좌익수", "중견수", "우익수"], {"contact": 60, "discipline": 56, "power": 75, "speed": 55}, {"control": 58, "velocity": 83, "awareness": 62}, {"stuff": 43, "range": 55, "jump": 69, "lead": 34}, [], ["contact", "power", "pull", "aggressive"], 92, 68, 63, 60, 82, ["강한 어깨"]),
        mp(f"{prefix}-012", team_name, 50, f"{team_name[:2]}유틸", 30, "공무원/공공기관", "유틸", ["투수", "포수", "내야수", "외야수"], {"contact": 57, "discipline": 63, "power": 55, "speed": 61}, {"control": 64, "velocity": 88, "awareness": 65}, {"stuff": 60, "range": 61, "jump": 58, "lead": 61}, ["직구", "커브", "체인지업", "투심"], ["contact", "wait", "opposite", "bunt"], 100, 75, 91, 82, 50, ["멀티 포지션"]),
    ])

RECRUIT_STAR_COUNTS = {1: 30, 2: 20, 3: 20, 4: 20, 5: 10}
RECRUIT_POSITIONS = ["투수", "포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수", "유틸"]
RECRUIT_JOBS = ["공무원/공공기관", "대기업 사무직", "스타트업/중소기업", "영업직", "자영업자", "프리랜서", "무직/백수", "야구교실 코치"]
PREMIUM_RECRUIT_JOBS = ["야구교실 코치", "자영업자", "공무원/공공기관"]
RECRUIT_LAST_NAMES = ["강", "고", "권", "김", "나", "노", "문", "박", "배", "서", "손", "송", "신", "안", "양", "오", "유", "윤", "이", "임", "장", "전", "정", "조", "주", "차", "최", "한", "허", "황"]
RECRUIT_GIVEN_NAMES = [
    "건우", "경민", "규하", "기석", "도겸", "도윤", "동하", "민규", "민재", "민준",
    "병찬", "상우", "서율", "성빈", "성준", "시온", "영민", "우진", "윤겸", "재민",
    "재원", "정후", "준서", "지완", "지혁", "찬우", "태민", "태오", "하람", "현서",
    "현수", "호준", "효민", "강현", "라온", "로운", "선재", "승현", "연우", "이현",
    "준혁", "찬혁", "태건", "하준", "한결", "휘준", "다온", "도현", "민석", "상혁",
    "원준", "유찬", "재윤", "지호", "태훈", "현준", "규빈", "서진", "유건", "정민",
]


def recruit_base(stars, primary):
    if primary == "투수":
        return {1: 48, 2: 56, 3: 69, 4: 77, 5: 87}[stars]
    if primary == "유틸" and stars == 1:
        return 46
    return {1: 50, 2: 60, 3: 70, 4: 79, 5: 88}[stars]


def recruit_positions(primary):
    if primary == "투수":
        return ["투수", "내야수"]
    if primary == "포수":
        return ["포수", "내야수"]
    if primary in ["1루수", "2루수", "3루수", "유격수"]:
        return ["1루수", "2루수", "3루수", "유격수"]
    if primary in ["좌익수", "중견수", "우익수"]:
        return ["좌익수", "중견수", "우익수"]
    return ["투수", "포수", "내야수", "외야수"]


def recruit_stats(stars, primary, index):
    base = recruit_base(stars, primary)
    drift = (index % 5) - 2
    batting = {
        "contact": max(25, min(95, base + drift)),
        "discipline": max(25, min(95, base - 2 + (index % 3))),
        "power": max(25, min(95, base + (4 if primary in ["1루수", "3루수", "우익수"] else -1))),
        "speed": max(25, min(95, base + (5 if primary in ["유격수", "중견수", "좌익수"] else -2))),
    }
    fielding = {
        "control": max(25, min(95, base + (4 if primary in ["투수", "포수", "유격수"] else 0))),
        "velocity": max(25, min(98, max(88, base + 1) if primary in ["투수", "유틸"] else base + (4 if primary in ["포수", "우익수"] else 0))),
        "awareness": max(25, min(95, base + (4 if primary in ["포수", "유격수", "중견수"] else 0))),
    }
    position_stats = {
        "stuff": max(25, min(95, base + (5 if primary == "투수" else -8))),
        "range": max(25, min(95, base + (6 if primary in ["2루수", "유격수"] else 0))),
        "jump": max(25, min(95, base + (6 if primary in ["좌익수", "중견수", "우익수"] else -2))),
        "lead": max(25, min(95, base + (7 if primary == "포수" else -8))),
    }
    return batting, fielding, position_stats


def recruit_pitches(primary, index):
    if primary not in ["투수", "유틸"]:
        return []
    extra_sets = [
        ["슬라이더", "커브", "체인지업"],
        ["싱커", "커터", "스플리터"],
        ["투심", "포크볼", "너클커브"],
        ["커브", "서클체인지", "스크류볼"],
        ["슬라이더", "팜볼", "체인지업"],
    ]
    return ["직구", *extra_sets[index % len(extra_sets)]]


def recruit_strategies(primary, index):
    if primary == "투수":
        return ["contact", "wait", "opposite", "run"]
    if primary in ["좌익수", "중견수", "유격수"]:
        return ["contact", "wait", "steal", "run"]
    if primary in ["1루수", "3루수", "우익수"]:
        return ["contact", "power", "pull", "aggressive"]
    if primary == "포수":
        return ["contact", "wait", "opposite", "bunt"]
    return ["contact", "wait", "bunt", "steal"]


def recruit_age(stars, index):
    if stars == 5:
        return [24, 27, 31, 34, 36, 39][index % 6]
    if stars == 4:
        return [25, 28, 32, 35, 37, 41][index % 6]
    return [22, 24, 27, 30, 33, 36, 39, 43][index % 8]


def recruit_trait(stars, primary):
    if stars == 5:
        return ["프랜차이즈급", "즉전 핵심", primary]
    if stars == 4:
        return ["주전 후보", "즉전감", primary]
    if stars == 3:
        return ["성장형", primary]
    if stars == 2:
        return ["백업 후보", primary]
    return ["아마추어", primary]


def build_recruit_master_players():
    players = []
    sequence = []
    for stars, count in RECRUIT_STAR_COUNTS.items():
        sequence.extend([stars] * count)
    for index, stars in enumerate(sequence):
        primary = RECRUIT_POSITIONS[index % len(RECRUIT_POSITIONS)]
        batting, fielding, position_stats = recruit_stats(stars, primary, index)
        job_pool = PREMIUM_RECRUIT_JOBS if stars >= 4 else RECRUIT_JOBS
        name = f"{RECRUIT_LAST_NAMES[index % len(RECRUIT_LAST_NAMES)]}{RECRUIT_GIVEN_NAMES[(index * 7 + stars) % len(RECRUIT_GIVEN_NAMES)]}"
        players.append(mp(
            f"rec-{index + 1:03d}",
            "",
            60 + index,
            name,
            recruit_age(stars, index),
            job_pool[(index + stars) % len(job_pool)],
            primary,
            recruit_positions(primary),
            batting,
            fielding,
            position_stats,
            recruit_pitches(primary, index),
            recruit_strategies(primary, index),
            {1: 86, 2: 94, 3: 100, 4: 106, 5: 112}[stars],
            {1: 61, 2: 68, 3: 74, 4: 80, 5: 86}[stars],
            min(99, {1: 58, 2: 66, 3: 74, 4: 84, 5: 91}[stars] + (index % 5)),
            min(99, {1: 42, 2: 52, 3: 64, 4: 82, 5: 90}[stars] + (index % 4)),
            min(99, {1: 35, 2: 46, 3: 58, 4: 73, 5: 86}[stars] + (index % 6)),
            recruit_trait(stars, primary),
            "recruit",
            "균형형",
        ))
        players[-1]["meta"] = {**players[-1]["meta"], "stars": stars, "pool": "recruit"}
    return players


MASTER_PLAYER_DATA.extend(build_recruit_master_players())


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


def seed_master_players():
    active_codes = {data["code"] for data in MASTER_PLAYER_DATA}
    for data in MASTER_PLAYER_DATA:
        data = {**data, "is_active": True}
        MasterPlayer.objects.update_or_create(code=data["code"], defaults=data)
    MasterPlayer.objects.filter(meta__source="master").exclude(code__in=active_codes).update(is_active=False)


def player_from_master(master, account, team, number=None):
    return Player.objects.create(
        account=account,
        team=team,
        number=master.number if number is None else number,
        name=master.name,
        age=master.age,
        job=master.job,
        batting_role=master.batting_role,
        positions=master.positions,
        primary_position=master.primary_position,
        batting_stats=master.batting_stats,
        fielding_stats=master.fielding_stats,
        position_stats=master.position_stats,
        pitches=master.pitches,
        batting_strategies=master.batting_strategies,
        max_stamina=master.max_stamina,
        stamina=master.max_stamina,
        condition=master.condition,
        attendance=master.attendance,
        dues_trait=master.dues_trait,
        sponsor_trait=master.sponsor_trait,
        traits=master.traits,
        meta={**master.meta, "masterCode": master.code, "acquisition": master.acquisition},
    )


def create_demo_league(account=None, seed=None):
    seed_master_players()
    teams = []
    for team_index, name in enumerate(TEAM_NAMES):
        team = Team.objects.create(
            account=account,
            name=name,
            is_player=team_index == 0,
            funds=3_000_000 if team_index == 0 else 3_200_000 + team_index * 250_000,
            recent_mood=60 if team_index == 0 else 64 + team_index,
            bond=70 if team_index == 0 else 63 + team_index,
            trust=70 if team_index == 0 else 64 + team_index,
            fairness=70 if team_index == 0 else 62 + team_index,
            meta={"tendency": ["균형형", "수비형", "공격형", "투수력 중시"][team_index]},
        )
        teams.append(team)
        masters = MasterPlayer.objects.filter(team_name=name, acquisition="initial", is_active=True).order_by("id")
        for master in masters:
            player_from_master(master, account, team)
    return teams
