export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { buildFollowUpAuditSummary } from "../../../lib/follow-up-audit";

export async function GET() {
  try {
    const { followUpAssignmentAudits } = loadLocalStudyData();
    const summary = buildFollowUpAuditSummary(followUpAssignmentAudits);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load follow-up audits:", error);
    return NextResponse.json(
      { error: "Failed to load follow-up audits" },
      { status: 500 },
    );
  }
}
