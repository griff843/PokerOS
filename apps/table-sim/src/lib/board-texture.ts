import { parseCard } from "../components/card/card-utils";

export interface BoardTexture {
  pairedBoard: boolean;
  flushComplete: boolean;
  flushDraw: boolean;
  fourLinerStraight: boolean;
  scareAce: boolean;
  monotone: boolean;
  highlights: string[];
}

const RANK_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

function suitCounts(cards: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const { suit } = parseCard(c);
    counts.set(suit, (counts.get(suit) ?? 0) + 1);
  }
  return counts;
}

function rankCounts(cards: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const { rank } = parseCard(c);
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return counts;
}

export function detectTextures(
  visibleCards: string[],
  flopCards: string[]
): BoardTexture {
  const suits = suitCounts(visibleCards);
  const flopSuits = suitCounts(flopCards);
  const ranks = rankCounts(visibleCards);

  const pairedBoard = [...ranks.values()].some((c) => c >= 2);

  // Flush complete: 3+ of a suit now, but wasn't 3+ on flop alone
  const flushComplete = [...suits.entries()].some(
    ([s, count]) => count >= 3 && (flopSuits.get(s) ?? 0) < 3
  );

  // Flush draw: 2 of one suit (on flop-only check)
  const flushDraw =
    visibleCards.length <= 3 && [...suits.values()].some((c) => c >= 2);

  // Monotone: 3 same suit on flop
  const monotone = [...flopSuits.values()].some((c) => c >= 3);

  // Four-liner straight: 4 unique ranks within a 5-rank window
  const uniqueRanks = [...new Set(visibleCards.map((c) => rankValue(parseCard(c).rank)))].sort(
    (a, b) => a - b
  );
  let fourLinerStraight = false;
  if (uniqueRanks.length >= 4) {
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
      const span = uniqueRanks[i + 3] - uniqueRanks[i];
      if (span <= 4) {
        fourLinerStraight = true;
        break;
      }
    }
  }

  // Scare ace: ace on turn/river not on flop
  const flopHasAce = flopCards.some((c) => parseCard(c).rank === "A");
  const boardHasAce = visibleCards.some((c) => parseCard(c).rank === "A");
  const scareAce = boardHasAce && !flopHasAce && visibleCards.length > 3;

  const highlights: string[] = [];
  if (pairedBoard) highlights.push("Paired Board");
  if (flushComplete) highlights.push("Flush Complete");
  if (monotone && !flushComplete) highlights.push("Monotone");
  if (flushDraw && !monotone && !flushComplete) highlights.push("Flush Draw");
  if (fourLinerStraight) highlights.push("Four-Liner");
  if (scareAce) highlights.push("Scare Ace");

  return {
    pairedBoard,
    flushComplete,
    flushDraw,
    fourLinerStraight,
    scareAce,
    monotone,
    highlights,
  };
}

export function getTextureHighlightMap(
  visibleCards: string[],
  _flopCards: string[]
): Map<string, string> {
  const highlights = new Map<string, string>();
  const suits = suitCounts(visibleCards);
  const ranks = rankCounts(visibleCards);

  // Flush highlights: cards of the dominant suit (3+)
  for (const [suit, count] of suits) {
    if (count >= 3) {
      for (const c of visibleCards) {
        if (parseCard(c).suit === suit) {
          highlights.set(c, "ring-2 ring-blue-400");
        }
      }
    }
  }

  // Paired highlights: cards with matching rank
  for (const [rank, count] of ranks) {
    if (count >= 2) {
      for (const c of visibleCards) {
        if (parseCard(c).rank === rank) {
          // Don't overwrite flush highlight
          if (!highlights.has(c)) {
            highlights.set(c, "ring-2 ring-purple-400");
          }
        }
      }
    }
  }

  // Four-liner highlights
  const uniqueRanks = [
    ...new Set(visibleCards.map((c) => rankValue(parseCard(c).rank))),
  ].sort((a, b) => a - b);
  if (uniqueRanks.length >= 4) {
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
      const span = uniqueRanks[i + 3] - uniqueRanks[i];
      if (span <= 4) {
        const window = new Set(
          uniqueRanks.slice(i, i + 4).map((v) => v)
        );
        for (const c of visibleCards) {
          const rv = rankValue(parseCard(c).rank);
          if (window.has(rv) && !highlights.has(c)) {
            highlights.set(c, "ring-2 ring-orange-400");
          }
        }
        break;
      }
    }
  }

  return highlights;
}

