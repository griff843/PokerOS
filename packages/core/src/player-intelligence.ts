import type { CanonicalDrill } from "./schemas";
import type { AttemptInsight, WeaknessPool, WeaknessScope } from "./weakness-analytics";
import type { DiagnosticInsight } from "./diagnostics";
import type { RealPlayConceptSignal } from "./real-hands";
import type { AdaptiveCoachingProfile } from "./adaptive-coaching";
import { buildAdaptiveCoachingProfile } from "./adaptive-coaching";
import {
  buildPlanningReasons,
  deriveConceptRecoveryStage,
  scorePlanningReasons,
  type ConceptRecoveryStage,
  type InterventionLifecycleStatus,
  type SessionPlanningReason,
} from "./coaching-memory";
import {
  buildCoachingPatternSnapshot,
  selectPatternsForConcept,
  type CoachingPatternSnapshot,
  type PatternAttemptSignal,
  type PatternConceptState,
} from "./patterns";
import {
  buildConceptGraph,
  collectDrillConceptSources,
  getSupportedConcepts,
  getSupportingConcepts,
  mapSignalToConceptKeys,
  type ConceptGraph,
} from "./concept-graph";

export interface ConfidenceInsight {
  confidence: "not_sure" | "pretty_sure" | "certain";
  correct: boolean;
  classificationTags?: string[];
  missedTags?: string[];
}

export interface PlayerConceptSnapshot {
  conceptKey: string;
  label: string;
  summary: string;
  scope: WeaknessScope;
  recommendedPool: WeaknessPool;
  sampleSize: number;
  recentAverage?: number;
  averageScore?: number;
  recurrenceCount: number;
  failedCount: number;
  reviewPressure: number;
  trend?: {
    direction: "improving" | "worsening" | "stable";
    delta: number;
    detail: string;
  };
  confidenceMismatch?: {
    direction: "overconfident" | "underconfident";
    count: number;
    detail: string;
  };
  trainingUrgency: number;
  status: "strength" | "watch" | "weakness";
  weaknessRole: "none" | "primary" | "upstream" | "downstream";
  recoveryStage: ConceptRecoveryStage;
  planningReasons: SessionPlanningReason[];
  interventionStatus?: InterventionLifecycleStatus;
  directSignalKeys: string[];
  relatedConceptKeys: string[];
  supportingConceptKeys: string[];
  supportedConceptKeys: string[];
  inferredFrom: string[];
  evidence: string[];
  relatedDrills: Array<{
    drillId: string;
    title: string;
    nodeId: string;
  }>;
}

export interface PlayerRecommendation {
  conceptKey: string;
  label: string;
  rationale: string;
  recommendedPool: WeaknessPool;
  emphasis: "review" | "expand" | "pool_focus" | "stabilize";
  urgency: number;
  weaknessRole: PlayerConceptSnapshot["weaknessRole"];
  explainability: string[];
}

export interface PlayerDiagnosisHistoryEntry {
  conceptKey: string;
  diagnosticType: string;
  confidence: number;
  createdAt: string;
}

export interface InterventionHistoryEntry {
  id: string;
  conceptKey: string;
  source: string;
  status: InterventionLifecycleStatus;
  createdAt: string;
  improved?: boolean | null;
  preScore?: number | null;
  postScore?: number | null;
  evaluationWindow?: string | null;
  outcomeCreatedAt?: string | null;
}

export interface PlayerMemorySummary {
  diagnosisCount: number;
  activeInterventions: number;
  completedInterventions: number;
  interventionSuccessRate: number | null;
  recurringLeakConcepts: string[];
  recoveredConcepts: string[];
  regressedConcepts: string[];
  stabilizingConcepts: string[];
}

export interface PlayerIntelligenceSnapshot {
  generatedAt: string;
  activePool: WeaknessPool;
  graph: ConceptGraph;
  concepts: PlayerConceptSnapshot[];
  priorities: PlayerConceptSnapshot[];
  strengths: PlayerConceptSnapshot[];
  recommendations: PlayerRecommendation[];
  adaptiveProfile: AdaptiveCoachingProfile;
  memory: PlayerMemorySummary;
  patterns: CoachingPatternSnapshot;
}

interface ConceptAccumulator {
  allScores: number[];
  recurrenceCount: number;
  failedCount: number;
  directSignalKeys: Set<string>;
  diagnosticCounts: Map<string, number>;
}

const MIN_POOL_SAMPLE = 2;

export function buildPlayerIntelligenceSnapshot(args: {
  drills: CanonicalDrill[];
  attemptInsights: AttemptInsight[];
  srs?: Array<{ drill_id: string; due_at: string }>;
  activePool?: WeaknessPool;
  confidenceInsights?: ConfidenceInsight[];
  diagnosticInsights?: DiagnosticInsight[];
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  patternAttempts?: PatternAttemptSignal[];
  now?: Date;
}): PlayerIntelligenceSnapshot {
  const now = args.now ?? new Date();
  const activePool = args.activePool ?? "baseline";
  const graph = buildConceptGraph(args.drills);
  const dueDrillIds = new Set(
    (args.srs ?? [])
      .filter((row) => new Date(row.due_at).getTime() <= now.getTime())
      .map((row) => row.drill_id)
  );
  const drillConcepts = buildDrillConceptIndex(args.drills);
  const realPlaySignalMap = new Map((args.realPlaySignals ?? []).map((signal) => [signal.conceptKey, signal]));
  const diagnosisHistory = args.diagnosisHistory ?? [];
  const interventionHistory = args.interventionHistory ?? [];

  const snapshots = graph.nodes
    .map((node) =>
      buildConceptSnapshot({
        conceptKey: node.key,
        label: node.label,
        summary: node.summary,
        graph,
        attemptInsights: args.attemptInsights,
        drills: args.drills,
        drillConcepts,
        dueDrillIds,
        activePool,
        confidenceInsights: args.confidenceInsights ?? [],
        diagnosticInsights: args.diagnosticInsights ?? [],
        diagnosisHistory: diagnosisHistory.filter((entry) => entry.conceptKey === node.key),
        interventionHistory: interventionHistory.filter((entry) => entry.conceptKey === node.key),
        realPlaySignal: realPlaySignalMap.get(node.key),
      })
    )
    .filter((snapshot): snapshot is PlayerConceptSnapshot => Boolean(snapshot));

  const roleAssignedSnapshots = assignWeaknessRoles(graph, snapshots);
  const sortedConcepts = roleAssignedSnapshots.sort(compareConceptSnapshots);
  const patterns = buildCoachingPatternSnapshot({
    attempts: args.patternAttempts ?? [],
    diagnoses: diagnosisHistory.map((entry) => ({
      conceptKey: entry.conceptKey,
      diagnosticType: entry.diagnosticType,
      confidence: entry.confidence,
      createdAt: entry.createdAt,
    })),
    interventions: interventionHistory.map((entry) => ({
      id: entry.id,
      conceptKey: entry.conceptKey,
      source: entry.source,
      status: entry.status,
      createdAt: entry.createdAt,
      improved: entry.improved,
      preScore: entry.preScore,
      postScore: entry.postScore,
      outcomeCreatedAt: entry.outcomeCreatedAt,
    })),
    concepts: sortedConcepts.map((concept) => toPatternConceptState(concept)),
    realPlaySignals: args.realPlaySignals,
    now,
  });
  const priorities = sortedConcepts
    .filter((snapshot) => snapshot.status === "weakness" || snapshot.trainingUrgency >= 0.35)
    .sort(compareConceptSnapshots)
    .slice(0, 8);
  const strengths = [...sortedConcepts]
    .filter((snapshot) => snapshot.status === "strength")
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0) || b.sampleSize - a.sampleSize)
    .slice(0, 5);
  const adaptiveProfile = buildAdaptiveCoachingProfile({
    concepts: sortedConcepts,
    attemptInsights: args.attemptInsights,
    confidenceInsights: args.confidenceInsights,
    diagnosticInsights: args.diagnosticInsights,
    realPlaySignals: args.realPlaySignals,
    dueReviewCount: dueDrillIds.size,
    activePool,
    now,
  });
  const memory = buildPlayerMemorySummary({ diagnosisHistory, interventionHistory });

  return {
    generatedAt: now.toISOString(),
    activePool,
    graph,
    concepts: sortedConcepts,
    priorities,
    strengths,
    recommendations: buildPlayerRecommendations({ activePool, priorities, strengths, adaptiveProfile, patterns }),
    adaptiveProfile,
    memory,
    patterns,
  };
}

export function buildPlayerRecommendations(args: {
  activePool: WeaknessPool;
  priorities: PlayerConceptSnapshot[];
  strengths?: PlayerConceptSnapshot[];
  adaptiveProfile?: AdaptiveCoachingProfile;
  limit?: number;
  patterns?: CoachingPatternSnapshot;
}): PlayerRecommendation[] {
  const limit = args.limit ?? 3;
  const recommendations: PlayerRecommendation[] = [];
  const lead = args.priorities.find((snapshot) => snapshot.status === "weakness");
  const leadPatterns = lead && args.patterns
    ? selectPatternsForConcept(args.patterns.patterns, lead.conceptKey)
    : [];

  if (lead) {
    recommendations.push({
      conceptKey: lead.conceptKey,
      label: lead.evidence.some((entry) => entry.includes("active intervention"))
        ? `Continue ${lead.label}`
        : lead.weaknessRole === "downstream" && lead.supportingConceptKeys[0]
          ? `Repair ${toTitleCase(lead.supportingConceptKeys[0])}`
          : `Train ${lead.label}`,
      rationale: buildRecommendationRationale(lead, leadPatterns),
      recommendedPool: lead.recommendedPool,
      emphasis: lead.scope === "pool" ? "pool_focus" : lead.weaknessRole === "upstream" || lead.reviewPressure > 0 ? "review" : "stabilize",
      urgency: lead.trainingUrgency,
      weaknessRole: lead.weaknessRole,
      explainability: lead.evidence.slice(0, 3),
    });
  }

  if (lead) {
    recommendations.push({
      conceptKey: lead.conceptKey,
      label: lead.reviewPressure > 0 ? "Let review lead" : "Run a reinforcement block",
      rationale: lead.reviewPressure > 0
        ? `${lead.reviewPressure} related drills are already due, so retention pressure and concept repair point in the same direction.`
        : "The concept signal is live enough that the next block should stay narrow instead of expanding broadly.",
      recommendedPool: lead.recommendedPool,
      emphasis: "review",
      urgency: lead.trainingUrgency,
      weaknessRole: lead.weaknessRole,
      explainability: lead.evidence.slice(0, 2),
    });
  }

  const adaptiveRecommendation = buildAdaptiveRecommendation(args.adaptiveProfile, args.activePool);
  if (adaptiveRecommendation) {
    recommendations.push(adaptiveRecommendation);
  }

  const strengthAnchor = args.strengths?.[0];
  if (strengthAnchor) {
    recommendations.push({
      conceptKey: strengthAnchor.conceptKey,
      label: "Expand from a strength anchor",
      rationale: `${strengthAnchor.label} is holding up best, so selective expansion can stay near that family without losing coaching continuity.`,
      recommendedPool: args.activePool,
      emphasis: "expand",
      urgency: Math.max(0.2, 1 - strengthAnchor.trainingUrgency),
      weaknessRole: "none",
      explainability: strengthAnchor.evidence.slice(0, 2),
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      conceptKey: "balanced_reinforcement",
      label: "Build more signal",
      rationale: "There is not enough concept-level history yet, so another balanced block is the honest next step.",
      recommendedPool: args.activePool,
      emphasis: "stabilize",
      urgency: 0.2,
      weaknessRole: "none",
      explainability: ["Concept evidence is still sparse, so the system should avoid pretending it has a sharp read."],
    });
  }

  return recommendations.slice(0, limit);
}

function buildConceptSnapshot(args: {
  conceptKey: string;
  label: string;
  summary: string;
  graph: ConceptGraph;
  attemptInsights: AttemptInsight[];
  drills: CanonicalDrill[];
  drillConcepts: Map<string, Set<string>>;
  dueDrillIds: Set<string>;
  activePool: WeaknessPool;
  confidenceInsights: ConfidenceInsight[];
  diagnosticInsights: DiagnosticInsight[];
  diagnosisHistory: PlayerDiagnosisHistoryEntry[];
  interventionHistory: InterventionHistoryEntry[];
  realPlaySignal?: RealPlayConceptSignal;
}): PlayerConceptSnapshot | null {
  const poolSignals = buildAccumulator(
    args.attemptInsights.filter((insight) => insight.activePool === args.activePool),
    args.diagnosticInsights.filter((insight) => insight.conceptKey === args.conceptKey),
    args.conceptKey
  );
  const overallSignals = buildAccumulator(
    args.attemptInsights,
    args.diagnosticInsights.filter((insight) => insight.conceptKey === args.conceptKey),
    args.conceptKey
  );
  const usePoolScope = args.activePool !== "baseline" && poolSignals.allScores.length >= MIN_POOL_SAMPLE;
  const chosen = usePoolScope ? poolSignals : overallSignals;
  const realPlaySignal = args.realPlaySignal;
  const activeInterventionCount = args.interventionHistory.filter((entry) => isActiveInterventionStatus(entry.status)).length;
  const completedInterventions = args.interventionHistory.filter((entry) => entry.status === "completed");
  const successfulInterventions = completedInterventions.filter((entry) => entry.improved === true).length;
  const unsuccessfulInterventions = completedInterventions.filter((entry) => entry.improved === false).length;

  if (
    chosen.allScores.length === 0
    && chosen.recurrenceCount === 0
    && args.diagnosisHistory.length === 0
    && args.interventionHistory.length === 0
    && !realPlaySignal
  ) {
    return null;
  }

  const averageScore = chosen.allScores.length > 0 ? round(average(chosen.allScores)) : undefined;
  const recentAverage = chosen.allScores.length > 0 ? round(average(chosen.allScores.slice(0, Math.min(4, chosen.allScores.length)))) : undefined;
  const trend = buildTrend(args.conceptKey, chosen.allScores);
  const relatedDrills = args.drills
    .filter((drill) => args.drillConcepts.get(drill.drill_id)?.has(args.conceptKey))
    .slice(0, 3)
    .map((drill) => ({
      drillId: drill.drill_id,
      title: drill.title,
      nodeId: drill.node_id,
    }));
  const reviewPressure = relatedDrills.filter((drill) => args.dueDrillIds.has(drill.drillId)).length;
  const confidenceMismatch = buildConfidenceMismatch(args.confidenceInsights, args.conceptKey);
  const latestIntervention = [...args.interventionHistory].sort((a, b) => compareByDate(b.outcomeCreatedAt ?? b.createdAt, a.outcomeCreatedAt ?? a.createdAt))[0];
  const recoveryStage = deriveConceptRecoveryStage({
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    worseningTrend: trend?.direction === "worsening",
  });
  const hasDirectConceptSignal = [...chosen.directSignalKeys].some((key) => key.startsWith("concept:") || key.startsWith("decision:")) || Boolean(realPlaySignal);
  const effectiveRecurrence = chosen.recurrenceCount + args.diagnosisHistory.length + (realPlaySignal?.occurrences ?? 0);
  const baseUrgency = round(clamp(
    ((1 - (averageScore ?? 0.55)) * 0.55)
      + (Math.min(chosen.recurrenceCount, 4) * 0.1)
      + (reviewPressure * 0.07)
      + (trend?.direction === "worsening" ? 0.14 : trend?.direction === "improving" ? -0.08 : 0)
      + (confidenceMismatch?.direction === "overconfident" ? 0.08 : 0)
      + (Math.min([...chosen.diagnosticCounts.values()].reduce((sum, value) => sum + value, 0), 3) * 0.05)
      + (Math.min(args.diagnosisHistory.length, 3) * 0.04)
      + (activeInterventionCount * 0.05)
      + (unsuccessfulInterventions * 0.08)
      - (successfulInterventions * 0.07)
      + (realPlaySignal?.weight ?? 0)
      - (relatedDrills.length === 0 ? 0.12 : 0)
      - (!hasDirectConceptSignal ? 0.08 : 0),
    0,
    1
  ));
  const planningReasons = buildPlanningReasons({
    recoveryStage,
    recurrenceCount: effectiveRecurrence,
    reviewPressure,
    trainingUrgency: baseUrgency,
    diagnosisCount: args.diagnosisHistory.length,
    activeInterventionCount,
  });
  const trainingUrgency = round(clamp(
    baseUrgency
      + scorePlanningReasons(planningReasons) * 0.04
      - (recoveryStage === "recovered" && !planningReasons.includes("retention_check") ? 0.16 : 0),
    0,
    1
  ));
  const status = recoveryStage === "regressed"
    ? "weakness"
    : trainingUrgency >= 0.52 || effectiveRecurrence >= 2 || (averageScore ?? 1) < 0.58 || activeInterventionCount > 0
      ? "weakness"
      : recoveryStage === "recovered" && reviewPressure === 0
        ? "strength"
        : (averageScore ?? 0) >= 0.6 && trend?.direction !== "worsening" && !realPlaySignal
          ? "strength"
          : "watch";
  const supportingConceptKeys = getSupportingConcepts(args.graph, args.conceptKey).map((node) => node.key);
  const supportedConceptKeys = getSupportedConcepts(args.graph, args.conceptKey).map((node) => node.key);
  const relatedConceptKeys = args.graph.edges
    .filter((edge) => edge.type === "related" && (edge.from === args.conceptKey || edge.to === args.conceptKey))
    .map((edge) => (edge.from === args.conceptKey ? edge.to : edge.from));
  const diagnosticLead = [...chosen.diagnosticCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const evidence = [
    chosen.allScores.length > 0
      ? `${chosen.allScores.length} tracked reps are averaging ${Math.round((averageScore ?? 0) * 100)}%.`
      : realPlaySignal
        ? "Real-play evidence is available even though scored drill history is still thin."
        : args.diagnosisHistory.length > 0
          ? "Persisted coaching memory is available even though scored drill history is still thin."
          : "Only miss-driven evidence is available so far.",
    effectiveRecurrence > 0
      ? `${effectiveRecurrence} repeated signal${effectiveRecurrence === 1 ? "" : "s"} are mapped into this concept across drills, diagnoses, and imported hands.`
      : "No repeated miss cluster is mapped here.",
    reviewPressure > 0
      ? `${reviewPressure} related drills are already due for review.`
      : realPlaySignal?.reviewSpotCount
        ? `${realPlaySignal.reviewSpotCount} review-worthy real-play spots are attached here.`
        : "Review pressure is currently light for this concept.",
    `Recovery stage: ${recoveryStage.replace(/_/g, " ")}.`,
    `Planning reasons: ${planningReasons.join(", ")}.`,
  ];
  if (trend) {
    evidence.push(trend.detail);
  }
  if (confidenceMismatch) {
    evidence.push(confidenceMismatch.detail);
  }
  if (diagnosticLead) {
    evidence.push(`${diagnosticLead[1]} ${diagnosticLead[0].replace(/_/g, " ")} signals were tagged inside this concept.`);
  }
  if (args.diagnosisHistory.length > 0) {
    evidence.push(`${args.diagnosisHistory.length} persisted diagnosis ${args.diagnosisHistory.length === 1 ? "entry" : "entries"} are attached to this concept.`);
  }
  if (activeInterventionCount > 0) {
    evidence.push(`${activeInterventionCount} active intervention ${activeInterventionCount === 1 ? "is" : "are"} still open for this concept.`);
  }
  if (successfulInterventions > 0) {
    evidence.push(`${successfulInterventions} prior intervention ${successfulInterventions === 1 ? "has" : "have"} already improved this concept, so recovery is possible here.`);
  }
  if (unsuccessfulInterventions > 0) {
    evidence.push(`${unsuccessfulInterventions} completed intervention ${unsuccessfulInterventions === 1 ? "did not fully stick" : "have not fully stuck"} yet, so the leak still needs tighter follow-through.`);
  }
  if (latestIntervention?.status === "stabilizing") {
    evidence.push("The latest intervention improved enough to enter a stabilizing window, so the planner should verify retention before moving on.");
  }
  if (latestIntervention?.status === "regressed") {
    evidence.push("The latest intervention regressed, so the concept returns to the front of the queue.");
  }
  if (realPlaySignal) {
    evidence.push(...realPlaySignal.evidence.slice(0, 2));
  }

  return {
    conceptKey: args.conceptKey,
    label: args.label,
    summary: args.summary,
    scope: usePoolScope ? "pool" : "overall",
    recommendedPool: usePoolScope ? args.activePool : (realPlaySignal?.recommendedPool ?? "baseline"),
    sampleSize: chosen.allScores.length + args.diagnosisHistory.length + (realPlaySignal?.occurrences ?? 0),
    recentAverage,
    averageScore,
    recurrenceCount: effectiveRecurrence,
    failedCount: chosen.failedCount,
    reviewPressure,
    trend,
    confidenceMismatch,
    trainingUrgency,
    status,
    weaknessRole: "none",
    recoveryStage,
    planningReasons,
    interventionStatus: latestIntervention?.status,
    directSignalKeys: [...chosen.directSignalKeys, ...(realPlaySignal ? [`real_play:${realPlaySignal.conceptKey}`] : [])].sort(),
    relatedConceptKeys,
    supportingConceptKeys,
    supportedConceptKeys,
    inferredFrom: [],
    evidence,
    relatedDrills,
  };
}

function assignWeaknessRoles(graph: ConceptGraph, snapshots: PlayerConceptSnapshot[]): PlayerConceptSnapshot[] {
  const byKey = new Map(snapshots.map((snapshot) => [snapshot.conceptKey, snapshot]));

  return snapshots.map((snapshot) => {
    if (snapshot.status !== "weakness") {
      return snapshot;
    }

    const supportingWeak = getSupportingConcepts(graph, snapshot.conceptKey)
      .map((node) => byKey.get(node.key))
      .filter((candidate): candidate is PlayerConceptSnapshot => candidate !== undefined && candidate.status === "weakness");
    const supportedWeak = getSupportedConcepts(graph, snapshot.conceptKey)
      .map((node) => byKey.get(node.key))
      .filter((candidate): candidate is PlayerConceptSnapshot => candidate !== undefined && candidate.status === "weakness");

    if (supportedWeak.length > 0) {
      return {
        ...snapshot,
        weaknessRole: "upstream",
        inferredFrom: supportedWeak
          .sort((a, b) => b.trainingUrgency - a.trainingUrgency)
          .slice(0, 2)
          .map((candidate) => `${candidate.label} is also weak and may be downstream of this concept.`),
      };
    }

    if (supportingWeak.some((candidate) => candidate.trainingUrgency >= snapshot.trainingUrgency - 0.05)) {
      return {
        ...snapshot,
        weaknessRole: "downstream",
        inferredFrom: supportingWeak
          .sort((a, b) => b.trainingUrgency - a.trainingUrgency)
          .slice(0, 2)
          .map((candidate) => `${candidate.label} is a supporting concept that currently looks at least as weak.`),
      };
    }

    return {
      ...snapshot,
      weaknessRole: "primary",
      inferredFrom: ["No weaker supporting concept is outranking this one, so it is treated as a primary leak for now."],
    };
  });
}

function buildAccumulator(
  insights: AttemptInsight[],
  diagnosticInsights: DiagnosticInsight[],
  conceptKey: string
): ConceptAccumulator {
  const accumulator: ConceptAccumulator = {
    allScores: [],
    recurrenceCount: 0,
    failedCount: 0,
    directSignalKeys: new Set<string>(),
    diagnosticCounts: new Map<string, number>(),
  };

  for (const insight of insights) {
    const directSources = new Set<string>();
    let matched = false;

    for (const tag of insight.classificationTags) {
      if (mapSignalToConceptKeys(tag).includes(conceptKey)) {
        matched = true;
        directSources.add(tag);
      }
    }

    for (const missedTag of insight.missedTags) {
      if (mapSignalToConceptKeys(missedTag).includes(conceptKey)) {
        matched = true;
        directSources.add(missedTag);
        accumulator.recurrenceCount += 1;
      }
    }

    if (!matched) {
      continue;
    }

    accumulator.allScores.push(insight.score);
    if (!insight.correct) {
      accumulator.failedCount += 1;
    }
    for (const source of directSources) {
      accumulator.directSignalKeys.add(source);
    }
  }

  for (const insight of diagnosticInsights) {
    if (insight.conceptKey !== conceptKey) {
      continue;
    }

    accumulator.recurrenceCount += 1;
    accumulator.directSignalKeys.add(`diagnostic:${insight.errorType}`);
    accumulator.diagnosticCounts.set(
      insight.errorType,
      (accumulator.diagnosticCounts.get(insight.errorType) ?? 0) + 1
    );
  }

  return accumulator;
}

function buildTrend(conceptKey: string, scores: number[]): PlayerConceptSnapshot["trend"] {
  const recent = scores.slice(0, 4);
  const previous = scores.slice(4, 8);
  if (recent.length < 2 || previous.length < 2) {
    return undefined;
  }

  const recentAverage = average(recent);
  const previousAverage = average(previous);
  const delta = round(recentAverage - previousAverage);

  if (delta >= 0.08) {
    return {
      direction: "improving",
      delta,
      detail: `${toTitleCase(conceptKey)} improved from ${Math.round(previousAverage * 100)}% to ${Math.round(recentAverage * 100)}% across the last two windows.`,
    };
  }

  if (delta <= -0.08) {
    return {
      direction: "worsening",
      delta,
      detail: `${toTitleCase(conceptKey)} slipped from ${Math.round(previousAverage * 100)}% to ${Math.round(recentAverage * 100)}% across the last two windows.`,
    };
  }

  return {
    direction: "stable",
    delta,
    detail: `${toTitleCase(conceptKey)} is staying in a similar band across the last two windows.`,
  };
}

function buildConfidenceMismatch(
  confidenceInsights: ConfidenceInsight[],
  conceptKey: string
): PlayerConceptSnapshot["confidenceMismatch"] {
  let certainWrong = 0;
  let notSureCorrect = 0;

  for (const insight of confidenceInsights) {
    const conceptKeys = new Set<string>();
    for (const tag of insight.classificationTags ?? []) {
      for (const concept of mapSignalToConceptKeys(tag)) {
        conceptKeys.add(concept);
      }
    }
    for (const tag of insight.missedTags ?? []) {
      for (const concept of mapSignalToConceptKeys(tag)) {
        conceptKeys.add(concept);
      }
    }

    if (!conceptKeys.has(conceptKey)) {
      continue;
    }

    if (!insight.correct && insight.confidence === "certain") {
      certainWrong += 1;
    }
    if (insight.correct && insight.confidence === "not_sure") {
      notSureCorrect += 1;
    }
  }

  if (certainWrong >= 2) {
    return {
      direction: "overconfident",
      count: certainWrong,
      detail: `${certainWrong} misses in this concept came with Certain confidence.`,
    };
  }

  if (notSureCorrect >= 2) {
    return {
      direction: "underconfident",
      count: notSureCorrect,
      detail: `${notSureCorrect} correct reps in this concept came with Not Sure confidence.`,
    };
  }

  return undefined;
}

function buildDrillConceptIndex(drills: CanonicalDrill[]): Map<string, Set<string>> {
  return new Map(
    drills.map((drill) => {
      const concepts = new Set<string>();
      for (const source of collectDrillConceptSources(drill)) {
        for (const conceptKey of mapSignalToConceptKeys(source)) {
          concepts.add(conceptKey);
        }
      }
      return [drill.drill_id, concepts];
    })
  );
}

function buildRecommendationRationale(snapshot: PlayerConceptSnapshot, patterns: CoachingPatternSnapshot["patterns"]): string {
  const leadPattern = patterns[0];

  if (leadPattern?.type === "regression_after_recovery") {
    return `${snapshot.label} recovered once but then regressed, so the next recommendation should reopen repair and extend follow-through.`;
  }

  if (leadPattern?.type === "real_play_transfer_gap") {
    return `${snapshot.label} is improving in drills but the gain is not yet transferring into real play, so the next block should bridge authored reps into hand review.`;
  }

  if (leadPattern?.type === "intervention_not_sticking") {
    return `${snapshot.label} has already had intervention work that did not fully stick, so the next recommendation should stay narrow and extend reinforcement rather than chasing novelty.`;
  }

  if (leadPattern?.type === "downstream_river_symptom" && snapshot.supportingConceptKeys[0]) {
    return `${snapshot.label} keeps showing up as the visible river symptom, but ${toTitleCase(snapshot.supportingConceptKeys[0])} still looks like the upstream issue to repair first.`;
  }

  if (leadPattern?.type === "persistent_threshold_leak") {
    return `${snapshot.label} keeps recurring as a threshold leak, so the next recommendation should retest practical defend-or-fold thresholds directly.`;
  }

  if (snapshot.evidence.some((entry) => entry.includes("active intervention"))) {
    return `${snapshot.label} already has an active intervention, so the next recommendation should continue that thread instead of fragmenting the work.`;
  }

  if (snapshot.weaknessRole === "downstream" && snapshot.supportingConceptKeys[0]) {
    return `${snapshot.label} keeps showing up, but the graph suggests ${toTitleCase(snapshot.supportingConceptKeys[0])} may be the upstream issue to repair first.`;
  }

  if (snapshot.weaknessRole === "upstream") {
    return `${snapshot.label} is weak on its own and also supports other shaky concepts, so repairing it should clean up more than one leak at once.`;
  }

  if (snapshot.evidence.some((entry) => entry.includes("imported hand"))) {
    return `${snapshot.label} is now appearing in actual imported hands, not just authored drills, so the next block should treat it as a live transfer leak.`;
  }

  if (snapshot.scope === "pool" && snapshot.recommendedPool !== "baseline") {
    return `${snapshot.label} is a live ${snapshot.recommendedPool} pool-specific weakness, so staying in that context should produce the clearest improvement signal.`;
  }

  const diagnosticLead = snapshot.evidence.find((entry) => entry.includes("signals were tagged"));
  return diagnosticLead
    ? `${snapshot.label} is the cleanest current concept weakness based on recurrence, score pressure, and recent direction. ${diagnosticLead}`
    : `${snapshot.label} is the cleanest current concept weakness based on recurrence, score pressure, and recent direction.`;
}

function buildAdaptiveRecommendation(
  adaptiveProfile: AdaptiveCoachingProfile | undefined,
  activePool: WeaknessPool
): PlayerRecommendation | undefined {
  const primary = adaptiveProfile?.tendencies[0];
  if (!primary) {
    return undefined;
  }

  switch (primary.key) {
    case "overconfident_threshold_player":
      return {
        conceptKey: primary.key,
        label: "Retest practical thresholds",
        rationale: "Confidence is outrunning threshold accuracy, so the next prescription should make the threshold explicit and then recalibrate certainty around it.",
        recommendedPool: activePool,
        emphasis: "stabilize",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
    case "line_confused_player":
      return {
        conceptKey: primary.key,
        label: "Rebuild the line first",
        rationale: "The next plan should lead with street-story reconstruction so action choices stop floating free of the line that created them.",
        recommendedPool: activePool,
        emphasis: "review",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
    case "blocker_blind_player":
      return {
        conceptKey: primary.key,
        label: "Surface blocker notes",
        rationale: "The next coaching block should make removal effects more visible because blocker-sensitive spots are still being read too shallowly.",
        recommendedPool: activePool,
        emphasis: "review",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
    case "range_shape_weak_player":
      return {
        conceptKey: primary.key,
        label: "Train range shape before action",
        rationale: "The next prescription should stabilize value, bluff, and bluff-catcher buckets before it leans on action-frequency detail.",
        recommendedPool: activePool,
        emphasis: "stabilize",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
    case "review_avoidant_player":
      return {
        conceptKey: primary.key,
        label: "Use a shorter review loop",
        rationale: "Review pressure is building enough that the best recommendation is a smaller, easier-to-repeat reinforcement block rather than more spread.",
        recommendedPool: activePool,
        emphasis: "review",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
    case "drill_strong_real_play_weak_player":
      return {
        conceptKey: primary.key,
        label: "Bridge drills into real hands",
        rationale: "The next recommendation should explicitly combine authored reps with imported-hand review because transfer is the live coaching gap right now.",
        recommendedPool: activePool,
        emphasis: "review",
        urgency: primary.confidence,
        weaknessRole: "none",
        explainability: primary.evidence,
      };
  }
}

function buildPlayerMemorySummary(args: {
  diagnosisHistory: PlayerDiagnosisHistoryEntry[];
  interventionHistory: InterventionHistoryEntry[];
}): PlayerMemorySummary {
  const completed = args.interventionHistory.filter((entry) => entry.status === "completed");
  const improved = completed.filter((entry) => entry.improved === true).length;

  return {
    diagnosisCount: args.diagnosisHistory.length,
    activeInterventions: args.interventionHistory.filter((entry) => isActiveInterventionStatus(entry.status)).length,
    completedInterventions: completed.length,
    interventionSuccessRate: completed.length > 0 ? round(improved / completed.length) : null,
    recurringLeakConcepts: rankConcepts(args.diagnosisHistory.map((entry) => entry.conceptKey)),
    recoveredConcepts: rankConcepts(completed.filter((entry) => entry.improved === true).map((entry) => entry.conceptKey)),
    regressedConcepts: rankConcepts(args.interventionHistory.filter((entry) => entry.status === "regressed" || entry.improved === false).map((entry) => entry.conceptKey)),
    stabilizingConcepts: rankConcepts(args.interventionHistory.filter((entry) => entry.status === "stabilizing").map((entry) => entry.conceptKey)),
  };
}

function rankConcepts(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([value]) => value);
}

function toPatternConceptState(concept: PlayerConceptSnapshot): PatternConceptState {
  return {
    conceptKey: concept.conceptKey,
    label: concept.label,
    recoveryStage: concept.recoveryStage,
    trainingUrgency: concept.trainingUrgency,
    recurrenceCount: concept.recurrenceCount,
    reviewPressure: concept.reviewPressure,
    weaknessRole: concept.weaknessRole,
    supportingConceptKeys: concept.supportingConceptKeys,
    trendDirection: concept.trend?.direction,
    averageScore: concept.averageScore,
    recommendedPool: concept.recommendedPool,
    evidence: concept.evidence,
  };
}

function compareConceptSnapshots(a: PlayerConceptSnapshot, b: PlayerConceptSnapshot): number {
  if (b.trainingUrgency !== a.trainingUrgency) {
    return b.trainingUrgency - a.trainingUrgency;
  }
  if (planningStageRank(b.recoveryStage) !== planningStageRank(a.recoveryStage)) {
    return planningStageRank(b.recoveryStage) - planningStageRank(a.recoveryStage);
  }
  if (b.recurrenceCount !== a.recurrenceCount) {
    return b.recurrenceCount - a.recurrenceCount;
  }
  return a.label.localeCompare(b.label);
}

function planningStageRank(stage: ConceptRecoveryStage): number {
  switch (stage) {
    case "active_repair":
      return 5;
    case "regressed":
      return 4;
    case "stabilizing":
      return 3;
    case "unaddressed":
      return 2;
    case "recovered":
      return 1;
  }
}

function isActiveInterventionStatus(status: InterventionLifecycleStatus): boolean {
  return status === "assigned" || status === "in_progress" || status === "stabilizing";
}

function compareByDate(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}









