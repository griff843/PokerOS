import type {
  CalibrationOutcomeEntry,
  CalibrationOutcomesBundle,
  CalibrationOutcomeEvidenceState,
  CalibrationTrustLevel,
} from "./calibration-outcomes";

export type CalibrationSurfaceState = "no_calibration" | CalibrationOutcomeEvidenceState;
export type CalibrationSurfacePriority = "high" | "medium" | "low";

export interface CalibrationSurfaceConceptSummary {
  conceptKey: string;
  label: string;
  priority: CalibrationSurfacePriority;
  interventionState: CalibrationOutcomeEntry["interventionState"];
  evidenceState: CalibrationOutcomeEntry["evidenceState"];
  trustLevel: CalibrationTrustLevel;
  whyThisStillMatters: string;
  transferSummary?: string;
  retentionSummary: string;
  suggestedAction?: {
    label: string;
    detail: string;
  };
  destination: string;
}

export interface CalibrationSurfaceAdapter {
  state: CalibrationSurfaceState;
  headline: string;
  detail: string;
  generatedAt?: string;
  topConceptSummaries: CalibrationSurfaceConceptSummary[];
  highlightedConcept?: CalibrationSurfaceConceptSummary;
  highPriorityCount: number;
}

export async function fetchCalibrationSurface(
  options: {
    limit?: number;
    topLimit?: number;
  } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<CalibrationSurfaceAdapter> {
  const params = new URLSearchParams();
  if (typeof options.limit === "number" && Number.isFinite(options.limit) && options.limit > 0) {
    params.set("limit", String(options.limit));
  }

  const response = await fetchImpl(
    `/api/calibration-outcomes${params.size > 0 ? `?${params.toString()}` : ""}`,
    { cache: "no-store" } as RequestInit,
  );

  if (!response.ok) {
    throw new Error("Failed to load calibration outcomes");
  }

  return buildCalibrationSurfaceAdapter(await response.json() as CalibrationOutcomesBundle, options.topLimit);
}

export function buildCalibrationSurfaceAdapter(
  bundle?: CalibrationOutcomesBundle | null,
  topLimit = 3,
): CalibrationSurfaceAdapter {
  if (!bundle) {
    return {
      state: "no_calibration",
      headline: "Calibration outcomes are not loaded yet.",
      detail: "Load calibration outcomes before shaping trust summaries for concept, daily-plan, or dashboard surfaces.",
      topConceptSummaries: [],
      highPriorityCount: 0,
    };
  }

  const topConceptSummaries = bundle.concepts
    .slice(0, Math.max(0, topLimit))
    .map((concept) => buildConceptSummary(concept));
  const highPriorityCount = topConceptSummaries.filter((concept) => concept.priority === "high").length;

  return {
    state: bundle.state,
    headline: bundle.summary.headline,
    detail: bundle.summary.detail,
    generatedAt: bundle.generatedAt,
    topConceptSummaries,
    highlightedConcept: topConceptSummaries[0],
    highPriorityCount,
  };
}

function buildConceptSummary(concept: CalibrationOutcomeEntry): CalibrationSurfaceConceptSummary {
  return {
    conceptKey: concept.conceptKey,
    label: concept.label,
    priority: derivePriority(concept),
    interventionState: concept.interventionState,
    evidenceState: concept.evidenceState,
    trustLevel: concept.trustSignals.trustLevel,
    whyThisStillMatters: concept.whyThisStillMatters,
    transferSummary: concept.transferConfirmation?.summary,
    retentionSummary: concept.retentionTrend.summary,
    suggestedAction: concept.nextStep
      ? {
          label: formatActionLabel(concept.nextStep.action),
          detail: concept.nextStep.reason,
        }
      : undefined,
    destination: `/app/concepts/${encodeURIComponent(concept.conceptKey)}`,
  };
}

function derivePriority(concept: CalibrationOutcomeEntry): CalibrationSurfacePriority {
  if (concept.interventionState === "regressing") {
    return "high";
  }
  if (concept.evidenceState === "strong_evidence" || concept.interventionState === "inconclusive") {
    return "medium";
  }
  return "low";
}

function formatActionLabel(action: string): string {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
