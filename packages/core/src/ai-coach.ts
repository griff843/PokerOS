import type {
  CompletedSessionSummary,
  LlmSummaryPayload,
  NextFocusSummary,
  PlannedSessionSummary,
  SummarySection,
  StudySummaryTone,
  WeaknessSummary,
} from "./study-summary";
import type { WeaknessPool } from "./weakness-analytics";

export type CoachMode = "planned_session" | "completed_session" | "weakness_focus" | "next_focus";
export type CoachTextStyle = "concise" | "standard";
export type CoachResponseSource = "provider" | "fallback";
export type CoachSummaryInput = PlannedSessionSummary | CompletedSessionSummary | WeaknessSummary | NextFocusSummary;

export interface CoachPromptSection {
  title: string;
  bullets: string[];
}

export interface CoachPrompt {
  mode: CoachMode;
  activePool: WeaknessPool;
  tone: StudySummaryTone;
  style: CoachTextStyle;
  headline: string;
  systemPrompt: string;
  userPrompt: string;
  sections: CoachPromptSection[];
  llmPayload: LlmSummaryPayload;
}

export interface CoachPromptOptions {
  tone?: StudySummaryTone;
  style?: CoachTextStyle;
}

export interface CoachProviderResult {
  text: string;
  bullets?: string[];
  providerName: string;
  model?: string;
}

export interface CoachProvider {
  generate(prompt: CoachPrompt): Promise<CoachProviderResult>;
}

export interface CoachResponseSection {
  title: string;
  text: string;
}

export interface CoachResponse {
  mode: CoachMode;
  activePool: WeaknessPool;
  source: CoachResponseSource;
  headline: string;
  text: string;
  bullets: string[];
  sections: CoachResponseSection[];
  llmPayload: LlmSummaryPayload;
  providerName?: string;
  model?: string;
}

export function buildPlannedSessionCoachPrompt(
  summary: PlannedSessionSummary,
  options: CoachPromptOptions = {}
): CoachPrompt {
  return buildCoachPrompt(summary, options, [
    "Explain why this session was built this way.",
    "Mention review/new balance and whether weaknesses or pool-specific targets were prioritized.",
    "Tell the player what to focus on before starting.",
  ]);
}

export function buildCompletedSessionCoachPrompt(
  summary: CompletedSessionSummary,
  options: CoachPromptOptions = {}
): CoachPrompt {
  return buildCoachPrompt(summary, options, [
    "Explain how the player performed using the supplied structured summary.",
    "Call out one strength and one weakness clearly.",
    "Mention pool-specific issues only if the summary indicates them.",
  ]);
}

export function buildNextFocusCoachPrompt(
  summary: NextFocusSummary,
  options: CoachPromptOptions = {}
): CoachPrompt {
  return buildCoachPrompt(summary, options, [
    "Recommend what the player should study next.",
    "Say whether they should stay in the same pool or broaden.",
    "Keep the advice practical and tied to the supplied recommendations.",
  ]);
}

export function buildWeaknessCoachPrompt(
  summary: WeaknessSummary,
  options: CoachPromptOptions = {}
): CoachPrompt {
  return buildCoachPrompt(summary, options, [
    "Explain the most important current weaknesses from the supplied summary.",
    "Contrast overall and pool-specific weakness signals where relevant.",
    "Keep the explanation coach-like but consistent with the structured data.",
  ]);
}

export async function generateCoachResponse(args: {
  summary: CoachSummaryInput;
  provider?: CoachProvider;
  options?: CoachPromptOptions;
}): Promise<CoachResponse> {
  const prompt = buildPromptForSummary(args.summary, args.options);
  if (!args.provider) {
    return buildFallbackCoachResponse(args.summary, args.options);
  }

  try {
    const result = await args.provider.generate(prompt);
    return {
      mode: prompt.mode,
      activePool: prompt.activePool,
      source: "provider",
      headline: prompt.headline,
      text: result.text,
      bullets: result.bullets ?? prompt.sections.flatMap((section) => section.bullets).slice(0, 4),
      sections: prompt.sections.map((section) => ({
        title: section.title,
        text: section.bullets.join(" "),
      })),
      llmPayload: prompt.llmPayload,
      providerName: result.providerName,
      model: result.model,
    };
  } catch {
    return buildFallbackCoachResponse(args.summary, args.options);
  }
}

export function buildFallbackCoachResponse(
  summary: CoachSummaryInput,
  options: CoachPromptOptions = {}
): CoachResponse {
  const prompt = buildPromptForSummary(summary, options);
  const sections = prompt.sections.map((section) => ({
    title: section.title,
    text: section.bullets.join(" "),
  }));
  const bullets = prompt.sections.flatMap((section) => section.bullets).slice(0, 4);
  const intro = buildCoachIntro(summary.kind, summary.activePool);
  const text = [intro, summary.headline, ...sections.map((section) => `${section.title}: ${section.text}`)].join("\n\n");

  return {
    mode: prompt.mode,
    activePool: prompt.activePool,
    source: "fallback",
    headline: summary.headline,
    text,
    bullets,
    sections,
    llmPayload: prompt.llmPayload,
  };
}

function buildPromptForSummary(summary: CoachSummaryInput, options: CoachPromptOptions = {}): CoachPrompt {
  switch (summary.kind) {
    case "planned_session":
      return buildPlannedSessionCoachPrompt(summary, options);
    case "completed_session":
      return buildCompletedSessionCoachPrompt(summary, options);
    case "weakness_focus":
      return buildWeaknessCoachPrompt(summary, options);
    case "next_focus":
      return buildNextFocusCoachPrompt(summary, options);
  }
}

function buildCoachPrompt(
  summary: CoachSummaryInput,
  options: CoachPromptOptions,
  instructions: string[]
): CoachPrompt {
  const tone = options.tone ?? summary.llmPayload.tone;
  const style = options.style ?? "standard";
  const sections = summary.sections.map((section) => ({
    title: section.title,
    bullets: section.bullets,
  }));

  return {
    mode: summary.kind,
    activePool: summary.activePool,
    tone,
    style,
    headline: summary.headline,
    systemPrompt: [
      "You are Poker Coach OS, a concise poker study coach.",
      "Use the structured summary exactly as the source of truth.",
      "Do not invent analytics or contradict the supplied summary.",
      "Keep the response practical, direct, and encouraging.",
    ].join(" "),
    userPrompt: [
      `Mode: ${summary.kind}.`,
      `Pool: ${summary.activePool}.`,
      `Tone: ${tone}. Style: ${style}.`,
      ...instructions,
      "Return a short coach-style explanation grounded in the supplied sections and highlights.",
    ].join(" "),
    sections,
    llmPayload: summary.llmPayload,
  };
}

function buildCoachIntro(mode: CoachMode, activePool: WeaknessPool): string {
  switch (mode) {
    case "planned_session":
      return activePool === "baseline"
        ? "Coach view: this session was built to balance review pressure with your current overall leaks."
        : `Coach view: this session was built to sharpen your ${activePool} pool adjustments without losing core review structure.`;
    case "completed_session":
      return activePool === "baseline"
        ? "Coach view: this session gives us a clean read on your current baseline fundamentals."
        : `Coach view: this session tells us how well your decisions are holding up in Pool ${activePool}.`;
    case "weakness_focus":
      return activePool === "baseline"
        ? "Coach view: your current weakness picture is mostly about overall pattern recognition and execution."
        : `Coach view: your current weakness picture separates overall leaks from Pool ${activePool}-specific leaks.`;
    case "next_focus":
      return "Coach view: the next step should stay narrow enough to reinforce what matters most right now.";
  }
}
