import type { CanonicalDrill, DrillAnswer } from "./schemas";
import { resolveDrillAnswer } from "./answer-resolution";
import type { WeaknessPool } from "./weakness-analytics";

export type DrillCoachingMode = "correct_answer" | "mistake_review" | "pool_contrast" | "next_adjustment";
export type DrillCoachTextStyle = "concise" | "standard";
export type DrillCoachResponseSource = "provider" | "fallback";

export interface DrillCoachPromptOptions {
  style?: DrillCoachTextStyle;
  tone?: "supportive" | "neutral";
}

export interface DrillCoachingInput {
  drill: Pick<CanonicalDrill, "title" | "prompt" | "scenario" | "decision_point" | "answer" | "answer_by_pool" | "tags" | "coaching_context" | "steps">;
  activePool?: WeaknessPool | null;
  resolvedAnswer?: DrillAnswer;
  userAction: string;
  userSizeBucket?: number | null;
  userTags: string[];
  score: number;
  correct: boolean;
  matchedTags: string[];
  missedTags: string[];
  actionScore?: number;
  tagScore?: number;
  sizingScore?: number;
  elapsedMs?: number;
}

export interface DrillCoachSection {
  title: string;
  bullets: string[];
}

export interface DrillCoachAuthoredTruth {
  keyConcept?: string;
  whyPreferredLineWorks?: string;
  difficultyReason?: string;
  rangeNotes: string[];
  streetChanges: Array<{ street: string; detail: string }>;
  commonMistakes: string[];
  followUpConcepts: string[];
  blockerNotes: string[];
  thresholdNotes: string[];
  rangeBuckets: string[];
}

export interface DrillCoachLlmPayload {
  kind: "drill_coaching";
  mode: DrillCoachingMode;
  activePool: WeaknessPool;
  prompt: string;
  userAction: string;
  userTags: string[];
  correct: boolean;
  score: number;
  resolvedAnswer: {
    correct: string;
    explanation: string;
    requiredTags: string[];
    strategyMix: Array<{
      action: string;
      frequencyPct: number;
      sizeBucket?: number;
      label?: string;
    }>;
  };
  authoredTruth: DrillCoachAuthoredTruth;
  poolContrast?: {
    baselineCorrect: string;
    selectedPoolCorrect: string;
    pool: WeaknessPool;
  };
  sections: DrillCoachSection[];
}

export interface DrillCoachPrompt {
  mode: DrillCoachingMode;
  activePool: WeaknessPool;
  style: DrillCoachTextStyle;
  tone: "supportive" | "neutral";
  systemPrompt: string;
  userPrompt: string;
  sections: DrillCoachSection[];
  llmPayload: DrillCoachLlmPayload;
}

export interface DrillCoachProviderResult {
  text: string;
  bullets?: string[];
  providerName: string;
  model?: string;
}

export interface DrillCoachProvider {
  generate(prompt: DrillCoachPrompt): Promise<DrillCoachProviderResult>;
}

export interface DrillCoachResponse {
  mode: DrillCoachingMode;
  activePool: WeaknessPool;
  source: DrillCoachResponseSource;
  headline: string;
  text: string;
  bullets: string[];
  sections: Array<{ title: string; text: string }>;
  llmPayload: DrillCoachLlmPayload;
  providerName?: string;
  model?: string;
}

export function buildCorrectAnswerCoachPrompt(
  input: DrillCoachingInput,
  options: DrillCoachPromptOptions = {}
): DrillCoachPrompt {
  return buildDrillCoachPrompt(input, "correct_answer", options, [
    "Explain why the correct answer is right.",
    "Identify the core concepts or tags that mattered.",
    "Tell the player what to internalize for the next similar spot.",
  ]);
}

export function buildMistakeCoachPrompt(
  input: DrillCoachingInput,
  options: DrillCoachPromptOptions = {}
): DrillCoachPrompt {
  return buildDrillCoachPrompt(input, "mistake_review", options, [
    "Explain why the submitted answer was wrong or incomplete.",
    "Point out the concept or exploit logic that was missed.",
    "Keep the explanation grounded in the supplied scoring and answer data.",
  ]);
}

export function buildPoolContrastCoachPrompt(
  input: DrillCoachingInput,
  options: DrillCoachPromptOptions = {}
): DrillCoachPrompt {
  return buildDrillCoachPrompt(input, "pool_contrast", options, [
    "Contrast the baseline answer with the selected-pool answer when they differ.",
    "Explain what exploit assumption causes the answer shift.",
    "If there is no meaningful contrast, say that clearly instead of inventing one.",
  ]);
}

export function buildNextAdjustmentCoachPrompt(
  input: DrillCoachingInput,
  options: DrillCoachPromptOptions = {}
): DrillCoachPrompt {
  return buildDrillCoachPrompt(input, "next_adjustment", options, [
    "Explain what the player should do differently next time.",
    "Suggest the concept or spot family to review next.",
    "Keep the advice specific and coach-like.",
  ]);
}

export async function generateDrillCoachResponse(args: {
  input: DrillCoachingInput;
  mode: DrillCoachingMode;
  provider?: DrillCoachProvider;
  options?: DrillCoachPromptOptions;
}): Promise<DrillCoachResponse> {
  const prompt = buildPromptByMode(args.input, args.mode, args.options);
  if (!args.provider) {
    return buildFallbackDrillCoachResponse({ input: args.input, mode: args.mode, options: args.options });
  }

  try {
    const result = await args.provider.generate(prompt);
    return {
      mode: prompt.mode,
      activePool: prompt.activePool,
      source: "provider",
      headline: buildDrillCoachHeadline(args.input, args.mode),
      text: result.text,
      bullets: result.bullets ?? prompt.sections.flatMap((section) => section.bullets).slice(0, 5),
      sections: prompt.sections.map((section) => ({ title: section.title, text: section.bullets.join(" ") })),
      llmPayload: prompt.llmPayload,
      providerName: result.providerName,
      model: result.model,
    };
  } catch {
    return buildFallbackDrillCoachResponse({ input: args.input, mode: args.mode, options: args.options });
  }
}

export function buildFallbackDrillCoachResponse(args: {
  input: DrillCoachingInput;
  mode: DrillCoachingMode;
  options?: DrillCoachPromptOptions;
}): DrillCoachResponse {
  const prompt = buildPromptByMode(args.input, args.mode, args.options);
  const sections = prompt.sections.map((section) => ({ title: section.title, text: section.bullets.join(" ") }));
  const intro = buildDrillCoachIntro(args.input, args.mode);
  const headline = buildDrillCoachHeadline(args.input, args.mode);
  const text = [intro, headline, ...sections.map((section) => `${section.title}: ${section.text}`)].join("\n\n");

  return {
    mode: prompt.mode,
    activePool: prompt.activePool,
    source: "fallback",
    headline,
    text,
    bullets: prompt.sections.flatMap((section) => section.bullets).slice(0, 5),
    sections,
    llmPayload: prompt.llmPayload,
  };
}

function buildPromptByMode(
  input: DrillCoachingInput,
  mode: DrillCoachingMode,
  options: DrillCoachPromptOptions = {}
): DrillCoachPrompt {
  switch (mode) {
    case "correct_answer":
      return buildCorrectAnswerCoachPrompt(input, options);
    case "mistake_review":
      return buildMistakeCoachPrompt(input, options);
    case "pool_contrast":
      return buildPoolContrastCoachPrompt(input, options);
    case "next_adjustment":
      return buildNextAdjustmentCoachPrompt(input, options);
  }
}

function buildDrillCoachPrompt(
  input: DrillCoachingInput,
  mode: DrillCoachingMode,
  options: DrillCoachPromptOptions,
  instructions: string[]
): DrillCoachPrompt {
  const sections = buildDrillCoachSections(input, mode);
  const activePool = input.activePool ?? "baseline";
  const style = options.style ?? "standard";
  const tone = options.tone ?? "supportive";

  return {
    mode,
    activePool,
    style,
    tone,
    systemPrompt: [
      "You are Poker Coach OS, a precise poker decision coach.",
      "Use the supplied drill outcome as the source of truth.",
      "Do not re-score the hand or invent logic outside the structured input.",
      "Keep the response practical, direct, and encouraging.",
    ].join(" "),
    userPrompt: [
      `Mode: ${mode}. Pool: ${activePool}. Tone: ${tone}. Style: ${style}.`,
      ...instructions,
      "Use the provided sections to explain the hand in coach-like language.",
    ].join(" "),
    sections,
    llmPayload: buildDrillCoachLlmPayload(input, mode, sections),
  };
}

function buildDrillCoachSections(input: DrillCoachingInput, mode: DrillCoachingMode): DrillCoachSection[] {
  const activePool = input.activePool ?? "baseline";
  const resolvedAnswer = input.resolvedAnswer ?? resolveDrillAnswer(input.drill, activePool);
  const baselineAnswer = resolveDrillAnswer(input.drill, "baseline");
  const poolContrastAvailable = activePool !== "baseline" && hasMeaningfulPoolContrast(baselineAnswer, resolvedAnswer);
  const authoredTruth = buildAuthoredTruth(input);

  const conceptBullets = [
    authoredTruth.keyConcept
      ? `Key concept: ${authoredTruth.keyConcept}`
      : `Core answer: ${firstSentence(resolvedAnswer.explanation)}`,
    authoredTruth.whyPreferredLineWorks
      ? `Why the line works: ${authoredTruth.whyPreferredLineWorks}`
      : `The line is anchored by ${resolvedAnswer.required_tags[0] ?? "the main strategic trigger"}, but the explanation should stay tied to the hand logic, not the tag name alone.`,
    authoredTruth.difficultyReason
      ? `Why the spot is difficult: ${authoredTruth.difficultyReason}`
      : undefined,
  ].filter(isPresent);

  const rangeBullets = [
    input.drill.coaching_context?.range_context
      ? input.drill.coaching_context.range_context
      : firstSentence(resolvedAnswer.explanation),
    ...authoredTruth.rangeBuckets.slice(0, 2),
    ...authoredTruth.rangeNotes.slice(0, 2),
    authoredTruth.thresholdNotes[0],
    authoredTruth.blockerNotes[0],
    buildRangeReasoning(input, resolvedAnswer),
  ].filter(isPresent);

  const mistakeBullets = input.correct
    ? [
        `Your action matched the accepted answer set for this spot.`,
        input.matchedTags.length > 0
          ? `You reinforced these concepts cleanly: ${input.matchedTags.join(", ")}.`
          : `You found the action, and the next value comes from locking in the strategic reason behind it.`,
      ]
    : [
        `You chose ${formatAction(input.userAction, input.userSizeBucket)}, but the resolved answer is ${formatAction(resolvedAnswer.correct, resolvedAnswer.correct_size?.size_bucket ?? null)}.`,
        authoredTruth.commonMistakes[0]
          ? `Common mistake: ${authoredTruth.commonMistakes[0]}`
          : input.missedTags.length > 0
            ? `The miss showed up most clearly in ${input.missedTags.join(", ")}.`
            : `The action missed even though the tag evidence was thin, so the review should stay on line logic and range pressure.`,
      ];

  const streetStoryBullets = authoredTruth.streetChanges.map((entry) => `${toTitleCase(entry.street)}: ${entry.detail}`);

  const poolBullets = poolContrastAvailable
    ? [
        `Baseline would use ${formatAction(baselineAnswer.correct, baselineAnswer.correct_size?.size_bucket ?? null)}, while Pool ${activePool} uses ${formatAction(resolvedAnswer.correct, resolvedAnswer.correct_size?.size_bucket ?? null)}.`,
        input.drill.coaching_context?.population_note
          ? `The exploit assumption is: ${input.drill.coaching_context.population_note}`
          : `The pool shift changes the expected bluff/value mix enough to change the decision.`,
      ]
    : [
        activePool === "baseline"
          ? "This hand is already being coached from the baseline line, so no separate pool contrast applies here."
          : `This drill does not materially change from baseline in Pool ${activePool}.`,
      ];

  const nextBullets = [
    input.correct
      ? `Next time, keep anchoring first on ${resolvedAnswer.required_tags[0] ?? "the strategic trigger"}, then confirm that the line still makes sense for the range interaction.`
      : `Next time, pause on the range interaction before committing to ${formatAction(input.userAction, input.userSizeBucket)}.`,
    input.drill.coaching_context?.follow_up
      ? `Follow-up: ${input.drill.coaching_context.follow_up}`
      : `Review more spots with ${resolvedAnswer.required_tags.slice(0, 2).join(" and ") || "the same concept family"}.`,
    authoredTruth.followUpConcepts.length > 0
      ? `Reinforce next: ${authoredTruth.followUpConcepts.join(", ")}.`
      : undefined,
  ].filter(isPresent);

  const sections: DrillCoachSection[] = [];

  if (mode === "correct_answer" || mode === "mistake_review") {
    sections.push({ title: "Decision Review", bullets: mistakeBullets });
    if (streetStoryBullets.length > 0) {
      sections.push({ title: "Street Story", bullets: streetStoryBullets });
    }
    sections.push({ title: "Range Logic", bullets: rangeBullets.slice(0, 4) });
    sections.push({ title: "Concept Focus", bullets: conceptBullets.slice(0, 3) });
  }

  if (mode === "pool_contrast" || poolContrastAvailable) {
    sections.push({ title: "Pool Contrast", bullets: poolBullets });
  }

  if (mode === "next_adjustment" || mode === "mistake_review") {
    sections.push({ title: "Next Adjustment", bullets: nextBullets });
  }

  if (sections.length === 0) {
    if (streetStoryBullets.length > 0) {
      sections.push({ title: "Street Story", bullets: streetStoryBullets });
    }
    sections.push({ title: "Range Logic", bullets: rangeBullets.slice(0, 4) });
    sections.push({ title: "Concept Focus", bullets: conceptBullets.slice(0, 3) });
  }

  return sections;
}

function buildDrillCoachLlmPayload(
  input: DrillCoachingInput,
  mode: DrillCoachingMode,
  sections: DrillCoachSection[]
): DrillCoachLlmPayload {
  const activePool = input.activePool ?? "baseline";
  const resolvedAnswer = input.resolvedAnswer ?? resolveDrillAnswer(input.drill, activePool);
  const baselineAnswer = resolveDrillAnswer(input.drill, "baseline");
  const poolContrast = activePool !== "baseline" && hasMeaningfulPoolContrast(baselineAnswer, resolvedAnswer)
    ? {
        baselineCorrect: baselineAnswer.correct,
        selectedPoolCorrect: resolvedAnswer.correct,
        pool: activePool,
      }
    : undefined;

  return {
    kind: "drill_coaching",
    mode,
    activePool,
    prompt: input.drill.prompt,
    userAction: formatAction(input.userAction, input.userSizeBucket ?? null),
    userTags: input.userTags,
    correct: input.correct,
    score: input.score,
    resolvedAnswer: {
      correct: resolvedAnswer.correct,
      explanation: resolvedAnswer.explanation,
      requiredTags: resolvedAnswer.required_tags,
      strategyMix: (resolvedAnswer.strategy_mix ?? []).map((entry) => ({
        action: entry.action,
        frequencyPct: entry.frequency_pct,
        sizeBucket: entry.size_bucket,
        label: entry.label,
      })),
    },
    authoredTruth: buildAuthoredTruth(input),
    poolContrast,
    sections,
  };
}

function buildDrillCoachIntro(input: DrillCoachingInput, mode: DrillCoachingMode): string {
  const activePool = input.activePool ?? "baseline";
  if (mode === "pool_contrast") {
    return activePool === "baseline"
      ? "Coach view: this spot is being taught from the baseline line, so the job is to anchor the core concept clearly."
      : `Coach view: this spot is useful because Pool ${activePool} can change how the answer should be interpreted.`;
  }

  if (input.correct) {
    return "Coach view: you found the right action, so the goal is to lock in why it works.";
  }

  return "Coach view: the action missed, so the goal is to identify what assumption or range interaction slipped.";
}

function buildDrillCoachHeadline(input: DrillCoachingInput, mode: DrillCoachingMode): string {
  const activePool = input.activePool ?? "baseline";
  const resolvedAnswer = input.resolvedAnswer ?? resolveDrillAnswer(input.drill, activePool);
  const explanationLead = firstSentence(resolvedAnswer.explanation);
  const authoredTruth = buildAuthoredTruth(input);

  switch (mode) {
    case "correct_answer":
      return `${formatAction(resolvedAnswer.correct, resolvedAnswer.correct_size?.size_bucket ?? null)} works because ${lowercaseFirst(authoredTruth.whyPreferredLineWorks ?? explanationLead)}`;
    case "mistake_review":
      return input.correct
        ? "The action landed correctly, and the next step is locking in the range logic behind it."
        : authoredTruth.commonMistakes[0]
          ? `The miss came from ${lowercaseFirst(authoredTruth.commonMistakes[0])}`
          : `The miss came from the line logic in this node: ${lowercaseFirst(explanationLead)}`;
    case "pool_contrast":
      return activePool === "baseline"
        ? "This drill does not need a pool contrast to explain the decision."
        : `Pool ${activePool} matters here because the exploit assumption can shift the correct line.`;
    case "next_adjustment":
      return authoredTruth.followUpConcepts[0]
        ? `Next time, stabilize ${toTitleCase(authoredTruth.followUpConcepts[0])} before you commit.`
        : "Next time, let the range logic drive the action before you commit.";
  }
}

function buildRangeReasoning(input: DrillCoachingInput, resolvedAnswer: DrillAnswer): string {
  const decisionTag = input.drill.tags.find((tag) => tag.startsWith("decision:"));

  if (decisionTag === "decision:bluff_catch") {
    return input.drill.scenario.street === "river"
      ? "On the river, the call or fold is about final value density versus missed bluffs, not just whether your hand looks strong in isolation."
      : "Bluff-catching decisions depend on whether the line still contains enough bluffs by the time money goes in.";
  }

  if (decisionTag === "decision:value_bet") {
    return "Value betting works when enough worse hands continue and the line is not so top-heavy that stronger hands dominate the action.";
  }

  if (decisionTag === "decision:bluff") {
    return "A bluff needs both fold equity and enough natural value in the same line to stay credible.";
  }

  return `Strategically, ${lowercaseFirst(firstSentence(resolvedAnswer.explanation))}`;
}

function buildAuthoredTruth(input: DrillCoachingInput): DrillCoachAuthoredTruth {
  const context = input.drill.coaching_context;
  return {
    keyConcept: context?.key_concept,
    whyPreferredLineWorks: context?.why_preferred_line_works,
    difficultyReason: context?.difficulty_reason,
    rangeNotes: [
      ...(context?.range_notes ?? []),
      ...(context?.range_context ? [context.range_context] : []),
    ].filter(uniqueStrings),
    streetChanges: context?.what_changed_by_street?.map((entry) => ({ street: entry.street, detail: entry.detail })) ?? [],
    commonMistakes: [
      ...(context?.common_mistakes ?? []),
      ...(context?.common_mistake ? [context.common_mistake] : []),
    ].filter(uniqueStrings),
    followUpConcepts: [
      ...(context?.follow_up_concepts ?? []),
      ...(context?.follow_up ? [context.follow_up] : []),
    ].filter(uniqueStrings),
    blockerNotes: [...(context?.range_support?.blocker_notes ?? [])].filter(uniqueStrings),
    thresholdNotes: [...(context?.range_support?.threshold_notes ?? [])].filter(uniqueStrings),
    rangeBuckets: [
      ...summarizeRangeBuckets("Value region", context?.range_support?.value_buckets),
      ...summarizeRangeBuckets("Bluff region", context?.range_support?.bluff_buckets),
      ...summarizeRangeBuckets("Bluff catchers", context?.range_support?.bluff_catchers),
      ...summarizeRangeBuckets("Combo groups", context?.range_support?.combo_groups),
      ...(context?.range_support?.hero_hand_bucket
        ? [`${context.range_support.hero_hand_bucket.label}: ${context.range_support.hero_hand_bucket.summary}`]
        : []),
    ].filter(uniqueStrings),
  };
}

function hasMeaningfulPoolContrast(baselineAnswer: DrillAnswer, selectedAnswer: DrillAnswer): boolean {
  return baselineAnswer.correct !== selectedAnswer.correct
    || baselineAnswer.required_tags.join("|") !== selectedAnswer.required_tags.join("|")
    || baselineAnswer.explanation !== selectedAnswer.explanation;
}

function formatAction(action: string, sizeBucket: number | null | undefined): string {
  return sizeBucket ? `${action} ${sizeBucket}%` : action;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text;
}

function lowercaseFirst(text: string): string {
  return text.length > 0 ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null && `${value}`.trim().length > 0;
}

function uniqueStrings(value: string, index: number, items: string[]): boolean {
  return items.indexOf(value) === index;
}

function summarizeRangeBuckets(
  title: string,
  buckets: Array<{ label: string; combos: string[]; frequency_hint?: string }> | undefined
): string[] {
  return (buckets ?? []).map((bucket) => {
    const combos = bucket.combos.join(", ");
    return bucket.frequency_hint
      ? `${title}: ${bucket.label} (${bucket.frequency_hint}) -> ${combos}`
      : `${title}: ${bucket.label} -> ${combos}`;
  });
}
