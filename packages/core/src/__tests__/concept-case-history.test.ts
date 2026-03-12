import { describe, expect, it } from "vitest";
import {
  buildConceptCaseHistory,
  deriveConceptCoachingExplanation,
  deriveConceptNextStep,
  type ConceptCaseHistoryInput,
  type InterventionRecommendation,
} from "../browser";

function makeRecommendation(overrides: Partial<InterventionRecommendation> = {}): InterventionRecommendation {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    action: "assign_intervention",
    recommendedStrategy: "threshold_repair",
    reasonCodes: ["new_diagnosis_without_intervention", "persistent_recurring_leak"],
    confidence: "high",
    priority: 82,
    evidence: ["Repeated diagnoses are attached to the concept."],
    summary: "Assign an intervention for River Bluff Catching with threshold repair.",
    decisionReason: "River Bluff Catching should assign intervention because recurring evidence is already clear.",
    supportingSignals: [
      { kind: "recovery", code: "unaddressed", detail: "Recovery stage is unaddressed." },
    ],
    whyNotOtherActions: ["Monitoring would be too passive."],
    suggestedIntensity: "high",
    metadata: {
      currentInterventionId: undefined,
      currentInterventionStatus: undefined,
      patternTypes: [],
      requiresNewAssignment: true,
      requiresStrategyChange: false,
      transferFocus: false,
    },
    ...overrides,
  };
}

function makeInput(overrides: Partial<ConceptCaseHistoryInput> = {}): ConceptCaseHistoryInput {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    summary: "Catch profitable bluff-catching spots on the river.",
    diagnosisHistory: [
      { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
    ],
    interventionHistory: [],
    recoveryStage: "unaddressed",
    patterns: [],
    latestInterventionRecommendation: makeRecommendation(),
    decisionSummary: undefined,
    retentionSummary: {
      latestState: undefined,
      latestReason: undefined,
      latestScheduledFor: undefined,
      dueCount: 0,
      overdueCount: 0,
      lastResult: null,
      validationState: "none",
    },
    recentAttempts: {
      sampleSize: 3,
      recentAverage: 0.42,
      averageScore: 0.45,
      failedCount: 2,
      trendDirection: "worsening",
    },
    recurrenceCount: 2,
    reviewPressure: 1,
    planningReasons: ["recurring_leak", "weakness_balance"],
    ...overrides,
  };
}

describe("concept case history", () => {
  it("builds a newly diagnosed concept with no intervention as assignable repair work", () => {
    const history = buildConceptCaseHistory(makeInput());
    const explanation = deriveConceptCoachingExplanation(history);
    const nextStep = deriveConceptNextStep(history);

    expect(history.diagnosisCount).toBe(1);
    expect(history.recurringLeak).toBe(true);
    expect(explanation.statusLabel).toBe("Diagnosed, Not Yet Repaired");
    expect(nextStep.nextAction).toBe("assign_intervention");
  });

  it("treats active repair with weak recent attempts as live intervention work", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "active_repair",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "in_progress", createdAt: "2026-03-11T10:00:00.000Z" },
      ],
      latestInterventionRecommendation: makeRecommendation({
        action: "continue_intervention",
        recommendedStrategy: "threshold_repair",
        reasonCodes: ["active_intervention_improving"],
      }),
    }));

    expect(deriveConceptCoachingExplanation(history).statusLabel).toBe("Active Repair");
    expect(deriveConceptNextStep(history).nextAction).toBe("continue_intervention");
  });

  it("treats stabilizing concepts with pending retention as still provisional", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "stabilizing",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "stabilizing", createdAt: "2026-03-11T10:00:00.000Z", improved: true, preScore: 0.34, postScore: 0.72 },
      ],
      retentionSummary: {
        latestState: "upcoming",
        latestReason: "stabilizing_followup",
        latestScheduledFor: "2026-03-15T10:00:00.000Z",
        dueCount: 0,
        overdueCount: 0,
        lastResult: null,
        validationState: "provisional",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "run_retention_check",
        recommendedStrategy: "stabilization_reinforcement",
        reasonCodes: ["recovered_with_recurrence_risk"],
      }),
    }));

    const explanation = deriveConceptCoachingExplanation(history);
    expect(explanation.statusLabel).toBe("Stabilizing");
    expect(explanation.recoveryConfidence).toBe("medium");
  });

  it("recognizes recovered concepts with successful retention as validated", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "recovered",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "completed", createdAt: "2026-03-11T10:00:00.000Z", improved: true, preScore: 0.34, postScore: 0.78 },
      ],
      retentionSummary: {
        latestState: "completed_pass",
        latestReason: "recovered_validation",
        latestScheduledFor: "2026-03-15T10:00:00.000Z",
        dueCount: 0,
        overdueCount: 0,
        lastResult: "pass",
        validationState: "validated",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "close_intervention_loop",
        recommendedStrategy: "stabilization_reinforcement",
        reasonCodes: ["recovered_and_stable"],
      }),
    }));

    const explanation = deriveConceptCoachingExplanation(history);
    expect(explanation.statusLabel).toBe("Recovered and Validated");
    expect(explanation.recoveryConfidence).toBe("high");
  });

  it("promotes overdue retention into the next action even for recovered concepts", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "recovered",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "completed", createdAt: "2026-03-11T10:00:00.000Z", improved: true },
      ],
      retentionSummary: {
        latestState: "overdue",
        latestReason: "recovered_validation",
        latestScheduledFor: "2026-03-15T10:00:00.000Z",
        dueCount: 0,
        overdueCount: 1,
        lastResult: null,
        validationState: "provisional",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "monitor_only",
        recommendedStrategy: "stabilization_reinforcement",
        reasonCodes: ["recovered_and_stable"],
      }),
    }));

    const explanation = deriveConceptCoachingExplanation(history);
    const nextStep = deriveConceptNextStep(history);
    expect(explanation.statusLabel).toBe("Recovered, Validation Overdue");
    expect(nextStep.nextAction).toBe("run_retention_validation");
    expect(nextStep.nextActionPriority).toBe("urgent");
  });

  it("marks failed retention after recovery as regressed and reopen-worthy", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "regressed",
      interventionHistory: [
        { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "regressed", createdAt: "2026-03-11T10:00:00.000Z", improved: false, preScore: 0.72, postScore: 0.44 },
      ],
      patterns: [
        {
          id: "p1",
          type: "regression_after_recovery",
          confidence: "high",
          severity: 0.9,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["The concept recovered once and then regressed."],
          coachingImplication: "Reopen repair.",
          suggestedBiases: ["repair_intensity"],
        },
      ],
      retentionSummary: {
        latestState: "completed_fail",
        latestReason: "failed_retention_recheck",
        latestScheduledFor: "2026-03-15T10:00:00.000Z",
        dueCount: 0,
        overdueCount: 0,
        lastResult: "fail",
        validationState: "failed",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "reopen_intervention",
        recommendedStrategy: "stabilization_reinforcement",
        reasonCodes: ["regression_after_recovery"],
      }),
    }));

    const explanation = deriveConceptCoachingExplanation(history);
    expect(explanation.statusLabel).toBe("Regressed");
    expect(explanation.riskFlags).toContain("regression_risk");
    expect(deriveConceptNextStep(history).nextAction).toBe("reopen_intervention");
  });

  it("surfaces decision instability when recommendations are shifting", () => {
    const history = buildConceptCaseHistory(makeInput({
      recoveryStage: "active_repair",
      decisionSummary: {
        latestAction: "change_intervention_strategy",
        latestStrategy: "mixed_repair",
        latestPriority: 88,
        latestCreatedAt: "2026-03-12T10:00:00.000Z",
        latestActedUpon: false,
        latestDecisionChanged: true,
        currentRecommendationChanged: true,
        escalationCount: 2,
        stability: "flipping",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "change_intervention_strategy",
        recommendedStrategy: "mixed_repair",
        reasonCodes: ["intervention_not_sticking"],
      }),
    }));

    const explanation = deriveConceptCoachingExplanation(history);
    expect(explanation.stabilityAssessment).toContain("flipping");
    expect(explanation.riskFlags).toContain("decision_instability");
  });

  it("keeps repeated escalation pressure visible on recurring leaks", () => {
    const history = buildConceptCaseHistory(makeInput({
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.88, createdAt: "2026-03-09T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.86, createdAt: "2026-03-08T10:00:00.000Z" },
      ],
      decisionSummary: {
        latestAction: "escalate_intervention",
        latestStrategy: "threshold_repair",
        latestPriority: 92,
        latestCreatedAt: "2026-03-12T10:00:00.000Z",
        latestActedUpon: true,
        latestDecisionChanged: false,
        currentRecommendationChanged: false,
        escalationCount: 3,
        stability: "stable",
      },
      latestInterventionRecommendation: makeRecommendation({
        action: "escalate_intervention",
        recommendedStrategy: "threshold_repair",
        reasonCodes: ["persistent_recurring_leak", "worsening_recent_trend"],
      }),
      recurrenceCount: 4,
    }));

    const nextStep = deriveConceptNextStep(history);
    expect(nextStep.nextAction).toBe("escalate_intervention");
    expect(nextStep.nextActionPriority).toBe("high");
    expect(nextStep.blockingRisks).toContain("recurring_leak");
  });
});
