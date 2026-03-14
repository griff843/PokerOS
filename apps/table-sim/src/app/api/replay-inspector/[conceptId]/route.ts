export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../../lib/local-study-data";
import { buildReplayInspector } from "../../../../lib/replay-inspector";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params;
    const { decisionSnapshots, transferSnapshots, inputSnapshots } = loadLocalStudyData();
    const replay = buildReplayInspector({
      conceptKey: decodeURIComponent(conceptId),
      decisionSnapshots,
      transferSnapshots,
      inputSnapshots,
      now: new Date(),
    });

    return NextResponse.json(replay);
  } catch (error) {
    console.error("Failed to build replay inspector:", error);
    return NextResponse.json({ error: "Failed to build replay inspector" }, { status: 500 });
  }
}
