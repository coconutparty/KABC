import json
import secrets

from django.core.management import call_command
from django.http import JsonResponse
from django.contrib.auth.hashers import check_password, make_password
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .demo_data import create_demo_league, player_from_master, seed_master_players, seed_skill_tables
from .models import BattingStrategy, DemoAccount, GameRecord, GameSnapshot, MasterPlayer, PitchType, Player, SeasonRule, Team


PLAYER_TEAM_NAME = "복사골 피치브라더스"


def payload(request):
    return json.loads(request.body.decode("utf-8") or "{}")


def account_payload(account):
    return {
        "username": account.username,
        "displayName": account.display_name,
        "token": account.token,
    }


def account_from_request(request):
    header = request.headers.get("Authorization", "")
    token = header.removeprefix("Bearer ").strip()
    if not token:
        return None
    return DemoAccount.objects.filter(token=token).first()


def snapshot_key(account):
    return f"account:{account.id}"


def ensure_player_team_name():
    team = Team.objects.filter(is_player=True, account__isnull=True).first()
    if team and team.name != PLAYER_TEAM_NAME:
        team.name = PLAYER_TEAM_NAME
        team.save(update_fields=["name"])


def ensure_global_config():
    if SeasonRule.objects.count() == 0:
        SeasonRule.objects.create(name="Tech Demo 0.0.2")
    if PitchType.objects.count() == 0 or BattingStrategy.objects.count() == 0:
        seed_skill_tables()
    if MasterPlayer.objects.count() == 0 or MasterPlayer.objects.filter(acquisition="recruit", is_active=True).count() < 100:
        seed_master_players()


def ensure_account_league(account):
    ensure_global_config()
    if not Team.objects.filter(account=account).exists():
        create_demo_league(account=account)


def serialize_team(team):
    return {
        "id": team.id,
        "accountId": team.account_id,
        "name": team.name,
        "isPlayer": team.is_player,
        "funds": team.funds,
        "recentMood": team.recent_mood,
        "bond": team.bond,
        "trust": team.trust,
        "fairness": team.fairness,
        "wins": team.wins,
        "losses": team.losses,
        "draws": team.draws,
        "meta": team.meta,
    }


def serialize_player(player):
    return {
        "id": player.id,
        "accountId": player.account_id,
        "teamId": player.team_id,
        "number": player.number,
        "name": player.name,
        "age": player.age,
        "job": player.job,
        "battingRole": player.batting_role,
        "positions": player.positions,
        "primaryPosition": player.primary_position,
        "battingStats": player.batting_stats,
        "fieldingStats": player.fielding_stats,
        "positionStats": player.position_stats,
        "pitches": player.pitches,
        "battingStrategies": player.batting_strategies,
        "maxStamina": player.max_stamina,
        "stamina": player.stamina,
        "condition": player.condition,
        "attendance": player.attendance,
        "duesTrait": player.dues_trait,
        "sponsorTrait": player.sponsor_trait,
        "traits": player.traits,
        "recentGames": player.recent_games,
        "consecutiveStarts": player.consecutive_starts,
        "missedGames": player.missed_games,
        "consideringLeave": player.considering_leave,
        "injured": player.injured,
        "meta": player.meta,
    }


def serialize_master_player(player):
    return {
        "id": player.id,
        "masterCode": player.code,
        "teamId": None,
        "number": player.number,
        "name": player.name,
        "age": player.age,
        "job": player.job,
        "battingRole": player.batting_role,
        "positions": player.positions,
        "primaryPosition": player.primary_position,
        "battingStats": player.batting_stats,
        "fieldingStats": player.fielding_stats,
        "positionStats": player.position_stats,
        "pitches": player.pitches,
        "battingStrategies": player.batting_strategies,
        "maxStamina": player.max_stamina,
        "stamina": player.max_stamina,
        "condition": player.condition,
        "attendance": player.attendance,
        "duesTrait": player.dues_trait,
        "sponsorTrait": player.sponsor_trait,
        "traits": player.traits,
        "recentGames": [],
        "consecutiveStarts": 0,
        "missedGames": 0,
        "consideringLeave": False,
        "injured": False,
        "meta": {**player.meta, "masterCode": player.code, "acquisition": player.acquisition},
    }


def serialize_pitch_type(pitch):
    payload = {
        "speed": [pitch.speed_min, pitch.speed_max],
        "contactMod": pitch.contact_mod,
        "controlMod": pitch.control_mod,
        "stamina": pitch.stamina,
        "description": pitch.description,
    }
    if pitch.discipline_mod:
        payload["disciplineMod"] = pitch.discipline_mod
    if pitch.distance_mod is not None:
        payload["distanceMod"] = pitch.distance_mod
    if pitch.grounder is not None:
        payload["grounder"] = pitch.grounder
    if pitch.ground_distance_mod is not None:
        payload["groundDistanceMod"] = pitch.ground_distance_mod
    return payload


def serialize_batting_strategy(strategy):
    return {
        "id": strategy.code,
        "label": strategy.label,
        "stamina": strategy.stamina,
        "contact": strategy.contact,
        "power": strategy.power,
        "discipline": strategy.discipline,
        "speed": strategy.speed,
        "distance": strategy.distance,
        "description": strategy.description,
    }


def skill_payload():
    return {
        "pitchTable": {
            pitch.code: serialize_pitch_type(pitch)
            for pitch in PitchType.objects.filter(is_active=True).order_by("id")
        },
        "battingStrategyTable": {
            strategy.code: serialize_batting_strategy(strategy)
            for strategy in BattingStrategy.objects.filter(is_active=True).order_by("id")
        },
    }


@require_http_methods(["GET"])
def state(request):
    account = account_from_request(request)
    if not account:
        return JsonResponse({"error": "로그인이 필요합니다."}, status=401)
    if Team.objects.count() == 0:
        call_command("seed_demo")
    ensure_account_league(account)
    rule = SeasonRule.objects.first()
    teams = Team.objects.filter(account=account).order_by("id")
    players = Player.objects.filter(account=account).order_by("team_id", "number")
    return JsonResponse(
        {
            "teams": [serialize_team(team) for team in teams],
            "players": [serialize_player(player) for player in players],
            "seasonRule": {
                "entryFee": rule.entry_fee,
                "championReward": rule.champion_reward,
                "runnerUpReward": rule.runner_up_reward,
                "thirdReward": rule.third_reward,
                "weeksInDemo": rule.weeks_in_demo,
                "maxGamesInDemo": rule.max_games_in_demo,
            }
            if rule
            else None,
            **skill_payload(),
        }
    )


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    body = payload(request)
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))
    if len(username) < 3 or len(username) > 30:
        return JsonResponse({"error": "아이디는 3~30자로 입력하세요."}, status=400)
    if len(password) < 4:
        return JsonResponse({"error": "비밀번호는 4자 이상 입력하세요."}, status=400)
    if DemoAccount.objects.filter(username=username).exists():
        return JsonResponse({"error": "이미 사용 중인 아이디입니다."}, status=409)
    account = DemoAccount.objects.create(
        username=username,
        display_name="김철민",
        password_hash=make_password(password),
        token=secrets.token_hex(24),
    )
    return JsonResponse({"account": account_payload(account)})


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    body = payload(request)
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))
    account = DemoAccount.objects.filter(username=username).first()
    if not account or not check_password(password, account.password_hash):
        return JsonResponse({"error": "아이디 또는 비밀번호가 맞지 않습니다."}, status=401)
    account.token = secrets.token_hex(24)
    account.save(update_fields=["token"])
    return JsonResponse({"account": account_payload(account)})


@csrf_exempt
@require_http_methods(["POST"])
def reset(request):
    account = account_from_request(request)
    if not account:
        return JsonResponse({"error": "로그인이 필요합니다."}, status=401)
    GameSnapshot.objects.filter(key=snapshot_key(account)).delete()
    GameRecord.objects.filter(account=account).delete()
    Team.objects.filter(account=account).delete()
    return state(request)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def snapshot(request):
    account = account_from_request(request)
    if not account:
        return JsonResponse({"error": "로그인이 필요합니다."}, status=401)
    key = snapshot_key(account)
    if request.method == "GET":
        snap = GameSnapshot.objects.filter(key=key).first()
        return JsonResponse({"state": snap.state if snap else None})

    snap, _ = GameSnapshot.objects.update_or_create(
        key=key,
        defaults={"state": payload(request).get("state", {})},
    )
    return JsonResponse({"ok": True, "updatedAt": snap.updated_at.isoformat()})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def recruit_candidates(request):
    account = account_from_request(request)
    if not account:
        return JsonResponse({"error": "로그인이 필요합니다."}, status=401)
    ensure_account_league(account)
    player_team = Team.objects.filter(account=account, is_player=True).first()
    if not player_team:
        return JsonResponse({"error": "플레이어 팀이 없습니다."}, status=400)
    owned_codes = set(
        Player.objects.filter(account=account)
        .exclude(meta__masterCode__isnull=True)
        .values_list("meta__masterCode", flat=True)
    )
    if request.method == "GET":
        candidates = MasterPlayer.objects.filter(acquisition="recruit", is_active=True).exclude(code__in=owned_codes).order_by("id")
        return JsonResponse({"candidates": [serialize_master_player(player) for player in candidates]})

    body = payload(request)
    code = str(body.get("masterCode", "")).strip()
    master = MasterPlayer.objects.filter(code=code, acquisition="recruit", is_active=True).first()
    if not master:
        return JsonResponse({"error": "영입 후보를 찾을 수 없습니다."}, status=404)
    if master.code in owned_codes:
        return JsonResponse({"error": "이미 보유한 선수입니다."}, status=409)
    next_number = max(Player.objects.filter(team=player_team).values_list("number", flat=True), default=0) + 1
    player = player_from_master(master, account, player_team, number=next_number)
    GameSnapshot.objects.filter(key=snapshot_key(account)).delete()
    return JsonResponse({"player": serialize_player(player)})
