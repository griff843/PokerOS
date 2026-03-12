export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createTableSimSessionPlan } from "../../../lib/session-plan-server";
import { TableSimActivePoolSchema } from "../../../lib/session-plan";
import { loadLocalStudyData } from "../../../lib/local-study-data";

function parseActivePool(value: string | null) {
  const parsed = TableSimActivePoolSchema.safeParse(value ?? "baseline");
  return parsed.success ? parsed.data : "baseline";
}

export async function GET(req: NextRequest) {
  try {
    const countParam = req.nextUrl.searchParams.get("count");
    const count = countParam ? Number.parseInt(countParam, 10) : 10;
    const activePool = parseActivePool(req.nextUrl.searchParams.get("pool"));
    const interventionId = req.nextUrl.searchParams.get("intervention");
    const { drills, attempts, srs } = loadLocalStudyData();

    const plan = createTableSimSessionPlan({
      request: { count: Number.isFinite(count) && count > 0 ? count : 10, activePool, interventionId },
      inputs: { drills, attempts, srs, now: new Date() },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to load session plan:", error);
    return NextResponse.json(
      { error: "Failed to load session plan" },
      { status: 500 }
    );
  }
}
