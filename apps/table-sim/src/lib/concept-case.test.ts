import { describe, expect, it } from "vitest";
import type { InterventionHistoryEntry, InterventionRecommendation, PlayerIntelligenceSnapshot } from "@poker-coach/core/browser";
import type { InterventionDecisionSnapshotRow, RetentionScheduleRow } from "../../../../packages/db/src/repository";
import { buildConceptCaseMap } from "./concept-case";

function makePlayerIntelligence(): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-12T12:00:00.000Z",
    activePool: "baseline",
    graph: { nodes: [], edges: [] },
    concepts: [
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        summary: "Catch river bluffs honestly.",
        scope: "overall",
        recommendedPool: "baseline",
        sampleSize: 6,
        recentAverage: 0.44,
        averageScore: 0.48,
        recurrenceCount: 3,
        failedCount: 4,
        reviewPressure: 1,
        trend: { direction: "worsening", delta: -0.1, detail: "Recent results are slipping." },
        trainingUrgency: 0.83,
        status: "weakness",
        weaknessRole: "primary",
        recoveryStage: "active_repair",
        planningReasons: ["active_intervention", "recurring_leak"],
        interventionStatus: "in_progress",
        directSignalKeys: ["concept:river_bluff_catching"],
        relatedConceptKeys: [],
        supportingConceptKeys: [],
        supportedConceptKeys: [],
        inferredFrom: [],
        evidence: ["Scores are soft and the leak is recurring."],
        relatedDrills: [],
      },
    ],
    priorities: [],
    strengths: [],
    recommendations: [],
    adaptiveProfile: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      summary: "Adaptive profile summary.",
      tendencies: [],
      coachingEmphasis: {
        explanationBullets: [],
        interventionBullets: [],
        confidenceHandling: "Keep confidence grounded.",
        recommendationFraming: "Keep recommendations explicit.",
      },
      interventionAdjustments: {
        preferShorterReviewBlocks: false,
        prioritizeThresholdRetests: false,
        prioritizeLineReconstruction: false,
        prioritizeBlockerNotes: false,
        prioritizeConfidenceCalibration: false,
        prioritizeRealPlayReview: false,
      },
      surfaceSignals: {
        commandCenter: "Command signal.",
        studySession: "Study signal.",
        growthProfile: "Growth signal.",
        weaknessExplorer: "Weakness signal.",
        sessionReview: "Session signal.",
        review: "Review signal.",
      },
    },
    memory: {
      diagnosisCount: 2,
      activeInterventions: 1,
      completedInterventions: 0,
      interventionSuccessRate: null,
      recurringLeakConcepts: ["river_bluff_catching"],
      recoveredConcepts: [],
      regressedConcepts: [],
      stabilizingConcepts: [],
    },
    patterns: {
      generatedAt: "2026-03-12T12:00:00.000Z",
      patterns: [
        {
          id: "pattern:1",
          type: "persistent_threshold_leak",
          confidence: "high",
          severity: 0.82,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["Threshold misses are recurring."],
          coachingImplication: "Retest thresholds.",
          suggestedBiases: ["threshold_retest"],
        },
      ],
      topPatterns: [],
    },
  };
}

describe("concept case map", () => {
  it("assembles a canonical concept case bundle from app-layer inputs", () => {
    const recommendations: InterventionRecommendation[] = [{
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      action: "continue_intervention",
      recommendedStrategy: "threshold_repair",
      reasonCodes: ["active_intervention_improving"],
      confidence: "high",
      priority: 76,
      evidence: ["The active intervention is still live."],
      summary: "Continue the intervention on River Bluff Catching with threshold repair.",
      decisionReason: "Keep repair alive.",
      supportingSignals: [{ kind: "recovery", code: "active_repair", detail: "Recovery stage is active repair." }],
      whyNotOtherActions: ["It is too early to close."],
      suggestedIntensity: "high",
      metadata: {
        currentInterventionId: "i1",
        currentInterventionStatus: "in_progress",
        patternTypes: ["persistent_threshold_leak"],
        requiresNewAssignment: false,
        requiresStrategyChange: false,
        transferFocus: false,
      },
    }];
    const decisions: InterventionDecisionSnapshotRow[] = [{
      id: "d1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-12T12:00:00.000Z",
      recommended_action: "continue_intervention",
      recommended_strategy: "threshold_repair",
      confidence: "high",
      priority: 76,
      suggested_intensity: "high",
      recovery_stage: "active_repair",
      current_intervention_status: "in_progress",
      reason_codes_json: JSON.stringify(["active_intervention_improving"]),
      supporting_signals_json: JSON.stringify([]),
      evidence_json: JSON.stringify([]),
      pattern_types_json: JSON.stringify(["persistent_threshold_leak"]),
      recurring_leak_bool: 1,
      transfer_gap_bool: 0,
      acted_upon_bool: 1,
      linked_intervention_id: "i1",
      source_context: "command_center",
      supersedes_decision_id: null,
    }];
    const retentionSchedules: RetentionScheduleRow[] = [{
      id: "r1",
      user_id: "local_user",
      concept_key: "river_bluff_catching",
      created_at: "2026-03-12T12:00:00.000Z",
      scheduled_for: "2026-03-15T12:00:00.000Z",
      status: "scheduled",
      reason: "stabilizing_followup",
      linked_intervention_id: "i1",
      linked_decision_snapshot_id: "d1",
      recovery_stage_at_scheduling: "stabilizing",
      priority: 72,
      completed_at: null,
      result: null,
      supersedes_schedule_id: null,
      superseded_by_schedule_id: null,
      evidence_json: JSON.stringify(["Scheduled follow-up retention check."]),
    }];
    const interventionHistory: InterventionHistoryEntry[] = [{
      id: "i1",
      conceptKey: "river_bluff_catching",
      source: "command_center",
      status: "in_progress",
      createdAt: "2026-03-12T10:00:00.000Z",
    }];

    const bundle = buildConceptCaseMap({
      playerIntelligence: makePlayerIntelligence(),
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-12T09:00:00.000Z" },
      ],
      interventionHistory,
      decisionSnapshots: decisions,
      retentionSchedules,
      recommendations,
      now: new Date("2026-03-12T12:00:00.000Z"),
    }).get("river_bluff_catching");

    expect(bundle?.history.conceptKey).toBe("river_bluff_catching");
    expect(bundle?.explanation.statusLabel).toBe("Active Repair");
    expect(bundle?.nextStep.nextAction).toBe("continue_intervention");
    expect(bundle?.decisionAudit?.latestDecision?.actedUpon).toBe(true);
    expect(bundle?.retention.validationState).toBe("provisional");
    expect(bundle?.strategyBlueprint?.strategyType).toBe("threshold_repair");
    expect(bundle?.strategyBlueprint?.title.length).toBeGreaterThan(0);
  });
});
