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

  it("selects both overdue retention_check and focus_concept (arc-ordered: focus first)", () => {
    // v3: selection is priority-based (both are included); display order follows session arc
    // Arc: focus_concept (pos 2) leads; retention_check (pos 3) validates after
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const kinds = result.plan45.blocks.map((b) => b.kind);
    expect(kinds).toContain("focus_concept");
    expect(kinds).toContain("retention_check");
    // Arc order: focus concept work first, then validate retention
    expect(kinds[0]).toBe("focus_concept");
    expect(kinds[1]).toBe("retention_check");
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

describe("buildDailyStudyPlanBundle — v2: mainFocus", () => {
  it("returns intervention-focused mainFocus when execute_intervention is primary block", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.mainFocus).toContain("Execute intervention");
    expect(result.plan45.mainFocus).toContain("Concept 0");
  });

  it("returns concept-focused mainFocus when focus_concept is primary block", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan45.mainFocus).toContain("Concept focus");
    expect(result.plan45.mainFocus).toContain("Concept 0");
  });

  it("returns concept-focused mainFocus even when overdue retention is selected (arc: focus leads)", () => {
    // v3: arc ordering puts focus_concept (pos 2) before retention_check (pos 3)
    // so mainFocus reflects the arc-first block, not the highest-priority candidate
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_0"],
      }),
    );
    expect(result.plan45.mainFocus).toContain("Concept focus");
    expect(result.plan45.mainFocus).toContain("Concept 0");
  });

  it("returns retention-focused mainFocus when retention_check is the only candidate (no recommendations)", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({ recommendations: [] }),
        overdueRetentionConceptKeys: ["concept_0"],
      }),
    );
    // No focus_concept candidate (no recommendations), retention_check leads
    expect(result.plan45.mainFocus).toContain("Validate retention");
  });

  it("returns no_history mainFocus for no_history state", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.mainFocus).toBe("Start your first session");
  });

  it("returns non-empty mainFocus for all session lengths", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.mainFocus.length).toBeGreaterThan(0);
    expect(result.plan45.mainFocus.length).toBeGreaterThan(0);
    expect(result.plan90.mainFocus.length).toBeGreaterThan(0);
  });
});

describe("buildDailyStudyPlanBundle — v2: successCriteria", () => {
  it("returns drill-specific successCriteria for focus_concept with label", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan45.successCriteria).toContain("Concept 0");
    expect(result.plan45.successCriteria).toContain("5+");
  });

  it("returns intervention-specific successCriteria for execute_intervention", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.successCriteria).toContain("10+");
    expect(result.plan45.successCriteria).toContain("Concept 0");
  });

  it("returns no_history successCriteria for no_history state", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.successCriteria).toContain("10-drill");
  });

  it("returns sparse successCriteria for sparse_history state", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.successCriteria).toContain("20 total attempts");
  });
});

describe("buildDailyStudyPlanBundle — v2: firstAction", () => {
  it("firstAction has label and destination for focus_concept", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan45.firstAction.label).toBeTruthy();
    expect(result.plan45.firstAction.destination).toBe("/app/concepts/concept_0");
  });

  it("firstAction destination matches intervention execution path", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.firstAction.destination).toBe("/app/concepts/concept_0/execution");
    expect(result.plan45.firstAction.label).toContain("Intervention");
  });

  it("firstAction destination is /app/session for no_history", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.firstAction.destination).toBe("/app/session");
  });

  it("firstAction is non-null for all states", () => {
    const noHistory = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(noHistory.plan20.firstAction).toBeDefined();

    const sparse = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(sparse.plan20.firstAction).toBeDefined();

    const ready = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(ready.plan45.firstAction).toBeDefined();
  });
});

describe("buildDailyStudyPlanBundle — v2: 20-min block shaping", () => {
  it("20-min plan has at most 2 blocks when candidates exist", () => {
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
    expect(result.plan20.blocks.length).toBeLessThanOrEqual(2);
  });

  it("20-min plan block times are each capped at 10 min", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    for (const block of result.plan20.blocks) {
      expect(block.estimatedMinutes).toBeLessThanOrEqual(10);
    }
  });

  it("20-min plan includes top 2 priority blocks (not just time-greedy)", () => {
    // With overdue retention (priority 9) and focus_concept (priority 9),
    // both should appear in the 20-min plan despite total being 20 min
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const kinds = result.plan20.blocks.map((b) => b.kind);
    expect(kinds).toContain("retention_check");
    expect(kinds).toContain("focus_concept");
  });
});

describe("buildDailyStudyPlanBundle — v2: 45-min block shaping", () => {
  it("45-min plan has at most 3 blocks", () => {
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
        dueRetentionConceptKeys: ["concept_3"],
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.blocks.length).toBeLessThanOrEqual(3);
  });
});

describe("buildDailyStudyPlanBundle — v2: sparse_history improvements", () => {
  it("sparse plan without overdue retention has a review block as support", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
      }),
    );
    // 20-min plan should have 2 blocks: focus_concept + retention_check (review)
    expect(result.plan20.blocks.length).toBe(2);
    expect(result.plan20.blocks[0].kind).toBe("focus_concept");
    expect(result.plan20.blocks[1].kind).toBe("retention_check");
  });

  it("sparse plan with overdue retention replaces generic review with overdue check", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_0"],
      }),
    );
    const retentionBlocks = result.plan20.blocks.filter((b) => b.kind === "retention_check");
    expect(retentionBlocks.length).toBeGreaterThan(0);
    // Should reference the overdue concept
    expect(retentionBlocks.some((b) => b.conceptKey === "concept_0")).toBe(true);
  });

  it("sparse plan mainFocus references top recommendation label", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 5,
        playerIntelligence: makeReadyIntelligence(),
      }),
    );
    expect(result.plan20.mainFocus).toContain("Concept 0");
  });
});

// ─── v3 tests ─────────────────────────────────────────────────────────────────

function makeBridgeBundle(
  overrides: Partial<import("./real-hand-bridge").RealHandBridgeBundle> = {},
): import("./real-hand-bridge").RealHandBridgeBundle {
  return {
    generatedAt: "2026-03-24T10:00:00.000Z",
    state: "linked_candidates",
    summary: {
      headline: "Bridge candidates found",
      detail: "1 linked candidate",
      candidateCount: 1,
      linkedCandidateCount: 1,
      weakCandidateCount: 0,
    },
    candidates: [
      {
        conceptKey: "concept_0",
        conceptLabel: "Concept 0",
        linkageStrength: "strong",
        bridgeReason: "River defense pattern matches drill weakness.",
        urgency: "high",
        realPlaySummary: { occurrences: 3, reviewSpotCount: 5, latestHandAt: "2026-03-22" },
        supportingHands: [],
        recommendedReviewTarget: {
          type: "concept_review",
          label: "Review Concept 0",
          conceptKey: "concept_0",
        },
        suggestedNextAction: {
          type: "review_concept_detail",
          label: "Open concept detail",
          detail: "Review real hands in context of this weakness",
        },
      },
    ],
    ...overrides,
  };
}

describe("buildDailyStudyPlanBundle — v3: session arc ordering", () => {
  it("execute_intervention always leads the session arc (arc position 1)", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    expect(result.plan45.blocks[0].kind).toBe("execute_intervention");
  });

  it("focus_concept precedes retention_check in session arc", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const idx = (kind: string) => result.plan45.blocks.findIndex((b) => b.kind === kind);
    expect(idx("focus_concept")).toBeLessThan(idx("retention_check"));
  });

  it("review_real_hands follows focus_concept in arc", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
      }),
    );
    const idx = (kind: string) => result.plan90.blocks.findIndex((b) => b.kind === kind);
    expect(idx("focus_concept")).toBeLessThan(idx("review_real_hands"));
  });

  it("inspect_replay_drift is last in arc when multiple blocks present", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({
          memory: {
            diagnosisCount: 0,
            activeInterventions: 0,
            completedInterventions: 0,
            interventionSuccessRate: null,
            recurringLeakConcepts: ["concept_3"],
            recoveredConcepts: [],
            regressedConcepts: [],
            stabilizingConcepts: [],
          },
        }),
        importedHandCount: 3,
      }),
    );
    const blocks = result.plan90.blocks;
    const lastKind = blocks[blocks.length - 1].kind;
    expect(lastKind).toBe("inspect_replay_drift");
  });
});

describe("buildDailyStudyPlanBundle — v3: bridge integration", () => {
  it("review_real_hands block title references bridge candidate label when bridge is linked", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        bridgeBundle: makeBridgeBundle(),
      }),
    );
    const handsBlock = result.plan90.blocks.find((b) => b.kind === "review_real_hands");
    expect(handsBlock).toBeDefined();
    expect(handsBlock?.title).toContain("Concept 0");
    expect(handsBlock?.conceptKey).toBe("concept_0");
  });

  it("review_real_hands reason references bridge reason when bridge is linked", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        bridgeBundle: makeBridgeBundle(),
      }),
    );
    const handsBlock = result.plan90.blocks.find((b) => b.kind === "review_real_hands");
    expect(handsBlock?.reason).toContain("River defense pattern matches drill weakness.");
  });

  it("high-urgency bridge candidate boosts review_real_hands priority (included in plan45)", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        bridgeBundle: makeBridgeBundle(), // urgency: "high"
      }),
    );
    // High-urgency bridge bumps priority to 7 (ties with due retention check)
    const hasHandsBlock = result.plan45.blocks.some((b) => b.kind === "review_real_hands");
    // With focus_concept (pri 9) + review_real_hands (pri 7, high bridge urgency) in 45 min plan
    expect(hasHandsBlock).toBe(true);
  });

  it("whyThisPlan references real-play occurrence count when bridge has linked candidates", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        bridgeBundle: makeBridgeBundle(),
      }),
    );
    expect(result.plan45.whyThisPlan).toContain("Real hands confirm");
    expect(result.plan45.whyThisPlan).toContain("3"); // occurrences from bridge candidate
  });

  it("bridge with no_recent_evidence state does not enrich blocks", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        bridgeBundle: makeBridgeBundle({ state: "no_recent_evidence", candidates: [] }),
      }),
    );
    const handsBlock = result.plan90.blocks.find((b) => b.kind === "review_real_hands");
    // Falls back to generic block when bridge state is not linked_candidates
    expect(handsBlock?.title).toBe("Review Real Hands");
    expect(handsBlock?.conceptKey).toBeNull();
  });

  it("execute_intervention reason references real-play evidence when bridge has matching candidate", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
        bridgeBundle: makeBridgeBundle(), // candidate for concept_0
      }),
    );
    expect(result.plan45.blocks[0].kind).toBe("execute_intervention");
    expect(result.plan45.blocks[0].reason).toContain("real-play occurrence");
  });

  it("inspect_replay_drift reason references bridge reason when recurring leak has bridge candidate", () => {
    const bridgeForLeak = makeBridgeBundle({
      candidates: [
        {
          conceptKey: "concept_3",
          conceptLabel: "Concept 3",
          linkageStrength: "strong",
          bridgeReason: "Concept 3 appears in 4 river spots.",
          urgency: "medium",
          realPlaySummary: { occurrences: 4, reviewSpotCount: 2 },
          supportingHands: [],
          recommendedReviewTarget: {
            type: "concept_review",
            label: "Review Concept 3",
            conceptKey: "concept_3",
          },
          suggestedNextAction: {
            type: "review_concept_detail",
            label: "Open concept detail",
            detail: "",
          },
        },
      ],
    });

    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({
          memory: {
            diagnosisCount: 0,
            activeInterventions: 0,
            completedInterventions: 0,
            interventionSuccessRate: null,
            recurringLeakConcepts: ["concept_3"],
            recoveredConcepts: [],
            regressedConcepts: [],
            stabilizingConcepts: [],
          },
        }),
        bridgeBundle: bridgeForLeak,
      }),
    );

    const replayBlock = result.plan90.blocks.find((b) => b.kind === "inspect_replay_drift");
    expect(replayBlock).toBeDefined();
    expect(replayBlock?.reason).toContain("Concept 3 appears in 4 river spots.");
  });

  it("omitting bridgeBundle produces same generic blocks as before (no regression)", () => {
    const withoutBridge = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 5,
      }),
    );
    const handsBlock = withoutBridge.plan90.blocks.find((b) => b.kind === "review_real_hands");
    expect(handsBlock?.title).toBe("Review Real Hands");
    expect(handsBlock?.reason).toContain("5 imported hands");
    expect(handsBlock?.destination).toBe("/app/hands");
  });
});

// ─── v4 tests ─────────────────────────────────────────────────────────────────

describe("buildDailyStudyPlanBundle — v4: per-block action framing", () => {
  it("every block in a ready plan has a non-empty actionInstruction", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    for (const block of result.plan90.blocks) {
      expect(block.actionInstruction.length).toBeGreaterThan(0);
    }
  });

  it("every block in a ready plan has a non-empty completionCondition", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
      }),
    );
    for (const block of result.plan90.blocks) {
      expect(block.completionCondition.length).toBeGreaterThan(0);
    }
  });

  it("execute_intervention block actionInstruction references the concept label", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    const block = result.plan45.blocks.find((b) => b.kind === "execute_intervention");
    expect(block?.actionInstruction).toContain("Concept 0");
  });

  it("focus_concept block completionCondition references the concept label", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    const block = result.plan45.blocks.find((b) => b.kind === "focus_concept");
    expect(block?.completionCondition).toContain("Concept 0");
  });

  it("retention_check completionCondition mentions ≥70%", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const block = result.plan45.blocks.find((b) => b.kind === "retention_check");
    expect(block?.completionCondition).toContain("70%");
  });

  it("review_real_hands actionInstruction mentions tagging hands", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 5,
      }),
    );
    const block = result.plan90.blocks.find((b) => b.kind === "review_real_hands");
    expect(block?.actionInstruction).toContain("tag");
  });

  it("no_history block has coaching-specific actionInstruction", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.blocks[0].actionInstruction).toContain("10");
  });

  it("sparse_history focus_concept block actionInstruction references top recommendation", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    const block = result.plan20.blocks.find((b) => b.kind === "focus_concept");
    expect(block?.actionInstruction).toContain("Concept 0");
  });
});

describe("buildDailyStudyPlanBundle — v4: nextStepHint", () => {
  it("non-last blocks have a nextStepHint starting with 'Next:'", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const blocks = result.plan45.blocks;
    // plan45 with focus_concept + retention_check: first block should point to next
    if (blocks.length >= 2) {
      expect(blocks[0].nextStepHint).toMatch(/^Next:/);
    }
  });

  it("last block nextStepHint signals session completion", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    const blocks = result.plan45.blocks;
    const lastBlock = blocks[blocks.length - 1];
    expect(lastBlock.nextStepHint).toContain("Session complete");
  });

  it("single-block plan has a session-complete nextStepHint", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence({ recommendations: [] }) }),
    );
    // With no recommendations, plan20 may have only 1 block (no_history-like but ready state with no recs)
    // Let's use no_history to guarantee single block
    const noHistory = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(noHistory.plan20.blocks[0].nextStepHint).toContain("Session complete");
  });

  it("nextStepHint for non-last block references the next block title", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const blocks = result.plan45.blocks;
    if (blocks.length >= 2) {
      expect(blocks[0].nextStepHint).toContain(blocks[1].title);
    }
  });

  it("each plan (20/45/90) has independent nextStepHints based on its own block set", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        importedHandCount: 3,
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    // 20-min plan has at most 2 blocks; its last block should say "Session complete"
    const last20 = result.plan20.blocks[result.plan20.blocks.length - 1];
    expect(last20.nextStepHint).toContain("Session complete");

    // 45-min plan last block should also say "Session complete"
    const last45 = result.plan45.blocks[result.plan45.blocks.length - 1];
    expect(last45.nextStepHint).toContain("Session complete");
  });
});

describe("buildDailyStudyPlanBundle — v4: sessionGoal", () => {
  it("no_history sessionGoal is coaching-oriented", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.sessionGoal).toContain("baseline");
  });

  it("sparse_history sessionGoal references the top concept label when available", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.sessionGoal).toContain("Concept 0");
  });

  it("execute_intervention sessionGoal references intervention reps and concept label", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        activeInterventionConceptKey: "concept_0",
        activeInterventionConceptLabel: "Concept 0",
      }),
    );
    expect(result.plan45.sessionGoal).toContain("Concept 0");
    expect(result.plan45.sessionGoal).toContain("intervention");
  });

  it("focus_concept sessionGoal references error pattern identification", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan45.sessionGoal).toContain("error pattern");
    expect(result.plan45.sessionGoal).toContain("Concept 0");
  });

  it("sessionGoal is non-empty for all states and session lengths", () => {
    const noHistory = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(noHistory.plan20.sessionGoal.length).toBeGreaterThan(0);

    const sparse = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(sparse.plan45.sessionGoal.length).toBeGreaterThan(0);

    const ready = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(ready.plan90.sessionGoal.length).toBeGreaterThan(0);
  });
});

describe("buildDailyStudyPlanBundle — v4: finishingCondition", () => {
  it("no_history finishingCondition references first session completion", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.finishingCondition).toContain("10-drill");
  });

  it("sparse_history finishingCondition references 20 total attempts", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.finishingCondition).toContain("20 total");
  });

  it("single-block ready plan finishingCondition names the block kind", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence({ recommendations: [] }),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    // With no recommendations, only the overdue retention_check block is present
    const singleBlockPlan = result.plan20;
    if (singleBlockPlan.blocks.length === 1) {
      expect(singleBlockPlan.finishingCondition).toContain("retention check");
    }
  });

  it("multi-block plan finishingCondition references block count", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({
        totalAttempts: 30,
        playerIntelligence: makeReadyIntelligence(),
        overdueRetentionConceptKeys: ["concept_2"],
      }),
    );
    const blockCount = result.plan45.blocks.length;
    if (blockCount > 1) {
      expect(result.plan45.finishingCondition).toContain(`${blockCount} blocks`);
    }
  });

  it("finishingCondition is non-empty for all session lengths", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 30, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.finishingCondition.length).toBeGreaterThan(0);
    expect(result.plan45.finishingCondition.length).toBeGreaterThan(0);
    expect(result.plan90.finishingCondition.length).toBeGreaterThan(0);
  });
});

describe("buildDailyStudyPlanBundle — v4: improved no_history / sparse_history copy", () => {
  it("no_history whyThisPlan is coaching-voice (not just fallback placeholder)", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    expect(result.plan20.whyThisPlan).toContain("coaching engine");
    expect(result.plan20.whyThisPlan.length).toBeGreaterThan(80);
  });

  it("sparse_history whyThisPlan references calibration and leak targeting", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    expect(result.plan20.whyThisPlan).toContain("calibrating");
    expect(result.plan20.whyThisPlan).toContain("leaks");
  });

  it("no_history block reason is welcoming and forward-looking", () => {
    const result = buildDailyStudyPlanBundle(makeInput({ totalAttempts: 0 }));
    const block = result.plan20.blocks[0];
    expect(block.reason).toContain("coaching foundation");
  });

  it("sparse_history focus_concept reason mentions sharpening the engine", () => {
    const result = buildDailyStudyPlanBundle(
      makeInput({ totalAttempts: 5, playerIntelligence: makeReadyIntelligence() }),
    );
    const block = result.plan20.blocks.find((b) => b.kind === "focus_concept");
    expect(block?.reason).toContain("sharpens");
  });
});
