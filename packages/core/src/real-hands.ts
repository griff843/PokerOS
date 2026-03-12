import { z } from "zod";
import { BoardSchema, CardSchema, StreetSchema, type Board, type CanonicalDrill } from "./schemas";
import { buildConceptGraph, getSupportingConcepts, mapSignalToConceptKeys } from "./concept-graph";
import type { WeaknessPool } from "./weakness-analytics";

export const ImportedHandSourceSchema = z.enum(["paste", "file"]);
export type ImportedHandSource = z.infer<typeof ImportedHandSourceSchema>;

export const ImportedHandParseStatusSchema = z.enum(["parsed", "partial", "unsupported"]);
export type ImportedHandParseStatus = z.infer<typeof ImportedHandParseStatusSchema>;

export const ImportedHandConfidenceSchema = z.enum(["known", "inferred"]);
export type ImportedHandConfidence = z.infer<typeof ImportedHandConfidenceSchema>;

export const ImportedHandStreetSchema = z.enum(["preflop", "flop", "turn", "river", "showdown", "summary"]);
export type ImportedHandStreet = z.infer<typeof ImportedHandStreetSchema>;

export const ImportedHandActionTypeSchema = z.enum(["post_blind", "check", "call", "bet", "raise", "fold", "show", "muck", "collect", "unknown"]);
export type ImportedHandActionType = z.infer<typeof ImportedHandActionTypeSchema>;

export const ImportedHandPlayerSchema = z.object({
  seat: z.number().int().positive().nullable().optional(),
  name: z.string().min(1),
  stackChips: z.number().nonnegative().nullable().optional(),
  position: z.string().nullable().optional(),
  isHero: z.boolean().default(false),
  villainLabel: z.string().nullable().optional(),
});
export type ImportedHandPlayer = z.infer<typeof ImportedHandPlayerSchema>;

export const ImportedHandActionSchema = z.object({
  street: ImportedHandStreetSchema,
  actor: z.string().min(1),
  action: ImportedHandActionTypeSchema,
  amountChips: z.number().nonnegative().optional(),
  amountToChips: z.number().nonnegative().optional(),
  isHero: z.boolean().default(false),
  raw: z.string().min(1),
});
export type ImportedHandAction = z.infer<typeof ImportedHandActionSchema>;

export const ImportedHandConceptSourceSchema = z.enum(["board_texture", "hero_decision", "bet_sizing", "street_transition", "showdown_context", "hand_pattern"]);
export type ImportedHandConceptSource = z.infer<typeof ImportedHandConceptSourceSchema>;

export const ImportedHandConceptMatchSchema = z.object({
  conceptKey: z.string().min(1),
  label: z.string().min(1),
  confidence: ImportedHandConfidenceSchema,
  source: ImportedHandConceptSourceSchema,
  reason: z.string().min(1),
});
export type ImportedHandConceptMatch = z.infer<typeof ImportedHandConceptMatchSchema>;

export const ImportedHandReviewSpotKindSchema = z.enum(["hero_decision", "street_inflection", "showdown_reveal"]);
export type ImportedHandReviewSpotKind = z.infer<typeof ImportedHandReviewSpotKindSchema>;

export const ImportedHandReviewSpotSchema = z.object({
  spotId: z.string().min(1),
  street: StreetSchema,
  actor: z.string().min(1),
  kind: ImportedHandReviewSpotKindSchema,
  summary: z.string().min(1),
  reason: z.string().min(1),
  confidence: ImportedHandConfidenceSchema,
  concepts: z.array(z.string().min(1)).min(1),
  actionIndex: z.number().int().min(0).nullable().optional(),
  evidence: z.array(z.string().min(1)).default([]),
});
export type ImportedHandReviewSpot = z.infer<typeof ImportedHandReviewSpotSchema>;

export const ImportedHandSchema = z.object({
  importedHandId: z.string().min(1),
  sourceHandId: z.string().min(1),
  source: ImportedHandSourceSchema,
  parseStatus: ImportedHandParseStatusSchema,
  parserVersion: z.string().min(1),
  rawText: z.string().min(1),
  tableName: z.string().nullable().optional(),
  gameType: z.string().nullable().optional(),
  stakes: z.string().nullable().optional(),
  playedAt: z.string().datetime().nullable().optional(),
  sessionLabel: z.string().nullable().optional(),
  heroName: z.string().nullable().optional(),
  heroCards: z.tuple([CardSchema, CardSchema]).nullable().optional(),
  heroPosition: z.string().nullable().optional(),
  board: BoardSchema.nullable().optional(),
  players: z.array(ImportedHandPlayerSchema).default([]),
  actions: z.array(ImportedHandActionSchema).default([]),
  effectiveStackBb: z.number().positive().nullable().optional(),
  conceptMatches: z.array(ImportedHandConceptMatchSchema).default([]),
  reviewSpots: z.array(ImportedHandReviewSpotSchema).default([]),
  importNotes: z.array(z.string().min(1)).default([]),
});
export type ImportedHand = z.infer<typeof ImportedHandSchema>;

export interface ParsedHandBatch {
  hands: ImportedHand[];
  importNotes: string[];
}

export interface RealPlayConceptSignal {
  conceptKey: string;
  label: string;
  occurrences: number;
  reviewSpotCount: number;
  weight: number;
  recommendedPool: WeaknessPool;
  latestHandAt?: string;
  evidence: string[];
}

export interface RealHandRecommendation {
  conceptKey: string;
  label: string;
  reason: string;
  recommendedPool: WeaknessPool;
  relatedDrills: Array<{
    drillId: string;
    title: string;
    nodeId: string;
  }>;
}

const PARSER_VERSION = "pokerstars_nlhe_v1";
const HAND_HEADER = /^PokerStars Hand #(\d+):\s+(.+?)\s+-\s+(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/m;
const SEAT_LINE = /^Seat\s+(\d+):\s+(.+?)\s+\(([^)]+) in chips\)$/;
const HERO_LINE = /^Dealt to\s+(.+?)\s+\[([2-9TJQKA][shdc])\s+([2-9TJQKA][shdc])\]$/;
const BUTTON_LINE = /Seat #(\d+) is the button/;

export function parseImportedHandsText(args: {
  text: string;
  source: ImportedHandSource;
  importedAt?: Date;
}): ParsedHandBatch {
  const source = ImportedHandSourceSchema.parse(args.source);
  const chunks = splitHandHistoryText(args.text);
  const hands = chunks.map((chunk, index) => parseSingleHand({ rawText: chunk, source, importedAt: args.importedAt, index }));
  return {
    hands,
    importNotes: hands.some((hand) => hand.parseStatus !== "parsed")
      ? ["Only PokerStars-style NLHE text is fully supported in this first version. Partial imports stay visible with explicit uncertainty."]
      : [],
  };
}

export function buildRealPlayConceptSignals(hands: ImportedHand[]): RealPlayConceptSignal[] {
  const graph = buildConceptGraph();
  const byConcept = new Map<string, {
    label: string;
    handIds: Set<string>;
    reviewSpotCount: number;
    latestHandAt?: string;
    evidence: Set<string>;
  }>();

  for (const hand of hands) {
    const conceptKeys = new Set<string>();
    for (const match of hand.conceptMatches) {
      conceptKeys.add(match.conceptKey);
      const entry = byConcept.get(match.conceptKey) ?? {
        label: match.label,
        handIds: new Set<string>(),
        reviewSpotCount: 0,
        latestHandAt: hand.playedAt ?? undefined,
        evidence: new Set<string>(),
      };
      entry.label = match.label;
      entry.handIds.add(hand.importedHandId);
      entry.latestHandAt = maxIso(entry.latestHandAt, hand.playedAt ?? undefined);
      entry.evidence.add(match.reason);
      byConcept.set(match.conceptKey, entry);
    }

    for (const spot of hand.reviewSpots) {
      for (const conceptKey of spot.concepts) {
        conceptKeys.add(conceptKey);
        const node = graph.nodes.find((candidate) => candidate.key === conceptKey);
        const entry = byConcept.get(conceptKey) ?? {
          label: node?.label ?? toTitleCase(conceptKey),
          handIds: new Set<string>(),
          reviewSpotCount: 0,
          latestHandAt: hand.playedAt ?? undefined,
          evidence: new Set<string>(),
        };
        entry.handIds.add(hand.importedHandId);
        entry.reviewSpotCount += 1;
        entry.latestHandAt = maxIso(entry.latestHandAt, hand.playedAt ?? undefined);
        entry.evidence.add(spot.reason);
        byConcept.set(conceptKey, entry);
      }
    }

    for (const conceptKey of conceptKeys) {
      const entry = byConcept.get(conceptKey);
      if (entry && hand.playedAt) {
        entry.latestHandAt = maxIso(entry.latestHandAt, hand.playedAt);
      }
    }
  }

  return [...byConcept.entries()]
    .map(([conceptKey, entry]) => ({
      conceptKey,
      label: entry.label,
      occurrences: entry.handIds.size,
      reviewSpotCount: entry.reviewSpotCount,
      weight: round(Math.min(0.32, (entry.handIds.size * 0.08) + (entry.reviewSpotCount * 0.04))),
      recommendedPool: "baseline" as const,
      latestHandAt: entry.latestHandAt,
      evidence: [
        `${entry.handIds.size} imported hand${entry.handIds.size === 1 ? "" : "s"} mapped into this concept.`,
        entry.reviewSpotCount > 0
          ? `${entry.reviewSpotCount} review-worthy real-play decision${entry.reviewSpotCount === 1 ? "" : "s"} are attached here.`
          : "No explicit review spot has been extracted yet, so this is a lighter concept hint.",
        ...[...entry.evidence].slice(0, 2),
      ],
    }))
    .sort((a, b) => b.weight - a.weight || b.occurrences - a.occurrences || a.label.localeCompare(b.label));
}

export function buildRealHandRecommendations(args: {
  hands: ImportedHand[];
  drills: CanonicalDrill[];
  limit?: number;
}): RealHandRecommendation[] {
  const signals = buildRealPlayConceptSignals(args.hands);
  const limit = args.limit ?? 3;

  return signals.slice(0, limit).map((signal) => {
    const supporting = getSupportingConcepts(buildConceptGraph(args.drills), signal.conceptKey)[0];
    const relatedDrills = args.drills
      .filter((drill) => {
        const drillConcepts = new Set<string>();
        for (const tag of drill.tags) {
          for (const conceptKey of mapSignalToConceptKeys(tag)) {
            drillConcepts.add(conceptKey);
          }
        }
        return drillConcepts.has(signal.conceptKey) || (supporting ? drillConcepts.has(supporting.key) : false);
      })
      .slice(0, 3)
      .map((drill) => ({
        drillId: drill.drill_id,
        title: drill.title,
        nodeId: drill.node_id,
      }));

    return {
      conceptKey: signal.conceptKey,
      label: supporting ? `Repair ${supporting.label}` : `Train ${signal.label}`,
      reason: supporting
        ? `${signal.label} is appearing in real hands, but ${supporting.label.toLowerCase()} may be the cleaner upstream repair.`
        : `${signal.label} is appearing in actual imported hands, so it now deserves training priority beyond authored drills alone.`,
      recommendedPool: "baseline",
      relatedDrills,
    };
  });
}

function parseSingleHand(args: {
  rawText: string;
  source: ImportedHandSource;
  importedAt?: Date;
  index: number;
}): ImportedHand {
  const lines = args.rawText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const header = args.rawText.match(HAND_HEADER);

  if (!header) {
    return ImportedHandSchema.parse({
      importedHandId: `imported-hand-${args.index + 1}`,
      sourceHandId: `unsupported-${args.index + 1}`,
      source: args.source,
      parseStatus: "unsupported",
      parserVersion: PARSER_VERSION,
      rawText: args.rawText,
      players: [],
      actions: [],
      conceptMatches: [],
      reviewSpots: [],
      importNotes: ["This hand could not be recognized as PokerStars-style NLHE text."],
    });
  }

  const [, sourceHandId, gameType, playedAtRaw] = header;
  const tableName = args.rawText.match(/Table '([^']+)'/)?.[1] ?? null;
  const stakes = args.rawText.match(/\(([^)]+)\)/)?.[1] ?? null;
  const buttonSeat = Number(args.rawText.match(BUTTON_LINE)?.[1] ?? "0") || null;
  const players = lines
    .map((line) => line.match(SEAT_LINE))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      seat: Number(match[1]),
      name: match[2],
      stackChips: parseMoney(match[3]),
      position: null,
      isHero: false,
      villainLabel: null,
    }));
  const heroLine = lines.map((line) => line.match(HERO_LINE)).find((match): match is RegExpMatchArray => Boolean(match)) ?? null;
  const heroName = heroLine?.[1] ?? null;
  const heroCards = heroLine ? [heroLine[2], heroLine[3]] as [string, string] : null;
  const playersWithPositions = assignPositions(players, buttonSeat, heroName);
  const board = extractBoard(lines);
  const parsedPlayedAt = parsePlayedAt(playedAtRaw);
  const bigBlind = parseBigBlind(stakes);
  const stackValues = playersWithPositions.map((player) => player.stackChips ?? Number.POSITIVE_INFINITY).filter(Number.isFinite);
  const effectiveStackBb = bigBlind && stackValues.length > 0
    ? round(Math.min(...stackValues) / bigBlind)
    : null;
  const actions = extractActions(lines, heroName);
  const notes: string[] = [];
  if (!heroCards) {
    notes.push("Hero hole cards were not present in the import, so blocker-driven interpretation is limited.");
  }
  if (!board) {
    notes.push("Board runout could not be fully reconstructed from the hand history.");
  }

  const conceptMatches = deriveConceptMatches({ heroName, heroCards, board, actions, effectiveStackBb });
  const reviewSpots = deriveReviewSpots({ heroName, heroCards, board, actions, conceptMatches });
  const parseStatus: ImportedHandParseStatus = notes.length > 0 ? "partial" : "parsed";

  return ImportedHandSchema.parse({
    importedHandId: `imported-${sourceHandId}`,
    sourceHandId,
    source: args.source,
    parseStatus,
    parserVersion: PARSER_VERSION,
    rawText: args.rawText,
    tableName,
    gameType,
    stakes,
    playedAt: parsedPlayedAt,
    sessionLabel: tableName,
    heroName,
    heroCards,
    heroPosition: playersWithPositions.find((player) => player.isHero)?.position ?? null,
    board,
    players: playersWithPositions,
    actions,
    effectiveStackBb,
    conceptMatches,
    reviewSpots,
    importNotes: notes,
  });
}

function splitHandHistoryText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  if (!normalized.includes("PokerStars Hand #")) {
    return [normalized];
  }
  return normalized
    .split(/(?=^PokerStars Hand #\d+:)/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function extractBoard(lines: string[]): Board | null {
  let flop: [string, string, string] | null = null;
  let turn: string | null = null;
  let river: string | null = null;

  for (const line of lines) {
    const flopMatch = line.match(/^\*\*\* FLOP \*\*\* \[([2-9TJQKA][shdc]) ([2-9TJQKA][shdc]) ([2-9TJQKA][shdc])\]/);
    if (flopMatch) {
      flop = [flopMatch[1], flopMatch[2], flopMatch[3]];
      continue;
    }
    const turnMatch = line.match(/^\*\*\* TURN \*\*\* \[[^\]]+\] \[([2-9TJQKA][shdc])\]/);
    if (turnMatch) {
      turn = turnMatch[1];
      continue;
    }
    const riverMatch = line.match(/^\*\*\* RIVER \*\*\* \[[^\]]+\] \[([2-9TJQKA][shdc])\]/);
    if (riverMatch) {
      river = riverMatch[1];
    }
  }

  if (!flop) {
    return null;
  }

  return BoardSchema.parse({ flop, turn, river });
}

function extractActions(lines: string[], heroName: string | null): ImportedHandAction[] {
  const actions: ImportedHandAction[] = [];
  let street: ImportedHandStreet = "preflop";

  for (const line of lines) {
    if (line.startsWith("*** FLOP ***")) {
      street = "flop";
      continue;
    }
    if (line.startsWith("*** TURN ***")) {
      street = "turn";
      continue;
    }
    if (line.startsWith("*** RIVER ***")) {
      street = "river";
      continue;
    }
    if (line.startsWith("*** SHOW DOWN ***")) {
      street = "showdown";
      continue;
    }
    if (line.startsWith("*** SUMMARY ***")) {
      street = "summary";
      continue;
    }
    if (line.startsWith("Seat ") || line.startsWith("PokerStars Hand #") || line.startsWith("Table '") || line.startsWith("Dealt to ")) {
      continue;
    }

    const action = parseActionLine(line, street, heroName);
    if (action) {
      actions.push(ImportedHandActionSchema.parse(action));
    }
  }

  return actions;
}

function parseActionLine(
  line: string,
  street: ImportedHandStreet,
  heroName: string | null
): ImportedHandAction | null {
  const blindMatch = line.match(/^(.+?): posts (small blind|big blind|ante) \$?([\d.,]+)/);
  if (blindMatch) {
    return {
      street,
      actor: blindMatch[1],
      action: "post_blind",
      amountChips: parseMoney(blindMatch[3]),
      isHero: blindMatch[1] === heroName,
      raw: line,
    };
  }

  const raiseMatch = line.match(/^(.+?): raises \$?([\d.,]+) to \$?([\d.,]+)/);
  if (raiseMatch) {
    return {
      street,
      actor: raiseMatch[1],
      action: "raise",
      amountChips: parseMoney(raiseMatch[2]),
      amountToChips: parseMoney(raiseMatch[3]),
      isHero: raiseMatch[1] === heroName,
      raw: line,
    };
  }

  const singleAmountPatterns: Array<[RegExp, ImportedHandActionType]> = [
    [/^(.+?): calls \$?([\d.,]+)/, "call"],
    [/^(.+?): bets \$?([\d.,]+)/, "bet"],
    [/^(.+?) collected \$?([\d.,]+) from pot/, "collect"],
  ];
  for (const [pattern, action] of singleAmountPatterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        street,
        actor: match[1],
        action,
        amountChips: parseMoney(match[2]),
        isHero: match[1] === heroName,
        raw: line,
      };
    }
  }

  const noAmountPatterns: Array<[RegExp, ImportedHandActionType]> = [
    [/^(.+?): folds/, "fold"],
    [/^(.+?): checks/, "check"],
    [/^(.+?): shows \[[^\]]+\]/, "show"],
    [/^(.+?): mucks hand/, "muck"],
  ];
  for (const [pattern, action] of noAmountPatterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        street,
        actor: match[1],
        action,
        isHero: match[1] === heroName,
        raw: line,
      };
    }
  }

  const genericActor = line.match(/^(.+?):/);
  if (!genericActor) {
    return null;
  }

  return {
    street,
    actor: genericActor[1],
    action: "unknown",
    isHero: genericActor[1] === heroName,
    raw: line,
  };
}

function deriveConceptMatches(args: {
  heroName: string | null;
  heroCards: [string, string] | null;
  board: Board | null;
  actions: ImportedHandAction[];
  effectiveStackBb: number | null;
}): ImportedHandConceptMatch[] {
  const matches = new Map<string, ImportedHandConceptMatch>();
  const heroActions = args.actions.filter((action) => action.isHero && ["flop", "turn", "river"].includes(action.street));
  const preflopAggressor = [...args.actions].reverse().find((action) => action.street === "preflop" && action.action === "raise")?.actor ?? null;

  if (args.board) {
    if (completesFlush(args.board, "turn") || completesFlush(args.board, "river") || hasFourLiner(args.board)) {
      pushConcept(matches, {
        conceptKey: "board_connectivity",
        label: "Board Connectivity",
        confidence: "known",
        source: "board_texture",
        reason: "The imported runout materially changes board texture, so board-read quality matters here.",
      });
    }
    if (args.board.river && /[AKQ]/.test(args.board.river[0])) {
      pushConcept(matches, {
        conceptKey: "scare_card_pressure",
        label: "Scare Card Pressure",
        confidence: "inferred",
        source: "street_transition",
        reason: "A high-leverage river card arrived, so scare-card interpretation is a plausible teaching theme.",
      });
    }
  }

  for (const action of heroActions) {
    const facing = findPreviousAggression(args.actions, action);
    
    if (action.street === "turn" && facing) {
      pushConcept(matches, {
        conceptKey: "turn_defense",
        label: "Turn Defense",
        confidence: "known",
        source: "hero_decision",
        reason: "Hero faced turn pressure in real play, so turn-defense logic is directly involved.",
      });
    }

    if (action.street === "river" && facing) {
      pushConcept(matches, {
        conceptKey: "river_defense",
        label: "River Defense",
        confidence: "known",
        source: "hero_decision",
        reason: "Hero reached a river decision facing aggression, which is a direct river-defense spot.",
      });
      pushConcept(matches, {
        conceptKey: "bluff_catching",
        label: "Bluff Catching",
        confidence: "inferred",
        source: "hero_decision",
        reason: "A river call-or-fold decision against pressure is a likely bluff-catching review spot.",
      });
      if (args.heroCards) {
        pushConcept(matches, {
          conceptKey: "blocker_effects",
          label: "Blocker Effects",
          confidence: "inferred",
          source: "hero_decision",
          reason: "Hero hole cards are known, so blocker interpretation can be reviewed honestly in this river spot.",
        });
      }
    }

    if (action.street === "flop" && preflopAggressor && preflopAggressor === args.heroName && (action.action === "bet" || action.action === "raise")) {
      pushConcept(matches, {
        conceptKey: "cbetting",
        label: "C-Betting",
        confidence: "known",
        source: "hero_decision",
        reason: "Hero was the preflop aggressor and bet the flop, so this is a genuine c-bet context.",
      });
      pushConcept(matches, {
        conceptKey: "range_advantage",
        label: "Range Advantage",
        confidence: "inferred",
        source: "hero_decision",
        reason: "Flop c-bets are often driven by range ownership, so range advantage is a plausible concept match here.",
      });
    }

    if ((action.action === "bet" || action.action === "raise") && looksLikeLeverage(action, args.effectiveStackBb)) {
      pushConcept(matches, {
        conceptKey: action.street === "river" ? "value_targeting" : "leverage",
        label: action.street === "river" ? "Value Targeting" : "Leverage",
        confidence: "inferred",
        source: "bet_sizing",
        reason: "A large real-play sizing appeared, so leverage or value-targeting deserves review even without solver certainty.",
      });
      if (action.street === "turn" || action.street === "river") {
        pushConcept(matches, {
          conceptKey: "polarization",
          label: "Polarization",
          confidence: "inferred",
          source: "bet_sizing",
          reason: "Large late-street sizing often implies a polarized story, so polarization is a fair concept hint here.",
        });
      }
    }
  }

  return z.array(ImportedHandConceptMatchSchema).parse([...matches.values()]);
}

function deriveReviewSpots(args: {
  heroName: string | null;
  heroCards: [string, string] | null;
  board: Board | null;
  actions: ImportedHandAction[];
  conceptMatches: ImportedHandConceptMatch[];
}): ImportedHandReviewSpot[] {
  const spots: ImportedHandReviewSpot[] = [];
  const conceptKeys = new Set(args.conceptMatches.map((match) => match.conceptKey));

  args.actions.forEach((action, index) => {
    if (!action.isHero || !["flop", "turn", "river"].includes(action.street)) {
      return;
    }

    const decisionStreet = action.street as "flop" | "turn" | "river";
    const facing = findPreviousAggression(args.actions, action);
    
    if (facing) {
      const concepts = action.street === "river"
        ? ["river_defense", "bluff_catching", ...(args.heroCards ? ["blocker_effects"] : [])]
        : action.street === "turn"
          ? ["turn_defense", "polarization"]
          : ["cbetting"];
      spots.push({
        spotId: `${decisionStreet}-${index}`,
        street: decisionStreet,
        actor: action.actor,
        kind: "hero_decision",
        summary: `${toTitleCase(action.street)} decision for ${action.actor}`,
        reason: `Hero faced real-play pressure on the ${action.street}. This is review-worthy, but still an inferred coaching spot rather than a solver verdict.`,
        confidence: "known",
        concepts: concepts.filter((concept) => conceptKeys.has(concept) || ["river_defense", "turn_defense", "cbetting"].includes(concept)),
        actionIndex: index,
        evidence: [facing.raw, action.raw],
      });
    }

    if (args.board && decisionStreet !== "flop" && (completesFlush(args.board, decisionStreet as "turn" | "river") || hasFourLiner(args.board))) {
      const textureConcepts = ["board_connectivity", "scare_card_pressure"].filter((concept) => conceptKeys.has(concept));
      if (textureConcepts.length > 0) {
        spots.push({
          spotId: `${decisionStreet}-texture-${index}`,
          street: decisionStreet,
          actor: action.actor,
          kind: "street_inflection",
          summary: `${toTitleCase(action.street)} texture shift`,
          reason: "The board texture changed sharply before hero acted, so the coaching value is in reviewing what changed by street.",
          confidence: "inferred",
          concepts: textureConcepts,
          actionIndex: index,
          evidence: [action.raw],
        });
      }
    }
  });

  const showdownIndex = args.actions.findIndex((action) => action.street === "showdown" && action.action === "show");
  if (showdownIndex >= 0) {
    const showdown = args.actions[showdownIndex];
    spots.push({
      spotId: `showdown-${showdownIndex}`,
      street: "river",
      actor: showdown.actor,
      kind: "showdown_reveal",
      summary: "Showdown context available",
      reason: "The hand reached showdown, so the final line can be reviewed with more truth than a pure fold-before-showdown hand.",
      confidence: "inferred",
      concepts: [...conceptKeys].slice(0, 3),
      actionIndex: showdownIndex,
      evidence: [showdown.raw],
    });
  }

  return z.array(ImportedHandReviewSpotSchema).parse(spots.filter((spot) => spot.concepts.length > 0));
}

function assignPositions(
  players: Array<{ seat: number; name: string; stackChips: number | null; position: null; isHero: boolean; villainLabel: null }>,
  buttonSeat: number | null,
  heroName: string | null
) {
  const sortedSeats = [...players].sort((a, b) => a.seat - b.seat);
  if (!buttonSeat) {
    return sortedSeats.map((player) => ({
      ...player,
      isHero: player.name === heroName,
      position: null,
      villainLabel: player.name === heroName ? null : `Seat ${player.seat}`,
    }));
  }

  const ordered = [...sortedSeats]
    .sort((a, b) => seatDistance(a.seat, buttonSeat) - seatDistance(b.seat, buttonSeat));
  const labels = positionLabelsForCount(ordered.length);
  const bySeat = new Map<number, string | null>();
  ordered.forEach((player, index) => {
    bySeat.set(player.seat, labels[index] ?? null);
  });

  return sortedSeats.map((player) => ({
    ...player,
    isHero: player.name === heroName,
    position: bySeat.get(player.seat) ?? null,
    villainLabel: player.name === heroName ? null : `Seat ${player.seat}${bySeat.get(player.seat) ? ` • ${bySeat.get(player.seat)}` : ""}`,
  }));
}

function findPreviousAggression(actions: ImportedHandAction[], heroAction: ImportedHandAction): ImportedHandAction | null {
  const heroIndex = actions.indexOf(heroAction);
  for (let index = heroIndex - 1; index >= 0; index -= 1) {
    const candidate = actions[index];
    if (candidate.street !== heroAction.street) {
      break;
    }
    if (!candidate.isHero && (candidate.action === "bet" || candidate.action === "raise")) {
      return candidate;
    }
  }
  return null;
}

function looksLikeLeverage(action: ImportedHandAction, effectiveStackBb: number | null): boolean {
  if ((action.amountToChips ?? action.amountChips ?? 0) === 0) {
    return false;
  }
  if (effectiveStackBb && (action.amountToChips ?? action.amountChips ?? 0) >= effectiveStackBb * 0.2) {
    return true;
  }
  return (action.amountToChips ?? action.amountChips ?? 0) >= 12;
}

function completesFlush(board: Board, street: "turn" | "river"): boolean {
  const cards = street === "turn"
    ? [...board.flop, board.turn].filter((card): card is string => Boolean(card))
    : [...board.flop, board.turn, board.river].filter((card): card is string => Boolean(card));
  const suitCounts = new Map<string, number>();
  for (const card of cards) {
    suitCounts.set(card[1], (suitCounts.get(card[1]) ?? 0) + 1);
  }
  return [...suitCounts.values()].some((count) => count >= 3);
}

function hasFourLiner(board: Board): boolean {
  const cards = [...board.flop, board.turn, board.river].filter((card): card is string => Boolean(card)).map((card) => rankValue(card[0]));
  const unique = [...new Set(cards)].sort((a, b) => a - b);
  if (unique.includes(14)) {
    unique.unshift(1);
  }
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] === unique[index - 1] + 1) {
      run += 1;
      if (run >= 4) {
        return true;
      }
    } else {
      run = 1;
    }
  }
  return false;
}

function positionLabelsForCount(count: number): Array<string | null> {
  const mapping: Record<number, Array<string | null>> = {
    2: ["BTN/SB", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["BTN", "SB", "BB", "CO"],
    5: ["BTN", "SB", "BB", "UTG", "CO"],
    6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  };
  return mapping[count] ?? new Array(count).fill(null);
}

function pushConcept(map: Map<string, ImportedHandConceptMatch>, match: ImportedHandConceptMatch): void {
  if (!map.has(match.conceptKey)) {
    map.set(match.conceptKey, ImportedHandConceptMatchSchema.parse(match));
  }
}

function parseMoney(value: string): number {
  return Number.parseFloat(value.replace(/[$,]/g, ""));
}

function parseBigBlind(stakes: string | null): number | null {
  if (!stakes) {
    return null;
  }
  const match = stakes.match(/\$?([\d.]+)\/\$?([\d.]+)/);
  return match ? Number.parseFloat(match[2]) : null;
}

function parsePlayedAt(value: string): string | null {
  const normalized = value.replace(/\//g, "-").replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function seatDistance(seat: number, buttonSeat: number): number {
  return seat >= buttonSeat ? seat - buttonSeat : seat + 10 - buttonSeat;
}

function rankValue(rank: string): number {
  return ({ T: 10, J: 11, Q: 12, K: 13, A: 14 }[rank] ?? Number.parseInt(rank, 10));
}

function maxIso(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}





