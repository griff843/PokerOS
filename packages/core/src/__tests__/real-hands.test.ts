import { describe, expect, it } from "vitest";
import { buildPlayerIntelligenceSnapshot } from "../player-intelligence";
import {
  buildRealPlayConceptSignals,
  parseImportedHandsText,
  type AttemptInsight,
  type CanonicalDrill,
} from "../index";

const POKERSTARS_HAND = `PokerStars Hand #123456789: Hold'em No Limit ($0.50/$1.00 USD) - 2026/03/10 20:15:00 ET
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

describe("real hand ingestion", () => {
  it("parses PokerStars text into structured reviewable hands", () => {
    const result = parseImportedHandsText({ text: POKERSTARS_HAND, source: "paste" });

    expect(result.hands).toHaveLength(1);
    expect(result.hands[0]?.tableName).toBe("Alpha");
    expect(result.hands[0]?.heroName).toBe("Hero");
    expect(result.hands[0]?.heroPosition).toBe("SB");
    expect(result.hands[0]?.board?.river).toBe("Jd");
    expect(result.hands[0]?.reviewSpots.some((spot) => spot.concepts.includes("river_defense"))).toBe(true);
  });

  it("maps imported hands into transparent concept signals", () => {
    const hands = parseImportedHandsText({ text: POKERSTARS_HAND, source: "paste" }).hands;
    const signals = buildRealPlayConceptSignals(hands);

    expect(signals.some((signal) => signal.conceptKey === "river_defense")).toBe(true);
    expect(signals.find((signal) => signal.conceptKey === "board_connectivity")?.occurrences).toBe(1);
  });

  it("lets real-play evidence lift recommendation urgency without fake drill scores", () => {
    const snapshot = buildPlayerIntelligenceSnapshot({
      drills: [makeDrill()],
      attemptInsights: [] as AttemptInsight[],
      realPlaySignals: buildRealPlayConceptSignals(parseImportedHandsText({ text: POKERSTARS_HAND, source: "paste" }).hands),
      activePool: "baseline",
    });

    expect(snapshot.priorities.some((concept) => concept.conceptKey === "river_defense")).toBe(true);
    expect(snapshot.concepts.find((concept) => concept.conceptKey === "river_defense")?.evidence.some((entry) => entry.includes("imported hand"))).toBe(true);
  });
});



