export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { buildCommandCenterSnapshot } from "../../../lib/command-center";
import { ensureInterventionForPlan, getLocalCoachingUserId, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildConceptDecisionAuditSummary } from "../../../lib/intervention-decision-audit";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { createRecommendedInterventionPlan, createTableSimSessionPlan } from "../../../lib/session-plan-server";
import { openDatabase } from "../../../../../../packages/db/src";
import { getUserInterventionDecisionSnapshots } from "../../../../../../packages/db/src/repository";
import { buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";

const DEFAULT_COUNT = 10;

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);

    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);

    const plan = createTableSimSessionPlan({
      request: { count: DEFAULT_COUNT, activePool },
      inputs: { drills, attempts, srs, now },
      diagnosisHistory,
      interventionHistory,
    });
    const interventionPlan = createRecommendedInterventionPlan({
      drills,
      attempts,
      srs,
      activePool,
      diagnosisHistory,
      interventionHistory,
      now,
    });

    const dbPath = resolveDbPath();
    let refreshedDecisionSnapshots = decisionSnapshots;
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        ensureInterventionForPlan({
          db,
          conceptKey: interventionPlan.rootConceptKey,
          source: "command_center",
          createdAt: interventionPlan.generatedAt,
        });
        refreshedDecisionSnapshots = getUserInterventionDecisionSnapshots(db, getLocalCoachingUserId());
      } finally {
        db.close();
      }
    }

    const snapshot = buildCommandCenterSnapshot({
      plan,
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      recentAttempts: attempts.flatMap((attempt) => {
        const drill = drillMap.get(attempt.drill_id);
        if (!drill) {
          return [];
        }

        return [{
          drillId: attempt.drill_id,
          nodeId: drill.node_id,
          title: drill.title,
          score: attempt.score,
          correct: attempt.correct_bool === 1,
          ts: attempt.ts,
          activePool: attempt.active_pool ?? null,
        }];
      }),
      activePool,
      count: DEFAULT_COUNT,
      interventionPlan,
      diagnosisHistory,
      interventionHistory,
      realPlaySignals,
      patternAttempts,
      decisionSnapshots: refreshedDecisionSnapshots,
      retentionSchedules,
      now,
    });

    const interventionDecisionAudit = buildConceptDecisionAuditSummary({
      conceptKey: snapshot.nextInterventionDecision?.conceptKey ?? interventionPlan.rootConceptKey,
      decisions: refreshedDecisionSnapshots,
      currentRecommendation: snapshot.nextInterventionDecision,
    });

    return NextResponse.json({ ...snapshot, interventionDecisionAudit });
  } catch (error) {
    console.error("Failed to load command center:", error);
    return NextResponse.json(
      { error: "Failed to load command center" },
      { status: 500 }
    );
  }
}
