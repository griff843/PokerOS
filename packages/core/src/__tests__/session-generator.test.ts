import { describe, expect, it } from "vitest";
import type { AttemptRow, SrsRow } from "@poker-coach/db";
import { generateSessionPlan } from "../session-generator";
import type { CanonicalDrill } from "../schemas";

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
      explanation: "Call is correct.",
    },
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
    answer_by_pool: overrides.answer_by_pool,
    steps: overrides.steps,
    coaching_context: overrides.coaching_context,
    metadata: overrides.metadata,
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
    last_score: overrides.last_score ?? 0.5,
  };
}

describe("generateSessionPlan", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");

  it("selects due review drills first", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Due 1" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "Due 2" }),
      makeDrill({ drill_id: "d3", node_id: "hu_03", title: "New" }),
    ];
    const srs = [
      makeSrs({ drill_id: "d2", due_at: "2026-03-08T00:00:00.000Z" }),
      makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" }),
    ];

    const plan = generateSessionPlan({ count: 2 }, { drills, attempts: [], srs, now });

    expect(plan.drills.map((entry) => entry.drill.drill_id)).toEqual(["d2", "d1"]);
    expect(plan.drills.every((entry) => entry.reason === "due_review")).toBe(true);
  });

  it("builds a mixed review and new session when due reviews are insufficient", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Due" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "New A" }),
      makeDrill({ drill_id: "d3", node_id: "hu_03", title: "New B" }),
    ];
    const srs = [makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = generateSessionPlan({ count: 3 }, { drills, attempts: [], srs, now });

    expect(plan.metadata.reviewCount).toBe(1);
    expect(plan.metadata.newCount).toBe(2);
    expect(plan.drills).toHaveLength(3);
  });

  it("never selects duplicate drills in one session", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Shared" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "Other" }),
    ];
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];
    const srs = [makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = generateSessionPlan({ count: 2 }, { drills, attempts, srs, now });
    const ids = plan.drills.map((entry) => entry.drill.drill_id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns stable session sizing up to available content", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "One" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "Two" }),
    ];

    const exactPlan = generateSessionPlan({ count: 2 }, { drills, attempts: [], srs: [], now });
    const cappedPlan = generateSessionPlan({ count: 5 }, { drills, attempts: [], srs: [], now });

    expect(exactPlan.drills).toHaveLength(2);
    expect(cappedPlan.drills).toHaveLength(2);
    expect(cappedPlan.metadata.notes).toContain("Available content could not fully satisfy the requested session size.");
  });

  it("emits reason-for-selection metadata", () => {
    const drills = [
      makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Due" }),
      makeDrill({ drill_id: "d2", node_id: "hu_02", title: "New" }),
    ];
    const srs = [makeSrs({ drill_id: "d1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = generateSessionPlan({ count: 2 }, { drills, attempts: [], srs, now });

    expect(plan.drills[0].reason).toBe("due_review");
    expect(["weakness_new", "new_material_fill"]).toContain(plan.drills[1].reason);
    expect(plan.metadata.dueReviewCount).toBe(1);
  });

  it("targets weakness signals when attempt history supports them", () => {
    const weakRiverDrill = makeDrill({
      drill_id: "d1",
      node_id: "hu_01",
      title: "Weak River",
    });
    const supportingNewDrill = makeDrill({
      drill_id: "d2",
      node_id: "hu_04",
      title: "Weakness Match New",
      tags: [
        "street:river",
        "pot:srp",
        "position:ip",
        "spot:co_vs_btn",
        "concept:blocker_effect",
        "decision:value_bet",
        "pool:baseline",
      ],
    });
    const unrelatedDrill = makeDrill({
      drill_id: "d3",
      node_id: "hu_05",
      title: "Unrelated",
      tags: [
        "street:flop",
        "pot:srp",
        "position:ip",
        "spot:co_vs_btn",
        "concept:equity_denial",
        "decision:cbet",
        "pool:baseline",
      ],
      answer: {
        correct: "BET",
        accepted: [],
        required_tags: ["equity_denial"],
        explanation: "Bet.",
      },
      options: [
        { key: "BET", label: "Bet" },
        { key: "CHECK", label: "Check" },
      ],
      scenario: {
        game: "NLHE Cash",
        street: "flop",
        pot_type: "SRP",
        players_to_flop: 2,
        hero_position: "BTN",
        villain_position: "BB",
        board: {
          flop: ["Ah", "8c", "3d"],
          turn: null,
          river: null,
        },
        hero_hand: ["Kd", "Qd"],
        action_history: [],
      },
      decision_point: {
        street: "flop",
        facing: null,
        sizing_buttons_enabled: false,
      },
    });

    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, correct_bool: 0, missed_tags_json: JSON.stringify(["paired_top_river"]), ts: "2026-03-10T11:00:00.000Z" }),
      makeAttempt({ attempt_id: "a2", drill_id: "d1", score: 0.3, correct_bool: 0, missed_tags_json: JSON.stringify(["paired_top_river"]), ts: "2026-03-09T11:00:00.000Z" }),
    ];

    const plan = generateSessionPlan(
      { count: 2, reviewRatio: 0.5 },
      { drills: [weakRiverDrill, supportingNewDrill, unrelatedDrill], attempts, srs: [], now }
    );

    expect(plan.metadata.weaknessTargets.some((target) => target.key === "concept:blocker_effect" && target.scope === "overall")).toBe(true);
    expect(plan.drills[0].drill.drill_id).toBe("d1");
    expect(plan.drills[0].reason).toBe("weakness_review");
    expect(plan.drills[1].drill.drill_id).toBe("d2");
    expect(plan.drills[1].reason).toBe("weakness_new");
  });

  it("prefers pool-specific weakness targets when an active pool is selected", () => {
    const poolBDrill = makeDrill({
      drill_id: "d1",
      node_id: "hu_pool_b",
      title: "Pool B Exploit",
      answer_by_pool: {
        B: {
          correct: "FOLD",
          accepted: [],
          required_tags: ["underfold_exploit"],
          explanation: "Exploit pool B under-bluffs.",
        },
      },
      tags: [
        "street:river",
        "pot:srp",
        "position:oop",
        "spot:btn_vs_bb",
        "concept:blocker_effect",
        "decision:bluff_catch",
        "pool:pool_b",
      ],
    });
    const overallDrill = makeDrill({
      drill_id: "d2",
      node_id: "hu_overall",
      title: "Overall Weakness",
      tags: [
        "street:river",
        "pot:srp",
        "position:oop",
        "spot:btn_vs_bb",
        "concept:blocker_effect",
        "decision:value_bet",
        "pool:baseline",
      ],
    });
    const fillerDrill = makeDrill({ drill_id: "d3", node_id: "hu_fill", title: "Filler" });

    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, active_pool: "B", missed_tags_json: JSON.stringify(["underfold_exploit"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d1", score: 0.3, active_pool: "B", missed_tags_json: JSON.stringify(["underfold_exploit"]) }),
      makeAttempt({ attempt_id: "a3", drill_id: "d2", score: 0.3, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a4", drill_id: "d2", score: 0.4, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];

    const plan = generateSessionPlan(
      { count: 2, reviewRatio: 0.5, activePool: "B" },
      { drills: [poolBDrill, overallDrill, fillerDrill], attempts, srs: [], now }
    );

    expect(plan.metadata.activePool).toBe("B");
    expect(plan.metadata.weaknessTargets[0]?.scope).toBe("pool");
    expect(plan.metadata.weaknessTargets[0]?.pool).toBe("B");
    expect(plan.drills[0].drill.drill_id).toBe("d1");
    expect(plan.drills[0].matchedWeaknessTargets.some((key) => key.startsWith("pool:B:"))).toBe(true);
  });
});
