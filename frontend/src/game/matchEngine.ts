import type { AppState, LogLine, MatchState, Player, PostGameSummary, Team } from "../types/game";
import { BAT_STRATEGY_TABLE, DEFAULT_BATTING_STRATEGIES, PITCH_TABLE } from "./config";
import { clamp, createRng, effectiveStat, hasPosition, playerOvr, teamMorale, weightedPick } from "./utils";

const KIM_NAME = "김철민";

function log(text: string): LogLine {
  return { id: `${Date.now()}-${Math.random()}`, text };
}

function absentIds(state: AppState) {
  return new Set((state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex).map((absence) => absence.playerId));
}

function teamPlayers(state: AppState, teamId: number) {
  const absences = absentIds(state);
  return state.players.filter((player) => player.teamId === teamId && !player.injured && !absences.has(player.id));
}

function pickLineup(players: Player[], forced: number[] = []) {
  const forcedSet = new Set(forced);
  const sorted = [...players].sort((a, b) => playerOvr(b, b.primaryPosition) - playerOvr(a, a.primaryPosition));
  return [...forced, ...sorted.filter((player) => !forcedSet.has(player.id)).map((player) => player.id)].slice(0, 9);
}

function pickPitcher(players: Player[], preferred?: number) {
  if (preferred && players.some((player) => player.id === preferred && hasPosition(player, "투수"))) return preferred;
  const pitchers = players.filter((player) => hasPosition(player, "투수"));
  return pitchers.sort((a, b) => playerOvr(b, "투수") - playerOvr(a, "투수"))[0]?.id ?? players[0]?.id;
}

export function createMatch(state: AppState): MatchState {
  const playerTeam = state.teams.find((team) => team.isPlayer)!;
  const opponent = state.teams.find((team) => team.id === state.currentOpponentId) ?? state.teams.find((team) => !team.isPlayer)!;
  const playerRoster = teamPlayers(state, playerTeam.id);
  const opponentRoster = teamPlayers(state, opponent.id);
  const kim = playerRoster.find((player) => player.name === KIM_NAME);
  const availableIds = new Set(playerRoster.map((player) => player.id));
  const cleanEntry = state.selectedEntry.filter((id) => availableIds.has(id));
  const forcedEntry = cleanEntry.length >= 9 ? cleanEntry : pickLineup(playerRoster, kim && state.kimRole !== "결장" ? [kim.id] : []);
  const playerPitcher = pickPitcher(playerRoster, state.selectedPitcherId);
  const opponentPitcher = pickPitcher(opponentRoster);
  return {
    homeTeamId: playerTeam.id,
    awayTeamId: opponent.id,
    inning: 1,
    top: true,
    outs: 0,
    bases: [null, null, null],
    score: { [playerTeam.id]: 0, [opponent.id]: 0 },
    lineup: {
      [playerTeam.id]: pickLineup(playerRoster, forcedEntry),
      [opponent.id]: pickLineup(opponentRoster)
    },
    pitcher: { [playerTeam.id]: playerPitcher, [opponent.id]: opponentPitcher },
    pendingSubstitutions: [],
    orderIndex: { [playerTeam.id]: 0, [opponent.id]: 0 },
    count: { balls: 0, strikes: 0 },
    broadcast: [log(`플레이볼! ${playerTeam.name}와 ${opponent.name}의 7이닝 경기가 시작됩니다.`)],
    rulings: [log(`엔트리 검증: 홈 ${forcedEntry.length}명, 원정 ${opponentRoster.length}명. 김철민 역할=${state.kimRole}.`)],
    waitingFor: null,
    coldGame: false,
    finished: false,
    inningEffects: {}
  };
}

function findPlayer(state: AppState, id?: number) {
  return state.players.find((player) => player.id === id)!;
}

function activeTeams(match: MatchState) {
  const battingTeamId = match.top ? match.awayTeamId : match.homeTeamId;
  const fieldingTeamId = match.top ? match.homeTeamId : match.awayTeamId;
  return { battingTeamId, fieldingTeamId };
}

function maybeEmotion(rng: () => number, team: Team, player: Player, inning: number, match: MatchState, logs: LogLine[]) {
  const existing = match.inningEffects[player.id];
  if (existing && existing.until >= inning) return existing;
  if (existing && existing.until < inning) {
    logs.push(log(`${player.name} 선수의 ${existing.type} 상태가 종료되었습니다.`));
    delete match.inningEffects[player.id];
  }
  const morale = teamMorale(team);
  const gritChance = Math.max(0, morale - 70) * 0.18;
  const slackChance = Math.max(0, 55 - morale) * 0.12 + Math.max(0, 45 - team.trust) * 0.12 + Math.max(0, 45 - team.fairness) * 0.1;
  if (rng() * 100 < gritChance) {
    match.inningEffects[player.id] = { type: "투지", until: inning + 2 };
    logs.push(log(`${player.name} 선수가 투지를 불태우고 있습니다! 3이닝 동안 스탯 +5%, 페널티를 무시합니다.`));
  } else if (rng() * 100 < slackChance) {
    match.inningEffects[player.id] = { type: "태업", until: inning + 2 };
    logs.push(log(`${player.name} 선수가 태업 중입니다. 3이닝 동안 모든 스탯 -10%.`));
  }
  return match.inningEffects[player.id];
}

function controlResult(score: number, rng: () => number) {
  const rows: Array<[string, number]> =
    score >= 90 ? [["zone", 75], ["ball", 20], ["mistake", 5], ["danger", 0]] :
    score >= 70 ? [["zone", 60], ["ball", 30], ["mistake", 8], ["danger", 2]] :
    score >= 50 ? [["zone", 45], ["ball", 38], ["mistake", 12], ["danger", 5]] :
    score >= 30 ? [["zone", 30], ["ball", 45], ["mistake", 15], ["danger", 10]] :
    [["zone", 20], ["ball", 45], ["mistake", 15], ["danger", 20]];
  return weightedPick(rng, rows);
}

function defenderFor(direction: string, distance: number, kind: string, fielders: Player[], pitcher: Player) {
  const defense = assignDefense(fielders, pitcher);
  const pick = (...keys: Array<keyof typeof defense>) => keys.map((key) => defense[key]).find(Boolean) ?? pitcher;
  const by = (positions: string[]) => fielders.find((player) => positions.some((pos) => player.positions.includes(pos as never) || player.primaryPosition === pos));
  if (kind === "땅볼") {
    if (direction === "중앙") return distance < 15 ? pitcher : pick("secondBase", "shortstop");
    if (direction === "좌측") return distance < 15 ? pick("pitcher", "thirdBase") : pick("thirdBase", "shortstop");
    return distance < 15 ? pick("pitcher", "firstBase") : pick("firstBase", "secondBase");
  }
  if (distance < 20) return by(["포수"]) ?? pitcher;
  if (direction === "중앙") return distance >= 50 ? pick("centerField") : pick("secondBase", "shortstop");
  if (direction === "좌측") return distance >= 50 ? pick("leftField") : pick("thirdBase", "shortstop");
  return distance >= 50 ? pick("rightField") : pick("firstBase", "secondBase");
}

function assignDefense(fielders: Player[], pitcher: Player) {
  const used = new Set<number>();
  const take = (wants: string[]) => {
    const player = fielders.find((candidate) => !used.has(candidate.id) && wants.some((position) => candidate.primaryPosition === position || candidate.positions.includes(position as never)))
      ?? fielders.find((candidate) => !used.has(candidate.id));
    if (player) used.add(player.id);
    return player;
  };
  used.add(pitcher.id);
  return {
    pitcher,
    catcher: take(["포수"]),
    firstBase: take(["1루수", "내야수", "유틸"]),
    secondBase: take(["2루수", "내야수", "유틸"]),
    thirdBase: take(["3루수", "내야수", "유틸"]),
    shortstop: take(["유격수", "내야수", "유틸"]),
    leftField: take(["좌익수", "외야수", "유틸"]),
    centerField: take(["중견수", "외야수", "유틸"]),
    rightField: take(["우익수", "외야수", "유틸"])
  };
}

function advanceRunners(match: MatchState, battingTeamId: number, batterId: number, bases: number, broadcast: LogLine[], ruling: LogLine[]) {
  let runs = 0;
  const next: Array<number | null> = [null, null, null];
  for (let i = 2; i >= 0; i--) {
    const runner = match.bases[i];
    if (!runner) continue;
    const target = i + bases;
    if (target >= 3) runs += 1;
    else next[target] = runner;
  }
  if (bases >= 4) runs += 1;
  else next[bases - 1] = batterId;
  match.bases = next;
  match.score[battingTeamId] += runs;
  if (runs > 0) {
    broadcast.push(log(`${runs}점이 들어옵니다. 스코어 ${match.score[match.awayTeamId]} 대 ${match.score[match.homeTeamId]}.`));
    ruling.push(log(`주루 판정: 타자 ${bases}루 진루, 득점 ${runs}.`));
  }
}

type LastPlayInput = Omit<NonNullable<MatchState["lastPlay"]>, "count" | "isAtBatOver" | "speedKmh"> & Partial<Pick<NonNullable<MatchState["lastPlay"]>, "count" | "isAtBatOver" | "speedKmh">>;

function setLastPlay(match: MatchState, payload: LastPlayInput) {
  match.lastPlay = {
    ...payload,
    speedKmh: payload.speedKmh ?? 0,
    count: payload.count ?? { ...match.count },
    isAtBatOver: payload.isAtBatOver ?? false
  };
}

function kimPrefix(kimInvolved: boolean) {
  return kimInvolved ? "[김철민 개입] " : "";
}

function battingStrategyIds(player: Player) {
  const ids = player.battingStrategies?.length ? player.battingStrategies : [...DEFAULT_BATTING_STRATEGIES];
  return ids;
}

function battingStrategyWeight(player: Player, id: string) {
  const bat = player.battingStats;
  if (id === "power" || id === "pull") return 1 + bat.power / 35;
  if (id === "run" || id === "steal") return 1 + bat.speed / 35;
  if (id === "wait") return 1 + bat.discipline / 35;
  if (id === "bunt" || id === "opposite") return 1 + (bat.contact + bat.discipline) / 80;
  return 1 + bat.contact / 35;
}

function pickBattingStrategy(rng: () => number, player: Player, strategyTable: typeof BAT_STRATEGY_TABLE, requestedId?: string) {
  if (requestedId && strategyTable[requestedId]) return strategyTable[requestedId];
  const ids = battingStrategyIds(player).filter((id) => strategyTable[id]);
  if (!ids.length) return strategyTable.contact ?? BAT_STRATEGY_TABLE.contact;
  const picked = weightedPick(rng, ids.map((id) => [id, battingStrategyWeight(player, id)]));
  return strategyTable[picked] ?? strategyTable.contact ?? BAT_STRATEGY_TABLE.contact;
}

function conditionRoll(rng: () => number, base: number, spread = 7) {
  return clamp(Math.round(base + (rng() * spread * 2 - spread)), 5, 100);
}

function returnPitchState(state: AppState, match: MatchState, players: Player[], broadcast: LogLine[], ruling: LogLine[]) {
  return finishIfNeeded({ ...state, seed: state.seed + 1, players, match: { ...match, broadcast, rulings: ruling, waitingFor: null } });
}

export function simulateStep(state: AppState, kimBatChoice?: string, kimPitch?: string): AppState {
  if (!state.match || state.match.finished) return state;
  const rng = createRng(state.seed + state.gamesPlayed * 1000 + state.match.broadcast.length * 17);
  const match = structuredClone(state.match) as MatchState;
  if (!match.count) match.count = { balls: 0, strikes: 0 };
  const { battingTeamId, fieldingTeamId } = activeTeams(match);
  const battingTeam = state.teams.find((team) => team.id === battingTeamId)!;
  const fieldingTeam = state.teams.find((team) => team.id === fieldingTeamId)!;
  const lineup = match.lineup[battingTeamId];
  const batterId = lineup[match.orderIndex[battingTeamId] % lineup.length];
  const pitcherId = match.pitcher[fieldingTeamId];
  const batter = findPlayer(state, batterId);
  const pitcher = findPlayer(state, pitcherId);
  const kimIsBatter = batter.name === KIM_NAME;
  const kimIsPitcher = pitcher.name === KIM_NAME;
  const kimInvolved = kimIsBatter || kimIsPitcher;

  if (kimIsBatter && !kimBatChoice) return { ...state, match: { ...match, waitingFor: "kimBat", waitingBatterId: batter.id, waitingPitcherId: pitcher.id } };
  if (kimIsPitcher && !kimPitch) return { ...state, match: { ...match, waitingFor: "kimPitch", waitingBatterId: batter.id, waitingPitcherId: pitcher.id } };

  const broadcast = [...match.broadcast];
  const ruling = [...match.rulings];
  maybeEmotion(rng, battingTeam, batter, match.inning, match, broadcast);
  maybeEmotion(rng, fieldingTeam, pitcher, match.inning, match, broadcast);
  const batterEffect = match.inningEffects[batter.id];
  const pitcherEffect = match.inningEffects[pitcher.id];
  const pitchTable = state.pitchTable && Object.keys(state.pitchTable).length ? state.pitchTable : PITCH_TABLE;
  const battingStrategyTable = state.battingStrategyTable && Object.keys(state.battingStrategyTable).length ? state.battingStrategyTable : BAT_STRATEGY_TABLE;
  const chosenPitch = kimPitch || weightedPick(rng, (pitcher.pitches.length ? pitcher.pitches : ["직구"]).map((pitch) => [pitch, 1]));
  const pitch = pitchTable[chosenPitch] ?? pitchTable["직구"] ?? PITCH_TABLE["직구"];
  const speedValue = effectiveStat(pitcher, pitcher.fieldingStats.velocity, pitcherEffect) * (pitch.speed[0] + rng() * (pitch.speed[1] - pitch.speed[0]));
  const pitchSpeedKmh = Math.round(speedValue);
  const recordPlay = (payload: LastPlayInput) => setLastPlay(match, { ...payload, speedKmh: pitchSpeedKmh });
  const batChoice = pickBattingStrategy(rng, batter, battingStrategyTable, kimBatChoice);
  const controlScore = effectiveStat(pitcher, pitcher.fieldingStats.control, pitcherEffect) + effectiveStat(pitcher, pitcher.fieldingStats.awareness, pitcherEffect) * 0.2 + pitch.controlMod;
  const control = controlResult(controlScore, rng);
  const discipline = effectiveStat(batter, batter.battingStats.discipline, batterEffect) * batChoice.discipline + (pitch.disciplineMod ?? 0);
  const takesBadPitch = (control === "ball" || control === "danger") && rng() * 100 < clamp(discipline, 5, 95);
  const controlText = control === "zone" ? "스트라이크존" : control === "ball" ? "볼" : control === "mistake" ? "실투" : "위협구";
  const inningText = `${match.inning}회${match.top ? "초" : "말"} ${match.outs}사`;

  if (kimInvolved) {
    broadcast.push(log(`${kimPrefix(true)}${inningText}. ${kimIsBatter ? "타석" : "마운드"}의 김철민에게 시선이 집중됩니다. 상대는 ${kimIsBatter ? pitcher.name : batter.name}, 선택 구종은 ${chosenPitch}, 구속 ${pitchSpeedKmh}km/h.`));
  }
  ruling.push(log(`${kimPrefix(kimInvolved)}${batter.name} vs ${pitcher.name}: 타격전략=${batChoice.label}, 구종=${chosenPitch}, 구속=${pitchSpeedKmh}km/h, 제구점수=${controlScore.toFixed(1)}, 제구결과=${controlText}, 선구안=${discipline.toFixed(1)}.`));

  const changedPlayers = state.players.map((player) => {
    if (player.id === pitcher.id) return { ...player, stamina: clamp(player.stamina - pitch.stamina, 0, player.maxStamina) };
    if (player.id === batter.id) return { ...player, stamina: clamp(player.stamina - batChoice.stamina, 0, player.maxStamina) };
    return player;
  });

  if (control === "danger") {
    const hbp = chosenPitch === "슬라이더" ? (100 - pitcher.fieldingStats.control) * 0.1 : 18;
    if (rng() * 100 < hbp) {
      broadcast.push(log(`${kimPrefix(kimInvolved)}${inningText}. ${chosenPitch} ${pitchSpeedKmh}km/h가 몸쪽 깊게 들어가 ${batter.name}이 몸에 맞는 공으로 출루합니다.`));
      ruling.push(log(`${kimPrefix(kimInvolved)}데드볼 판정 성공. 구속=${pitchSpeedKmh}km/h, 확률=${hbp.toFixed(1)}%.`));
      recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction: "중앙", distance: 0, kind: "데드볼", result: "출루", kimInvolved });
      advanceRunners(match, battingTeamId, batter.id, 1, broadcast, ruling);
      afterAtBat(match, battingTeamId, state, changedPlayers, broadcast, ruling);
      return finishIfNeeded({ ...state, seed: state.seed + 1, players: changedPlayers, match: { ...match, broadcast, rulings: ruling, waitingFor: null } });
    }
  }

  if (takesBadPitch) {
    match.count = { ...match.count, balls: match.count.balls + 1 };
    const walked = match.count.balls >= 4;
    broadcast.push(log(`${kimPrefix(kimInvolved)}${inningText}. ${batter.name}, ${chosenPitch} ${pitchSpeedKmh}km/h를 끝까지 골라냅니다. 볼입니다. 카운트 ${match.count.balls}-${match.count.strikes}.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}선구안 판정 성공: 나쁜 공 참기/회피. 구속=${pitchSpeedKmh}km/h, 볼 ${match.count.balls}, 스트라이크 ${match.count.strikes}.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction: "중앙", distance: 0, kind: walked ? "볼넷" : "볼", result: walked ? "출루" : "볼", kimInvolved, isAtBatOver: walked });
    if (walked) {
      broadcast.push(log(`${batter.name}이 볼넷으로 1루에 걸어 나갑니다.`));
      advanceRunners(match, battingTeamId, batter.id, 1, broadcast, ruling);
      afterAtBat(match, battingTeamId, state, changedPlayers, broadcast, ruling);
    }
    return returnPitchState(state, match, changedPlayers, broadcast, ruling);
  }

  const stuffPenalty = Math.max(0, effectiveStat(pitcher, pitcher.positionStats.stuff, pitcherEffect) - 60) * 0.3;
  const speedPenalty = Math.max(0, speedValue - 140) * 0.15;
  const contact = effectiveStat(batter, batter.battingStats.contact, batterEffect) * batChoice.contact + pitch.contactMod - stuffPenalty - speedPenalty + (control === "mistake" ? 10 : 0);
  const contactRate = clamp(contact, 5, 95);
  const contactRoll = rng() * 100;
  if (contactRoll > contactRate) {
    const foulChance = clamp(Math.max(0, 60 - discipline) * 0.2 + Math.max(0, 50 - contact) * 0.1, 5, 35);
    if (rng() * 100 < foulChance) {
      match.count = { ...match.count, strikes: Math.min(2, match.count.strikes + 1) };
      broadcast.push(log(`${kimPrefix(kimInvolved)}${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 가까스로 걷어냅니다. 파울입니다. 카운트 ${match.count.balls}-${match.count.strikes}.`));
      ruling.push(log(`${kimPrefix(kimInvolved)}컨택 실패 후 파울 처리. 구속=${pitchSpeedKmh}km/h, 컨택률=${contactRate.toFixed(1)}, 롤=${contactRoll.toFixed(1)}, 파울확률=${foulChance.toFixed(1)}, 카운트=${match.count.balls}-${match.count.strikes}.`));
      recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction: "파울", distance: 20, kind: "파울", result: "파울", kimInvolved });
    } else {
      match.count = { ...match.count, strikes: match.count.strikes + 1 };
      const struckOut = match.count.strikes >= 3;
      if (struckOut) match.outs += 1;
      broadcast.push(log(`${kimPrefix(kimInvolved)}${inningText}. ${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h에 헛스윙합니다. ${struckOut ? "삼진 아웃입니다." : `카운트 ${match.count.balls}-${match.count.strikes}.`}`));
      ruling.push(log(`${kimPrefix(kimInvolved)}컨택 판정 실패. 구속=${pitchSpeedKmh}km/h, 컨택률=${contactRate.toFixed(1)}, 롤=${contactRoll.toFixed(1)}, 스트라이크=${match.count.strikes}.`));
      recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction: "중앙", distance: 0, kind: "헛스윙", result: struckOut ? "아웃" : "스트라이크", kimInvolved, isAtBatOver: struckOut });
      if (struckOut) afterAtBat(match, battingTeamId, state, changedPlayers, broadcast, ruling);
    }
    return returnPitchState(state, match, changedPlayers, broadcast, ruling);
  }

  const directionAccuracy = discipline * 0.45 + contactRate * 0.25 - effectiveStat(pitcher, pitcher.fieldingStats.control, pitcherEffect) * 0.2 + (control === "mistake" ? 20 : 0) + (rng() * 30 - 10);
  const direction = directionAccuracy >= 75 ? "중앙" : directionAccuracy >= 30 ? (rng() < 0.5 ? "좌측" : "우측") : "파울";
  const batterPower = effectiveStat(batter, batter.battingStats.power, batterEffect) * batChoice.power;
  const pitcherStuff = effectiveStat(pitcher, pitcher.positionStats.stuff, pitcherEffect);
  const adjustedBatter = {
    ...batter,
    battingStats: {
      ...batter.battingStats,
      speed: clamp(effectiveStat(batter, batter.battingStats.speed, batterEffect) * batChoice.speed, 1, 120)
    }
  };
  let distance = 18 + batterPower * 0.62 + contactRate * 0.18 + speedValue * 0.07 - pitcherStuff * 0.26 + (contactRate - contactRoll) * 0.26 + batChoice.distance + (rng() * 24 - 12);
  if (batterPower < 70) distance -= (70 - batterPower) * 0.65;
  if (batterPower >= 82) distance += (batterPower - 82) * 0.45;
  if (pitch.distanceMod) distance *= pitch.distanceMod;
  if (chosenPitch === "커터" && rng() < 0.1) distance *= 0.5;
  if (chosenPitch === "너클볼" && rng() < 0.3) distance *= 0.5;

  if (direction === "파울") {
    match.count = { ...match.count, strikes: Math.min(2, match.count.strikes + 1) };
    broadcast.push(log(distance >= 100 ? `${kimPrefix(kimInvolved)}${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 받아쳤고 타구가 크게 뻗었지만 파울입니다. 대형 파울입니다. 카운트 ${match.count.balls}-${match.count.strikes}.` : `${kimPrefix(kimInvolved)}${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 건드립니다. 타구가 파울 지역으로 벗어납니다. 카운트 ${match.count.balls}-${match.count.strikes}.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}타구 방향 판정 파울. 구속=${pitchSpeedKmh}km/h, 방향정확도=${directionAccuracy.toFixed(1)}, 비거리=${distance.toFixed(1)}m, 카운트=${match.count.balls}-${match.count.strikes}.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction: "파울", distance, kind: "파울", result: "파울", kimInvolved });
    return returnPitchState(state, match, changedPlayers, broadcast, ruling);
  }

  const homer = (direction === "중앙" && distance >= 120) || (direction !== "중앙" && distance >= 100);
  let kind = battedBallKind(rng, batter, pitcher, chosenPitch, batterEffect, pitcherEffect);
  if (batChoice.id === "bunt") kind = "땅볼";
  if (pitch.grounder && rng() * 100 < pitch.grounder) {
    kind = "땅볼";
    if (pitch.groundDistanceMod) distance *= pitch.groundDistanceMod;
  }

  if (homer) {
    broadcast.push(log(`${kimPrefix(kimInvolved)}${inningText}. ${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 받아칩니다! ${direction} 담장을 넘어가는 홈런입니다.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}홈런 판정: 구속=${pitchSpeedKmh}km/h, 방향=${direction}, 비거리=${distance.toFixed(1)}m, 타구성질=${kind}.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction, distance, kind, result: "홈런", kimInvolved });
    advanceRunners(match, battingTeamId, batter.id, 4, broadcast, ruling);
    afterAtBat(match, battingTeamId, state, changedPlayers, broadcast, ruling);
    return finishIfNeeded({ ...state, seed: state.seed + 1, players: changedPlayers, match: { ...match, broadcast, rulings: ruling, waitingFor: null } });
  }

  const fielders = match.lineup[fieldingTeamId].map((id) => findPlayer(state, id));
  const defender = defenderFor(direction, distance, kind, fielders, pitcher);
  const quality = clamp(contactRate - contactRoll + 50, 0, 100);
  const fieldRate = fieldingRate(kind, defender, adjustedBatter, pitcher, distance, quality, direction);
  const caught = rng() * 100 < fieldRate;
  const errorChance = clamp(Math.max(0, 60 - defender.fieldingStats.awareness) * 0.3 + Math.max(0, 55 - defender.fieldingStats.control) * 0.2, 0, 30);
  if (caught) {
    match.outs += 1;
    broadcast.push(log(`${kimPrefix(kimInvolved)}${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 받아친 ${direction} ${kind}. ${defender.name}이 침착하게 처리합니다. 아웃입니다.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}수비 성공: 구속=${pitchSpeedKmh}km/h, 담당=${defender.name}, 성공률=${fieldRate.toFixed(1)}%, 타구품질=${quality.toFixed(1)}, 비거리=${distance.toFixed(1)}m.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction, distance, kind, result: "아웃", defenderId: defender.id, kimInvolved });
  } else if (rng() * 100 < errorChance) {
    broadcast.push(log(`${kimPrefix(kimInvolved)}${chosenPitch} ${pitchSpeedKmh}km/h 타구를 ${defender.name}이 놓칩니다. 기록은 실책, 주자들이 움직입니다.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}수비 실패 후 실책. 구속=${pitchSpeedKmh}km/h, 실책확률=${errorChance.toFixed(1)}%, 담당=${defender.name}.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction, distance, kind, result: "실책", defenderId: defender.id, kimInvolved });
    advanceRunners(match, battingTeamId, batter.id, 1, broadcast, ruling);
  } else {
    const bases = distance >= 85 || kind === "라인드라이브" ? 2 : 1;
    broadcast.push(log(`${kimPrefix(kimInvolved)}${batter.name}이 ${chosenPitch} ${pitchSpeedKmh}km/h를 받아친 타구가 ${defender.name} 앞에 떨어집니다. ${bases === 2 ? "2루타" : "안타"}입니다.`));
    ruling.push(log(`${kimPrefix(kimInvolved)}수비 실패: 구속=${pitchSpeedKmh}km/h, 담당=${defender.name}, 성공률=${fieldRate.toFixed(1)}%, 결과=${bases}루타.`));
    recordPlay({ batterId: batter.id, pitcherId: pitcher.id, pitch: chosenPitch, direction, distance, kind, result: bases === 2 ? "2루타" : "안타", defenderId: defender.id, kimInvolved });
    advanceRunners(match, battingTeamId, batter.id, bases, broadcast, ruling);
  }

  afterAtBat(match, battingTeamId, state, changedPlayers, broadcast, ruling);
  return finishIfNeeded({ ...state, seed: state.seed + 1, players: changedPlayers, match: { ...match, broadcast, rulings: ruling, waitingFor: null } });
}

function battedBallKind(rng: () => number, batter: Player, pitcher: Player, pitchName: string, batterEffect?: { type: "투지" | "태업"; until: number }, pitcherEffect?: { type: "투지" | "태업"; until: number }) {
  const groundMod: Record<string, number> = { 직구: -2, 싱커: 12, 투심: 8, 커터: 3, 슬라이더: 2, 스플리터: 8, 포크볼: 5, 커브: -2, 너클커브: -1, 체인지업: 2, 서클체인지: 3, 팜볼: -1, 너클볼: 2, 스크류볼: 3 };
  const flyMod: Record<string, number> = { 직구: 3, 싱커: -4, 투심: -3, 커터: -1, 슬라이더: 1, 스플리터: -3, 포크볼: -2, 커브: 5, 너클커브: 4, 체인지업: 1, 서클체인지: 0, 팜볼: 3, 너클볼: 2, 스크류볼: 0 };
  const stuff = effectiveStat(pitcher, pitcher.positionStats.stuff, pitcherEffect);
  const power = effectiveStat(batter, batter.battingStats.power, batterEffect);
  const contact = effectiveStat(batter, batter.battingStats.contact, batterEffect);
  const ground = clamp(8 + Math.max(0, stuff - power) * 0.35 + (groundMod[pitchName] ?? 0), 3, 28);
  const fly = clamp(8 + Math.max(0, power - stuff) * 0.3 + (flyMod[pitchName] ?? 0), 3, 25);
  const line = clamp(10 + Math.max(0, contact - stuff) * 0.15, 5, 20);
  const roll = rng() * 100;
  if (roll < ground) return "땅볼";
  if (roll < ground + fly) return "플라이";
  if (roll < ground + fly + line) return "라인드라이브";
  return "일반 타구";
}

function fieldingRate(kind: string, defender: Player, batter: Player, pitcher: Player, distance: number, quality: number, direction: string) {
  if (kind === "플라이" || distance >= 50) {
    const score = defender.positionStats.jump * 0.5 + defender.fieldingStats.awareness * 0.25 + defender.fieldingStats.velocity * 0.15 + defender.fieldingStats.control * 0.1;
    const difficulty = distance * 0.5 + quality * 0.2 + (direction === "중앙" ? 5 : 8);
    const jumpBonus = defender.positionStats.jump >= 90 ? 12 : defender.positionStats.jump >= 80 ? 8 : 0;
    return clamp(75 + score - difficulty + jumpBonus, 5, 98);
  }
  if (kind === "땅볼") {
    const score = defender.positionStats.range * 0.35 + defender.fieldingStats.awareness * 0.3 + defender.fieldingStats.control * 0.25 + defender.fieldingStats.velocity * 0.1;
    const difficulty = quality * 0.35 + batter.battingStats.speed * 0.25 + distance * 0.2;
    return clamp(75 + score - difficulty, 5, 95);
  }
  if (distance < 20) {
    const isCatcher = defender.primaryPosition === "포수" || defender.positions.includes("포수");
    const score = isCatcher
      ? defender.fieldingStats.awareness * 0.45 + defender.fieldingStats.control * 0.3 + defender.fieldingStats.velocity * 0.25
      : pitcher.fieldingStats.awareness * 0.45 + pitcher.fieldingStats.control * 0.35 + pitcher.fieldingStats.velocity * 0.2;
    return clamp(80 + score - (distance * 0.5 + batter.battingStats.speed * 0.25 + quality * 0.2), 5, 95);
  }
  const score = defender.fieldingStats.awareness * 0.45 + Math.max(defender.positionStats.range, defender.positionStats.jump) * 0.25 + defender.fieldingStats.velocity * 0.15 + defender.fieldingStats.control * 0.15;
  return clamp(70 + score - quality * 0.7, 5, 95);
}

function afterAtBat(match: MatchState, battingTeamId: number, state?: AppState, players?: Player[], broadcast?: LogLine[], ruling?: LogLine[]) {
  if (match.lastPlay) match.lastPlay = { ...match.lastPlay, isAtBatOver: true };
  match.count = { balls: 0, strikes: 0 };
  match.orderIndex[battingTeamId] += 1;
  if (match.outs >= 3) {
    match.outs = 0;
    match.bases = [null, null, null];
    if (match.top) match.top = false;
    else {
      match.top = true;
      match.inning += 1;
      if (players && broadcast && ruling) applyLowStaminaConditionPenalty(match, players, broadcast, ruling);
      if (state && broadcast && ruling) applyPendingSubstitutions(match, state, broadcast, ruling);
    }
  }
}

function applyLowStaminaConditionPenalty(match: MatchState, players: Player[], broadcast: LogLine[], ruling: LogLine[]) {
  const activeIds = new Set<number>([
    ...(match.lineup[match.homeTeamId] ?? []),
    ...(match.lineup[match.awayTeamId] ?? []),
    ...Object.values(match.pitcher ?? {})
  ]);
  const affected: string[] = [];

  for (const id of activeIds) {
    const index = players.findIndex((player) => player.id === id);
    const player = players[index];
    if (!player || player.stamina > 30 || player.condition <= 0) continue;
    const before = player.condition;
    const after = clamp(before - 5, 0, 100);
    players[index] = { ...player, condition: after };
    affected.push(`${player.name} ${Math.round(before)}→${Math.round(after)}`);
  }

  if (!affected.length) return;
  broadcast.push(log(`체력이 바닥난 선수들의 컨디션이 흔들립니다. ${affected.slice(0, 4).join(", ")}${affected.length > 4 ? ` 외 ${affected.length - 4}명` : ""}.`));
  ruling.push(log(`저체력 컨디션 페널티: 이닝 종료 정산, 조건=체력 30 이하, 컨디션 -5, 대상=${affected.join(", ")}.`));
}

function applyPendingSubstitutions(match: MatchState, state: AppState, broadcast: LogLine[], ruling: LogLine[]) {
  const pending = match.pendingSubstitutions ?? [];
  if (!pending.length) return;

  const lineup = { ...match.lineup };
  const pitcher = { ...match.pitcher };
  const applied: string[] = [];

  for (const sub of pending) {
    const teamLineup = [...(lineup[sub.teamId] ?? [])];
    const outIndex = teamLineup.indexOf(sub.outPlayerId);
    const outPlayer = state.players.find((player) => player.id === sub.outPlayerId);
    const inPlayer = state.players.find((player) => player.id === sub.inPlayerId);
    const team = state.teams.find((item) => item.id === sub.teamId);

    if (outIndex < 0 || !outPlayer || !inPlayer || teamLineup.includes(sub.inPlayerId)) {
      ruling.push(log(`교체 예약 무효: ${outPlayer?.name ?? sub.outPlayerId} -> ${inPlayer?.name ?? sub.inPlayerId}`));
      continue;
    }

    teamLineup[outIndex] = sub.inPlayerId;
    lineup[sub.teamId] = teamLineup;
    if (pitcher[sub.teamId] === sub.outPlayerId) pitcher[sub.teamId] = sub.inPlayerId;

    const message = `${team?.name ?? "팀"} 선수교체 적용: ${outIndex + 1}번 ${outPlayer.name} OUT, ${inPlayer.name} IN`;
    applied.push(message);
    broadcast.push(log(message));
    ruling.push(log(`선수교체 적용: team=${sub.teamId}, slot=${outIndex + 1}, out=${sub.outPlayerId}, in=${sub.inPlayerId}, inning=${match.inning}.`));
  }

  match.lineup = lineup;
  match.pitcher = pitcher;
  match.pendingSubstitutions = [];
  if (applied.length) broadcast.push(log("예약된 선수교체가 현재 이닝 종료 후 반영되었습니다."));
}

function finishIfNeeded(state: AppState): AppState {
  const match = state.match!;
  const home = match.score[match.homeTeamId] ?? 0;
  const away = match.score[match.awayTeamId] ?? 0;
  const diff = Math.abs(home - away);
  const bothScored = home > 0 && away > 0;
  const cold = (bothScored && diff >= 9) || (!bothScored && diff >= 7);
  if (cold && match.inning >= 3) {
    match.coldGame = true;
    match.finished = true;
    match.broadcast.push(log("점수 차가 크게 벌어졌습니다. 리그 규정에 따라 콜드게임이 선언됩니다."));
    match.rulings.push(log(`콜드게임 판정: 홈=${home}, 원정=${away}, 점수차=${diff}.`));
  }
  if (match.inning > 7) match.finished = true;
  if (!match.finished) return state;
  return applyPostGame(state);
}

function applyPostGame(state: AppState): AppState {
  const match = state.match!;
  const playerTeam = state.teams.find((team) => team.isPlayer)!;
  const homeScore = match.score[match.homeTeamId] ?? 0;
  const awayScore = match.score[match.awayTeamId] ?? 0;
  const playerScore = match.homeTeamId === playerTeam.id ? homeScore : awayScore;
  const opponentScore = match.homeTeamId === playerTeam.id ? awayScore : homeScore;
  const won = playerScore > opponentScore;
  const draw = playerScore === opponentScore;
  const changes: string[] = [];
  const teams = state.teams.map((team) => {
    if (team.id !== playerTeam.id) return team;
    const recentMood = team.recentMood + (won ? 6 : draw ? 0 : -6);
    const bond = team.bond + (won ? 1 : -1) + (match.coldGame && !won ? -2 : 0);
    const trust = team.trust + (won ? 2 : -2);
    const fairness = team.fairness + (state.selectedEntry.length >= 9 ? 1 : 0);
    changes.push(`최근 경기 분위기 ${team.recentMood} -> ${clamp(recentMood, 0, 100)}`);
    changes.push(`팀 유대감 ${team.bond} -> ${clamp(bond, 0, 100)}`);
    changes.push(`감독 신뢰도 ${team.trust} -> ${clamp(trust, 0, 100)}`);
    changes.push(`출전기회 공정성 ${team.fairness} -> ${clamp(fairness, 0, 100)}`);
    return {
      ...team,
      recentMood: clamp(recentMood, 0, 100),
      bond: clamp(bond, 0, 100),
      trust: clamp(trust, 0, 100),
      fairness: clamp(fairness, 0, 100),
      wins: team.wins + (won ? 1 : 0),
      losses: team.losses + (!won && !draw ? 1 : 0),
      draws: team.draws + (draw ? 1 : 0)
    };
  });
  const rng = createRng(state.seed + state.gamesPlayed * 409 + 9001);
  const playedIds = new Set([...(match.lineup[match.homeTeamId] ?? []), ...(match.lineup[match.awayTeamId] ?? [])]);
  const teamResult = (teamId: number) => {
    const teamScore = teamId === match.homeTeamId ? homeScore : awayScore;
    const otherScore = teamId === match.homeTeamId ? awayScore : homeScore;
    return teamScore > otherScore ? "win" : teamScore < otherScore ? "loss" : "draw";
  };
  const players = state.players.map((player) => {
    const played = playedIds.has(player.id);
    const result = teamResult(player.teamId);
    const staminaRatio = player.maxStamina > 0 ? player.stamina / player.maxStamina : 0.5;
    let base = played ? (result === "win" ? 72 : result === "draw" ? 67 : 61) + staminaRatio * 14 : 78;
    if (match.coldGame && played && result === "loss") base -= 8;
    return {
      ...player,
      condition: conditionRoll(rng, base),
      consecutiveStarts: played ? player.consecutiveStarts + 1 : 0,
      missedGames: played ? 0 : player.missedGames + 1,
      recentGames: [...player.recentGames.slice(-3), played ? "선발" : "미출전"],
      sponsorTrait: clamp(player.sponsorTrait + (played ? 1 : player.missedGames >= 3 && player.sponsorTrait >= 70 ? -1 : 0), 0, 100)
    };
  });
  const postGame: PostGameSummary = {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeScore,
    awayScore,
    result: draw ? "무" : won ? (match.coldGame ? "콜드승" : "승") : match.coldGame ? "콜드패" : "패",
    coldGame: match.coldGame,
    changes
  };
  const weekdayNightGame = state.dayIndex % 7 === 3 || state.dayIndex % 7 === 4;
  return { ...state, phase: "postGame", teams, players, gamesPlayed: state.gamesPlayed + 1, postGame, restBonus: 0, nightAction: weekdayNightGame ? "game" : state.nightAction, nightConditionSettled: weekdayNightGame };
}

export function validateEntry(state: AppState) {
  const playerTeam = state.teams.find((team) => team.isPlayer);
  const absences = absentIds(state);
  const roster = state.players.filter((player) => player.teamId === playerTeam?.id && !player.injured && player.stamina > 0 && !absences.has(player.id));
  const selected = state.selectedEntry.length >= 9 ? state.selectedEntry.map((id) => state.players.find((player) => player.id === id && !absences.has(id))!).filter(Boolean) : roster.slice(0, 9);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (state.selectedEntry.some((id) => absences.has(id))) errors.push("결석 선수가 엔트리에 포함되어 있습니다.");
  if (selected.length < 9) errors.push("출전 가능 선수 9명 미만입니다.");
  if (!selected.some((player) => hasPosition(player, "투수"))) warnings.push("투수 가능 선수가 엔트리에 없습니다.");
  if (!selected.some((player) => hasPosition(player, "포수"))) warnings.push("포수 가능 선수가 엔트리에 없습니다.");
  for (const position of ["1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수"] as const) {
    if (!selected.some((player) => hasPosition(player, position) || hasPosition(player, "유틸"))) {
      warnings.push(`${position} 수비 가능 선수가 엔트리에 없습니다.`);
    }
  }
  if (playerTeam && playerTeam.funds <= 0) errors.push("팀 재정이 0원 이하입니다.");
  if (playerTeam && playerTeam.trust <= 0) errors.push("감독 신뢰도가 0입니다.");
  return { errors, warnings };
}
