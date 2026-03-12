import { describe, expect, it, vi } from "vitest";
import type { AttemptRow, SrsRow } from "../../../../packages/db/src/repository";
import type { CanonicalDrill } from "../../../../packages/core/src/schemas";
import { createTableSimSessionPlan } from "./session-plan-server";
import { loadSessionPlan, TableSimSessionPlanSchema, unwrapPlannedDrills } from "./session-plan";

function makeDrill(overrides: Partial<CanonicalDrill> & Pick<CanonicalDrill, "drill_id" | "node_id" | "title">): CanonicalDrill {
  return {
    drill_id: overrides.drill_id,
    node_id: overrides.node_id,
    version: "1.0.0",
    title: overrides.title,
    prompt: overrides.prompt ?? `${overrides.title} prompt`,
    scenario: overrides.scenario ?? {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: {
        flop: ["As", "Kd", "2c"],
        turn: "7h",
        river: "3d",
      },
      hero_hand: ["Ah", "Qc"],
      action_history: [],
    },
    decision_point: overrides.decision_point ?? {
      street: "river",
      facing: { action: "bet", size_pct_pot: 75 },
      sizing_buttons_enabled: false,
    },
    options: overrides.options ?? [
      { key: "CALL", label: "Call" },
      { key: "FOLD", label: "Fold" },
    ],
    answer: overrides.answer ?? {
      correct: "CALL",
      accepted: [],
      required_tags: ["paired_top_river"],
      explanation: "Call.",
    },
    answer_by_pool: overrides.answer_by_pool,
    tags: overrides.tags ?? [
      "street:river",
      "pot:srp",
      "position:oop",
      "spot:btn_vs_bb",
      "concept:blocker_effect",
      "decision:bluff_catch",
      "pool:baseline",
    ],
    difficulty: overrides.difficulty ?? 2,
  };
}

function makeAttempt(overrides: Partial<AttemptRow> & Pick<AttemptRow, "attempt_id" | "drill_id" | "score">): AttemptRow {
  return {
    attempt_id: overrides.attempt_id,
    drill_id: overrides.drill_id,
    ts: overrides.ts ?? new Date().toISOString(),
    user_answer_json: overrides.user_answer_json ?? JSON.stringify({ answer: "CALL" }),
    correct_bool: overrides.correct_bool ?? 0,
    score: overrides.score,
    elapsed_ms: overrides.elapsed_ms ?? 0,
    missed_tags_json: overrides.missed_tags_json ?? JSON.stringify([]),
    active_pool: overrides.active_pool,
  };
}

function makeSrs(overrides: Partial<SrsRow> & Pick<SrsRow, "drill_id" | "due_at">): SrsRow {
  return {
    drill_id: overrides.drill_id,
    due_at: overrides.due_at,
    interval_days: overrides.interval_days ?? 1,
    ease: overrides.ease ?? 2.5,
    repetitions: overrides.repetitions ?? 1,
    last_score: overrides.last_score ?? 0.4,
  };
}

describe("table-sim session plan integration", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("creates a generated session plan for table-sim with stable sizing and no duplicates", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Due" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "Weakness Match" }),
      makeDrill({ drill_id: "d3", node_id: "hu_03", title: "Fresh" }),
    ];
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d2", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d2", score: 0.3, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];
    const srs = [makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = createTableSimSessionPlan({
      request: { count: 3, activePool: "baseline" },
      inputs: { drills, attempts, srs, now },
    });

    expect(plan.drills).toHaveLength(3);
    expect(new Set(plan.drills.map((entry) => entry.drill.drill_id)).size).toBe(3);
    expect(plan.metadata.selectedCount).toBe(3);
  });

  it("propagates active pool and selection metadata", () => {
    const drills = [
      makeDrill({
        drill_id: "d1",
        node_id: "hu_01",
        title: "Pool Spot",
        answer_by_pool: {
          B: {
            correct: "FOLD",
            accepted: [],
            required_tags: ["paired_top_river", "underfold_exploit"],
            explanation: "Pool B folds more.",
          },
        },
      }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "Weakness Match" }),
    ];
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d2", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d2", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];
    const srs = [makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = createTableSimSessionPlan({
      request: { count: 2, activePool: "B" },
      inputs: { drills, attempts, srs, now },
    });

    expect(plan.metadata.activePool).toBe("B");
    expect(plan.drills[0].reason).toBe("due_review");
    expect(plan.drills[1].matchedWeaknessTargets.length).toBeGreaterThan(0);
    expect(plan.metadata.weaknessTargets.length).toBeGreaterThan(0);
  });

  it("remains compatible with existing table-sim drill consumers via unwrapPlannedDrills", () => {
    const plan = TableSimSessionPlanSchema.parse({
      drills: [
        {
          drill: makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Compat" }),
          kind: "new",
          reason: "new_material_fill",
          matchedWeaknessTargets: [],
          metadata: { priorAttempts: 0 },
        },
      ],
      metadata: {
        requestedCount: 1,
        selectedCount: 1,
        reviewCount: 0,
        newCount: 1,
        dueReviewCount: 0,
        weaknessReviewCount: 0,
        weaknessNewCount: 0,
        newMaterialFillCount: 1,
        activePool: "baseline",
        generatedAt: now.toISOString(),
        weaknessTargets: [],
        notes: [],
      },
    });

    const drills = unwrapPlannedDrills(plan);
    expect(drills).toHaveLength(1);
    expect(drills[0].title).toBe("Compat");
    expect(drills[0].scenario.board?.flop).toEqual(["As", "Kd", "2c"]);
  });

  it("loads and parses a session plan payload from the API route with pool context", async () => {
    const payload = {
      drills: [
        {
          drill: makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Loaded" }),
          kind: "review",
          reason: "due_review",
          matchedWeaknessTargets: ["classification_tag:concept:blocker_effect"],
          metadata: { priorAttempts: 2, dueAt: now.toISOString(), lastScore: 0.4 },
        },
      ],
      metadata: {
        requestedCount: 1,
        selectedCount: 1,
        reviewCount: 1,
        newCount: 0,
        dueReviewCount: 1,
        weaknessReviewCount: 0,
        weaknessNewCount: 0,
        newMaterialFillCount: 0,
        activePool: "B",
        generatedAt: now.toISOString(),
        weaknessTargets: [],
        notes: [],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await loadSessionPlan(5, "B");

    expect(fetchMock).toHaveBeenCalledWith("/api/session-plan?count=5&pool=B");
    expect(plan.drills[0].reason).toBe("due_review");
    expect(plan.metadata.reviewCount).toBe(1);
    expect(plan.metadata.activePool).toBe("B");

    vi.unstubAllGlobals();
  });
});
