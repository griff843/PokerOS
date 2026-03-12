import {
  buildPlayerIntelligenceSnapshot,
  type AttemptInsight,
  type CanonicalDrill,
  type ConfidenceInsight,
  type InterventionHistoryEntry,
  type PatternAttemptSignal,
  type PlayerDiagnosisHistoryEntry,
  type PlayerIntelligenceSnapshot,
  type RealPlayConceptSignal,
  type WeaknessPool,
} from "@poker-coach/core/browser";

export function buildTableSimPlayerIntelligence(args: {
  drills: CanonicalDrill[];
  attemptInsights: AttemptInsight[];
  srs?: Array<{ drill_id: string; due_at: string }>;
  activePool: WeaknessPool;
  confidenceInsights?: ConfidenceInsight[];
  diagnosticInsights?: import("@poker-coach/core/browser").DiagnosticInsight[];
  diagnosisHistory?: PlayerDiagnosisHistoryEntry[];
  interventionHistory?: InterventionHistoryEntry[];
  realPlaySignals?: RealPlayConceptSignal[];
  patternAttempts?: PatternAttemptSignal[];
  now?: Date;
}): PlayerIntelligenceSnapshot {
  return buildPlayerIntelligenceSnapshot({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    confidenceInsights: args.confidenceInsights,
    diagnosticInsights: args.diagnosticInsights,
    diagnosisHistory: args.diagnosisHistory,
    interventionHistory: args.interventionHistory,
    realPlaySignals: args.realPlaySignals,
    patternAttempts: args.patternAttempts,
    now: args.now,
  });
}
