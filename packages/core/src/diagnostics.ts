import type { CanonicalDrill, DiagnosticErrorType, DiagnosticPrompt, DiagnosticPromptType } from "./schemas";

export interface DiagnosticCaptureInput {
  drill: Pick<CanonicalDrill, "diagnostic_prompts" | "coaching_context" | "tags">;
  correct: boolean;
  confidence: "not_sure" | "pretty_sure" | "certain";
  promptId?: string | null;
  optionId: string;
}

export interface DiagnosticCaptureResult {
  promptId: string;
  prompt: string;
  promptType: DiagnosticPromptType;
  concept?: string;
  conceptKey: string;
  expectedReasoning: string;
  optionId: string;
  optionLabel: string;
  matchedExpectedReasoning: boolean;
  errorType: DiagnosticErrorType | null;
  confidenceMiscalibration: boolean;
  headline: string;
  detail: string;
  nextFocus: string;
}

export interface DiagnosticInsight {
  conceptKey: string;
  concept?: string;
  errorType: DiagnosticErrorType;
  confidenceMiscalibration: boolean;
}

const DEFAULT_CONCEPT_BY_TYPE: Record<DiagnosticPromptType, string> = {
  line_understanding: "line understanding",
  threshold: "river defense thresholds",
  range_construction: "range construction",
  blocker: "blocker effects",
  pool_assumption: "population pressure",
  street_shift: "board connectivity",
  mix_reasoning: "threshold reasoning",
};

const DEFAULT_ERROR_BY_TYPE: Record<DiagnosticPromptType, DiagnosticErrorType> = {
  line_understanding: "line_misunderstanding",
  threshold: "threshold_error",
  range_construction: "range_construction_error",
  blocker: "blocker_blindness",
  pool_assumption: "pool_assumption_error",
  street_shift: "line_misunderstanding",
  mix_reasoning: "threshold_error",
};

export function getPrimaryDiagnosticPrompt(
  drill: Pick<CanonicalDrill, "diagnostic_prompts">
): DiagnosticPrompt | null {
  const prompts = drill.diagnostic_prompts ?? [];
  return prompts.find((prompt) => (prompt.options?.length ?? 0) >= 2) ?? prompts[0] ?? null;
}

export function buildDiagnosticCapture(input: DiagnosticCaptureInput): DiagnosticCaptureResult | null {
  const prompt = resolveDiagnosticPrompt(input.drill, input.promptId);
  if (!prompt || !prompt.options || prompt.options.length === 0) {
    return null;
  }

  const option = prompt.options.find((entry) => entry.id === input.optionId);
  if (!option) {
    return null;
  }

  const matchedExpectedReasoning = option.matches_expected ?? false;
  const confidenceMiscalibration = (!input.correct && input.confidence === "certain")
    || (input.correct && input.confidence === "not_sure");
  const concept = prompt.concept ?? DEFAULT_CONCEPT_BY_TYPE[prompt.type];
  const conceptKey = normalizeDiagnosticConceptKey(concept);
  const derivedError = option.diagnosis
    ?? (!input.correct || !matchedExpectedReasoning ? DEFAULT_ERROR_BY_TYPE[prompt.type] : null);
  const errorType = confidenceMiscalibration && !derivedError
    ? "confidence_miscalibration"
    : derivedError;

  return {
    promptId: prompt.id,
    prompt: prompt.prompt,
    promptType: prompt.type,
    concept,
    conceptKey,
    expectedReasoning: prompt.expected_reasoning,
    optionId: option.id,
    optionLabel: option.label,
    matchedExpectedReasoning,
    errorType,
    confidenceMiscalibration,
    headline: buildHeadline({ correct: input.correct, matchedExpectedReasoning, errorType, concept }),
    detail: buildDetail({ correct: input.correct, prompt, optionLabel: option.label, matchedExpectedReasoning, errorType, confidenceMiscalibration }),
    nextFocus: buildNextFocus(concept, errorType, confidenceMiscalibration),
  };
}

export function toDiagnosticInsight(result: DiagnosticCaptureResult | null | undefined): DiagnosticInsight | null {
  if (!result?.errorType) {
    return result?.confidenceMiscalibration
      ? {
          conceptKey: result.conceptKey,
          concept: result.concept,
          errorType: "confidence_miscalibration",
          confidenceMiscalibration: true,
        }
      : null;
  }

  return {
    conceptKey: result.conceptKey,
    concept: result.concept,
    errorType: result.errorType,
    confidenceMiscalibration: result.confidenceMiscalibration,
  };
}

export function normalizeDiagnosticConceptKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "reasoning";
}

export function formatDiagnosticErrorLabel(errorType: DiagnosticErrorType): string {
  return errorType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveDiagnosticPrompt(
  drill: Pick<CanonicalDrill, "diagnostic_prompts">,
  promptId?: string | null
): DiagnosticPrompt | null {
  const prompts = drill.diagnostic_prompts ?? [];
  if (promptId) {
    return prompts.find((prompt) => prompt.id === promptId) ?? null;
  }

  return getPrimaryDiagnosticPrompt(drill);
}

function buildHeadline(args: {
  correct: boolean;
  matchedExpectedReasoning: boolean;
  errorType: DiagnosticErrorType | null;
  concept: string;
}): string {
  if (args.correct && args.matchedExpectedReasoning) {
    return `You matched the right reasoning and the right action in ${args.concept}.`;
  }

  if (!args.correct && args.matchedExpectedReasoning) {
    return `You saw the right pressure point in ${args.concept}, but the final action still missed.`;
  }

  if (args.errorType) {
    return `This reads more like ${formatDiagnosticErrorLabel(args.errorType).toLowerCase()} than a simple answer miss.`;
  }

  return `The action landed, but the reasoning still needs one more pass through ${args.concept}.`;
}

function buildDetail(args: {
  correct: boolean;
  prompt: DiagnosticPrompt;
  optionLabel: string;
  matchedExpectedReasoning: boolean;
  errorType: DiagnosticErrorType | null;
  confidenceMiscalibration: boolean;
}): string {
  const expectation = `Expected reasoning: ${args.prompt.expected_reasoning}.`;
  const selected = `You chose: ${args.optionLabel}.`;
  const diagnosis = args.errorType
    ? `Coach diagnosis: ${formatDiagnosticErrorLabel(args.errorType)}.`
    : args.matchedExpectedReasoning
      ? "Coach diagnosis: your reasoning matched the authored trigger."
      : "Coach diagnosis: the action landed, but the reasoning signal stayed shaky.";
  const calibration = args.confidenceMiscalibration
    ? "Confidence was also out of line with the outcome, so calibration should be part of the review."
    : null;

  if (!args.correct && args.matchedExpectedReasoning) {
    return [
      selected,
      expectation,
      "You identified the right strategic feature, but the combo still got placed on the wrong side of the decision.",
      diagnosis,
      calibration,
    ].filter(Boolean).join(" ");
  }

  return [selected, expectation, diagnosis, calibration].filter(Boolean).join(" ");
}

function buildNextFocus(
  concept: string,
  errorType: DiagnosticErrorType | null,
  confidenceMiscalibration: boolean
): string {
  if (errorType === "threshold_error") {
    return `Revisit ${concept} with more attention on which combos actually survive the threshold.`;
  }

  if (errorType === "blocker_blindness") {
    return `Revisit ${concept} by asking which value and bluff combos this hand removes before choosing a line.`;
  }

  if (errorType === "pool_assumption_error") {
    return `Revisit ${concept} by separating baseline range truth from pool-specific assumptions.`;
  }

  if (confidenceMiscalibration) {
    return `Keep ${concept} in the next block, but spend one beat checking whether your confidence matches the actual evidence.`;
  }

  return `Reinforce ${concept} with one more review pass before expanding to adjacent spots.`;
}
