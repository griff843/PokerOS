export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { loadLocalStudyData } from "../../../../lib/local-study-data";
import { persistAttemptPatch } from "../../../../lib/study-persistence";
import type { StoredAttemptPayload } from "../../../../lib/study-attempts";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await context.params;
    const body = (await request.json()) as { reflection?: string; diagnostic?: StoredAttemptPayload["diagnostic"] };
    if (typeof body.reflection !== "string" && body.diagnostic === undefined) {
      return NextResponse.json({ error: "Reflection or diagnostic is required" }, { status: 400 });
    }

    let payload: StoredAttemptPayload | undefined;
    if (body.diagnostic !== undefined) {
      const row = loadLocalStudyData().attempts.find((attempt) => attempt.attempt_id === attemptId);
      if (!row) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
      }
      const parsed = JSON.parse(row.user_answer_json) as StoredAttemptPayload;
      payload = { ...parsed, diagnostic: body.diagnostic };
    }

    const updated = persistAttemptPatch({ attemptId, reflection: body.reflection, payload });
    if (!updated) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update attempt:", error);
    return NextResponse.json({ error: "Failed to update attempt" }, { status: 500 });
  }
}

