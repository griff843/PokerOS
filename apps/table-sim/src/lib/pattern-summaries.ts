import type { CoachingPattern } from "@poker-coach/core/browser";

export interface PatternBrief {
  type: CoachingPattern["type"];
  title: string;
  detail: string;
  implication: string;
}

export function buildPatternBriefs(patterns: CoachingPattern[], limit = 3): PatternBrief[] {
  return patterns.slice(0, limit).map((pattern) => ({
    type: pattern.type,
    title: formatPatternTitle(pattern.type),
    detail: pattern.evidence[0] ?? pattern.coachingImplication,
    implication: pattern.coachingImplication,
  }));
}

function formatPatternTitle(type: CoachingPattern["type"]): string {
  switch (type) {
    case "persistent_threshold_leak":
      return "Recurring threshold leak";
    case "persistent_blocker_blindness":
      return "Recurring blocker blindness";
    case "downstream_river_symptom":
      return "Downstream river symptom";
    case "real_play_transfer_gap":
      return "Transfer gap";
    case "intervention_not_sticking":
      return "Intervention not sticking";
    case "regression_after_recovery":
      return "Regression after recovery";
    case "review_avoidance_pattern":
      return "Review follow-through risk";
  }
}
