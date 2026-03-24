export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { WeaknessPool } from "@poker-coach/core/browser";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildPersistedRealHandInterventionBridgeBundle } from "../../../lib/real-hand-bridge";

export async function GET(request: NextRequest) {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, retentionSchedules } = loadLocalStudyData();
    const activePool = (request.nextUrl.searchParams.get("pool") ?? attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const bundle = buildPersistedRealHandInterventionBridgeBundle({
      drills,
      attempts,
      srs,
      importedHands,
      diagnoses,
      interventions,
      retentionSchedules,
      activePool,
      now: new Date(),
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Failed to build real-hand bridge:", error);
    return NextResponse.json({ error: "Failed to build real-hand bridge" }, { status: 500 });
  }
}
