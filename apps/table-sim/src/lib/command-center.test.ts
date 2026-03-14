import { describe, expect, it } from "vitest";
import type { AttemptInsight, InterventionHistoryEntry, InterventionPlan, PatternAttemptSignal } from "@poker-coach/core/browser";
import type { TableSimSessionPlan } from "./session-plan";
import {
  buildCadenceSignal,
  buildCommandCenterSnapshot,
  buildReadinessSignal,
  type CommandCenterRecentAttempt,
} from "./command-center";

function makePlan(): TableSimSessionPlan {
  return {
    drills: [
      {
        drill: {
          drill_id: "d1",
          node_id: "hu_01",
          version: "1.0.0",
          title: "River Bluff Catch",
          prompt: "Call or fold?",
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
          tags: ["street:river", "concept:blocker_effect", "decision:bluff_catch"],
          difficulty: 2,
        },
        kind: "review",
        reason: "weakness_review",
        matchedWeaknessTargets: ["overall:classification_tag:concept:blocker_effect"],
        metadata: { priorAttempts: 3, lastScore: 0.35, weaknessPriority: 0.8 },
      },
    ],
    metadata: {
      requestedCount: 10,
      selectedCount: 10,
      reviewCount: 6,
      newCount: 4,
      dueReviewCount: 2,
      weaknessReviewCount: 2,
      weaknessNewCount: 1,
      newMaterialFillCount: 5,
      activePool: "B",
      generatedAt: "2026-03-10T10:00:00.000Z",
      weaknessTargets: [
        {
          type: "classification_tag",
          key: "concept:blocker_effect",
          scope: "overall",
          sampleSize: 5,
          accuracy: 0.4,
          priority: 0.6,
        },
      ],
      notes: ["Added new drills that match B pool-aware weakness targets before overall fallback."],
    },
  };
}

function makeInterventionPlan(): InterventionPlan {
  return {
    id: "plan-B-turn_defense-river_bluff_catching",
    generatedAt: "2026-03-10T12:00:00.000Z",
    activePool: "B",
    rootConceptKey: "river_bluff_catching",
    rootConceptLabel: "River Bluff Catching",
    upstreamConceptKey: "turn_defense",
    upstreamConceptLabel: "Turn Defense",
    rootLeakDiagnosis: "Repeated threshold errors are showing up inside river bluff catching.",
    rationale: "Repair turn defense first, then retest river bluff catching.",
    recommendedSessionTitle: "Turn Defense Lab -> River Bluff Catching Retest",
    nextSessionFocus: "Turn Defense first, then River Bluff Catching retest.",
    targetConcepts: ["turn_defense", "river_bluff_catching"],
    planningReasons: ["active_intervention", "recurring_leak"],
    recoveryStage: "active_repair",
    trainingBlocks: [
      {
        conceptKey: "turn_defense",
        label: "Turn Defense",
        reps: 12,
        role: "repair",
        reason: "Repair the upstream concept feeding the current river bluff catching misses.",
        planningReasons: ["active_intervention", "weakness_balance"],
      },
      {
        conceptKey: "river_bluff_catching",
        label: "River Bluff Catching",
        reps: 8,
        role: "retest",
        reason: "Retest the live leak after upstream repair.",
        planningReasons: ["active_intervention", "recurring_leak"],
      },
    ],
    totalTargetReps: 20,
  };
}

function makeRecentAttempts(): CommandCenterRecentAttempt[] {
  return [
    { drillId: "d1", nodeId: "hu_01", title: "River Bluff Catch", score: 0.82, correct: true, ts: "2026-03-10T10:00:00.000Z", activePool: "B" },
    { drillId: "d2", nodeId: "hu_02", title: "Turn Overbet", score: 0.76, correct: true, ts: "2026-03-09T10:00:00.000Z", activePool: "B" },
    { drillId: "d3", nodeId: "hu_03", title: "River Raise", score: 0.71, correct: true, ts: "2026-03-08T10:00:00.000Z", activePool: "baseline" },
  ];
}

function makeAttemptInsights(): AttemptInsight[] {
  return [
    { drillId: "d1", nodeId: "hu_01", score: 0.8, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    { drillId: "d2", nodeId: "hu_01", score: 0.75, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    { drillId: "d3", nodeId: "hu_02", score: 0.35, correct: false, missedTags: ["polar_turn_big_bet"], classificationTags: ["concept:polarization"], activePool: "B" },
    { drillId: "d4", nodeId: "hu_02", score: 0.4, correct: false, missedTags: ["polar_turn_big_bet"], classificationTags: ["concept:polarization"], activePool: "B" },
    { drillId: "d5", nodeId: "hu_01", score: 0.45, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    { drillId: "d6", nodeId: "hu_01", score: 0.5, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
    { drillId: "d7", nodeId: "hu_02", score: 0.72, correct: true, missedTags: [], classificationTags: ["concept:polarization"], activePool: "B" },
    { drillId: "d8", nodeId: "hu_02", score: 0.78, correct: true, missedTags: [], classificationTags: ["concept:polarization"], activePool: "B" },
  ];
}


function makePatternAttempts(): PatternAttemptSignal[] {
  return [
    {
      drillId: "d1",
      nodeId: "hu_01",
      ts: "2026-03-10T10:00:00.000Z",
      sessionId: "s1",
      conceptKeys: ["river_bluff_catching"],
      missedTags: ["paired_top_river"],
      score: 0.35,
      correct: false,
      diagnosticType: "threshold_error",
      diagnosticConceptKey: "river_bluff_catching",
      activePool: "B",
    },
    {
      drillId: "d2",
      nodeId: "hu_02",
      ts: "2026-03-09T10:00:00.000Z",
      sessionId: "s2",
      conceptKeys: ["river_bluff_catching"],
      missedTags: ["paired_top_river"],
      score: 0.38,
      correct: false,
      diagnosticType: "threshold_error",
      diagnosticConceptKey: "river_bluff_catching",
      activePool: "B",
    },
  ];
}

function makeInterventionHistory(): InterventionHistoryEntry[] {
  return [
    { id: "i1", conceptKey: "river_bluff_catching", source: "command_center", status: "assigned", createdAt: "2026-03-10T12:00:00.000Z" },
    { id: "i2", conceptKey: "turn_defense", source: "session_review", status: "completed", improved: true, preScore: 0.33, postScore: 0.71, createdAt: "2026-03-09T12:00:00.000Z" },
  ];
}

describe("command center snapshot", () => {
  it("builds a premium daily focus and selective sections from real plan data", () => {
    const snapshot = buildCommandCenterSnapshot({
      plan: makePlan(),
      attemptInsights: makeAttemptInsights(),
      recentAttempts: makeRecentAttempts(),
      activePool: "B",
      count: 10,
      interventionPlan: makeInterventionPlan(),
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T11:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.85, createdAt: "2026-03-09T11:00:00.000Z" },
      ],
      interventionHistory: makeInterventionHistory(),
      patternAttempts: makePatternAttempts(),
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(snapshot.dailyFocus.title).toBe("Turn Defense Lab -> River Bluff Catching Retest");
    expect(snapshot.dailyFocus.reasons[0]).toContain("due reviews");
    expect(snapshot.priorityLeaks[0]?.label).toBe("Due review pressure");
    expect(snapshot.momentum.readiness?.label).toBe("Ready to press");
    expect(snapshot.coachBriefing.recommendation).toContain("Turn Defense");
    expect(snapshot.coachBriefing.reminder.length).toBeGreaterThan(0);
    expect(snapshot.recommendedTrainingBlock.plan.id).toBe("plan-B-turn_defense-river_bluff_catching");
    expect(snapshot.coachingPatterns[0]?.title).toBe("Recurring threshold leak");
    expect(snapshot.nextInterventionDecision?.action).toBe("assign_intervention");
    expect(snapshot.nextInterventionDecision?.recommendedStrategy).toBe("street_transition_repair");
    expect(snapshot.nextInterventionBlueprint?.strategyType).toBe("street_transition_repair");
    expect(snapshot.leadConceptCase?.statusLabel).toBeTruthy();
    expect(snapshot.leadConceptCase?.transferStatus).toBeTruthy();
    expect(snapshot.leadConceptCase?.transferAudit?.stability).toBeTruthy();
    expect(snapshot.leadConceptCase?.replay?.transferInterpretation).toBeTruthy();
    expect(snapshot.leadConceptCase?.nextAction.length).toBeGreaterThan(0);
    expect(snapshot.interventions.active[0]?.status).toContain("Assigned");
    expect(snapshot.interventions.completed[0]?.status).toBe("Recovered");
    expect(snapshot.recentWork).toHaveLength(3);
  });

  it("describes cadence honestly when there is no recent work", () => {
    expect(buildCadenceSignal([]).label).toBe("Fresh slate");
  });

  it("only returns a readiness signal when enough recent work exists", () => {
    expect(buildReadinessSignal(makeRecentAttempts())?.label).toBe("Ready to press");
    expect(buildReadinessSignal(makeRecentAttempts().slice(0, 2))).toBeUndefined();
  });
});



