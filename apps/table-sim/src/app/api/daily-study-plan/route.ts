export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../lib/player-intelligence";
import { buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";
import { buildDailyStudyPlanBundle } from "../../../lib/daily-study-plan";

const ACTIVE_INTERVENTION_STATUSES = new Set(["assigned", "in_progress", "stabilizing"]);

export async function GET() {
  try {
    const {
      drills,
      attempts,
      srs,
      importedHands,
      diagnoses,
      interventions,
      retentionSchedules,
    } = loadLocalStudyData();

    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const diagnosisHistory = toDiagnosisHistoryEntries(diagnoses);
    const interventionHistory = toInterventionHistoryEntries(interventions);
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);
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

    // Resolve active intervention concept (most recent active intervention)
    const activeInterventionRow = [...interventions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .find((entry) => ACTIVE_INTERVENTION_STATUSES.has(entry.status));
    const activeInterventionConceptKey = activeInterventionRow?.concept_key ?? null;
    const activeInterventionConcept = activeInterventionConceptKey
      ? playerIntelligence.concepts.find((c) => c.conceptKey === activeInterventionConceptKey)
      : null;

    // Retention states are refreshed by loadLocalStudyData via refreshRetentionSchedules
    // Status fields are authoritative after refresh
    const overdueRetentionConceptKeys = retentionSchedules
      .filter((s) => s.status === "overdue")
      .map((s) => s.concept_key);
    const dueRetentionConceptKeys = retentionSchedules
      .filter((s) => s.status === "due")
      .map((s) => s.concept_key);

    const bundle = buildDailyStudyPlanBundle({
      playerIntelligence,
      totalAttempts: attempts.length,
      overdueRetentionConceptKeys,
      dueRetentionConceptKeys,
      importedHandCount: importedHands.length,
      activeInterventionConceptKey,
      activeInterventionConceptLabel: activeInterventionConcept?.label ?? null,
      now,
    });

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Failed to build daily study plan:", error);
    return NextResponse.json(
      { error: "Failed to build daily study plan" },
      { status: 500 },
    );
  }
}
