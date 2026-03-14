import type { CoachingEngineFamily, PersistedEngineManifest } from "../../../../packages/db/src/engine-manifest";

export type TableSimEngineManifest = PersistedEngineManifest;

const ENGINE_MANIFEST_AUTHORED_AT = "2026-03-13T00:00:00.000Z";

export const RECOMMENDATION_ENGINE_MANIFEST: TableSimEngineManifest = {
  engineFamily: "intervention_recommendation",
  engineName: "table-sim-intervention-recommendation",
  engineVersion: "1.0.0",
  schemaVersion: "intervention_recommendation.v1",
  configFingerprint: "table-sim-intervention-config.v1",
  rulesetVersion: "recommendation-rules.v1",
  authoredAt: ENGINE_MANIFEST_AUTHORED_AT,
};

export const TRANSFER_ENGINE_MANIFEST: TableSimEngineManifest = {
  engineFamily: "transfer_evaluation",
  engineName: "table-sim-transfer-evaluation",
  engineVersion: "1.0.0",
  schemaVersion: "transfer_evaluation.v1",
  configFingerprint: "table-sim-transfer-config.v1",
  rulesetVersion: "transfer-rules.v1",
  authoredAt: ENGINE_MANIFEST_AUTHORED_AT,
};

export interface PersistedEngineManifestColumns {
  engine_family: CoachingEngineFamily;
  engine_name: string;
  engine_version: string;
  engine_schema_version: string;
  engine_config_fingerprint?: string | null;
  engine_ruleset_version?: string | null;
  engine_authored_at?: string | null;
}

export interface EngineManifestDriftSummary {
  matches: boolean;
  changedFields: Array<keyof TableSimEngineManifest>;
  priorVersion?: string;
  latestVersion?: string;
}

export function toEngineManifestColumns(manifest: TableSimEngineManifest): PersistedEngineManifestColumns {
  return {
    engine_family: manifest.engineFamily,
    engine_name: manifest.engineName,
    engine_version: manifest.engineVersion,
    engine_schema_version: manifest.schemaVersion,
    engine_config_fingerprint: manifest.configFingerprint ?? null,
    engine_ruleset_version: manifest.rulesetVersion ?? null,
    engine_authored_at: manifest.authoredAt ?? null,
  };
}

export function fromEngineManifestColumns(row: PersistedEngineManifestColumns): TableSimEngineManifest {
  return {
    engineFamily: row.engine_family,
    engineName: row.engine_name,
    engineVersion: row.engine_version,
    schemaVersion: row.engine_schema_version,
    configFingerprint: row.engine_config_fingerprint ?? null,
    rulesetVersion: row.engine_ruleset_version ?? null,
    authoredAt: row.engine_authored_at ?? null,
  };
}

export function compareEngineManifests(
  latest: TableSimEngineManifest | undefined,
  previous: TableSimEngineManifest | undefined
): EngineManifestDriftSummary {
  if (!latest || !previous) {
    return {
      matches: false,
      changedFields: [],
      priorVersion: previous?.engineVersion,
      latestVersion: latest?.engineVersion,
    };
  }

  const changedFields = ([
    "engineFamily",
    "engineName",
    "engineVersion",
    "schemaVersion",
    "configFingerprint",
    "rulesetVersion",
    "authoredAt",
  ] satisfies Array<keyof TableSimEngineManifest>).filter(
    (field) => (latest[field] ?? null) !== (previous[field] ?? null)
  );

  return {
    matches: changedFields.length === 0,
    changedFields,
    priorVersion: previous.engineVersion,
    latestVersion: latest.engineVersion,
  };
}
