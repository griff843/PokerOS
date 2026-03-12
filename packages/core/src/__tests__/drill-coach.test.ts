import { describe, expect, it } from "vitest";
import {
  buildCorrectAnswerCoachPrompt,
  buildFallbackDrillCoachResponse,
  buildMistakeCoachPrompt,
  buildNextAdjustmentCoachPrompt,
  buildPoolContrastCoachPrompt,
  generateDrillCoachResponse,
  type DrillCoachProvider,
} from "../drill-coach";
import type { CanonicalDrill } from "../schemas";

function makeDrill(): CanonicalDrill {
  return {
    drill_id: "drill_1",
    node_id: "hu_btn_vs_bb_river",
    version: "1.0.0",
    title: "River bluff-catcher",
    prompt: "BTN barrels river for 75%. What should Hero do?",
    scenario: {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: { flop: ["As", "Kd", "2c"], turn: "7h", river: "3d" },
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
      required_tags: ["paired_top_river"],
      explanation: "Call because the bluff-catchers with strong blockers stay in range.",
    },
    answer_by_pool: {
      B: {
        correct: "FOLD",
        accepted: [],
        required_tags: ["underfold_exploit"],
        explanation: "Pool B underbluffs enough that this becomes an exploit fold.",
      },
    },
    tags: ["street:river", "concept:blocker_effect", "pool:pool_b"],
    difficulty: 2,
    coaching_context: {
      key_concept: "Blockers matter more than absolute pair strength here.",
      range_notes: [
        "The river pairs the bottom card, so value stays dense while missed draws remain capped.",
        "Hero's bluff-catchers need enough unblockered misses to continue.",
      ],
      common_mistake: "Calling because top pair feels too strong to fold.",
      common_mistakes: [
        "Treating top pair as a pure bluff-catch regardless of how the runout changes value density.",
      ],
      what_changed_by_street: [
        { street: "flop", detail: "BTN c-bets range and BB continues with bluff-catchers plus backdoors." },
        { street: "turn", detail: "The turn brick keeps bluffs alive while value remains polar." },
        { street: "river", detail: "The final card leaves enough missed draws in baseline but not in tighter pools." },
      ],
      difficulty_reason: "The hand is strong enough to tempt a call, but the runout also improves Villain's value region.",
      why_preferred_line_works: "Calling works when Villain still arrives with enough missed draws after triple-barreling.",
      population_note: "Pool B does not find enough river bluffs in this line.",
      follow_up: "Review river bluff-catcher spots where underbluffing changes the threshold.",
      follow_up_concepts: ["river bluff catching", "pool exploits"],
    },
  };
}

describe("drill-coach foundation", () => {
  it("builds a correct-answer prompt from structured drill outcome data", () => {
    const prompt = buildCorrectAnswerCoachPrompt({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });

    expect(prompt.mode).toBe("correct_answer");
    expect(prompt.userPrompt).toContain("why the correct answer is right");
    expect(prompt.sections.some((section) => section.title === "Decision Review")).toBe(true);
    expect(prompt.sections.some((section) => section.title === "Street Story")).toBe(true);
    expect(prompt.llmPayload.resolvedAnswer.correct).toBe("CALL");
    expect(prompt.llmPayload.authoredTruth.whyPreferredLineWorks).toContain("enough missed draws");
    expect(prompt.llmPayload.authoredTruth.streetChanges).toHaveLength(3);
  });

  it("builds an incorrect-answer prompt without recomputing scoring logic in the prompt", () => {
    const prompt = buildMistakeCoachPrompt({
      drill: makeDrill(),
      activePool: "baseline",
      userAction: "FOLD",
      userTags: [],
      score: 0.2,
      correct: false,
      matchedTags: [],
      missedTags: ["paired_top_river"],
      actionScore: 0,
      tagScore: 0,
    });

    expect(prompt.mode).toBe("mistake_review");
    expect(prompt.userPrompt).toContain("wrong or incomplete");
    expect(prompt.sections.some((section) => section.title === "Next Adjustment")).toBe(true);
  });

  it("builds a pool-contrast prompt when a pool override changes the answer", () => {
    const prompt = buildPoolContrastCoachPrompt({
      drill: makeDrill(),
      activePool: "B",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 0.4,
      correct: false,
      matchedTags: [],
      missedTags: ["underfold_exploit"],
    });

    expect(prompt.mode).toBe("pool_contrast");
    expect(prompt.llmPayload.poolContrast).toEqual({
      baselineCorrect: "CALL",
      selectedPoolCorrect: "FOLD",
      pool: "B",
    });
    expect(prompt.sections.some((section) => section.title === "Pool Contrast")).toBe(true);
  });

  it("produces deterministic fallback coaching text for incorrect answers", () => {
    const response = buildFallbackDrillCoachResponse({
      input: {
        drill: makeDrill(),
        activePool: "B",
        userAction: "CALL",
        userTags: ["paired_top_river"],
        score: 0.4,
        correct: false,
        matchedTags: [],
        missedTags: ["underfold_exploit"],
      },
      mode: "mistake_review",
    });

    expect(response.source).toBe("fallback");
    expect(response.text).toContain("Coach view");
    expect(response.headline).toContain("treating top pair as a pure bluff-catch");
    expect(response.sections.some((section) => section.title === "Street Story")).toBe(true);
    expect(response.sections.length).toBeGreaterThan(1);
  });

  it("supports drills with no answer_by_pool by keeping pool contrast absent", () => {
    const drill = { ...makeDrill(), answer_by_pool: undefined };
    const prompt = buildPoolContrastCoachPrompt({
      drill,
      activePool: "C",
      userAction: "CALL",
      userTags: ["paired_top_river"],
      score: 1,
      correct: true,
      matchedTags: ["paired_top_river"],
      missedTags: [],
    });

    expect(prompt.llmPayload.poolContrast).toBeUndefined();
    expect(prompt.sections[0]?.title).toBe("Pool Contrast");
  });

  it("preserves a stable output shape when using the provider seam", async () => {
    const provider: DrillCoachProvider = {
      async generate(prompt) {
        return {
          text: `Provider coaching for ${prompt.mode}`,
          bullets: [prompt.sections[0]?.bullets[0] ?? "fallback bullet"],
          providerName: "test-provider",
          model: "unit-model",
        };
      },
    };

    const response = await generateDrillCoachResponse({
      input: {
        drill: makeDrill(),
        activePool: "baseline",
        userAction: "CALL",
        userTags: ["paired_top_river"],
        score: 1,
        correct: true,
        matchedTags: ["paired_top_river"],
        missedTags: [],
      },
      mode: "next_adjustment",
      provider,
    });

    expect(response.source).toBe("provider");
    expect(response.providerName).toBe("test-provider");
    expect(response.model).toBe("unit-model");
    expect(response.mode).toBe("next_adjustment");
    expect(Array.isArray(response.sections)).toBe(true);
    expect(response.llmPayload.kind).toBe("drill_coaching");
  });

  it("builds next-adjustment coaching cleanly for sessions with no explicit pool", () => {
    const prompt = buildNextAdjustmentCoachPrompt({
      drill: makeDrill(),
      userAction: "FOLD",
      userTags: [],
      score: 0,
      correct: false,
      matchedTags: [],
      missedTags: ["paired_top_river"],
    });

    expect(prompt.activePool).toBe("baseline");
    expect(prompt.mode).toBe("next_adjustment");
  });
});
