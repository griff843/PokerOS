import {
  buildRealHandRecommendations,
  buildRealPlayConceptSignals,
  type AttemptInsight,
  type CanonicalDrill,
  type ImportedHand,
  type RealHandRecommendation,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

export type FollowUpUncertaintyProfile =
  | "precise_history"
  | "turn_line_clear"
  | "sizing_fuzzy_line_clear"
  | "turn_line_fuzzy"
  | "memory_decisive";

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
    reconstructionNote?: {
      label: string;
      detail: string;
    };
    followUpContext: {
      handSource: "paste" | "file" | "manual";
      parseStatus: "parsed" | "partial" | "unsupported";
      uncertaintyProfile: FollowUpUncertaintyProfile;
      uncertaintyLabel: string;
      planningBias: string;
    };
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
      conceptKey: string;
      destination: string;
      label: string;
      detail: string;
      recommendedPool: WeaknessPool;
      laneLabel?: string;
      laneReason?: string;
      preferredDrillIds: string[];
      drills: Array<{
        drillId: string;
        title: string;
        nodeId: string;
        whyPicked: string;
      }>;
    }>;
  };
}

type ReconstructionNote = NonNullable<RealHandsSnapshot["selectedHand"]>["reconstructionNote"];

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
      reconstructionNote: buildReconstructionNote(selectedHand),
      followUpContext: buildFollowUpContext(selectedHand),
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
        .filter((recommendation) => matchesSelectedHandRecommendation(selectedHand, recommendation))
        .map((recommendation) => ({
          conceptKey: recommendation.conceptKey,
          destination: `/app/concepts/${encodeURIComponent(recommendation.conceptKey)}`,
          label: recommendation.label,
          detail: recommendation.reason,
          recommendedPool: recommendation.recommendedPool,
          laneLabel: recommendation.laneLabel,
          laneReason: recommendation.laneReason,
          preferredDrillIds: recommendation.relatedDrills.map((drill) => drill.drillId),
          drills: recommendation.relatedDrills.map((drill) => ({
            drillId: drill.drillId,
            title: drill.title,
            nodeId: drill.nodeId,
            whyPicked: drill.whyPicked,
          })),
        })),
    } : undefined,
  };
}

function buildReconstructionNote(hand: ImportedHand): ReconstructionNote | undefined {
  if (hand.source !== "manual" && hand.parseStatus === "parsed") {
    return undefined;
  }

  const confidenceNote = hand.importNotes.find((note) => note.startsWith("Memory confidence:"));
  if (hand.source === "manual") {
    return {
      label: confidenceNote ? confidenceNote.replace("Memory confidence:", "Memory").trim() : "Manual reconstruction",
      detail: "This hand was reconstructed from live-play memory. Treat line family and threshold lessons as primary; exact sizing may be approximate.",
    };
  }

  return {
    label: `Parse status: ${hand.parseStatus}`,
    detail: hand.importNotes[0] ?? "This import has explicit uncertainty and should be read as a coaching input, not a perfect hand-history record.",
  };
}

function buildFollowUpContext(hand: ImportedHand): NonNullable<RealHandsSnapshot["selectedHand"]>["followUpContext"] {
  const uncertaintyProfile = deriveUncertaintyProfile(hand);
  return {
    handSource: hand.source,
    parseStatus: hand.parseStatus,
    uncertaintyProfile,
    uncertaintyLabel: describeUncertaintyProfile(uncertaintyProfile),
    planningBias: describePlanningBias(uncertaintyProfile),
  };
}

function deriveUncertaintyProfile(hand: ImportedHand): FollowUpUncertaintyProfile {
  if (hand.source !== "manual") {
    return hand.parseStatus === "parsed" ? "precise_history" : "turn_line_fuzzy";
  }

  const memoryConfidence = hand.rawText.match(/Memory confidence:\s*(.+)/i)?.[1]?.trim().toLowerCase();
  const turnLineNote = hand.rawText.match(/Turn line family:\s*(.+)/i)?.[1]?.trim().toLowerCase();
  const turnSizeBucket = hand.rawText.match(/Turn size bucket:\s*(.+)/i)?.[1]?.trim().toLowerCase()
    ?? hand.rawText.match(/Turn memory \(([^)]+)\)/i)?.[1]?.split(",")[0]?.trim().toLowerCase();
  const riverSizeBucket = hand.rawText.match(/River size bucket:\s*(.+)/i)?.[1]?.trim().toLowerCase()
    ?? hand.rawText.match(/River memory \(([^)]+)\)/i)?.[1]?.split(",").map((entry) => entry.trim().toLowerCase()).find((entry) => ["unknown", "small", "medium", "large", "polar"].includes(entry));
  const turnLineUnclear = !turnLineNote || turnLineNote === "unclear" || turnLineNote === "unclear / mixed memory";

  if (turnLineUnclear) {
    return memoryConfidence === "low" ? "memory_decisive" : "turn_line_fuzzy";
  }

  if (turnSizeBucket === "unknown" || riverSizeBucket === "unknown") {
    return "sizing_fuzzy_line_clear";
  }

  return "turn_line_clear";
}

function describeUncertaintyProfile(profile: FollowUpUncertaintyProfile): string {
  switch (profile) {
    case "precise_history":
      return "Precise history";
    case "turn_line_clear":
      return "Turn line clear";
    case "sizing_fuzzy_line_clear":
      return "Sizing fuzzy, line clear";
    case "turn_line_fuzzy":
      return "Turn line fuzzy";
    case "memory_decisive":
      return "Memory decisive";
  }
}

function describePlanningBias(profile: FollowUpUncertaintyProfile): string {
  switch (profile) {
    case "precise_history":
      return "Exact-match reps first, then adjacent transfer.";
    case "turn_line_clear":
      return "Turn-to-river carryover reps first; the line family should drive the threshold.";
    case "sizing_fuzzy_line_clear":
      return "Line-family reps first, then size-sensitive threshold checks where sizing might flip the answer.";
    case "turn_line_fuzzy":
      return "Bridge drills first; recover the likely turn story before forcing an exact river answer.";
    case "memory_decisive":
      return "Memory-decisive reps first; resolve which turn version happened before trusting the river answer.";
  }
}

function matchesSelectedHandRecommendation(hand: ImportedHand, recommendation: RealHandRecommendation): boolean {
  return hand.conceptMatches.some((match) => match.conceptKey === recommendation.conceptKey)
    || hand.reviewSpots.some((spot) => spot.concepts.includes(recommendation.conceptKey));
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



