import { DAYS } from "./config";

export function dayName(dayIndex: number) {
  return DAYS[dayIndex % 7];
}

export function weekNumber(dayIndex: number) {
  return Math.floor(dayIndex / 7) + 1;
}

export function hasDayMiniGame(dayIndex: number) {
  return dayIndex % 7 <= 4;
}

export function isGameDay(dayIndex: number) {
  return dayIndex % 7 >= 3;
}

export function isWeekend(dayIndex: number) {
  return dayIndex % 7 >= 5;
}

export function nextScheduleText(dayIndex: number) {
  const day = dayName(dayIndex);
  if (day === "월" || day === "화") return "낮 주간 일정 미니게임 → 밤 개인 일정";
  if (day === "수") return "낮 주간 일정 미니게임 → 밤 팀 훈련/로스터/회비";
  if (day === "목") return "낮 주간 일정 미니게임 → 밤 평일 시리즈 1차전";
  if (day === "금") return "낮 주간 일정 미니게임 → 밤 평일 시리즈 2차전";
  if (day === "토") return "낮 주말 시리즈 1차전 → 밤 개인 일정/회식";
  return "낮 주말 시리즈 2차전 → 밤 개인 일정/회식";
}

export function gameLabel(dayIndex: number) {
  const day = dayName(dayIndex);
  if (day === "목") return "평일 시리즈 1차전";
  if (day === "금") return "평일 시리즈 2차전";
  if (day === "토") return "주말 시리즈 1차전";
  return "주말 시리즈 2차전";
}
