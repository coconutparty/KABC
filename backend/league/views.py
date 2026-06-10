import json
import secrets

from django.core.management import call_command
from django.http import JsonResponse
from django.contrib.auth.hashers import check_password, make_password
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import DemoAccount, GameSnapshot, Player, SeasonRule, Team


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
    team = Team.objects.filter(is_player=True).first()
    if team and team.name != PLAYER_TEAM_NAME:
        team.name = PLAYER_TEAM_NAME
        team.save(update_fields=["name"])


def serialize_team(team):
    return {
        "id": team.id,
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


@require_http_methods(["GET"])
def state(_request):
    if Team.objects.count() == 0:
        call_command("seed_demo")
    ensure_player_team_name()
    rule = SeasonRule.objects.first()
    return JsonResponse(
        {
            "teams": [serialize_team(team) for team in Team.objects.order_by("id")],
            "players": [serialize_player(player) for player in Player.objects.order_by("team_id", "number")],
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
