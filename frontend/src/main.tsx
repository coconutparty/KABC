import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import type { AppState, DailyAbsence, FinanceEvent, KimRole, MatchState, PendingSubstitution, Player, Team } from "./types/game";
import { fetchInitialData, fetchSnapshot, loginAccount, registerAccount, resetBackend, saveSnapshot, type DemoAccount } from "./game/api";
import { BAT_STRATEGY_TABLE, DEFAULT_BATTING_STRATEGIES, PARTY_OPTIONS, PITCH_TABLE } from "./game/config";
import { createMatch, simulateStep, validateEntry } from "./game/matchEngine";
import { dayName, gameLabel, hasDayMiniGame, isGameDay, isWeekend, nextScheduleText, weekNumber } from "./game/schedule";
import { clamp, createRng, effectiveStat, financialStability, money, playerOvr, settleDues, teamMorale, tradeValue } from "./game/utils";

const DEFAULT_RULE = { entryFee: 3000000, championReward: 20000000, runnerUpReward: 10000000, thirdReward: 5000000, weeksInDemo: 2, maxGamesInDemo: 8 };
const KIM_NAME = "김철민";
const KIM_JOB = "청마루 감자탕 후계자";
const PLAYER_TEAM_NAME = "복사골 피치브라더스";
const ACCOUNT_KEY = "kabc-demo-account";
const KIM_ROLES: KimRole[] = ["지명타자", "야수", "루수", "포수", "선발투수", "구원투수", "마무리투수", "투타 겸업", "벤치", "결장"];
type BattingStrategyChoice = (typeof BAT_STRATEGY_TABLE)[string];

function loadSavedAccount(): DemoAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) as DemoAccount : null;
  } catch {
    return null;
  }
}

function saveAccount(account: DemoAccount | null) {
  if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  else localStorage.removeItem(ACCOUNT_KEY);
}

function normalizeTeams(teams: Team[]) {
  return teams.map((team) => team.isPlayer ? { ...team, name: PLAYER_TEAM_NAME } : team);
}

function normalizePlayerData(players: Player[]) {
  return players.map((player) => ({
    ...player,
    job: player.name === KIM_NAME ? KIM_JOB : player.job,
    battingStrategies: player.battingStrategies?.length ? player.battingStrategies : [...DEFAULT_BATTING_STRATEGIES]
  }));
}

function normalizeLoadedState(state: AppState): AppState {
  const phase = state.dayIndex % 7 === 2 && (state.financeEvents?.length ?? 0) > 0 && state.phase === "dashboard" ? "teamManagement" : state.phase;
  const match = state.match && !state.match.count ? { ...state.match, count: { balls: 0, strikes: 0 } } : state.match;
  return {
    ...state,
    phase,
    match,
    teams: normalizeTeams(state.teams),
    players: normalizePlayerData(state.players),
    dailyAbsences: (state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex),
    nightAction: state.nightAction ?? "none",
    nightTrainingCount: state.nightTrainingCount ?? 0,
    nightConditionPenalty: state.nightConditionPenalty ?? 0,
    nightConditionSettled: state.nightConditionSettled ?? false
  };
}

function makeInitialState(data: Awaited<ReturnType<typeof fetchInitialData>>): AppState {
  const playerTeam = data.teams.find((team) => team.isPlayer)!;
  const players = normalizePlayerData(data.players);
  const roster = players.filter((player) => player.teamId === playerTeam.id);
  const kim = roster.find((player) => player.name === KIM_NAME);
  const entry = [...roster].sort((a, b) => playerOvr(b) - playerOvr(a)).slice(0, 9).map((player) => player.id);
  return {
    phase: "dashboard",
    seed: 20260610,
    dayIndex: 0,
    gamesPlayed: 0,
    teams: normalizeTeams(data.teams),
    players,
    seasonRule: data.seasonRule ?? DEFAULT_RULE,
    kimRole: "투타 겸업",
    selectedEntry: kim ? [kim.id, ...entry.filter((id) => id !== kim.id)].slice(0, 9) : entry,
    selectedPitcherId: kim?.id,
    selectedDh: false,
    currentOpponentId: data.teams.find((team) => !team.isPlayer)?.id,
    activityLog: ["Tech Demo 0.0.1 데이터 로드 완료"],
    financeEvents: [],
    dailyAbsences: [],
    eveningHours: 6,
    restBonus: 0,
    nightAction: "none",
    nightTrainingCount: 0,
    nightConditionPenalty: 0,
    nightConditionSettled: false,
    dayClicks: 0
  };
}

function App() {
  const [state, setState] = useState<AppState>({ phase: "loading", seed: 0, dayIndex: 0, gamesPlayed: 0, teams: [], players: [], seasonRule: DEFAULT_RULE, kimRole: "투타 겸업", selectedEntry: [], selectedDh: false, activityLog: [], financeEvents: [], dailyAbsences: [], eveningHours: 6, restBonus: 0, nightAction: "none", nightTrainingCount: 0, nightConditionPenalty: 0, nightConditionSettled: false, dayClicks: 0 });
  const [account, setAccount] = useState<DemoAccount | null>(() => loadSavedAccount());
  const playerTeam = state.teams.find((team) => team.isPlayer);
  const kim = state.players.find((player) => player.name === KIM_NAME);

  useEffect(() => {
    const activeAccount = account;
    if (!activeAccount) return;
    async function load(loadAccount: DemoAccount) {
      const data = await fetchInitialData();
      const snapshot = await fetchSnapshot(loadAccount);
      const snapshotValid = snapshot?.players?.some((player) => player.name === KIM_NAME);
      setState(snapshotValid && snapshot ? normalizeLoadedState(snapshot) : makeInitialState(data));
    }
    load(activeAccount).catch((error) => setState((current) => ({ ...current, phase: "gameOver", gameOverReason: error.message })));
  }, [account]);

  useEffect(() => {
    if (account && state.phase !== "loading") saveSnapshot(account, state).catch(() => undefined);
  }, [account, state]);

  function update(mutator: (draft: AppState) => AppState) {
    setState((current) => checkGameOver(mutator(current)));
  }

  function startNext() {
    update((current) => {
      if (current.dayIndex >= 14 || current.gamesPlayed >= 8) return finishSeason(current);
      const recovered = recoverForScheduleStart(current);
      if (hasDayMiniGame(recovered.dayIndex)) return { ...recovered, phase: "miniGame", dayClicks: 0 };
      if (isGameDay(recovered.dayIndex)) return preparePregame(recoverForWeekendMorning(recovered));
      return { ...recovered, phase: "evening", eveningHours: 6 };
    });
  }

  function finishDay(current: AppState): AppState {
    const settled = settleNightCondition(current);
    const next: AppState = { ...settled, dayIndex: settled.dayIndex + 1, phase: "dashboard", eveningHours: 6, dayClicks: 0, financeEvents: [], dailyAbsences: [], nightAction: "none", nightTrainingCount: 0, nightConditionPenalty: 0, nightConditionSettled: false };
    return next.dayIndex >= 14 || next.gamesPlayed >= 8 ? finishSeason(next) : next;
  }

  function afterDayWork(clicks: number) {
    update((current) => {
      const income = clicks * 20000;
      const rng = createRng(current.seed + current.dayIndex * 31 + clicks * 13);
      const players = applyWeekdayJobFatigue(current.players, rng, clicks);
      const teams = current.teams.map((team) => team.isPlayer ? { ...team, funds: team.funds + income } : team);
      const log = `주간 일정 종료: ${clicks}회 처리, 수입 ${money(income)}, 김철민 추가 체력 -${clicks * 5}, 주간 컨디션 정산 완료`;
      const base = { ...current, seed: current.seed + 19, players, teams, activityLog: [log, ...current.activityLog], dayClicks: clicks };
      const day = dayName(current.dayIndex);
      if (day === "월" || day === "화") return { ...base, phase: "evening", eveningHours: 6 };
      if (current.dayIndex % 7 === 2) return { ...settleWednesdayFinance(base), phase: "teamManagement", eveningHours: 6 };
      return preparePregame(base);
    });
  }

  function preparePregame(current: AppState): AppState {
    const opponents = current.teams.filter((team) => !team.isPlayer);
    const opponent = opponents[current.gamesPlayed % opponents.length];
    const playerTeam = current.teams.find((team) => team.isPlayer);
    const dailyAbsences = playerTeam ? generateDailyAbsences(current, playerTeam.id) : [];
    const absentIds = new Set(dailyAbsences.map((absence) => absence.playerId));
    const selectedEntry = current.selectedEntry.filter((id) => !absentIds.has(id));
    const selectedPitcherId = current.selectedPitcherId && absentIds.has(current.selectedPitcherId) ? undefined : current.selectedPitcherId;
    const absenceLog = dailyAbsences.length ? `당일 결석 ${dailyAbsences.length}명: ${dailyAbsences.map((absence) => `${absence.playerName}(${absence.reason})`).join(", ")}` : "당일 결석자 없음";
    return { ...current, phase: "preGame", currentOpponentId: opponent.id, dailyAbsences, selectedEntry, selectedPitcherId, activityLog: [`${gameLabel(current.dayIndex)} 상대: ${opponent.name}`, absenceLog, ...current.activityLog] };
  }

  function beginGame() {
    update((current) => ({ ...current, phase: "game", match: createMatch(current) }));
  }

  function nextFromPostGame() {
    update((current) => {
      if (isWeekend(current.dayIndex)) return { ...current, phase: "evening", eveningHours: 6 };
      return finishDay(current);
    });
  }

  function restart() {
    if (!account) return;
    resetBackend(account).then((data) => setState(makeInitialState(data))).catch((error) => setState((current) => ({ ...current, gameOverReason: error.message })));
  }

  function enterAccount(next: DemoAccount) {
    saveAccount(next);
    setAccount(next);
    setState((current) => ({ ...current, phase: "loading" }));
  }

  function logout() {
    saveAccount(null);
    setAccount(null);
    setState({ phase: "loading", seed: 0, dayIndex: 0, gamesPlayed: 0, teams: [], players: [], seasonRule: DEFAULT_RULE, kimRole: "투타 겸업", selectedEntry: [], selectedDh: false, activityLog: [], financeEvents: [], dailyAbsences: [], eveningHours: 6, restBonus: 0, nightAction: "none", nightTrainingCount: 0, nightConditionPenalty: 0, nightConditionSettled: false, dayClicks: 0 });
  }

  if (!account) return <IndexScreen onEnter={enterAccount} />;
  if (state.phase === "loading") return <Shell state={state} userName={account?.username}><Panel title="로딩">DB 데이터를 불러오는 중입니다.</Panel></Shell>;
  if (!playerTeam || !kim) return <Shell state={state} userName={account?.username}><GameOver reason="플레이어 팀 또는 김철민 데이터를 찾을 수 없습니다." onRestart={restart} /></Shell>;
  const showWednesdayOps = state.phase === "dashboard" && state.dayIndex % 7 === 2 && (state.financeEvents?.length ?? 0) > 0;
  const mainActions = (
    <>
      <button onClick={() => update((s) => ({ ...s, phase: "dashboard" }))}>본부</button>
      <button onClick={() => update((s) => ({ ...s, phase: "roster" }))}>선수단</button>
      <button onClick={() => update((s) => ({ ...s, phase: "preGame" }))}>경기</button>
    </>
  );
  const userActions = (
    <>
      <button className="logoutButton" onClick={logout}>로그아웃</button>
    </>
  );

  return (
    <Shell state={state} userName={account.username} mainActions={mainActions} userActions={userActions}>
      {showWednesdayOps && <TeamManagement state={state} setState={update} finishDay={() => update(finishDay)} />}
      {state.phase === "dashboard" && !showWednesdayOps && <Dashboard state={state} onNext={startNext} />}
      {state.phase === "miniGame" && <MiniGame state={state} onFinish={afterDayWork} />}
      {state.phase === "evening" && <Evening state={state} setState={update} finishDay={() => update(finishDay)} />}
      {state.phase === "roster" && <Roster state={state} />}
      {state.phase === "teamManagement" && <TeamManagement state={state} setState={update} finishDay={() => update(finishDay)} />}
      {state.phase === "preGame" && <PreGame state={state} setState={update} onBegin={beginGame} />}
      {state.phase === "game" && <GameView state={state} setState={update} />}
      {state.phase === "postGame" && <PostGame state={state} onNext={nextFromPostGame} />}
      {state.phase === "seasonEnd" && <SeasonEnd state={state} onRestart={restart} />}
      {state.phase === "gameOver" && <GameOver reason={state.gameOverReason ?? "게임오버"} onRestart={restart} />}
    </Shell>
  );
}

function recoverForScheduleStart(state: AppState): AppState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, stamina: player.maxStamina })),
    activityLog: ["새 주간 일정 시작: 전 선수 체력 100% 회복", ...state.activityLog]
  };
}

function recoverForWeekendMorning(state: AppState): AppState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, stamina: player.maxStamina })),
    activityLog: ["주말 오전 경기: 전 선수 체력 100% 상태로 집합", ...state.activityLog]
  };
}

function conditionRoll(rng: () => number, base: number, spread = 8) {
  return clamp(Math.round(base + (rng() * spread * 2 - spread)), 5, 100);
}

function settleNightCondition(state: AppState): AppState {
  if (state.nightConditionSettled) return state;
  const team = state.teams.find((item) => item.isPlayer);
  if (!team) return state;
  const rng = createRng(state.seed + state.dayIndex * 211 + 503);
  const action = state.nightAction ?? "none";
  const trainingCount = state.nightTrainingCount ?? 0;
  const partyPenalty = state.nightConditionPenalty ?? 0;
  const players = state.players.map((player) => {
    let base = 74;
    if (player.teamId === team.id) {
      if (action === "rest") base = player.name === KIM_NAME ? 94 : 77;
      if (action === "training") base = player.name === KIM_NAME ? 70 - trainingCount * 6 : 76;
      if (action === "teamTraining") base = 72;
      if (action === "party") base = 76 + partyPenalty;
    }
    return { ...player, condition: conditionRoll(rng, base) };
  });
  const actionText = action === "rest" ? "휴식" : action === "training" ? `개인 훈련 ${trainingCount}회` : action === "teamTraining" ? "팀 훈련/관리" : action === "party" ? "팀 회식" : "자율 정리";
  return {
    ...state,
    players,
    nightConditionSettled: true,
    activityLog: [`야간 컨디션 정산: ${actionText} 기준으로 새 컨디션 산출`, ...state.activityLog]
  };
}

function IndexScreen({ onEnter }: { onEnter: (account: DemoAccount) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const account = mode === "register"
        ? await registerAccount(username, KIM_NAME, password)
        : await loginAccount(username, password);
      onEnter(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="indexScreen">
      <section className="indexHero">
        <IndexDecor />
        <div className="indexTitle">
          <span>Tech Demo 0.0.1</span>
          <h1>KABC: 퇴근 후 플레이볼</h1>
          <p>복사골 피치브라더스를 이끌고 퇴근 후 주간 일정, 팀 운영, 7이닝 사회인 야구 경기를 검증하는 플레이 로직 중심 테크데모입니다.</p>
        </div>
        <form className="authPanel" onSubmit={submit}>
          <div className="authTabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>로그인</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>회원가입</button>
          </div>
          <label className="field">아이디
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} required />
          </label>
          <label className="field">비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} required />
          </label>
          {error && <p className="danger">{error}</p>}
          <button className="primary bigAction" disabled={busy}>{mode === "register" ? "새 감독 등록" : "내 구단 불러오기"}</button>
        </form>
      </section>
    </main>
  );
}

function IndexDecor() {
  return (
    <div className="indexDecor" aria-hidden="true">
      <svg className="decorIcon briefcase" viewBox="0 0 64 64">
        <rect x="12" y="22" width="40" height="30" rx="5" />
        <path d="M24 22v-6h16v6M12 32h40M30 31h4v5h-4z" />
      </svg>
      <svg className="decorIcon glove" viewBox="0 0 64 64">
        <path d="M17 45c-5-9-2-22 5-25 4-2 7 0 8 4 3-7 11-5 11 3 5-3 10 1 8 8 6 2 5 10-1 13-8 5-23 7-31-3z" />
        <path d="M25 26c2 7 1 13-3 18M34 27c2 6 1 12-2 17M42 31c1 5 0 9-3 12" />
      </svg>
      <svg className="decorIcon laptop" viewBox="0 0 64 64">
        <rect x="16" y="16" width="32" height="24" rx="3" />
        <path d="M10 46h44l-5 6H15zM22 22h20" />
      </svg>
      <svg className="decorIcon bat" viewBox="0 0 64 64">
        <path d="M46 8c5 2 7 7 4 12L29 52c-2 3-6 4-9 2s-4-6-2-9l21-32c2-4 4-6 7-5z" />
        <path d="M18 51l-5 7M43 14l7 5" />
      </svg>
      <svg className="decorIcon ball" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="22" />
        <path d="M21 15c7 9 7 25 0 34M43 15c-7 9-7 25 0 34" />
        <path d="M23 22l-5 2M25 29l-6 1M25 36l-6-1M23 43l-5-2M41 22l5 2M39 29l6 1M39 36l6-1M41 43l5-2" />
      </svg>
    </div>
  );
}

function weekdayFatigue(player: Player, rng: () => number) {
  const fatigue = player.meta.weekdayFatigue;
  if (Array.isArray(fatigue) && fatigue.length === 2) {
    const [low, high] = fatigue as [number, number];
    return Math.round(low + rng() * (high - low));
  }
  const fallback: Record<string, [number, number]> = {
    "공무원/공공기관": [10, 18],
    "대기업 사무직": [15, 28],
    "스타트업/중소기업": [20, 38],
    "영업직": [22, 40],
    "자영업자": [25, 45],
    "청마루 감자탕 후계자": [25, 45],
    "프리랜서": [8, 25],
    "무직/백수": [0, 12],
    "야구교실 코치": [15, 30]
  };
  const [low, high] = fallback[player.job] ?? [12, 28];
  return Math.round(low + rng() * (high - low));
}

function applyWeekdayJobFatigue(players: Player[], rng: () => number, kimClicks: number) {
  return players.map((player) => {
    const clickFatigue = player.name === KIM_NAME ? kimClicks * 5 : 0;
    const jobFatigue = player.name === KIM_NAME ? 0 : weekdayFatigue(player, rng);
    const fatigue = jobFatigue + clickFatigue;
    const condition = conditionRoll(rng, 82 - fatigue * 0.55);
    return { ...player, stamina: clamp(player.maxStamina - fatigue, 0, player.maxStamina), condition };
  });
}

function absenceReason(player: Player, rng: () => number) {
  const table: Record<string, string[]> = {
    "공무원/공공기관": ["당직 근무 배정", "긴급 민원 대응", "기관 행사 지원"],
    "대기업 사무직": ["분기 보고 회의", "야근 확정", "지방 출장"],
    "스타트업/중소기업": ["배포 장애 대응", "거래처 납품 일정", "긴급 회의"],
    "영업직": ["고객 미팅 연장", "지방 영업 일정", "계약 마감 대응"],
    "자영업자": ["가게 피크타임 인력 부족", "거래처 정산", "예약 손님 대응"],
    "청마루 감자탕 후계자": ["청마루 감자탕 단체 예약", "식자재 새벽 입고 준비", "매장 인력 공백"],
    "프리랜서": ["마감 납품", "클라이언트 긴급 수정", "외주 촬영 일정"],
    "무직/백수": ["개인 사정", "가족 일정", "연락 두절"],
    "야구교실 코치": ["보강 레슨", "유소년 대회 인솔", "학부모 상담"]
  };
  const reasons = table[player.job] ?? ["개인 일정 충돌", "직장 일정 변경", "교통 문제"];
  return reasons[Math.floor(rng() * reasons.length)];
}

function generateDailyAbsences(state: AppState, teamId: number) {
  const existing = (state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex);
  if (existing.length) return existing;
  const rng = createRng(state.seed + state.dayIndex * 307 + state.gamesPlayed * 41 + 913);
  const isWeekdayGame = state.dayIndex % 7 === 3 || state.dayIndex % 7 === 4;
  return state.players
    .filter((player) => player.teamId === teamId && !player.injured && player.name !== KIM_NAME)
    .flatMap((player): DailyAbsence[] => {
      const jobPressure = isWeekdayGame ? weekdayFatigue(player, rng) * 0.18 : 0;
      const chance = clamp((100 - player.attendance) * 0.28 + jobPressure, 2, isWeekdayGame ? 24 : 14);
      if (rng() * 100 >= chance) return [];
      return [{ dayIndex: state.dayIndex, playerId: player.id, playerName: player.name, reason: absenceReason(player, rng) }];
    });
}

function activeAbsenceIds(state: AppState) {
  return new Set((state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex).map((absence) => absence.playerId));
}

function settleWednesdayFinance(state: AppState): AppState {
  const team = state.teams.find((item) => item.isPlayer);
  if (!team) return state;
  const rng = createRng(state.seed + state.dayIndex * 101 + 77);
  const roster = state.players.filter((player) => player.teamId === team.id);
  const settled = settleDues(roster, rng);
  const ids = new Set(roster.map((player) => player.id));
  return {
    ...state,
    seed: state.seed + 77,
    players: state.players.map((player) => ids.has(player.id) ? settled.players.find((next) => next.id === player.id)! : player),
    teams: state.teams.map((item) => item.id === team.id ? { ...item, funds: item.funds + settled.income } : item),
    financeEvents: settled.entries,
    activityLog: [`수요일 자동 정산: 회비/찬조금 ${money(settled.income)} 입금`, ...settled.logs, ...state.activityLog]
  };
}

function checkGameOver(state: AppState): AppState {
  const team = state.teams.find((item) => item.isPlayer);
  if (!team) return state;
  const absenceIds = activeAbsenceIds(state);
  const available = state.players.filter((player) => player.teamId === team.id && !player.injured && player.stamina > 0 && !absenceIds.has(player.id));
  if (team.trust <= 0) return { ...state, phase: "gameOver", gameOverReason: "감독 신뢰도 0. 김철민이 팀에서 방출되었습니다." };
  if (team.funds <= 0) return { ...state, phase: "gameOver", gameOverReason: "팀 재정 0원 이하. 리그 운영 불가." };
  if (isGameDay(state.dayIndex) && available.length < 9) return { ...state, phase: "gameOver", gameOverReason: "경기 당일 출전 가능 선수 9명 미만." };
  return state;
}

function finishSeason(state: AppState): AppState {
  const playerTeam = state.teams.find((team) => team.isPlayer)!;
  const ranked = [...state.teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  const rank = ranked.findIndex((team) => team.id === playerTeam.id) + 1;
  const reward = rank === 1 ? state.seasonRule.championReward : rank === 2 ? state.seasonRule.runnerUpReward : rank === 3 ? state.seasonRule.thirdReward : 0;
  const finalFunds = playerTeam.funds + reward;
  if (finalFunds < state.seasonRule.entryFee) {
    return { ...state, phase: "gameOver", gameOverReason: `2주 종료 평가 ${rank}위. 보상 후 자금 ${money(finalFunds)}으로 다음 리그 참가비 부족.` };
  }
  const teams = state.teams.map((team) => team.id === playerTeam.id ? { ...team, funds: finalFunds - state.seasonRule.entryFee } : team);
  return { ...state, teams, phase: "seasonEnd", activityLog: [`2주 종료 평가 ${rank}위, 보상 ${money(reward)}, 참가비 ${money(state.seasonRule.entryFee)} 차감`, ...state.activityLog] };
}

function Shell({ state, children, userName, mainActions, userActions }: { state: AppState; children: React.ReactNode; userName?: string; mainActions?: React.ReactNode; userActions?: React.ReactNode }) {
  const team = state.teams.find((item) => item.isPlayer);
  return (
    <main className="app">
      <header className="dugoutHeader">
        <div className="brandLockup">
          <span>Tech Demo 0.0.1</span>
          <h1>KABC: 퇴근 후 플레이볼</h1>
          <p>{weekNumber(state.dayIndex)}주차 {dayName(state.dayIndex)}요일 · {nextScheduleText(state.dayIndex)}</p>
        </div>
        {mainActions && <nav className="mainHudNav">{mainActions}</nav>}
        {team && <div className="hudCluster">
          <div className="fundHud"><span>자금</span><strong>{shortMoney(team.funds)}</strong></div>
          <div className="scoreChips">
            <span><em>사기</em><b>{teamMorale(team)}</b></span>
            <span><em>유대</em><b>{team.bond}</b></span>
            <span><em>신뢰</em><b>{team.trust}</b></span>
          </div>
          {userName && <div className="hudUser"><span>USER</span><strong>{userName}</strong></div>}
          {userActions && <div className="hudActions">{userActions}</div>}
        </div>}
      </header>
      <DateCurtain state={state} />
      <FinanceCurtain state={state} />
      {children}
    </main>
  );
}

function DateCurtain({ state }: { state: AppState }) {
  if (state.phase === "loading") return null;
  return (
    <div className="dateCurtain" key={state.dayIndex}>
      <span>{weekNumber(state.dayIndex)}주차</span>
      <strong>{dayName(state.dayIndex)}요일</strong>
      <em>{nextScheduleText(state.dayIndex)}</em>
    </div>
  );
}

function FinanceCurtain({ state }: { state: AppState }) {
  if (state.phase !== "teamManagement" || state.dayIndex % 7 !== 2) return null;
  const sponsors = (state.financeEvents ?? []).filter((event) => event.kind === "sponsor" && event.amount > 0);
  if (!sponsors.length) return null;
  const top = sponsors.reduce((best, event) => event.amount > best.amount ? event : best, sponsors[0]);
  return (
    <div className="financeCurtain" key={`${state.dayIndex}-${top.id}`}>
      <span>찬조금 입금</span>
      <strong>{top.playerName}</strong>
      <em>{money(top.amount)}</em>
    </div>
  );
}

function Panel({ title, children, wide = false, className = "" }: { title: string; children: React.ReactNode; wide?: boolean; className?: string }) {
  return <section className={`${wide ? "panel wide" : "panel"} ${className}`}><h2>{title}</h2>{children}</section>;
}

function Dashboard({ state, onNext }: { state: AppState; onNext: () => void }) {
  const team = state.teams.find((item) => item.isPlayer)!;
  return (
    <div className="clubhouse">
      <Panel title="오늘의 흐름" className="scheduleBoard">
        <div className="calendarStrip">
          {Array.from({ length: 7 }, (_, index) => {
            const day = state.dayIndex - (state.dayIndex % 7) + index;
            return <span key={index} className={day === state.dayIndex ? "active" : ""}>{dayName(day)}<small>{isGameDay(day) ? "경기" : "일정"}</small></span>;
          })}
        </div>
        <div className="nextCard">
          <strong>{nextScheduleText(state.dayIndex)}</strong>
          <p>평일 낮에는 직업 피로가 누적됩니다. 다음 주간 일정 시작 시 체력은 전원 100%로 회복됩니다.</p>
        </div>
        <button className="primary bigAction" onClick={onNext}>오늘 일정 시작</button>
      </Panel>
      <Panel title="구단 상태">
        <div className="metricGrid">
          <Metric label="팀 자금" value={money(team.funds)} />
          <Metric label="재정 안정도" value={financialStability(team.funds)} />
          <Metric label="팀 사기" value={teamMorale(team)} />
          <Metric label="출전 공정성" value={team.fairness} />
          <Metric label="진행 경기" value={`${state.gamesPlayed}/8`} />
          <Metric label="전적" value={`${team.wins}승 ${team.losses}패 ${team.draws}무`} />
        </div>
      </Panel>
      <Panel title="운영 로그" wide><LogList rows={state.activityLog.slice(0, 12)} /></Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function MiniGame({ state, onFinish }: { state: AppState; onFinish: (clicks: number) => void }) {
  const kim = state.players.find((player) => player.name === KIM_NAME)!;
  const [clicks, setClicks] = useState(0);
  const projectedStamina = Math.max(0, kim.maxStamina - clicks * 5);
  return (
    <div className="workScene">
      <Panel title="낮 주간 일정: 퇴근 전 업무 처리">
        <div className="workDesk">
          <div className="clipboardSvg" aria-hidden="true">
            <svg viewBox="0 0 220 180"><rect x="45" y="20" width="130" height="150" rx="10" /><rect x="78" y="10" width="64" height="28" rx="8" /><line x1="70" x2="150" y1="62" y2="62" /><line x1="70" x2="150" y1="88" y2="88" /><line x1="70" x2="130" y1="114" y2="114" /></svg>
          </div>
          <Metric label="클릭 보상" value="+20,000원" />
          <Metric label="클릭 체력 비용" value="김철민 -5" />
          <Metric label="김철민 주간 피로" value="클릭 수 × 5만 적용" />
          <Metric label="현재 처리" value={`${clicks}회`} />
          <Metric label="예상 수입" value={money(clicks * 20000)} />
          <Metric label="김철민 예상 체력" value={`${projectedStamina}/${kim.maxStamina}`} />
          <button className="bigClick" onClick={() => setClicks(clicks + 1)}>업무 하나 더 처리</button>
          <button className="primary" onClick={() => onFinish(clicks)}>퇴근하고 저녁 일정으로</button>
        </div>
      </Panel>
      <Panel title="저녁 체력 예고">
        <p className="next">퇴근 후에는 김철민은 클릭 업무 피로만 적용되고, 다른 우리팀/상대팀 선수는 직업별 낮 피로가 적용됩니다. 그래서 화면의 김철민 예상 체력과 정산 후 체력이 일치합니다.</p>
        <FancyPlayerCard player={{ ...kim, stamina: projectedStamina }} compact />
      </Panel>
    </div>
  );
}

function Evening({ state, setState, finishDay }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void; finishDay: () => void }) {
  const kim = state.players.find((player) => player.name === KIM_NAME)!;
  const stats = [
    ["컨택", "contact"],
    ["선구안", "discipline"],
    ["장타력", "power"],
    ["속도", "speed"],
    ["제구력", "control"],
    ["구속", "velocity"],
    ["주의력", "awareness"],
    ["전용 스탯", kim.primaryPosition === "투수" ? "stuff" : kim.primaryPosition === "포수" ? "lead" : kim.primaryPosition === "외야수" ? "jump" : "range"]
  ] as const;
  const train = (key: string) => {
    setState((current) => {
      if (current.eveningHours < 2) return current;
      const rng = createRng(current.seed + current.activityLog.length);
      const success = rng() < 0.2;
      const players = current.players.map((player) => {
        if (player.id !== kim.id) return player;
        const next = structuredClone(player) as Player;
        if (success) {
          if (key in next.battingStats) next.battingStats[key as keyof Player["battingStats"]] = clamp(next.battingStats[key as keyof Player["battingStats"]] + 1, 0, 99);
          else if (key in next.fieldingStats) next.fieldingStats[key as keyof Player["fieldingStats"]] = clamp(next.fieldingStats[key as keyof Player["fieldingStats"]] + 1, 0, 99);
          else next.positionStats[key as keyof Player["positionStats"]] = clamp(next.positionStats[key as keyof Player["positionStats"]] + 1, 0, 99);
        }
        next.stamina = clamp(next.stamina - 4, 0, next.maxStamina);
        return next;
      });
      return { ...current, players, eveningHours: current.eveningHours - 2, seed: current.seed + 11, nightAction: "training", nightTrainingCount: (current.nightTrainingCount ?? 0) + 1, nightConditionSettled: false, activityLog: [`개인 훈련: ${key} ${success ? "+1 성공" : "변화 없음"} / 김철민 체력 -4`, ...current.activityLog] };
    });
  };
  const rest = () => setState((current) => ({ ...current, players: current.players.map((player) => player.id === kim.id ? { ...player, stamina: clamp(player.stamina + 18, 0, player.maxStamina) } : player), restBonus: 0, nightAction: "rest", nightConditionSettled: false, activityLog: ["휴식 선택: 야간 컨디션 정산에서 휴식 기준 적용, 김철민 체력 +18", ...current.activityLog], eveningHours: 0 }));
  const party = (option: typeof PARTY_OPTIONS[number]) => {
    setState((current) => {
      const team = current.teams.find((item) => item.isPlayer)!;
      if (team.funds < option.cost) return current;
      return {
        ...current,
        teams: current.teams.map((item) => item.id === team.id ? { ...item, funds: item.funds - option.cost, bond: clamp(item.bond + option.bond, 0, 100), recentMood: clamp(item.recentMood + option.mood, 0, 100) } : item),
        nightAction: "party",
        nightConditionPenalty: option.condition,
        nightConditionSettled: false,
        eveningHours: 0,
        activityLog: [`${option.label}: ${money(option.cost)} 차감, 유대감 +${option.bond}, 분위기 +${option.mood}, 컨디션 ${option.condition}`, ...current.activityLog]
      };
    });
  };
  return (
    <div className="grid two">
      <Panel title="퇴근 후 6시간">
        <Metric label="남은 시간" value={`${state.eveningHours}시간`} />
        <div className="buttonGrid">
          {stats.map(([label, key]) => <button key={key} disabled={state.eveningHours < 2} onClick={() => train(key)}>{label} 훈련<small>2시간 · 김철민 체력 -4 · 성공률 20%</small></button>)}
        </div>
        <button onClick={rest} disabled={state.eveningHours <= 0}>휴식으로 저녁 종료</button>
        {isWeekend(state.dayIndex) && <div className="partyRow">{PARTY_OPTIONS.map((option) => <button key={option.label} disabled={(state.teams.find((team) => team.isPlayer)?.funds ?? 0) < option.cost} onClick={() => party(option)}>{option.label}<small>{money(option.cost)}</small></button>)}</div>}
        <button className="primary" onClick={finishDay}>하루 마감</button>
      </Panel>
      <Panel title="김철민 컨디션"><FancyPlayerCard player={kim} /></Panel>
    </div>
  );
}

function Roster({ state }: { state: AppState }) {
  const team = state.teams.find((item) => item.isPlayer)!;
  return <Panel title="선수단 카드 컬렉션" wide><div className="roster">{state.players.filter((player) => player.teamId === team.id).map((player) => <FancyPlayerCard key={player.id} player={player} />)}</div></Panel>;
}

function PlayerCard({ player, compact = false }: { player: Player; compact?: boolean }) {
  return (
    <article className={`playerCard ${compact ? "compact" : ""}`}>
      <div className="portrait">{player.number}</div>
      <div className="playerHead"><strong>#{player.number} {player.name}</strong><span>{player.age}세 · {player.job}</span></div>
      <div className="badges"><span>{player.battingRole}</span><span>{player.primaryPosition}</span>{player.traits.slice(0, compact ? 1 : 3).map((trait) => <span key={trait}>{trait}</span>)}{player.consideringLeave && <span className="danger">이탈 고민</span>}</div>
      <Bar label="체력" value={player.stamina} max={player.maxStamina} />
      <Bar label="컨디션" value={player.condition} max={100} />
      {!compact && <div className="statCols">
        <dl><dt>공격</dt><dd>컨택 {player.battingStats.contact}</dd><dd>선구안 {player.battingStats.discipline}</dd><dd>장타 {player.battingStats.power}</dd><dd>속도 {player.battingStats.speed}</dd></dl>
        <dl><dt>수비</dt><dd>제구 {player.fieldingStats.control}</dd><dd>구속 {player.fieldingStats.velocity}</dd><dd>주의 {player.fieldingStats.awareness}</dd><dd>OVR {playerOvr(player).toFixed(1)}</dd></dl>
      </div>}
      <p className="small">회비 {player.duesTrait} · 찬조 {player.sponsorTrait} · 출석 {player.attendance} · 트레이드 {tradeValue(player).toFixed(1)}</p>
    </article>
  );
}

function FancyPlayerCard({ player, compact = false }: { player: Player; compact?: boolean }) {
  const ovr = Math.round(playerOvr(player));
  const tier = cardTier(ovr);
  const starCount = cardStars(ovr);
  const statRows = [
    ["컨택", player.battingStats.contact],
    ["장타", player.battingStats.power],
    ["선구", player.battingStats.discipline],
    ["속도", player.battingStats.speed],
    ["제구", player.fieldingStats.control],
    ["구속", player.fieldingStats.velocity]
  ];
  return (
    <article className={`fancyCard cardTier-${tier.key} ${compact ? "compact" : ""}`}>
      <div className="cardChrome" aria-hidden="true" />
      <header className="cardTop">
        <div className="cardOvr"><strong>{ovr}</strong><span>OVR</span></div>
        <div className="cardTier">{tier.label}</div>
        <div className="cardPos">{player.primaryPosition}</div>
      </header>
      <div className="cardPortrait">
        <div className="playerSilhouette" />
        <span className="uniformNo">#{player.number}</span>
      </div>
      <div className="cardNameplate">
        <strong>{player.name}</strong>
        <span>{player.age}세 · {player.job}</span>
      </div>
      <div className="cardMeta">
        <span>{player.battingRole}</span>
        {player.traits.slice(0, compact ? 1 : 2).map((trait) => <span key={trait}>{trait}</span>)}
        {(player.battingStrategies ?? []).slice(0, compact ? 1 : 4).map((id) => BAT_STRATEGY_TABLE[id] ? <span key={id}>{BAT_STRATEGY_TABLE[id].label}</span> : null)}
        {player.consideringLeave && <span className="danger">이탈 고민</span>}
      </div>
      <div className="cardVitals">
        <Bar label="체력" value={player.stamina} max={player.maxStamina} />
        <Bar label="컨디션" value={player.condition} max={100} />
      </div>
      {!compact && <div className="cardStats">{statRows.map(([label, value]) => <CardStatBar key={label} label={String(label)} value={Number(value)} />)}</div>}
      <footer className="cardFooter">
        <span>{"★".repeat(starCount)}{"☆".repeat(5 - starCount)}</span>
        <small>출석 {player.attendance} · 회비 {player.duesTrait} · 찬조 {player.sponsorTrait} · 트레이드 {tradeValue(player).toFixed(1)}</small>
      </footer>
    </article>
  );
}

function cardTier(ovr: number) {
  if (ovr >= 82) return { key: "legend", label: "LEGEND" };
  if (ovr >= 74) return { key: "star", label: "STAR" };
  if (ovr >= 64) return { key: "gold", label: "GOLD" };
  return { key: "rookie", label: "ROOKIE" };
}

function cardStars(ovr: number) {
  if (ovr >= 84) return 5;
  if (ovr >= 75) return 4;
  if (ovr >= 66) return 3;
  if (ovr >= 56) return 2;
  return 1;
}

function CardStatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="cardStatBar">
      <span>{label}</span>
      <i><b style={{ width: `${clamp(value, 0, 100)}%` }} /></i>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="bar"><span>{label} {Math.round(value)}/{max}</span><i style={{ width: `${clamp((value / max) * 100, 0, 100)}%` }} /></div>;
}

function TeamManagement({ state, setState, finishDay }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void; finishDay: () => void }) {
  const team = state.teams.find((item) => item.isPlayer)!;
  const opponents = state.players.filter((player) => player.teamId !== team.id).sort((a, b) => tradeValue(a) - tradeValue(b)).slice(0, 8);
  if (state.dayIndex % 7 !== 2) {
    return (
      <div className="grid two">
        <Panel title="운영 잠금">
          <div className="lockedOps">
            <strong>팀 훈련 · 회비 정산 · 영입 · 트레이드는 수요일 밤에만 가능합니다.</strong>
            <p>지금은 라인업과 타순만 미리 확인할 수 있습니다.</p>
          </div>
        </Panel>
        <LineupManager state={state} setState={setState} />
      </div>
    );
  }
  const collect = () => setState((current) => {
    const rng = createRng(current.seed + 77);
    const roster = current.players.filter((player) => player.teamId === team.id);
    const settled = settleDues(roster, rng);
    const ids = new Set(roster.map((player) => player.id));
    return {
      ...current,
      seed: current.seed + 77,
      players: current.players.map((player) => ids.has(player.id) ? settled.players.find((next) => next.id === player.id)! : player),
      teams: current.teams.map((item) => item.id === team.id ? { ...item, funds: item.funds + settled.income } : item),
      financeEvents: settled.entries,
      activityLog: [`회비 정산 합계 ${money(settled.income)}`, ...settled.logs, ...current.activityLog]
    };
  });
  const training = (type: "일반" | "조직력") => setState((current) => {
    if (current.eveningHours < 3) return current;
    return {
      ...current,
      eveningHours: current.eveningHours - 3,
      nightAction: "teamTraining",
      nightConditionSettled: false,
      teams: current.teams.map((item) => item.id === team.id ? { ...item, bond: clamp(item.bond + (type === "조직력" ? 4 : 1), 0, 100), recentMood: clamp(item.recentMood + 1, 0, 100) } : item),
      activityLog: [`수요일 ${type} 팀 훈련 완료: 3시간 소모`, ...current.activityLog]
    };
  });
  const recruit = (target: Player) => setState((current) => ({ ...current, players: current.players.map((player) => player.id === target.id ? { ...player, teamId: team.id, number: Math.max(...current.players.filter((p) => p.teamId === team.id).map((p) => p.number)) + 1 } : player), teams: current.teams.map((item) => item.id === team.id ? { ...item, fairness: clamp(item.fairness - 1, 0, 100) } : item), activityLog: [`트레이드 제안 성사: ${target.name} 영입`, ...current.activityLog] }));
  return (
    <div className="grid managementGrid">
      <Panel title="수요일 팀 훈련">
        <Metric label="남은 저녁 시간" value={`${state.eveningHours}시간`} />
        <div className="buttonGrid">
          <button disabled onClick={collect}>회비/찬조 자동 정산 완료</button>
          <button disabled={state.eveningHours < 3} onClick={() => training("일반")}>일반 팀 훈련<small>3시간</small></button>
          <button disabled={state.eveningHours < 3} onClick={() => training("조직력")}>조직력 훈련<small>3시간</small></button>
          <button onClick={() => setState((s) => ({ ...s, activityLog: ["모집원서 확인: 테크데모에서는 트레이드 후보 목록으로 대체 표시", ...s.activityLog] }))}>모집원서 확인</button>
        </div>
        <button className="primary" onClick={finishDay}>팀 관리 종료</button>
      </Panel>
      <FinanceLedger events={state.financeEvents} />
      <LineupManager state={state} setState={setState} />
      <Panel title="트레이드/영입 후보">
        <div className="tradeList">{opponents.map((player) => <button key={player.id} onClick={() => recruit(player)}><span>{player.name} · {player.primaryPosition}</span><strong>{tradeValue(player).toFixed(1)}</strong></button>)}</div>
      </Panel>
    </div>
  );
}

function FinanceLedger({ events = [] }: { events?: FinanceEvent[] }) {
  const dues = events.filter((event) => event.kind === "dues");
  const sponsors = events.filter((event) => event.kind === "sponsor");
  const paid = dues.filter((event) => event.paid);
  const unpaid = dues.filter((event) => !event.paid);
  const sponsorTotal = sponsors.reduce((sum, event) => sum + event.amount, 0);
  return (
    <Panel title="회비 출납 장부" className="financeLedger">
      <div className="ledgerSummary">
        <Metric label="납부" value={`${paid.length}/${dues.length}`} />
        <Metric label="미납" value={unpaid.length} />
        <Metric label="찬조" value={money(sponsorTotal)} />
      </div>
      <div className="ledgerColumns">
        <LedgerColumn title="납부자" empty="납부 기록 없음" events={paid} />
        <LedgerColumn title="미납자" empty="미납 없음" events={unpaid} tone="unpaid" />
        <LedgerColumn title="찬조자" empty="찬조 없음" events={sponsors} tone="sponsor" />
      </div>
    </Panel>
  );
}

function LedgerColumn({ title, empty, events, tone = "paid" }: { title: string; empty: string; events: FinanceEvent[]; tone?: "paid" | "unpaid" | "sponsor" }) {
  return (
    <div className="ledgerColumn">
      <h3>{title}</h3>
      <div className="ledgerList">
        {events.length ? events.map((event) => (
          <div key={event.id} className={`ledgerItem ${tone}`}>
            <strong>{event.playerName}</strong>
            <span>{event.kind === "sponsor" ? money(event.amount) : event.paid ? money(event.amount) : "미납"}</span>
            <small>확률 {Math.round(event.chance)}%</small>
          </div>
        )) : <p className="ledgerEmpty">{empty}</p>}
      </div>
    </div>
  );
}

function LineupManager({ state, setState }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void }) {
  const team = state.teams.find((item) => item.isPlayer)!;
  const roster = state.players.filter((player) => player.teamId === team.id);
  const absenceIds = activeAbsenceIds(state);
  const availableRoster = roster.filter((player) => !absenceIds.has(player.id));
  const selectedPlayers = state.selectedEntry.map((id) => availableRoster.find((player) => player.id === id)).filter(Boolean) as Player[];
  const defenseSlots = buildDefenseSlots(selectedPlayers, state.selectedPitcherId);
  const toggle = (id: number) => setState((current) => {
    if (activeAbsenceIds(current).has(id)) return current;
    const selected = current.selectedEntry.includes(id) ? current.selectedEntry.filter((item) => item !== id) : [...current.selectedEntry, id].slice(0, 9);
    return { ...current, selectedEntry: selected };
  });
  const moveBatter = (index: number, delta: number) => setState((current) => {
    const next = [...current.selectedEntry];
    const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, selectedEntry: next };
  });
  return (
    <Panel title="다음 경기 선발 라인업">
      <div className="lineupField">
        {defenseSlots.map((slot) => (
          <div key={slot.key} className={`defSlot ${slot.key}`}>
            <strong>{slot.label}</strong>
            <span>{slot.player?.name ?? "미지정"}</span>
          </div>
        ))}
        <div className="fieldGrass" />
        <div className="fieldDirt" />
      </div>
      <label className="field">선발투수
        <select value={state.selectedPitcherId ?? ""} onChange={(event) => setState((s) => {
          const pitcherId = Number(event.target.value);
          const selectedEntry = s.selectedEntry.includes(pitcherId) ? s.selectedEntry : [pitcherId, ...s.selectedEntry].slice(0, 9);
          return { ...s, selectedPitcherId: pitcherId, selectedEntry };
        })}>
          {availableRoster.filter((player) => player.pitches.length > 0).map((player) => <option key={player.id} value={player.id}>{player.name} · 체력 {player.stamina}/{player.maxStamina}</option>)}
        </select>
      </label>
      <div className="battingOrder">
        <h3>타선 관리</h3>
        {state.selectedEntry.map((id, index) => {
          const player = roster.find((item) => item.id === id);
          return (
            <div key={id} className="battingRow">
              <strong>{index + 1}번</strong>
              {player && !absenceIds.has(player.id) ? (
                <span className="lineupHoverName">
                  {player.name}
                  <FieldTooltipCard player={player} role={`${index + 1}번 타자`} mode="batter" />
                </span>
              ) : <span>미지정</span>}
              <small>{player?.primaryPosition ?? "-"}</small>
              <button onClick={() => moveBatter(index, -1)} disabled={index === 0}>▲</button>
              <button onClick={() => moveBatter(index, 1)} disabled={index === state.selectedEntry.length - 1}>▼</button>
            </div>
          );
        })}
      </div>
      <div className="entryList compactList dugoutEntryList">{roster.map((player) => {
        const absent = absenceIds.has(player.id);
        return (
          <button key={player.id} disabled={absent} className={state.selectedEntry.includes(player.id) && !absent ? "selected" : ""} onClick={() => toggle(player.id)}>
            <span className="lineupHoverName">
              #{player.number} {player.name} · {player.primaryPosition}{absent ? " · 결석" : ""}
              <FieldTooltipCard player={player} role={state.selectedEntry.includes(player.id) ? "선발 후보" : "더그아웃"} mode={player.pitches.length > 0 ? "pitcher" : "fielder"} />
            </span>
            <strong>{absent ? "사용불가" : `${player.stamina}/${player.maxStamina}`}</strong>
          </button>
        );
      })}</div>
    </Panel>
  );
}

const DEFENSE_ORDER = [
  { key: "pitcher", label: "투수", wants: ["투수"] },
  { key: "catcher", label: "포수", wants: ["포수"] },
  { key: "firstBase", label: "1루수", wants: ["1루수", "내야수", "유틸"] },
  { key: "secondBase", label: "2루수", wants: ["2루수", "내야수", "유틸"] },
  { key: "thirdBase", label: "3루수", wants: ["3루수", "내야수", "유틸"] },
  { key: "shortstop", label: "유격수", wants: ["유격수", "내야수", "유틸"] },
  { key: "leftField", label: "좌익수", wants: ["좌익수", "외야수", "유틸"] },
  { key: "centerField", label: "중견수", wants: ["중견수", "외야수", "유틸"] },
  { key: "rightField", label: "우익수", wants: ["우익수", "외야수", "유틸"] }
] as const;

function buildDefenseSlots(players: Player[], selectedPitcherId?: number) {
  const used = new Set<number>();
  return DEFENSE_ORDER.map((slot) => {
    let player: Player | undefined;
    if (slot.key === "pitcher" && selectedPitcherId) {
      player = players.find((candidate) => candidate.id === selectedPitcherId);
    }
    if (!player) {
      player = players
        .filter((candidate) => !used.has(candidate.id))
        .find((candidate) => slot.wants.some((position) => candidate.primaryPosition === position || candidate.positions.includes(position as never)));
    }
    if (!player) player = players.find((candidate) => !used.has(candidate.id));
    if (player) used.add(player.id);
    return { ...slot, player };
  });
}

function PreGame({ state, setState, onBegin }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void; onBegin: () => void }) {
  const team = state.teams.find((item) => item.isPlayer)!;
  const opponent = state.teams.find((item) => item.id === state.currentOpponentId) ?? state.teams.find((item) => !item.isPlayer)!;
  const validation = validateEntry(state);
  return (
    <div className="grid two">
      <Panel title="경기 전 더그아웃">
        <p className="next">{gameLabel(state.dayIndex)} · 상대 {opponent.name}</p>
        <label className="field">김철민 역할
          <select value={state.kimRole} onChange={(event) => setState((s) => ({ ...s, kimRole: event.target.value as KimRole }))}>
            {KIM_ROLES.map((role) => <option key={role}>{role}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={state.selectedDh} onChange={(event) => setState((s) => ({ ...s, selectedDh: event.target.checked }))} /> 지명타자 사용</label>
        <div className="warnings">{validation.errors.map((item) => <p className="danger" key={item}>{item}</p>)}{validation.warnings.map((item) => <p className="warn" key={item}>{item}</p>)}</div>
        <button className="primary bigAction" disabled={validation.errors.length > 0} onClick={onBegin}>플레이볼</button>
      </Panel>
      <LineupManager state={state} setState={setState} />
      <AbsencePanel state={state} />
    </div>
  );
}

function AbsencePanel({ state }: { state: AppState }) {
  const absences = (state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex);
  return (
    <Panel title="당일 결석 선수" className="absencePanel">
      {absences.length ? (
        <div className="absenceList">
          {absences.map((absence) => (
            <div className="absenceItem" key={absence.playerId}>
              <strong>{absence.playerName}</strong>
              <span>사용불가</span>
              <p>{absence.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="absenceEmpty">
          <strong>전원 참석 가능</strong>
          <p>오늘 경기 엔트리에서 결석으로 제외된 선수는 없습니다.</p>
        </div>
      )}
    </Panel>
  );
}

function GameView({ state, setState }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void }) {
  const match = state.match!;
  const home = state.teams.find((team) => team.id === match.homeTeamId)!;
  const away = state.teams.find((team) => team.id === match.awayTeamId)!;
  const waitingPitcher = state.players.find((player) => player.id === match.waitingPitcherId);
  const waitingBatter = state.players.find((player) => player.id === match.waitingBatterId);
  const waitingBatChoices = (waitingBatter?.battingStrategies?.length ? waitingBatter.battingStrategies : [...DEFAULT_BATTING_STRATEGIES])
    .map((id) => BAT_STRATEGY_TABLE[id])
    .filter(Boolean);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [bullpenPitcherId, setBullpenPitcherId] = useState("");
  const delay = { 0.5: 4200, 1: 2800, 2: 1700, 4: 950 }[speed];
  const attackingTeamId = match.top ? match.awayTeamId : match.homeTeamId;
  const fieldingTeamId = match.top ? match.homeTeamId : match.awayTeamId;
  const playerTeamId = state.teams.find((team) => team.isPlayer)?.id;
  const playerTeamFielding = fieldingTeamId === playerTeamId;
  const currentLineup = match.lineup[attackingTeamId] ?? [];
  const currentOrder = (match.orderIndex[attackingTeamId] ?? 0) % Math.max(1, currentLineup.length);
  const currentBatterId = currentLineup[currentOrder];
  const currentPitcherId = match.pitcher[fieldingTeamId];
  const playerPitcherId = playerTeamId ? match.pitcher[playerTeamId] : undefined;
  const playerLineupIds = new Set(playerTeamId ? match.lineup[playerTeamId] ?? [] : []);
  const absentIds = new Set((state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex).map((absence) => absence.playerId));
  const bullpenPitchers = state.players
    .filter((player) => player.teamId === playerTeamId && player.id !== playerPitcherId && !playerLineupIds.has(player.id) && !player.injured && !absentIds.has(player.id) && player.pitches.length > 0)
    .sort((a, b) => playerOvr(b, "투수") - playerOvr(a, "투수"));
  const runStep = (choice?: string, pitch?: string) => setState((current) => simulateStep(current, choice, pitch));
  const changePitcher = (role: "구원투수" | "마무리투수") => {
    const nextPitcherId = Number(bullpenPitcherId);
    if (!nextPitcherId || !playerTeamId || !playerTeamFielding) return;
    setState((current) => {
      const currentMatch = current.match;
      if (!currentMatch || currentMatch.finished) return current;
      const previousPitcherId = currentMatch.pitcher[playerTeamId];
      const previousPitcher = current.players.find((player) => player.id === previousPitcherId);
      const nextPitcher = current.players.find((player) => player.id === nextPitcherId);
      if (!nextPitcher || nextPitcher.teamId !== playerTeamId || nextPitcher.pitches.length === 0) return current;
      const text = `${role} 등판: ${previousPitcher?.name ?? "현재 투수"} OUT, ${nextPitcher.name} IN. 지금부터 마운드를 맡습니다.`;
      const line = { id: `${Date.now()}-${Math.random()}`, text };
      return {
        ...current,
        match: {
          ...currentMatch,
          pitcher: { ...currentMatch.pitcher, [playerTeamId]: nextPitcher.id },
          waitingFor: null,
          waitingPitcherId: undefined,
          broadcast: [...currentMatch.broadcast, line],
          rulings: [...currentMatch.rulings, { ...line, id: `${line.id}-ruling` }]
        }
      };
    });
    setBullpenPitcherId("");
  };
  const queueSubstitution = (outPlayerId: number, inPlayerId: number) => setState((current) => {
    const currentMatch = current.match;
    if (!currentMatch || currentMatch.finished) return current;
    const outPlayer = current.players.find((player) => player.id === outPlayerId);
    const inPlayer = current.players.find((player) => player.id === inPlayerId);
    if (!outPlayer || !inPlayer || outPlayer.teamId !== inPlayer.teamId) return current;
    const alreadyPending = currentMatch.pendingSubstitutions ?? [];
    const nextPending: PendingSubstitution[] = [
      ...alreadyPending.filter((sub) => sub.outPlayerId !== outPlayerId && sub.inPlayerId !== inPlayerId),
      {
        id: `${Date.now()}-${outPlayerId}-${inPlayerId}`,
        teamId: outPlayer.teamId,
        outPlayerId,
        inPlayerId,
        requestedInning: currentMatch.inning,
        requestedTop: currentMatch.top
      }
    ];
    const text = `선수교체 예약: ${outPlayer.name} OUT, ${inPlayer.name} IN. 현재 이닝 종료 후 반영됩니다.`;
    const line = { id: `${Date.now()}-${Math.random()}`, text };
    return {
      ...current,
      match: {
        ...currentMatch,
        pendingSubstitutions: nextPending,
        broadcast: [...currentMatch.broadcast, line],
        rulings: [...currentMatch.rulings, { ...line, id: `${line.id}-ruling` }]
      }
    };
  });
  useEffect(() => {
    if (isRunning && !match.waitingFor && !match.finished) {
      const timer = window.setTimeout(() => runStep(), delay);
      return () => window.clearTimeout(timer);
    }
  });
  return (
    <div className="gameLayout">
      <Panel title="라이브 필드" className="fieldPanel">
        <GameCallout state={state} batterId={currentBatterId} pitcherId={currentPitcherId} order={currentOrder + 1} />
        <BaseballField state={state} />
        <div className="duelDeck">
          <div className="duelSide pitcherSide">{state.players.find((player) => player.id === currentPitcherId) && <LiveDuelCard player={state.players.find((player) => player.id === currentPitcherId)!} label="현재 투수" mode="pitcher" effect={match.inningEffects[currentPitcherId]} />}</div>
          <div className="duelCenter">
            {match.waitingFor ? <div className="kimSpotlight">
              <h3>{match.waitingFor === "kimBat" ? "김철민 타석" : "김철민 투구"}</h3>
              <p>{match.waitingFor === "kimBat" ? `${waitingBatter?.name}이 타석에 들어섰습니다. 어떤 접근을 할까요?` : `${waitingPitcher?.name}이 마운드에서 사인을 봅니다. 구종을 선택하세요.`}</p>
              {match.waitingFor === "kimBat" && <div className="choiceGrid kimChoiceGrid">{waitingBatChoices.map((choice, index) => <KimBatChoiceCard key={choice.id} choice={choice} index={index} onSelect={() => runStep(choice.id)} />)}</div>}
              {match.waitingFor === "kimPitch" && waitingPitcher && <div className="choiceGrid kimChoiceGrid">{waitingPitcher.pitches.map((pitch, index) => <KimPitchChoiceCard key={pitch} pitcher={waitingPitcher} pitch={pitch} index={index} onSelect={() => runStep(undefined, pitch)} />)}</div>}
            </div> : <div className="duelEmpty">자동 진행 중</div>}
          </div>
          <div className="duelSide batterSide">{state.players.find((player) => player.id === currentBatterId) && <LiveDuelCard player={state.players.find((player) => player.id === currentBatterId)!} label={`${currentOrder + 1}번 타자`} mode="batter" effect={match.inningEffects[currentBatterId]} />}</div>
        </div>
        {match.coldGame && <p className="danger">콜드게임 선언</p>}
      </Panel>
      <Panel title="중계 로그" className="broadcastPanel">
        <div className="sideControlBox">
          <GameControls isRunning={isRunning} speed={speed} onToggle={() => setIsRunning((value) => !value)} onSpeed={setSpeed} onStep={() => runStep()} disabled={!!match.waitingFor || match.finished} />
          <div className="bullpenBox">
            <div>
              <strong>불펜</strong>
              <span>{playerTeamFielding ? "수비 중 투수교체 가능" : "우리 팀 수비 때 교체 가능"}</span>
            </div>
            <select value={bullpenPitcherId} onChange={(event) => setBullpenPitcherId(event.target.value)} disabled={!playerTeamFielding || !!match.waitingFor || match.finished}>
              <option value="">투수 선택</option>
              {bullpenPitchers.map((player) => <option key={player.id} value={player.id}>#{player.number} {player.name} · 체력 {Math.round(player.stamina)}/{player.maxStamina} · OVR {playerOvr(player, "투수").toFixed(1)}</option>)}
            </select>
            <div className="bullpenActions">
              <button disabled={!bullpenPitcherId || !playerTeamFielding || !!match.waitingFor || match.finished} onClick={() => changePitcher("구원투수")}>구원투수 투입</button>
              <button disabled={!bullpenPitcherId || !playerTeamFielding || !!match.waitingFor || match.finished} onClick={() => changePitcher("마무리투수")}>마무리 투입</button>
            </div>
          </div>
          <button className="lineupModalButton" onClick={() => setLineupOpen(true)}>라인업 / 선수교체{(match.pendingSubstitutions?.length ?? 0) ? ` (${match.pendingSubstitutions?.length})` : ""}</button>
          {(match.pendingSubstitutions?.length ?? 0) > 0 && <div className="pendingSubBadge">교체 예약 {match.pendingSubstitutions?.length}건 · 이닝 종료 후 적용</div>}
        </div>
        <LogList rows={match.broadcast.map((item) => item.text).slice(-22).reverse()} />
      </Panel>
      <Panel title="판정 로그" className="rulingPanel" wide><details open><summary>수치 판정</summary><LogList rows={match.rulings.map((item) => item.text).slice(-18).reverse()} /></details></Panel>
      {lineupOpen && <MatchLineupModal state={state} onClose={() => setLineupOpen(false)} onSubstitute={queueSubstitution} />}
    </div>
  );
}

function GameControls({ isRunning, speed, onToggle, onSpeed, onStep, disabled }: {
  isRunning: boolean;
  speed: 0.5 | 1 | 2 | 4;
  onToggle: () => void;
  onSpeed: (speed: 0.5 | 1 | 2 | 4) => void;
  onStep: () => void;
  disabled: boolean;
}) {
  return (
    <div className="gameControls">
      <button className={isRunning ? "active" : ""} onClick={onToggle}>{isRunning ? "일시정지" : "자동 진행"}</button>
      {[0.5, 1, 2, 4].map((value) => <button key={value} className={speed === value ? "active" : ""} onClick={() => onSpeed(value as 0.5 | 1 | 2 | 4)}>{value}x</button>)}
      <button onClick={onStep} disabled={disabled}>한 타석 진행</button>
    </div>
  );
}

function pitchSpeedRange(pitcher: Player, pitchName: string) {
  const pitch = PITCH_TABLE[pitchName];
  if (!pitch) return "구속 정보 없음";
  const velocity = effectiveStat(pitcher, pitcher.fieldingStats.velocity);
  return `${Math.round(velocity * pitch.speed[0])}-${Math.round(velocity * pitch.speed[1])}km/h`;
}

function KimBatChoiceCard({ choice, index, onSelect }: { choice: BattingStrategyChoice; index: number; onSelect: () => void }) {
  return (
    <button className={`kimChoiceCard batChoice choice-${choice.id}`} style={{ animationDelay: `${index * 70}ms` }} onClick={onSelect}>
      <span className="choiceNo">{String(index + 1).padStart(2, "0")}</span>
      <strong>{choice.label}</strong>
      <small>체력 -{choice.stamina} · {batChoiceEffect(choice)}</small>
      <i aria-hidden="true" />
    </button>
  );
}

function KimPitchChoiceCard({ pitcher, pitch, index, onSelect }: { pitcher: Player; pitch: string; index: number; onSelect: () => void }) {
  const pitchInfo = PITCH_TABLE[pitch];
  return (
    <button className="kimChoiceCard pitchChoice" style={{ animationDelay: `${index * 70}ms` }} onClick={onSelect}>
      <span className="choiceNo">{String(index + 1).padStart(2, "0")}</span>
      <strong>{pitch}</strong>
      <small>{pitchInfo ? `체력 -${pitchInfo.stamina} · ${pitchInfo.description.replace(/,?\s*체력\s*-\d+(\.\d+)?/, "")}` : "구종 정보 없음"}</small>
      <i aria-hidden="true" />
    </button>
  );
}

function batChoiceEffect(choice: BattingStrategyChoice) {
  const contact = Number(choice.contact);
  const discipline = Number(choice.discipline);
  const power = Number(choice.power);
  const speed = Number(choice.speed);
  const effects = [
    contact !== 1 ? `컨택 ${contact > 1 ? "+" : ""}${Math.round((contact - 1) * 100)}%` : "",
    discipline !== 1 ? `선구 ${discipline > 1 ? "+" : ""}${Math.round((discipline - 1) * 100)}%` : "",
    power !== 1 ? `장타 ${power > 1 ? "+" : ""}${Math.round((power - 1) * 100)}%` : "",
    speed !== 1 ? `속도 ${speed > 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%` : "",
    choice.distance ? `비거리 ${choice.distance > 0 ? "+" : ""}${choice.distance}m` : ""
  ].filter(Boolean);
  return effects.join(" · ");
}

function MatchupCards({ state, batterId, pitcherId, order }: { state: AppState; batterId?: number; pitcherId?: number; order: number }) {
  const match = state.match!;
  const batter = state.players.find((player) => player.id === batterId);
  const pitcher = state.players.find((player) => player.id === pitcherId);
  return (
    <div className="matchupCards">
      {batter && <LiveDuelCard player={batter} label={`${order}번 타자`} mode="batter" effect={match.inningEffects[batter.id]} />}
      <div className="versusMark">VS</div>
      {pitcher && <LiveDuelCard player={pitcher} label="마운드" mode="pitcher" effect={match.inningEffects[pitcher.id]} />}
    </div>
  );
}

function LiveDuelCard({ player, label, mode, effect }: { player: Player; label: string; mode: "batter" | "pitcher"; effect?: { type: "투지" | "태업"; until: number } }) {
  const ovr = Math.round(playerOvr(player));
  const tier = cardTier(ovr);
  const rows = liveStatRows(player, mode, effect);
  return (
    <article className={`liveDuelCard ${mode} cardTier-${tier.key}`} key={`${player.id}-${player.stamina}-${player.condition}-${effect?.type ?? "normal"}`}>
      <header>
        <span>{label}</span>
        <strong>#{player.number} {player.name}</strong>
        <em>{player.primaryPosition} · OVR {ovr}</em>
      </header>
      <div className="liveCardBody">
        <div className="miniPortrait"><div className="playerSilhouette" /></div>
        <div className="liveVitals">
          <Bar label="체력" value={player.stamina} max={player.maxStamina} />
          <Bar label="컨디션" value={player.condition} max={100} />
          <div className="liveBadges"><span>{tier.label}</span>{effect && <span>{effect.type} {effect.until}회까지</span>}</div>
        </div>
      </div>
      <div className="liveStats">
        {rows.map((row) => <LiveStat key={row.label} label={row.label} base={row.base} current={row.current} />)}
      </div>
    </article>
  );
}

function liveStatRows(player: Player, mode: "batter" | "pitcher", effect?: { type: "투지" | "태업"; until: number }) {
  const rows = mode === "pitcher" ? [
    ["제구", player.fieldingStats.control],
    ["구속", player.fieldingStats.velocity],
    ["구위", player.positionStats.stuff],
    ["주의", player.fieldingStats.awareness]
  ] : [
    ["컨택", player.battingStats.contact],
    ["선구", player.battingStats.discipline],
    ["장타", player.battingStats.power],
    ["속도", player.battingStats.speed]
  ];
  return rows.map(([label, base]) => ({ label: String(label), base: Number(base), current: effectiveStat(player, Number(base), effect) }));
}

function LiveStat({ label, base, current }: { label: string; base: number; current: number }) {
  const delta = Math.round(current - base);
  const tone = delta > 0 ? "up" : delta < 0 ? "down" : "same";
  return (
    <div className={`liveStat ${tone}`}>
      <span>{label}</span>
      <strong>{Math.round(current)}</strong>
      <small>{delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}`}</small>
      <i><b style={{ width: `${clamp(current, 0, 100)}%` }} /></i>
    </div>
  );
}

function MatchLineupModal({ state, onClose, onSubstitute }: { state: AppState; onClose: () => void; onSubstitute: (outPlayerId: number, inPlayerId: number) => void }) {
  const match = state.match!;
  const away = state.teams.find((team) => team.id === match.awayTeamId)!;
  const home = state.teams.find((team) => team.id === match.homeTeamId)!;
  const playerTeamId = state.teams.find((team) => team.isPlayer)?.id;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="lineupModal">
        <header className="modalHeader">
          <div>
            <span>LIVE LINEUP</span>
            <h2>양 팀 라인업 · 현재 실효 스탯</h2>
          </div>
          <button onClick={onClose}>닫기</button>
        </header>
        <div className="lineupModalGrid">
          <LineupColumn state={state} teamId={away.id} title={away.name} canSubstitute={away.id === playerTeamId} onSubstitute={onSubstitute} />
          <LineupColumn state={state} teamId={home.id} title={home.name} canSubstitute={home.id === playerTeamId} onSubstitute={onSubstitute} />
        </div>
      </div>
    </div>
  );
}

function LineupColumn({ state, teamId, title, canSubstitute, onSubstitute }: { state: AppState; teamId: number; title: string; canSubstitute: boolean; onSubstitute: (outPlayerId: number, inPlayerId: number) => void }) {
  const match = state.match!;
  const pitcherId = match.pitcher[teamId];
  const ids = match.lineup[teamId] ?? [];
  const pending = match.pendingSubstitutions ?? [];
  const [subTargets, setSubTargets] = useState<Record<number, string>>({});
  const absentIds = new Set((state.dailyAbsences ?? []).filter((absence) => absence.dayIndex === state.dayIndex).map((absence) => absence.playerId));
  const reservedInIds = new Set(pending.filter((sub) => sub.teamId === teamId).map((sub) => sub.inPlayerId));
  const bench = state.players.filter((player) => player.teamId === teamId && !player.injured && !absentIds.has(player.id) && !ids.includes(player.id) && !reservedInIds.has(player.id));
  const pendingForTeam = pending.filter((sub) => sub.teamId === teamId);
  return (
    <section className="lineupColumnLive">
      <h3>{title}</h3>
      <div className="lineupPitcherRow">선발 투수: <strong>{playerName(state, pitcherId)}</strong></div>
      {canSubstitute && <div className="substitutionNotice">선수교체 선언 시 현재 이닝 종료 후 반영됩니다.</div>}
      {canSubstitute && pendingForTeam.length > 0 && <div className="pendingSubList">
        {pendingForTeam.map((sub) => <span key={sub.id}>{playerName(state, sub.outPlayerId)} → {playerName(state, sub.inPlayerId)}</span>)}
      </div>}
      <div className="lineupRowsLive">
        {ids.map((id, index) => {
          const player = state.players.find((item) => item.id === id);
          if (!player) return null;
          const effect = match.inningEffects[player.id];
          const contact = effectiveStat(player, player.battingStats.contact, effect);
          const power = effectiveStat(player, player.battingStats.power, effect);
          const control = effectiveStat(player, player.fieldingStats.control, effect);
          const velocity = effectiveStat(player, player.fieldingStats.velocity, effect);
          const pendingSub = pendingForTeam.find((sub) => sub.outPlayerId === id);
          const isPitcherSlot = id === pitcherId;
          const candidates = isPitcherSlot ? bench.filter((candidate) => candidate.pitches.length > 0) : bench;
          const selected = subTargets[id] ?? "";
          return (
            <div className={`lineupRowLive ${id === pitcherId ? "pitcher" : ""}`} key={id}>
              <strong>{index + 1}</strong>
              <div>
                <b>#{player.number} {player.name}</b>
                <span>{player.primaryPosition} · 체력 {Math.round(player.stamina)}/{player.maxStamina} · 컨디션 {Math.round(player.condition)}</span>
              </div>
              <small>컨 {Math.round(contact)} · 장 {Math.round(power)} · 제 {Math.round(control)} · 구 {Math.round(velocity)}</small>
              {canSubstitute && <div className="subControl">
                {pendingSub ? <span className="pendingInline">{playerName(state, pendingSub.inPlayerId)} IN 예약</span> : <>
                  <select value={selected} onChange={(event) => setSubTargets((current) => ({ ...current, [id]: event.target.value }))}>
                    <option value="">{isPitcherSlot ? "교체 투수 선택" : "벤치 선수 선택"}</option>
                    {candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>#{candidate.number} {candidate.name} · {candidate.primaryPosition}</option>)}
                  </select>
                  <button disabled={!selected} onClick={() => selected && onSubstitute(id, Number(selected))}>교체 예약</button>
                </>}
              </div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PitchStatus({ state, batterId, pitcherId, order }: { state: AppState; batterId?: number; pitcherId?: number; order: number }) {
  const match = state.match!;
  const pitcher = state.players.find((player) => player.id === pitcherId);
  const batter = state.players.find((player) => player.id === batterId);
  const last = match.lastPlay;
  const count = last?.isAtBatOver ? match.count : last?.count ?? match.count;
  return (
    <div className="pitchStatus">
      <div className="countBoard">
        <span>B</span><strong>{count.balls}</strong>
        <span>S</span><strong>{count.strikes}</strong>
        <span>O</span><strong>{match.outs}</strong>
      </div>
      <div className="duelNames">
        <span>마운드</span><strong>{pitcher?.name ?? "투수 대기"}</strong>
        <span>타석</span><strong>{order}번 {batter?.name ?? "타자 대기"}</strong>
      </div>
      <div className="lastPitchCard">
        <span>이번 공</span>
        <strong>{last ? normalizeResult(last.result, last.kind) : "READY"}</strong>
        <p>{last ? `${last.pitch} · ${Math.round(last.speedKmh ?? 0)}km/h · ${normalizeDirection(last.direction)} · ${Math.round(last.distance)}m · ${last.kind}` : "첫 공을 기다리는 중입니다."}</p>
      </div>
    </div>
  );
}

function GameCallout({ state, batterId, pitcherId, order }: { state: AppState; batterId?: number; pitcherId?: number; order: number }) {
  const match = state.match!;
  const attackTeamId = match.top ? match.awayTeamId : match.homeTeamId;
  const fieldingTeamId = match.top ? match.homeTeamId : match.awayTeamId;
  const attackTeam = state.teams.find((team) => team.id === attackTeamId);
  const fieldingTeam = state.teams.find((team) => team.id === fieldingTeamId);
  const pitcher = state.players.find((player) => player.id === pitcherId);
  const batter = state.players.find((player) => player.id === batterId);
  const last = match.lastPlay;
  const result = last ? normalizeResult(last.result, last.kind) : "READY";
  const tone = resultTone(result);
  const key = `${match.inning}-${match.top}-${match.outs}-${match.broadcast.length}-${last?.result ?? "ready"}`;
  return (
    <div className={`gameCallout tone-${tone}`} key={key}>
      <div className="scoreCallout">
        <div className="teamScore defense">
          <span>수비</span>
          <strong>{fieldingTeam?.name}</strong>
          <b>{fieldingTeam ? match.score[fieldingTeam.id] ?? 0 : 0}</b>
        </div>
        <div className="calloutCenter">
          <div className="inningBanner"><strong>{match.inning}회 {match.top ? "초" : "말"} · {attackTeam?.name} 공격</strong><span>{match.outs}사 · 주자 {baseText(match.bases)}</span></div>
          <div className="duelBanner">
            <span>마운드</span>
            <strong>{pitcher?.name ?? "투수 대기"}</strong>
            <em>VS</em>
            <strong>{order}번 {batter?.name ?? "타자 대기"}</strong>
            <span>타석</span>
          </div>
          <div className="resultBanner">{result}</div>
          <p>{last ? `${last.pitch} · ${Math.round(last.speedKmh ?? 0)}km/h · ${normalizeDirection(last.direction)} · ${Math.round(last.distance)}m · ${last.kind}` : "투수와 타자가 승부를 준비합니다."}</p>
        </div>
        <div className="teamScore offense">
          <span>공격</span>
          <strong>{attackTeam?.name}</strong>
          <b>{attackTeam ? match.score[attackTeam.id] ?? 0 : 0}</b>
        </div>
      </div>
    </div>
  );
}

function normalizeDirection(value?: string) {
  if (!value) return "중앙";
  if (value.includes("좌") || value.includes("醫")) return "좌측";
  if (value.includes("우") || value.includes("곗")) return "우측";
  if (value.includes("파") || value.includes("뚯")) return "파울";
  return "중앙";
}

function normalizeResult(result?: string, kind?: string) {
  const text = `${result ?? ""} ${kind ?? ""}`;
  if (text.includes("홈") || text.includes("덈")) return "HOME RUN";
  if (text.includes("데드") || text.includes("곕")) return "DEAD BALL";
  if ((text.includes("아웃") || text.includes("꾩")) && (text.includes("헛스윙") || text.includes("헛"))) return "STRIKE OUT";
  if (text.includes("볼넷") || text.includes("蹂")) return "BALL";
  if (text.includes("볼")) return "BALL";
  if (text.includes("스트라이크") || text.includes("헛스윙")) return "STRIKE";
  if (text.includes("파울") || text.includes("뚯")) return "FOUL";
  if (text.includes("헛") || text.includes("쏆")) return "STRIKE OUT";
  if (text.includes("안타") || text.includes("덊")) return "HIT";
  if (text.includes("2루") || text.includes("2")) return "DOUBLE";
  if (text.includes("실책")) return "ERROR";
  if (text.includes("아웃") || text.includes("꾩")) return "OUT";
  return "PLAY";
}

function resultTone(result: string) {
  if (result === "HOME RUN") return "homer";
  if (result === "HIT" || result === "DOUBLE") return "hit";
  if (result === "FOUL" || result === "BALL" || result === "STRIKE") return "neutral";
  if (result === "DEAD BALL" || result === "ERROR") return "warn";
  if (result === "OUT" || result === "STRIKE OUT") return "out";
  return "ready";
}

function BaseballField({ state }: { state: AppState }) {
  const match = state.match!;
  const last = match.lastPlay;
  const angle = last?.direction === "좌측" ? -35 : last?.direction === "우측" ? 35 : last?.direction === "파울" ? 62 : 0;
  const length = clamp((last?.distance ?? 0) * 1.2, 20, 138);
  const battingTeamId = match.top ? match.awayTeamId : match.homeTeamId;
  const fieldingTeamId = match.top ? match.homeTeamId : match.awayTeamId;
  const fielders = (match.lineup[fieldingTeamId] ?? []).map((id) => state.players.find((player) => player.id === id)).filter(Boolean) as Player[];
  const battingLineup = match.lineup[battingTeamId] ?? [];
  const batterId = battingLineup[(match.orderIndex[battingTeamId] ?? 0) % Math.max(1, battingLineup.length)];
  const batter = state.players.find((player) => player.id === batterId);
  const pitcherId = match.pitcher[fieldingTeamId];
  const defenseSlots = buildDefenseSlots(fielders, pitcherId);
  const pitcher = state.players.find((player) => player.id === pitcherId);
  const baseLabels = match.bases.map((runnerId) => runnerId ? playerName(state, runnerId) : "");
  return (
    <div className="stadium">
      <div className="outfield" />
      <div className="infield" />
      <div className="base home">H</div>
      <div className={`base first ${match.bases[0] ? "occupied" : ""}`}>1<span>{baseLabels[0]}</span></div>
      <div className={`base second ${match.bases[1] ? "occupied" : ""}`}>2<span>{baseLabels[1]}</span></div>
      <div className={`base third ${match.bases[2] ? "occupied" : ""}`}>3<span>{baseLabels[2]}</span></div>
      {pitcher && <FieldPlayerMarker className="mound" label="P" player={pitcher} role="투수" mode="pitcher" effect={match.inningEffects[pitcher.id]} />}
      {batter && <FieldPlayerMarker className="batterBox" label="타자" player={batter} role={`${((match.orderIndex[battingTeamId] ?? 0) % Math.max(1, battingLineup.length)) + 1}번 타자`} mode="batter" effect={match.inningEffects[batter.id]} />}
      <CountOverlay match={match} />
      {defenseSlots.map((slot) => (
        slot.player ? <FieldPlayerMarker key={slot.key} className={`fieldPlayer ${slot.key}`} label={slot.label} player={slot.player} role={slot.label} mode={slot.key === "pitcher" ? "pitcher" : "fielder"} effect={match.inningEffects[slot.player.id]} /> : null
      ))}
      {last && <div className={`ballPath ${last.result === "홈런" ? "homer" : ""}`} style={{ transform: `translateX(-50%) rotate(${angle}deg)`, height: `${length}px` }}><span /></div>}
      <div className="fieldLabel left">LF</div>
      <div className="fieldLabel center">CF</div>
      <div className="fieldLabel right">RF</div>
    </div>
  );
}

function CountOverlay({ match }: { match: MatchState }) {
  const last = match.lastPlay;
  const count = last?.isAtBatOver ? match.count : last?.count ?? match.count;
  return (
    <div className="fieldCountOverlay">
      <span>B</span><strong>{count.balls}</strong>
      <span>S</span><strong>{count.strikes}</strong>
      <span>O</span><strong>{match.outs}</strong>
    </div>
  );
}

function FieldPlayerMarker({ className, label, player, role, mode, effect }: { className: string; label: string; player: Player; role: string; mode: "batter" | "pitcher" | "fielder"; effect?: { type: "투지" | "태업"; until: number } }) {
  return (
    <div className={className}>
      <strong>{label}</strong>
      <span>{player.name}</span>
      <FieldTooltipCard player={player} role={role} mode={mode} effect={effect} />
    </div>
  );
}

function FieldTooltipCard({ player, role, mode, effect }: { player: Player; role: string; mode: "batter" | "pitcher" | "fielder"; effect?: { type: "투지" | "태업"; until: number } }) {
  const statMode = mode === "pitcher" ? "pitcher" : "batter";
  const rows = mode === "fielder" ? [
    ["제구", player.fieldingStats.control],
    ["구속", player.fieldingStats.velocity],
    ["주의", player.fieldingStats.awareness],
    ["범위", player.positionStats.range || player.positionStats.jump || player.positionStats.lead]
  ].map(([label, base]) => ({ label: String(label), base: Number(base), current: effectiveStat(player, Number(base), effect) })) : liveStatRows(player, statMode, effect);
  return (
    <div className={`fieldTooltip ${mode}`}>
      <header>
        <span>{role}</span>
        <strong>#{player.number} {player.name}</strong>
        <em>{player.primaryPosition} · OVR {playerOvr(player).toFixed(1)}</em>
      </header>
      <div className="tooltipVitals">
        <Bar label="체력" value={player.stamina} max={player.maxStamina} />
        <Bar label="컨디션" value={player.condition} max={100} />
      </div>
      <div className="tooltipStats">
        {rows.map((row) => <LiveStat key={row.label} label={row.label} base={row.base} current={row.current} />)}
      </div>
      <p>{effect ? `${effect.type} 적용 중 · ${effect.until}회까지` : "현재 체력/컨디션 반영"}</p>
    </div>
  );
}

function baseText(bases: Array<number | null>) {
  const labels = ["1루", "2루", "3루"];
  const occupied = bases.map((runner, index) => runner ? labels[index] : "").filter(Boolean);
  return occupied.length ? occupied.join(", ") : "없음";
}

function playerName(state: AppState, id: number) {
  return state.players.find((player) => player.id === id)?.name ?? "알 수 없음";
}

function shortMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(abs >= 1000000000 ? 1 : 2).replace(/\.0+$/, "")}억`;
  if (abs >= 10000) return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
  return money(value);
}

function PostGame({ state, onNext }: { state: AppState; onNext: () => void }) {
  const summary = state.postGame!;
  const home = state.teams.find((team) => team.id === summary.homeTeamId)!;
  const away = state.teams.find((team) => team.id === summary.awayTeamId)!;
  return (
    <Panel title="경기 후 정산" wide>
      <div className="scoreLarge">{away.name} {summary.awayScore} : {summary.homeScore} {home.name}</div>
      <p className={summary.result.includes("패") ? "danger" : "next"}>결과: {summary.result}{summary.coldGame ? " · 콜드게임" : ""}</p>
      <LogList rows={summary.changes} />
      <button className="primary" onClick={onNext}>다음 일정</button>
    </Panel>
  );
}

function SeasonEnd({ state, onRestart }: { state: AppState; onRestart: () => void }) {
  return <Panel title="2주 종료 평가" wide><LogList rows={state.activityLog.slice(0, 8)} /><button className="primary" onClick={onRestart}>다시 시작</button></Panel>;
}

function GameOver({ reason, onRestart }: { reason: string; onRestart: () => void }) {
  return <Panel title="게임오버"><p className="danger">{reason}</p><button className="primary" onClick={onRestart}>다시 시작</button></Panel>;
}

function LogList({ rows }: { rows: string[] }) {
  return <ul className="logList">{rows.length ? rows.map((row, index) => <li className={row.includes("[김철민 개입]") ? "kimLog" : ""} key={`${row}-${index}`}>{row}</li>) : <li>로그 없음</li>}</ul>;
}

createRoot(document.getElementById("root")!).render(<App />);
