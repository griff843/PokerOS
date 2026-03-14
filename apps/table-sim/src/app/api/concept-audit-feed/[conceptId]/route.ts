export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../../lib/local-study-data";
import { buildConceptAuditFeed } from "../../../../lib/concept-audit-feed";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conceptId: string }> }
) {
  try {
    const { conceptId } = await params;
    const { diagnoses, decisionSnapshots, transferSnapshots, retentionSchedules } = loadLocalStudyData();
    const feed = buildConceptAuditFeed({
      conceptKey: decodeURIComponent(conceptId),
      diagnoses,
      decisionSnapshots,
      transferSnapshots,
      retentionSchedules,
    });

    return NextResponse.json(feed);
  } catch (error) {
    console.error("Failed to build concept audit feed:", error);
    return NextResponse.json({ error: "Failed to build concept audit feed" }, { status: 500 });
  }
}
