import { TableSimDrillsFileSchema, type TableSimDrill } from "./drill-schema";

let drillsCache: TableSimDrill[] | null = null;

export async function loadDrills(): Promise<TableSimDrill[]> {
  if (drillsCache) return drillsCache;

  const res = await fetch("/api/drills");
  if (!res.ok) throw new Error("Failed to load drills");

  const raw = await res.json();
  const drills = TableSimDrillsFileSchema.parse(raw);
  drillsCache = drills;
  return drills;
}
