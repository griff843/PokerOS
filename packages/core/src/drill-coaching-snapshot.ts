import { resolveDrillAnswer } from "./answer-resolution";
import {
  buildFallbackDrillCoachResponse,
  type DrillCoachResponse,
  type DrillCoachingInput,
  type DrillCoachingMode,
} from "./drill-coach";
import type { AdaptiveCoachingProfile } from "./adaptive-coaching";
import type { WeaknessPool } from "./weakness-analytics";

export interface DrillCoachingMoment {
  title: string;
  headline: string;
  detail: string;
}

export interface DrillCoachingVerdict {
  label: string;
  headline: string;
  detail: string;
  tone: "good" | "warning";
}

export interface DrillCoachingExploitContrast {
  applies: boolean;
  selectedPool: WeaknessPool;
  headline: string;
  detail: string;
  baselineAction: string | null;
  selectedPoolAction: string | null;
}

export interface DrillCoachingSnapshot {
  correct: boolean;
  activePool: WeaknessPool;
  verdict: DrillCoachingVerdict;
  adaptiveContext: DrillCoachingMoment | null;
  whyCorrect: DrillCoachingMoment;
  whyMistake: DrillCoachingMoment | null;
  keyConcept: DrillCoachingMoment;
  nextAdjustment: DrillCoachingMoment;
  exploitContrast: DrillCoachingExploitContrast;
  concepts: {
    requiredTags: string[];
    matchedTags: string[];
    missedTags: string[];
  };
  responses: Record<DrillCoachingMode, DrillCoachResponse>;
}

export function buildDrillCoachingSnapshot(
  input: DrillCoachingInput,
  adaptiveProfile?: AdaptiveCoachingProfile
): DrillCoachingSnapshot {
  const activePool = input.activePool ?? "baseline";
  const resolvedAnswer = input.resolvedAnswer ?? resolveDrillAnswer(input.drill, activePool);
  const normalizedInput = { ...input, activePool, resolvedAnswer };
  const responses: Record<DrillCoachingMode, DrillCoachResponse> = {
    correct_answer: buildFallbackDrillCoachResponse({ input: normalizedInput, mode: "correct_answer" }),
    mistake_review: buildFallbackDrillCoachResponse({ input: normalizedInput, mode: "mistake_review" }),
    pool_contrast: buildFallbackDrillCoachResponse({ input: normalizedInput, mode: "pool_contrast" }),
    next_adjustment: buildFallbackDrillCoachResponse({ input: normalizedInput, mode: "next_adjustment" }),
  };

  const correctAnswer = responses.correct_answer;
  const mistakeReview = responses.mistake_review;
  const nextAdjustment = responses.next_adjustment;
  const poolContrast = responses.pool_contrast;
  const authoredTruth = correctAnswer.llmPayload.authoredTruth;
  const emphasis = buildAdaptiveEmphasis(authoredTruth, adaptiveProfile, input.correct);

  const whyCorrect = buildMoment(
    "Why The Right Line Works",
    correctAnswer.headline,
    mergeDetail(emphasis.whyCorrect, pickSectionText(correctAnswer, ["Range Logic", "Concept Focus", "Decision Review"]))
  );

  const whyMistake = input.correct
    ? null
    : buildMoment(
        "Why Your Answer Missed",
        mistakeReview.headline,
        mergeDetail(emphasis.whyMistake, pickSectionText(mistakeReview, ["Decision Review", "Range Logic", "Concept Focus"]))
      );

  const keyConceptHeadline = authoredTruth.keyConcept
    ? `Key concept: ${authoredTruth.keyConcept}`
    : `Key concept: ${formatTag(resolvedAnswer.required_tags[0] ?? "core trigger")}`;
  const keyConceptDetail = authoredTruth.whyPreferredLineWorks
    ?? pickSectionText(correctAnswer, ["Concept Focus", "Range Logic"]);

  return {
    correct: input.correct,
    activePool,
    verdict: buildVerdict(input, whyCorrect, whyMistake, nextAdjustment, emphasis.verdict),
    adaptiveContext: emphasis.context,
    whyCorrect,
    whyMistake,
    keyConcept: buildMoment("Key Concept", keyConceptHeadline, mergeDetail(emphasis.keyConcept, keyConceptDetail)),
    nextAdjustment: buildMoment(
      "Remember Next Time",
      nextAdjustment.headline,
      mergeDetail(emphasis.nextAdjustment, pickSectionText(nextAdjustment, ["Next Adjustment", "Concept Focus"]))
    ),
    exploitContrast: {
      applies: Boolean(poolContrast.llmPayload.poolContrast),
      selectedPool: activePool,
      headline: poolContrast.headline,
      detail: mergeDetail(emphasis.exploitContrast, pickSectionText(poolContrast, ["Pool Contrast"])),
      baselineAction: poolContrast.llmPayload.poolContrast?.baselineCorrect ?? null,
      selectedPoolAction: poolContrast.llmPayload.poolContrast?.selectedPoolCorrect ?? null,
    },
    concepts: {
      requiredTags: [...resolvedAnswer.required_tags],
      matchedTags: [...input.matchedTags],
      missedTags: [...input.missedTags],
    },
    responses,
  };
}

function buildVerdict(
  input: DrillCoachingInput,
  whyCorrect: DrillCoachingMoment,
  whyMistake: DrillCoachingMoment | null,
  nextAdjustment: DrillCoachResponse,
  adaptiveLead?: string
): DrillCoachingVerdict {
  if (input.correct) {
    return {
      label: "Correct line",
      headline: whyCorrect.headline,
      detail: mergeDetail(adaptiveLead, pickSectionText(nextAdjustment, ["Next Adjustment", "Decision Review"])),
      tone: "good",
    };
  }

  return {
    label: "Adjustment needed",
    headline: whyMistake?.headline ?? "This decision needs a cleaner range-based correction.",
    detail: mergeDetail(adaptiveLead, pickSectionText(nextAdjustment, ["Next Adjustment", "Decision Review"])),
    tone: "warning",
  };
}

function buildAdaptiveEmphasis(
  authoredTruth: DrillCoachResponse["llmPayload"]["authoredTruth"],
  adaptiveProfile: AdaptiveCoachingProfile | undefined,
  correct: boolean
): {
  context: DrillCoachingMoment | null;
  verdict?: string;
  whyCorrect?: string;
  whyMistake?: string;
  keyConcept?: string;
  nextAdjustment?: string;
  exploitContrast?: string;
} {
  if (!adaptiveProfile || adaptiveProfile.tendencies.length === 0) {
    return { context: null };
  }

  const reminder = adaptiveProfile.surfaceSignals.studySession;
  const emphasisNotes = adaptiveProfile.coachingEmphasis.explanationBullets.slice(0, 2).join(" ");
  const cues = adaptiveProfile.coachingEmphasis.interventionBullets[0] ?? adaptiveProfile.coachingEmphasis.recommendationFraming;
  const pieces: Array<{ key: string; text: string }> = [];

  if (adaptiveProfile.interventionAdjustments.prioritizeLineReconstruction && authoredTruth.streetChanges[0]) {
    pieces.push({
      key: "story",
      text: `Street story first: ${authoredTruth.streetChanges.map((entry) => `${toTitleCase(entry.street)} ${entry.detail}`).join(" ")}`,
    });
  }

  if (adaptiveProfile.interventionAdjustments.prioritizeBlockerNotes && authoredTruth.blockerNotes[0]) {
    pieces.push({
      key: "blocker",
      text: `Blocker focus: ${authoredTruth.blockerNotes[0]}`,
    });
  }

  if (adaptiveProfile.interventionAdjustments.prioritizeThresholdRetests) {
    pieces.push({
      key: "threshold",
      text: authoredTruth.thresholdNotes[0]
        ? `Threshold focus: ${authoredTruth.thresholdNotes[0]}`
        : "Threshold focus: make the combo boundary explicit before you trust the action label.",
    });
  }

  if (authoredTruth.rangeBuckets[0]) {
    pieces.push({
      key: "range",
      text: `Range shape: ${authoredTruth.rangeBuckets[0]}`,
    });
  }

  if (adaptiveProfile.interventionAdjustments.prioritizeConfidenceCalibration && !correct) {
    pieces.push({
      key: "calibration",
      text: `Calibration note: ${adaptiveProfile.coachingEmphasis.confidenceHandling}`,
    });
  }

  if (adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview) {
    pieces.push({
      key: "transfer",
      text: `Transfer note: ${adaptiveProfile.coachingEmphasis.recommendationFraming}`,
    });
  }

  const leadNotes = pieces.slice(0, 2).map((piece) => piece.text).join(" ");

  return {
    context: buildMoment("Coaching Lens", adaptiveProfile.tendencies[0]?.label ?? "Learner-specific emphasis", `${reminder} ${cues}`.trim()),
    verdict: reminder,
    whyCorrect: leadNotes || emphasisNotes,
    whyMistake: leadNotes || emphasisNotes,
    keyConcept: emphasisNotes,
    nextAdjustment: `${adaptiveProfile.coachingEmphasis.recommendationFraming} ${cues}`.trim(),
    exploitContrast: adaptiveProfile.interventionAdjustments.prioritizeRealPlayReview ? "Keep the exploit shift tied back to practical transfer, not just the lab answer." : undefined,
  };
}

function buildMoment(title: string, headline: string, detail: string): DrillCoachingMoment {
  return { title, headline, detail };
}

function pickSectionText(response: DrillCoachResponse, preferredTitles: string[]): string {
  const picked = preferredTitles
    .map((title) => response.sections.find((section) => section.title === title)?.text)
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  if (picked.length > 0) {
    return picked.join(" ");
  }

  return response.sections.map((section) => section.text).join(" ").trim() || response.text;
}

function mergeDetail(prefix: string | undefined, detail: string): string {
  return prefix ? `${prefix} ${detail}`.trim() : detail;
}

function formatTag(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
