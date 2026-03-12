export interface ParsedCard {
  rank: string;
  suit: "s" | "h" | "d" | "c";
}

export function parseCard(card: string): ParsedCard {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1) as ParsedCard["suit"];
  return { rank, suit };
}

export function rankDisplay(rank: string): string {
  const map: Record<string, string> = {
    T: "10",
    J: "J",
    Q: "Q",
    K: "K",
    A: "A",
  };
  return map[rank] ?? rank;
}

export function suitColor(suit: string): string {
  return suit === "h" || suit === "d" ? "text-red-500" : "text-gray-900";
}

export function suitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    s: "\u2660",
    h: "\u2665",
    d: "\u2666",
    c: "\u2663",
  };
  return symbols[suit] ?? suit;
}
