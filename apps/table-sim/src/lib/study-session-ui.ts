import type { TableSimDrill, TableSimOption } from "./drill-schema";
import type { DecisionConfidence, DrillAttempt } from "./session-types";

export interface ConfidenceOption {
  value: DecisionConfidence;
  label: string;
}

export interface MomentumSignal {
  label: string;
  detail: string;
}

export const DECISION_CONFIDENCE_OPTIONS: ConfidenceOption[] = [
  { value: "not_sure", label: "Not Sure" },
  { value: "pretty_sure", label: "Pretty Sure" },
  { value: "certain", label: "Certain" },
];

const AGGRESSIVE_ACTIONS = new Set(["BET", "RAISE", "OPEN", "3BET", "4BET"]);
const FORM_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function actionNeedsSizing(action: string | null | undefined): boolean {
  return action !== null && action !== undefined && AGGRESSIVE_ACTIONS.has(action.toUpperCase());
}

export function formatDecisionConfidence(confidence: DecisionConfidence): string {
  return DECISION_CONFIDENCE_OPTIONS.find((option) => option.value === confidence)?.label ?? "Pretty Sure";
}

export function formatSessionLabel(value: string): string {
  return value
    .replace(/^.*:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function extractConceptLabel(drill: TableSimDrill): string {
  const conceptTag = drill.tags.find((tag) => tag.startsWith("concept:"));
  if (conceptTag) {
    return formatSessionLabel(conceptTag);
  }

  const decisionTag = drill.tags.find((tag) => tag.startsWith("decision:"));
  if (decisionTag) {
    return formatSessionLabel(decisionTag);
  }

  return drill.title;
}

export function extractDecisionLabel(drill: TableSimDrill): string {
  const decisionTag = drill.tags.find((tag) => tag.startsWith("decision:"));
  return decisionTag ? formatSessionLabel(decisionTag) : drill.title;
}

export function summarizeActionHistory(drill: TableSimDrill): string[] {
  const steps = drill.scenario.action_history.map((step) => {
    const size = step.size_pct_pot
      ? ` ${step.size_pct_pot}% pot`
      : step.size_bb
        ? ` ${step.size_bb}bb`
        : "";
    return `${step.street.toUpperCase()}: ${step.player} ${formatSessionLabel(step.action).toLowerCase()}${size}`;
  });

  if (steps.length > 0) {
    return steps;
  }

  return ["No structured history captured. Use the stage stem to reconstruct the line."];
}

export function calculateSpr(drill: TableSimDrill): number | null {
  const stack = drill.scenario.effective_stack_bb;
  const pot = drill.scenario.pot_size_bb;
  if (!stack || !pot || pot <= 0) {
    return null;
  }

  return Number((stack / pot).toFixed(1));
}

export function buildMomentumSignal(attempts: DrillAttempt[]): MomentumSignal {
  if (attempts.length === 0) {
    return {
      label: "Opening spot",
      detail: "Settle in and build your read.",
    };
  }

  let streak = 0;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index]?.correct) {
      break;
    }
    streak += 1;
  }

  if (streak >= 3) {
    return {
      label: "Sharp cadence",
      detail: `${streak} clean decisions in a row.`,
    };
  }

  const recent = attempts.slice(-3);
  const recentCorrect = recent.filter((attempt) => attempt.correct).length;

  if (recentCorrect >= 2) {
    return {
      label: "Building cadence",
      detail: "Recent reads are landing.",
    };
  }

  if (recentCorrect === 0) {
    return {
      label: "Reset the trigger",
      detail: "Slow down and anchor one principle.",
    };
  }

  return {
    label: "Stay deliberate",
    detail: "One clear decision at a time.",
  };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as {
    isContentEditable?: unknown;
    tagName?: unknown;
  };

  return candidate.isContentEditable === true
    || (typeof candidate.tagName === "string" && FORM_TAGS.has(candidate.tagName));
}

export function getDecisionHotkeyMap(options: TableSimOption[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  options.slice(0, 4).forEach((option, index) => {
    mapping[String(index + 1)] = option.key;
  });

  for (const option of options) {
    const normalized = option.key.toUpperCase();
    if (normalized === "FOLD") {
      mapping.f = option.key;
    } else if (normalized === "CALL" || normalized === "CHECK") {
      mapping.c = option.key;
    } else if (AGGRESSIVE_ACTIONS.has(normalized)) {
      mapping.r = option.key;
    }
  }

  return mapping;
}

export function resolveActionHotkey(key: string, options: TableSimOption[]): string | null {
  const normalized = key.toLowerCase();
  return getDecisionHotkeyMap(options)[normalized] ?? null;
}

export function formatActionLine(action: string, sizeBucket: number | null | undefined): string {
  return sizeBucket ? `${action} ${sizeBucket}%` : action;
}

export function getPrimaryPrinciple(attempt: DrillAttempt): string {
  const sentence = attempt.resolvedAnswer.explanation.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence && sentence.length > 0
    ? sentence
    : `Anchor on ${formatSessionLabel(attempt.resolvedAnswer.required_tags[0] ?? "the core trigger")}.`;
}

export function getPoolContextBadge(attempt: DrillAttempt): { label: string; detail: string } {
  if (attempt.activePool === "baseline") {
    return {
      label: "Baseline line",
      detail: "This spot is teaching the core population-neutral answer.",
    };
  }

  return {
    label: `Pool ${attempt.activePool}`,
    detail: "Use the pool context as a contrast cue, not a second answer sheet.",
  };
}
