export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createTableSimSessionPlan } from "../../../lib/session-plan-server";
import { TableSimActivePoolSchema } from "../../../lib/session-plan";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { parseDailyPlanSessionOverride } from "../../../lib/daily-plan-session-bridge";

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
    const dailyPlanOverride = parseDailyPlanSessionOverride({
      source: req.nextUrl.searchParams.get("source") ?? undefined,
      count: req.nextUrl.searchParams.get("count") ?? undefined,
      sessionLength: req.nextUrl.searchParams.get("sessionLength") ?? undefined,
      focusConcept: req.nextUrl.searchParams.get("focusConcept") ?? undefined,
      focusLabel: req.nextUrl.searchParams.get("focusLabel") ?? undefined,
      intent: req.nextUrl.searchParams.get("intent") ?? undefined,
      blockKind: req.nextUrl.searchParams.get("blockKind") ?? undefined,
      blockTitle: req.nextUrl.searchParams.get("blockTitle") ?? undefined,
    });
    const { drills, attempts, srs, diagnoses, interventions } = loadLocalStudyData();

    const plan = createTableSimSessionPlan({
      request: {
        count: Number.isFinite(count) && count > 0 ? count : 10,
        activePool,
        interventionId,
        focusConceptKey: dailyPlanOverride?.focusConceptKey ?? undefined,
        dailyPlanOverride,
      },
      inputs: { drills, attempts, srs, now: new Date() },
      diagnosisHistory: toDiagnosisHistoryEntries(diagnoses),
      interventionHistory: toInterventionHistoryEntries(interventions),
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
