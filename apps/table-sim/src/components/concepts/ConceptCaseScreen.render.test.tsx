import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConceptCaseScreen } from "./ConceptCaseScreen";
import type { ConceptCaseResponse } from "@/lib/concept-case";

function makeConceptCaseResponse(): ConceptCaseResponse {
  return {
    conceptKey: "river_bluff_catching",
    history: {
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      summary: "Catch profitable bluff-catching spots on the river.",
      firstDiagnosedAt: "2026-03-01T10:00:00.000Z",
      mostRecentDiagnosisAt: "2026-03-12T10:00:00.000Z",
      diagnosisCount: 3,
      recurringLeak: true,
      recurrenceCount: 4,
      reviewPressure: 1,
      interventionHistorySummary: {
        total: 2,
        active: 1,
        completed: 1,
        regressed: 0,
        abandoned: 0,
        improved: 1,
        failed: 0,
        latestStatus: "stabilizing",
        latestInterventionAt: "2026-03-12T11:00:00.000Z",
      },
      interventionLifecycleSummary: {
        hasActiveIntervention: true,
        latestStatus: "stabilizing",
        activeStatuses: ["stabilizing"],
      },
      interventionOutcomeSummary: {
        improvedCount: 1,
        failedCount: 0,
        latestImproved: true,
        latestPreScore: 0.34,
        latestPostScore: 0.72,
      },
      recoveryStage: "stabilizing",
      patternSummary: {
        count: 2,
        types: ["persistent_threshold_leak", "real_play_transfer_gap"],
        topPatternType: "persistent_threshold_leak",
        transferGap: true,
        interventionNotSticking: false,
      },
      latestDecisionSummary: {
        latestAction: "add_transfer_block",
        latestStrategy: "transfer_training",
        latestPriority: 84,
        latestCreatedAt: "2026-03-12T12:00:00.000Z",
        latestActedUpon: true,
        latestDecisionChanged: true,
        currentRecommendationChanged: false,
        escalationCount: 1,
        stability: "shifting",
      },
      decisionStabilitySummary: {
        stability: "shifting",
        escalationCount: 1,
        latestDecisionChanged: true,
        currentRecommendationChanged: false,
      },
      retentionSummary: {
        latestState: "due",
        latestReason: "stabilizing_followup",
        latestScheduledFor: "2026-03-15T10:00:00.000Z",
        dueCount: 1,
        overdueCount: 0,
        lastResult: null,
        validationState: "provisional",
      },
      recentAttemptSummary: {
        sampleSize: 6,
        recentAverage: 0.63,
        averageScore: 0.58,
        lastAttemptAt: "2026-03-12T09:30:00.000Z",
        failedCount: 2,
        trendDirection: "improving",
      },
      prioritizationContext: {
        planningReasons: ["active_intervention", "retention_check"],
        recommendationReasons: ["real_play_transfer_gap"],
        currentRecommendationAction: "add_transfer_block",
        currentRecommendationStrategy: "transfer_training",
      },
      supportingEvidence: [
        { kind: "diagnosis", code: "diagnosis_count", detail: "3 persisted diagnosis entries are attached to this concept." },
        { kind: "retention", code: "due", detail: "Latest retention state is due." },
      ],
    },
    explanation: {
      statusLabel: "Stabilizing",
      statusReason: "River Bluff Catching improved enough to leave raw repair mode, but retention is still being verified before the concept is treated as done.",
      priorityExplanation: "River Bluff Catching moves up because a retention validation block is due now.",
      recommendedNextAction: "run_retention_validation",
      recommendedActionReason: "River Bluff Catching is due for an explicit retention check to confirm the gain is still holding.",
      stabilityAssessment: "Intervention decisions have been shifting for River Bluff Catching, so the current plan should be treated as directionally useful but not fully settled.",
      recoveryConfidence: "medium",
      riskFlags: ["retention_due", "transfer_gap"],
      supportingEvidence: [
        { kind: "diagnosis", code: "diagnosis_count", detail: "3 persisted diagnosis entries are attached to this concept." },
        { kind: "retention", code: "due", detail: "Latest retention state is due." },
      ],
    },
    nextStep: {
      nextAction: "run_retention_validation",
      nextActionType: "retention",
      nextActionPriority: "high",
      nextActionReason: "River Bluff Catching is due for an explicit retention check to confirm the gain is still holding.",
      blockingRisks: ["retention_due", "transfer_gap"],
      coachNote: "River Bluff Catching is not asking for more broad repair right now. It needs a clean retention check so recovery can either be confirmed or honestly reopened.",
    },
    decisionAudit: {
      conceptKey: "river_bluff_catching",
      latestDecision: {
        id: "dec-1",
        conceptKey: "river_bluff_catching",
        createdAt: "2026-03-12T12:00:00.000Z",
        action: "add_transfer_block",
        recommendedStrategy: "transfer_training",
        confidence: "high",
        priority: 84,
        suggestedIntensity: "high",
        recoveryStage: "stabilizing",
        currentInterventionStatus: "stabilizing",
        reasonCodes: ["real_play_transfer_gap"],
        supportingSignals: [],
        evidence: [],
        patternTypes: ["real_play_transfer_gap"],
        recurringLeak: true,
        transferGap: true,
        actedUpon: true,
        linkedInterventionId: "int-1",
        sourceContext: "command_center",
        supersedesDecisionId: null,
      },
      previousDecision: undefined,
      latestDecisionChanged: true,
      currentRecommendationChanged: false,
      escalationCount: 1,
      stability: "shifting",
      lastActedOnDecision: undefined,
      lastUnactedDecision: undefined,
    },
    retention: {
      conceptKey: "river_bluff_catching",
      latestSchedule: {
        id: "ret-1",
        scheduledFor: "2026-03-15T10:00:00.000Z",
        status: "due",
        state: "due",
        reason: "stabilizing_followup",
        result: null,
        priority: 77,
      },
      dueCount: 1,
      overdueCount: 0,
      lastResult: null,
      validationState: "provisional",
    },
    recommendation: {
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      action: "add_transfer_block",
      recommendedStrategy: "transfer_training",
      reasonCodes: ["real_play_transfer_gap"],
      confidence: "high",
      priority: 84,
      evidence: ["Drill gains are not fully transferring."],
      summary: "Add a transfer block for River Bluff Catching with transfer training.",
      decisionReason: "The lab-side gain is real, but transfer is the current gap.",
      supportingSignals: [{ kind: "real_play", code: "real_play_review_spots", detail: "2 real-play review spots still map here." }],
      whyNotOtherActions: ["The failure mode is transfer, not raw concept ignorance."],
      suggestedIntensity: "high",
      metadata: {
        currentInterventionId: "int-1",
        currentInterventionStatus: "stabilizing",
        patternTypes: ["real_play_transfer_gap"],
        requiresNewAssignment: true,
        requiresStrategyChange: false,
        transferFocus: true,
      },
    },
  };
}

describe("ConceptCaseScreen", () => {
  it("renders canonical concept-case data without re-deriving explanation text", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("River Bluff Catching");
    expect(html).toContain("Stabilizing");
    expect(html).toContain("River Bluff Catching moves up because a retention validation block is due now.");
    expect(html).toContain("run retention validation");
    expect(html).toContain("/app/session");
  });

  it("renders a loading state cleanly", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: true }} />);

    expect(html).toContain("Loading concept case");
  });

  it("renders an error state cleanly", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, error: "Failed to load concept case" }} />);

    expect(html).toContain("Concept case unavailable");
    expect(html).toContain("Failed to load concept case");
  });

  it("renders an empty state when the concept case is missing", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: null }} />);

    expect(html).toContain("No concept case found");
  });
});
