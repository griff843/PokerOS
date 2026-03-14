export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildConceptDecisionAuditSummary, syncInterventionDecisionSnapshots } from "../../../lib/intervention-decision-audit";
import { buildTableSimInterventionRecommendations } from "../../../lib/intervention-decision";
import { buildGrowthProfileSnapshot } from "../../../lib/growth-profile";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../lib/player-intelligence";
import { buildConceptTransferAuditSummary, syncTransferEvaluationSnapshots } from "../../../lib/transfer-audit";
import {
  buildDiagnosticInsightsFromAttempts,
  buildPatternAttemptSignals,
  hydratePersistedStudyAttempts,
} from "../../../lib/intervention-support";
import { openDatabase } from "../../../../../../packages/db/src";
import { getLocalCoachingUserId } from "../../../lib/coaching-memory";
import { getUserCoachingInputSnapshots } from "../../../../../../packages/db/src/repository";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules, transferSnapshots: loadedTransferSnapshots, inputSnapshots: loadedInputSnapshots } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const patternAttempts = buildPatternAttemptSignals(hydratedAttempts);
    const now = new Date();
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
    const attemptInsights = buildAttemptInsights(attempts, drillMap);
    const playerIntelligence = buildTableSimPlayerIntelligence({
      drills,
      attemptInsights,
      srs,
      activePool,
      diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
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
          sourceContext: "growth_profile",
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
          sourceContext: "growth_profile",
        });
        inputSnapshots = getUserCoachingInputSnapshots(db, getLocalCoachingUserId());
      } finally {
        db.close();
      }
    }
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
      attemptInsights,
      diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
      diagnosisHistory,
      interventionHistory,
      srs,
      activePool,
      realPlaySignals,
      patternAttempts,
      decisionSnapshots: refreshedDecisionSnapshots,
      retentionSchedules,
      transferSnapshots,
      inputSnapshots,
      now,
    });

    const interventionDecisionAudit = snapshot.nextInterventionDecision
      ? buildConceptDecisionAuditSummary({
          conceptKey: snapshot.nextInterventionDecision.conceptKey,
          decisions: refreshedDecisionSnapshots,
          currentRecommendation: snapshot.nextInterventionDecision,
        })
      : undefined;
    const transferAudit = snapshot.nextInterventionDecision
      ? buildConceptTransferAuditSummary({
          conceptKey: snapshot.nextInterventionDecision.conceptKey,
          snapshots: transferSnapshots,
        })
      : undefined;

    return NextResponse.json({ ...snapshot, interventionDecisionAudit, transferAudit });
  } catch (error) {
    console.error("Failed to load growth profile:", error);
    return NextResponse.json(
      { error: "Failed to load growth profile" },
      { status: 500 }
    );
  }
}
