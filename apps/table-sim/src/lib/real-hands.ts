import {
  buildRealHandRecommendations,
  buildRealPlayConceptSignals,
  type AttemptInsight,
  type CanonicalDrill,
  type ImportedHand,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

export interface RealHandsSnapshot {
  generatedAt: string;
  header: {
    headline: string;
    summary: string;
    importStatus: string;
  };
  importHistory: Array<{
    importId: string;
    status: string;
    totalHands: number;
    parsedHands: number;
    unsupportedHands: number;
    createdAt: string;
    notes: string[];
  }>;
  priorityThemes: Array<{
    label: string;
    detail: string;
    urgency: string;
  }>;
  hands: Array<{
    importedHandId: string;
    title: string;
    subtitle: string;
    playedAtLabel: string;
    parseStatus: string;
    themeTags: string[];
    whyReview: string;
  }>;
  selectedHand?: {
    importedHandId: string;
    title: string;
    meta: string[];
    board: string;
    hero: string;
    summary: string;
    conceptTags: string[];
    reviewSpots: Array<{
      spotId: string;
      summary: string;
      reason: string;
      concepts: string[];
      evidence: string[];
    }>;
    recommendations: Array<{
      label: string;
      detail: string;
      drillTitles: string[];
    }>;
  };
}

export function buildRealHandsSnapshot(args: {
  drills: CanonicalDrill[];
  importedHands: ImportedHand[];
  importHistory: Array<{
    importId: string;
    status: string;
    totalHands: number;
    parsedHands: number;
    unsupportedHands: number;
    createdAt: string;
    notes: string[];
  }>;
  attemptInsights: AttemptInsight[];
  activePool: WeaknessPool;
  selectedHandId?: string | null;
  now?: Date;
}): RealHandsSnapshot {
  const now = args.now ?? new Date();
  const signals = buildRealPlayConceptSignals(args.importedHands);
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    activePool: args.activePool,
    realPlaySignals: signals,
    now,
  });
  const recommendations = buildRealHandRecommendations({ hands: args.importedHands, drills: args.drills, limit: 3 });
  const selectedHand = args.importedHands.find((hand) => hand.importedHandId === args.selectedHandId) ?? args.importedHands[0];

  return {
    generatedAt: now.toISOString(),
    header: {
      headline: args.importedHands.length > 0
        ? "Your coaching system now has real-play evidence to work with."
        : "Bring in a few real hands to connect actual play to the coaching loop.",
      summary: args.importedHands.length > 0
        ? "Imported hands are being turned into transparent concept matches, review spots, and training follow-ups without pretending to be solver analysis."
        : "This first version supports a focused PokerStars-style hand-history import path so real mistakes can start feeding diagnosis and training.",
      importStatus: args.importHistory[0]
        ? `${args.importHistory[0].parsedHands}/${args.importHistory[0].totalHands} hands parsed in the latest import.`
        : "No hand history has been imported yet.",
    },
    importHistory: args.importHistory,
    priorityThemes: signals.slice(0, 3).map((signal) => ({
      label: signal.label,
      detail: playerIntelligence.priorities.find((concept) => concept.conceptKey === signal.conceptKey)?.evidence[0]
        ?? signal.evidence[0],
      urgency: signal.occurrences >= 2 ? "Showing up in real play" : "Early real-play signal",
    })),
    hands: args.importedHands.map((hand) => ({
      importedHandId: hand.importedHandId,
      title: hand.tableName ?? `Hand ${hand.sourceHandId}`,
      subtitle: [hand.heroPosition, hand.stakes].filter(Boolean).join(" • ") || (hand.gameType ?? "Imported hand"),
      playedAtLabel: hand.playedAt ? formatDate(hand.playedAt) : "Imported now",
      parseStatus: hand.parseStatus,
      themeTags: hand.conceptMatches.slice(0, 3).map((match) => match.label),
      whyReview: hand.reviewSpots[0]?.reason ?? hand.importNotes[0] ?? "Structured hand context is available for coaching review.",
    })),
    selectedHand: selectedHand ? {
      importedHandId: selectedHand.importedHandId,
      title: selectedHand.tableName ?? `Hand ${selectedHand.sourceHandId}`,
      meta: [selectedHand.playedAt ? formatDate(selectedHand.playedAt) : null, selectedHand.heroPosition, selectedHand.stakes, selectedHand.parseStatus !== "parsed" ? `Parse: ${selectedHand.parseStatus}` : null].filter((value): value is string => Boolean(value)),
      board: formatBoard(selectedHand),
      hero: selectedHand.heroName
        ? `${selectedHand.heroName}${selectedHand.heroCards ? ` • ${selectedHand.heroCards.join(" ")}` : ""}`
        : "Hero cards were not available in this import.",
      summary: selectedHand.reviewSpots[0]?.reason ?? selectedHand.importNotes[0] ?? "This hand is available as a real-play coaching input.",
      conceptTags: selectedHand.conceptMatches.map((match) => `${match.label}${match.confidence === "inferred" ? " (possible)" : ""}`),
      reviewSpots: selectedHand.reviewSpots.map((spot) => ({
        spotId: spot.spotId,
        summary: spot.summary,
        reason: spot.reason,
        concepts: spot.concepts.map((concept) => playerIntelligence.graph.nodes.find((node) => node.key === concept)?.label ?? concept),
        evidence: spot.evidence,
      })),
      recommendations: recommendations
        .filter((recommendation) => selectedHand.conceptMatches.some((match) => match.conceptKey === recommendation.conceptKey) || selectedHand.reviewSpots.some((spot) => spot.concepts.includes(recommendation.conceptKey)))
        .map((recommendation) => ({
          label: recommendation.label,
          detail: recommendation.reason,
          drillTitles: recommendation.relatedDrills.map((drill) => drill.title),
        })),
    } : undefined,
  };
}

function formatBoard(hand: ImportedHand): string {
  if (!hand.board) {
    return "Board not fully available";
  }
  return [hand.board.flop.join(" "), hand.board.turn, hand.board.river].filter(Boolean).join(" • ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}



