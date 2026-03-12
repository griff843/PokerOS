import { describe, it, expect } from "vitest";
import { scoreCanonicalDrill, scoreDrill } from "../scoring";
import type { DrillAnswer } from "../schemas";

const baseAnswer: DrillAnswer = {
  correct: "CALL",
  accepted: [],
  explanation: "test",
  required_tags: ["paired_top_river"],
};

describe("scoreDrill", () => {
  it("returns 1.0 for correct action + all tags matched", () => {
    const result = scoreDrill({
      userAnswer: "CALL",
      userTags: ["paired_top_river"],
      answer: baseAnswer,
    });
    expect(result.total).toBe(1);
    expect(result.actionScore).toBe(0.7);
    expect(result.tagScore).toBe(0.3);
    expect(result.correct).toBe(true);
    expect(result.missedTags).toEqual([]);
    expect(result.matchedTags).toEqual(["paired_top_river"]);
  });

  it("returns 0.7 for correct action + no tags matched", () => {
    const result = scoreDrill({
      userAnswer: "CALL",
      userTags: [],
      answer: baseAnswer,
    });
    expect(result.total).toBe(0.7);
    expect(result.actionScore).toBe(0.7);
    expect(result.tagScore).toBe(0);
    expect(result.correct).toBe(true);
    expect(result.missedTags).toEqual(["paired_top_river"]);
  });

  it("returns 0.3 for wrong action + all tags matched", () => {
    const result = scoreDrill({
      userAnswer: "FOLD",
      userTags: ["paired_top_river"],
      answer: baseAnswer,
    });
    expect(result.total).toBe(0.3);
    expect(result.actionScore).toBe(0);
    expect(result.tagScore).toBe(0.3);
    expect(result.correct).toBe(false);
  });

  it("returns 0 for wrong action + no tags", () => {
    const result = scoreDrill({
      userAnswer: "FOLD",
      userTags: [],
      answer: baseAnswer,
    });
    expect(result.total).toBe(0);
    expect(result.correct).toBe(false);
  });

  it("handles case-insensitive answers", () => {
    const result = scoreDrill({
      userAnswer: "call",
      userTags: ["paired_top_river"],
      answer: baseAnswer,
    });
    expect(result.correct).toBe(true);
    expect(result.total).toBe(1);
  });

  it("accepts alternate accepted answers", () => {
    const answer: DrillAnswer = {
      correct: "CALL",
      accepted: ["RAISE"],
      explanation: "",
      required_tags: ["scare_river_ace"],
    };
    const result = scoreDrill({
      userAnswer: "RAISE",
      userTags: ["scare_river_ace"],
      answer,
    });
    expect(result.correct).toBe(true);
    expect(result.total).toBe(1);
  });

  it("proportionally scores partial tag matches", () => {
    const answer: DrillAnswer = {
      correct: "CALL",
      accepted: [],
      explanation: "",
      required_tags: ["paired_top_river", "scare_river_ace"],
    };
    const result = scoreDrill({
      userAnswer: "CALL",
      userTags: ["paired_top_river"],
      answer,
    });
    expect(result.total).toBe(0.85);
    expect(result.tagScore).toBe(0.15);
    expect(result.matchedTags).toEqual(["paired_top_river"]);
    expect(result.missedTags).toEqual(["scare_river_ace"]);
  });
});

describe("scoreCanonicalDrill", () => {
  const drill = {
    answer: {
      correct: "CALL",
      accepted: [],
      explanation: "Baseline call.",
      required_tags: ["paired_top_river"],
    },
    answer_by_pool: {
      B: {
        correct: "FOLD",
        accepted: [],
        explanation: "Pool B under-bluffs.",
        required_tags: ["paired_top_river", "underfold_exploit"],
      },
    },
  };

  it("uses the baseline answer when no pool is provided", () => {
    const result = scoreCanonicalDrill({
      userAnswer: "CALL",
      userTags: ["paired_top_river"],
      drill,
    });

    expect(result.activePool).toBe("baseline");
    expect(result.answer.correct).toBe("CALL");
    expect(result.correct).toBe(true);
  });

  it("uses a pool-specific answer when an override exists", () => {
    const result = scoreCanonicalDrill({
      userAnswer: "FOLD",
      userTags: ["paired_top_river", "underfold_exploit"],
      drill,
      activePool: "B",
    });

    expect(result.activePool).toBe("B");
    expect(result.answer.correct).toBe("FOLD");
    expect(result.correct).toBe(true);
  });

  it("falls back to baseline for drills without pool overrides", () => {
    const result = scoreCanonicalDrill({
      userAnswer: "CALL",
      userTags: ["paired_top_river"],
      drill: {
        answer: baseAnswer,
      },
      activePool: "C",
    });

    expect(result.answer.correct).toBe("CALL");
    expect(result.correct).toBe(true);
  });
});
