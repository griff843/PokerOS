import { describe, expect, it } from "vitest";
import type { PlayerIntelligenceSnapshot } from "@poker-coach/core/browser";
import {
  buildDailyStudyPlanBundle,
  DAILY_SESSION_LENGTHS,
  type DailyStudyPlanInput,
} from "./daily-study-plan";

function makeIntelligence(
  overrides: Partial<PlayerIntelligenceSnapshot> = {},
): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-24T00:00:00.000Z",
    activePool: "baseline",
    graph: { concepts: [], edges: [] },
    concepts: [],
    priorities: [],
    strengths: [],
    recommendations: [],
    adaptiveProfile: {
      generatedAt: "2026-03-24T00:00:00.000Z",
      summary: "",
      tendencies: [],
      coachingEmphasis: {
        explanationBullets: [],
        interventionBullets: [],
        confidenceHandling: "",
        recommendationFraming: "",
      },
      interventionAdjustments: {
        preferShorterReviewBlocks: false,
        prioritizeThresholdRetests: false,
        prioritizeLineReconstruction: false,
        prioritizeBlockerNotes: false,
        prioritizeConfidenceCalibration: false,
        prioritizeRealPlayReview: false,
      },
      surfaceSignals: {
        commandCenter: "",
        studySession: "",
      },
    },
    memory: {
      diagnosisCount: 0,
      activeInterventions: 0,
      completedInterventions: 0,
      interventionSuccessRate: null,
      recurringLeakConcepts: [],
      recoveredConcepts: [],
      regressedConcepts: [],
      stabilizingConcepts: [],
    },
    patterns: {
      generatedAt: "2026-03-24T00:00:00.000Z",
      patterns: [],
      topPatterns: [],
    },
    ...overrides,
  } as PlayerIntelligenceSnapshot;
}

function makeInput(overrides: Partial<DailyStudyPlanInput> = {}): DailyStudyPlanInput {
  return {
    playerIntelligence: makeIntelligence(),
    totalAttempts: 0,
    overdueRetentionConceptKeys: [],
    dueRetentionConceptKeys: [],
    importedHandCount: 0,
    activeInterventionConceptKey: null,
    activeInterventionConceptLabel: null,
    now: new Date("2026-03-24T10:00:00.000Z"),
    ...overrides,
  };
}

function makeReadyIntelligence(
  overrides: Partial<PlayerIntelligenceSnapshot> = {},
): PlayerIntelligenceSnapshot {
  const concepts = Array.from({ length: 4 }, (_, i) => ({
    conceptKey: `concept_${i}`,
    label: `Concept ${i}`,
    summary: "",
    scope: "overall" as const,
    recommendedPool: "baseline" as const,
    sampleSize: 15,
    averageScore: 0.5 - i * 0.05,
    recurrenceCount: i,
    failedCount: 5,
    reviewPressure: 0.8 - i * 0.1,
    trainingUrgency: 0.7,
    status: "weakness" as const,
    weaknessRole: "primary" as const,
    recoveryStage: "unaddressed" as const,
    planningReasons: [],
    directSignalKeys: [],
    relatedConceptKeys: [],
    supportingConceptKeys: [],
    supportedConceptKeys: [],
    inferredFrom: [],
    evidence: [],
    relatedDrills: [],
  }));

  return makeIntelligence({
    concepts: concepts as PlayerIntelligenceSnapshot["concepts"],
    recommendations: [
      {
        conceptKey: "concept_0",
        label: "Concept 0",
        rationale: "Highest review pressure",
        recommendedPool: "baseline",
        emphasis: "review",
        urgency: 0.9,
        weaknessRole: "primary",
        explainability: [],
      },
      {
        conceptKey: "concept_1",
        label: "Concept 1",
        rationale: "Secondary weakness",
        recommendedPool: "baseline",
        emphasis: "review",
        urgency: 0.7,
        weaknessRole: "downstream",
        explainability: [],
      },
    ],
    ...overrides,
  });
}

describe("buildDailyStudyPlanBundle — state determination", () => {
  it("returns no_history when totalAttempts is 0", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.state).toBe("no_history");
  });

  it("returns no_history when concepts list is empty even with attempts", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 20, playerIntelligence: makeIntelligence({ concepts: [] }) }),
    );
    expect(result.state).toBe("no_history");
  });

  it("returns sparse_history when fewer than 3 concepts", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 15,
        playerIntelligence: makeIntelligence({
          concepts: [
            {
              conceptKey: "c1",
              label: "C1",
              summary: "",
              scope: "overall",
              recommendedPool: "baseline",
              sampleSize: 10,
              averageScore: 0.5,
              recurrenceCount: 0,
              failedCount: 2,
              reviewPressure: 0.5,
              trainingUrgency: 0.5,
              status: "weakness",
              weaknessRole: "primary",
              recoveryStage: "unaddressed",
              planningReasons: [],
              directSignalKeys: [],
              relatedConceptKeys: [],
              supportingConceptKeys: [],
              supportedConceptKeys: [],
              inferredFrom: [],
              evidence: [],
              relatedDrills: [],
            },
          ] as PlayerIntelligenceSnapshot["concepts"],
        }),
      }),
    );
    expect(result.state).toBe("sparse_history");
  });

  it("returns sparse_history when fewer than 10 attempts but 3+ concepts", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
      }),
    );
    expect(result.state).toBe("sparse_history");
  });

  it("returns ready when 3+ concepts and 10+ attempts", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 25, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.state).toBe("ready");
  });
});

describe("buildDailyStudyPlanBundle — bundle structure", () => {
  it("includes all three session length plans", () => {
    const result = buildDailyStudyPlanBundle(makeInput());
    expect(result.plan20.sessionLength).toBe(20);
    expect(result.plan45.sessionLength).toBe(45);
    expect(result.plan90.sessionLength).toBe(90);
  });

  it("exposes DAILY_SESSION_LENGTHS as availableSessionLengths", () => {
    const result = buildDailyStudyPlanBundle(makeInput());
    expect(result.availableSessionLengths).toEqual(DAILY_SESSION_LENGTHS);
  });

  it("defaults to 20-min session for no_history", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.defaultSessionLength).toBe(20);
  });

  it("defaults to 45-min session for sparse and ready states", () => {
    const sparse = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(sparse.defaultSessionLength).toBe(45);

    const ready = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 25, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(ready.defaultSessionLength).toBe(45);
  });

  it("exposes primaryConceptKey and label from top recommendation", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 25, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.primaryConceptKey).toBe("concept_0");
    expect(result.primaryConceptLabel).toBe("Concept 0");
  });

  it("returns null primaryConceptKey when no recommendations", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.primaryConceptKey).toBeNull();
    expect(result.primaryConceptLabel).toBeNull();
  });
});

describe("buildDailyStudyPlanBundle — no_history state", () => {
  it("produces a single start-session block for all lengths", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.blocks).toHaveLength(1);
    expect(result.plan20.blocks[0].kind).toBe("focus_concept");
    expect(result.plan20.blocks[0].destination).toBe("/app/session");
    // 45 and 90 also get the block (20 min block fits in any budget)
    expect(result.plan45.blocks).toHaveLength(1);
    expect(result.plan90.blocks).toHaveLength(1);
  });

  it("produces empty urgency signals for no_history", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.urgencySignals).toEqual([]);
  });
});

describe("buildDailyStudyPlanBundle — sparse_history state", () => {
  it("produces a focus_concept block pointing to session", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
      }),
    );
    const [first] = result.plan20.blocks;
    expect(first.kind).toBe("focus_concept");
    expect(first.destination).toBe("/app/session");
  });

  it("adds overdue retention block when present in sparse state", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_0"],
      }),
    );
    expect(result.plan90.blocks.some((b) => b.kind === "retention_check")).toBe(true);
  });

  it("includes sparse_history urgency signal", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
      }),
    );
    expect(result.urgencySignals[0]).toContain("Limited history");
  });
});

describe("buildDailyStudyPlanBundle — ready state block selection", () => {
  it("selects execute_intervention as top block when active intervention is present", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan20.blocks[0].kind).toBe("execute_intervention");
    expect(result.plan20.blocks[0].destination).toBe(
      "/app/concepts/concept_0/execution",
    );
  });

  it("selects overdue retention_check as top-2 priority", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const kinds = result.plan45.blocks.map((b) => b.kind);
    expect(kinds[0]).toBe("retention_check");
    expect(kinds[1]).toBe("focus_concept");
  });

  it("includes focus_concept block linking to concept detail", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    const focusBlock = result.plan45.blocks.find((b) => b.kind === "focus_concept");
    expect(focusBlock).toBeDefined();
    expect(focusBlock?.destination).toBe("/app/concepts/concept_0");
    expect(focusBlock?.conceptKey).toBe("concept_0");
  });

  it("includes secondary_concept block for second recommendation", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    const secondaryBlock = result.plan90.blocks.find((b) => b.kind === "secondary_concept");
    expect(secondaryBlock).toBeDefined();
    expect(secondaryBlock?.conceptKey).toBe("concept_1");
  });

  it("includes review_real_hands block when imported hands exist", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 5,
      }),
    );
    const handsBlock = result.plan90.blocks.find((b) => b.kind === "review_real_hands");
    expect(handsBlock).toBeDefined();
    expect(handsBlock?.destination).toBe("/app/hands");
    expect(handsBlock?.reason).toContain("5 imported hands");
  });

  it("does not include review_real_hands when no imported hands", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 0,
      }),
    );
    expect(result.plan90.blocks.every((b) => b.kind !== "review_real_hands")).toBe(true);
  });

  it("includes inspect_replay_drift for top recurring leak", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({
          memory: {
            diagnosisCount: 0,
            activeInterventions: 1,
            completedInterventions: 0,
            interventionSuccessRate: null,
            recurringLeakConcepts: ["concept_3"],
            recoveredConcepts: [],
            regressedConcepts: [],
            stabilizingConcepts: [],
          },
        }),
      }),
    );
    const replayBlock = result.plan90.blocks.find((b) => b.kind === "inspect_replay_drift");
    expect(replayBlock).toBeDefined();
    expect(replayBlock?.conceptKey).toBe("concept_3");
    expect(replayBlock?.destination).toBe("/app/concepts/concept_3/replay");
  });
});

describe("buildDailyStudyPlanBundle — 20/45/90 min shaping", () => {
  it("20-min plan fits within 20 minutes", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    expect(result.plan20.totalEstimatedMinutes).toBeLessThanOrEqual(20);
  });

  it("45-min plan fits within 45 minutes", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    expect(result.plan45.totalEstimatedMinutes).toBeLessThanOrEqual(45);
  });

  it("90-min plan fits within 90 minutes", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
        dueRetentionConceptKeys: ["concept_3"],
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan90.totalEstimatedMinutes).toBeLessThanOrEqual(90);
  });

  it("longer plans contain more blocks than shorter plans (with enough candidates)", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({
          memory: {
            diagnosisCount: 0,
            activeInterventions: 1,
            completedInterventions: 0,
            interventionSuccessRate: null,
            recurringLeakConcepts: ["concept_3"],
            recoveredConcepts: [],
            regressedConcepts: [],
            stabilizingConcepts: [],
          },
        }),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    expect(result.plan45.blocks.length).toBeGreaterThanOrEqual(result.plan20.blocks.length);
    expect(result.plan90.blocks.length).toBeGreaterThanOrEqual(result.plan45.blocks.length);
  });

  it("plan always has at least 1 block even for no_history with 20-min budget", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.blocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("buildDailyStudyPlanBundle — urgency signals", () => {
  it("includes overdue signal when retention is overdue", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_0", "concept_1"],
      }),
    );
    expect(result.urgencySignals.some((s) => s.includes("overdue"))).toBe(true);
    expect(result.urgencySignals.some((s) => s.includes("2 retention checks overdue"))).toBe(
      true,
    );
  });

  it("includes active intervention signal", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.urgencySignals.some((s) => s.includes("Active intervention"))).toBe(true);
  });

  it("includes recurring leak signal", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({
          memory: {
            diagnosisCount: 0,
            activeInterventions: 0,
            completedInterventions: 0,
            interventionSuccessRate: null,
            recurringLeakConcepts: ["concept_0", "concept_1"],
            recoveredConcepts: [],
            regressedConcepts: [],
            stabilizingConcepts: [],
          },
        }),
      }),
    );
    expect(result.urgencySignals.some((s) => s.includes("recurring leak"))).toBe(true);
  });

  it("returns empty urgency signals for no_history", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.urgencySignals).toHaveLength(0);
  });
});

describe("buildDailyStudyPlanBundle — plan explanations", () => {
  it("whyThisPlan mentions urgency signals in ready state", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_0"],
      }),
    );
    expect(result.plan45.whyThisPlan).toContain("overdue");
  });

  it("expectedOutcome mentions intervention progress when execute_intervention block present", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.expectedOutcome).toContain("intervention progress");
  });

  it("expectedOutcome mentions primary weakness when focus_concept block present", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan45.expectedOutcome).toContain("primary weakness");
  });
});
