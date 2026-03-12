export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildWeaknessExplorerSnapshot } from "../../../lib/weakness-explorer";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands } = loadLocalStudyData();
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const snapshot = buildWeaknessExplorerSnapshot({
      drills,
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      srs,
      activePool,
      realPlaySignals: buildRealPlayConceptSignals(importedHands),
      now: new Date(),
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to load weakness explorer:", error);
    return NextResponse.json(
      { error: "Failed to load weakness explorer" },
      { status: 500 }
    );
  }
}

