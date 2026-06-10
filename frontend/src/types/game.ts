export type Position = "투수" | "포수" | "내야수" | "외야수" | "유틸" | "지명타자" | "1루수" | "2루수" | "3루수" | "유격수" | "좌익수" | "중견수" | "우익수";
export type Phase = "loading" | "dashboard" | "miniGame" | "evening" | "teamManagement" | "roster" | "preGame" | "game" | "postGame" | "gameOver" | "seasonEnd";
export type KimRole = "지명타자" | "야수" | "루수" | "포수" | "선발투수" | "구원투수" | "마무리투수" | "투타 겸업" | "벤치" | "결장";

export interface PitchDefinition {
  speed: [number, number];
  contactMod: number;
  disciplineMod?: number;
  controlMod: number;
  stamina: number;
  distanceMod?: number;
  grounder?: number;
  groundDistanceMod?: number;
  description: string;
}

export interface BattingStrategyDefinition {
  id: string;
  label: string;
  stamina: number;
  contact: number;
  power: number;
  discipline: number;
  speed: number;
  distance: number;
  description: string;
}

export interface Team {
  id: number;
  accountId?: number | null;
  name: string;
  isPlayer: boolean;
  funds: number;
  recentMood: number;
  bond: number;
  trust: number;
  fairness: number;
  wins: number;
  losses: number;
  draws: number;
  meta: Record<string, unknown>;
}

export interface Player {
  id: number;
  accountId?: number | null;
  teamId: number;
  number: number;
  name: string;
  age: number;
  job: string;
  battingRole: string;
  positions: Position[];
  primaryPosition: Position;
  battingStats: { contact: number; discipline: number; power: number; speed: number };
  fieldingStats: { control: number; velocity: number; awareness: number };
  positionStats: { stuff: number; range: number; jump: number; lead: number };
  pitches: string[];
  battingStrategies: string[];
  maxStamina: number;
  stamina: number;
  condition: number;
  attendance: number;
  duesTrait: number;
  sponsorTrait: number;
  traits: string[];
  recentGames: string[];
  consecutiveStarts: number;
  missedGames: number;
  consideringLeave: boolean;
  injured: boolean;
  meta: Record<string, unknown>;
}

export interface SeasonRule {
  entryFee: number;
  championReward: number;
  runnerUpReward: number;
  thirdReward: number;
  weeksInDemo: number;
  maxGamesInDemo: number;
}

export interface LogLine {
  id: string;
  text: string;
}

export interface PendingSubstitution {
  id: string;
  teamId: number;
  outPlayerId: number;
  inPlayerId: number;
  requestedInning: number;
  requestedTop: boolean;
}

export interface MatchState {
  homeTeamId: number;
  awayTeamId: number;
  inning: number;
  top: boolean;
  outs: number;
  bases: Array<number | null>;
  score: Record<number, number>;
  lineup: Record<number, number[]>;
  pitcher: Record<number, number>;
  pendingSubstitutions?: PendingSubstitution[];
  orderIndex: Record<number, number>;
  count: { balls: number; strikes: number };
  broadcast: LogLine[];
  rulings: LogLine[];
  waitingFor: null | "kimBat" | "kimPitch";
  waitingBatterId?: number;
  waitingPitcherId?: number;
  coldGame: boolean;
  finished: boolean;
  interventionNote?: string;
  inningEffects: Record<number, { type: "투지" | "태업"; until: number }>;
  lastPlay?: {
    batterId: number;
    pitcherId: number;
    pitch: string;
    speedKmh: number;
    direction: "중앙" | "좌측" | "우측" | "파울";
    distance: number;
    kind: string;
    result: string;
    defenderId?: number;
    kimInvolved: boolean;
    count: { balls: number; strikes: number };
    isAtBatOver: boolean;
  };
}

export interface PostGameSummary {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  result: "승" | "패" | "무" | "콜드승" | "콜드패";
  coldGame: boolean;
  changes: string[];
}

export interface FinanceEvent {
  id: string;
  playerId: number;
  playerName: string;
  kind: "dues" | "sponsor";
  paid: boolean;
  amount: number;
  chance: number;
  message: string;
}

export interface DailyAbsence {
  dayIndex: number;
  playerId: number;
  playerName: string;
  reason: string;
}

export interface AppState {
  phase: Phase;
  dataOwnershipVersion?: number;
  seed: number;
  dayIndex: number;
  gamesPlayed: number;
  teams: Team[];
  players: Player[];
  seasonRule: SeasonRule;
  pitchTable?: Record<string, PitchDefinition>;
  battingStrategyTable?: Record<string, BattingStrategyDefinition>;
  kimRole: KimRole;
  selectedEntry: number[];
  selectedPitcherId?: number;
  selectedDh: boolean;
  currentOpponentId?: number;
  match?: MatchState;
  postGame?: PostGameSummary;
  activityLog: string[];
  financeEvents?: FinanceEvent[];
  dailyAbsences?: DailyAbsence[];
  eveningHours: number;
  restBonus: number;
  nightAction?: "none" | "training" | "rest" | "teamTraining" | "party" | "game";
  nightTrainingCount?: number;
  nightConditionPenalty?: number;
  nightConditionSettled?: boolean;
  dayClicks?: number;
  gameOverReason?: string;
}
