import {
  buildPlayerIntelligenceSnapshot,
  type ConfidenceInsight,
  type PlayerIntelligenceSnapshot,
  type AttemptInsight,
  type CanonicalDrill,
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
  realPlaySignals?: RealPlayConceptSignal[];
  now?: Date;
}): PlayerIntelligenceSnapshot {
  return buildPlayerIntelligenceSnapshot({
    drills: args.drills,
    attemptInsights: args.attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    confidenceInsights: args.confidenceInsights,
    diagnosticInsights: args.diagnosticInsights,
    realPlaySignals: args.realPlaySignals,
    now: args.now,
  });
}

