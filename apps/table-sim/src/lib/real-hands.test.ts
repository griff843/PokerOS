import { describe, expect, it } from "vitest";
import { buildAttemptInsights, buildRealHandRecommendations, parseImportedHandsText, type CanonicalDrill } from "@poker-coach/core/browser";
import { createManualImportedHand } from "./real-hand-persistence";
import { buildRealHandsSnapshot } from "./real-hands";

const HAND = `PokerStars Hand #123456789: Hold'em No Limit ($0.50/$1.00 USD) - 2026/03/10 20:15:00 ET
Table 'Alpha' 6-max Seat #3 is the button
Seat 1: Hero ($100 in chips)
Seat 2: Villain ($102 in chips)
Seat 3: Other ($98 in chips)
Hero: posts small blind $0.50
Villain: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [As Qh]
Other: folds
Hero: raises $2.50 to $3.00
Villain: calls $2.00
*** FLOP *** [Ad 7d 2c]
Hero: bets $3.50
Villain: calls $3.50
*** TURN *** [Ad 7d 2c] [Kd]
Hero: checks
Villain: bets $9.00
Hero: calls $9.00
*** RIVER *** [Ad 7d 2c Kd] [Jd]
Hero: checks
Villain: bets $20.00
Hero: folds
Villain collected $34.00 from pot`;

function makeDrill(): CanonicalDrill {
  return {
    drill_id: "d1",
    node_id: "hu_river_01",
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
      board: { flop: ["Ad", "7d", "2c"], turn: "Kd", river: "Jd" },
      hero_hand: ["As", "Qh"],
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
  };
}

describe("real hands snapshot", () => {
  it("builds a coach-led imported hand review surface", () => {
    const importedHands = parseImportedHandsText({ text: HAND, source: "paste" }).hands;
    const drill = makeDrill();
    const snapshot = buildRealHandsSnapshot({
      drills: [drill],
      importedHands,
      importHistory: [{
        importId: "import-1",
        status: "completed",
        totalHands: 1,
        parsedHands: 1,
        unsupportedHands: 0,
        createdAt: "2026-03-11T10:00:00.000Z",
        notes: [],
      }],
      attemptInsights: buildAttemptInsights([], new Map([[drill.drill_id, drill]])),
      activePool: "baseline",
      now: new Date("2026-03-11T10:00:00.000Z"),
    });

    expect(snapshot.priorityThemes.length).toBeGreaterThan(0);
    expect(snapshot.hands[0]?.themeTags.length).toBeGreaterThan(0);
    expect(snapshot.selectedHand?.reviewSpots.length).toBeGreaterThan(0);
    expect(snapshot.selectedHand?.recommendations[0]?.destination).toContain("/app/concepts/");
  });

  it("prefers gold-lane river bluff-catch drills in real-hand recommendations", () => {
    const importedHands = parseImportedHandsText({ text: HAND, source: "paste" }).hands;
    const genericDrill: CanonicalDrill = {
      ...makeDrill(),
      drill_id: "generic-1",
      title: "Generic Bluff Catch Drill",
      node_id: "hu_river_01",
      tags: ["street:river", "concept:blocker_effect"],
    };
    const goldLaneDrill: CanonicalDrill = {
      ...makeDrill(),
      drill_id: "gold-1",
      node_id: "bluff_catch_01",
      title: "Gold Lane River Bluff Catch",
      scenario: {
        ...makeDrill().scenario,
        hero_position: "BB",
        villain_position: "BTN",
        pot_type: "SRP",
      },
      tags: [
        "street:river",
        "pot:srp",
        "position:oop",
        "spot:btn_vs_bb",
        "concept:blocker_effect",
        "decision:bluff_catch",
      ],
      coaching_context: {
        what_changed_by_street: [
          { street: "turn", detail: "Turn check preserved delayed floats and capped some value." },
          { street: "river", detail: "River bluff-catching is driven by what air survives." },
        ],
      },
    };

    const recommendations = buildRealHandRecommendations({
      hands: importedHands,
      drills: [genericDrill, goldLaneDrill],
      limit: 3,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some((recommendation) => recommendation.relatedDrills[0]?.drillId === "gold-1")).toBe(true);
    const goldRecommendation = recommendations.find((recommendation) => recommendation.relatedDrills[0]?.drillId === "gold-1");
    expect(goldRecommendation?.laneLabel).toBe("Gold Lane: BTN vs BB SRP River Bluff-Catch");
    expect(goldRecommendation?.relatedDrills[0]?.whyPicked).toContain("gold-lane");
  });

  it("builds a manual live reconstruction that still maps into river bluff-catching follow-ups", () => {
    const hand = createManualImportedHand({
      input: {
        tableName: "2/5 Main Game",
        stakes: "$2/$5",
        heroName: "Hero",
        heroPosition: "BB",
        villainPosition: "BTN",
        heroCards: ["Qd", "9h"],
        memoryConfidence: "medium",
        flop: ["Qc", "7s", "3h"],
        turn: "2d",
        river: "5c",
        effectiveStackBb: 90,
        turnSummary: "Turn felt like a medium barrel and I called.",
        turnLineCategory: "faced_bet_call",
        turnSizeBucket: "medium",
        riverSummary: "River was a big bet on a brick and I thought he looked strong.",
        riverFacingAction: "bet",
        riverSizeBucket: "large",
        note: "I think I overfolded because live players never bluff enough here.",
      },
      importedAt: new Date("2026-03-27T01:00:00.000Z"),
    });

    expect(hand.source).toBe("manual");
    expect(hand.parseStatus).toBe("partial");
    expect(hand.conceptMatches.some((match) => match.conceptKey === "bluff_catching")).toBe(true);
    expect(hand.reviewSpots.some((spot) => spot.street === "river")).toBe(true);
    expect(hand.importNotes[0]).toContain("reconstructed manually");
    expect(hand.rawText).toContain("Turn line family: Faced turn bet and called");
  });

  it("surfaces reconstruction uncertainty on manual hands in the review snapshot", () => {
    const hand = createManualImportedHand({
      input: {
        tableName: "5/10 Live",
        heroPosition: "BB",
        villainPosition: "BTN",
        heroCards: ["As", "9d"],
        memoryConfidence: "low",
        flop: ["Ah", "7c", "4d"],
        turn: "2s",
        river: "Qc",
        turnLineCategory: "check_through",
        turnSizeBucket: "unknown",
        riverFacingAction: "bet",
        riverSizeBucket: "polar",
        riverSummary: "River felt huge after the turn checked through.",
      },
      importedAt: new Date("2026-03-27T02:30:00.000Z"),
    });

    const snapshot = buildRealHandsSnapshot({
      drills: [makeDrill()],
      importedHands: [hand],
      importHistory: [],
      attemptInsights: [],
      activePool: "baseline",
      now: new Date("2026-03-27T02:30:00.000Z"),
    });

    expect(snapshot.selectedHand?.reconstructionNote?.label).toContain("Memory low");
    expect(snapshot.selectedHand?.reconstructionNote?.detail).toContain("exact sizing may be approximate");
    expect(snapshot.selectedHand?.followUpContext.uncertaintyProfile).toBe("sizing_fuzzy_line_clear");
    expect(snapshot.selectedHand?.followUpContext.uncertaintyLabel).toBe("Sizing fuzzy, line clear");
    expect(snapshot.selectedHand?.followUpContext.planningBias).toContain("Line-family reps first");
  });

  it("marks low-confidence unclear reconstructions as memory-decisive", () => {
    const hand = createManualImportedHand({
      input: {
        tableName: "5/10 Live",
        heroPosition: "BB",
        villainPosition: "BTN",
        heroCards: ["Kd", "Jc"],
        memoryConfidence: "low",
        flop: ["Ks", "8c", "3d"],
        turn: "6h",
        river: "Ac",
        turnLineCategory: "unclear",
        turnSizeBucket: "unknown",
        riverFacingAction: "bet",
        riverSizeBucket: "large",
        riverSummary: "I remember a big river bet but I'm not sure if turn checked through or if I called turn.",
      },
      importedAt: new Date("2026-03-27T03:00:00.000Z"),
    });

    const snapshot = buildRealHandsSnapshot({
      drills: [makeDrill()],
      importedHands: [hand],
      importHistory: [],
      attemptInsights: [],
      activePool: "baseline",
      now: new Date("2026-03-27T03:00:00.000Z"),
    });

    expect(snapshot.selectedHand?.followUpContext.uncertaintyProfile).toBe("memory_decisive");
    expect(snapshot.selectedHand?.followUpContext.uncertaintyLabel).toBe("Memory decisive");
    expect(snapshot.selectedHand?.followUpContext.planningBias).toContain("Memory-decisive reps first");
  });
});





