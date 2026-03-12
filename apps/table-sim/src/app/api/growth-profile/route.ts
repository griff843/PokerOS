export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildConceptDecisionAuditSummary } from "../../../lib/intervention-decision-audit";
import { buildGrowthProfileSnapshot } from "../../../lib/growth-profile";
import {
  buildDiagnosticInsightsFromAttempts,
  buildPatternAttemptSignals,
  hydratePersistedStudyAttempts,
} from "../../../lib/intervention-support";
import { loadLocalStudyData } from "../../../lib/local-study-data";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
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
      patternAttempts,
      decisionSnapshots,
      retentionSchedules,
      now: new Date(),
    });

    const interventionDecisionAudit = snapshot.nextInterventionDecision
      ? buildConceptDecisionAuditSummary({
          conceptKey: snapshot.nextInterventionDecision.conceptKey,
          decisions: decisionSnapshots,
          currentRecommendation: snapshot.nextInterventionDecision,
        })
      : undefined;

    return NextResponse.json({ ...snapshot, interventionDecisionAudit });
  } catch (error) {
    console.error("Failed to load growth profile:", error);
    return NextResponse.json(
      { error: "Failed to load growth profile" },
      { status: 500 }
    );
  }
}
