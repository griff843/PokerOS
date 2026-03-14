export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../../lib/local-study-data";
import { buildReplayDiff, type ReplayDiffEngine } from "../../../../lib/replay-diff";

const VALID_ENGINES: ReplayDiffEngine[] = ["recommendation", "transfer"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params;
    const engine = (request.nextUrl.searchParams.get("engine") ?? "recommendation") as ReplayDiffEngine;

    if (!VALID_ENGINES.includes(engine)) {
      return NextResponse.json(
        { error: "Invalid replay diff engine", validEngines: VALID_ENGINES },
        { status: 400 }
      );
    }

    const { decisionSnapshots, transferSnapshots, inputSnapshots } = loadLocalStudyData();
    const diff = buildReplayDiff({
      conceptKey: decodeURIComponent(conceptId),
      engine,
      decisionSnapshots,
      transferSnapshots,
      inputSnapshots,
      now: new Date(),
    });

    return NextResponse.json(diff);
  } catch (error) {
    console.error("Failed to build replay diff:", error);
    return NextResponse.json({ error: "Failed to build replay diff" }, { status: 500 });
  }
}
