import { describe, expect, it } from "vitest";
import {
  buildCompletedSessionCoachPrompt,
  buildFallbackCoachResponse,
  buildNextFocusCoachPrompt,
  buildPlannedSessionCoachPrompt,
  generateCoachResponse,
  type CoachProvider,
} from "../ai-coach";
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

describe("ai coach foundation", () => {
  const planned = buildPlannedSessionSummary(makePlan());
  const completed = buildCompletedSessionSummary({
    metadata: makePlan().metadata,
    attempts: makeAttempts(),
    activePool: "B",
  });
  const weakness = buildWeaknessSummary({ report: makeWeaknessReport(), activePool: "B" });
  const nextFocus = buildNextFocusSummary({
    activePool: "B",
    completedSummary: completed,
    weaknessReport: makeWeaknessReport(),
    planMetadata: makePlan().metadata,
  });

  it("builds a planned-session coach prompt from structured summary data", () => {
    const prompt = buildPlannedSessionCoachPrompt(planned);

    expect(prompt.mode).toBe("planned_session");
    expect(prompt.userPrompt).toContain("why this session was built");
    expect(prompt.sections.length).toBeGreaterThan(0);
    expect(prompt.llmPayload.kind).toBe("planned_session");
  });

  it("builds a completed-session coach prompt", () => {
    const prompt = buildCompletedSessionCoachPrompt(completed);

    expect(prompt.mode).toBe("completed_session");
    expect(prompt.userPrompt).toContain("how the player performed");
    expect(prompt.activePool).toBe("B");
  });

  it("builds a next-focus coach prompt", () => {
    const prompt = buildNextFocusCoachPrompt(nextFocus);

    expect(prompt.mode).toBe("next_focus");
    expect(prompt.userPrompt).toContain("what the player should study next");
  });

  it("produces deterministic fallback coach text", () => {
    const response = buildFallbackCoachResponse(weakness);

    expect(response.source).toBe("fallback");
    expect(response.text).toContain("Coach view");
    expect(response.sections.length).toBeGreaterThan(0);
  });

  it("supports sessions with no explicit active pool by falling back to baseline", () => {
    const baselineCompleted = buildCompletedSessionSummary({ attempts: [] });
    const response = buildFallbackCoachResponse(baselineCompleted);

    expect(response.activePool).toBe("baseline");
    expect(response.mode).toBe("completed_session");
  });

  it("preserves output shape when using a provider seam", async () => {
    const provider: CoachProvider = {
      async generate(prompt) {
        return {
          text: `Provider text for ${prompt.mode}`,
          bullets: [prompt.headline],
          providerName: "test-provider",
          model: "unit-model",
        };
      },
    };

    const response = await generateCoachResponse({ summary: completed, provider });

    expect(response.source).toBe("provider");
    expect(response.providerName).toBe("test-provider");
    expect(response.model).toBe("unit-model");
    expect(response.bullets).toEqual([completed.headline]);
  });
});
