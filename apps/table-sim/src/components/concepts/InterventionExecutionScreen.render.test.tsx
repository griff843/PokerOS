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

    expect(html).toContain("Success Criteria");
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

  it("renders recommended (not yet active) intervention state", () => {
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

    expect(html).toContain("No active intervention");
    expect(html).toContain("No intervention is currently active or recommended");
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
