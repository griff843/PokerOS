import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConceptCaseScreen } from "./ConceptCaseScreen";
import type { ConceptCaseResponse } from "@/lib/concept-case";
import type { EngineReplaySummary } from "@/lib/input-snapshots";
import type { ConceptTransferEvaluation } from "@poker-coach/core/browser";
import type { CalibrationSurfaceAdapter } from "@/lib/calibration-surface";

function makeReplaySummary(): EngineReplaySummary {
  return {
    inputChanged: false,
    outputChanged: false,
    changedEvidenceFields: [],
    manifestDrift: { matches: true, changedFields: [] },
    interpretation: "stable",
  };
}

function makeTransferEvaluation(): ConceptTransferEvaluation {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    status: "transfer_gap",
    confidence: "medium",
    evidenceSufficiency: "moderate",
    pressure: "medium",
    studyPerformance: 0.72,
    realPlayPerformance: 0.40,
    studyVsRealPlayDelta: 0.32,
    supportingEvidence: ["Study improvement is outpacing real play."],
    riskFlags: ["study_ahead_of_real_play"],
    summary: "Study gains are not transferring to real play.",
    coachExplanation: "The player is improving in drills but the real-play evidence still shows a gap.",
    realPlayEvidence: {
      occurrences: 3,
      reviewSpotCount: 2,
    },
  };
}

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
    transferEvaluation: makeTransferEvaluation(),
    replayMetadata: {
      recommendation: makeReplaySummary(),
      transfer: makeReplaySummary(),
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

function makeCalibrationSurface(
  overrides: Partial<CalibrationSurfaceAdapter> = {},
): CalibrationSurfaceAdapter {
  return {
    state: "strong_evidence",
    headline: "Calibration outcomes include strong evidence.",
    detail: "Trust signals are now stable enough to summarize.",
    generatedAt: "2026-03-25T01:00:00.000Z",
    conceptSummaries: [
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        priority: "high",
        interventionState: "regressing",
        evidenceState: "strong_evidence",
        trustLevel: "medium",
        whyThisStillMatters: "Transfer has slipped after earlier progress, so this concept remains trust-critical.",
        transferSummary: "Transfer has regressed in recent hands.",
        retentionSummary: "Recent retention validation failed, so the concept is not holding cleanly.",
        suggestedAction: {
          label: "Repair Transfer Gap",
          detail: "Replay and repair the transfer leak before the next session.",
        },
        destination: "/app/concepts/river_bluff_catching",
      },
    ],
    topConceptSummaries: [],
    highlightedConcept: undefined,
    highPriorityCount: 1,
    ...overrides,
  };
}

describe("ConceptCaseScreen", () => {
  it("renders canonical concept-case data without re-deriving explanation text", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("River Bluff Catching");
    expect(html).toContain("Stabilizing");
    expect(html).toContain("River Bluff Catching moves up because a retention validation block is due now.");
    expect(html).toContain("run retention validation");
    expect(html).toContain("/app/concepts/river_bluff_catching/replay");
  });

  it("renders transfer evaluation panel with status and coach explanation", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("transfer gap");
    expect(html).toContain("The player is improving in drills but the real-play evidence still shows a gap.");
    expect(html).toContain("Real-Play Transfer");
  });

  it("renders retention panel with schedule state and validation state", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("Retention Validation");
    expect(html).toContain("provisional");
    expect(html).toContain("stabilizing followup");
  });

  it("renders decision audit panel with latest decision fields", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("Decision Audit");
    expect(html).toContain("add transfer block");
    expect(html).toContain("transfer training");
    expect(html).toContain("shifting");
  });

  it("renders replay panel with stable interpretation", () => {
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data: makeConceptCaseResponse() }} />);

    expect(html).toContain("Replayability Summary");
    expect(html).toContain("No meaningful change in evidence or output across the latest stored snapshot pair.");
  });

  it("renders replay panel with evidence_changed_output_changed interpretation", () => {
    const data = makeConceptCaseResponse();
    data.replayMetadata.recommendation = {
      ...makeReplaySummary(),
      inputChanged: true,
      outputChanged: true,
      changedEvidenceFields: ["recurrenceCount"],
      interpretation: "evidence_changed_output_changed",
    };
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data }} />);

    expect(html).toContain("Evidence shifted and the output also changed");
    expect(html).toContain("recurrenceCount");
  });

  it("renders strategy blueprint panel when present", () => {
    const data = makeConceptCaseResponse();
    data.strategyBlueprint = {
      strategyType: "transfer_training",
      title: "Transfer Training Plan",
      objective: "Bridge drill gains into real-play performance for river bluff-catching.",
      intensity: "high",
      targetWeaknessProfile: ["transfer_gap"],
      recommendedAttemptWindow: { sessions: 4, attempts: 12 },
      recommendedDrillMix: { repair: 0.2, review: 0.3, applied: 0.35, validation: 0.15 },
      sessionEmphasis: [],
      reviewEmphasis: [],
      transferEmphasis: ["imported_hand_review"],
      stabilizationEmphasis: [],
      successCriteriaHints: ["Real-play score closes within 10 points of study score."],
      escalationTriggerHints: ["No improvement in real-play occurrences after 2 sessions."],
      retentionFollowUpGuidance: [],
      coachNotes: ["Focus on applied and review drills that map to live hands."],
      rationale: "Transfer is the active gap.",
      modifiers: [],
    };
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data }} />);

    expect(html).toContain("Strategy Blueprint");
    expect(html).toContain("Transfer Training Plan");
    expect(html).toContain("Bridge drill gains into real-play performance for river bluff-catching.");
    expect(html).toContain("Real-play score closes within 10 points of study score.");
    expect(html).toContain("Focus on applied and review drills that map to live hands.");
  });

  it("renders sparse strategy blueprint panel when blueprint is absent", () => {
    const data = makeConceptCaseResponse();
    data.strategyBlueprint = undefined;
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data }} />);

    expect(html).toContain("Strategy Blueprint");
    expect(html).toContain("No strategy blueprint is available yet.");
  });

  it("renders sparse decision panel when decisionAudit is absent", () => {
    const data = makeConceptCaseResponse();
    data.decisionAudit = undefined;
    const html = renderToStaticMarkup(<ConceptCaseScreen state={{ loading: false, data }} />);

    expect(html).toContain("Decision Audit");
    expect(html).toContain("No intervention decision snapshots are stored yet");
  });

  it("renders concept-specific calibration trust support when available", () => {
    const calibration = makeCalibrationSurface();
    const html = renderToStaticMarkup(
      <ConceptCaseScreen
        state={{
          loading: false,
          data: makeConceptCaseResponse(),
          calibration,
          conceptCalibration: calibration.conceptSummaries[0],
        }}
      />
    );

    expect(html).toContain("Calibration Trust");
    expect(html).toContain("River Bluff Catching calibration");
    expect(html).toContain("Transfer has regressed in recent hands.");
  });

  it("renders sparse calibration copy when only bundle-level calibration is available", () => {
    const html = renderToStaticMarkup(
      <ConceptCaseScreen
        state={{
          loading: false,
          data: makeConceptCaseResponse(),
          calibration: makeCalibrationSurface({
            state: "no_meaningful_history",
            headline: "Calibration outcomes do not yet have meaningful history.",
            detail: "The adapter did not find enough persisted outcome history to make strong trust claims yet.",
            conceptSummaries: [],
            topConceptSummaries: [],
            highlightedConcept: undefined,
            highPriorityCount: 0,
          }),
          conceptCalibration: null,
        }}
      />
    );

    expect(html).toContain("Calibration outcomes do not yet have meaningful history.");
    expect(html).toContain("make strong trust claims yet");
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
