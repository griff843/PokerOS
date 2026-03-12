export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildGrowthProfileSnapshot } from "../../../lib/growth-profile";
import {
  buildDiagnosticInsightsFromAttempts,
  hydratePersistedStudyAttempts,
} from "../../../lib/intervention-support";
import { loadLocalStudyData } from "../../../lib/local-study-data";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const snapshot = buildGrowthProfileSnapshot({
      drills,
      attempts: hydratedAttempts.map((attempt) => ({
        drillId: attempt.drill.drill_id,
        nodeId: attempt.drill.node_id,
        title: attempt.drill.title,
        score: attempt.score,
        correct: attempt.correct,
        ts: attempt.timestamp,
        elapsedMs: attempt.elapsedMs,
        activePool: attempt.activePool,
      })),
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
      diagnosisHistory: toDiagnosisHistoryEntries(diagnoses),
      interventionHistory: toInterventionHistoryEntries(interventions),
      srs,
      activePool,
      realPlaySignals: buildRealPlayConceptSignals(importedHands),
      now: new Date(),
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to load growth profile:", error);
    return NextResponse.json(
      { error: "Failed to load growth profile" },
      { status: 500 }
    );
  }
}
