import { describe, expect, it } from "vitest";
import { buildAttemptInsights, parseImportedHandsText, type CanonicalDrill } from "@poker-coach/core/browser";
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
  });
});





