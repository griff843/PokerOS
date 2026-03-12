import {
  selectInterventionStrategyBlueprint,
  selectPatternsForConcept,
  type InterventionRecommendation,
  type InterventionStrategyBlueprint,
  type PlayerIntelligenceSnapshot,
} from "@poker-coach/core/browser";
import type { RetentionScheduleRow } from "../../../../packages/db/src/repository";
import { buildConceptRetentionSummary } from "./retention-scheduling";

export function buildInterventionStrategyBlueprint(args: {
  playerIntelligence: PlayerIntelligenceSnapshot;
  recommendation?: InterventionRecommendation;
  retentionSchedules?: RetentionScheduleRow[];
  now?: Date;
}): InterventionStrategyBlueprint | undefined {
  const recommendation = args.recommendation;
  if (!recommendation) {
    return undefined;
  }

  const concept = args.playerIntelligence.concepts.find((entry) => entry.conceptKey === recommendation.conceptKey);
  if (!concept) {
    return undefined;
  }

  const patterns = selectPatternsForConcept(args.playerIntelligence.patterns.patterns, concept.conceptKey);
  const retention = buildConceptRetentionSummary(concept.conceptKey, args.retentionSchedules ?? [], args.now);

  return selectInterventionStrategyBlueprint({
    conceptKey: concept.conceptKey,
    label: concept.label,
    recommendedAction: recommendation.action,
    recommendedStrategy: recommendation.recommendedStrategy,
    suggestedIntensity: recommendation.suggestedIntensity,
    recoveryStage: concept.recoveryStage,
    patternTypes: patterns.map((pattern) => pattern.type),
    recurrenceCount: concept.recurrenceCount,
    regressionCount: concept.recoveryStage === "regressed" ? 1 : 0,
    reviewPressure: concept.reviewPressure,
    transferPressure: recommendation.metadata.transferFocus || patterns.some((pattern) => pattern.type === "real_play_transfer_gap"),
    retentionState: retention.latestSchedule?.state,
  });
}
