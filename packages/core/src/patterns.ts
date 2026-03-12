import type { WeaknessPool } from "./weakness-analytics";
import type { RealPlayConceptSignal } from "./real-hands";

export type CoachingPatternType =
  | "persistent_threshold_leak"
  | "persistent_blocker_blindness"
  | "downstream_river_symptom"
  | "real_play_transfer_gap"
  | "intervention_not_sticking"
  | "regression_after_recovery"
  | "review_avoidance_pattern";

export type PatternConfidence = "low" | "medium" | "high";

export type PatternInterventionBias =
  | "threshold_retest"
  | "blocker_explicitness"
  | "upstream_repair"
  | "real_play_transfer"
  | "repair_intensity"
  | "stabilization_check"
  | "review_follow_through";

export interface PatternAttemptSignal {
  drillId: string;
  nodeId: string;
  ts: string;
  conceptKeys: string[];
  missedTags: string[];
  score: number;
  correct: boolean;
  sessionId?: string | null;
  diagnosticType?: string | null;
  diagnosticConceptKey?: string | null;
  activePool?: WeaknessPool | null;
}

export interface PatternDiagnosisSignal {
  conceptKey: string;
  diagnosticType: string;
  confidence: number;
  createdAt: string;
}

export interface PatternInterventionSignal {
  id: string;
  conceptKey: string;
  source: string;
  status: string;
  createdAt: string;
  improved?: boolean | null;
  preScore?: number | null;
  postScore?: number | null;
  outcomeCreatedAt?: string | null;
}

export interface PatternConceptState {
  conceptKey: string;
  label: string;
  recoveryStage: "unaddressed" | "active_repair" | "stabilizing" | "recovered" | "regressed";
  trainingUrgency: number;
  recurrenceCount: number;
  reviewPressure: number;
  weaknessRole: "none" | "primary" | "upstream" | "downstream";
  supportingConceptKeys: string[];
  trendDirection?: "improving" | "worsening" | "stable";
  averageScore?: number;
  recommendedPool: WeaknessPool;
  evidence: string[];
}

export interface CoachingPattern {
  id: string;
  type: CoachingPatternType;
  confidence: PatternConfidence;
  severity: number;
  implicatedConcepts: string[];
  evidence: string[];
  coachingImplication: string;
  suggestedBiases: PatternInterventionBias[];
}

export interface CoachingPatternSnapshot {
  generatedAt: string;
  patterns: CoachingPattern[];
  topPatterns: CoachingPattern[];
}

export function buildCoachingPatternSnapshot(args: {
  attempts: PatternAttemptSignal[];
  diagnoses: PatternDiagnosisSignal[];
  interventions: PatternInterventionSignal[];
  concepts: PatternConceptState[];
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}): CoachingPatternSnapshot {
  const now = args.now ?? new Date();
  const conceptsByKey = new Map(args.concepts.map((concept) => [concept.conceptKey, concept]));
  const patterns: CoachingPattern[] = [];

  const diagnosisGroups = groupDiagnosesByConceptAndType(args.diagnoses);
  for (const [key, group] of diagnosisGroups.entries()) {
    if (group.count < 2) {
      continue;
    }
    const concept = conceptsByKey.get(group.conceptKey);
    const sessions = countDistinctSessions(args.attempts, group.conceptKey);

    if (group.diagnosticType === "threshold_error") {
      patterns.push({
        id: `pattern:${group.conceptKey}:persistent_threshold_leak`,
        type: "persistent_threshold_leak",
        confidence: confidenceFromCounts(group.count, sessions),
        severity: round(0.62 + Math.min(group.count, 4) * 0.08 + Math.min(sessions, 3) * 0.05),
        implicatedConcepts: [group.conceptKey],
        evidence: [
          `${group.count} persisted threshold-error diagnoses point back to ${concept?.label ?? toTitleCase(group.conceptKey)}.`,
          sessions > 1 ? `The same leak spans ${sessions} stored sessions instead of staying isolated.` : "The same leak is repeating inside recent stored reps.",
          ...(concept?.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `Threshold discipline should be retested directly before the planner broadens into unrelated work.`,
        suggestedBiases: ["threshold_retest", "repair_intensity"],
      });
    }

    if (group.diagnosticType === "blocker_blindness") {
      patterns.push({
        id: `pattern:${group.conceptKey}:persistent_blocker_blindness`,
        type: "persistent_blocker_blindness",
        confidence: confidenceFromCounts(group.count, sessions),
        severity: round(0.58 + Math.min(group.count, 4) * 0.08 + Math.min(sessions, 3) * 0.04),
        implicatedConcepts: [group.conceptKey],
        evidence: [
          `${group.count} blocker-blindness diagnoses are attached to ${concept?.label ?? toTitleCase(group.conceptKey)}.`,
          sessions > 1 ? `The pattern repeats across ${sessions} sessions.` : "The pattern repeats inside the stored drill history.",
          ...(concept?.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `Training should surface blocker effects explicitly instead of assuming the learner is seeing them implicitly.`,
        suggestedBiases: ["blocker_explicitness", "repair_intensity"],
      });
    }
  }

  for (const concept of args.concepts) {
    const relatedInterventions = args.interventions.filter((entry) => entry.conceptKey === concept.conceptKey);
    const improvedInterventions = relatedInterventions.filter((entry) => entry.improved === true);
    const failedInterventions = relatedInterventions.filter((entry) => entry.status === "regressed" || entry.improved === false);
    const realPlaySignal = args.realPlaySignals?.find((signal) => signal.conceptKey === concept.conceptKey);

    if (concept.weaknessRole === "downstream" && concept.supportingConceptKeys[0] && concept.recurrenceCount >= 2 && /river|bluff|catch|defense/.test(concept.conceptKey)) {
      patterns.push({
        id: `pattern:${concept.conceptKey}:downstream_river_symptom`,
        type: "downstream_river_symptom",
        confidence: concept.recurrenceCount >= 3 ? "high" : "medium",
        severity: round(0.63 + Math.min(concept.recurrenceCount, 4) * 0.05),
        implicatedConcepts: [concept.conceptKey, concept.supportingConceptKeys[0]],
        evidence: [
          `${concept.label} is still recurring as a downstream symptom.`,
          `${toTitleCase(concept.supportingConceptKeys[0])} is a supporting concept that remains implicated in the same family.`,
          ...(concept.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `The next intervention should weight the upstream concept first, then retest the river-facing symptom.`,
        suggestedBiases: ["upstream_repair", "repair_intensity"],
      });
    }

    if ((concept.recoveryStage === "recovered" || concept.recoveryStage === "stabilizing" || concept.trendDirection === "improving") && realPlaySignal && realPlaySignal.reviewSpotCount > 0) {
      patterns.push({
        id: `pattern:${concept.conceptKey}:real_play_transfer_gap`,
        type: "real_play_transfer_gap",
        confidence: realPlaySignal.reviewSpotCount >= 2 ? "high" : "medium",
        severity: round(0.57 + Math.min(realPlaySignal.reviewSpotCount, 3) * 0.08),
        implicatedConcepts: [concept.conceptKey],
        evidence: [
          `${concept.label} is recovering on the drill side, but real-play review spots still map here.`,
          `${realPlaySignal.reviewSpotCount} imported-hand review spot${realPlaySignal.reviewSpotCount === 1 ? " still points" : "s still point"} at this concept.`,
          ...(realPlaySignal.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `The next block should bridge drills into real-play transfer instead of assuming the recovery already generalizes.`,
        suggestedBiases: ["real_play_transfer", "stabilization_check"],
      });
    }

    if (failedInterventions.length > 0) {
      patterns.push({
        id: `pattern:${concept.conceptKey}:intervention_not_sticking`,
        type: "intervention_not_sticking",
        confidence: failedInterventions.length >= 2 ? "high" : "medium",
        severity: round(0.66 + Math.min(failedInterventions.length, 3) * 0.08),
        implicatedConcepts: [concept.conceptKey],
        evidence: [
          `${failedInterventions.length} intervention ${failedInterventions.length === 1 ? "has not held" : "results have not held"} for ${concept.label}.`,
          concept.recoveryStage === "regressed" ? `${concept.label} is currently classified as regressed.` : `${concept.label} is still not holding recovery cleanly.`,
          ...(concept.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `The planner should increase repair intensity and follow-through instead of treating this concept as already handled.`,
        suggestedBiases: ["repair_intensity", "stabilization_check", "review_follow_through"],
      });
    }

    if (concept.recoveryStage === "regressed" && improvedInterventions.length > 0) {
      patterns.push({
        id: `pattern:${concept.conceptKey}:regression_after_recovery`,
        type: "regression_after_recovery",
        confidence: improvedInterventions.length >= 1 ? "high" : "medium",
        severity: round(0.7 + Math.min(improvedInterventions.length, 2) * 0.06),
        implicatedConcepts: [concept.conceptKey],
        evidence: [
          `${concept.label} recovered once, then slipped back into a regressed state.`,
          `${improvedInterventions.length} prior successful intervention ${improvedInterventions.length === 1 ? "exists" : "records exist"} for this same concept.`,
          ...(concept.evidence.slice(0, 1) ?? []),
        ],
        coachingImplication: `The next plan should reopen repair and extend the stabilization window before moving on.`,
        suggestedBiases: ["repair_intensity", "stabilization_check"],
      });
    }

    if (concept.reviewPressure >= 3 && (concept.recoveryStage === "active_repair" || concept.recoveryStage === "regressed")) {
      patterns.push({
        id: `pattern:${concept.conceptKey}:review_avoidance_pattern`,
        type: "review_avoidance_pattern",
        confidence: concept.reviewPressure >= 4 ? "medium" : "low",
        severity: round(0.45 + Math.min(concept.reviewPressure, 5) * 0.05),
        implicatedConcepts: [concept.conceptKey],
        evidence: [
          `${concept.reviewPressure} related reviews are due while the concept is still under repair pressure.`,
          `${concept.label} is not ready to be treated as resolved yet.`,
        ],
        coachingImplication: `Follow-through review should be made more visible so recovery does not stall behind backlog.`,
        suggestedBiases: ["review_follow_through"],
      });
    }
  }

  const deduped = dedupePatterns(patterns)
    .sort((a, b) => b.severity - a.severity || a.type.localeCompare(b.type));

  return {
    generatedAt: now.toISOString(),
    patterns: deduped,
    topPatterns: deduped.slice(0, 5),
  };
}

export function selectPatternsForConcept(patterns: CoachingPattern[], conceptKey: string): CoachingPattern[] {
  return patterns.filter((pattern) => pattern.implicatedConcepts.includes(conceptKey));
}

export function collectPatternBiases(patterns: CoachingPattern[], conceptKeys: string[]): PatternInterventionBias[] {
  const relevant = patterns.filter((pattern) => pattern.implicatedConcepts.some((conceptKey) => conceptKeys.includes(conceptKey)));
  return [...new Set(relevant.flatMap((pattern) => pattern.suggestedBiases))];
}

function groupDiagnosesByConceptAndType(diagnoses: PatternDiagnosisSignal[]) {
  const groups = new Map<string, { conceptKey: string; diagnosticType: string; count: number }>();
  for (const diagnosis of diagnoses) {
    const key = `${diagnosis.conceptKey}:${diagnosis.diagnosticType}`;
    const current = groups.get(key) ?? { conceptKey: diagnosis.conceptKey, diagnosticType: diagnosis.diagnosticType, count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return groups;
}

function countDistinctSessions(attempts: PatternAttemptSignal[], conceptKey: string): number {
  const sessions = new Set(
    attempts
      .filter((attempt) => attempt.conceptKeys.includes(conceptKey) && attempt.sessionId)
      .map((attempt) => attempt.sessionId as string)
  );
  return sessions.size;
}

function confidenceFromCounts(count: number, sessions: number): PatternConfidence {
  if (count >= 3 || sessions >= 2) {
    return "high";
  }
  if (count >= 2) {
    return "medium";
  }
  return "low";
}

function dedupePatterns(patterns: CoachingPattern[]): CoachingPattern[] {
  const seen = new Map<string, CoachingPattern>();
  for (const pattern of patterns) {
    const existing = seen.get(pattern.id);
    if (!existing || pattern.severity > existing.severity) {
      seen.set(pattern.id, pattern);
    }
  }
  return [...seen.values()];
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
