import type { AppState, Player, SeasonRule, Team } from "../types/game";

export interface DemoAccount {
  username: string;
  displayName: string;
  token: string;
}

interface ApiState {
  teams: Team[];
  players: Player[];
  seasonRule: SeasonRule | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

function authHeaders(account: DemoAccount) {
  return { Authorization: `Bearer ${account.token}` };
}

export async function fetchInitialData(): Promise<ApiState> {
  const response = await fetch(apiUrl("/api/state/"));
  if (!response.ok) throw new Error("초기 데이터를 불러오지 못했습니다.");
  return response.json();
}

export async function registerAccount(username: string, displayName: string, password: string): Promise<DemoAccount> {
  const response = await fetch(apiUrl("/api/register/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName, password })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "회원가입 실패");
  return payload.account;
}

export async function loginAccount(username: string, password: string): Promise<DemoAccount> {
  const response = await fetch(apiUrl("/api/login/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "로그인 실패");
  return payload.account;
}

export async function fetchSnapshot(account: DemoAccount): Promise<AppState | null> {
  const response = await fetch(apiUrl("/api/snapshot/"), { headers: authHeaders(account) });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.state ?? null;
}

export async function saveSnapshot(account: DemoAccount, state: AppState) {
  await fetch(apiUrl("/api/snapshot/"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(account) },
    body: JSON.stringify({ state })
  });
}

export async function resetBackend(account: DemoAccount): Promise<ApiState> {
  const response = await fetch(apiUrl("/api/reset/"), { method: "POST", headers: authHeaders(account) });
  if (!response.ok) throw new Error("리셋 실패");
  return response.json();
}
