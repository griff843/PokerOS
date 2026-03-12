import { describe, expect, it } from "vitest";
import { buildPlayerIntelligenceSnapshot } from "./player-intelligence";
import { buildInterventionPlan } from "./intervention-planner";
import type { CanonicalDrill } from "./schemas";
import type { AttemptInsight } from "./weakness-analytics";
import type { DiagnosticInsight } from "./diagnostics";
import type { RealPlayConceptSignal } from "./real-hands";

function makeDrill(options: {
  drillId: string;
  nodeId: string;
  title: string;
  conceptTags: string[];
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
    tags: [...options.conceptTags, "decision:bluff_catch"],
    difficulty: 2,
    diagnostic_prompts: [
      {
        id: `diag-${options.drillId}`,
        type: "blocker",
        prompt: "What mattered most?",
        concept: options.conceptTags[0] ?? "concept:blocker_effect",
        expected_reasoning: "Use the main concept.",
        options: [],
      },
    ],
  };
}

describe("adaptive coaching", () => {
  it("infers learner tendencies from diagnostics, confidence, and real-play pressure", () => {
    const drills = [
      makeDrill({ drillId: "d1", nodeId: "river_1", title: "River Bluff Catch", conceptTags: ["concept:blocker_effect"], requiredTag: "paired_top_river" }),
      makeDrill({ drillId: "d2", nodeId: "turn_1", title: "Turn Story", conceptTags: ["concept:line_planning"], requiredTag: "turn_probe" }),
    ];
    const attemptInsights: AttemptInsight[] = [
      { drillId: "d1", nodeId: "river_1", score: 0.72, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d1", nodeId: "river_1", score: 0.68, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
      { drillId: "d2", nodeId: "turn_1", score: 0.38, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:line_planning"], activePool: "B" },
      { drillId: "d2", nodeId: "turn_1", score: 0.34, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:line_planning"], activePool: "B" },
    ];
    const diagnosticInsights: DiagnosticInsight[] = [
      { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "blocker_blindness", confidenceMiscalibration: false },
      { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "blocker_blindness", confidenceMiscalibration: false },
      { conceptKey: "line_planning", concept: "line planning", errorType: "line_misunderstanding", confidenceMiscalibration: false },
      { conceptKey: "line_planning", concept: "line planning", errorType: "line_misunderstanding", confidenceMiscalibration: false },
      { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "threshold_error", confidenceMiscalibration: true },
      { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "threshold_error", confidenceMiscalibration: true },
    ];
    const realPlaySignals: RealPlayConceptSignal[] = [
      {
        conceptKey: "blocker_effect",
        label: "Blocker Effects",
        occurrences: 3,
        reviewSpotCount: 2,
        weight: 0.22,
        recommendedPool: "B",
        evidence: ["Imported hands keep surfacing blocker-sensitive river calls."],
      },
    ];

    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights,
      activePool: "B",
      srs: [{ drill_id: "d1", due_at: "2026-03-09T10:00:00.000Z" }, { drill_id: "d2", due_at: "2026-03-09T10:00:00.000Z" }, { drill_id: "d3", due_at: "2026-03-09T10:00:00.000Z" }, { drill_id: "d4", due_at: "2026-03-09T10:00:00.000Z" }, { drill_id: "d5", due_at: "2026-03-09T10:00:00.000Z" }],
      confidenceInsights: [
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
      ],
      diagnosticInsights,
      realPlaySignals,
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(snapshot.adaptiveProfile.tendencies.map((tendency) => tendency.key)).toContain("overconfident_threshold_player");
    expect(snapshot.adaptiveProfile.tendencies.map((tendency) => tendency.key)).toContain("line_confused_player");
    expect(snapshot.adaptiveProfile.tendencies.map((tendency) => tendency.key)).toContain("blocker_blind_player");
    expect(snapshot.adaptiveProfile.tendencies.map((tendency) => tendency.key)).toContain("review_avoidant_player");
    expect(snapshot.adaptiveProfile.tendencies.map((tendency) => tendency.key)).toContain("drill_strong_real_play_weak_player");
    expect(snapshot.adaptiveProfile.surfaceSignals.commandCenter.length).toBeGreaterThan(0);
  });

  it("weights interventions around learner style instead of concept weakness alone", () => {
    const drills = [
      makeDrill({ drillId: "d1", nodeId: "river_1", title: "River Bluff Catch", conceptTags: ["concept:blocker_effect"], requiredTag: "paired_top_river" }),
      makeDrill({ drillId: "d2", nodeId: "turn_1", title: "Turn Story", conceptTags: ["concept:line_planning"], requiredTag: "turn_probe" }),
    ];
    const snapshot = buildPlayerIntelligenceSnapshot({
      drills,
      attemptInsights: [
        { drillId: "d1", nodeId: "river_1", score: 0.7, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
        { drillId: "d1", nodeId: "river_1", score: 0.68, correct: true, missedTags: [], classificationTags: ["concept:blocker_effect"], activePool: "B" },
        { drillId: "d2", nodeId: "turn_1", score: 0.32, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:line_planning"], activePool: "B" },
        { drillId: "d2", nodeId: "turn_1", score: 0.28, correct: false, missedTags: ["turn_probe"], classificationTags: ["concept:line_planning"], activePool: "B" },
      ],
      activePool: "B",
      confidenceInsights: [
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
        { confidence: "certain", correct: false, classificationTags: ["concept:blocker_effect"], missedTags: ["paired_top_river"] },
      ],
      diagnosticInsights: [
        { conceptKey: "line_planning", concept: "line planning", errorType: "line_misunderstanding", confidenceMiscalibration: false },
        { conceptKey: "line_planning", concept: "line planning", errorType: "line_misunderstanding", confidenceMiscalibration: false },
        { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "threshold_error", confidenceMiscalibration: true },
        { conceptKey: "blocker_effect", concept: "blocker effect", errorType: "threshold_error", confidenceMiscalibration: true },
      ],
      realPlaySignals: [
        {
          conceptKey: "blocker_effect",
          label: "Blocker Effects",
          occurrences: 2,
          reviewSpotCount: 1,
          weight: 0.2,
          recommendedPool: "B",
          evidence: ["Imported hands keep surfacing blocker-sensitive river calls."],
        },
      ],
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    const plan = buildInterventionPlan({
      playerIntelligence: snapshot,
      recentAttempts: [
        {
          drillId: "d2",
          nodeId: "turn_1",
          title: "Turn Story",
          score: 0.32,
          correct: false,
          ts: "2026-03-10T10:00:00.000Z",
          activePool: "B",
          diagnosticErrorType: "line_misunderstanding",
          diagnosticConceptKey: "line_planning",
          confidenceMiscalibration: false,
        },
        {
          drillId: "d1",
          nodeId: "river_1",
          title: "River Bluff Catch",
          score: 0.28,
          correct: false,
          ts: "2026-03-10T10:05:00.000Z",
          activePool: "B",
          diagnosticErrorType: "threshold_error",
          diagnosticConceptKey: "blocker_effect",
          confidenceMiscalibration: true,
        },
      ],
      activePool: "B",
      now: new Date("2026-03-10T12:00:00.000Z"),
    });

    expect(plan.trainingBlocks.some((block) => block.reason.includes("line reconstruction"))).toBe(true);
    expect(plan.trainingBlocks.some((block) => block.reason.includes("practical thresholds"))).toBe(true);
    expect(plan.trainingBlocks.some((block) => block.reason.includes("imported hands"))).toBe(true);
    expect(plan.trainingBlocks.some((block) => block.role === "calibration")).toBe(true);
  });
});



