export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildWeaknessExplorerSnapshot } from "../../../lib/weakness-explorer";
import { buildPatternAttemptSignals, hydratePersistedStudyAttempts } from "../../../lib/intervention-support";
import { buildConceptDecisionAuditSummary } from "../../../lib/intervention-decision-audit";

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands, decisionSnapshots } = loadLocalStudyData();
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const hydratedAttempts = hydratePersistedStudyAttempts(attempts, drills);
    const snapshot = buildWeaknessExplorerSnapshot({
      drills,
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      srs,
      activePool,
      realPlaySignals: buildRealPlayConceptSignals(importedHands),
      patternAttempts: buildPatternAttemptSignals(hydratedAttempts),
      now: new Date(),
    });

    const priorityWeaknesses = snapshot.priorityWeaknesses.map((card) => ({
      ...card,
      decisionAudit: buildConceptDecisionAuditSummary({
        conceptKey: card.conceptKey,
        decisions: decisionSnapshots,
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
