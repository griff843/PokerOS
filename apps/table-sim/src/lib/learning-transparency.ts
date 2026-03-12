import type { TableSimDrill } from "./drill-schema";
import type { DrillAttempt } from "./session-types";
import { parseCard, suitSymbol } from "../components/card/card-utils";

export const REPLAY_STREETS = ["preflop", "flop", "turn", "river"] as const;
export type ReplayStreet = (typeof REPLAY_STREETS)[number];

export interface TransparencyHistoryLine {
  street: ReplayStreet;
  label: string;
  summary: string;
  board?: string;
  detail?: string;
  availability: "structured" | "partial";
  isDecisionStreet: boolean;
}

export interface TransparencyFrequencyItem {
  action: string;
  label: string;
  frequency: number;
  preferred: boolean;
  chosen: boolean;
}

export interface TransparencyFrequencyView {
  available: boolean;
  headline: string;
  detail: string;
  items: TransparencyFrequencyItem[];
}

export interface TransparencyVerdictView {
  badge: string;
  headline: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
}

export interface TransparencyRangeBucket {
  label: string;
  combos: string[];
  note?: string;
  frequencyHint?: string;
}

export interface TransparencyRangeSection {
  title: string;
  buckets: TransparencyRangeBucket[];
}

export interface TransparencyRangeSpotlight {
  label: string;
  summary: string;
  note?: string;
}

export interface TransparencyRangeView {
  title: string;
  subtitle: string;
  points: string[];
  sections: TransparencyRangeSection[];
  handFocus?: TransparencyRangeSpotlight;
  blockerNotes: string[];
  thresholdNotes: string[];
  available: boolean;
}

export interface TransparencyDiagnosisView {
  available: boolean;
  headline: string;
  detail: string;
  nextFocus?: string;
  tags: string[];
}

export interface TransparencySnapshot {
  streets: ReplayStreet[];
  decisionStreet: ReplayStreet;
  history: TransparencyHistoryLine[];
  frequencies: TransparencyFrequencyView;
  verdict: TransparencyVerdictView;
  rangeView: TransparencyRangeView;
  diagnosis: TransparencyDiagnosisView;
}

export function buildTransparencySnapshot(attempt: DrillAttempt): TransparencySnapshot {
  return {
    streets: getReplayStreets(attempt.drill),
    decisionStreet: getDecisionStreet(attempt.drill),
    history: buildHistoryLines(attempt.drill),
    frequencies: buildFrequencyView(attempt),
    verdict: buildVerdictView(attempt),
    rangeView: buildRangeView(attempt),
    diagnosis: buildDiagnosisView(attempt),
  };
}

export function getReplayStreets(drill: TableSimDrill): ReplayStreet[] {
  const boardByStreet = buildBoardByStreet(drill);
  const streets: ReplayStreet[] = ["preflop"];

  for (const street of REPLAY_STREETS.slice(1)) {
    if (boardByStreet[street] || streetIndex(street) <= streetIndex(getDecisionStreet(drill))) {
      streets.push(street);
    }
  }

  return streets;
}

export function getDecisionStreet(drill: TableSimDrill): ReplayStreet {
  return drill.decision_point.street;
}

export function getVisibleBoardCards(drill: TableSimDrill, street: ReplayStreet): string[] {
  const boardByStreet = buildBoardByStreet(drill);
  return boardByStreet[street] ?? [];
}

export function buildHistoryLines(drill: TableSimDrill): TransparencyHistoryLine[] {
  const boardByStreet = buildBoardByStreet(drill);
  const groupedActions = new Map<ReplayStreet, string[]>();
  const streetNotes = buildStreetNoteMap(drill);
  const stepByStreet = buildStepMap(drill);

  for (const step of drill.scenario.action_history) {
    const street = step.street as ReplayStreet;
    const size = step.size_pct_pot
      ? ` ${step.size_pct_pot}% pot`
      : step.size_bb
        ? ` ${step.size_bb}bb`
        : "";
    const line = `${step.player} ${step.action.toLowerCase()}${size}`;
    groupedActions.set(street, [...(groupedActions.get(street) ?? []), line]);
  }

  const decisionStreet = getDecisionStreet(drill);

  return getReplayStreets(drill).map((street) => {
    const actions = groupedActions.get(street) ?? [];
    const board = boardByStreet[street];
    const boardLabel = board && board.length > 0 ? formatBoard(board) : undefined;
    const authoredDetail = streetNotes.get(street) ?? stepByStreet.get(street)?.prompt;

    if (actions.length > 0) {
      return {
        street,
        label: formatStreet(street),
        board: boardLabel,
        summary: actions.join(" / "),
        detail: authoredDetail,
        availability: "structured" as const,
        isDecisionStreet: street === decisionStreet,
      };
    }

    if (street === "preflop") {
      return {
        street,
        label: "Preflop",
        summary: `${drill.scenario.pot_type} setup, ${drill.scenario.villain_position} vs ${drill.scenario.hero_position}`,
        detail: authoredDetail ?? "Exact preflop action order was not published for this drill.",
        availability: "partial" as const,
        isDecisionStreet: street === decisionStreet,
      };
    }

    if (street === decisionStreet && drill.decision_point.facing) {
      return {
        street,
        label: formatStreet(street),
        board: boardLabel,
        summary: `Facing ${formatFacing(drill.decision_point.facing.action, drill.decision_point.facing.size_pct_pot ?? null, drill.decision_point.facing.size_bb ?? null)}`,
        detail: authoredDetail ?? "Street runout is available, but the prior action sequence was not published.",
        availability: "partial" as const,
        isDecisionStreet: true,
      };
    }

    return {
      street,
      label: formatStreet(street),
      board: boardLabel,
      summary: boardLabel ? "Board progression only" : "Street context only",
      detail: authoredDetail ?? "This drill exposes the runout here, but not the full street action.",
      availability: "partial" as const,
      isDecisionStreet: street === decisionStreet,
    };
  });
}

function buildFrequencyView(attempt: DrillAttempt): TransparencyFrequencyView {
  const items = (attempt.resolvedAnswer.strategy_mix ?? [])
    .map((entry) => ({
      action: entry.action,
      label: formatAction(entry.action, entry.size_bucket ?? null, entry.label),
      frequency: entry.frequency_pct,
      preferred: false,
      chosen: isMatchingAction(attempt.userAction, attempt.userSizeBucket, entry.action, entry.size_bucket ?? null),
    }))
    .sort((a, b) => b.frequency - a.frequency || a.label.localeCompare(b.label));

  if (items.length === 0) {
    return {
      available: false,
      headline: "Solver frequencies unavailable",
      detail: "This drill publishes a resolved line, but not the underlying action mix yet.",
      items: [],
    };
  }

  const preferredFrequency = items[0]?.frequency ?? 0;
  for (const item of items) {
    item.preferred = item.frequency === preferredFrequency;
  }

  const mixed = items.filter((item) => item.frequency > 0).length > 1 && preferredFrequency < 90;

  return {
    available: true,
    headline: mixed ? "Mixed strategy spot" : "Published solver mix",
    detail: mixed
      ? `${items[0]?.label ?? "The top line"} leads, but the baseline still mixes multiple actions here.`
      : `${items[0]?.label ?? "The top line"} carries nearly all of the published frequency.`,
    items,
  };
}

function buildVerdictView(attempt: DrillAttempt): TransparencyVerdictView {
  const frequencyView = buildFrequencyView(attempt);

  if (!frequencyView.available) {
    return attempt.correct
      ? {
          badge: "Resolved line",
          headline: "You landed on the published answer.",
          detail: "This drill currently resolves to a single line, so the review should stay anchored on why that action works.",
          tone: "good",
        }
      : {
          badge: "Needs work",
          headline: "Your line missed the published answer.",
          detail: "There is no published frequency mix here yet, so this is best treated as a direct line miss rather than a mixed-strategy deviation.",
          tone: "warning",
        };
  }

  const preferred = frequencyView.items[0];
  const chosen = frequencyView.items.find((item) => item.chosen);
  const chosenFrequency = chosen?.frequency ?? 0;

  if (chosenFrequency === 0 && (preferred?.frequency ?? 0) >= 90) {
    return {
      badge: "Pure miss",
      headline: `${preferred?.label ?? "The preferred line"} dominates this node.`,
      detail: `Your action was outside the published mix, so this is a real mistake rather than a minor mixed-strategy leak.`,
      tone: "warning",
    };
  }

  if (chosen && chosenFrequency > 0 && chosenFrequency < (preferred?.frequency ?? 0)) {
    return {
      badge: "Lower-frequency line",
      headline: "You chose a valid minority branch.",
      detail: `Mixed strategy spot: the published baseline prefers ${preferred?.label ?? "the top line"} ${formatPct(preferred?.frequency ?? 0)} over ${chosen.label} ${formatPct(chosenFrequency)}.`,
      tone: attempt.correct ? "neutral" : "warning",
    };
  }

  if ((preferred?.frequency ?? 0) < 90) {
    return {
      badge: "Mixed strategy",
      headline: "This node is mixed, not all-or-nothing.",
      detail: `The top branch is ${preferred?.label ?? "the preferred line"} ${formatPct(preferred?.frequency ?? 0)}, but other actions still appear in the published baseline.`,
      tone: attempt.correct ? "good" : "neutral",
    };
  }

  return {
    badge: attempt.correct ? "Preferred line" : "Needs work",
    headline: attempt.correct
      ? "You found the dominant branch."
      : `${preferred?.label ?? "The preferred line"} is the clear baseline action.`,
    detail: attempt.correct
      ? `This spot is close to pure in the published mix, so the key value is understanding why the line is so concentrated.`
      : `The published mix is heavily concentrated, so the miss should be treated as a clean correction rather than a soft mixed-strategy spot.`,
    tone: attempt.correct ? "good" : "warning",
  };
}

function buildRangeView(attempt: DrillAttempt): TransparencyRangeView {
  const context = attempt.drill.coaching_context;
  const rangeSupport = context?.range_support;
  const points = buildRangeSummaryPoints(attempt);
  const sections = [
    buildRangeSection("Villain Value Region", rangeSupport?.value_buckets),
    buildRangeSection("Villain Bluff Region", rangeSupport?.bluff_buckets),
    buildRangeSection("Hero Bluff Catchers", rangeSupport?.bluff_catchers),
    buildRangeSection("Decision Landscape", rangeSupport?.combo_groups),
  ].filter((section): section is TransparencyRangeSection => section !== null);

  return {
    title: context?.key_concept ? `Why ${context.key_concept} Matters` : "Why This Works",
    subtitle: sections.length > 0 || (rangeSupport?.blocker_notes?.length ?? 0) > 0 || (rangeSupport?.threshold_notes?.length ?? 0) > 0
      ? "Visible range truth authored for this node, with calm bucket-level structure instead of fake matrix precision."
      : "Range-aware support built from the published explanation and available coaching context.",
    points,
    sections,
    handFocus: rangeSupport?.hero_hand_bucket
      ? {
          label: rangeSupport.hero_hand_bucket.label,
          summary: rangeSupport.hero_hand_bucket.summary,
          note: rangeSupport.hero_hand_bucket.note,
        }
      : undefined,
    blockerNotes: [...(rangeSupport?.blocker_notes ?? [])],
    thresholdNotes: [...(rangeSupport?.threshold_notes ?? [])],
    available: sections.length > 0
      || !!rangeSupport?.hero_hand_bucket
      || (rangeSupport?.blocker_notes?.length ?? 0) > 0
      || (rangeSupport?.threshold_notes?.length ?? 0) > 0,
  };
}

function buildRangeSummaryPoints(attempt: DrillAttempt): string[] {
  const points: string[] = [];
  const context = attempt.drill.coaching_context;
  const decisionTag = attempt.drill.tags.find((tag) => tag.startsWith("decision:"));

  pushUnique(points, context?.why_preferred_line_works ?? firstSentence(attempt.resolvedAnswer.explanation));

  if (context?.difficulty_reason) {
    pushUnique(points, `What makes it difficult: ${context.difficulty_reason}`);
  }

  if (!attempt.correct) {
    for (const mistake of context?.common_mistakes ?? []) {
      pushUnique(points, `Common trap: ${mistake}`);
    }
    if (context?.common_mistake) {
      pushUnique(points, `Common trap: ${context.common_mistake}`);
    }
  }

  pushUnique(points, context?.range_context);

  for (const note of context?.range_notes ?? []) {
    pushUnique(points, note);
  }

  if (attempt.activePool !== "baseline" && context?.population_note) {
    pushUnique(points, `Pool ${attempt.activePool}: ${context.population_note}`);
  }

  if (points.length < 4) {
    if (decisionTag === "decision:bluff_catch") {
      pushUnique(points, buildRiverBluffCatchPoint(attempt));
    } else if (decisionTag === "decision:value_bet") {
      pushUnique(points, "Value betting works when enough worse hands continue and the line is not so top-heavy that stronger hands dominate the action.");
    } else if (decisionTag === "decision:bluff") {
      pushUnique(points, "A bluff only works if the line arrives with enough natural misses and enough stronger hands to force folds from the target range.");
    }
  }

  if (points.length < 4) {
    const streetPoint = buildStreetShiftPoint(attempt.drill);
    if (streetPoint) {
      pushUnique(points, streetPoint);
    }
  }

  return points.slice(0, 4);
}

function buildRangeSection(
  title: string,
  buckets: Array<{
    label: string;
    combos: string[];
    note?: string;
    frequency_hint?: string;
  }> | undefined
): TransparencyRangeSection | null {
  if (!buckets || buckets.length === 0) {
    return null;
  }

  return {
    title,
    buckets: buckets.map((bucket) => ({
      label: bucket.label,
      combos: bucket.combos,
      note: bucket.note,
      frequencyHint: bucket.frequency_hint,
    })),
  };
}

function buildBoardByStreet(drill: TableSimDrill): Partial<Record<ReplayStreet, string[]>> {
  const boardByStreet: Partial<Record<ReplayStreet, string[]>> = {};
  const board = drill.scenario.board;

  if (board?.flop) {
    boardByStreet.flop = [...board.flop];
  }
  if (board?.flop && board.turn) {
    boardByStreet.turn = [...board.flop, board.turn];
  }
  if (board?.flop && board.turn && board.river) {
    boardByStreet.river = [...board.flop, board.turn, board.river];
  }

  if (!drill.steps) {
    return boardByStreet;
  }

  let running = boardByStreet[drill.scenario.street as ReplayStreet]
    ? [...(boardByStreet[drill.scenario.street as ReplayStreet] ?? [])]
    : [];

  for (const step of drill.steps) {
    if (step.board_update?.turn) {
      running = [...running.slice(0, 3), step.board_update.turn];
    }
    if (step.board_update?.river) {
      const turn = running[3];
      running = turn
        ? [...running.slice(0, 3), turn, step.board_update.river]
        : [...running, step.board_update.river];
    }
    boardByStreet[step.street] = [...running];
  }

  return boardByStreet;
}

function buildStreetNoteMap(drill: TableSimDrill): Map<ReplayStreet, string> {
  const notes = new Map<ReplayStreet, string>();

  for (const note of drill.coaching_context?.what_changed_by_street ?? []) {
    notes.set(note.street as ReplayStreet, note.detail);
  }

  for (const step of drill.steps ?? []) {
    const detail = step.coaching_context?.what_changed_by_street?.find((entry) => entry.street === step.street)?.detail;
    if (detail && !notes.has(step.street as ReplayStreet)) {
      notes.set(step.street as ReplayStreet, detail);
    }
  }

  return notes;
}

function buildStepMap(drill: TableSimDrill): Map<ReplayStreet, NonNullable<TableSimDrill["steps"]>[number]> {
  return new Map((drill.steps ?? []).map((step) => [step.street as ReplayStreet, step]));
}

function buildRiverBluffCatchPoint(attempt: DrillAttempt): string {
  if (attempt.drill.scenario.street === "river" && attempt.drill.decision_point.facing?.action.toUpperCase() === "BET") {
    return "River bluff-catching is a range-density problem: the call only prints if Villain arrives with enough missed bluffs relative to value bets.";
  }

  return "Bluff-catching decisions depend on how the line shifts value density versus natural bluff candidates by the time money goes in.";
}

function buildStreetShiftPoint(drill: TableSimDrill): string | null {
  const board = drill.scenario.board;
  if (!board) {
    return drill.decision_point.facing
      ? `The pressure starts preflop, so the decision is about how your range continues against ${formatFacing(drill.decision_point.facing.action, drill.decision_point.facing.size_pct_pot ?? null, drill.decision_point.facing.size_bb ?? null)}.`
      : null;
  }

  if (drill.scenario.street === "river" && board.river) {
    return `The river ${formatCard(board.river)} is the final range filter, so the decision depends on which value hands improve and which bluffs are still credible by showdown.`;
  }

  if (drill.scenario.street === "turn" && board.turn) {
    return `The turn ${formatCard(board.turn)} changes which draws pick up equity and which made hands can keep betting for pressure.`;
  }

  return `The flop ${formatBoard(board.flop)} sets the range advantage and draw pressure that the rest of the hand inherits.`;
}

function formatFacing(action: string, sizePctPot: number | null, sizeBb: number | null): string {
  if (sizePctPot) {
    return `${action.toLowerCase()} ${sizePctPot}% pot`;
  }
  if (sizeBb) {
    return `${action.toLowerCase()} ${sizeBb}bb`;
  }
  return action.toLowerCase();
}

function formatAction(action: string, sizeBucket: number | null, label?: string): string {
  if (label) {
    return label.toUpperCase();
  }
  return sizeBucket ? `${action.toUpperCase()} ${sizeBucket}%` : action.toUpperCase();
}

function formatBoard(cards: string[]): string {
  return cards.map(formatCard).join(" ");
}

function formatCard(card: string): string {
  const { rank, suit } = parseCard(card);
  return `${rank}${suitSymbol(suit)}`;
}

function formatStreet(street: ReplayStreet): string {
  return street.charAt(0).toUpperCase() + street.slice(1);
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text;
}

function isMatchingAction(
  userAction: string,
  userSizeBucket: number | null,
  action: string,
  sizeBucket: number | null
): boolean {
  return userAction.toUpperCase() === action.toUpperCase()
    && (sizeBucket === null || sizeBucket === userSizeBucket);
}

function pushUnique(items: string[], value: string | null | undefined): void {
  if (!value) {
    return;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || items.includes(normalized)) {
    return;
  }

  items.push(normalized);
}

function streetIndex(street: ReplayStreet): number {
  return REPLAY_STREETS.indexOf(street);
}

function buildDiagnosisView(attempt: DrillAttempt): TransparencyDiagnosisView {
  const diagnostic = attempt.diagnostic?.result;
  if (!diagnostic) {
    return {
      available: false,
      headline: "No reasoning diagnosis captured yet",
      detail: "This rep has action and range review, but no structured reasoning answer was saved for diagnosis.",
      tags: [],
    };
  }

  return {
    available: true,
    headline: diagnostic.headline,
    detail: diagnostic.detail,
    nextFocus: diagnostic.nextFocus,
    tags: [
      ...(diagnostic.errorType ? [diagnostic.errorType.replace(/_/g, " ")] : []),
      ...(diagnostic.confidenceMiscalibration ? ["confidence miscalibration"] : []),
      ...(diagnostic.concept ? [diagnostic.concept] : []),
    ],
  };
}
