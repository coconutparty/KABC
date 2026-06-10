import type { FinanceEvent, Player, Position, Team } from "../types/game";
import { JOB_DUES } from "./config";

export function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

export function money(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function weightedPick<T>(rng: () => number, rows: Array<[T, number]>): T {
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  let roll = rng() * total;
  for (const [value, weight] of rows) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return rows[rows.length - 1][0];
}

export function financialStability(funds: number) {
  if (funds <= 0) return 0;
  if (funds < 300000) return 15;
  if (funds < 700000) return 30;
  if (funds < 1500000) return 50;
  if (funds < 3000000) return 70;
  if (funds < 5000000) return 85;
  return 100;
}

export function teamMorale(team: Team) {
  return Math.round(
    team.recentMood * 0.3 +
      team.bond * 0.25 +
      team.trust * 0.2 +
      team.fairness * 0.15 +
      financialStability(team.funds) * 0.1
  );
}

export function duesTraitMod(value: number) {
  if (value < 20) return -10;
  if (value < 40) return -5;
  if (value < 60) return 0;
  if (value < 80) return 5;
  if (value < 90) return 10;
  return 15;
}

export function settleDues(players: Player[], rng: () => number) {
  let income = 0;
  const logs: string[] = [];
  const entries: FinanceEvent[] = [];
  const changedPlayers = players.map((player) => ({ ...player }));
  for (const player of changedPlayers) {
    const job = JOB_DUES[player.job] ?? { dueRate: 70, sponsorRate: 1 };
    const finalRate = job.dueRate + duesTraitMod(player.duesTrait);
    const paid = rng() * 100 < Math.min(100, finalRate);
    entries.push({
      id: `dues-${player.id}`,
      playerId: player.id,
      playerName: player.name,
      kind: "dues",
      paid,
      amount: paid ? 20000 : 0,
      chance: Math.min(100, finalRate),
      message: `${player.name} ${paid ? "정기회비 납부" : "정기회비 미납"}`
    });
    if (paid) {
      income += 20000;
      logs.push(`${player.name} 정기회비 납부: +20,000원`);
    } else {
      logs.push(`${player.name} 정기회비 미납`);
    }
    const sponsorChance = job.sponsorRate + Math.max(0, finalRate - 100);
    if (rng() * 100 < sponsorChance) {
      const amount = weightedPick(rng, [
        [100000, 100],
        [200000, 50],
        [300000, 25],
        [400000, 12],
        [500000, 6]
      ]);
      const finalAmount = player.job === "자영업자" ? Math.round(amount * 2.5) : amount;
      income += finalAmount;
      player.sponsorTrait = clamp(player.sponsorTrait + 1, 0, 100);
      entries.push({
        id: `sponsor-${player.id}-${finalAmount}`,
        playerId: player.id,
        playerName: player.name,
        kind: "sponsor",
        paid: true,
        amount: finalAmount,
        chance: sponsorChance,
        message: `${player.name} 찬조금 ${money(finalAmount)}`
      });
      logs.push(`${player.name} 찬조금 발생: +${finalAmount.toLocaleString("ko-KR")}원`);
    }
  }
  return { income, logs, players: changedPlayers, entries };
}

export function hasPosition(player: Player, position: Position) {
  if (player.primaryPosition === position || player.positions.includes(position)) return true;
  if (position === "투수") return player.pitches.length > 0 || player.positions.includes("투수");
  if (position === "포수") return player.positions.includes("포수") || player.primaryPosition === "포수";
  return false;
}

export function playerOvr(player: Player, role: Position = player.primaryPosition): number {
  const bat = player.battingStats;
  const field = player.fieldingStats;
  const pos = player.positionStats;
  if (role === "투수") return field.control * 0.3 + field.velocity * 0.25 + pos.stuff * 0.3 + field.awareness * 0.15;
  if (role === "포수") return field.awareness * 0.3 + field.control * 0.25 + field.velocity * 0.2 + bat.contact * 0.15 + bat.discipline * 0.1;
  if (role === "내야수" || role === "1루수" || role === "2루수" || role === "3루수" || role === "유격수") {
    return pos.range * 0.25 + field.control * 0.2 + field.awareness * 0.2 + bat.contact * 0.2 + bat.speed * 0.15;
  }
  if (role === "외야수" || role === "좌익수" || role === "중견수" || role === "우익수") {
    return pos.jump * 0.25 + field.velocity * 0.2 + field.awareness * 0.2 + bat.contact * 0.15 + bat.power * 0.1 + bat.speed * 0.1;
  }
  if (role === "지명타자") return bat.contact * 0.35 + bat.power * 0.35 + bat.discipline * 0.2 + bat.speed * 0.1;
  return (playerOvr(player, "내야수") + playerOvr(player, "외야수")) / 2;
}

export function tradeValue(player: Player) {
  const scarcity = player.primaryPosition === "투수" ? 8 : player.primaryPosition === "포수" ? 7 : player.primaryPosition === "유틸" ? 4 : player.primaryPosition === "내야수" ? 3 : player.primaryPosition === "외야수" ? 2 : 0;
  const ageGrowth = player.age < 30 ? 85 : player.age < 36 ? 70 : 45;
  return playerOvr(player) * 0.45 + player.attendance * 0.15 + player.duesTrait * 0.1 + player.sponsorTrait * 0.1 + ageGrowth * 0.1 + scarcity * 0.1;
}

export function effectiveStat(player: Player, stat: number, effect?: { type: "투지" | "태업"; until: number }) {
  const staminaFactor = player.stamina < 30 ? 0.85 : player.stamina < 50 ? 0.93 : 1;
  const conditionFactor = player.condition < 35 ? 0.88 : player.condition < 55 ? 0.95 : player.condition > 80 ? 1.05 : 1;
  const emotionFactor = effect?.type === "투지" ? 1.05 : effect?.type === "태업" ? 0.9 : 1;
  const ignorePenalty = effect?.type === "투지";
  return stat * emotionFactor * (ignorePenalty ? 1 : staminaFactor * conditionFactor);
}
