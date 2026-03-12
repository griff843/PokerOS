import type { DiagnosticInsight } from "./diagnostics";
import type { DiagnosticErrorType } from "./schemas";
import type { RealPlayConceptSignal } from "./real-hands";
import type { AttemptInsight, WeaknessPool } from "./weakness-analytics";

export type LearnerTendencyKey =
  | "overconfident_threshold_player"
  | "line_confused_player"
  | "blocker_blind_player"
  | "range_shape_weak_player"
  | "review_avoidant_player"
  | "drill_strong_real_play_weak_player";

export interface AdaptiveConfidenceInsight {
  confidence: "not_sure" | "pretty_sure" | "certain";
  correct: boolean;
  classificationTags?: string[];
  missedTags?: string[];
}

export interface AdaptiveConceptSnapshot {
  conceptKey: string;
  label: string;
  averageScore?: number;
  recurrenceCount: number;
  reviewPressure: number;
  trainingUrgency: number;
  status: "strength" | "watch" | "weakness";
  confidenceMismatch?: {
    direction: "overconfident" | "underconfident";
    count: number;
    detail: string;
  };
  evidence: string[];
}

export interface LearnerTendency {
  key: LearnerTendencyKey;
  label: string;
  summary: string;
  confidence: number;
  evidence: string[];
  teachingAdjustments: string[];
}

export interface AdaptiveCoachingProfile {
  generatedAt: string;
  summary: string;
  tendencies: LearnerTendency[];
  coachingEmphasis: {
    explanationBullets: string[];
    interventionBullets: string[];
    confidenceHandling: string;
    recommendationFraming: string;
  };
  interventionAdjustments: {
    preferShorterReviewBlocks: boolean;
    prioritizeThresholdRetests: boolean;
    prioritizeLineReconstruction: boolean;
    prioritizeBlockerNotes: boolean;
    prioritizeConfidenceCalibration: boolean;
    prioritizeRealPlayReview: boolean;
  };
  surfaceSignals: {
    commandCenter: string;
    studySession: string;
    sessionReview: string;
    weaknessExplorer: string;
    growthProfile: string;
    review: string;
  };
}

export function createNeutralAdaptiveCoachingProfile(now: Date = new Date()): AdaptiveCoachingProfile {
  return {
    generatedAt: now.toISOString(),
    summary: "The learner profile is still early, so coaching should stay balanced until a clearer recurring style appears.",
    tendencies: [],
    coachingEmphasis: {
      explanationBullets: ["Keep the explanation balanced until a clearer recurring learner style is visible."],
      interventionBullets: ["Keep interventions narrow and concept-led while the learner profile is still forming."],
      confidenceHandling: "Keep confidence honest, but do not turn every mistake into a calibration problem.",
      recommendationFraming: "Keep next recommendations narrow, explicit, and tied to recurring evidence.",
    },
    interventionAdjustments: {
      preferShorterReviewBlocks: false,
      prioritizeThresholdRetests: false,
      prioritizeLineReconstruction: false,
      prioritizeBlockerNotes: false,
      prioritizeConfidenceCalibration: false,
      prioritizeRealPlayReview: false,
    },
    surfaceSignals: {
      commandCenter: "The learner profile is still early, so today should stay anchored on the strongest live concept signal.",
      studySession: "Stay with the clearest coaching adjustment from this rep.",
      sessionReview: "Use the debrief to isolate the clearest repeat leak from the block.",
      weaknessExplorer: "The weakness map should stay concept-led until a clearer learner tendency separates itself.",
      growthProfile: "The growth profile is still mostly concept-shaped, with only early signs of learner-specific adaptation.",
      review: "Use review to reinforce the clearest conceptual correction available.",
    },
  };
}

export function buildAdaptiveCoachingProfile(args: {
  concepts: AdaptiveConceptSnapshot[];
  attemptInsights?: AttemptInsight[];
  confidenceInsights?: AdaptiveConfidenceInsight[];
  diagnosticInsights?: DiagnosticInsight[];
  realPlaySignals?: RealPlayConceptSignal[];
  dueReviewCount?: number;
  activePool?: WeaknessPool;
  now?: Date;
}): AdaptiveCoachingProfile {
  const now = args.now ?? new Date();
  const diagnosticCounts = countDiagnostics(args.diagnosticInsights ?? []);
  const confidenceCounts = countConfidence(args.confidenceInsights ?? []);
  const realPlaySignals = args.realPlaySignals ?? [];
  const dueReviewCount = args.dueReviewCount ?? 0;
  const tendencies: LearnerTendency[] = [];

  if (diagnosticCounts.threshold_error >= 2 && (confidenceCounts.certainWrong >= 2 || hasOverconfidentConcept(args.concepts))) {
    tendencies.push({
      key: "overconfident_threshold_player",
      label: "Threshold confidence is outrunning accuracy",
      summary: "Threshold misses are clustering with more certainty than the current results justify.",
      confidence: tendencyConfidence(diagnosticCounts.threshold_error + confidenceCounts.certainWrong),
      evidence: [
        `${diagnosticCounts.threshold_error} threshold-error diagnoses are logged in the current sample.`,
        confidenceCounts.certainWrong > 0
          ? `${confidenceCounts.certainWrong} misses were made with Certain confidence.`
          : "Concept-level confidence drift is showing up in the current history.",
      ],
      teachingAdjustments: [
        "Use practical threshold bands before abstract hand labels.",
        "Retest confidence calibration explicitly instead of assuming the right answer will fix it.",
      ],
    });
  }

  if (diagnosticCounts.line_misunderstanding >= 2) {
    tendencies.push({
      key: "line_confused_player",
      label: "Street story is getting lost",
      summary: "The learner is seeing pieces of the line but not always carrying the full story from street to street.",
      confidence: tendencyConfidence(diagnosticCounts.line_misunderstanding),
      evidence: [
        `${diagnosticCounts.line_misunderstanding} line-misunderstanding diagnoses are logged.`,
        strongestConceptEvidence(args.concepts, ["line", "turn", "river", "probe", "polar"]) ?? "Multiple action-context concepts are staying under pressure together.",
      ],
      teachingAdjustments: [
        "Lead with line reconstruction before threshold details.",
        "Explain what changed by street, not just what action wins at the end.",
      ],
    });
  }

  if (diagnosticCounts.blocker_blindness >= 2 || hasRealPlayBlockerPressure(realPlaySignals)) {
    tendencies.push({
      key: "blocker_blind_player",
      label: "Blocker cues are being underused",
      summary: "The learner is landing in blocker-sensitive spots without consistently using the removal effects that decide them.",
      confidence: tendencyConfidence(diagnosticCounts.blocker_blindness + countBlockerSignals(realPlaySignals)),
      evidence: [
        diagnosticCounts.blocker_blindness > 0
          ? `${diagnosticCounts.blocker_blindness} blocker-blindness diagnoses are logged.`
          : "Imported hands are surfacing blocker-sensitive review spots.",
        strongestConceptEvidence(args.concepts, ["blocker"]) ?? "Blocker-heavy concepts are still carrying visible pressure.",
      ],
      teachingAdjustments: [
        "Surface blocker notes earlier in the explanation.",
        "Keep the coaching anchored on which value and bluff combos get removed.",
      ],
    });
  }

  if (diagnosticCounts.range_construction_error >= 2 || hasRangeShapeWeakness(args.concepts)) {
    tendencies.push({
      key: "range_shape_weak_player",
      label: "Range shape is still too fuzzy",
      summary: "The learner can reach the spot, but the shape of each side's range is not stable enough yet.",
      confidence: tendencyConfidence(diagnosticCounts.range_construction_error + countRangeSignals(args.concepts)),
      evidence: [
        diagnosticCounts.range_construction_error > 0
          ? `${diagnosticCounts.range_construction_error} range-construction diagnoses are logged.`
          : "Range-structure concepts are staying weak without cleaner upstream support.",
        strongestConceptEvidence(args.concepts, ["range", "construction", "shape"]) ?? "Range-based evidence is present, but still not cleanly internalized.",
      ],
      teachingAdjustments: [
        "Show bucket-level range shape before action frequency.",
        "Keep asking which worse hands continue and which bluffs remain by this node.",
      ],
    });
  }

  if (dueReviewCount >= 5) {
    tendencies.push({
      key: "review_avoidant_player",
      label: "Review pressure is building faster than it is being cleared",
      summary: "The learner likely needs shorter, more focused review loops before adding more spread.",
      confidence: tendencyConfidence(dueReviewCount),
      evidence: [
        `${dueReviewCount} review reps are already due.`,
        args.activePool && args.activePool !== "baseline"
          ? `The backlog is building inside Pool ${args.activePool}, so spacing pressure is now part of the coaching picture.`
          : "Spacing pressure is now part of the coaching picture, not just raw weakness ranking.",
      ],
      teachingAdjustments: [
        "Shorten review blocks and make them easier to re-enter.",
        "Let reinforcement clear before expanding further.",
      ],
    });
  }

  if (hasDrillStrongRealPlayWeak(args.concepts, realPlaySignals)) {
    tendencies.push({
      key: "drill_strong_real_play_weak_player",
      label: "Transfer from drills to real play is still unstable",
      summary: "The learner can show cleaner drill performance than live-hand transfer right now, so coaching should bridge directly into real-play review.",
      confidence: tendencyConfidence(realPlaySignals.reduce((sum, signal) => sum + signal.occurrences, 0)),
      evidence: [
        "Imported hands are still attaching meaningful review pressure to concepts that look more stable in drills.",
        strongestRealPlayEvidence(realPlaySignals) ?? "Real-play review spots are arriving faster than transfer is fully stabilizing.",
      ],
      teachingAdjustments: [
        "Prescribe real-hand review alongside authored reps.",
        "Frame the next plan around transfer, not just lab correctness.",
      ],
    });
  }

  const ranked = tendencies.sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
  const primary = ranked[0];
  const fallback = createNeutralAdaptiveCoachingProfile(now);

  if (!primary) {
    return fallback;
  }

  return {
    generatedAt: now.toISOString(),
    summary: primary.summary,
    tendencies: ranked,
    coachingEmphasis: {
      explanationBullets: buildExplanationBullets(ranked),
      interventionBullets: buildInterventionBullets(ranked),
      confidenceHandling: ranked.some((tendency) => tendency.key === "overconfident_threshold_player")
        ? "Keep confidence calibration visible whenever certainty outruns the result."
        : fallback.coachingEmphasis.confidenceHandling,
      recommendationFraming: ranked.some((tendency) => tendency.key === "drill_strong_real_play_weak_player")
        ? "Tie next recommendations back to real-play transfer whenever possible."
        : fallback.coachingEmphasis.recommendationFraming,
    },
    interventionAdjustments: {
      preferShorterReviewBlocks: ranked.some((tendency) => tendency.key === "review_avoidant_player"),
      prioritizeThresholdRetests: ranked.some((tendency) => tendency.key === "overconfident_threshold_player"),
      prioritizeLineReconstruction: ranked.some((tendency) => tendency.key === "line_confused_player"),
      prioritizeBlockerNotes: ranked.some((tendency) => tendency.key === "blocker_blind_player"),
      prioritizeConfidenceCalibration: ranked.some((tendency) => tendency.key === "overconfident_threshold_player"),
      prioritizeRealPlayReview: ranked.some((tendency) => tendency.key === "drill_strong_real_play_weak_player"),
    },
    surfaceSignals: {
      commandCenter: buildCommandCenterSignal(primary),
      studySession: buildStudySessionSignal(primary),
      sessionReview: buildSessionReviewSignal(primary),
      weaknessExplorer: buildWeaknessExplorerSignal(primary),
      growthProfile: buildGrowthProfileSignal(primary),
      review: buildReviewSignal(primary),
    },
  };
}

function countDiagnostics(insights: DiagnosticInsight[]): Record<DiagnosticErrorType, number> {
  const counts: Record<DiagnosticErrorType, number> = {
    line_misunderstanding: 0,
    threshold_error: 0,
    range_construction_error: 0,
    blocker_blindness: 0,
    pool_assumption_error: 0,
    confidence_miscalibration: 0,
  };

  for (const insight of insights) {
    counts[insight.errorType] += 1;
  }

  return counts;
}

function countConfidence(insights: AdaptiveConfidenceInsight[]) {
  let certainWrong = 0;
  let notSureCorrect = 0;

  for (const insight of insights) {
    if (!insight.correct && insight.confidence === "certain") {
      certainWrong += 1;
    }
    if (insight.correct && insight.confidence === "not_sure") {
      notSureCorrect += 1;
    }
  }

  return { certainWrong, notSureCorrect };
}

function hasOverconfidentConcept(concepts: AdaptiveConceptSnapshot[]): boolean {
  return concepts.some((concept) => concept.confidenceMismatch?.direction === "overconfident" && concept.confidenceMismatch.count >= 2);
}

function hasRangeShapeWeakness(concepts: AdaptiveConceptSnapshot[]): boolean {
  return concepts.some((concept) => concept.status === "weakness" && /range|construction|shape/.test(concept.conceptKey));
}

function countRangeSignals(concepts: AdaptiveConceptSnapshot[]): number {
  return concepts.filter((concept) => /range|construction|shape/.test(concept.conceptKey) && concept.trainingUrgency >= 0.5).length;
}

function hasRealPlayBlockerPressure(signals: RealPlayConceptSignal[]): boolean {
  return signals.some((signal) => /blocker/.test(signal.conceptKey) && (signal.occurrences >= 2 || signal.reviewSpotCount >= 2));
}

function countBlockerSignals(signals: RealPlayConceptSignal[]): number {
  return signals
    .filter((signal) => /blocker/.test(signal.conceptKey))
    .reduce((sum, signal) => sum + signal.occurrences + signal.reviewSpotCount, 0);
}

function hasDrillStrongRealPlayWeak(concepts: AdaptiveConceptSnapshot[], signals: RealPlayConceptSignal[]): boolean {
  return signals.some((signal) => {
    const concept = concepts.find((entry) => entry.conceptKey === signal.conceptKey || entry.conceptKey.includes(signal.conceptKey) || signal.conceptKey.includes(entry.conceptKey));
    const strongAverage = concept ? (concept.averageScore ?? 0) >= 0.62 : averageConceptScore(concepts) >= 0.62;
    return strongAverage && signal.occurrences >= 2;
  });
}

function averageConceptScore(concepts: AdaptiveConceptSnapshot[]): number {
  const values = concepts.map((concept) => concept.averageScore).filter((value): value is number => value !== undefined);
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function strongestConceptEvidence(concepts: AdaptiveConceptSnapshot[], patterns: string[]): string | undefined {
  const match = concepts
    .filter((concept) => patterns.some((pattern) => concept.conceptKey.includes(pattern)))
    .sort((a, b) => b.trainingUrgency - a.trainingUrgency || b.recurrenceCount - a.recurrenceCount)[0];

  return match?.evidence[0];
}

function strongestRealPlayEvidence(signals: RealPlayConceptSignal[]): string | undefined {
  const top = [...signals].sort((a, b) => (b.weight + b.occurrences * 0.1) - (a.weight + a.occurrences * 0.1))[0];
  return top?.evidence[0];
}

function tendencyConfidence(weight: number): number {
  return Math.max(0.35, Math.min(0.92, Math.round((0.35 + Math.min(weight, 8) * 0.07) * 100) / 100));
}

function buildExplanationBullets(tendencies: LearnerTendency[]): string[] {
  const bullets: string[] = [];

  if (tendencies.some((tendency) => tendency.key === "line_confused_player")) {
    bullets.push("Lead explanations with the street-by-street story before naming the final action.");
  }
  if (tendencies.some((tendency) => tendency.key === "blocker_blind_player")) {
    bullets.push("Bring blocker notes forward earlier instead of leaving them as a footnote.");
  }
  if (tendencies.some((tendency) => tendency.key === "range_shape_weak_player")) {
    bullets.push("Use range buckets and density framing before solver-frequency details.");
  }
  if (tendencies.some((tendency) => tendency.key === "overconfident_threshold_player")) {
    bullets.push("Anchor the explanation on practical thresholds and confidence calibration.");
  }
  if (tendencies.some((tendency) => tendency.key === "drill_strong_real_play_weak_player")) {
    bullets.push("Connect the concept back to imported hands so transfer stays visible.");
  }

  return bullets.length > 0 ? bullets : ["Keep the explanation balanced until a clearer recurring learner style is visible."];
}

function buildInterventionBullets(tendencies: LearnerTendency[]): string[] {
  const bullets: string[] = [];

  if (tendencies.some((tendency) => tendency.key === "review_avoidant_player")) {
    bullets.push("Prefer shorter, more re-enterable review loops.");
  }
  if (tendencies.some((tendency) => tendency.key === "line_confused_player")) {
    bullets.push("Let line-reconstruction reps lead before threshold retests.");
  }
  if (tendencies.some((tendency) => tendency.key === "overconfident_threshold_player")) {
    bullets.push("Add threshold retests with explicit calibration pressure.");
  }
  if (tendencies.some((tendency) => tendency.key === "drill_strong_real_play_weak_player")) {
    bullets.push("Mix real-hand review into the next intervention block.");
  }

  return bullets.length > 0 ? bullets : ["Keep interventions narrow and concept-led while the learner profile is still forming."];
}

function buildCommandCenterSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "The learner profile is still early, so today should stay anchored on the strongest live concept signal.";
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return "Frame today around practical thresholds and honest confidence checks, not just the final answer.";
    case "line_confused_player":
      return "Let the next block rebuild the street story first so each action has a clearer cause.";
    case "blocker_blind_player":
      return "Surface blocker-driven reasons early so the next reps train what actually tips the decision.";
    case "range_shape_weak_player":
      return "Keep today's focus on range shape so the action choices have a cleaner structure underneath them.";
    case "review_avoidant_player":
      return "Keep the next step short and re-enterable so review pressure gets cleared instead of avoided.";
    case "drill_strong_real_play_weak_player":
      return "Tie the next block back to imported hands so stronger drill answers transfer into real play.";
  }
}

function buildStudySessionSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "Stay with the clearest coaching adjustment from this rep.";
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return "On this rep, focus on where the threshold really flips instead of trusting the first confident read.";
    case "line_confused_player":
      return "On this rep, rebuild what each street did to the ranges before locking the action.";
    case "blocker_blind_player":
      return "On this rep, ask which value hands and bluffs your blockers actually remove.";
    case "range_shape_weak_player":
      return "On this rep, picture the value region, bluff region, and bluff-catchers before you zoom in on action.";
    case "review_avoidant_player":
      return "Keep this correction small and clear so it is easier to revisit than to postpone.";
    case "drill_strong_real_play_weak_player":
      return "Treat this rep like a transfer rehearsal for the same leak showing up in real hands.";
  }
}

function buildSessionReviewSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "Use the debrief to isolate the clearest repeat leak from the block.";
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return "Today's review should separate threshold mistakes from confidence mistakes so the next block fixes both honestly.";
    case "line_confused_player":
      return "Today's review should emphasize where the line stopped making sense from street to street.";
    case "blocker_blind_player":
      return "Today's review should keep coming back to the blocker cues that changed the bluff and value density.";
    case "range_shape_weak_player":
      return "Today's review should keep clarifying which parts of each range actually arrive here.";
    case "review_avoidant_player":
      return "Today's review should end with a smaller follow-through step so the backlog does not keep compounding.";
    case "drill_strong_real_play_weak_player":
      return "Today's review should connect the lab miss directly to real-play transfer, not treat it as an isolated drill result.";
  }
}

function buildWeaknessExplorerSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "The weakness map should stay concept-led until a clearer learner tendency separates itself.";
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return "The top leaks should be trained with more threshold retests and clearer calibration checks.";
    case "line_confused_player":
      return "The top leaks should be read as story-reconstruction problems, not just isolated answer misses.";
    case "blocker_blind_player":
      return "The top leaks should surface blocker-sensitive spots earlier in the review path.";
    case "range_shape_weak_player":
      return "The top leaks should be explained through range density and shape before action frequency.";
    case "review_avoidant_player":
      return "The top leaks should be prescribed in shorter review loops so follow-through stays realistic.";
    case "drill_strong_real_play_weak_player":
      return "The top leaks should be weighed more heavily when they now show up in imported hands too.";
  }
}

function buildGrowthProfileSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "The growth profile is still mostly concept-shaped, with only early signs of learner-specific adaptation.";
  }

  return `${primary.label} is the clearest current learning tendency, so the coaching system should keep adapting around it without overstating certainty.`;
}

function buildReviewSignal(primary: LearnerTendency | undefined): string {
  if (!primary) {
    return "Use review to reinforce the clearest conceptual correction available.";
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return "Use review to ask where the threshold actually sits, then compare that to the confidence you felt in the moment.";
    case "line_confused_player":
      return "Use review to narrate the line from street to street until the final action feels earned, not memorized.";
    case "blocker_blind_player":
      return "Use review to name the blockers that remove value or bluffs before deciding again.";
    case "range_shape_weak_player":
      return "Use review to rebuild the shape of both ranges before revisiting the action.";
    case "review_avoidant_player":
      return "Keep each review pass narrow enough that the next revisit feels manageable.";
    case "drill_strong_real_play_weak_player":
      return "Use review to connect this spot back to the real hands where the same leak is already surfacing.";
  }
}
