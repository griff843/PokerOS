import { describe, expect, it } from "vitest";
import type { AttemptRow } from "../../../../packages/db/src/repository";
import type { CanonicalDrill } from "@poker-coach/core/browser";
import { buildPersistentReviewSnapshot } from "./persistent-review";

function makeDrill(options: {
  drillId: string;
  nodeId: string;
  title: string;
  conceptTag: string;
  requiredTag: string;
}): CanonicalDrill {
  return {
    drill_id: options.drillId,
    node_id: options.nodeId,
    version: "1.0.0",
    title: options.title,
    prompt: "Choose the best line.",
    scenario: {
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
    decision_point: {
      street: "river",
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
      required_tags: [options.requiredTag],
      explanation: "Call the bluff-catcher.",
    },
    tags: [options.conceptTag, "decision:bluff_catch"],
    difficulty: 2,
  };
}

function makeAttemptRow(args: {
  attemptId: string;
  drillId: string;
  ts: string;
  score: number;
  correct: boolean;
  confidence: "not_sure" | "pretty_sure" | "certain";
  missedTags: string[];
}): AttemptRow {
  return {
    attempt_id: args.attemptId,
    drill_id: args.drillId,
    session_id: "session-1",
    ts: args.ts,
    selected_action: args.correct ? "CALL" : "FOLD",
    confidence: args.confidence,
    tags_json: JSON.stringify([args.missedTags[0] ?? "paired_top_river"]),
    reflection: "",
    user_answer_json: JSON.stringify({
      selection: {
        drill: makeDrill({ drillId: args.drillId, nodeId: args.drillId, title: args.drillId, conceptTag: "concept:blocker_effect", requiredTag: args.missedTags[0] ?? "paired_top_river" }),
        kind: "review",
        reason: "due_review",
        matchedWeaknessTargets: [],
        metadata: { priorAttempts: 1 },
      },
      resolvedAnswer: {
        correct: "CALL",
        accepted: [],
        required_tags: [args.missedTags[0] ?? "paired_top_river"],
        explanation: "Call the bluff-catcher.",
      },
      userSizeBucket: null,
      matchedTags: args.correct ? [args.missedTags[0] ?? "paired_top_river"] : [],
      actionScore: args.score,
      sizingScore: 1,
      tagScore: args.score,
    }),
    correct_bool: args.correct ? 1 : 0,
    score: args.score,
    elapsed_ms: 1600,
    missed_tags_json: JSON.stringify(args.missedTags),
    active_pool: "B",
  };
}

describe("persistent review snapshot", () => {
  it("builds durable review queues and unresolved concepts from persisted attempts", () => {
    const drills: CanonicalDrill[] = [
      makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" }),
      makeDrill({ drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", conceptTag: "concept:turn_probe", requiredTag: "turn_probe" }),
    ];

    const attempts: AttemptRow[] = [
      makeAttemptRow({ attemptId: "a1", drillId: "d1", ts: "2026-03-10T12:00:00.000Z", score: 0.22, correct: false, confidence: "certain", missedTags: ["paired_top_river"] }),
      makeAttemptRow({ attemptId: "a2", drillId: "d1", ts: "2026-03-09T12:00:00.000Z", score: 0.28, correct: false, confidence: "certain", missedTags: ["paired_top_river"] }),
      makeAttemptRow({ attemptId: "a3", drillId: "d2", ts: "2026-03-08T12:00:00.000Z", score: 0.32, correct: false, confidence: "pretty_sure", missedTags: ["turn_probe"] }),
      makeAttemptRow({ attemptId: "a4", drillId: "d1", ts: "2026-03-07T12:00:00.000Z", score: 0.8, correct: true, confidence: "not_sure", missedTags: [] }),
    ];

    const snapshot = buildPersistentReviewSnapshot({
      drills,
      attempts,
      srs: [],
      activePool: "B",
      now: new Date("2026-03-10T12:30:00.000Z"),
    });

    expect(snapshot.reviewQueue[0]?.attemptId).toBe("a1");
    expect(snapshot.recentMistakes).toHaveLength(3);
    expect(snapshot.conceptMistakes[0]?.label).toBe("Blocker Effect");
    expect(snapshot.unresolvedConcepts.length).toBeGreaterThan(0);
  });
});


