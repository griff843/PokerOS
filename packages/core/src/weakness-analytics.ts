import type { CanonicalDrill } from "./schemas";
import { resolveDrillAnswer } from "./answer-resolution";
import type { SessionGeneratorAttemptRow } from "./session-generator";

export type WeaknessPool = "baseline" | "A" | "B" | "C";
export type WeaknessScope = "overall" | "pool";
export type WeaknessTargetType = "classification_tag" | "rule_tag" | "node";

export interface AttemptInsight {
  drillId: string;
  nodeId: string;
  score: number;
  correct: boolean;
  missedTags: string[];
  classificationTags: string[];
  activePool: WeaknessPool | null;
}

export interface WeaknessTarget {
  type: WeaknessTargetType;
  key: string;
  scope: WeaknessScope;
  pool?: WeaknessPool;
  sampleSize: number;
  accuracy?: number;
  missRate?: number;
  priority: number;
}

export interface WeaknessAnalyticsReport {
  generatedAt: string;
  thresholds: {
    weaknessThreshold: number;
    minAttempts: number;
  };
  overallTargets: WeaknessTarget[];
  poolTargets: Record<WeaknessPool, WeaknessTarget[]>;
}

const POOLS: WeaknessPool[] = ["baseline", "A", "B", "C"];

export function buildAttemptInsights(
  attempts: SessionGeneratorAttemptRow[],
  drillMap: Map<string, CanonicalDrill>
): AttemptInsight[] {
  return attempts.flatMap((attempt) => {
    const drill = drillMap.get(attempt.drill_id);
    if (!drill) return [];

    return [{
      drillId: attempt.drill_id,
      nodeId: drill.node_id,
      score: attempt.score,
      correct: attempt.correct_bool === 1,
      missedTags: parseMissedTags(attempt.missed_tags_json),
      classificationTags: drill.tags,
      activePool: normalizeAttemptPool(attempt.active_pool),
    }];
  });
}

export function analyzeWeaknessAnalytics(args: {
  attempts: SessionGeneratorAttemptRow[];
  drillMap: Map<string, CanonicalDrill>;
  weaknessThreshold: number;
  minAttempts: number;
  now?: Date;
}): WeaknessAnalyticsReport {
  const attemptInsights = buildAttemptInsights(args.attempts, args.drillMap);
  return analyzeWeaknessAnalyticsFromInsights({
    attemptInsights,
    weaknessThreshold: args.weaknessThreshold,
    minAttempts: args.minAttempts,
    now: args.now,
  });
}

export function analyzeWeaknessAnalyticsFromInsights(args: {
  attemptInsights: AttemptInsight[];
  weaknessThreshold: number;
  minAttempts: number;
  now?: Date;
}): WeaknessAnalyticsReport {
  const generatedAt = (args.now ?? new Date()).toISOString();
  const overallTargets = analyzeWeaknessTargetsForScope(
    args.attemptInsights,
    args.weaknessThreshold,
    args.minAttempts,
    "overall"
  );

  const poolTargets = Object.fromEntries(
    POOLS.map((pool) => [
      pool,
      analyzeWeaknessTargetsForScope(
        args.attemptInsights.filter((insight) => insight.activePool === pool),
        args.weaknessThreshold,
        args.minAttempts,
        "pool",
        pool
      ),
    ])
  ) as Record<WeaknessPool, WeaknessTarget[]>;

  return {
    generatedAt,
    thresholds: {
      weaknessThreshold: args.weaknessThreshold,
      minAttempts: args.minAttempts,
    },
    overallTargets,
    poolTargets,
  };
}

export function selectWeaknessTargetsForPool(
  report: WeaknessAnalyticsReport,
  activePool: WeaknessPool,
  limit = 8
): WeaknessTarget[] {
  const prioritized = activePool === "baseline"
    ? [...report.poolTargets.baseline, ...report.overallTargets]
    : [...report.poolTargets[activePool], ...report.overallTargets];

  const deduped: WeaknessTarget[] = [];
  const seen = new Set<string>();
  for (const target of prioritized) {
    const dedupeKey = `${target.type}:${target.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(target);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function buildWeaknessPriorityByDrill(
  drills: CanonicalDrill[],
  weaknessTargets: WeaknessTarget[],
  activePool: WeaknessPool
): Map<string, { priority: number; keys: string[] }> {
  return new Map(
    drills.map((drill) => {
      const matchedTargets = weaknessTargets.filter((target) => matchesWeaknessTarget(drill, target, activePool));
      return [
        drill.drill_id,
        {
          priority: matchedTargets.reduce((sum, target) => sum + target.priority, 0),
          keys: matchedTargets.map((target) => formatWeaknessTargetKey(target)),
        },
      ];
    })
  );
}

export function formatWeaknessTargetKey(target: WeaknessTarget): string {
  return target.scope === "pool" && target.pool
    ? `${target.scope}:${target.pool}:${target.type}:${target.key}`
    : `${target.scope}:${target.type}:${target.key}`;
}

export function matchesWeaknessTarget(
  drill: CanonicalDrill,
  target: WeaknessTarget,
  activePool: WeaknessPool
): boolean {
  if (target.type === "classification_tag") {
    return drill.tags.includes(target.key);
  }
  if (target.type === "node") {
    return drill.node_id === target.key;
  }

  const relevantPools: WeaknessPool[] = target.scope === "pool" && target.pool
    ? [target.pool]
    : [activePool, "baseline", "A", "B", "C"];

  const requiredTags = new Set<string>();
  for (const pool of relevantPools) {
    const answer = resolveDrillAnswer(drill, pool);
    for (const tag of answer.required_tags) {
      requiredTags.add(tag);
    }
  }

  return requiredTags.has(target.key);
}

function analyzeWeaknessTargetsForScope(
  attemptInsights: AttemptInsight[],
  threshold: number,
  minAttempts: number,
  scope: WeaknessScope,
  pool?: WeaknessPool
): WeaknessTarget[] {
  const byClassification = new Map<string, { count: number; scoreSum: number }>();
  const byRuleTag = new Map<string, { sampleSize: number; missCount: number }>();
  const byNode = new Map<string, { count: number; scoreSum: number }>();

  for (const insight of attemptInsights) {
    for (const tag of insight.classificationTags) {
      const current = byClassification.get(tag) ?? { count: 0, scoreSum: 0 };
      current.count += 1;
      current.scoreSum += insight.score;
      byClassification.set(tag, current);
    }

    const nodeCurrent = byNode.get(insight.nodeId) ?? { count: 0, scoreSum: 0 };
    nodeCurrent.count += 1;
    nodeCurrent.scoreSum += insight.score;
    byNode.set(insight.nodeId, nodeCurrent);

    for (const missedTag of insight.missedTags) {
      const current = byRuleTag.get(missedTag) ?? { sampleSize: 0, missCount: 0 };
      current.sampleSize += 1;
      current.missCount += 1;
      byRuleTag.set(missedTag, current);
    }
  }

  const targets: WeaknessTarget[] = [];

  for (const [tag, stats] of byClassification.entries()) {
    if (stats.count < minAttempts) continue;
    const accuracy = stats.scoreSum / stats.count;
    if (accuracy < threshold) {
      targets.push({
        type: "classification_tag",
        key: tag,
        scope,
        pool,
        sampleSize: stats.count,
        accuracy,
        priority: roundPriority(1 - accuracy),
      });
    }
  }

  for (const [nodeId, stats] of byNode.entries()) {
    if (stats.count < minAttempts) continue;
    const accuracy = stats.scoreSum / stats.count;
    if (accuracy < threshold) {
      targets.push({
        type: "node",
        key: nodeId,
        scope,
        pool,
        sampleSize: stats.count,
        accuracy,
        priority: roundPriority(1 - accuracy),
      });
    }
  }

  for (const [tag, stats] of byRuleTag.entries()) {
    if (stats.sampleSize < minAttempts) continue;
    const missRate = stats.missCount / stats.sampleSize;
    if (missRate > 1 - threshold) {
      targets.push({
        type: "rule_tag",
        key: tag,
        scope,
        pool,
        sampleSize: stats.sampleSize,
        missRate,
        priority: roundPriority(missRate),
      });
    }
  }

  return targets.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key)).slice(0, 8);
}

function normalizeAttemptPool(pool: SessionGeneratorAttemptRow["active_pool"]): WeaknessPool | null {
  return pool ?? null;
}

function parseMissedTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function roundPriority(value: number): number {
  return Math.round(value * 1000) / 1000;
}

