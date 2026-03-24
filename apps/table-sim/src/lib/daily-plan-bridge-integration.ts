import type { RealHandBridgeBundle, RealHandBridgeCandidate } from "./real-hand-bridge";

export type DailyPlanBridgeIntegrationState =
  | "no_bridge"
  | "no_recent_evidence"
  | "weak_linkage"
  | "linked_candidates";

export interface DailyPlanBridgeCandidateContext {
  conceptKey: string | null;
  conceptLabel: string;
  urgency: RealHandBridgeCandidate["urgency"];
  realPlaySummaryText: string;
  reviewBlock: {
    title: string;
    reason: string;
    destination: string;
    priority: number;
    conceptKey: string | null;
    conceptLabel: string;
  };
  executeInterventionReason: string;
  replayInspectionReason: string;
}

export interface DailyPlanBridgeIntegration {
  state: DailyPlanBridgeIntegrationState;
  candidateContexts: DailyPlanBridgeCandidateContext[];
  topCandidate?: DailyPlanBridgeCandidateContext;
  whyThisPlanEvidence?: string;
}

export function buildDailyPlanBridgeIntegration(
  bridgeBundle?: RealHandBridgeBundle | null,
): DailyPlanBridgeIntegration {
  if (!bridgeBundle) {
    return {
      state: "no_bridge",
      candidateContexts: [],
    };
  }

  if (bridgeBundle.state !== "linked_candidates" || bridgeBundle.candidates.length === 0) {
    return {
      state: bridgeBundle.state,
      candidateContexts: [],
    };
  }

  const candidateContexts = bridgeBundle.candidates.map((candidate) => buildCandidateContext(candidate));
  const topCandidate = candidateContexts[0];

  return {
    state: "linked_candidates",
    candidateContexts,
    topCandidate,
    whyThisPlanEvidence: topCandidate
      ? `Real hands confirm: ${topCandidate.realPlaySummaryText.toLowerCase()}`
      : undefined,
  };
}

export function findDailyPlanBridgeContext(
  integration: DailyPlanBridgeIntegration,
  conceptKey: string | null | undefined,
): DailyPlanBridgeCandidateContext | undefined {
  if (!conceptKey) {
    return undefined;
  }
  return integration.candidateContexts.find((candidate) => candidate.conceptKey === conceptKey);
}

function buildCandidateContext(candidate: RealHandBridgeCandidate): DailyPlanBridgeCandidateContext {
  const realPlaySummaryText = formatRealPlaySummary(candidate);

  return {
    conceptKey: candidate.conceptKey,
    conceptLabel: candidate.conceptLabel,
    urgency: candidate.urgency,
    realPlaySummaryText,
    reviewBlock: {
      title: candidate.conceptLabel ? `Review Hands: ${candidate.conceptLabel}` : "Review Real Hands",
      reason: `${realPlaySummaryText} ${candidate.bridgeReason}`.trim(),
      destination: deriveBridgeCandidateDestination(candidate) ?? "/app/hands",
      priority: candidate.urgency === "high" ? 7 : 6,
      conceptKey: candidate.conceptKey,
      conceptLabel: candidate.conceptLabel,
    },
    executeInterventionReason: `${realPlaySummaryText} Running intervention reps converts this table pattern into lasting improvement.`,
    replayInspectionReason: `${candidate.bridgeReason} The replay inspector can reveal why this table pattern persists.`,
  };
}

function deriveBridgeCandidateDestination(candidate: RealHandBridgeCandidate): string | null {
  const key = candidate.conceptKey;
  switch (candidate.suggestedNextAction.type) {
    case "open_intervention_execution":
      return key ? `/app/concepts/${encodeURIComponent(key)}/execution` : null;
    case "review_concept_detail":
      return key ? `/app/concepts/${encodeURIComponent(key)}` : null;
    case "schedule_transfer_review_block":
      return key ? `/app/concepts/${encodeURIComponent(key)}/replay` : "/app/hands";
    case "review_recent_hand":
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
