import {
  getAllImportedHands,
  getRecentHandImports,
  insertHandImport,
  insertImportedHand,
  openDatabase,
  type HandImportRow,
} from "../../../../packages/db/src/index";
import { z } from "zod";
import {
  CardSchema,
  ImportedHandConceptMatchSchema,
  ImportedHandReviewSpotSchema,
  ImportedHandSchema,
  parseImportedHandsText,
  type ImportedHand,
  type ImportedHandSource,
} from "@poker-coach/core/browser";
import { resolveDbPath } from "./local-study-data";

export interface PersistedHandImportSummary {
  importId: string;
  source: string;
  status: HandImportRow["status"];
  totalHands: number;
  parsedHands: number;
  unsupportedHands: number;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export const ManualLiveHandInputSchema = z.object({
  tableName: z.string().trim().min(1).optional(),
  stakes: z.string().trim().min(1).optional(),
  playedAt: z.string().datetime().optional(),
  heroName: z.string().trim().min(1).optional(),
  heroPosition: z.string().trim().min(1),
  villainPosition: z.string().trim().min(1).optional(),
  heroCards: z.tuple([CardSchema, CardSchema]),
  effectiveStackBb: z.number().positive().optional(),
  memoryConfidence: z.enum(["high", "medium", "low"]).default("medium"),
  flop: z.tuple([CardSchema, CardSchema, CardSchema]),
  turn: CardSchema.optional(),
  river: CardSchema.optional(),
  turnSummary: z.string().trim().min(1).optional(),
  turnLineCategory: z.enum([
    "unclear",
    "check_through",
    "faced_bet_call",
    "faced_bet_fold",
    "hero_probe_called",
    "hero_probe_raised",
    "hero_bet_called",
    "hero_bet_raised",
  ]).default("unclear"),
  turnSizeBucket: z.enum(["unknown", "small", "medium", "large", "polar"]).default("unknown"),
  riverSummary: z.string().trim().min(1).optional(),
  riverFacingAction: z.enum(["bet", "raise", "check"]).default("bet"),
  riverSizePctPot: z.number().positive().max(500).optional(),
  riverSizeBucket: z.enum(["unknown", "small", "medium", "large", "polar"]).default("medium"),
  note: z.string().trim().min(1).optional(),
});
export type ManualLiveHandInput = z.infer<typeof ManualLiveHandInputSchema>;

function resolveWritableDbPath(): string {
  return resolveDbPath() ?? ".local/coach.db";
}

export function hydrateImportedHandRow(row: {
  structured_json: string;
}): ImportedHand {
  return ImportedHandSchema.parse(JSON.parse(row.structured_json));
}

export function loadPersistedRealHands(): {
  hands: ImportedHand[];
  imports: PersistedHandImportSummary[];
} {
  const db = openDatabase(resolveWritableDbPath());
  try {
    return {
      hands: getAllImportedHands(db).map((row) => hydrateImportedHandRow(row)),
      imports: getRecentHandImports(db).map((row) => ({
        importId: row.import_id,
        source: row.source,
        status: row.status,
        totalHands: row.total_hands,
        parsedHands: row.parsed_hands,
        unsupportedHands: row.unsupported_hands,
        notes: JSON.parse(row.notes_json) as string[],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  } finally {
    db.close();
  }
}

export function persistImportedHandText(args: {
  text: string;
  source: ImportedHandSource;
  importedAt?: Date;
}) {
  const now = (args.importedAt ?? new Date()).toISOString();
  const importId = `hand-import-${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const batch = parseImportedHandsText({ text: args.text, source: args.source, importedAt: args.importedAt });
  const parsedHands = batch.hands.filter((hand) => hand.parseStatus !== "unsupported").length;
  const unsupportedHands = batch.hands.filter((hand) => hand.parseStatus === "unsupported").length;
  const status = unsupportedHands === 0 ? "completed" : parsedHands > 0 ? "partial" : "failed";

  const db = openDatabase(resolveWritableDbPath());
  try {
    insertHandImport(db, {
      import_id: importId,
      source: args.source,
      status,
      total_hands: batch.hands.length,
      parsed_hands: parsedHands,
      unsupported_hands: unsupportedHands,
      notes_json: JSON.stringify(batch.importNotes),
      created_at: now,
      updated_at: now,
    });

    for (const hand of batch.hands) {
      insertImportedHand(db, {
        imported_hand_id: hand.importedHandId,
        import_id: importId,
        source_hand_id: hand.sourceHandId,
        source: hand.source,
        parse_status: hand.parseStatus,
        parser_version: hand.parserVersion,
        hero_name: hand.heroName ?? null,
        hero_position: hand.heroPosition ?? null,
        played_at: hand.playedAt ?? null,
        session_label: hand.sessionLabel ?? null,
        stakes: hand.stakes ?? null,
        table_name: hand.tableName ?? null,
        effective_stack_bb: hand.effectiveStackBb ?? null,
        raw_text: hand.rawText,
        structured_json: JSON.stringify(hand),
        concept_matches_json: JSON.stringify(hand.conceptMatches),
        review_spots_json: JSON.stringify(hand.reviewSpots),
        created_at: now,
      });
    }
  } finally {
    db.close();
  }

  return {
    importId,
    status,
    totalHands: batch.hands.length,
    parsedHands,
    unsupportedHands,
    notes: batch.importNotes,
    hands: batch.hands,
  };
}

export function createManualImportedHand(args: {
  input: ManualLiveHandInput;
  importedAt?: Date;
}): ImportedHand {
  const input = ManualLiveHandInputSchema.parse(args.input);
  const importedAt = args.importedAt ?? new Date();
  const now = importedAt.toISOString();
  const handIdSuffix = now.replace(/[^0-9]/g, "").slice(0, 14);
  const conceptMatches = buildManualConceptMatches(input);
  const reviewSpots = buildManualReviewSpots(input, conceptMatches);
  const rawText = buildManualRawText(input);

  return ImportedHandSchema.parse({
    importedHandId: `manual-${handIdSuffix}`,
    sourceHandId: `manual-${handIdSuffix}`,
    source: "manual",
    parseStatus: "partial",
    parserVersion: "manual_live_reconstruction_v1",
    rawText,
    tableName: input.tableName ?? "Live Reconstruction",
    gameType: "Live NLHE Cash",
    stakes: input.stakes ?? null,
    playedAt: input.playedAt ?? now,
    sessionLabel: input.tableName ?? "Live Reconstruction",
    heroName: input.heroName ?? "Hero",
    heroCards: input.heroCards,
    heroPosition: input.heroPosition,
    board: {
      flop: input.flop,
      turn: input.turn ?? null,
      river: input.river ?? null,
    },
    players: [],
    actions: [],
    effectiveStackBb: input.effectiveStackBb ?? null,
    conceptMatches,
    reviewSpots,
    importNotes: [
      "This hand was reconstructed manually from live-play memory, so exact sizing may be approximate.",
      `Memory confidence: ${input.memoryConfidence}.`,
      ...(input.note ? [input.note] : []),
    ],
  });
}

export function persistManualLiveHand(args: {
  input: ManualLiveHandInput;
  importedAt?: Date;
}) {
  const importedAt = args.importedAt ?? new Date();
  const now = importedAt.toISOString();
  const importId = `hand-import-manual-${now.replace(/[^0-9]/g, "").slice(0, 14)}`;
  const hand = createManualImportedHand({ input: args.input, importedAt });

  const db = openDatabase(resolveWritableDbPath());
  try {
    insertHandImport(db, {
      import_id: importId,
      source: "manual",
      status: "completed",
      total_hands: 1,
      parsed_hands: 1,
      unsupported_hands: 0,
      notes_json: JSON.stringify(hand.importNotes),
      created_at: now,
      updated_at: now,
    });

    insertImportedHand(db, {
      imported_hand_id: hand.importedHandId,
      import_id: importId,
      source_hand_id: hand.sourceHandId,
      source: hand.source,
      parse_status: hand.parseStatus,
      parser_version: hand.parserVersion,
      hero_name: hand.heroName ?? null,
      hero_position: hand.heroPosition ?? null,
      played_at: hand.playedAt ?? null,
      session_label: hand.sessionLabel ?? null,
      stakes: hand.stakes ?? null,
      table_name: hand.tableName ?? null,
      effective_stack_bb: hand.effectiveStackBb ?? null,
      raw_text: hand.rawText,
      structured_json: JSON.stringify(hand),
      concept_matches_json: JSON.stringify(hand.conceptMatches),
      review_spots_json: JSON.stringify(hand.reviewSpots),
      created_at: now,
    });
  } finally {
    db.close();
  }

  return {
    importId,
    status: "completed" as const,
    totalHands: 1,
    parsedHands: 1,
    unsupportedHands: 0,
    notes: hand.importNotes,
    hands: [hand],
  };
}

function buildManualConceptMatches(input: ManualLiveHandInput) {
  const concepts = [
    (input.turnSummary || input.turnLineCategory !== "unclear") ? ImportedHandConceptMatchSchema.parse({
      conceptKey: "street_transition",
      label: "Street Transition",
      confidence: "inferred",
      source: "street_transition",
      reason: "The turn decision is remembered approximately, but the line family is clear enough to shape the river range story.",
    }) : null,
    input.river && /[AKQ]/.test(input.river[0]) ? ImportedHandConceptMatchSchema.parse({
      conceptKey: "scare_card_pressure",
      label: "Scare Card Pressure",
      confidence: "inferred",
      source: "street_transition",
      reason: "A high-leverage river card arrived in a manually reconstructed live hand.",
    }) : null,
    ImportedHandConceptMatchSchema.parse({
      conceptKey: "river_defense",
      label: "River Defense",
      confidence: "known",
      source: "hero_decision",
      reason: "The reconstructed hand ends with a clear river call-or-fold decision facing aggression.",
    }),
    ImportedHandConceptMatchSchema.parse({
      conceptKey: "bluff_catching",
      label: "Bluff Catching",
      confidence: "inferred",
      source: "hero_decision",
      reason: "This memory-based reconstruction still clearly belongs to a river bluff-catching family.",
    }),
    ImportedHandConceptMatchSchema.parse({
      conceptKey: "blocker_effects",
      label: "Blocker Effects",
      confidence: "inferred",
      source: "hero_decision",
      reason: "Hero hole cards are known, so blocker logic is still trainable even if exact sizing is approximate.",
    }),
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const unique = new Map(concepts.map((match) => [match.conceptKey, match]));
  return [...unique.values()];
}

function buildManualReviewSpots(input: ManualLiveHandInput, conceptMatches: ReturnType<typeof buildManualConceptMatches>) {
  const concepts = conceptMatches.map((match) => match.conceptKey);
  const evidence = [input.turnSummary, input.riverSummary, input.note].filter((value): value is string => Boolean(value));
  const turnLineLabel = formatTurnLineCategory(input.turnLineCategory);

  return [
    ImportedHandReviewSpotSchema.parse({
      spotId: "manual-river-decision",
      street: "river",
      actor: input.heroName ?? "Hero",
      kind: "hero_decision",
      summary: "Manual live-hand river decision",
      reason: "The exact live sizing may be approximate, but the river bluff-catch family is still clear enough to train honestly.",
      confidence: "known",
      concepts: concepts.filter((concept) => ["river_defense", "bluff_catching", "blocker_effects"].includes(concept)),
      evidence,
    }),
    (input.turnSummary || input.turnLineCategory !== "unclear") ? ImportedHandReviewSpotSchema.parse({
      spotId: "manual-turn-inflection",
      street: "turn",
      actor: input.heroName ?? "Hero",
      kind: "street_inflection",
      summary: "Manual turn-to-river range shift",
      reason: turnLineLabel === "Unclear"
        ? "The turn memory is approximate, but it still narrows what value and bluff regions arrive by river."
        : `The remembered turn line (${turnLineLabel}) is approximate, but it still narrows what value and bluff regions arrive by river.`,
      confidence: "inferred",
      concepts: concepts.filter((concept) => concept === "street_transition" || concept === "scare_card_pressure"),
      evidence: turnLineLabel === "Unclear" ? evidence : [`Turn line family: ${turnLineLabel}`, ...evidence],
    }) : null,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));
}

function buildManualRawText(input: ManualLiveHandInput) {
  return [
    `Manual live reconstruction: ${input.tableName ?? "Live hand"}`,
    `Hero: ${input.heroName ?? "Hero"} (${input.heroPosition}) with ${input.heroCards.join(" ")}`,
    `Villain position: ${input.villainPosition ?? "Unknown"}`,
    `Memory confidence: ${input.memoryConfidence}`,
    `Board: ${input.flop.join(" ")}${input.turn ? ` ${input.turn}` : ""}${input.river ? ` ${input.river}` : ""}`,
    `Turn line family: ${formatTurnLineCategory(input.turnLineCategory)}`,
    `Turn size bucket: ${input.turnSizeBucket}`,
    input.turnSummary ? `Turn memory (${input.turnSizeBucket}): ${input.turnSummary}` : null,
    `River size bucket: ${input.riverSizeBucket}`,
    input.riverSummary ? `River memory (${input.riverFacingAction}, ${input.riverSizeBucket}${input.riverSizePctPot ? `, ~${input.riverSizePctPot}% pot` : ""}): ${input.riverSummary}` : null,
    input.note ? `Why this matters: ${input.note}` : null,
  ].filter((value): value is string => Boolean(value)).join("\n");
}

function formatTurnLineCategory(value: ManualLiveHandInput["turnLineCategory"]): string {
  switch (value) {
    case "check_through":
      return "Check-through";
    case "faced_bet_call":
      return "Faced turn bet and called";
    case "faced_bet_fold":
      return "Faced turn bet and folded";
    case "hero_probe_called":
      return "Hero probed turn and got called";
    case "hero_probe_raised":
      return "Hero probed turn and got raised";
    case "hero_bet_called":
      return "Hero bet turn and got called";
    case "hero_bet_raised":
      return "Hero bet turn and got raised";
    default:
      return "Unclear";
  }
}

