import { describe, expect, it } from "vitest";
import type {
  ConceptTransferEvaluation,
  ImportedHand,
  InterventionHistoryEntry,
  InterventionRecommendation,
  PlayerIntelligenceSnapshot,
  RealPlayConceptSignal,
  SessionPlanningReason,
} from "@poker-coach/core/browser";
import { buildRealHandInterventionBridgeBundle } from "./real-hand-bridge";

function makePlayerIntelligence(overrides: Partial<PlayerIntelligenceSnapshot> = {}): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-24T12:00:00.000Z",
    activePool: "baseline",
    graph: { nodes: [], edges: [] },
    concepts: [],
    priorities: [],
    strengths: [],
    recommendations: [],
    adaptiveProfile: {
      generatedAt: "2026-03-24T12:00:00.000Z",
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
      diagnosisCount: 0,
      activeInterventions: 0,
      completedInterventions: 0,
      interventionSuccessRate: null,
      recurringLeakConcepts: [],
      recoveredConcepts: [],
      regressedConcepts: [],
      stabilizingConcepts: [],
    },
    patterns: {
      generatedAt: "2026-03-24T12:00:00.000Z",
      patterns: [],
      topPatterns: [],
    },
    ...overrides,
  };
}

function makeConcept() {
  const planningReasons: SessionPlanningReason[] = ["active_intervention"];

  return {
    conceptKey: "river_defense",
    label: "River Defense",
    summary: "Defend honestly on the river.",
    scope: "overall" as const,
    recommendedPool: "baseline" as const,
    sampleSize: 6,
    recentAverage: 0.71,
    averageScore: 0.69,
    recurrenceCount: 2,
    failedCount: 2,
    reviewPressure: 1,
    trend: { direction: "improving" as const, delta: 0.08, detail: "Recent results are improving." },
    trainingUrgency: 0.72,
    status: "weakness" as const,
    weaknessRole: "primary" as const,
    recoveryStage: "active_repair" as const,
    planningReasons,
    interventionStatus: "in_progress" as const,
    directSignalKeys: ["concept:river_defense"],
    relatedConceptKeys: [],
    supportingConceptKeys: [],
    supportedConceptKeys: [],
    inferredFrom: [],
    evidence: ["Imported hands are still showing pressure."],
    relatedDrills: [],
  };
}

function makeHand(overrides: Partial<ImportedHand> = {}): ImportedHand {
  return {
    importedHandId: "hand-1",
    sourceHandId: "source-1",
    source: "paste",
    parseStatus: "parsed",
    parserVersion: "test",
    rawText: "hand",
    tableName: "Alpha",
    gameType: "NLHE",
    stakes: "$1/$2",
    playedAt: "2026-03-24T10:00:00.000Z",
    sessionLabel: "Morning",
    heroName: "Hero",
    heroCards: ["As", "Qh"],
    heroPosition: "BB",
    board: { flop: ["Ad", "7d", "2c"], turn: "Kd", river: "Jh" },
    players: [],
    actions: [],
    conceptMatches: [{
      conceptKey: "river_defense",
      label: "River Defense",
      confidence: "known",
      source: "hero_decision",
      reason: "Hero faced a river decision.",
    }],
    reviewSpots: [{
      spotId: "river-1",
      street: "river",
      actor: "Hero",
      kind: "hero_decision",
      summary: "River decision",
      reason: "Hero faced river pressure.",
      confidence: "known",
      concepts: ["river_defense"],
      actionIndex: 0,
      evidence: ["Villain bet river."],
    }],
    importNotes: [],
    ...overrides,
  };
}

function makeSignal(overrides: Partial<RealPlayConceptSignal> = {}): RealPlayConceptSignal {
  return {
    conceptKey: "river_defense",
    label: "River Defense",
    occurrences: 2,
    reviewSpotCount: 2,
    weight: 0.24,
    recommendedPool: "baseline",
    latestHandAt: "2026-03-24T10:00:00.000Z",
    evidence: ["Two hands mapped here.", "Two review spots mapped here."],
    ...overrides,
  };
}

function makeTransferEvaluation(overrides: Partial<ConceptTransferEvaluation> = {}): ConceptTransferEvaluation {
  return {
    conceptKey: "river_defense",
    label: "River Defense",
    status: "transfer_progressing",
    confidence: "medium",
    evidenceSufficiency: "moderate",
    pressure: "medium",
    studyPerformance: 0.71,
    realPlayPerformance: 0.54,
    studyVsRealPlayDelta: 0.17,
    supportingEvidence: ["Imported hands are still showing pressure."],
    riskFlags: [],
    summary: "River Defense is starting to transfer into real play.",
    coachExplanation: "River Defense is beginning to transfer, but the signal is not yet strong enough to close the question.",
    realPlayEvidence: {
      occurrences: 2,
      reviewSpotCount: 2,
      latestHandAt: "2026-03-24T10:00:00.000Z",
    },
    ...overrides,
  };
}

function makeRecommendation(overrides: Partial<InterventionRecommendation> = {}): InterventionRecommendation {
  return {
    conceptKey: "river_defense",
    label: "River Defense",
    action: "continue_intervention",
    recommendedStrategy: "threshold_repair",
    reasonCodes: ["active_intervention_improving"],
    confidence: "high",
    priority: 78,
    evidence: ["The active intervention is still live."],
    summary: "Continue the intervention on River Defense with threshold repair.",
    decisionReason: "River Defense already has active repair work, so the next study block should reinforce it.",
    supportingSignals: [{ kind: "recovery", code: "active_repair", detail: "Recovery stage is active repair." }],
    whyNotOtherActions: ["It is too early to close."],
    suggestedIntensity: "high",
    metadata: {
      currentInterventionId: "int-1",
      currentInterventionStatus: "in_progress",
      patternTypes: [],
      requiresNewAssignment: false,
      requiresStrategyChange: false,
      transferFocus: false,
    },
    ...overrides,
  };
}

describe("real hand bridge bundle", () => {
  it("returns an explicit no-history state", () => {
    const bundle = buildRealHandInterventionBridgeBundle({
      importedHands: [],
      playerIntelligence: makePlayerIntelligence(),
      realPlaySignals: [],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("no_recent_evidence");
    expect(bundle.candidates).toHaveLength(0);
    expect(bundle.summary.candidateCount).toBe(0);
  });

  it("keeps weak linkage explicit when hand evidence is still too light", () => {
    const bundle = buildRealHandInterventionBridgeBundle({
      importedHands: [makeHand({
        conceptMatches: [{
          conceptKey: "possible_turn_probe",
          label: "Possible Turn Probe",
          confidence: "inferred",
          source: "hero_decision",
          reason: "The hand may point at a turn probe node.",
        }],
        reviewSpots: [],
      })],
      playerIntelligence: makePlayerIntelligence(),
      realPlaySignals: [makeSignal({
        conceptKey: "possible_turn_probe",
        label: "Possible Turn Probe",
        occurrences: 1,
        reviewSpotCount: 0,
        weight: 0.08,
      })],
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("weak_linkage");
    expect(bundle.candidates[0]?.linkageStrength).toBe("weak");
    expect(bundle.candidates[0]?.recommendedReviewTarget.type).toBe("hand_review");
    expect(bundle.candidates[0]?.suggestedNextAction.type).toBe("review_recent_hand");
  });

  it("builds strong concept-linked bridge output", () => {
    const bundle = buildRealHandInterventionBridgeBundle({
      importedHands: [makeHand()],
      playerIntelligence: makePlayerIntelligence({ concepts: [makeConcept()] }),
      realPlaySignals: [makeSignal()],
      transferEvaluations: new Map([["river_defense", makeTransferEvaluation()]]),
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.state).toBe("linked_candidates");
    expect(bundle.candidates[0]?.linkageStrength).toBe("strong");
    expect(bundle.candidates[0]?.recommendedReviewTarget.type).toBe("concept_review");
    expect(bundle.candidates[0]?.conceptKey).toBe("river_defense");
  });

  it("exposes intervention-linked bridge output when a recommendation is present", () => {
    const interventionHistory: InterventionHistoryEntry[] = [{
      id: "int-1",
      conceptKey: "river_defense",
      source: "command_center",
      status: "in_progress",
      createdAt: "2026-03-24T09:30:00.000Z",
    }];
    const bundle = buildRealHandInterventionBridgeBundle({
      importedHands: [makeHand()],
      playerIntelligence: makePlayerIntelligence({ concepts: [makeConcept()] }),
      realPlaySignals: [makeSignal()],
      interventionHistory,
      recommendations: [makeRecommendation()],
      transferEvaluations: new Map([["river_defense", makeTransferEvaluation()]]),
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.candidates[0]?.recommendedReviewTarget.type).toBe("intervention_review");
    expect(bundle.candidates[0]?.suggestedNextAction.type).toBe("open_intervention_execution");
    expect(bundle.candidates[0]?.relatedIntervention?.interventionId).toBe("int-1");
    expect(bundle.candidates[0]?.relatedIntervention?.action).toBe("continue_intervention");
  });

  it("surfaces transfer-pressure-aware review blocks", () => {
    const bundle = buildRealHandInterventionBridgeBundle({
      importedHands: [makeHand()],
      playerIntelligence: makePlayerIntelligence({ concepts: [makeConcept()] }),
      realPlaySignals: [makeSignal()],
      transferEvaluations: new Map([["river_defense", makeTransferEvaluation({
        status: "transfer_gap",
        pressure: "high",
        summary: "River Defense is improving in study faster than in real play.",
        coachExplanation: "River Defense is improving in study, but imported hands are still producing enough review pressure that the next block should bias toward transfer work.",
        riskFlags: ["study_ahead_of_real_play", "real_play_review_pressure"],
      })]]),
      now: new Date("2026-03-24T12:00:00.000Z"),
    });

    expect(bundle.candidates[0]?.recommendedReviewTarget.type).toBe("transfer_review");
    expect(bundle.candidates[0]?.suggestedNextAction.type).toBe("schedule_transfer_review_block");
    expect(bundle.candidates[0]?.transferPressureSummary?.pressure).toBe("high");
    expect(bundle.candidates[0]?.urgency).toBe("high");
  });
});
