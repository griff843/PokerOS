export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../../lib/coaching-memory";
import { buildConceptCaseMap } from "../../../../lib/concept-case";
import { buildTableSimInterventionRecommendations } from "../../../../lib/intervention-decision";
import { buildDiagnosticInsightsFromAttempts, buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../../lib/intervention-support";
import { loadLocalStudyData, resolveDbPath } from "../../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../../lib/player-intelligence";
import { syncTransferEvaluationSnapshots } from "../../../../lib/transfer-audit";
import { openDatabase } from "../../../../../../../packages/db/src";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await context.params;
    const conceptKey = decodeURIComponent(conceptId);
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules, transferSnapshots: loadedTransferSnapshots } = loadLocalStudyData();
    const activePool = (request.nextUrl.searchParams.get("pool") ?? attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const now = new Date();
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
    const playerIntelligence = buildTableSimPlayerIntelligence({
      drills,
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      srs,
      activePool,
      diagnosticInsights: buildDiagnosticInsightsFromAttempts(hydratedAttempts),
      diagnosisHistory,
      interventionHistory,
      realPlaySignals,
      patternAttempts: buildPatternAttemptSignals(hydratedAttempts),
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
    const dbPath = resolveDbPath();
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        transferSnapshots = syncTransferEvaluationSnapshots({
          db,
          playerIntelligence,
          diagnosisHistory,
          interventionHistory,
          realPlaySignals,
          retentionSchedules,
          decisionSnapshots,
          now,
          sourceContext: "concept_case_api",
        });
      } finally {
        db.close();
      }
    }
    const conceptCase = buildConceptCaseMap({
      playerIntelligence,
      diagnosisHistory,
      interventionHistory,
      decisionSnapshots,
      retentionSchedules,
      transferSnapshots,
      realPlaySignals,
      recommendations,
      now,
    }).get(conceptKey);

    if (!conceptCase) {
      return NextResponse.json({ error: "Concept case not found", conceptKey }, { status: 404 });
    }

    return NextResponse.json({
      conceptKey,
      history: conceptCase.history,
      explanation: conceptCase.explanation,
      nextStep: conceptCase.nextStep,
      decisionAudit: conceptCase.decisionAudit,
      retention: conceptCase.retention,
      transferEvaluation: conceptCase.transferEvaluation,
      transferAudit: conceptCase.transferAudit,
      recommendation: conceptCase.recommendation,
      strategyBlueprint: conceptCase.strategyBlueprint,
    });
  } catch (error) {
    console.error("Failed to build concept case:", error);
    return NextResponse.json({ error: "Failed to build concept case" }, { status: 500 });
  }
}
