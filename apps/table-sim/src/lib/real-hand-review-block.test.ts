import { describe, expect, it } from "vitest";
import { buildRealHandReviewBlock } from "./real-hand-review-block";
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
      supportingHands: [{
        importedHandId: "hand-1",
        title: "Alpha",
        playedAt: "2026-03-24T10:00:00.000Z",
        reviewSpotCount: 2,
      }],
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

describe("real hand review block", () => {
  it("returns an explicit no_recent_evidence state", () => {
    const block = buildRealHandReviewBlock({
      bridgeBundle: makeBridgeBundle({
        state: "no_recent_evidence",
        summary: {
          headline: "No evidence.",
          detail: "No evidence.",
          candidateCount: 0,
          linkedCandidateCount: 0,
          weakCandidateCount: 0,
        },
        candidates: [],
      }),
    });

    expect(block.state).toBe("no_recent_evidence");
    expect(block.targetConcept.conceptKey).toBeNull();
    expect(block.suggestedNextAction.type).toBe("import_real_hands");
    expect(block.destination).toBe("/app/hands");
  });

  it("keeps weak linkage explicit and routes to hands review", () => {
    const block = buildRealHandReviewBlock({
      bridgeBundle: makeBridgeBundle({
        state: "weak_linkage",
        candidates: [{
          ...makeBridgeBundle().candidates[0],
          linkageStrength: "weak",
          suggestedNextAction: {
            type: "review_recent_hand",
            label: "Review Alpha before assigning study work",
            detail: "Keep the next step anchored in the hand.",
          },
        }],
      }),
    });

    expect(block.state).toBe("weak_linkage");
    expect(block.destination).toBe("/app/hands");
    expect(block.suggestedNextAction.type).toBe("review_recent_hand");
    expect(block.reason).toContain("River defense pattern matches drill weakness.");
  });

  it("builds a ready block with linked intervention and execution destination", () => {
    const block = buildRealHandReviewBlock({
      bridgeBundle: makeBridgeBundle(),
    });

    expect(block.state).toBe("ready");
    expect(block.title).toBe("Review Hands: Concept 0");
    expect(block.reason).toContain("3 real-play occurrences");
    expect(block.linkedIntervention?.interventionId).toBe("int-1");
    expect(block.destination).toBe("/app/concepts/concept_0/execution");
  });

  it("routes transfer-review next actions to replay surfaces", () => {
    const block = buildRealHandReviewBlock({
      bridgeBundle: makeBridgeBundle({
        candidates: [{
          ...makeBridgeBundle().candidates[0],
          suggestedNextAction: {
            type: "schedule_transfer_review_block",
            label: "Add a transfer review block for Concept 0",
            detail: "Bias toward transfer work.",
          },
        }],
      }),
    });

    expect(block.state).toBe("ready");
    expect(block.destination).toBe("/app/concepts/concept_0/replay");
    expect(block.transferPressureSummary?.pressure).toBe("high");
  });
});
