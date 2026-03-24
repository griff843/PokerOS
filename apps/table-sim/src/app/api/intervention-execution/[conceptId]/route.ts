export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../../lib/coaching-memory";
import { buildConceptCaseMap } from "../../../../lib/concept-case";
import { buildTableSimInterventionRecommendations } from "../../../../lib/intervention-decision";
import { buildDiagnosticInsightsFromAttempts, buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../../lib/intervention-support";
import { buildConceptAuditFeed } from "../../../../lib/concept-audit-feed";
import { buildInterventionExecutionBundle } from "../../../../lib/intervention-execution";
import { loadLocalStudyData } from "../../../../lib/local-study-data";
import { buildTableSimPlayerIntelligence } from "../../../../lib/player-intelligence";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await context.params;
    const conceptKey = decodeURIComponent(conceptId);
    const {
      drills,
      attempts,
      srs,
      importedHands,
      diagnoses,
      interventions,
      decisionSnapshots,
      retentionSchedules,
      transferSnapshots,
      inputSnapshots,
    } = loadLocalStudyData();
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
    const conceptCase = buildConceptCaseMap({
      playerIntelligence,
      diagnosisHistory,
      interventionHistory,
      decisionSnapshots,
      retentionSchedules,
      transferSnapshots,
      inputSnapshots,
      realPlaySignals,
      recommendations,
      now,
    }).get(conceptKey);

    if (!conceptCase) {
      return NextResponse.json(
        { error: "Concept not found", conceptKey },
        { status: 404 }
      );
    }

    const auditFeed = buildConceptAuditFeed({
      conceptKey,
      diagnoses,
      decisionSnapshots,
      transferSnapshots,
      retentionSchedules,
    });

    return NextResponse.json(
      buildInterventionExecutionBundle(conceptCase, conceptKey, auditFeed)
    );
  } catch (error) {
    console.error("Failed to build intervention execution bundle:", error);
    return NextResponse.json(
      { error: "Failed to build intervention execution data" },
      { status: 500 }
    );
  }
}
