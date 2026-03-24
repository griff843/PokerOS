import type { CanonicalDrill, ImportedHand, WeaknessPool } from "@poker-coach/core/browser";
import type {
  AttemptRow,
  CoachingDiagnosisRow,
  CoachingInterventionWithOutcomeRow,
  RetentionScheduleRow,
  SrsRow,
} from "../../../../packages/db/src/repository";
import {
  buildPersistedRealHandInterventionBridgeBundle,
  type RealHandBridgeBundle,
  type RealHandBridgeCandidate,
  type RealHandBridgeState,
} from "./real-hand-bridge";

export type RealHandReviewBlockState = Extract<RealHandBridgeState, "no_recent_evidence" | "weak_linkage"> | "ready";

export interface RealHandReviewBlock {
  generatedAt: string;
  state: RealHandReviewBlockState;
  title: string;
  reason: string;
  urgency: RealHandBridgeCandidate["urgency"] | "none";
  targetConcept: {
    conceptKey: string | null;
    conceptLabel: string | null;
  };
  linkedIntervention?: RealHandBridgeCandidate["relatedIntervention"];
  supportingHands: RealHandBridgeCandidate["supportingHands"];
  suggestedNextAction: {
    type: RealHandBridgeCandidate["suggestedNextAction"]["type"] | "import_real_hands";
    label: string;
    detail: string;
  };
  destination: string | null;
  bridgeState: RealHandBridgeState;
  transferPressureSummary?: RealHandBridgeCandidate["transferPressureSummary"];
}

export function buildPersistedRealHandReviewBlock(args: {
  drills: CanonicalDrill[];
  attempts: AttemptRow[];
  srs?: SrsRow[];
  importedHands: ImportedHand[];
  diagnoses?: CoachingDiagnosisRow[];
  interventions?: CoachingInterventionWithOutcomeRow[];
  retentionSchedules?: RetentionScheduleRow[];
  activePool: WeaknessPool;
  now?: Date;
  limit?: number;
}): RealHandReviewBlock {
  const bridgeBundle = buildPersistedRealHandInterventionBridgeBundle(args);
  return buildRealHandReviewBlock({ bridgeBundle });
}

export function buildRealHandReviewBlock(args: {
  bridgeBundle: RealHandBridgeBundle;
}): RealHandReviewBlock {
  const topCandidate = args.bridgeBundle.candidates[0];
  const bridgeState = args.bridgeBundle.state;

  if (!topCandidate || bridgeState === "no_recent_evidence") {
    return {
      generatedAt: args.bridgeBundle.generatedAt,
      state: "no_recent_evidence",
      title: "Review Real Hands",
      reason: "No recent imported-hand evidence is available yet, so there is no review block to schedule from real play.",
      urgency: "none",
      targetConcept: {
        conceptKey: null,
        conceptLabel: null,
      },
      supportingHands: [],
      suggestedNextAction: {
        type: "import_real_hands",
        label: "Import real hands",
        detail: "Bring in recent real-play hands so the system can connect table evidence to concept and intervention work.",
      },
      destination: "/app/hands",
      bridgeState,
    };
  }

  if (bridgeState === "weak_linkage") {
    return {
      generatedAt: args.bridgeBundle.generatedAt,
      state: "weak_linkage",
      title: topCandidate.conceptLabel
        ? `Review Hands: ${topCandidate.conceptLabel}`
        : "Review Real Hands",
      reason: topCandidate.bridgeReason,
      urgency: topCandidate.urgency,
      targetConcept: {
        conceptKey: topCandidate.conceptKey,
        conceptLabel: topCandidate.conceptLabel,
      },
      linkedIntervention: topCandidate.relatedIntervention,
      supportingHands: topCandidate.supportingHands,
      suggestedNextAction: topCandidate.suggestedNextAction,
      destination: "/app/hands",
      bridgeState,
      transferPressureSummary: topCandidate.transferPressureSummary,
    };
  }

  return {
    generatedAt: args.bridgeBundle.generatedAt,
    state: "ready",
    title: topCandidate.conceptLabel
      ? `Review Hands: ${topCandidate.conceptLabel}`
      : "Review Real Hands",
    reason: `${formatRealPlaySummary(topCandidate)} ${topCandidate.bridgeReason}`.trim(),
    urgency: topCandidate.urgency,
    targetConcept: {
      conceptKey: topCandidate.conceptKey,
      conceptLabel: topCandidate.conceptLabel,
    },
    linkedIntervention: topCandidate.relatedIntervention,
    supportingHands: topCandidate.supportingHands,
    suggestedNextAction: topCandidate.suggestedNextAction,
    destination: deriveDestination(topCandidate),
    bridgeState,
    transferPressureSummary: topCandidate.transferPressureSummary,
  };
}

function deriveDestination(candidate: RealHandBridgeCandidate): string {
  const key = candidate.conceptKey;
  switch (candidate.suggestedNextAction.type) {
    case "open_intervention_execution":
      return key ? `/app/concepts/${encodeURIComponent(key)}/execution` : "/app/hands";
    case "review_concept_detail":
      return key ? `/app/concepts/${encodeURIComponent(key)}` : "/app/hands";
    case "schedule_transfer_review_block":
      return key ? `/app/concepts/${encodeURIComponent(key)}/replay` : "/app/hands";
    case "review_recent_hand":
      return "/app/hands";
    default:
      return "/app/hands";
  }
}

function formatRealPlaySummary(candidate: RealHandBridgeCandidate): string {
  const { occurrences, reviewSpotCount } = candidate.realPlaySummary;
  const spotSuffix = reviewSpotCount > 0
    ? ` across ${reviewSpotCount} review spot${reviewSpotCount !== 1 ? "s" : ""}`
    : "";
  return `${occurrences} real-play occurrence${occurrences !== 1 ? "s" : ""}${spotSuffix} identified in recent hands.`;
}
