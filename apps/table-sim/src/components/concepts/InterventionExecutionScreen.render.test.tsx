import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterventionExecutionScreen } from "./InterventionExecutionScreen";
import type { InterventionExecutionBundle } from "@/lib/intervention-execution";

function makeReplayMetadata() {
  return {
    recommendation: {
      inputChanged: false,
      outputChanged: false,
      changedEvidenceFields: [],
      manifestDrift: { matches: true, changedFields: [] },
      interpretation: "stable" as const,
    },
    transfer: {
      inputChanged: false,
      outputChanged: false,
      changedEvidenceFields: [],
      manifestDrift: { matches: true, changedFields: [] },
      interpretation: "stable" as const,
    },
  };
}

function makeActiveBundle(): InterventionExecutionBundle {
  return {
    conceptKey: "river_bluff_catching",
    label: "River Bluff Catching",
    executionStatus: "active",
    actionSummary: {
      action: "add_transfer_block",
      strategy: "transfer_training",
      intensity: "high",
      confidence: "high",
      priority: 84,
      summary: "Add a transfer block for River Bluff Catching with transfer training.",
      decisionReason: "The lab-side gain is real, but transfer is the current gap.",
      requiresNewAssignment: true,
      requiresStrategyChange: false,
      transferFocus: true,
      currentInterventionId: "int-1",
      currentInterventionStatus: "stabilizing",
    },
    evidenceSummary: {
      reasonCodes: ["real_play_transfer_gap"],
      evidence: ["Drill gains are not fully transferring to live play."],
      supportingSignals: [
        {
          kind: "real_play",
          code: "real_play_review_spots",
          detail: "2 real-play review spots still map here.",
        },
        {
          kind: "pattern",
          code: "transfer_gap",
          detail: "Real-play transfer gap pattern is active.",
        },
      ],
      patternTypes: ["real_play_transfer_gap"],
      whyNotOtherActions: ["The failure mode is transfer, not raw concept ignorance."],
    },
    strategyBlueprint: {
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
      retentionFollowUpGuidance: ["Schedule retention validation within 7 days of improvement."],
      coachNotes: ["Focus on applied and review drills that map to live hands."],
      rationale: "Transfer is the active gap.",
      modifiers: [],
    },
    historyContext: {
      diagnosisCount: 3,
      recurrenceCount: 4,
      recoveryStage: "stabilizing",
      interventionCount: 2,
      activeCount: 1,
      improvedCount: 1,
      failedCount: 0,
      latestStatus: "stabilizing",
      recurringLeak: true,
    },
    nextStep: {
      nextAction: "run_retention_validation",
      nextActionType: "retention",
      nextActionPriority: "high",
      nextActionReason: "River Bluff Catching is due for a retention check.",
      blockingRisks: ["retention_due"],
      coachNote: "Focus on the retention check before adding new material.",
    },
    replayMetadata: makeReplayMetadata(),
  };
}

describe("InterventionExecutionScreen", () => {
  it("renders active intervention with blueprint and evidence", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: makeActiveBundle() }} />
    );

    expect(html).toContain("River Bluff Catching");
    expect(html).toContain("Active Intervention");
    expect(html).toContain("add transfer block");
    expect(html).toContain("transfer training");
    expect(html).toContain("The lab-side gain is real, but transfer is the current gap.");
  });

  it("renders strategy blueprint panel with drill mix and objective", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: makeActiveBundle() }} />
    );

    expect(html).toContain("Blueprint");
    expect(html).toContain("Transfer Training Plan");
    expect(html).toContain("Bridge drill gains into real-play performance");
    expect(html).toContain("Transfer is the active gap.");
  });

  it("renders success criteria and escalation triggers", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: makeActiveBundle() }} />
    );

    expect(html).toContain("Exit Conditions");
    expect(html).toContain("Real-play score closes within 10 points of study score.");
    expect(html).toContain("Escalation Triggers");
    expect(html).toContain("No improvement in real-play occurrences after 2 sessions.");
  });

  it("renders evidence panel with reason codes and supporting signals", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: makeActiveBundle() }} />
    );

    expect(html).toContain("Why This Intervention");
    expect(html).toContain("Drill gains are not fully transferring to live play.");
    expect(html).toContain("real play transfer gap");
    expect(html).toContain("2 real-play review spots still map here.");
    expect(html).toContain("The failure mode is transfer, not raw concept ignorance.");
  });

  it("renders navigation links to concept detail and replay inspector", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: makeActiveBundle() }} />
    );

    expect(html).toContain("/app/concepts/river_bluff_catching");
    expect(html).toContain("/app/concepts/river_bluff_catching/replay");
  });

  it("renders recommended state with distinct header chips", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      executionStatus: "recommended",
      actionSummary: {
        ...makeActiveBundle().actionSummary!,
        currentInterventionId: undefined,
        currentInterventionStatus: undefined,
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Recommended Intervention");
    expect(html).toContain("new assignment required");
    expect(html).toContain("add transfer block");
  });

  it("renders no-intervention state cleanly", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      executionStatus: "no_intervention",
      recommendation: undefined,
      actionSummary: undefined,
      evidenceSummary: undefined,
      strategyBlueprint: undefined,
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("No Active Intervention");
    expect(html).toContain("No intervention is currently active or recommended");
    expect(html).toContain("stabilizing");
  });

  it("renders progress banner for approaching_success", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      progressContext: {
        progressSummary: "approaching_success",
        recentSuccessSignals: ["Retention check passed recently — gain is holding."],
        recentEscalationSignals: [],
        mostRecentEventLabel: "Retention check passed",
        mostRecentEventAt: "2026-03-14T10:00:00.000Z",
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Approaching success");
    expect(html).toContain("Retention check passed recently — gain is holding.");
  });

  it("renders progress banner for approaching_escalation", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      progressContext: {
        progressSummary: "approaching_escalation",
        recentSuccessSignals: [],
        recentEscalationSignals: ["Retention check is overdue — validation has not been completed."],
        mostRecentEventLabel: "Retention check became overdue",
        mostRecentEventAt: "2026-03-14T10:00:00.000Z",
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Escalation signals present");
    expect(html).toContain("Retention check is overdue");
  });

  it("does not render progress banner for stable context", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      progressContext: {
        progressSummary: "stable",
        recentSuccessSignals: [],
        recentEscalationSignals: [],
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).not.toContain("Approaching success");
    expect(html).not.toContain("Escalation signals present");
  });

  it("renders success signal in SuccessCriteriaPanel when approaching success", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      progressContext: {
        progressSummary: "approaching_success",
        recentSuccessSignals: ["Transfer validated in recent evaluation."],
        recentEscalationSignals: [],
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Recent progress signals");
    expect(html).toContain("Transfer validated in recent evaluation.");
  });

  it("renders escalation signal in EscalationPanel when approaching escalation", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      progressContext: {
        progressSummary: "approaching_escalation",
        recentSuccessSignals: [],
        recentEscalationSignals: ["Intervention was reopened after apparent recovery."],
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Active escalation signals");
    expect(html).toContain("Intervention was reopened after apparent recovery.");
  });

  it("renders timeline strip with recent events", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      recentFeed: {
        state: "partial_history",
        eventCount: 3,
        recentEvents: [
          {
            id: "decision:dec-1",
            timestamp: "2026-03-12T12:00:00.000Z",
            eventType: "intervention_transfer_block_added",
            sourceFamily: "intervention",
            label: "Intervention decision recorded: add transfer block",
            severity: "info",
            metadata: { action: "add_transfer_block" },
          },
          {
            id: "transfer:t-1",
            timestamp: "2026-03-12T11:00:00.000Z",
            eventType: "transfer_status_recorded",
            sourceFamily: "transfer",
            label: "Transfer status recorded: transfer gap",
            severity: "important",
            metadata: { status: "transfer_gap" },
          },
          {
            id: "diagnosis:d-1",
            timestamp: "2026-03-12T10:00:00.000Z",
            eventType: "diagnosis_recorded",
            sourceFamily: "diagnosis",
            label: "Diagnosis recorded: threshold error",
            severity: "notable",
            metadata: { diagnosticType: "threshold_error" },
          },
        ],
        hasEscalations: false,
        hasRecentSuccess: false,
        mostRecentAt: "2026-03-12T12:00:00.000Z",
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Recent Activity");
    expect(html).toContain("Concept Timeline");
    expect(html).toContain("3 total events recorded");
    expect(html).toContain("Intervention decision recorded: add transfer block");
    expect(html).toContain("Transfer status recorded: transfer gap");
    expect(html).toContain("Diagnosis recorded: threshold error");
  });

  it("shows escalation badge in timeline strip when escalations present", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      recentFeed: {
        state: "audit_history",
        eventCount: 2,
        recentEvents: [
          {
            id: "decision:esc-1",
            timestamp: "2026-03-14T09:00:00.000Z",
            eventType: "intervention_escalated",
            sourceFamily: "intervention",
            label: "Intervention decision changed: escalate intervention",
            severity: "important",
            metadata: {},
          },
        ],
        hasEscalations: true,
        hasRecentSuccess: false,
        mostRecentAt: "2026-03-14T09:00:00.000Z",
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("escalations present");
  });

  it("renders timeline empty state when no events", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      recentFeed: {
        state: "no_history",
        eventCount: 0,
        recentEvents: [],
        hasEscalations: false,
        hasRecentSuccess: false,
      },
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("Recent Activity");
    expect(html).toContain("No coaching events are recorded yet");
  });

  it("renders sparse blueprint gracefully when absent", () => {
    const data: InterventionExecutionBundle = {
      ...makeActiveBundle(),
      strategyBlueprint: undefined,
    };
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data }} />
    );

    expect(html).toContain("No strategy blueprint is available yet.");
    expect(html).toContain("No success criteria available.");
    expect(html).toContain("No escalation triggers available.");
  });

  it("renders loading state cleanly", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: true }} />
    );

    expect(html).toContain("Loading intervention");
  });

  it("renders error state cleanly", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen
        state={{ loading: false, error: "Failed to load intervention execution data" }}
      />
    );

    expect(html).toContain("Execution data unavailable");
    expect(html).toContain("Failed to load intervention execution data");
  });

  it("renders null data state cleanly", () => {
    const html = renderToStaticMarkup(
      <InterventionExecutionScreen state={{ loading: false, data: null }} />
    );

    expect(html).toContain("No execution data found");
  });
});
