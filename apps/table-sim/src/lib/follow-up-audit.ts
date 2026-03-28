import type { FollowUpAssignmentAuditRow } from "../../../../packages/db/src/repository";

export type FollowUpAuditBucket =
  | "exact_match"
  | "turn_line_transfer"
  | "sizing_stability"
  | "bridge_reconstruction"
  | "memory_decisive";

export type FollowUpAuditProfile =
  | "precise_history"
  | "turn_line_clear"
  | "sizing_fuzzy_line_clear"
  | "turn_line_fuzzy"
  | "memory_decisive"
  | "unknown";

export interface FollowUpAuditSummary {
  generatedAt: string;
  totalAudits: number;
  recentEntries: FollowUpAuditSummaryEntry[];
  profileCounts: Array<{
    profile: FollowUpAuditProfile;
    count: number;
  }>;
  bucketDistribution: Array<{
    bucket: FollowUpAuditBucket;
    count: number;
    share: number;
  }>;
  bucketTrend: {
    recentWindowSize: number;
    recentWindowDistribution: Array<{
      bucket: FollowUpAuditBucket;
      count: number;
      share: number;
    }>;
    previousWindowDistribution: Array<{
      bucket: FollowUpAuditBucket;
      count: number;
      share: number;
    }>;
    deltas: Array<{
      bucket: FollowUpAuditBucket;
      recentCount: number;
      previousCount: number;
      delta: number;
    }>;
  };
  warningCounts: {
    totalWarnings: number;
    entriesWithWarnings: number;
    averageWarningsPerEntry: number;
    byProfile: Array<{
      profile: FollowUpAuditProfile;
      entries: number;
      warnings: number;
    }>;
  };
  health: {
    label: "Aligned" | "Needs review" | "Thin sample";
    detail: string;
    warningCount: number;
  };
}

export interface FollowUpAuditSummaryEntry {
  id: string;
  handTitle: string;
  conceptKey: string;
  handSource: "paste" | "file" | "manual" | "unknown";
  parseStatus: "parsed" | "partial" | "unsupported" | "unknown";
  uncertaintyProfile: FollowUpAuditProfile;
  activePool: "baseline" | "A" | "B" | "C";
  createdAt: string;
  createdAtLabel: string;
  bucketMix: Array<{
    bucket: FollowUpAuditBucket;
    count: number;
  }>;
  bucketMixLabel: string;
  selectedDrillIds: string[];
  warningCount: number;
  warnings: string[];
}

const ALL_BUCKETS: FollowUpAuditBucket[] = [
  "exact_match",
  "turn_line_transfer",
  "sizing_stability",
  "bridge_reconstruction",
  "memory_decisive",
];

export function buildFollowUpAuditSummary(
  rows: FollowUpAssignmentAuditRow[],
  options?: {
    recentWindowSize?: number;
    now?: Date;
  }
): FollowUpAuditSummary {
  const now = options?.now ?? new Date();
  const recentWindowSize = Math.max(1, options?.recentWindowSize ?? 5);
  const parsed = rows
    .map((row) => parseFollowUpAuditRow(row, now))
    .sort((left, right) => compareAuditRowsDesc(left.createdAt, right.createdAt, left.id, right.id));

  const profileCounts = countProfiles(parsed);
  const bucketDistribution = computeBucketDistribution(parsed.flatMap((entry) => entry.bucketMix));
  const recentWindow = parsed.slice(0, recentWindowSize);
  const previousWindow = parsed.slice(recentWindowSize, recentWindowSize * 2);
  const bucketTrend = {
    recentWindowSize: recentWindow.length,
    recentWindowDistribution: computeBucketDistribution(recentWindow.flatMap((entry) => entry.bucketMix)),
    previousWindowDistribution: computeBucketDistribution(previousWindow.flatMap((entry) => entry.bucketMix)),
    deltas: buildBucketDeltas(recentWindow, previousWindow),
  };
  const totalWarnings = parsed.reduce((sum, entry) => sum + entry.warningCount, 0);
  const entriesWithWarnings = parsed.filter((entry) => entry.warningCount > 0).length;
  const warningCounts = {
    totalWarnings,
    entriesWithWarnings,
    averageWarningsPerEntry: parsed.length > 0 ? totalWarnings / parsed.length : 0,
    byProfile: buildWarningCountsByProfile(parsed),
  };

  return {
    generatedAt: now.toISOString(),
    totalAudits: parsed.length,
    recentEntries: parsed.slice(0, recentWindowSize),
    profileCounts,
    bucketDistribution,
    bucketTrend,
    warningCounts,
    health: buildHealth(totalWarnings, parsed.length, recentWindowSize),
  };
}

export function buildFollowUpAuditWarnings(
  profile: FollowUpAuditProfile,
  bucketMix: Array<{
    bucket: FollowUpAuditBucket;
    count: number;
  }>
): string[] {
  const counts = new Map(bucketMix.map((entry) => [entry.bucket, entry.count]));
  const warnings: string[] = [];

  switch (profile) {
    case "memory_decisive":
      if ((counts.get("memory_decisive") ?? 0) === 0) {
        warnings.push("Memory-decisive blocks should include at least one memory-decisive rep.");
      }
      if ((counts.get("bridge_reconstruction") ?? 0) === 0) {
        warnings.push("Memory-decisive blocks usually still need a bridge reconstruction rep.");
      }
      break;
    case "turn_line_fuzzy":
      if ((counts.get("bridge_reconstruction") ?? 0) === 0) {
        warnings.push("Turn-line-fuzzy blocks should include bridge reconstruction reps.");
      }
      if ((counts.get("exact_match") ?? 0) === 0) {
        warnings.push("Turn-line-fuzzy blocks may be too abstract if no exact-match reps remain.");
      }
      break;
    case "sizing_fuzzy_line_clear":
      if ((counts.get("sizing_stability") ?? 0) === 0) {
        warnings.push("Sizing-fuzzy blocks should include at least one sizing-stability rep.");
      }
      break;
    case "turn_line_clear":
      if ((counts.get("turn_line_transfer") ?? 0) === 0) {
        warnings.push("Turn-line-clear blocks should include turn-line transfer reps.");
      }
      break;
    case "precise_history":
      if ((counts.get("exact_match") ?? 0) === 0) {
        warnings.push("Precise-history blocks should stay anchored in exact-match reps.");
      }
      break;
    case "unknown":
    default:
      if (bucketMix.length === 0) {
        warnings.push("This follow-up audit did not include any bucket mix data.");
      }
      break;
  }

  return warnings;
}

export function inferCorrectiveBucketsFromWarnings(
  warnings: string[]
): FollowUpAuditBucket[] {
  const buckets = new Set<FollowUpAuditBucket>();

  for (const warning of warnings) {
    const normalized = warning.toLowerCase();
    if (normalized.includes("memory-decisive")) {
      buckets.add("memory_decisive");
    }
    if (normalized.includes("bridge reconstruction")) {
      buckets.add("bridge_reconstruction");
    }
    if (normalized.includes("sizing-stability")) {
      buckets.add("sizing_stability");
    }
    if (normalized.includes("turn-line transfer")) {
      buckets.add("turn_line_transfer");
    }
    if (normalized.includes("exact-match")) {
      buckets.add("exact_match");
    }
  }

  return [...buckets];
}

export function formatCorrectiveBucketLabels(
  buckets: FollowUpAuditBucket[]
): string[] {
  return buckets.map((bucket) => {
    switch (bucket) {
      case "memory_decisive":
        return "memory-decisive reps";
      case "bridge_reconstruction":
        return "bridge reconstruction reps";
      case "sizing_stability":
        return "sizing-stability reps";
      case "turn_line_transfer":
        return "turn-line transfer reps";
      case "exact_match":
      default:
        return "exact-match reps";
    }
  });
}

function parseFollowUpAuditRow(row: FollowUpAssignmentAuditRow, now: Date): FollowUpAuditSummaryEntry {
  const bucketMix = parseBucketMix(row.bucket_mix_json);
  const uncertaintyProfile = normalizeProfile(row.uncertainty_profile);
  const warnings = buildFollowUpAuditWarnings(uncertaintyProfile, bucketMix);

  return {
    id: row.id,
    handTitle: row.hand_title?.trim() || "Follow-up hand",
    conceptKey: row.concept_key,
    handSource: normalizeHandSource(row.hand_source),
    parseStatus: normalizeParseStatus(row.parse_status),
    uncertaintyProfile,
    activePool: normalizeActivePool(row.active_pool),
    createdAt: row.created_at,
    createdAtLabel: formatRelativeDate(row.created_at, now),
    bucketMix,
    bucketMixLabel: bucketMix.map((entry) => `${entry.count} ${formatBucketLabel(entry.bucket)}`).join(", "),
    selectedDrillIds: parseSelectedDrillIds(row.selected_drill_ids_json),
    warningCount: warnings.length,
    warnings,
  };
}

function normalizeActivePool(raw?: string | null): "baseline" | "A" | "B" | "C" {
  switch (raw) {
    case "A":
    case "B":
    case "C":
      return raw;
    case "baseline":
    default:
      return "baseline";
  }
}

function normalizeHandSource(raw?: string | null): "paste" | "file" | "manual" | "unknown" {
  switch (raw) {
    case "paste":
    case "file":
    case "manual":
      return raw;
    default:
      return "unknown";
  }
}

function normalizeParseStatus(raw?: string | null): "parsed" | "partial" | "unsupported" | "unknown" {
  switch (raw) {
    case "parsed":
    case "partial":
    case "unsupported":
      return raw;
    default:
      return "unknown";
  }
}

function countProfiles(entries: FollowUpAuditSummaryEntry[]): Array<{ profile: FollowUpAuditProfile; count: number }> {
  const counts = new Map<FollowUpAuditProfile, number>();
  for (const entry of entries) {
    counts.set(entry.uncertaintyProfile, (counts.get(entry.uncertaintyProfile) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([profile, count]) => ({ profile, count }));
}

function buildWarningCountsByProfile(entries: FollowUpAuditSummaryEntry[]) {
  const counts = new Map<FollowUpAuditProfile, { entries: number; warnings: number }>();
  for (const entry of entries) {
    const current = counts.get(entry.uncertaintyProfile) ?? { entries: 0, warnings: 0 };
    current.entries += 1;
    current.warnings += entry.warningCount;
    counts.set(entry.uncertaintyProfile, current);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].warnings - left[1].warnings || left[0].localeCompare(right[0]))
    .map(([profile, value]) => ({
      profile,
      entries: value.entries,
      warnings: value.warnings,
    }));
}

function computeBucketDistribution(bucketMix: Array<{
  bucket: FollowUpAuditBucket;
  count: number;
}>): Array<{ bucket: FollowUpAuditBucket; count: number; share: number }> {
  const counts = new Map<FollowUpAuditBucket, number>(ALL_BUCKETS.map((bucket) => [bucket, 0]));
  for (const entry of bucketMix) {
    counts.set(entry.bucket, (counts.get(entry.bucket) ?? 0) + entry.count);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return ALL_BUCKETS.map((bucket) => {
    const count = counts.get(bucket) ?? 0;
    return {
      bucket,
      count,
      share: total > 0 ? count / total : 0,
    };
  });
}

function buildBucketDeltas(
  recentWindow: FollowUpAuditSummaryEntry[],
  previousWindow: FollowUpAuditSummaryEntry[]
): Array<{
  bucket: FollowUpAuditBucket;
  recentCount: number;
  previousCount: number;
  delta: number;
}> {
  const recentCounts = countBuckets(recentWindow);
  const previousCounts = countBuckets(previousWindow);

  return ALL_BUCKETS.map((bucket) => {
    const recentCount = recentCounts.get(bucket) ?? 0;
    const previousCount = previousCounts.get(bucket) ?? 0;
    return {
      bucket,
      recentCount,
      previousCount,
      delta: recentCount - previousCount,
    };
  }).sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.bucket.localeCompare(right.bucket));
}

function countBuckets(entries: FollowUpAuditSummaryEntry[]) {
  const counts = new Map<FollowUpAuditBucket, number>(ALL_BUCKETS.map((bucket) => [bucket, 0]));
  for (const entry of entries) {
    for (const bucket of entry.bucketMix) {
      counts.set(bucket.bucket, (counts.get(bucket.bucket) ?? 0) + bucket.count);
    }
  }
  return counts;
}

function buildHealth(totalWarnings: number, totalAudits: number, recentWindowSize: number): FollowUpAuditSummary["health"] {
  if (totalAudits === 0) {
    return {
      label: "Thin sample",
      detail: "No follow-up audits have been recorded yet.",
      warningCount: 0,
    };
  }

  if (totalAudits < recentWindowSize) {
    return {
      label: "Thin sample",
      detail: "There are some audits, but not enough history to read strong trends yet.",
      warningCount: totalWarnings,
    };
  }

  if (totalWarnings === 0) {
    return {
      label: "Aligned",
      detail: "Recent follow-up audits are aligned with the uncertainty profile and bucket mix targets.",
      warningCount: 0,
    };
  }

  return {
    label: "Needs review",
    detail: "One or more recent follow-up audits are missing the bucket mix the uncertainty profile calls for.",
    warningCount: totalWarnings,
  };
}

function parseBucketMix(raw: string): Array<{
  bucket: FollowUpAuditBucket;
  count: number;
}> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.bucket !== "string" || typeof entry.count !== "number") {
        return [];
      }

      if (!isFollowUpAuditBucket(entry.bucket)) {
        return [];
      }

      return [{
        bucket: entry.bucket,
        count: Math.max(0, Math.floor(entry.count)),
      }];
    });
  } catch {
    return [];
  }
}

function parseSelectedDrillIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [];
  }
}

function normalizeProfile(raw?: string | null): FollowUpAuditProfile {
  if (!raw) {
    return "unknown";
  }

  switch (raw) {
    case "precise_history":
    case "turn_line_clear":
    case "sizing_fuzzy_line_clear":
    case "turn_line_fuzzy":
    case "memory_decisive":
      return raw;
    default:
      return "unknown";
  }
}

function formatBucketLabel(bucket: FollowUpAuditBucket): string {
  switch (bucket) {
    case "memory_decisive":
      return "Memory Decisive";
    case "bridge_reconstruction":
      return "Bridge Reconstruction";
    case "sizing_stability":
      return "Sizing Stability";
    case "turn_line_transfer":
      return "Turn-Line Transfer";
    case "exact_match":
      return "Exact Match";
  }
}

function formatRelativeDate(value: string, now: Date): string {
  const diffMs = now.getTime() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (Number.isNaN(diffMinutes)) {
    return "Unknown time";
  }

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function compareAuditRowsDesc(leftCreatedAt: string, rightCreatedAt: string, leftId: string, rightId: string): number {
  return new Date(rightCreatedAt).getTime() - new Date(leftCreatedAt).getTime() || rightId.localeCompare(leftId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFollowUpAuditBucket(value: string): value is FollowUpAuditBucket {
  return value === "exact_match"
    || value === "turn_line_transfer"
    || value === "sizing_stability"
    || value === "bridge_reconstruction"
    || value === "memory_decisive";
}
