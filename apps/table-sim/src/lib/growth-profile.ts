import {
  buildInterventionPlan,
  formatPlanningReason,
  type AttemptInsight,
  type CanonicalDrill,
  type DiagnosticInsight,
  type InterventionHistoryEntry,
  type InterventionPlan,
  type PlayerDiagnosisHistoryEntry,
  type RealPlayConceptSignal,
  type WeaknessPool,
} from "@poker-coach/core/browser";
import { buildWeaknessExplorerSnapshot, type WeaknessExplorerSnapshot } from "./weakness-explorer";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";

export interface GrowthProfileAttempt {
  drillId: string;
  nodeId: string;
  title: string;
  score: number;
  correct: boolean;
  ts: string;
  elapsedMs: number;
  activePool: WeaknessPool | null;
}

export interface GrowthProfileSnapshot {
  generatedAt: string;
  header: {
    headline: string;
    summary: string;
    direction: string;
  };
  progressSnapshot: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  strengths: Array<{
    label: string;
    detail: string;
    tone: "good" | "neutral";
  }>;
  weakSpots: Array<{
    label: string;
    detail: string;
    tone: "warning" | "neutral";
    recommendedPool: WeaknessPool;
  }>;
  movement: Array<{
    label: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  practiceIdentity: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  interventionSuccess: Array<{
    label: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  conceptRecovery: Array<{
    label: string;
    detail: string;
    tone: "good" | "warning" | "neutral";
  }>;
  recurringLeaks: Array<{
    label: string;
    detail: string;
    tone: "warning" | "neutral";
  }>;
  coachPerspective: {
    encouragingTruth: string;
    limitingFactor: string;
    recommendation: string;
  };
  interventionRecommendation?: {
    plan: InterventionPlan;
    href: string;
  };
  nextActions: Array<{
    label: string;
    detail: string;
    href: string;
  }>;
}

export function buildGrowthProfileSnapshot(args: {
  drills: CanonicalDrill[];
  attempts: GrowthProfileAttempt[];
  attemptInsights: AttemptInsight[];
  srs: Array<{ drill_id: string; due_at: string }>;
  activePool: WeaknessPool;
  diagnosticInsights?: DiagnosticInsight[];
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}): GrowthProfileSnapshot {
  const now = args.now ?? new Date();
  const interventionHistory = args.interventionHistory ?? [];
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    diagnosticInsights: args.diagnosticInsights,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory,
    realPlaySignals: args.realPlaySignals,
    now,
  });
  const weaknessExplorer = buildWeaknessExplorerSnapshot({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    realPlaySignals: args.realPlaySignals,
    now,
  });
  const windowSize = Math.max(3, Math.min(12, Math.floor(args.attempts.length / 2)));
  const recentWindow = args.attempts.slice(0, windowSize);
  const previousWindow = args.attempts.slice(windowSize, windowSize * 2);
  const overallAverage = average(args.attempts.map((attempt) => attempt.score));
  const recentAverage = average(recentWindow.map((attempt) => attempt.score));
  const previousAverage = average(previousWindow.map((attempt) => attempt.score));
  const delta = previousWindow.length > 0 ? recentAverage - previousAverage : 0;
  const strengthLeaders = (playerIntelligence.strengths.length > 0
    ? playerIntelligence.strengths
    : playerIntelligence.concepts.filter((concept) => concept.status !== "weakness")).slice(0, 3);
  const weakSpots = playerIntelligence.priorities.filter((spot) => spot.status === "weakness").slice(0, 3);
  const cadence = buildCadenceProfile(args.attempts, now);
  const pace = buildPaceProfile(args.attempts);
  const poolSpread = buildPoolProfile(args.attempts);
  const movement = buildMovementCards(delta, strengthLeaders, weaknessExplorer);
  const activeStrength = strengthLeaders[0]?.label ?? "No clear strength yet";
  const activeWeakness = weakSpots[0]?.label ?? "No clear weak spot yet";
  const interventionPlan = buildInterventionPlan({
    playerIntelligence,
    recentAttempts: args.attempts.map((attempt) => ({
      drillId: attempt.drillId,
      nodeId: attempt.nodeId,
      title: attempt.title,
      score: attempt.score,
      correct: attempt.correct,
      ts: attempt.ts,
      activePool: attempt.activePool,
    })),
    activePool: args.activePool,
    now,
  });
  const adaptive = playerIntelligence.adaptiveProfile;
  const primaryTendency = adaptive.tendencies[0];
  const dueReviewCount = args.srs.filter((row) => new Date(row.due_at) <= now).length;
  const practiceIdentity: GrowthProfileSnapshot["practiceIdentity"] = [
    {
      label: "Training rhythm",
      value: cadence.label,
      detail: cadence.identityDetail,
      tone: cadence.tone,
    },
    {
      label: "Decision pace",
      value: pace.value,
      detail: pace.detail,
      tone: pace.tone,
    },
    {
      label: "Review load",
      value: `${dueReviewCount} due`,
      detail: buildReviewLoadDetail(args.srs, now),
      tone: dueReviewCount > 6 ? "warning" : "neutral",
    },
    {
      label: "Context spread",
      value: poolSpread.value,
      detail: poolSpread.detail,
      tone: poolSpread.tone,
    },
    {
      label: "Coaching emphasis",
      value: primaryTendency?.label ?? "Balanced coaching",
      detail: adaptive.surfaceSignals.growthProfile,
      tone: primaryTendency ? "good" : "neutral",
    },
  ];

  return {
    generatedAt: now.toISOString(),
    header: {
      headline: buildHeadline(delta, overallAverage, cadence),
      summary: buildHeaderSummary(delta, activeStrength, activeWeakness, cadence, adaptive.summary),
      direction: buildDirectionLabel(delta),
    },
    progressSnapshot: [
      {
        label: "Recent direction",
        value: buildDirectionLabel(delta),
        detail: previousWindow.length > 0
          ? `Recent score quality moved from ${Math.round(previousAverage * 100)}% to ${Math.round(recentAverage * 100)}% across the last two windows.`
          : "Not enough history yet to compare two recent windows honestly.",
        tone: delta > 0.05 ? "good" : delta < -0.05 ? "warning" : "neutral",
      },
      {
        label: "Practice cadence",
        value: cadence.label,
        detail: cadence.detail,
        tone: cadence.tone,
      },
      {
        label: "Strongest active area",
        value: activeStrength,
        detail: strengthLeaders[0]?.evidence[0] ?? "No concept family has enough clean history yet to separate as a true strength.",
        tone: strengthLeaders[0] ? "good" : "neutral",
      },
      {
        label: "Weakest active area",
        value: activeWeakness,
        detail: weakSpots[0]
          ? `${weakSpots[0].evidence[0] ?? weakSpots[0].summary} Recovery stage: ${weakSpots[0].recoveryStage.replace(/_/g, " ")}.`
          : "No weakness cluster has enough evidence yet to lead long-term planning.",
        tone: weakSpots[0] ? "warning" : "neutral",
      },
    ],
    strengths: strengthLeaders.map((strength) => ({
      label: strength.label,
      detail: strength.evidence[0] ?? `${strength.label} is one of the steadiest current areas.`,
      tone: "good",
    })),
    weakSpots: weakSpots.map((spot) => ({
      label: spot.label,
      detail: `${spot.evidence[0] ?? spot.summary} Recovery stage: ${spot.recoveryStage.replace(/_/g, " ")}. Lead reason: ${spot.planningReasons[0] ? formatPlanningReason(spot.planningReasons[0]).toLowerCase() : "weakness balance"}.`,
      tone: "warning",
      recommendedPool: spot.recommendedPool,
    })),
    movement,
    practiceIdentity: practiceIdentity.slice(0, 5),
    interventionSuccess: buildInterventionSuccess(interventionHistory, playerIntelligence.memory.interventionSuccessRate),
    conceptRecovery: buildConceptRecovery(playerIntelligence.concepts, interventionHistory),
    recurringLeaks: buildRecurringLeaks(playerIntelligence.memory.recurringLeakConcepts, weakSpots),
    coachPerspective: {
      encouragingTruth: strengthLeaders[0]
        ? `${strengthLeaders[0].label} is becoming a real anchor in your game, which means improvement is not just theoretical.`
        : "You have enough work logged that real signals are starting to emerge, even if the profile is still early.",
      limitingFactor: weakSpots[0]
        ? weakSpots[0].recoveryStage === "regressed"
          ? `${weakSpots[0].label} improved once but slipped back, so the system should reopen repair instead of pretending the concept is done.`
          : weakSpots[0].weaknessRole === "downstream" && weakSpots[0].supportingConceptKeys[0]
            ? `${weakSpots[0].label} keeps showing up, but ${weakSpots[0].supportingConceptKeys[0].replace(/_/g, " ")} may be the upstream limiter.`
            : `${weakSpots[0].label} is still the main constraint on the next stage of growth because it keeps recurring instead of fading.`
        : "The biggest current limitation is still sample depth rather than one sharply defined leak.",
      recommendation: `${interventionPlan.nextSessionFocus} ${adaptive.surfaceSignals.growthProfile}`,
    },
    interventionRecommendation: {
      plan: interventionPlan,
      href: `/app/training/session/${interventionPlan.id}`,
    },
    nextActions: buildNextActions(weaknessExplorer, interventionPlan),
  };
}

function buildHeadline(delta: number, overallAverage: number, cadence: ReturnType<typeof buildCadenceProfile>): string {
  if (delta > 0.05 && cadence.tone === "good") {
    return "Your profile shows steady forward movement with a real practice rhythm behind it.";
  }
  if (delta < -0.05) {
    return "Your profile is still productive, but the recent direction is softer than the earlier window.";
  }
  if (overallAverage >= 0.65) {
    return "Your profile looks stable, with clear strengths holding while a smaller set of leaks still limits the ceiling.";
  }
  return "Your profile is still forming, but the core strengths and limiting leaks are now visible enough to guide the next stage.";
}

function buildHeaderSummary(
  delta: number,
  activeStrength: string,
  activeWeakness: string,
  cadence: ReturnType<typeof buildCadenceProfile>,
  adaptiveSummary: string
): string {
  const direction = delta > 0.05
    ? "Recent play is moving in the right direction"
    : delta < -0.05
      ? "Recent play has softened"
      : "Recent play is broadly stable";

  return `${direction}. ${activeStrength} is currently the strongest part of the profile, while ${activeWeakness.toLowerCase()} is still the main drag. ${cadence.identityDetail} ${adaptiveSummary}`;
}

function buildDirectionLabel(delta: number): string {
  if (delta > 0.05) return "Trending up";
  if (delta < -0.05) return "Needs reinforcement";
  return "Stable build";
}

function buildMovementCards(
  delta: number,
  strengthLeaders: ReturnType<typeof buildTableSimPlayerIntelligence>["strengths"],
  weaknessExplorer: WeaknessExplorerSnapshot
): GrowthProfileSnapshot["movement"] {
  const cards: GrowthProfileSnapshot["movement"] = [];
  cards.push({
    label: buildDirectionLabel(delta),
    detail: delta > 0.05
      ? "The most recent work is outperforming the prior window, which is the cleanest sign of actual forward movement available right now."
      : delta < -0.05
        ? "The recent window softened against the earlier one, so the next stage should prioritize reinforcement over expansion."
        : "Recent work is moving in a relatively narrow band, so progress is more about consistency than a breakout jump.",
    tone: delta > 0.05 ? "good" : delta < -0.05 ? "warning" : "neutral",
  });

  const improving = weaknessExplorer.movementSignals.find((signal) => signal.label.startsWith("Improving:"));
  const worsening = weaknessExplorer.movementSignals.find((signal) => signal.label.startsWith("Worsening:"));
  const stable = weaknessExplorer.movementSignals.find((signal) => signal.label.startsWith("Stable:"));
  if (improving) cards.push(improving);
  if (worsening) cards.push(worsening);
  if (!improving && !worsening && stable) cards.push(stable);

  if (strengthLeaders[0]) {
    cards.push({
      label: `Holding up: ${strengthLeaders[0].label}`,
      detail: strengthLeaders[0].evidence[0] ?? `${strengthLeaders[0].label} is still one of the steadiest areas in the profile.`,
      tone: "good",
    });
  }

  return cards.slice(0, 4);
}

function buildCadenceProfile(attempts: GrowthProfileAttempt[], now: Date) {
  const last14 = attempts.filter((attempt) => daysBetween(now, new Date(attempt.ts)) < 14);
  const activeDays = new Set(last14.map((attempt) => attempt.ts.slice(0, 10))).size;
  const repsPerDay = activeDays > 0 ? last14.length / activeDays : 0;

  if (activeDays >= 5) {
    return {
      label: "Steady rhythm",
      detail: `${activeDays} active days in the last two weeks with ${repsPerDay.toFixed(1)} reps per active day.`,
      identityDetail: "You are building a repeatable practice rhythm instead of relying on isolated bursts.",
      tone: "good" as const,
    };
  }
  if (activeDays >= 2) {
    return {
      label: "Intermittent but alive",
      detail: `${activeDays} active days in the last two weeks with ${repsPerDay.toFixed(1)} reps per active day.`,
      identityDetail: "The training habit is active, but it still comes in waves more than a steady rhythm.",
      tone: "neutral" as const,
    };
  }
  return {
    label: "Sparse cadence",
    detail: last14.length > 0
      ? `${activeDays} active day in the last two weeks, so the profile is being shaped by small samples.`
      : "No recent attempts are stored in the last two weeks.",
    identityDetail: "The biggest opportunity right now may be consistency of work rather than finer-grained technical tuning.",
    tone: "warning" as const,
  };
}

function buildPaceProfile(attempts: GrowthProfileAttempt[]) {
  if (attempts.length === 0) {
    return { value: "No pace data", detail: "Decision pace will appear once enough attempt history exists.", tone: "neutral" as const };
  }
  const recent = attempts.slice(0, 12);
  const averageSeconds = average(recent.map((attempt) => attempt.elapsedMs / 1000));
  if (averageSeconds <= 18) {
    return { value: `${averageSeconds.toFixed(1)}s`, detail: "Recent decisions are moving with decent tempo without collapsing into a rush.", tone: "good" as const };
  }
  if (averageSeconds <= 35) {
    return { value: `${averageSeconds.toFixed(1)}s`, detail: "Recent pace is measured and deliberate, which fits a study block more than a speed test.", tone: "neutral" as const };
  }
  return { value: `${averageSeconds.toFixed(1)}s`, detail: "Recent pace is slow enough that the next stage may be about making the right reads feel more automatic.", tone: "warning" as const };
}

function buildPoolProfile(attempts: GrowthProfileAttempt[]) {
  if (attempts.length === 0) {
    return { value: "No context yet", detail: "Pool/context spread will appear once more history is logged.", tone: "neutral" as const };
  }
  const counts = new Map<string, number>();
  for (const attempt of attempts.slice(0, 24)) {
    const key = attempt.activePool ?? "baseline";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const lead = ranked[0];
  if (!lead) {
    return { value: "No context yet", detail: "Pool/context spread will appear once more history is logged.", tone: "neutral" as const };
  }
  return {
    value: lead[0] === "baseline" ? "Baseline-led" : `Pool ${lead[0]}-led`,
    detail: ranked.length > 1
      ? `Recent work leans toward ${lead[0] === "baseline" ? "baseline" : `Pool ${lead[0]}`}, but still includes other contexts.`
      : `Recent work has mostly stayed in ${lead[0] === "baseline" ? "baseline" : `Pool ${lead[0]}`}, so the profile reflects a narrower context lens.`,
    tone: ranked.length > 1 ? "good" as const : "neutral" as const,
  };
}

function buildReviewLoadDetail(srs: Array<{ drill_id: string; due_at: string }>, now: Date): string {
  const due = srs.filter((row) => new Date(row.due_at) <= now).length;
  if (due === 0) return "Review pressure is currently light, so the next block can be guided more by weakness shape than by backlog.";
  if (due <= 4) return `${due} review reps are due, which is enough to matter without overwhelming the next plan.`;
  return `${due} review reps are due, so follow-through on reinforcement is now part of the growth picture, not just raw performance.`;
}

function buildInterventionSuccess(
  interventionHistory: InterventionHistoryEntry[],
  successRate: number | null
): GrowthProfileSnapshot["interventionSuccess"] {
  const completed = interventionHistory.filter((entry) => entry.status === "completed");
  const improved = completed.filter((entry) => entry.improved === true).length;
  const regressed = interventionHistory.filter((entry) => entry.status === "regressed").length;
  const items: GrowthProfileSnapshot["interventionSuccess"] = [
    {
      label: "Intervention success",
      detail: completed.length > 0
        ? `${improved} of ${completed.length} completed interventions produced a measurable score lift.${successRate !== null ? ` Success rate: ${Math.round(successRate * 100)}%.` : ""}${regressed > 0 ? ` ${regressed} concept${regressed === 1 ? " has" : "s have"} since regressed.` : ""}`
        : "No completed interventions are stored yet, so success tracking will appear after the first coaching block closes.",
      tone: successRate === null ? "neutral" as const : successRate >= 0.5 ? "good" as const : "warning" as const,
    },
    ...completed.slice(0, 2).map((entry) => ({
      label: formatConcept(entry.conceptKey),
      detail: entry.preScore !== null && entry.preScore !== undefined && entry.postScore !== null && entry.postScore !== undefined
        ? `Intervention completed with scores moving from ${Math.round(entry.preScore * 100)}% to ${Math.round(entry.postScore * 100)}%.`
        : "Completed intervention is logged for this concept.",
      tone: entry.improved === true ? "good" as const : entry.improved === false ? "warning" as const : "neutral" as const,
    })),
  ];
  return items.slice(0, 3);
}

function buildConceptRecovery(
  concepts: ReturnType<typeof buildTableSimPlayerIntelligence>["concepts"],
  interventionHistory: InterventionHistoryEntry[]
): GrowthProfileSnapshot["conceptRecovery"] {
  const conceptDriven = concepts
    .filter((concept) => concept.recoveryStage !== "unaddressed")
    .sort((a, b) => b.trainingUrgency - a.trainingUrgency)
    .slice(0, 3)
    .map((concept) => ({
      label: concept.label,
      detail: `Recovery stage: ${concept.recoveryStage.replace(/_/g, " ")}. Planning reasons: ${concept.planningReasons.map((reason) => formatPlanningReason(reason).toLowerCase()).join(", ")}.`,
      tone: concept.recoveryStage === "recovered" ? "good" as const : concept.recoveryStage === "regressed" ? "warning" as const : "neutral" as const,
    }));

  if (conceptDriven.length > 0) {
    return conceptDriven;
  }

  return interventionHistory
    .filter((entry) => entry.status === "completed" || entry.status === "stabilizing" || entry.status === "regressed")
    .slice(0, 3)
    .map((entry) => ({
      label: formatConcept(entry.conceptKey),
      detail: entry.status === "regressed"
        ? "This concept improved once but has since regressed, so it is back under active recovery pressure."
        : entry.status === "stabilizing"
          ? "This concept is in a stabilizing window, so the next step is to verify that the gain holds."
          : "This concept has a completed intervention on record and remains part of the recovery picture.",
      tone: entry.status === "regressed" ? "warning" as const : entry.improved === true ? "good" as const : "neutral" as const,
    }));
}

function buildRecurringLeaks(recurringLeakConcepts: string[], weakSpots: ReturnType<typeof buildTableSimPlayerIntelligence>["priorities"]): GrowthProfileSnapshot["recurringLeaks"] {
  const recurring = recurringLeakConcepts.map((conceptKey) => ({
    label: formatConcept(conceptKey),
    detail: "This concept keeps showing up across persisted diagnoses, so it is part of the recurring leak picture rather than a one-off miss.",
    tone: "warning" as const,
  }));
  if (recurring.length > 0) {
    return recurring.slice(0, 3);
  }
  return weakSpots.slice(0, 3).map((spot) => ({
    label: spot.label,
    detail: `${spot.evidence[0] ?? spot.summary} Lead reason: ${spot.planningReasons[0] ? formatPlanningReason(spot.planningReasons[0]).toLowerCase() : "weakness balance"}.`,
    tone: "warning" as const,
  }));
}

function buildNextActions(weaknessExplorer: WeaknessExplorerSnapshot, interventionPlan: InterventionPlan): GrowthProfileSnapshot["nextActions"] {
  const actions: GrowthProfileSnapshot["nextActions"] = [
    {
      label: "Return to Command Center",
      detail: "Use the latest profile context to choose the next deliberate block from home base.",
      href: "/app/session",
    },
    {
      label: "Open coach intervention",
      detail: `${interventionPlan.recommendedSessionTitle} is the clearest next prescription from the current profile.`,
      href: `/app/training/session/${interventionPlan.id}`,
    },
  ];

  if (weaknessExplorer.priorityWeaknesses[0]) {
    actions.unshift({
      label: `Explore ${weaknessExplorer.priorityWeaknesses[0].label}`,
      detail: "Open the Weakness Explorer to inspect the top limiting area in more detail before you train it.",
      href: "/app/weaknesses",
    });
  }

  actions.push({
    label: "Review recent mistakes",
    detail: "Use the review surface if you want the latest misses before starting another block.",
    href: "/app/review",
  });
  actions.push({
    label: "Review imported hands",
    detail: "Inspect the real-play hands feeding concept and intervention pressure.",
    href: "/app/hands",
  });

  return actions.slice(0, 4);
}

function formatConcept(value: string): string {
  return value.split(/[_:\-\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

