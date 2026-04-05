import { describe, expect, it, vi } from "vitest";
import type { AttemptRow, SrsRow } from "../../../../packages/db/src/repository";
import type { CanonicalDrill } from "../../../../packages/core/src/schemas";
import { createRealHandFollowUpSessionPlan, createTableSimSessionPlan } from "./session-plan-server";
import { loadRealHandFollowUpSessionPlan, loadSessionPlan, TableSimSessionPlanSchema, unwrapPlannedDrills } from "./session-plan";
import type { DailyPlanSessionOverride } from "./daily-plan-session-bridge";

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
  const dailyPlanOverride: DailyPlanSessionOverride = {
    source: "daily-plan",
    recommendedCount: 8,
    sessionLength: 45,
    focusConceptKey: "blocker_effect",
    focusConceptLabel: "Blocker Effect",
    intent: "focus_concept",
    blockKind: "focus_concept",
    blockTitle: "Focus Concept: Blocker Effect",
  };

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

  it("loads a daily-plan-bridged session plan payload with focus override params", async () => {
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
        requestedCount: 8,
        selectedCount: 1,
        reviewCount: 1,
        newCount: 0,
        dueReviewCount: 1,
        weaknessReviewCount: 0,
        weaknessNewCount: 0,
        newMaterialFillCount: 0,
        activePool: "baseline",
        generatedAt: now.toISOString(),
        weaknessTargets: [],
        notes: [],
        dailyPlanOverride,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await loadSessionPlan(8, "baseline", undefined, dailyPlanOverride);

    expect(fetchMock).toHaveBeenCalledWith("/api/session-plan?count=8&pool=baseline&source=daily-plan&sessionLength=45&intent=focus_concept&focusConcept=blocker_effect&focusLabel=Blocker+Effect&blockKind=focus_concept&blockTitle=Focus+Concept%3A+Blocker+Effect");
    expect(plan.metadata.dailyPlanOverride?.focusConceptKey).toBe("blocker_effect");

    vi.unstubAllGlobals();
  });

  it("uses the focused base session plan when launched from a daily plan", () => {
    const drills = [
      makeDrill({
        drill_id: "focus-review",
        node_id: "hu_01",
        title: "Focused Review",
        tags: ["street:river", "pot:srp", "position:oop", "spot:btn_vs_bb", "concept:blocker_effect", "decision:bluff_catch", "pool:baseline"],
      }),
      makeDrill({
        drill_id: "focus-new",
        node_id: "hu_02",
        title: "Focused New",
        tags: ["street:river", "pot:srp", "position:oop", "spot:btn_vs_bb", "concept:blocker_effect", "decision:value_bet", "pool:baseline"],
      }),
      makeDrill({
        drill_id: "other",
        node_id: "hu_03",
        title: "Other Concept",
        tags: ["street:turn", "pot:srp", "position:oop", "spot:btn_vs_bb", "concept:turn_barrel", "decision:probe", "pool:baseline"],
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
          street: "turn",
          pot_type: "SRP",
          players_to_flop: 2,
          hero_position: "BB",
          villain_position: "BTN",
          board: {
            flop: ["As", "Kd", "2c"],
            turn: "7h",
            river: null,
          },
          hero_hand: ["Ah", "Qc"],
          action_history: [],
        },
        decision_point: {
          street: "turn",
          facing: null,
          sizing_buttons_enabled: false,
        },
      }),
    ];
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "focus-review", score: 0.2, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
      makeAttempt({ attempt_id: "a2", drill_id: "focus-review", score: 0.3, missed_tags_json: JSON.stringify(["paired_top_river"]) }),
    ];

    const plan = createTableSimSessionPlan({
      request: {
        count: 2,
        activePool: "baseline",
        focusConceptKey: "blocker_effect",
        dailyPlanOverride,
      },
      inputs: { drills, attempts, srs: [], now },
    });

    expect(plan.metadata.dailyPlanOverride?.focusConceptKey).toBe("blocker_effect");
    expect(plan.metadata.intervention).toBeUndefined();
    expect(plan.metadata.notes[0]).toContain("Daily plan bridge focused this session");
    expect(plan.drills.every((entry) => entry.drill.tags.includes("concept:blocker_effect"))).toBe(true);
  });

  it("creates a targeted real-hand follow-up session with preferred drills first", () => {
    const drills = [
      makeDrill({
        drill_id: "gold-1",
        node_id: "bluff_catch_01",
        title: "Gold Follow-Up",
        tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      }),
      makeDrill({
        drill_id: "concept-2",
        node_id: "bluff_catch_02",
        title: "Concept Match",
        tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
      }),
      makeDrill({
        drill_id: "other-3",
        node_id: "hu_03",
        title: "Other Concept",
        tags: ["street:turn", "concept:turn_barrel"],
      }),
    ];
    const attempts = [
      makeAttempt({ attempt_id: "a1", drill_id: "concept-2", score: 0.25, correct_bool: 0 }),
    ];
    const srs = [makeSrs({ drill_id: "gold-1", due_at: "2026-03-09T00:00:00.000Z" })];

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        preferredDrillIds: ["gold-1"],
        handTitle: "Table Alpha",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        activePool: "baseline",
        count: 6,
      },
      inputs: { drills, attempts, srs, now },
    });

    expect(plan.drills[0]?.drill.drill_id).toBe("gold-1");
    expect(plan.metadata.notes.some((note) => note.includes("Table Alpha"))).toBe(true);
    expect(plan.metadata.notes.some((note) => note.includes("Memory-ambiguous follow-up"))).toBe(true);
    expect(plan.metadata.followUpAudit?.conceptKey).toBe("blocker_effects");
    expect(plan.metadata.followUpAudit?.uncertaintyProfile).toBe("turn_line_fuzzy");
    expect(plan.metadata.followUpAudit?.selectedDrillIds.length).toBe(plan.drills.length);
    expect(plan.metadata.weaknessTargets[0]?.key).toBe("concept:blocker_effects");
    expect(plan.metadata.reviewCount).toBeGreaterThan(0);
    expect(plan.drills[0]?.metadata.assignmentRationale).toContain("closest direct match");
    expect(plan.drills[0]?.metadata.assignmentBucket).toBe("exact_match");
  });

  it("prefers bridge drills for turn-line-fuzzy follow-up sessions", () => {
    const bridgeDrill = makeDrill({
      drill_id: "gold_bc_tr_bridge",
      node_id: "bluff_catch_01",
      title: "Bridge Follow-Up",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      coaching_context: {
        what_changed_by_street: [
          { street: "turn", detail: "Turn line filtered value and preserved delayed bluffs." },
          { street: "river", detail: "River threshold depends on what survived the turn." },
        ],
      },
      steps: [
        {
          step_id: "turn",
          street: "turn",
          prompt: "Turn decision.",
          decision_point: { street: "turn", facing: { action: "check" }, sizing_buttons_enabled: false },
          options: [
            { key: "BET", label: "Bet" },
            { key: "CHECK", label: "Check" },
          ],
          answer: {
            correct: "CHECK",
            accepted: [],
            required_tags: ["equity_denial"],
            explanation: "Check.",
          },
        },
        {
          step_id: "river",
          street: "river",
          prompt: "River decision.",
          decision_point: { street: "river", facing: { action: "bet", size_pct_pot: 75 }, sizing_buttons_enabled: false },
          options: [
            { key: "CALL", label: "Call" },
            { key: "FOLD", label: "Fold" },
          ],
          answer: {
            correct: "CALL",
            accepted: [],
            required_tags: ["paired_top_river"],
            explanation: "Call.",
          },
        },
      ],
    });
    const exactDrill = makeDrill({
      drill_id: "exact_match",
      node_id: "bluff_catch_02",
      title: "Exact Match",
      tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
    });

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        activePool: "baseline",
        count: 2,
      },
      inputs: { drills: [exactDrill, bridgeDrill], attempts: [], srs: [], now },
    });

    expect(plan.drills[0]?.drill.drill_id).toBe("gold_bc_tr_bridge");
    expect(plan.metadata.notes.some((note) => note.includes("Memory-ambiguous follow-up"))).toBe(true);
    expect(plan.drills[0]?.metadata.assignmentBucket).toBe("bridge_reconstruction");
  });

  it("keeps some exact-match reps in a turn-line-fuzzy block instead of filling only bridge drills", () => {
    const bridgeOne = makeDrill({
      drill_id: "gold_bc_tr_bridge_1",
      node_id: "bluff_catch_01",
      title: "Bridge 1",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      coaching_context: { what_changed_by_street: [{ street: "turn", detail: "Turn line is the main filter." }] },
      steps: [{
        step_id: "turn",
        street: "turn",
        prompt: "Turn first.",
        decision_point: { street: "turn", facing: { action: "check" }, sizing_buttons_enabled: false },
        options: [{ key: "CHECK", label: "Check" }],
        answer: { correct: "CHECK", accepted: [], required_tags: ["equity_denial"], explanation: "Check." },
      }],
    });
    const bridgeTwo = makeDrill({
      drill_id: "gold_bc_tr_bridge_2",
      node_id: "bluff_catch_02",
      title: "Bridge 2",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      coaching_context: { what_changed_by_street: [{ street: "turn", detail: "Turn line still matters." }] },
    });
    const exactOne = makeDrill({
      drill_id: "exact_one",
      node_id: "bluff_catch_01",
      title: "Exact One",
      tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
    });
    const exactTwo = makeDrill({
      drill_id: "exact_two",
      node_id: "bluff_catch_02",
      title: "Exact Two",
      tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
    });

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        activePool: "baseline",
        count: 4,
      },
      inputs: { drills: [bridgeOne, bridgeTwo, exactOne, exactTwo], attempts: [], srs: [], now },
    });

    const buckets = plan.drills.map((entry) => entry.metadata.assignmentBucket);
    expect(buckets.filter((bucket) => bucket === "bridge_reconstruction").length).toBeGreaterThan(0);
    expect(buckets.filter((bucket) => bucket === "exact_match").length).toBeGreaterThan(0);
    expect(plan.metadata.notes.some((note) => note.includes("Follow-up mix:"))).toBe(true);
    expect(plan.metadata.followUpAudit?.bucketMix.some((entry) => entry.bucket === "bridge_reconstruction")).toBe(true);
    expect(plan.metadata.followUpAudit?.bucketMix.some((entry) => entry.bucket === "exact_match")).toBe(true);
  });

  it("adds a sizing-fuzzy note when the line is clear but exact sizing is not", () => {
    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "sizing_fuzzy_line_clear",
        activePool: "baseline",
        count: 2,
      },
      inputs: {
        drills: [makeDrill({
          drill_id: "gold_bc_tr_size",
          node_id: "bluff_catch_01",
          title: "Sizing Fuzzy Bridge",
          tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
          coaching_context: {
            what_changed_by_street: [
              { street: "turn", detail: "Turn line preserved bluffs while capping some thin value." },
            ],
          },
          answer_by_pool: {
            B: {
              correct: "FOLD",
              accepted: [],
              required_tags: ["paired_top_river"],
              explanation: "Fold in tighter pools.",
            },
          },
        })],
        attempts: [],
        srs: [],
        now,
      },
    });

    expect(plan.metadata.notes.some((note) => note.includes("Sizing-fuzzy follow-up"))).toBe(true);
    expect(plan.drills[0]?.metadata.assignmentBucket).toBe("sizing_stability");
  });

  it("adds a memory-decisive note when the recalled turn story may flip the answer", () => {
    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "memory_decisive",
        activePool: "baseline",
        count: 2,
      },
      inputs: {
        drills: [makeDrill({
          drill_id: "gold_bc_tr_memory",
          node_id: "bluff_catch_02",
          title: "Memory Decisive",
          tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
          steps: [{
            step_id: "resolve_memory",
            street: "turn",
            prompt: "Resolve memory.",
            decision_point: { street: "turn", facing: { action: "check" }, sizing_buttons_enabled: false },
            options: [{ key: "CHECK", label: "Check-through" }],
            answer: { correct: "CHECK", accepted: [], required_tags: ["equity_denial"], explanation: "Check." },
          }],
          answer_by_pool: {
            B: {
              correct: "FOLD",
              accepted: [],
              required_tags: ["paired_top_river"],
              explanation: "Fold.",
            },
          },
        })],
        attempts: [],
        srs: [],
        now,
      },
    });

    expect(plan.metadata.notes.some((note) => note.includes("Memory-decisive follow-up"))).toBe(true);
    expect(plan.drills[0]?.metadata.assignmentBucket).toBe("memory_decisive");
    expect(plan.drills[0]?.metadata.assignmentRationale).toContain("turn version");
  });

  it("prioritizes memory-decisive reps before bridge and exact-match filler", () => {
    const memoryDrill = makeDrill({
      drill_id: "gold_bc_memory_flip",
      node_id: "bluff_catch_02",
      title: "Memory Flip",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      answer_by_pool: {
        B: {
          correct: "FOLD",
          accepted: [],
          required_tags: ["paired_top_river"],
          explanation: "Fold.",
        },
      },
      steps: [{
        step_id: "resolve_memory",
        street: "turn",
        prompt: "Which turn happened?",
        decision_point: { street: "turn", facing: { action: "check" }, sizing_buttons_enabled: false },
        options: [{ key: "CHECK", label: "Check-through" }],
        answer: { correct: "CHECK", accepted: [], required_tags: ["equity_denial"], explanation: "Check." },
      }],
    });
    const bridgeDrill = makeDrill({
      drill_id: "gold_bc_tr_bridge_memory",
      node_id: "bluff_catch_01",
      title: "Bridge Memory",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      coaching_context: { what_changed_by_street: [{ street: "turn", detail: "Turn story controls river." }] },
    });
    const exactDrill = makeDrill({
      drill_id: "exact_memory",
      node_id: "bluff_catch_01",
      title: "Exact Memory",
      tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
    });

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "memory_decisive",
        activePool: "baseline",
        count: 3,
      },
      inputs: { drills: [exactDrill, bridgeDrill, memoryDrill], attempts: [], srs: [], now },
    });

    expect(plan.drills[0]?.metadata.assignmentBucket).toBe("memory_decisive");
    expect(plan.drills.map((entry) => entry.metadata.assignmentBucket)).toContain("bridge_reconstruction");
  });

  it("overweights corrective buckets ahead of the default uncertainty mix", () => {
    const exactDrill = makeDrill({
      drill_id: "exact_bucket",
      node_id: "bluff_catch_01",
      title: "Exact Bucket",
      tags: ["street:river", "decision:bluff_catch", "concept:blocker_effect"],
    });
    const bridgeDrill = makeDrill({
      drill_id: "bridge_bucket",
      node_id: "bluff_catch_02",
      title: "Bridge Bucket",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      coaching_context: {
        what_changed_by_street: [{ street: "turn", detail: "Turn line is the main filter." }],
      },
    });
    const sizingDrill = makeDrill({
      drill_id: "sizing_bucket",
      node_id: "bluff_catch_01",
      title: "Sizing Bucket",
      tags: ["street:river", "spot:btn_vs_bb", "decision:bluff_catch", "concept:blocker_effect"],
      answer_by_pool: {
        B: {
          correct: "FOLD",
          accepted: [],
          required_tags: ["paired_top_river"],
          explanation: "Fold in tighter pools.",
        },
      },
    });

    const plan = createRealHandFollowUpSessionPlan({
      request: {
        conceptKey: "blocker_effects",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        correctiveBuckets: ["sizing_stability"],
        activePool: "baseline",
        count: 3,
      },
      inputs: { drills: [exactDrill, bridgeDrill, sizingDrill], attempts: [], srs: [], now },
    });

    expect(plan.drills.map((entry) => entry.metadata.assignmentBucket)).toContain("sizing_stability");
    expect(plan.metadata.followUpAudit?.bucketMix.some((entry) => entry.bucket === "sizing_stability")).toBe(true);
    expect(plan.metadata.notes.some((note) => note.includes("Corrective weighting applied"))).toBe(true);
  });

  it("sends corrective buckets in the real-hand follow-up request payload", async () => {
    const payload = {
      drills: [
        {
          drill: makeDrill({ drill_id: "gold-1", node_id: "bluff_catch_01", title: "Gold Follow-Up" }),
          kind: "review",
          reason: "due_review",
          matchedWeaknessTargets: ["concept:blocker_effects", "source:real_hand_follow_up"],
          metadata: { priorAttempts: 1, dueAt: now.toISOString(), lastScore: 0.3, weaknessPriority: 1 },
        },
      ],
      metadata: {
        requestedCount: 6,
        selectedCount: 1,
        reviewCount: 1,
        newCount: 0,
        dueReviewCount: 1,
        weaknessReviewCount: 0,
        weaknessNewCount: 0,
        newMaterialFillCount: 0,
        activePool: "baseline",
        generatedAt: now.toISOString(),
        weaknessTargets: [
          { type: "classification_tag", key: "concept:blocker_effects", scope: "overall", sampleSize: 1, priority: 1 },
        ],
        notes: ["Targeted real-hand follow-up focused on blocker effects."],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadRealHandFollowUpSessionPlan({
      conceptKey: "blocker_effects",
      preferredDrillIds: ["gold-1"],
      correctiveBuckets: ["bridge_reconstruction", "memory_decisive"],
      handTitle: "Table Alpha",
      handSource: "manual",
      parseStatus: "partial",
      uncertaintyProfile: "turn_line_fuzzy",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/real-hands/follow-up-session", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        conceptKey: "blocker_effects",
        activePool: "baseline",
        preferredDrillIds: ["gold-1"],
        correctiveBuckets: ["bridge_reconstruction", "memory_decisive"],
        handTitle: "Table Alpha",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        count: undefined,
      }),
    }));

    vi.unstubAllGlobals();
  });

  it("loads a real-hand follow-up session payload from the API route", async () => {
    const payload = {
      drills: [
        {
          drill: makeDrill({ drill_id: "gold-1", node_id: "bluff_catch_01", title: "Gold Follow-Up" }),
          kind: "review",
          reason: "due_review",
          matchedWeaknessTargets: ["concept:blocker_effects", "source:real_hand_follow_up"],
          metadata: { priorAttempts: 1, dueAt: now.toISOString(), lastScore: 0.3, weaknessPriority: 1 },
        },
      ],
      metadata: {
        requestedCount: 6,
        selectedCount: 1,
        reviewCount: 1,
        newCount: 0,
        dueReviewCount: 1,
        weaknessReviewCount: 0,
        weaknessNewCount: 0,
        newMaterialFillCount: 0,
        activePool: "baseline",
        generatedAt: now.toISOString(),
        weaknessTargets: [
          { type: "classification_tag", key: "concept:blocker_effects", scope: "overall", sampleSize: 1, priority: 1 },
        ],
        notes: ["Targeted real-hand follow-up focused on blocker effects."],
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = await loadRealHandFollowUpSessionPlan({
      conceptKey: "blocker_effects",
      preferredDrillIds: ["gold-1"],
      handTitle: "Table Alpha",
      handSource: "manual",
      parseStatus: "partial",
      uncertaintyProfile: "turn_line_fuzzy",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/real-hands/follow-up-session", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conceptKey: "blocker_effects",
        activePool: "baseline",
        preferredDrillIds: ["gold-1"],
        correctiveBuckets: [],
        handTitle: "Table Alpha",
        handSource: "manual",
        parseStatus: "partial",
        uncertaintyProfile: "turn_line_fuzzy",
        count: undefined,
      }),
    }));
    expect(plan.metadata.notes[0]).toContain("blocker effects");

    vi.unstubAllGlobals();
  });
});
