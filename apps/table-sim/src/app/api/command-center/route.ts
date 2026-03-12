export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { buildAttemptInsights, buildRealPlayConceptSignals, type WeaknessPool } from "@poker-coach/core/browser";
import { buildCommandCenterSnapshot } from "../../../lib/command-center";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { createRecommendedInterventionPlan, createTableSimSessionPlan } from "../../../lib/session-plan-server";

const DEFAULT_COUNT = 10;

export async function GET() {
  try {
    const { drills, attempts, srs, importedHands } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const realPlaySignals = buildRealPlayConceptSignals(importedHands);

    const plan = createTableSimSessionPlan({
      request: { count: DEFAULT_COUNT, activePool },
      inputs: { drills, attempts, srs, now },
    });
    const interventionPlan = createRecommendedInterventionPlan({ drills, attempts, srs, activePool, now });

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
      realPlaySignals,
      now,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to load command center:", error);
    return NextResponse.json(
      { error: "Failed to load command center" },
      { status: 500 }
    );
  }
}

