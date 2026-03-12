export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildPersistentReviewSnapshot } from "../../../lib/persistent-review";
import type { TableSimActivePool } from "../../../lib/session-plan";

export async function GET() {
  try {
    const { drills, attempts, srs } = loadLocalStudyData();
    const activePool = (attempts[0]?.active_pool ?? "baseline") as TableSimActivePool;
    const snapshot = buildPersistentReviewSnapshot({
      drills,
      attempts,
      srs,
      activePool,
      now: new Date(),
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to load review queue:", error);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}

