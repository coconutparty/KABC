export const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const PITCH_TABLE: Record<string, {
  speed: [number, number];
  contactMod: number;
  disciplineMod?: number;
  controlMod: number;
  stamina: number;
  distanceMod?: number;
  grounder?: number;
  groundDistanceMod?: number;
  description: string;
}> = {
  직구: { speed: [1.6, 1.65], contactMod: 15, controlMod: 5, stamina: 1, distanceMod: 1.1, description: "구속 160~165%, 상대 컨택 +15%, 체력 -1" },
  싱커: { speed: [1.55, 1.6], contactMod: 0, controlMod: -2, stamina: 1.2, grounder: 30, groundDistanceMod: 0.7, description: "장타 -5%, 30% 땅볼, 체력 -1.2" },
  투심: { speed: [1.5, 1.55], contactMod: 5, controlMod: 0, stamina: 1.2, grounder: 25, groundDistanceMod: 0.75, description: "상대 컨택 +5%, 25% 땅볼, 체력 -1.2" },
  커터: { speed: [1.45, 1.5], contactMod: 0, controlMod: 0, stamina: 1.2, description: "10% 비거리 절반, 체력 -1.2" },
  슬라이더: { speed: [1.35, 1.4], contactMod: -5, controlMod: -5, stamina: 1.2, description: "상대 컨택 -5%, 데드볼 위험, 체력 -1.2" },
  스플리터: { speed: [1.3, 1.35], contactMod: -7, controlMod: -8, stamina: 1.5, grounder: 20, description: "상대 컨택 -7%, 20% 땅볼, 체력 -1.5" },
  포크볼: { speed: [1.25, 1.3], contactMod: -10, controlMod: -8, stamina: 1.5, description: "상대 컨택 -10%, 폭투 위험, 체력 -1.5" },
  커브: { speed: [1.2, 1.25], contactMod: 5, controlMod: -3, stamina: 1.4, description: "상대 컨택 +5%, 비거리 억제 가능, 체력 -1.4" },
  너클커브: { speed: [1.15, 1.2], contactMod: -3, controlMod: -3, stamina: 1.4, description: "상대 컨택 -3%, 비거리 억제 가능, 체력 -1.4" },
  체인지업: { speed: [1.05, 1.15], contactMod: -3, controlMod: 0, stamina: 1.1, description: "상대 컨택 -3%, 직구 후 추가 효과, 체력 -1.1" },
  서클체인지: { speed: [1, 1.1], contactMod: -2, disciplineMod: -5, controlMod: 0, stamina: 1.1, description: "컨택 -2%, 선구안 -5%, 체력 -1.1" },
  팜볼: { speed: [0.95, 1.05], contactMod: 0, disciplineMod: -5, controlMod: -5, stamina: 1.3, distanceMod: 1.1, description: "선구안 -5%, 타격 성공 시 비거리 +10%, 체력 -1.3" },
  너클볼: { speed: [0.8, 0.9], contactMod: -15, controlMod: -15, stamina: 2, description: "컨택 -15%, 포일/폭투 위험, 체력 -2" },
  스크류볼: { speed: [1.2, 1.3], contactMod: -6, controlMod: -4, stamina: 1.3, description: "상대 컨택 -6%, 체력 -1.3" }
};

export const JOB_DUES: Record<string, { dueRate: number; sponsorRate: number }> = {
  "공무원/공공기관": { dueRate: 100, sponsorRate: 2 },
  "대기업 사무직": { dueRate: 100, sponsorRate: 4 },
  "영업직": { dueRate: 90, sponsorRate: 5 },
  "자영업자": { dueRate: 85, sponsorRate: 8 },
  "청마루 감자탕 후계자": { dueRate: 85, sponsorRate: 8 },
  "야구교실 코치": { dueRate: 82, sponsorRate: 1 },
  "스타트업/중소기업": { dueRate: 78, sponsorRate: 2 },
  "프리랜서": { dueRate: 72, sponsorRate: 2 },
  "무직/백수": { dueRate: 55, sponsorRate: 0 }
};

export const KIM_BAT_CHOICES = [
  { id: "contact", label: "컨택 위주", stamina: 1, contact: 1.1, power: 0.9, discipline: 1, speed: 1, distance: 0 },
  { id: "wait", label: "공을 오래 본다", stamina: 1, contact: 0.95, power: 1, discipline: 1.15, speed: 1, distance: 0 },
  { id: "power", label: "장타를 노린다", stamina: 2, contact: 0.9, power: 1.2, discipline: 1, speed: 1, distance: 5 },
  { id: "run", label: "적극 주루까지 노린다", stamina: 2, contact: 1.05, power: 1, discipline: 1, speed: 1.1, distance: 0 }
] as const;

export const PARTY_OPTIONS = [
  { label: "간단 회식", cost: 300000, bond: 3, mood: 1, condition: -3 },
  { label: "제대로 회식", cost: 1000000, bond: 8, mood: 3, condition: -8 },
  { label: "크게 쏜다", cost: 1500000, bond: 12, mood: 5, condition: -12 }
];
