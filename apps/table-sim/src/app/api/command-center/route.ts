export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { buildCommandCenterSnapshot } from "../../../lib/command-center";
import { ensureInterventionForPlan, getLocalCoachingUserId, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildConceptDecisionAuditSummary, syncInterventionDecisionSnapshots } from "../../../lib/intervention-decision-audit";
import { buildTableSimInterventionRecommendations } from "../../../lib/intervention-decision";
import { buildConceptTransferAuditSummary, syncTransferEvaluationSnapshots } from "../../../lib/transfer-audit";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../lib/player-intelligence";
import { createRecommendedInterventionPlan, createTableSimSessionPlan } from "../../../lib/session-plan-server";
import { openDatabase } from "../../../../../../packages/db/src";
import { getUserCoachingInputSnapshots } from "../../../../../../packages/db/src/repository";
import { buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";

const DEFAULT_COUNT = 10;

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules, transferSnapshots: loadedTransferSnapshots, inputSnapshots: loadedInputSnapshots } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const attemptInsights = buildAttemptInsights(attempts, drillMap);

    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
    const playerIntelligence = buildTableSimPlayerIntelligence({
      drills,
      attemptInsights,
      srs,
      activePool,
      diagnosisHistory,
      interventionHistory,
      realPlaySignals,
      patternAttempts,
      now,
    });
    const recommendations = buildTableSimInterventionRecommendations({
      playerIntelligence,
      diagnosisHistory,
      interventionHistory,
      realPlaySignals,
      retentionSchedules,
    });

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
      realPlaySignals,
      now,
    });

    const dbPath = resolveDbPath();
    let refreshedDecisionSnapshots = decisionSnapshots;
    let transferSnapshots = loadedTransferSnapshots;
    let inputSnapshots = loadedInputSnapshots;
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        ensureInterventionForPlan({
          db,
          conceptKey: interventionPlan.rootConceptKey,
          source: "command_center",
          createdAt: interventionPlan.generatedAt,
        });
        refreshedDecisionSnapshots = syncInterventionDecisionSnapshots({
          db,
          playerIntelligence,
          recommendations,
          diagnosisHistory,
          interventionHistory,
          realPlaySignals,
          retentionSchedules,
          now,
          sourceContext: "command_center",
        });
        transferSnapshots = syncTransferEvaluationSnapshots({
          db,
          playerIntelligence,
          diagnosisHistory,
          interventionHistory,
          realPlaySignals,
          retentionSchedules,
          decisionSnapshots: refreshedDecisionSnapshots,
          now,
          sourceContext: "command_center",
        });
        inputSnapshots = getUserCoachingInputSnapshots(db, getLocalCoachingUserId());
      } finally {
        db.close();
      }
    }

    const snapshot = buildCommandCenterSnapshot({
      plan,
      attemptInsights,
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
      transferSnapshots,
      inputSnapshots,
      now,
    });

    const interventionDecisionAudit = buildConceptDecisionAuditSummary({
      conceptKey: snapshot.nextInterventionDecision?.conceptKey ?? interventionPlan.rootConceptKey,
      decisions: refreshedDecisionSnapshots,
      currentRecommendation: snapshot.nextInterventionDecision,
    });
    const transferAudit = buildConceptTransferAuditSummary({
      conceptKey: snapshot.nextInterventionDecision?.conceptKey ?? interventionPlan.rootConceptKey,
      snapshots: transferSnapshots,
    });

    return NextResponse.json({ ...snapshot, interventionDecisionAudit, transferAudit });
  } catch (error) {
    console.error("Failed to load command center:", error);
    return NextResponse.json(
      { error: "Failed to load command center" },
      { status: 500 }
    );
  }
}
