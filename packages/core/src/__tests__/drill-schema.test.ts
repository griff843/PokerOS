import { describe, expect, it } from "vitest";
import {
  CanonicalDrillSchema,
  type CanonicalDrill,
} from "../schemas";
import { adaptLegacyTableSimDrill, resolveDrillAnswer } from "../drills";

const singleDecisionDrill: CanonicalDrill = {
  drill_id: "srp_river_bluffcatch_01",
  node_id: "hu_01",
  version: "1.0.0",
  title: "SRP River Bluff-Catch",
  prompt: "River bluff-catch spot.",
  scenario: {
    game: "NLHE Cash",
    street: "river",
    pot_type: "SRP",
    players_to_flop: 2,
    hero_position: "BB",
    villain_position: "BTN",
    effective_stack_bb: 100,
    pot_size_bb: 12,
    board: {
      flop: ["Js", "7c", "3d"],
      turn: "2h",
      river: "Jd",
    },
    hero_hand: ["Jh", "9h"],
    action_history: [],
  },
  decision_point: {
    street: "river",
    facing: { action: "bet", size_pct_pot: 75 },
    sizing_buttons_enabled: false,
  },
  options: [
    { key: "CALL", label: "Call" },
    { key: "FOLD", label: "Fold" },
    { key: "RAISE", label: "Raise" },
  ],
  answer: {
    correct: "CALL",
    accepted: [],
    required_tags: ["paired_top_river"],
    explanation: "Trips is too strong to fold.",
  },
  tags: [
    "street:river",
    "pot:srp",
    "position:oop",
    "spot:btn_vs_bb",
    "board:paired",
    "concept:blocker_effect",
    "decision:bluff_catch",
  ],
  difficulty: 2,
};

describe("CanonicalDrillSchema", () => {
  it("accepts a valid single-decision drill", () => {
    expect(CanonicalDrillSchema.parse(singleDecisionDrill)).toEqual(singleDecisionDrill);
  });

  it("accepts optional solver frequency payloads on answers", () => {
    const drill = CanonicalDrillSchema.parse({
      ...singleDecisionDrill,
      answer: {
        ...singleDecisionDrill.answer,
        strategy_mix: [
          { action: "CALL", frequency_pct: 42 },
          { action: "FOLD", frequency_pct: 58 },
          { action: "RAISE", frequency_pct: 0 },
        ],
      },
    });

    expect(drill.answer.strategy_mix?.[0]?.frequency_pct).toBe(42);
  });

  it("accepts a valid pool-aware drill and resolves pool answers", () => {
    const drill = CanonicalDrillSchema.parse({
      ...singleDecisionDrill,
      drill_id: "srp_pool_aware_01",
      answer_by_pool: {
        B: {
          correct: "FOLD",
          accepted: [],
          required_tags: ["paired_top_river", "underfold_exploit"],
          explanation: "Pool B under-bluffs here.",
        },
      },
      tags: [...singleDecisionDrill.tags, "pool:pool_b"],
    });

    expect(resolveDrillAnswer(drill, "B").correct).toBe("FOLD");
    expect(resolveDrillAnswer(drill, "A").correct).toBe("CALL");
  });

  it("accepts a valid preflop drill", () => {
    const drill = CanonicalDrillSchema.parse({
      drill_id: "pf_3bet_btn_vs_co_01",
      node_id: "pf_3bet_btn_vs_co",
      version: "1.0.0",
      title: "Preflop 3-Bet Decision",
      prompt: "CO opens and you are on the BTN with AJo.",
      scenario: {
        game: "NLHE Cash",
        street: "preflop",
        pot_type: "SRP",
        players_to_flop: 2,
        hero_position: "BTN",
        villain_position: "CO",
        effective_stack_bb: 100,
        board: null,
        hero_hand: ["As", "Jd"],
        action_history: [
          { street: "preflop", player: "villain", action: "open", size_bb: 3 },
        ],
      },
      decision_point: {
        street: "preflop",
        facing: { action: "open", size_bb: 3 },
        sizing_buttons_enabled: false,
      },
      options: [
        { key: "CALL", label: "Call" },
        { key: "3BET", label: "3-Bet" },
        { key: "FOLD", label: "Fold" },
      ],
      answer: {
        correct: "3BET",
        accepted: ["CALL"],
        required_tags: ["range_advantage_ip"],
        explanation: "AJo is a standard button 3-bet.",
      },
      tags: [
        "street:preflop",
        "pot:srp",
        "position:ip",
        "spot:co_vs_btn",
        "concept:3bet_construction",
        "decision:3bet",
      ],
      difficulty: 2,
    });

    expect(drill.scenario.board).toBeNull();
  });

  it("accepts a valid multi-street drill", () => {
    const drill = CanonicalDrillSchema.parse({
      ...singleDecisionDrill,
      drill_id: "srp_flop_turn_barrel_01",
      title: "SRP Double Barrel Decision",
      scenario: {
        ...singleDecisionDrill.scenario,
        street: "flop",
        hero_position: "BTN",
        villain_position: "BB",
        board: {
          flop: ["Ah", "8c", "3d"],
          turn: null,
          river: null,
        },
        hero_hand: ["Kd", "Qd"],
      },
      decision_point: {
        street: "flop",
        facing: null,
        sizing_buttons_enabled: false,
      },
      options: [
        { key: "BET", label: "C-bet 33% pot" },
        { key: "CHECK", label: "Check" },
      ],
      answer: {
        correct: "BET",
        accepted: [],
        required_tags: ["cbet_dry_flop"],
        explanation: "Dry ace-high flop favors the preflop raiser.",
      },
      tags: [
        "street:flop",
        "street:turn",
        "pot:srp",
        "position:ip",
        "spot:bb_vs_btn",
        "board:dry",
        "concept:double_barrel",
        "decision:cbet",
      ],
      difficulty: 3,
      steps: [
        {
          step_id: "flop",
          street: "flop",
          prompt: "Flop decision.",
          decision_point: { street: "flop", facing: null, sizing_buttons_enabled: false },
          options: [
            { key: "BET", label: "C-bet 33% pot" },
            { key: "CHECK", label: "Check" },
          ],
          answer: {
            correct: "BET",
            accepted: [],
            required_tags: ["cbet_dry_flop"],
            explanation: "Bet small.",
          },
        },
        {
          step_id: "turn",
          street: "turn",
          prompt: "Turn decision.",
          board_update: { turn: "Td" },
          decision_point: { street: "turn", facing: null, sizing_buttons_enabled: false },
          options: [
            { key: "BET", label: "Barrel 66% pot" },
            { key: "CHECK", label: "Check back" },
          ],
          answer: {
            correct: "BET",
            accepted: ["CHECK"],
            required_tags: ["equity_denial"],
            explanation: "Keep the pressure on.",
          },
        },
      ],
    });

    expect(drill.steps).toHaveLength(2);
  });

  it("accepts richer authored coaching context on drills and steps", () => {
    const drill = CanonicalDrillSchema.parse({
      ...singleDecisionDrill,
      coaching_context: {
        key_concept: "Range advantage shifts by street.",
        range_context: "Hero uncaps on the river while Villain keeps natural bluffs.",
        range_notes: [
          "Top pair is not auto-call when the runout improves Villain's value region.",
          "Blockers matter most once the bluff region thins out.",
        ],
        range_support: {
          value_buckets: [
            { label: "Strong value", combos: ["boats", "AJ"], note: "Value still exists even when the board pairs." },
          ],
          bluff_buckets: [
            { label: "Missed floats", combos: ["T9", "98"], frequency_hint: "Occasional bluff" },
          ],
          bluff_catchers: [
            { label: "Trips", combos: ["J9", "JT"], note: "These combos sit high enough to defend." },
          ],
          threshold_notes: ["This hand sits above the bluff-catching threshold."],
          blocker_notes: ["Holding a jack trims Villain's value region."],
          hero_hand_bucket: {
            label: "This combo",
            summary: "High-end bluff catcher",
          },
        },
        common_mistake: "Calling because the hand looks too strong to fold.",
        common_mistakes: [
          "Overvaluing absolute hand strength without checking value density.",
          "Ignoring how the river card improves Villain's strongest hands.",
        ],
        what_changed_by_street: [
          { street: "flop", detail: "Villain keeps both value and natural barrel candidates." },
          { street: "turn", detail: "The turn bricks, so bluffs continue while value stays narrow." },
          { street: "river", detail: "The river shifts more combos into value, tightening the bluff threshold." },
        ],
        difficulty_reason: "The scare card improves both Hero's hand and Villain's value range.",
        why_preferred_line_works: "Calling works because enough missed bluffs survive even after the river shift.",
        population_note: "Pool B under-bluffs this line.",
        follow_up: "Review more bluff-catch nodes where scare cards cut bluff density.",
        follow_up_concepts: ["river bluff catching", "range density"],
      },
      steps: [
        {
          step_id: "turn",
          street: "turn",
          prompt: "Turn setup.",
          board_update: { turn: "Kh" },
          decision_point: {
            street: "turn",
            facing: null,
            sizing_buttons_enabled: false,
          },
          options: [
            { key: "BET", label: "Bet" },
            { key: "CHECK", label: "Check" },
          ],
          answer: {
            correct: "CHECK",
            accepted: [],
            required_tags: ["equity_denial"],
            explanation: "Checking keeps weaker bluff-catchers in without bloating the pot.",
          },
        },
        {
          step_id: "river",
          street: "river",
          prompt: "River decision.",
          decision_point: {
            street: "river",
            facing: { action: "bet", size_pct_pot: 75 },
            sizing_buttons_enabled: false,
          },
          options: singleDecisionDrill.options,
          answer: singleDecisionDrill.answer,
          coaching_context: {
            what_changed_by_street: [
              { street: "river", detail: "The river card is the final value-versus-bluff filter." },
            ],
            why_preferred_line_works: "Hero still beats enough bluffs to continue.",
          },
        },
      ],
    });

    expect(drill.coaching_context?.common_mistakes).toHaveLength(2);
    expect(drill.coaching_context?.what_changed_by_street?.[2]?.street).toBe("river");
    expect(drill.coaching_context?.range_support?.value_buckets?.[0]?.label).toBe("Strong value");
    expect(drill.coaching_context?.range_support?.hero_hand_bucket?.summary).toContain("bluff catcher");
    expect(drill.steps?.[1]?.coaching_context?.why_preferred_line_works).toContain("Hero still beats");
  });

  it("accepts optional diagnostic prompts with structured answers", () => {
    const drill = CanonicalDrillSchema.parse({
      ...singleDecisionDrill,
      diagnostic_prompts: [
        {
          id: "river_reasoning",
          prompt: "What bluffs still arrive here?",
          type: "range_construction",
          concept: "river bluff catching",
          expected_reasoning: "Missed delayed floats still reach river after the turn checks through.",
          options: [
            { id: "value_only", label: "Mostly value", diagnosis: "range_construction_error" },
            { id: "missed_floats", label: "Missed floats survive", matches_expected: true },
          ],
        },
      ],
    });

    expect(drill.diagnostic_prompts?.[0]?.type).toBe("range_construction");
    expect(drill.diagnostic_prompts?.[0]?.options?.[1]?.matches_expected).toBe(true);
  });

  it("rejects invalid drill shapes", () => {
    expect(() =>
      CanonicalDrillSchema.parse({
        ...singleDecisionDrill,
        answer: {
          ...singleDecisionDrill.answer,
          correct: "BET",
        },
        tags: ["river"],
      })
    ).toThrow();
  });

  it("adapts a legacy table-sim drill into canonical shape", () => {
    const canonical = adaptLegacyTableSimDrill({
      drill_id: "legacy_01",
      node_id: "hu_01",
      title: "Legacy River Spot",
      prompt: "Legacy prompt.",
      meta: {
        game: "NLHE Cash",
        players_to_flop: 2,
        hero_pos: "BB",
        villain_pos: "BTN",
      },
      board: {
        flop: ["Js", "7c", "3d"],
        turn: "2h",
        river: "Jd",
      },
      hero_hand: ["Jh", "9h"],
      pot_bb: 12,
      decision_point: {
        street: "river",
        facing: { action: "bet", size_pct_pot: 75 },
        options: ["FOLD", "CALL", "RAISE"],
        sizing_buttons_enabled: false,
      },
      answer_key: {
        correct_action: "CALL",
        accepted_actions: ["CALL"],
        correct_size_bucket: null,
        required_tags: ["paired_top_river"],
        explanation: "Legacy explanation.",
      },
    });

    expect(canonical.options.map((option) => option.key)).toEqual(["FOLD", "CALL", "RAISE"]);
    expect(canonical.answer.correct).toBe("CALL");
    expect(canonical.tags).toContain("pool:baseline");
  });
});

