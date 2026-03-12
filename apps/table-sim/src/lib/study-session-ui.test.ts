import { describe, expect, it } from "vitest";
import type { CanonicalDrill } from "../../../../packages/core/src/schemas";
import type { DrillAttempt } from "./session-types";
import {
  buildMomentumSignal,
  extractConceptLabel,
  formatActionLine,
  getDecisionHotkeyMap,
  getPrimaryPrinciple,
  resolveActionHotkey,
} from "./study-session-ui";

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
      { key: "FOLD", label: "Fold" },
      { key: "CALL", label: "Call" },
      { key: "RAISE", label: "Raise" },
    ],
    answer: overrides.answer ?? {
      correct: "CALL",
      accepted: [],
      required_tags: ["paired_top_river"],
      explanation: "Top pair is too strong to fold. Keep bluff-catchers in range.",
    },
    answer_by_pool: overrides.answer_by_pool,
    tags: overrides.tags ?? ["street:river", "concept:blocker_effect", "decision:bluff_catch"],
    difficulty: overrides.difficulty ?? 2,
    coaching_context: overrides.coaching_context,
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
    userTags: overrides.userTags ?? ["paired_top_river"],
    confidence: overrides.confidence ?? "pretty_sure",
    score: overrides.score ?? 1,
    actionScore: overrides.actionScore ?? 1,
    sizingScore: overrides.sizingScore ?? 0,
    tagScore: overrides.tagScore ?? 1,
    correct: overrides.correct ?? true,
    missedTags: overrides.missedTags ?? [],
    matchedTags: overrides.matchedTags ?? ["paired_top_river"],
    elapsedMs: overrides.elapsedMs ?? 1800,
  };
}

describe("study session ui helpers", () => {
  it("extracts the concept tag for the session rail and concept frame", () => {
    expect(extractConceptLabel(makeDrill())).toBe("Blocker Effect");
  });

  it("maps both numeric and letter shortcuts for actions", () => {
    const mapping = getDecisionHotkeyMap(makeDrill().options);

    expect(mapping["1"]).toBe("FOLD");
    expect(mapping["2"]).toBe("CALL");
    expect(mapping.r).toBe("RAISE");
    expect(resolveActionHotkey("c", makeDrill().options)).toBe("CALL");
  });

  it("builds an honest cadence signal from recent attempts", () => {
    const momentum = buildMomentumSignal([
      makeAttempt({ correct: true }),
      makeAttempt({ correct: true }),
      makeAttempt({ correct: true }),
    ]);

    expect(momentum.label).toBe("Sharp cadence");
    expect(momentum.detail).toContain("3 clean decisions");
  });

  it("pulls the first sentence as the key principle", () => {
    expect(getPrimaryPrinciple(makeAttempt())).toBe("Top pair is too strong to fold.");
  });

  it("formats action lines with sizing", () => {
    expect(formatActionLine("BET", 75)).toBe("BET 75%");
  });
});

