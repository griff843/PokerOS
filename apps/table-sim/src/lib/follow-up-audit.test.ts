import { describe, expect, it } from "vitest";
import type { FollowUpAssignmentAuditRow } from "../../../../packages/db/src/repository";
import {
  buildFollowUpAuditSummary,
  buildFollowUpAuditWarnings,
  formatCorrectiveBucketLabels,
  inferCorrectiveBucketsFromWarnings,
} from "./follow-up-audit";

function makeRow(overrides: Partial<FollowUpAssignmentAuditRow> & Pick<FollowUpAssignmentAuditRow, "id" | "created_at" | "concept_key" | "bucket_mix_json" | "selected_drill_ids_json">): FollowUpAssignmentAuditRow {
  return {
    user_id: "local_user",
    hand_title: "Manual BTN vs BB hand",
    hand_source: "manual",
    parse_status: "partial",
    uncertainty_profile: "turn_line_fuzzy",
    ...overrides,
  };
}

describe("follow-up audit summarizer", () => {
  it("summarizes recent entries, profiles, warnings, and bucket trends", () => {
    const rows: FollowUpAssignmentAuditRow[] = [
      makeRow({
        id: "audit-3",
        created_at: "2026-03-27T14:00:00.000Z",
        concept_key: "river_bluff_catching",
        hand_title: "Memory decisive hand",
        uncertainty_profile: "memory_decisive",
        bucket_mix_json: JSON.stringify([
          { bucket: "memory_decisive", count: 2 },
          { bucket: "bridge_reconstruction", count: 1 },
        ]),
        selected_drill_ids_json: JSON.stringify(["gold_bc_tr2_09"]),
      }),
      makeRow({
        id: "audit-2",
        created_at: "2026-03-27T12:00:00.000Z",
        concept_key: "river_bluff_catching",
        hand_title: "Turn line clear hand",
        uncertainty_profile: "turn_line_clear",
        bucket_mix_json: JSON.stringify([
          { bucket: "turn_line_transfer", count: 3 },
          { bucket: "exact_match", count: 1 },
        ]),
        selected_drill_ids_json: JSON.stringify(["gold_bc_03", "gold_bc_05"]),
      }),
      makeRow({
        id: "audit-1",
        created_at: "2026-03-27T10:00:00.000Z",
        concept_key: "turn_defense",
        hand_title: "Sizing fuzzy hand",
        uncertainty_profile: "sizing_fuzzy_line_clear",
        bucket_mix_json: JSON.stringify([
          { bucket: "sizing_stability", count: 2 },
          { bucket: "exact_match", count: 1 },
        ]),
        selected_drill_ids_json: JSON.stringify(["gold_bc_11"]),
      }),
    ];

    const summary = buildFollowUpAuditSummary(rows, {
      recentWindowSize: 2,
      now: new Date("2026-03-27T15:00:00.000Z"),
    });

    expect(summary.totalAudits).toBe(3);
    expect(summary.recentEntries).toHaveLength(2);
    expect(summary.recentEntries[0]?.id).toBe("audit-3");
    expect(summary.recentEntries[1]?.id).toBe("audit-2");
    expect(summary.recentEntries[0]?.warningCount).toBe(0);
    expect(summary.recentEntries[0]?.handSource).toBe("manual");
    expect(summary.recentEntries[0]?.parseStatus).toBe("partial");
    expect(summary.profileCounts.map((entry) => entry.profile)).toEqual(["memory_decisive", "sizing_fuzzy_line_clear", "turn_line_clear"]);
    expect(summary.bucketDistribution.find((entry) => entry.bucket === "turn_line_transfer")?.count).toBe(3);
    expect(summary.bucketTrend.deltas.find((entry) => entry.bucket === "memory_decisive")?.delta).toBe(2);
    expect(summary.warningCounts.totalWarnings).toBe(0);
    expect(summary.health.label).toBe("Aligned");
  });

  it("reuses assignment warning semantics for incomplete bucket mixes", () => {
    const warnings = buildFollowUpAuditWarnings("memory_decisive", [
      { bucket: "exact_match", count: 3 },
      { bucket: "turn_line_transfer", count: 1 },
    ]);

    expect(warnings).toContain("Memory-decisive blocks should include at least one memory-decisive rep.");
    expect(warnings).toContain("Memory-decisive blocks usually still need a bridge reconstruction rep.");
  });

  it("handles malformed JSON without crashing", () => {
    const summary = buildFollowUpAuditSummary([
      makeRow({
        id: "audit-bad",
        created_at: "2026-03-27T16:00:00.000Z",
        concept_key: "river_bluff_catching",
        uncertainty_profile: "turn_line_fuzzy",
        bucket_mix_json: "not-json",
        selected_drill_ids_json: "not-json",
      }),
    ]);

    expect(summary.recentEntries[0]?.bucketMix).toEqual([]);
    expect(summary.recentEntries[0]?.warningCount).toBe(2);
    expect(summary.recentEntries[0]?.handSource).toBe("manual");
    expect(summary.recentEntries[0]?.parseStatus).toBe("partial");
    expect(summary.health.label).toBe("Thin sample");
  });

  it("normalizes unknown hand source and parse status values", () => {
    const summary = buildFollowUpAuditSummary([
      makeRow({
        id: "audit-weird",
        created_at: "2026-03-27T18:00:00.000Z",
        concept_key: "river_bluff_catching",
        hand_source: "clipboard",
        parse_status: "incomplete",
        bucket_mix_json: JSON.stringify([{ bucket: "exact_match", count: 1 }]),
        selected_drill_ids_json: JSON.stringify(["gold_bc_01"]),
      }),
    ]);

    expect(summary.recentEntries[0]?.handSource).toBe("unknown");
    expect(summary.recentEntries[0]?.parseStatus).toBe("unknown");
  });

  it("infers corrective buckets from warning text", () => {
    const buckets = inferCorrectiveBucketsFromWarnings([
      "Memory-decisive blocks should include at least one memory-decisive rep.",
      "Turn-line-fuzzy blocks should include bridge reconstruction reps.",
      "Precise-history blocks should stay anchored in exact-match reps.",
    ]);

    expect(buckets).toEqual(["memory_decisive", "bridge_reconstruction", "exact_match"]);
  });

  it("formats corrective bucket labels for the audit UI", () => {
    expect(formatCorrectiveBucketLabels([
      "memory_decisive",
      "bridge_reconstruction",
      "exact_match",
    ])).toEqual([
      "memory-decisive reps",
      "bridge reconstruction reps",
      "exact-match reps",
    ]);
  });
});
