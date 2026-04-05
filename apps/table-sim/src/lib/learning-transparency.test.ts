import { describe, expect, it } from "vitest";
import type { CanonicalDrill } from "../../../../packages/core/src/schemas";
import type { DrillAttempt } from "./session-types";
import { buildTransparencySnapshot, getReplayStreets, getVisibleBoardCards } from "./learning-transparency";

function makeDrill(overrides: Partial<CanonicalDrill> = {}): CanonicalDrill {
  return {
    drill_id: overrides.drill_id ?? "d1",
    node_id: overrides.node_id ?? "hu_01",
    version: overrides.version ?? "1.0.0",
    title: overrides.title ?? "River Bluff Catch",
    prompt: overrides.prompt ?? "River spot.",
    scenario: overrides.scenario ?? {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: {
        flop: ["Ks", "Qd", "7c"],
        turn: "4s",
        river: "As",
      },
      hero_hand: ["Ah", "5h"],
      action_history: [],
    },
    decision_point: overrides.decision_point ?? {
      street: "river",
      facing: { action: "bet", size_pct_pot: 66 },
      sizing_buttons_enabled: false,
    },
    options: overrides.options ?? [
      { key: "FOLD", label: "Fold" },
      { key: "CALL", label: "Call" },
      { key: "RAISE", label: "Raise" },
    ],
    answer: overrides.answer ?? {
      correct: "CALL",
      accepted: [],
      strategy_mix: [
        { action: "CALL", frequency_pct: 42 },
        { action: "FOLD", frequency_pct: 58 },
        { action: "RAISE", frequency_pct: 0 },
      ],
      required_tags: ["scare_river_ace"],
      explanation: "The ace improves Hero, but it also strengthens Villain's value range enough that the call is only partial frequency.",
    },
    answer_by_pool: overrides.answer_by_pool,
    tags: overrides.tags ?? ["street:river", "concept:blocker_effect", "decision:bluff_catch"],
    difficulty: overrides.difficulty ?? 2,
    coaching_context: overrides.coaching_context ?? {
      range_context: "Villain reaches the river with both strong Ax value and missed spade draws, so the bluff-catch threshold stays mixed.",
      common_mistake: "Treating top pair as an automatic bluff-catch when the scare card also improves value.",
      population_note: "Pool B under-bluffs this node.",
    },
    metadata: overrides.metadata,
    steps: overrides.steps,
  };
}

function makeAttempt(overrides: Partial<DrillAttempt> = {}): DrillAttempt {
  const drill = overrides.drill ?? makeDrill();

  return {
    attemptId: overrides.attemptId ?? "attempt-1",
    timestamp: overrides.timestamp ?? "2026-03-10T12:00:00.000Z",
    reflection: overrides.reflection ?? "",
    drill,
    selection: overrides.selection ?? {
      drill,
      kind: "review",
      reason: "due_review",
      matchedWeaknessTargets: [],
      metadata: { priorAttempts: 1 },
    },
    activePool: overrides.activePool ?? "baseline",
    resolvedAnswer: overrides.resolvedAnswer ?? drill.answer,
    userAction: overrides.userAction ?? "CALL",
    userSizeBucket: overrides.userSizeBucket ?? null,
    userTags: overrides.userTags ?? [],
    confidence: overrides.confidence ?? "pretty_sure",
    score: overrides.score ?? 0.7,
    actionScore: overrides.actionScore ?? 0.7,
    sizingScore: overrides.sizingScore ?? 0,
    tagScore: overrides.tagScore ?? 0,
    correct: overrides.correct ?? true,
    missedTags: overrides.missedTags ?? ["scare_river_ace"],
    matchedTags: overrides.matchedTags ?? [],
    elapsedMs: overrides.elapsedMs ?? 2200,
  };
}

describe("learning transparency adapter", () => {
  it("builds partial but honest history lines when structured action history is missing", () => {
    const snapshot = buildTransparencySnapshot(makeAttempt());

    expect(snapshot.history[0]?.summary).toContain("SRP setup");
    expect(snapshot.history[0]?.availability).toBe("partial");
    expect(snapshot.history[3]?.summary).toContain("Facing bet 66% pot");
  });

  it("keeps a full replay street list for a river node", () => {
    const streets = getReplayStreets(makeDrill());

    expect(streets).toEqual(["preflop", "flop", "turn", "river"]);
    expect(getVisibleBoardCards(makeDrill(), "turn")).toEqual(["Ks", "Qd", "7c", "4s"]);
  });

  it("frames lower-frequency choices honestly when strategy mix exists", () => {
    const snapshot = buildTransparencySnapshot(makeAttempt({
      userAction: "CALL",
      correct: false,
    }));

    expect(snapshot.verdict.badge).toBe("Lower-frequency line");
    expect(snapshot.frequencies.available).toBe(true);
    expect(snapshot.frequencies.items[0]?.action).toBe("FOLD");
  });

  it("falls back cleanly when no strategy mix is published", () => {
    const drill = makeDrill({
      answer: {
        ...makeDrill().answer,
        strategy_mix: [],
      },
    });
    const snapshot = buildTransparencySnapshot(makeAttempt({ drill, resolvedAnswer: drill.answer, correct: false, userAction: "RAISE" }));

    expect(snapshot.frequencies.available).toBe(false);
    expect(snapshot.verdict.badge).toBe("Needs work");
  });

  it("surfaces authored street notes in the replay history when richer drill truth exists", () => {
    const baseDrill = makeDrill();
    const drill = makeDrill({
      scenario: {
        ...baseDrill.scenario,
        street: "turn",
        board: {
          flop: ["Qh", "8d", "4c"],
          turn: "2s",
          river: null,
        },
        action_history: [
          { street: "preflop", player: "villain", action: "open", size_bb: 2.5 },
          { street: "preflop", player: "hero", action: "call", size_bb: 2.5 },
          { street: "flop", player: "villain", action: "bet", size_pct_pot: 33 },
          { street: "flop", player: "hero", action: "call" },
        ],
      },
      decision_point: {
        street: "turn",
        facing: null,
        sizing_buttons_enabled: false,
      },
      coaching_context: {
        key_concept: "Turn probes need a clear range story.",
        what_changed_by_street: [
          { street: "flop", detail: "Flop calls keep capped bluff-catchers and backdoor continues in range." },
          { street: "turn", detail: "The turn brick favors the player who kept more auto-checks and marginal pairs." },
        ],
        why_preferred_line_works: "Betting now punishes capped check-backs before the river clarifies too much.",
      },
      steps: [
        {
          step_id: "river_follow_up",
          street: "river",
          prompt: "River follow-up after betting turn.",
          board_update: { river: "2d" },
          decision_point: {
            street: "river",
            facing: { action: "call" },
            sizing_buttons_enabled: false,
          },
          options: [
            { key: "CHECK", label: "Check" },
            { key: "BET", label: "Bet" },
          ],
          answer: {
            correct: "CHECK",
            accepted: [],
            required_tags: ["showdown_control"],
            explanation: "The paired river reduces value targets enough to check more often.",
          },
          coaching_context: {
            what_changed_by_street: [
              { street: "river", detail: "The paired river removes thin value and increases showdown incentives." },
            ],
          },
        },
      ],
    });

    const snapshot = buildTransparencySnapshot(makeAttempt({
      drill,
      resolvedAnswer: drill.answer,
    }));

    expect(snapshot.history.find((line) => line.street === "flop")?.detail).toContain("capped bluff-catchers");
    expect(snapshot.history.find((line) => line.street === "turn")?.availability).toBe("partial");
    expect(snapshot.history.find((line) => line.street === "river")?.detail).toContain("paired river removes thin value");
  });

  it("builds visible range sections, blocker notes, and hand framing when authored truth exists", () => {
    const baseDrill = makeDrill();
    const drill = makeDrill({
      coaching_context: {
        key_concept: "Scare-card bluff catches are about range density, not just hand strength.",
        range_context: "Villain reaches the river with value-heavy boats plus busted spades.",
        range_notes: [
          "The river improves some bluff-catchers, but it also upgrades Villain's strongest value hands.",
        ],
        difficulty_reason: "The same card that improves Hero also removes natural bluffs.",
        common_mistake: "Calling because top pair improved without checking how many bluffs survive.",
        common_mistakes: [
          "Overweighting blocker effects when the value region also expands.",
        ],
        why_preferred_line_works: "Folding works once the scare card removes too many natural bluffs.",
        follow_up: "Review more paired-river bluff catches where improved top pair still slips below threshold.",
        follow_up_concepts: ["concept:bluff_catching", "concept:range_density"],
        range_support: {
          value_buckets: [
            {
              label: "Value-heavy boats",
              combos: ["A7", "77", "AA"],
              note: "These hands improve into a cleaner value region once the ace pairs the top end.",
            },
          ],
          bluff_buckets: [
            {
              label: "Missed spades",
              combos: ["KJss", "JTss"],
              frequency_hint: "Occasional bluff",
            },
          ],
          bluff_catchers: [
            {
              label: "Ace-x bluff catchers",
              combos: ["A5", "A9", "AJ"],
              note: "Only the better ace-x wants to continue once the value region expands.",
            },
          ],
          threshold_notes: [
            "A5 is near the bottom of the continuing region and can slip below threshold when the bluff count drops.",
          ],
          blocker_notes: [
            "Holding an ace blocks some bluffs you want Villain to have, which is why top pair is not an automatic bluff-catch.",
          ],
          hero_hand_bucket: {
            label: "This combo",
            summary: "Low-end bluff catcher",
            note: "It improved, but not enough to beat the stronger value-heavy runout on its own.",
          },
        },
      },
      answer: {
        ...baseDrill.answer,
        correct: "FOLD",
        explanation: "The river improves value more than bluffs, so folding is best.",
      },
    });

    const snapshot = buildTransparencySnapshot(makeAttempt({
      drill,
      resolvedAnswer: drill.answer,
      userAction: "CALL",
      correct: false,
    }));

    expect(snapshot.rangeView.available).toBe(true);
    expect(snapshot.rangeView.title).toContain("Scare-card bluff catches");
    expect(snapshot.rangeView.handFocus?.summary).toContain("Low-end bluff catcher");
    expect(snapshot.rangeView.sections.map((section) => section.title)).toEqual([
      "Villain Value Region",
      "Villain Bluff Region",
      "Hero Bluff Catchers",
    ]);
    expect(snapshot.rangeView.sections[0]?.buckets[0]?.combos).toContain("A7");
    expect(snapshot.rangeView.thresholdNotes[0]).toContain("bottom of the continuing region");
    expect(snapshot.rangeView.blockerNotes[0]).toContain("Holding an ace blocks some bluffs");
    expect(snapshot.rangeView.points.some((point) => point.includes("What makes it difficult"))).toBe(true);
    expect(snapshot.rangeView.followUp).toContain("paired-river bluff catches");
    expect(snapshot.rangeView.followUpConcepts).toEqual(["concept:bluff_catching", "concept:range_density"]);
  });
});
