import { describe, expect, it } from "vitest";
import type { CanonicalDrill } from "../schemas";
import type { PlayerIntelligenceSnapshot } from "../player-intelligence";
import { buildInterventionPlan, buildInterventionSessionPlan } from "../intervention-planner";

function makeDrill(options: {
  drillId: string;
  nodeId: string;
  title: string;
  tags: string[];
  concept: string;
}): CanonicalDrill {
  return {
    drill_id: options.drillId,
    node_id: options.nodeId,
    version: "1.0.0",
    title: options.title,
    prompt: "Choose the best line.",
    scenario: {
      game: "NLHE Cash",
      street: "river",
      pot_type: "SRP",
      players_to_flop: 2,
      hero_position: "BB",
      villain_position: "BTN",
      board: {
        flop: ["As", "Kd", "2c"],
        turn: "7h",
        river: "3d",
      },
      hero_hand: ["Ah", "Qc"],
      action_history: [],
    },
    decision_point: {
      street: "river",
      facing: { action: "bet", size_pct_pot: 75 },
      sizing_buttons_enabled: false,
    },
    options: [
      { key: "CALL", label: "Call" },
      { key: "FOLD", label: "Fold" },
    ],
    answer: {
      correct: "CALL",
      accepted: [],
      required_tags: ["paired_top_river"],
      explanation: "Call the bluff-catcher.",
    },
    tags: options.tags,
    difficulty: 2,
    diagnostic_prompts: [
      {
        id: `${options.drillId}-diag`,
        prompt: "What is the leak here?",
        type: "threshold",
        concept: options.concept,
        expected_reasoning: "Threshold discipline matters.",
        options: [
          { id: "a", label: "Option A", diagnosis: "threshold_error" },
          { id: "b", label: "Option B", matches_expected: true },
        ],
      },
    ],
  };
}

function makeSnapshot(): PlayerIntelligenceSnapshot {
  return {
    generatedAt: "2026-03-10T12:00:00.000Z",
    activePool: "B",
    graph: {
      nodes: [
        { id: "turn_defense", label: "Turn Defense", category: "upstream" },
        { id: "river_bluff_catching", label: "River Bluff Catching", category: "core" },
      ],
      edges: [
        { from: "turn_defense", to: "river_bluff_catching", type: "supports" },
      ],
    },
    concepts: [
      {
        conceptKey: "turn_defense",
        label: "Turn Defense",
        status: "weakness",
        scope: "overall",
        weaknessRole: "upstream",
        trainingUrgency: 0.88,
        summary: "Turn pressure is still unstable.",
        evidence: ["Repeated misses start on the turn."],
        inferredFrom: [],
        supportingConceptKeys: [],
        recommendedPool: "B",
      },
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        status: "weakness",
        scope: "overall",
        weaknessRole: "downstream",
        trainingUrgency: 0.76,
        summary: "River defense is leaking.",
        evidence: ["River bluff-catch spots keep slipping."],
        inferredFrom: ["Turn defense may be feeding this leak."],
        supportingConceptKeys: ["turn_defense"],
        recommendedPool: "B",
      },
    ],
    priorities: [],
    strengths: [],
    recommendations: [
      {
        label: "Repair Turn Defense",
        rationale: "Turn defense still feeds the next street.",
        emphasis: "review",
        conceptKey: "turn_defense",
        recommendedPool: "B",
      },
    ],
    patterns: {
      generatedAt: "2026-03-10T12:00:00.000Z",
      patterns: [],
      topPatterns: [],
    },
  } as unknown as PlayerIntelligenceSnapshot;
}

describe("intervention planner", () => {
  it("turns diagnostic errors into an upstream-first training prescription", () => {
    const plan = buildInterventionPlan({
      playerIntelligence: makeSnapshot(),
      recentAttempts: [
        {
          drillId: "d1",
          nodeId: "hu_river_01",
          title: "River Bluff Catch",
          score: 0.24,
          correct: false,
          ts: "2026-03-10T10:00:00.000Z",
          activePool: "B",
          diagnosticErrorType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          confidenceMiscalibration: true,
        },
        {
          drillId: "d2",
          nodeId: "hu_river_02",
          title: "River Bluff Catch 2",
          score: 0.28,
          correct: false,
          ts: "2026-03-09T10:00:00.000Z",
          activePool: "B",
          diagnosticErrorType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          confidenceMiscalibration: true,
        },
      ],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(plan.rootConceptKey).toBe("river_bluff_catching");
    expect(plan.upstreamConceptKey).toBe("turn_defense");
    expect(plan.trainingBlocks[0]?.conceptKey).toBe("turn_defense");
    expect(plan.trainingBlocks.at(-1)?.role).toBe("calibration");
  });

  it("builds a truthful session artifact from the prescribed blocks", () => {
    const interventionPlan = buildInterventionPlan({
      playerIntelligence: makeSnapshot(),
      recentAttempts: [
        {
          drillId: "d1",
          nodeId: "hu_river_01",
          title: "River Bluff Catch",
          score: 0.24,
          correct: false,
          ts: "2026-03-10T10:00:00.000Z",
          activePool: "B",
          diagnosticErrorType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          confidenceMiscalibration: true,
        },
      ],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    const session = buildInterventionSessionPlan({
      interventionPlan,
      drills: [
        makeDrill({ drillId: "d1", nodeId: "hu_turn_01", title: "Turn Defense Lab", tags: ["concept:turn_probe", "concept:turn_defense"], concept: "turn defense" }),
        makeDrill({ drillId: "d2", nodeId: "hu_river_01", title: "River Bluff Catch", tags: ["concept:blocker_effect", "concept:river_bluff_catching"], concept: "river bluff catching" }),
        makeDrill({ drillId: "d3", nodeId: "hu_river_02", title: "River Bluff Catch 2", tags: ["concept:blocker_effect", "concept:river_bluff_catching"], concept: "river bluff catching" }),
      ],
      recentAttempts: [],
      srs: [],
      activePool: "B",
      generatedAt: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(session.metadata.intervention?.id).toBe(interventionPlan.id);
    expect(session.metadata.intervention?.trainingBlocks[0]?.plannedReps).toBeGreaterThanOrEqual(0);
    expect(session.drills.every((drill) => drill.metadata.interventionConceptKey)).toBe(true);
  });

  it("weights real-play transfer patterns into the intervention title and rationale", () => {
    const snapshot = makeSnapshot();
    snapshot.patterns = {
      generatedAt: "2026-03-10T12:00:00.000Z",
      patterns: [
        {
          id: "pattern:river_bluff_catching:real_play_transfer_gap",
          type: "real_play_transfer_gap",
          confidence: "high",
          severity: 0.82,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["River Bluff Catching is recovering in drills, but imported hands still map here."],
          coachingImplication: "Bridge drills into imported-hand review before treating the concept as transferred.",
          suggestedBiases: ["real_play_transfer", "stabilization_check"],
        },
      ],
      topPatterns: [
        {
          id: "pattern:river_bluff_catching:real_play_transfer_gap",
          type: "real_play_transfer_gap",
          confidence: "high",
          severity: 0.82,
          implicatedConcepts: ["river_bluff_catching"],
          evidence: ["River Bluff Catching is recovering in drills, but imported hands still map here."],
          coachingImplication: "Bridge drills into imported-hand review before treating the concept as transferred.",
          suggestedBiases: ["real_play_transfer", "stabilization_check"],
        },
      ],
    };

    const plan = buildInterventionPlan({
      playerIntelligence: snapshot,
      recentAttempts: [
        {
          drillId: "d1",
          nodeId: "hu_river_01",
          title: "River Bluff Catch",
          score: 0.61,
          correct: true,
          ts: "2026-03-10T10:00:00.000Z",
          activePool: "B",
          diagnosticErrorType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          confidenceMiscalibration: false,
        },
      ],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(plan.recommendedSessionTitle).toContain("Transfer Block");
    expect(plan.rationale).toContain("real-play transfer review");
    expect(plan.nextSessionFocus).toContain("imported hands");
  });

  it("prioritizes due retention checks for recovered concepts", () => {
    const snapshot = makeSnapshot();
    snapshot.concepts = [
      {
        conceptKey: "turn_defense",
        label: "Turn Defense",
        summary: "Turn defense recovered and now needs validation.",
        scope: "overall",
        recommendedPool: "B",
        sampleSize: 6,
        recentAverage: 0.78,
        averageScore: 0.74,
        recoveryStage: "recovered",
        reviewPressure: 0,
        failedCount: 0,
        status: "strength",
        weaknessRole: "none",
        planningReasons: ["weakness_balance"],
        trainingUrgency: 0.22,
        recurrenceCount: 1,
        evidence: ["Recovered once and now due for validation."],
        inferredFrom: [],
        supportingConceptKeys: [],
        supportedConceptKeys: ["river_bluff_catching"],
        relatedConceptKeys: [],
        directSignalKeys: [],
        relatedDrills: [],
      },
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        summary: "River defense still needs work.",
        scope: "overall",
        recommendedPool: "B",
        sampleSize: 4,
        recentAverage: 0.46,
        averageScore: 0.43,
        recoveryStage: "unaddressed",
        reviewPressure: 0,
        failedCount: 2,
        status: "weakness",
        weaknessRole: "primary",
        planningReasons: ["weakness_balance"],
        trainingUrgency: 0.35,
        recurrenceCount: 0,
        evidence: ["The leak is still active."],
        inferredFrom: [],
        supportingConceptKeys: [],
        supportedConceptKeys: [],
        relatedConceptKeys: [],
        directSignalKeys: [],
        relatedDrills: [],
      },
    ] as never;

    const plan = buildInterventionPlan({
      playerIntelligence: snapshot,
      recentAttempts: [],
      activePool: "B",
      retentionSchedules: [
        {
          conceptKey: "turn_defense",
          createdAt: "2026-03-12T12:00:00.000Z",
          scheduledFor: "2026-03-13T12:00:00.000Z",
          status: "scheduled",
          reason: "recovered_validation",
          recoveryStageAtScheduling: "recovered",
          priority: 68,
        },
      ],
      now: new Date("2026-03-13T13:00:00.000Z"),
    });

    expect(plan.rootConceptKey).toBe("turn_defense");
    expect(plan.planningReasons).toContain("retention_check");
    expect(plan.trainingBlocks[0]?.role).toBe("retest");
  });

});


