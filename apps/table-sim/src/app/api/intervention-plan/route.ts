export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { WeaknessPool } from "@poker-coach/core/browser";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { createRecommendedInterventionPlan } from "../../../lib/session-plan-server";

export async function GET(request: NextRequest) {
  try {
    const { drills, attempts, srs } = loadLocalStudyData();
    const activePool = (request.nextUrl.searchParams.get("pool") ?? attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const plan = createRecommendedInterventionPlan({
      drills,
      attempts,
      srs,
      activePool,
      now,
    });
    const requestedId = request.nextUrl.searchParams.get("id");

    if (requestedId && requestedId !== plan.id) {
      return NextResponse.json({ error: "Intervention plan is no longer current", currentId: plan.id }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to build intervention plan:", error);
    return NextResponse.json({ error: "Failed to build intervention plan" }, { status: 500 });
  }
}
