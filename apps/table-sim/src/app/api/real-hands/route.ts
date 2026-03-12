export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { buildAttemptInsights, ImportedHandSourceSchema, type WeaknessPool } from "@poker-coach/core/browser";
import { loadLocalStudyData } from "../../../lib/local-study-data";
import { persistImportedHandText } from "../../../lib/real-hand-persistence";
import { buildRealHandsSnapshot } from "../../../lib/real-hands";

export async function GET(request: NextRequest) {
  try {
    const selectedHandId = request.nextUrl.searchParams.get("id");
    const { drills, attempts, importedHands, handImports } = loadLocalStudyData();
    const activePool = (attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const drillMap = new Map(drills.map((drill) => [drill.drill_id, drill]));

    const snapshot = buildRealHandsSnapshot({
      drills,
      importedHands,
      importHistory: handImports,
      attemptInsights: buildAttemptInsights(attempts, drillMap),
      activePool,
      selectedHandId,
      now: new Date(),
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to load real hands:", error);
    return NextResponse.json({ error: "Failed to load real hands" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text?: string; source?: string };
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "Hand history text is required" }, { status: 400 });
    }

    const source = ImportedHandSourceSchema.parse(body.source ?? "paste");
    const result = persistImportedHandText({ text, source, importedAt: new Date() });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to import real hands:", error);
    return NextResponse.json({ error: "Failed to import real hands" }, { status: 500 });
  }
}


