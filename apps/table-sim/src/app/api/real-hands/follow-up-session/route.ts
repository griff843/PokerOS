export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadLocalStudyData, resolveDbPath } from "../../../../lib/local-study-data";
import { getLocalCoachingUserId } from "../../../../lib/coaching-memory";
import { createRealHandFollowUpSessionPlan } from "../../../../lib/session-plan-server";
import { openDatabase } from "../../../../../../../packages/db/src";
import { createFollowUpAssignmentAudit } from "../../../../../../../packages/db/src/repository";

const FollowUpRequestSchema = z.object({
  conceptKey: z.string().min(1),
  activePool: z.enum(["baseline", "A", "B", "C"]).optional(),
  preferredDrillIds: z.array(z.string().min(1)).optional(),
  correctiveBuckets: z.array(z.enum(["exact_match", "turn_line_transfer", "sizing_stability", "bridge_reconstruction", "memory_decisive"])).optional(),
  handTitle: z.string().min(1).nullable().optional(),
  handSource: z.enum(["paste", "file", "manual"]).optional(),
  parseStatus: z.enum(["parsed", "partial", "unsupported"]).optional(),
  uncertaintyProfile: z.enum(["precise_history", "turn_line_clear", "sizing_fuzzy_line_clear", "turn_line_fuzzy", "memory_decisive"]).optional(),
  count: z.number().int().positive().max(10).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = FollowUpRequestSchema.parse(await request.json());
    const { drills, attempts, srs } = loadLocalStudyData();

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: payload.conceptKey,
        activePool: payload.activePool ?? "baseline",
        preferredDrillIds: payload.preferredDrillIds ?? [],
        correctiveBuckets: payload.correctiveBuckets ?? [],
        handTitle: payload.handTitle ?? null,
        handSource: payload.handSource,
        parseStatus: payload.parseStatus,
        uncertaintyProfile: payload.uncertaintyProfile,
        count: payload.count,
      },
      inputs: {
        drills,
        attempts,
        srs,
        now: new Date(),
      },
    });

    const dbPath = resolveDbPath();
    const followUpAudit = plan.metadata.followUpAudit;
    if (dbPath && followUpAudit) {
      const db = openDatabase(dbPath);
      try {
        createFollowUpAssignmentAudit(db, {
          id: randomUUID(),
          user_id: getLocalCoachingUserId(),
          concept_key: followUpAudit.conceptKey,
          hand_title: followUpAudit.handTitle ?? null,
          hand_source: followUpAudit.handSource ?? null,
          parse_status: followUpAudit.parseStatus ?? null,
          uncertainty_profile: followUpAudit.uncertaintyProfile ?? null,
          active_pool: payload.activePool ?? "baseline",
          created_at: plan.metadata.generatedAt,
          bucket_mix_json: JSON.stringify(followUpAudit.bucketMix),
          selected_drill_ids_json: JSON.stringify(followUpAudit.selectedDrillIds),
        });
      } finally {
        db.close();
      }
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to create real-hand follow-up session:", error);
    return NextResponse.json(
      { error: "Failed to create real-hand follow-up session" },
      { status: 500 },
    );
  }
}
