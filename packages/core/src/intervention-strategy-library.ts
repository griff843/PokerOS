import type { ConceptRecoveryStage } from "./coaching-memory";
import type { CoachingPatternType } from "./patterns";
import type { InterventionIntensity, InterventionRecommendationAction, InterventionStrategyType } from "./intervention-recommendations";
import type { RetentionScheduleState } from "./retention-scheduler";

export type InterventionBlueprintIntensity = "low" | "medium" | "high";

export interface InterventionStrategyContext {
  conceptKey: string;
  label: string;
  recommendedAction: InterventionRecommendationAction;
  recommendedStrategy: InterventionStrategyType;
  suggestedIntensity: InterventionIntensity;
  recoveryStage: ConceptRecoveryStage;
  patternTypes: CoachingPatternType[];
  recurrenceCount: number;
  regressionCount: number;
  reviewPressure: number;
  transferPressure: boolean;
  retentionState?: RetentionScheduleState;
}

export interface InterventionStrategyBlueprint {
  strategyType: InterventionStrategyType;
  intensity: InterventionBlueprintIntensity;
  title: string;
  objective: string;
  targetWeaknessProfile: string[];
  recommendedDrillMix: {
    repair: number;
    review: number;
    applied: number;
    validation: number;
  };
  sessionEmphasis: string[];
  reviewEmphasis: string[];
  transferEmphasis: string[];
  stabilizationEmphasis: string[];
  recommendedAttemptWindow: {
    sessions: number;
    attempts: number;
  };
  escalationTriggerHints: string[];
  successCriteriaHints: string[];
  retentionFollowUpGuidance: string[];
  coachNotes: string[];
  rationale: string;
  modifiers: string[];
}

export function selectInterventionStrategyBlueprint(
  context: InterventionStrategyContext
): InterventionStrategyBlueprint {
  const intensity = normalizeBlueprintIntensity(context.suggestedIntensity, context);
  const base = blueprintForStrategy(context.recommendedStrategy, intensity, context);
  const modifiers = collectBlueprintModifiers(context, intensity);

  return {
    ...base,
    modifiers,
    recommendedDrillMix: applyMixModifiers(base.recommendedDrillMix, context, intensity),
    sessionEmphasis: dedupe([...base.sessionEmphasis, ...modifierSessionEmphasis(context)]),
    reviewEmphasis: dedupe([...base.reviewEmphasis, ...modifierReviewEmphasis(context)]),
    transferEmphasis: dedupe([...base.transferEmphasis, ...modifierTransferEmphasis(context)]),
    stabilizationEmphasis: dedupe([...base.stabilizationEmphasis, ...modifierStabilizationEmphasis(context)]),
    retentionFollowUpGuidance: dedupe([...base.retentionFollowUpGuidance, ...modifierRetentionGuidance(context)]),
    coachNotes: dedupe([...base.coachNotes, ...modifierCoachNotes(context, intensity)]),
  };
}

export function buildInterventionStrategyBlueprints(
  contexts: InterventionStrategyContext[]
): InterventionStrategyBlueprint[] {
  return contexts.map((context) => selectInterventionStrategyBlueprint(context));
}

export function normalizeBlueprintIntensity(
  suggestedIntensity: InterventionIntensity,
  context?: Pick<InterventionStrategyContext, "regressionCount" | "transferPressure" | "recoveryStage">
): InterventionBlueprintIntensity {
  if (suggestedIntensity === "light") return "low";
  if (suggestedIntensity === "moderate") return "medium";
  if (context?.recoveryStage === "stabilizing" && suggestedIntensity !== "intensive") return "medium";
  if (suggestedIntensity === "high" || suggestedIntensity === "intensive") return "high";
  if ((context?.regressionCount ?? 0) > 0 || context?.transferPressure) return "high";
  return "medium";
}

function blueprintForStrategy(
  strategy: InterventionStrategyType,
  intensity: InterventionBlueprintIntensity,
  context: InterventionStrategyContext
): InterventionStrategyBlueprint {
  switch (strategy) {
    case "threshold_repair":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Threshold Repair`,
        objective: "Rebuild the learner's practical decision threshold so calls, folds, and continue points stop drifting around the right answer.",
        targetWeaknessProfile: ["threshold errors", "recurring call/fold boundary misses", "range-edge uncertainty"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.55, review: 0.2, applied: 0.15, validation: 0.1 }, { repair: 0.68, review: 0.16, applied: 0.08, validation: 0.08 }),
        sessionEmphasis: ["tight concept focus", "threshold retests", "compare near-boundary combos"],
        reviewEmphasis: ["review threshold misses before new material", "keep explanations anchored on the cutoff line"],
        transferEmphasis: ["only light transfer until threshold stability improves"],
        stabilizationEmphasis: ["finish with a short retest block on adjacent threshold spots"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 12 }, { sessions: 4, attempts: 24 }),
        escalationTriggerHints: ["threshold misses persist after two focused sessions", "same boundary error keeps reappearing in real-play review"],
        successCriteriaHints: ["recent threshold reps move above 70%", "diagnosis frequency drops across adjacent threshold spots"],
        retentionFollowUpGuidance: ["schedule a short validation block once the threshold holds for one full session"],
        coachNotes: ["Keep the learner on the decision boundary instead of broadening into unrelated texture work."],
        rationale: "Threshold repair works best when the concept stays narrow and the learner repeatedly compares just-over versus just-under threshold combos.",
        modifiers: [],
      };
    case "blocker_recognition":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Blocker Recognition`,
        objective: "Make blocker and removal effects explicit enough that the learner starts using them naturally in bluff-catching and bluffing spots.",
        targetWeaknessProfile: ["blocker blindness", "combo-removal misses", "shallow river bluff-catching reads"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.48, review: 0.22, applied: 0.18, validation: 0.12 }, { repair: 0.58, review: 0.2, applied: 0.14, validation: 0.08 }),
        sessionEmphasis: ["explicit blocker callouts", "value-versus-bluff removal comparison", "combo visibility"],
        reviewEmphasis: ["review which value hands get removed", "review which bluffs survive"],
        transferEmphasis: ["attach blocker notes to real-play spots when available"],
        stabilizationEmphasis: ["end with one or two blind blocker reads without support notes"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 10 }, { sessions: 4, attempts: 20 }),
        escalationTriggerHints: ["blocker misses continue after explicit-note sessions", "real-play hands still show blocker-blind errors despite drill gains"],
        successCriteriaHints: ["learner identifies removal effects in review", "blocker-sensitive spots stop clustering as diagnoses"],
        retentionFollowUpGuidance: ["use a lighter retention pass that removes the explicit blocker hints"],
        coachNotes: ["Show what gets blocked, not just that blockers matter."],
        rationale: "Blocker recognition improves when the learner repeatedly sees exactly which value and bluff regions are trimmed by the held cards.",
        modifiers: [],
      };
    case "street_transition_repair":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Street Transition Repair`,
        objective: "Reconnect downstream river or end-node errors to the earlier street decision that created them.",
        targetWeaknessProfile: ["line confusion", "turn-to-river story loss", "downstream river symptoms"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.5, review: 0.2, applied: 0.18, validation: 0.12 }, { repair: 0.62, review: 0.18, applied: 0.12, validation: 0.08 }),
        sessionEmphasis: ["upstream-first repair", "street-story reconstruction", "node-to-node continuity"],
        reviewEmphasis: ["review the earlier inflection point before the final street result", "keep line history visible"],
        transferEmphasis: ["bridge the same hand line from authored drills into real-hand review"],
        stabilizationEmphasis: ["close with a clean downstream retest after upstream repair"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 12 }, { sessions: 4, attempts: 22 }),
        escalationTriggerHints: ["downstream symptom survives despite upstream-focused repair", "line confusion stays active across sessions"],
        successCriteriaHints: ["upstream concept improves before downstream symptom retest", "river symptom frequency drops after turn repair"],
        retentionFollowUpGuidance: ["schedule a downstream-only retention check after the upstream story is holding"],
        coachNotes: ["Do not let the learner solve the river in isolation if the turn is still misunderstood."],
        rationale: "Street transition repair works by repairing the first broken step in the line, then retesting the visible end symptom.",
        modifiers: [],
      };
    case "transfer_training":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Transfer Training`,
        objective: "Translate drill-side understanding into real-play recognition so the same concept actually appears under live hand pressure.",
        targetWeaknessProfile: ["real-play transfer gap", "lab-side improvement without live uptake", "applied recognition lag"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.28, review: 0.2, applied: 0.34, validation: 0.18 }, { repair: 0.22, review: 0.18, applied: 0.42, validation: 0.18 }),
        sessionEmphasis: ["applied hand review", "authored-to-real-play bridge", "context recognition under pressure"],
        reviewEmphasis: ["pair one drill cluster with one imported-hand cluster", "review why the concept looked different live"],
        transferEmphasis: ["use real hands directly", "increase applied review emphasis as intensity rises"],
        stabilizationEmphasis: ["validate transfer in a live-like retest before closing"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 10 }, { sessions: 5, attempts: 20 }),
        escalationTriggerHints: ["real-play misses persist after two transfer-linked sessions", "imported hands keep mapping the concept after drill recovery"],
        successCriteriaHints: ["real-play review spots decline", "applied review accuracy closes the gap versus drill accuracy"],
        retentionFollowUpGuidance: ["run retention on live-like or imported-hand-linked material rather than only authored drills"],
        coachNotes: ["Treat transfer gaps as application problems, not proof that the concept was never learned."],
        rationale: "Transfer training should shift effort toward applied review and live-like recognition instead of repeating pure authored repair.",
        modifiers: [],
      };
    case "stabilization_reinforcement":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Stabilization Reinforcement`,
        objective: "Protect recent gains without over-repairing the concept, using lighter reinforcement and clearer validation cadence.",
        targetWeaknessProfile: ["stabilizing recovery", "recently recovered concept", "retention-check readiness"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.18, review: 0.22, applied: 0.18, validation: 0.42 }, { repair: 0.24, review: 0.2, applied: 0.16, validation: 0.4 }),
        sessionEmphasis: ["light reinforcement", "validation cadence", "avoid overtraining"],
        reviewEmphasis: ["review only the concept-defining misses", "keep the block short and deliberate"],
        transferEmphasis: ["use transfer only as a validation check, not as heavy repair"],
        stabilizationEmphasis: ["strong validation cadence", "short follow-up windows", "retention-minded retests"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 1, attempts: 8 }, { sessions: 3, attempts: 14 }),
        escalationTriggerHints: ["retention fails after stabilization", "new diagnoses arrive before validation closes"],
        successCriteriaHints: ["retention passes", "no new diagnosis appears during the validation window"],
        retentionFollowUpGuidance: ["schedule the next retention check sooner than broad new material if recurrence risk stays present"],
        coachNotes: ["The job here is to validate the gain, not to bury the learner in more repair reps."],
        rationale: "Stabilization should lower repair load and increase validation structure so the system can tell whether recovery is actually holding.",
        modifiers: [],
      };
    case "review_habit_repair":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Review Habit Repair`,
        objective: "Repair the learner's follow-through pattern so coaching gains do not stall behind unworked review pressure.",
        targetWeaknessProfile: ["review avoidance", "backlog under active repair", "weak follow-through loops"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.3, review: 0.42, applied: 0.12, validation: 0.16 }, { repair: 0.26, review: 0.48, applied: 0.1, validation: 0.16 }),
        sessionEmphasis: ["shorter review loops", "friction reduction", "repeatable follow-through"],
        reviewEmphasis: ["front-load due review", "keep one concept thread live until backlog eases"],
        transferEmphasis: ["defer heavy transfer until review discipline stabilizes"],
        stabilizationEmphasis: ["validate the review habit with a smaller follow-up block"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 8 }, { sessions: 4, attempts: 16 }),
        escalationTriggerHints: ["review backlog keeps rising across two sessions", "repair concepts stall because review never clears"],
        successCriteriaHints: ["due review count drops", "same concepts stop returning solely because review was skipped"],
        retentionFollowUpGuidance: ["retention should stay short and visible so it does not become another ignored backlog item"],
        coachNotes: ["Make the review loop easier to re-enter before asking for more spread."],
        rationale: "Review habit repair is about changing how the learner re-enters review, not just adding more content.",
        modifiers: [],
      };
    case "mixed_repair":
      return {
        strategyType: strategy,
        intensity,
        title: `${toTitleCase(context.label)} Mixed Repair Program`,
        objective: "Handle overlapping leak signatures without pretending they are one pure failure mode.",
        targetWeaknessProfile: ["multi-signal leak", "overlapping diagnosis types", "pattern overlap across one concept"],
        recommendedDrillMix: mixByIntensity(intensity, { repair: 0.42, review: 0.22, applied: 0.2, validation: 0.16 }, { repair: 0.52, review: 0.18, applied: 0.18, validation: 0.12 }),
        sessionEmphasis: ["primary leak first", "secondary emphasis second", "explicit sequencing"],
        reviewEmphasis: ["keep review tied to the lead failure mode", "avoid spreading into too many sub-leaks at once"],
        transferEmphasis: ["only raise transfer emphasis when real-play pressure is explicit"],
        stabilizationEmphasis: ["stabilize the lead failure mode before widening"],
        recommendedAttemptWindow: windowByIntensity(intensity, { sessions: 2, attempts: 12 }, { sessions: 5, attempts: 24 }),
        escalationTriggerHints: ["mixed signals still do not separate after focused sequencing", "strategy keeps flipping because no lead failure mode stabilizes"],
        successCriteriaHints: ["primary failure mode stops driving new diagnoses", "the recommendation narrows from mixed repair to a cleaner strategy"],
        retentionFollowUpGuidance: ["retention should test the lead repaired emphasis, not the whole mixed stack at once"],
        coachNotes: ["Mixed repair should still be ordered: lead with the strongest pressure source and keep the secondary emphasis explicit."],
        rationale: "Mixed repair is a sequencing problem, not a reason to make the intervention vague.",
        modifiers: [],
      };
  }
}

function collectBlueprintModifiers(
  context: InterventionStrategyContext,
  intensity: InterventionBlueprintIntensity
): string[] {
  const modifiers: string[] = [];
  if (context.transferPressure) modifiers.push("transfer_pressure");
  if (context.recoveryStage === "stabilizing" || context.retentionState === "due" || context.retentionState === "overdue") modifiers.push("validation_priority");
  if (context.regressionCount > 0) modifiers.push("regression_pressure");
  if (context.recurrenceCount >= 3) modifiers.push("recurring_leak_pressure");
  if (context.patternTypes.includes("downstream_river_symptom")) modifiers.push("upstream_first");
  if (context.patternTypes.includes("intervention_not_sticking")) modifiers.push("strategy_fragility");
  modifiers.push(`intensity_${intensity}`);
  return modifiers;
}

function modifierSessionEmphasis(context: InterventionStrategyContext): string[] {
  const items: string[] = [];
  if (context.patternTypes.includes("downstream_river_symptom")) {
    items.push("repair the upstream node before retesting the downstream symptom");
  }
  if (context.regressionCount > 0) {
    items.push("reopen the concept with a longer follow-through window");
  }
  if (context.recurrenceCount >= 3) {
    items.push("keep the concept narrow until recurrence drops");
  }
  return items;
}

function modifierReviewEmphasis(context: InterventionStrategyContext): string[] {
  const items: string[] = [];
  if (context.reviewPressure > 0) {
    items.push("clear due review tied to this concept before adding broad new material");
  }
  if (context.patternTypes.includes("review_avoidance_pattern")) {
    items.push("shorten the review loop so follow-through becomes repeatable");
  }
  return items;
}

function modifierTransferEmphasis(context: InterventionStrategyContext): string[] {
  return context.transferPressure || context.patternTypes.includes("real_play_transfer_gap")
    ? ["increase imported-hand or live-like review emphasis"]
    : [];
}

function modifierStabilizationEmphasis(context: InterventionStrategyContext): string[] {
  if (context.recoveryStage === "stabilizing" || context.retentionState === "due" || context.retentionState === "overdue") {
    return ["use a shorter validation cadence before broadening"];
  }
  return [];
}

function modifierRetentionGuidance(context: InterventionStrategyContext): string[] {
  if (context.retentionState === "due" || context.retentionState === "overdue") {
    return ["prioritize the retention check before assuming the concept is stable"];
  }
  if (context.regressionCount > 0) {
    return ["schedule the next retention pass sooner because the concept has slipped before"];
  }
  return [];
}

function modifierCoachNotes(
  context: InterventionStrategyContext,
  intensity: InterventionBlueprintIntensity
): string[] {
  const notes: string[] = [];
  if (context.patternTypes.includes("intervention_not_sticking")) {
    notes.push("This concept needs a cleaner intervention shape, not just more of the same reps.");
  }
  if (intensity === "high") {
    notes.push("Keep the intervention narrow and deliberate so the learner cannot hide behind variety.");
  }
  return notes;
}

function applyMixModifiers(
  mix: InterventionStrategyBlueprint["recommendedDrillMix"],
  context: InterventionStrategyContext,
  intensity: InterventionBlueprintIntensity
): InterventionStrategyBlueprint["recommendedDrillMix"] {
  let repair = mix.repair;
  let review = mix.review;
  let applied = mix.applied;
  let validation = mix.validation;

  if (context.transferPressure || context.patternTypes.includes("real_play_transfer_gap")) {
    applied += intensity === "high" ? 0.12 : 0.08;
    repair -= 0.04;
    review -= 0.02;
  }

  if (context.recoveryStage === "stabilizing" || context.retentionState === "due" || context.retentionState === "overdue") {
    validation += 0.12;
    repair -= 0.08;
    applied -= 0.02;
  }

  if (context.regressionCount > 0) {
    repair += 0.08;
    validation -= 0.03;
  }

  return normalizeMix({ repair, review, applied, validation });
}

function mixByIntensity(
  intensity: InterventionBlueprintIntensity,
  lowOrMedium: InterventionStrategyBlueprint["recommendedDrillMix"],
  high: InterventionStrategyBlueprint["recommendedDrillMix"]
): InterventionStrategyBlueprint["recommendedDrillMix"] {
  if (intensity === "high") {
    return high;
  }
  if (intensity === "low") {
    return normalizeMix({
      repair: lowOrMedium.repair - 0.08,
      review: lowOrMedium.review,
      applied: lowOrMedium.applied + 0.02,
      validation: lowOrMedium.validation + 0.06,
    });
  }
  return normalizeMix(lowOrMedium);
}

function windowByIntensity(
  intensity: InterventionBlueprintIntensity,
  low: { sessions: number; attempts: number },
  high: { sessions: number; attempts: number }
): { sessions: number; attempts: number } {
  if (intensity === "low") return low;
  if (intensity === "high") return high;
  return {
    sessions: Math.round((low.sessions + high.sessions) / 2),
    attempts: Math.round((low.attempts + high.attempts) / 2),
  };
}

function normalizeMix(mix: InterventionStrategyBlueprint["recommendedDrillMix"]): InterventionStrategyBlueprint["recommendedDrillMix"] {
  const values = [mix.repair, mix.review, mix.applied, mix.validation].map((value) => Math.max(0, value));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return {
    repair: round(values[0] / total),
    review: round(values[1] / total),
    applied: round(values[2] / total),
    validation: round(values[3] / total),
  };
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
