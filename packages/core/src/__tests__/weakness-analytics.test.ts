import { describe, expect, it } from "vitest";
import type { AttemptRow } from "@poker-coach/db";
import { analyzeWeaknessAnalytics, selectWeaknessTargetsForPool, type WeaknessAnalyticsReport } from "../weakness-analytics";
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

describe("weakness analytics", () => {
  it("aggregates overall weakness signals", () => {
    const drill = makeDrill({ drill_id: "d1", node_id: "hu_01", title: "River Spot" });
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d1", score: 0.3, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];

    const report = analyzeWeaknessAnalytics({
      attempts,
      drillMap: new Map([[drill.drill_id, drill]]),
      weaknessThreshold: 0.5,
      minAttempts: 2,
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(report.overallTargets.some((target) => target.key === "concept:blocker_effect")).toBe(true);
    expect(report.overallTargets.some((target) => target.key === "hu_01")).toBe(true);
    expect(report.overallTargets.some((target) => target.key === "paired_top_river")).toBe(true);
  });

  it("segments weakness signals by pool", () => {
    const drill = makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Pool Spot" });
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, active_pool: "B", missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d1", score: 0.3, active_pool: "B", missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a3", drill_id: "d1", score: 0.9, active_pool: "A", correct_bool: 1 }),
      makeAttempt({ attempt_id: "a4", drill_id: "d1", score: 0.8, active_pool: "A", correct_bool: 1 }),
    ];

    const report = analyzeWeaknessAnalytics({
      attempts,
      drillMap: new Map([[drill.drill_id, drill]]),
      weaknessThreshold: 0.55,
      minAttempts: 2,
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(report.poolTargets.B.some((target) => target.key === "concept:blocker_effect" && target.scope === "pool")).toBe(true);
    expect(report.poolTargets.A).toHaveLength(0);
  });

  it("keeps legacy no-pool attempts in overall analytics but out of pool views", () => {
    const drill = makeDrill({ drill_id: "d1", node_id: "hu_01", title: "Legacy Spot" });
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "d1", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "d1", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];

    const report = analyzeWeaknessAnalytics({
      attempts,
      drillMap: new Map([[drill.drill_id, drill]]),
      weaknessThreshold: 0.5,
      minAttempts: 2,
    });

    expect(report.overallTargets.length).toBeGreaterThan(0);
    expect(report.poolTargets.baseline).toHaveLength(0);
    expect(report.poolTargets.A).toHaveLength(0);
    expect(report.poolTargets.B).toHaveLength(0);
    expect(report.poolTargets.C).toHaveLength(0);
  });

  it("prefers pool-specific targets before overall fallback", () => {
    const report: WeaknessAnalyticsReport = {
      generatedAt: "2026-03-10T12:00:00.000Z",
      thresholds: { weaknessThreshold: 0.5, minAttempts: 2 },
      overallTargets: [
        { type: "classification_tag", key: "concept:blocker_effect", scope: "overall", sampleSize: 5, accuracy: 0.4, priority: 0.6 },
      ],
      poolTargets: {
        baseline: [],
        A: [],
        B: [
          { type: "node", key: "hu_01", scope: "pool", pool: "B", sampleSize: 3, accuracy: 0.3, priority: 0.7 },
        ],
        C: [],
      },
    };

    const selected = selectWeaknessTargetsForPool(report, "B");

    expect(selected[0].scope).toBe("pool");
    expect(selected[0].key).toBe("hu_01");
    expect(selected[1].scope).toBe("overall");
  });
});

