export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { getLocalCoachingUserId, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildTableSimInterventionRecommendations } from "../../../lib/intervention-decision";
import { syncInterventionDecisionSnapshots } from "../../../lib/intervention-decision-audit";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../lib/player-intelligence";
import { buildWeaknessExplorerSnapshot } from "../../../lib/weakness-explorer";
import { buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";
import { buildConceptDecisionAuditSummary } from "../../../lib/intervention-decision-audit";
import { syncTransferEvaluationSnapshots } from "../../../lib/transfer-audit";
import { openDatabase } from "../../../../../../packages/db/src";
import { getUserCoachingInputSnapshots } from "../../../../../../packages/db/src/repository";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules, transferSnapshots: loadedTransferSnapshots, inputSnapshots: loadedInputSnapshots } = loadLocalStudyData();
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
    const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
    const now = new Date();
    const attemptInsights = buildAttemptInsights(attempts, drillMap);
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
    let transferSnapshots = loadedTransferSnapshots;
    let refreshedDecisionSnapshots = decisionSnapshots;
    let inputSnapshots = loadedInputSnapshots;
    const dbPath = resolveDbPath();
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        refreshedDecisionSnapshots = syncInterventionDecisionSnapshots({
          db,
          playerIntelligence,
          recommendations,
          diagnosisHistory,
          interventionHistory,
          realPlaySignals,
          retentionSchedules,
          now,
          sourceContext: "weakness_explorer",
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
          sourceContext: "weakness_explorer",
        });
        inputSnapshots = getUserCoachingInputSnapshots(db, getLocalCoachingUserId());
      } finally {
        db.close();
      }
    }
    const snapshot = buildWeaknessExplorerSnapshot({
      drills,
      attemptInsights,
      srs,
      activePool,
      diagnosisHistory,
      interventionHistory,
      decisionSnapshots: refreshedDecisionSnapshots,
      realPlaySignals,
      patternAttempts,
      retentionSchedules,
      transferSnapshots,
      inputSnapshots,
      now,
    });

    const priorityWeaknesses = snapshot.priorityWeaknesses.map((card) => ({
      ...card,
      decisionAudit: buildConceptDecisionAuditSummary({
        conceptKey: card.conceptKey,
        decisions: refreshedDecisionSnapshots,
      }),
    }));

    return NextResponse.json({ ...snapshot, priorityWeaknesses });
  } catch (error) {
    console.error("Failed to load weakness explorer:", error);
    return NextResponse.json(
      { error: "Failed to load weakness explorer" },
      { status: 500 }
    );
  }
}
