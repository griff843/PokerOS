import type { TableSimActivePool } from "./session-plan";

export const SESSION_COUNT_OPTIONS = [5, 10, 15, 20, 30];

export const SESSION_POOL_OPTIONS: Array<{
  value: TableSimActivePool;
  label: string;
  description: string;
}> = [
  { value: "baseline", label: "Baseline", description: "GTO baseline" },
  { value: "A", label: "Pool A", description: "Competent regulars" },
  { value: "B", label: "Pool B", description: "Passive recreationals" },
  { value: "C", label: "Pool C", description: "Aggressive gamblers" },
];

