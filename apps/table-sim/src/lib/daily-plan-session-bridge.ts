import type { DailyPlanBlock, DailyPlanBlockKind, DailySessionLength, DailyStudyPlan } from "./daily-study-plan";

export interface DailyPlanSessionOverride {
  source: "daily-plan";
  recommendedCount: number;
  sessionLength: DailySessionLength;
  focusConceptKey: string | null;
  focusConceptLabel: string | null;
  intent: string;
  blockKind: DailyPlanBlockKind | null;
  blockTitle: string | null;
}

export function buildDailyPlanSessionHref(args: {
  plan: DailyStudyPlan;
  block?: Pick<DailyPlanBlock, "kind" | "title" | "conceptKey" | "conceptLabel"> | null;
}) {
  const params = new URLSearchParams({
    source: "daily-plan",
    count: String(resolveRecommendedCount(args.plan)),
    sessionLength: String(args.plan.sessionLength),
    intent: args.block?.kind ?? "daily_focus",
  });

  if (args.block?.conceptKey) {
    params.set("focusConcept", args.block.conceptKey);
  }
  if (args.block?.conceptLabel) {
    params.set("focusLabel", args.block.conceptLabel);
  }
  if (args.block?.kind) {
    params.set("blockKind", args.block.kind);
  }
  if (args.block?.title) {
    params.set("blockTitle", args.block.title);
  }

  return `/app/session?${params.toString()}`;
}

export function buildConceptFollowUpSessionHref(args: {
  conceptTag: string;
  conceptLabel?: string | null;
  recommendedCount?: number;
  sessionLength?: DailySessionLength;
}) {
  const conceptKey = normalizeConceptKey(args.conceptTag);
  const conceptLabel = normalizeOptionalString(args.conceptLabel ?? undefined) ?? formatConceptLabel(conceptKey);
  const params = new URLSearchParams({
    source: "daily-plan",
    count: String(args.recommendedCount ?? 8),
    sessionLength: String(args.sessionLength ?? 45),
    intent: "focus_concept",
    focusConcept: conceptKey,
    focusLabel: conceptLabel,
    blockKind: "focus_concept",
    blockTitle: `Focus Concept: ${conceptLabel}`,
  });

  return `/app/session?${params.toString()}`;
}

export function parseDailyPlanSessionOverride(searchParams: Record<string, string | string[] | undefined>): DailyPlanSessionOverride | null {
  const source = takeFirst(searchParams.source);
  if (source !== "daily-plan") {
    return null;
  }

  const recommendedCount = parseRecommendedCount(takeFirst(searchParams.count));
  const sessionLength = parseSessionLength(takeFirst(searchParams.sessionLength));
  const focusConceptKey = normalizeOptionalString(takeFirst(searchParams.focusConcept));
  const focusConceptLabel = normalizeOptionalString(takeFirst(searchParams.focusLabel));
  const blockKind = parseBlockKind(takeFirst(searchParams.blockKind));
  const blockTitle = normalizeOptionalString(takeFirst(searchParams.blockTitle));
  const intent = normalizeOptionalString(takeFirst(searchParams.intent)) ?? blockKind ?? "daily_focus";

  return {
    source: "daily-plan",
    recommendedCount,
    sessionLength,
    focusConceptKey,
    focusConceptLabel,
    intent,
    blockKind,
    blockTitle,
  };
}

function resolveRecommendedCount(plan: DailyStudyPlan) {
  if (plan.blocks.length === 0) {
    return 5;
  }
  if (plan.sessionLength === 20) {
    return 5;
  }
  if (plan.sessionLength === 45) {
    return 10;
  }
  return 15;
}

function parseRecommendedCount(value: string | undefined) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.max(1, Math.min(parsed, 30));
}

function parseSessionLength(value: string | undefined): DailySessionLength {
  if (value === "20" || value === "45" || value === "90") {
    return Number.parseInt(value, 10) as DailySessionLength;
  }
  return 45;
}

function parseBlockKind(value: string | undefined): DailyPlanBlockKind | null {
  switch (value) {
    case "focus_concept":
    case "secondary_concept":
    case "execute_intervention":
    case "review_real_hands":
    case "retention_check":
    case "inspect_replay_drift":
      return value;
    default:
      return null;
  }
}

function takeFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeOptionalString(value: string | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConceptKey(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("concept:") ? trimmed.slice("concept:".length) : trimmed;
}

function formatConceptLabel(value: string) {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
