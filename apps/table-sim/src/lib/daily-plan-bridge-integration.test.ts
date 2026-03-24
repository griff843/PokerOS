import { describe, expect, it } from "vitest";
import { buildDailyPlanBridgeIntegration, findDailyPlanBridgeContext } from "./daily-plan-bridge-integration";
import type { RealHandBridgeBundle } from "./real-hand-bridge";

function makeBridgeBundle(
  overrides: Partial<RealHandBridgeBundle> = {},
): RealHandBridgeBundle {
  return {
    generatedAt: "2026-03-24T12:00:00.000Z",
    state: "linked_candidates",
    summary: {
      headline: "Linked bridge candidates are available.",
      detail: "1 candidate is ready.",
      candidateCount: 1,
      linkedCandidateCount: 1,
      weakCandidateCount: 0,
    },
    candidates: [{
      conceptKey: "concept_0",
      conceptLabel: "Concept 0",
      linkageStrength: "strong",
      bridgeReason: "River defense pattern matches drill weakness.",
      urgency: "high",
      realPlaySummary: {
        occurrences: 3,
        reviewSpotCount: 2,
        latestHandAt: "2026-03-24T10:00:00.000Z",
      },
      supportingHands: [],
      recommendedReviewTarget: {
        type: "intervention_review",
        label: "Intervention-linked review for Concept 0",
        conceptKey: "concept_0",
        interventionId: "int-1",
      },
      suggestedNextAction: {
        type: "open_intervention_execution",
        label: "Open intervention execution for Concept 0",
        detail: "Use real hands to reinforce the live intervention.",
      },
      relatedIntervention: {
        interventionId: "int-1",
        action: "continue_intervention",
        recommendedStrategy: "threshold_repair",
        status: "in_progress",
        summary: "Continue the intervention on Concept 0.",
      },
      transferPressureSummary: {
        status: "transfer_gap",
        pressure: "high",
        confidence: "medium",
        evidenceSufficiency: "moderate",
        summary: "Transfer is lagging behind study.",
        riskFlags: ["real_play_review_pressure"],
        occurrences: 3,
        reviewSpotCount: 2,
        latestHandAt: "2026-03-24T10:00:00.000Z",
      },
    }],
    ...overrides,
  };
}

describe("daily plan bridge integration", () => {
  it("returns an explicit no_bridge state when no bundle is provided", () => {
    const integration = buildDailyPlanBridgeIntegration(null);

    expect(integration.state).toBe("no_bridge");
    expect(integration.candidateContexts).toEqual([]);
    expect(integration.topCandidate).toBeUndefined();
  });

  it("keeps sparse bridge states explicit without fabricating contexts", () => {
    const integration = buildDailyPlanBridgeIntegration(makeBridgeBundle({
      state: "weak_linkage",
      candidates: [],
    }));

    expect(integration.state).toBe("weak_linkage");
    expect(integration.candidateContexts).toEqual([]);
    expect(integration.whyThisPlanEvidence).toBeUndefined();
  });

  it("builds daily-plan-specific review and execution context from the top linked candidate", () => {
    const integration = buildDailyPlanBridgeIntegration(makeBridgeBundle());

    expect(integration.state).toBe("linked_candidates");
    expect(integration.topCandidate?.reviewBlock.title).toBe("Review Hands: Concept 0");
    expect(integration.topCandidate?.reviewBlock.destination).toBe("/app/concepts/concept_0/execution");
    expect(integration.topCandidate?.reviewBlock.priority).toBe(7);
    expect(integration.topCandidate?.executeInterventionReason).toContain("3 real-play occurrences");
    expect(integration.whyThisPlanEvidence).toContain("Real hands confirm");
  });

  it("finds concept-specific context for planner reuse", () => {
    const integration = buildDailyPlanBridgeIntegration(makeBridgeBundle({
      candidates: [
        makeBridgeBundle().candidates[0],
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
            detail: "Inspect concept detail next.",
          },
        },
      ],
    }));

    const context = findDailyPlanBridgeContext(integration, "concept_3");
    expect(context?.replayInspectionReason).toContain("Concept 3 appears in 4 river spots.");
    expect(context?.reviewBlock.destination).toBe("/app/concepts/concept_3");
  });
});
