export type CoachingEngineFamily =
  | "intervention_recommendation"
  | "transfer_evaluation"
  | "concept_case_synthesis"
  | "retention_scheduler";

export interface PersistedEngineManifest {
  engineFamily: CoachingEngineFamily;
  engineName: string;
  engineVersion: string;
  schemaVersion: string;
  configFingerprint?: string | null;
  rulesetVersion?: string | null;
  authoredAt?: string | null;
}
