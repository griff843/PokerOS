export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { persistAttempt } from "../../../lib/study-persistence";
import { hydrateDrillAttempt, type PersistedAttemptRecord } from "../../../lib/study-attempts";

export async function GET() {
  try {
    const { drills, attempts } = loadLocalStudyData();
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));
    const hydratedAttempts = attempts.flatMap((attempt) => {
      const drill = drillMap.get(attempt.drill_id);
      if (!drill) {
        return [];
      }

      const hydrated = hydrateDrillAttempt(attempt, drill);
      return hydrated ? [hydrated] : [];
    });

    return NextResponse.json({ attempts: hydratedAttempts });
  } catch (error) {
    console.error("Failed to load attempt history:", error);
    return NextResponse.json({ error: "Failed to load attempt history" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PersistedAttemptRecord;
    persistAttempt(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to persist attempt:", error);
    return NextResponse.json({ error: "Failed to persist attempt" }, { status: 500 });
  }
}

