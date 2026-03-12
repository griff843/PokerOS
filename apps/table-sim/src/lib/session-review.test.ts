import { describe, expect, it } from "vitest";
import type { DrillAttempt, SessionState } from "./session-types";
import { buildSessionReviewSnapshot } from "./session-review";

interface AttemptOptions {
  drillId?: string;
  nodeId?: string;
  title?: string;
  conceptTag?: string;
  requiredTag?: string;
  kind?: "review" | "new";
  reason?: "due_review" | "weakness_review" | "weakness_new" | "new_material_fill";
  score: number;
  correct: boolean;
  confidence?: DrillAttempt["confidence"];
  missedTags?: string[];
  matchedTags?: string[];
}

function makeAttempt(options: AttemptOptions): DrillAttempt {
  const drill: DrillAttempt["drill"] = {
    drill_id: options.drillId ?? "d1",
    node_id: options.nodeId ?? "hu_river_01",
    version: "1.0.0",
    title: options.title ?? "River Bluff Catch",
    prompt: "Call or fold?",
    scenario: {
      game: "NLHE Cash",
      street: "river" as const,
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
    decision_point: {
      street: "river" as const,
      facing: { action: "bet", size_pct_pot: 75 },
      sizing_buttons_enabled: false,
    },
    options: [
      { key: "CALL", label: "Call" },
      { key: "FOLD", label: "Fold" },
    ],
    answer: {
      correct: "CALL",
      accepted: [],
      required_tags: [options.requiredTag ?? "paired_top_river"],
      explanation: "Call the bluff-catcher.",
    },
    tags: [options.conceptTag ?? "concept:blocker_effect", "decision:bluff_catch"],
    difficulty: 2,
  };

  return {
    attemptId: `${options.drillId ?? "d1"}-attempt`,
    timestamp: "2026-03-10T12:00:00.000Z",
    reflection: "",
    drill,
    selection: {
      drill,
      kind: options.kind ?? "review",
      reason: options.reason ?? "weakness_review",
      matchedWeaknessTargets: options.kind === "new" ? [] : ["overall:classification_tag:concept:blocker_effect"],
      metadata: { priorAttempts: options.kind === "new" ? 0 : 2, lastScore: 0.4, weaknessPriority: 0.8 },
    },
    activePool: "B",
    resolvedAnswer: {
      correct: "CALL",
      accepted: [],
      required_tags: [options.requiredTag ?? "paired_top_river"],
      explanation: "Call the bluff-catcher.",
    },
    userAction: options.correct ? "CALL" : "FOLD",
    userSizeBucket: null,
    userTags: [],
    confidence: options.confidence ?? "pretty_sure",
    score: options.score,
    actionScore: options.score,
    sizingScore: 1,
    tagScore: options.score,
    correct: options.correct,
    missedTags: options.missedTags ?? [],
    matchedTags: options.matchedTags ?? [],
    elapsedMs: 7000,
  };
}

function makeState(attempts: DrillAttempt[]): Pick<SessionState, "attempts" | "config" | "planMetadata" | "drills"> {
  return {
    attempts,
    config: {
      drillCount: 10,
      timed: true,
      activePool: "B",
    },
    drills: attempts.map((attempt) => attempt.selection),
    planMetadata: {
      requestedCount: 10,
      selectedCount: 10,
      reviewCount: 6,
      newCount: 4,
      dueReviewCount: 2,
      weaknessReviewCount: 2,
      weaknessNewCount: 1,
      newMaterialFillCount: 5,
      activePool: "B",
      generatedAt: "2026-03-10T12:00:00.000Z",
      weaknessTargets: [
        {
          type: "classification_tag",
          key: "concept:blocker_effect",
          scope: "overall",
          sampleSize: 5,
          accuracy: 0.4,
          priority: 0.8,
        },
      ],
      notes: ["Filled remaining review slots with weakness-targeted reinforcement drills."],
    },
  };
}

describe("session review snapshot", () => {
  it("builds a coach-led debrief with selective review targets", () => {
    const snapshot = buildSessionReviewSnapshot(makeState([
      makeAttempt({ score: 0.35, correct: false, confidence: "certain", missedTags: ["paired_top_river"] }),
      makeAttempt({ score: 0.45, correct: false, confidence: "certain", missedTags: ["paired_top_river"], drillId: "d2", nodeId: "hu_river_02", title: "River Bluff Catch 2" }),
      makeAttempt({ score: 0.82, correct: true, confidence: "not_sure", matchedTags: ["blocker_effect"], kind: "new", reason: "weakness_new", drillId: "d3", nodeId: "hu_river_03", title: "Turn Float" }),
    ]));

    expect(snapshot.header.focusLabel).toBe("Blocker Effect");
    expect(snapshot.performance.items[2]?.value).toBe("Overpressing");
    expect(snapshot.movedToday.items[1]?.title).toBe("Blocker Effects");
    expect(snapshot.importantDrills[0]?.reviewTag).toBe("paired_top_river");
    expect(snapshot.coachDebrief.leak.length).toBeGreaterThan(0);
    expect(snapshot.recommendedTrainingBlock?.plan.recommendedSessionTitle.length).toBeGreaterThan(0);
    expect(snapshot.nextAction.primary.action).toBe("review_incorrect");
  });

  it("falls back to a coach intervention when there are no mistakes to review", () => {
    const snapshot = buildSessionReviewSnapshot(makeState([
      makeAttempt({ score: 0.88, correct: true, matchedTags: ["blocker_effect"], confidence: "pretty_sure" }),
      makeAttempt({ score: 0.78, correct: true, matchedTags: ["blocker_effect"], confidence: "not_sure", kind: "new", reason: "new_material_fill", drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", conceptTag: "concept:turn_probe", requiredTag: "turn_probe" }),
    ]));

    expect(snapshot.nextAction.primary.action).toBe("open_intervention");
    expect(snapshot.importantDrills).toHaveLength(2);
  });
});


