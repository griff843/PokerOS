import { describe, expect, it } from "vitest";
import {
  buildCompletedSessionSummary,
  buildNextFocusSummary,
  buildPlannedSessionSummary,
  buildWeaknessSummary,
  type CompletedSessionAttemptInput,
} from "../study-summary";
import type { SessionPlan } from "../session-generator";
import type { WeaknessAnalyticsReport } from "../weakness-analytics";

function makePlan(): SessionPlan {
  return {
    drills: [
      {
        drill: {
          drill_id: "d1",
          node_id: "hu_01",
          version: "1.0.0",
          title: "Review Spot",
          prompt: "Prompt",
          scenario: {
            game: "NLHE Cash",
            street: "river",
            pot_type: "SRP",
            players_to_flop: 2,
            hero_position: "BB",
            villain_position: "BTN",
            board: { flop: ["As", "Kd", "2c"], turn: "7h", river: "3d" },
            hero_hand: ["Ah", "Qc"],
            action_history: [],
          },
          decision_point: { street: "river", facing: { action: "bet", size_pct_pot: 75 }, sizing_buttons_enabled: false },
          options: [{ key: "CALL", label: "Call" }, { key: "FOLD", label: "Fold" }],
          answer: { correct: "CALL", accepted: [], required_tags: ["paired_top_river"], explanation: "Call." },
          tags: ["street:river", "concept:blocker_effect", "pool:baseline"],
          difficulty: 2,
        },
        kind: "review",
        reason: "due_review",
        matchedWeaknessTargets: ["overall:classification_tag:concept:blocker_effect"],
        metadata: { priorAttempts: 2, dueAt: "2026-03-09T00:00:00.000Z" },
      },
      {
        drill: {
          drill_id: "d2",
          node_id: "hu_02",
          version: "1.0.0",
          title: "New Spot",
          prompt: "Prompt",
          scenario: {
            game: "NLHE Cash",
            street: "river",
            pot_type: "SRP",
            players_to_flop: 2,
            hero_position: "BB",
            villain_position: "BTN",
            board: { flop: ["As", "Kd", "2c"], turn: "7h", river: "3d" },
            hero_hand: ["Ah", "Qc"],
            action_history: [],
          },
          decision_point: { street: "river", facing: { action: "bet", size_pct_pot: 75 }, sizing_buttons_enabled: false },
          options: [{ key: "CALL", label: "Call" }, { key: "FOLD", label: "Fold" }],
          answer: { correct: "CALL", accepted: [], required_tags: ["paired_top_river"], explanation: "Call." },
          tags: ["street:river", "concept:blocker_effect", "pool:pool_b"],
          difficulty: 2,
          answer_by_pool: {
            B: { correct: "FOLD", accepted: [], required_tags: ["underfold_exploit"], explanation: "Exploit fold." },
          },
        },
        kind: "new",
        reason: "weakness_new",
        matchedWeaknessTargets: ["pool:B:rule_tag:underfold_exploit"],
        metadata: { priorAttempts: 0, weaknessPriority: 0.8 },
      },
    ],
    metadata: {
      requestedCount: 2,
      selectedCount: 2,
      reviewCount: 1,
      newCount: 1,
      dueReviewCount: 1,
      weaknessReviewCount: 0,
      weaknessNewCount: 1,
      newMaterialFillCount: 0,
      activePool: "B",
      generatedAt: "2026-03-10T12:00:00.000Z",
      weaknessTargets: [
        { type: "rule_tag", key: "underfold_exploit", scope: "pool", pool: "B", sampleSize: 3, missRate: 0.66, priority: 0.66 },
        { type: "classification_tag", key: "concept:blocker_effect", scope: "overall", sampleSize: 4, accuracy: 0.4, priority: 0.6 },
      ],
      notes: ["Added new drills that match B pool-aware weakness targets before overall fallback."],
    },
  };
}

function makeAttempts(): CompletedSessionAttemptInput[] {
  return [
    {
      drillId: "d1",
      nodeId: "hu_01",
      title: "Review Spot",
      selectionKind: "review",
      selectionReason: "due_review",
      matchedWeaknessTargets: ["overall:classification_tag:concept:blocker_effect"],
      activePool: "B",
      score: 0.45,
      correct: false,
      missedTags: ["paired_top_river"],
      matchedTags: [],
    },
    {
      drillId: "d2",
      nodeId: "hu_02",
      title: "New Spot",
      selectionKind: "new",
      selectionReason: "weakness_new",
      matchedWeaknessTargets: ["pool:B:rule_tag:underfold_exploit"],
      activePool: "B",
      score: 1,
      correct: true,
      missedTags: [],
      matchedTags: ["underfold_exploit"],
    },
  ];
}

function makeWeaknessReport(): WeaknessAnalyticsReport {
  return {
    generatedAt: "2026-03-10T12:00:00.000Z",
    thresholds: { weaknessThreshold: 0.5, minAttempts: 2 },
    overallTargets: [
      { type: "classification_tag", key: "concept:blocker_effect", scope: "overall", sampleSize: 4, accuracy: 0.4, priority: 0.6 },
    ],
    poolTargets: {
      baseline: [],
      A: [],
      B: [
        { type: "rule_tag", key: "underfold_exploit", scope: "pool", pool: "B", sampleSize: 3, missRate: 0.66, priority: 0.66 },
      ],
      C: [],
    },
  };
}

describe("study-summary builders", () => {
  it("builds a planned session summary", () => {
    const summary = buildPlannedSessionSummary(makePlan());

    expect(summary.kind).toBe("planned_session");
    expect(summary.headline).toContain("B-focused");
    expect(summary.sections.some((section) => section.title === "Why This Session Was Built")).toBe(true);
    expect(summary.llmPayload.sections.length).toBeGreaterThan(0);
  });

  it("builds a completed session summary", () => {
    const summary = buildCompletedSessionSummary({
      metadata: makePlan().metadata,
      attempts: makeAttempts(),
      activePool: "B",
    });

    expect(summary.kind).toBe("completed_session");
    expect(summary.metrics.totalAttempts).toBe(2);
    expect(summary.sections.some((section) => section.title === "Pool Observation")).toBe(true);
  });

  it("builds a pool-specific weakness summary", () => {
    const summary = buildWeaknessSummary({ report: makeWeaknessReport(), activePool: "B" });

    expect(summary.kind).toBe("weakness_focus");
    expect(summary.primaryTargets[0].pool).toBe("B");
    expect(summary.sections[1].title).toContain("B");
  });

  it("falls back cleanly when data is limited", () => {
    const completed = buildCompletedSessionSummary({ attempts: [], activePool: "baseline" });
    const nextFocus = buildNextFocusSummary({ activePool: "baseline" });

    expect(completed.headline).toContain("No completed session data yet");
    expect(nextFocus.recommendations[0].label).toBe("Build more data");
  });

  it("builds next-focus recommendations from weakness and performance data", () => {
    const completed = buildCompletedSessionSummary({
      metadata: makePlan().metadata,
      attempts: makeAttempts(),
      activePool: "B",
    });
    const nextFocus = buildNextFocusSummary({
      activePool: "B",
      completedSummary: completed,
      weaknessReport: makeWeaknessReport(),
      planMetadata: makePlan().metadata,
    });

    expect(nextFocus.kind).toBe("next_focus");
    expect(nextFocus.recommendations[0].recommendedPool).toBe("B");
    expect(nextFocus.recommendations[0].emphasis).toBe("pool_focus");
  });

  it("supports sessions with no explicit active pool by falling back to baseline", () => {
    const summary = buildCompletedSessionSummary({ attempts: makeAttempts().map((attempt) => ({ ...attempt, activePool: undefined })) });
    expect(summary.activePool).toBe("baseline");
  });
});
