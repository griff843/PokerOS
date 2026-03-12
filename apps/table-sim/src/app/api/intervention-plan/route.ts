export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { ensureInterventionForPlan, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { buildConceptCaseMap } from "../../../lib/concept-case";
import { buildTableSimInterventionRecommendations } from "../../../lib/intervention-decision";
import { buildDiagnosticInsightsFromAttempts, buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../lib/player-intelligence";
import { createRecommendedInterventionDecision, createRecommendedInterventionPlan } from "../../../lib/session-plan-server";
import { openDatabase } from "../../../../../../packages/db/src";
import { buildConceptRetentionSummary } from "../../../lib/retention-scheduling";

export async function GET(request: NextRequest) {
  try {
    const { drills, attempts, srs, importedHands, diagnoses, interventions, decisionSnapshots, retentionSchedules } = loadLocalStudyData();
    const activePool = (request.nextUrl.searchParams.get("pool") ?? attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const decision = createRecommendedInterventionDecision({
      drills,
      attempts,
      srs,
      activePool,
      diagnosisHistory,
      interventionHistory,
      now,
    });
    const plan = createRecommendedInterventionPlan({
      drills,
      attempts,
      srs,
      activePool,
      diagnosisHistory,
      interventionHistory,
      now,
    });
    const requestedId = request.nextUrl.searchParams.get("id");

    if (requestedId && requestedId !== plan.id) {
      return NextResponse.json({ error: "Intervention plan is no longer current", currentId: plan.id }, { status: 404 });
    }

    const dbPath = resolveDbPath();
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        if (decision && ["assign_intervention", "continue_intervention", "escalate_intervention", "change_intervention_strategy", "add_transfer_block", "reopen_intervention"].includes(decision.action)) {
          ensureInterventionForPlan({
            db,
            conceptKey: decision.conceptKey,
            source: "command_center",
            createdAt: plan.generatedAt,
          });
        }
      } finally {
        db.close();
      }
    }

    const retentionSummary = decision
      ? buildConceptRetentionSummary(decision.conceptKey, retentionSchedules, now)
      : undefined;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
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
    });
    const conceptCase = decision
      ? buildConceptCaseMap({
          playerIntelligence,
          diagnosisHistory,
          interventionHistory,
          decisionSnapshots,
          retentionSchedules,
          recommendations,
          now,
        }).get(decision.conceptKey)
      : undefined;

    return NextResponse.json({ ...plan, nextInterventionDecision: decision, retentionSummary, conceptCase });
  } catch (error) {
    console.error("Failed to build intervention plan:", error);
    return NextResponse.json({ error: "Failed to build intervention plan" }, { status: 500 });
  }
}

