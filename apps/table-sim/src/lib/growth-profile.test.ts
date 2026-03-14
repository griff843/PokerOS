import { describe, expect, it } from "vitest";
import type { AttemptInsight, CanonicalDrill, InterventionHistoryEntry } from "@poker-coach/core/browser";
import { buildGrowthProfileSnapshot, type GrowthProfileAttempt } from "./growth-profile";

function makeDrill(options: {
  drillId: string;
  nodeId: string;
  title: string;
  conceptTag: string;
  requiredTag: string;
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
      required_tags: [options.requiredTag],
      explanation: "Call the bluff-catcher.",
    },
    tags: [options.conceptTag, "decision:bluff_catch"],
    difficulty: 2,
  };
}

describe("growth profile snapshot", () => {
  it("summarizes long-term direction, strengths, weak spots, intervention outcomes, and next actions honestly", () => {
    const drills: CanonicalDrill[] = [
      makeDrill({ drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", conceptTag: "concept:blocker_effect", requiredTag: "paired_top_river" }),
      makeDrill({ drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", conceptTag: "concept:turn_probe", requiredTag: "turn_probe" }),
    ];

    const attempts: GrowthProfileAttempt[] = [
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.82, correct: true, ts: "2026-03-10T10:00:00.000Z", elapsedMs: 12000, activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.78, correct: true, ts: "2026-03-09T10:00:00.000Z", elapsedMs: 13000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.72, correct: true, ts: "2026-03-08T10:00:00.000Z", elapsedMs: 15000, activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.66, correct: true, ts: "2026-03-07T10:00:00.000Z", elapsedMs: 18000, activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.62, correct: true, ts: "2026-03-06T10:00:00.000Z", elapsedMs: 17000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.58, correct: false, ts: "2026-03-05T10:00:00.000Z", elapsedMs: 22000, activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.44, correct: false, ts: "2026-03-04T10:00:00.000Z", elapsedMs: 26000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.4, correct: false, ts: "2026-03-03T10:00:00.000Z", elapsedMs: 28000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.36, correct: false, ts: "2026-03-02T10:00:00.000Z", elapsedMs: 30000, activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", title: "River Bluff Catch", score: 0.34, correct: false, ts: "2026-03-01T10:00:00.000Z", elapsedMs: 32000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.3, correct: false, ts: "2026-02-28T10:00:00.000Z", elapsedMs: 34000, activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", title: "Turn Probe", score: 0.28, correct: false, ts: "2026-02-27T10:00:00.000Z", elapsedMs: 36000, activePool: "B" },
    ];

    const attemptInsights: AttemptInsight[] = [
      { drillId: "d1", nodeId: "hu_river_01", score: 0.82, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.78, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.72, correct: true, missedTags: [], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.66, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.62, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.58, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.44, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.4, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.36, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d1", nodeId: "hu_river_01", score: 0.34, correct: false, missedTags: ["paired_top_river"], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.3, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
      { drillId: "d2", nodeId: "hu_turn_01", score: 0.28, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:turn_probe"], activePool: "B" },
    ];

    const interventionHistory: InterventionHistoryEntry[] = [
      { id: "i1", conceptKey: "turn_probe", source: "command_center", status: "completed", improved: true, preScore: 0.33, postScore: 0.69, createdAt: "2026-03-05T10:00:00.000Z" },
      { id: "i2", conceptKey: "river_bluff_catching", source: "session_review", status: "assigned", createdAt: "2026-03-10T10:00:00.000Z" },
    ];

    const snapshot = buildGrowthProfileSnapshot({
      drills,
      attempts,
      attemptInsights,
      diagnosisHistory: [
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.9, createdAt: "2026-03-10T10:00:00.000Z" },
        { conceptKey: "river_bluff_catching", diagnosticType: "threshold_error", confidence: 0.85, createdAt: "2026-03-09T10:00:00.000Z" },
      ],
      interventionHistory,
      patternAttempts: [
        {
          drillId: "d1",
          nodeId: "hu_river_01",
          ts: "2026-03-10T10:00:00.000Z",
          sessionId: "s1",
          conceptKeys: ["river_bluff_catching"],
          missedTags: ["paired_top_river"],
          score: 0.34,
          correct: false,
          diagnosticType: "threshold_error",
          diagnosticConceptKey: "river_bluff_catching",
          activePool: "B",
        },
        {
          drillId: "d1",
          nodeId: "hu_river_01",
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
      ],
      srs: [{ drill_id: "d2", due_at: "2026-03-09T10:00:00.000Z" }],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(snapshot.header.direction).toBe("Trending up");
    expect(snapshot.progressSnapshot[2]?.value).toBe("No clear strength yet");
    expect(snapshot.weakSpots[0]?.label).toBe("Bluff Catching");
    expect(snapshot.practiceIdentity[0]?.value).toBe("Steady rhythm");
    expect(snapshot.practiceIdentity.some((item) => item.label === "Coaching emphasis")).toBe(true);
    expect(snapshot.interventionSuccess[0]?.label).toBe("Intervention success");
    expect(snapshot.conceptRecovery[0]?.label).toBe("Turn Probe");
    expect(snapshot.recurringLeaks.length).toBeGreaterThan(0);
    expect(snapshot.coachingPatterns[0]?.title).toBe("Recurring threshold leak");
    expect(snapshot.nextInterventionDecision?.action).toBeTruthy();
    expect(snapshot.nextInterventionBlueprint?.strategyType).toBeTruthy();
    expect(snapshot.featuredConceptCase?.statusLabel).toBeTruthy();
    expect(snapshot.featuredConceptCase?.transferStatus).toBeTruthy();
    expect(snapshot.featuredConceptCase?.transferAudit?.stability).toBeTruthy();
    expect(snapshot.featuredConceptCase?.replay?.transferInterpretation).toBeTruthy();
    expect(snapshot.featuredConceptCase?.nextAction.length).toBeGreaterThan(0);
    expect(snapshot.interventionRecommendation?.plan.recommendedSessionTitle.length).toBeGreaterThan(0);
    expect(snapshot.nextActions[0]?.href).toBe("/app/weaknesses");
  });
});
