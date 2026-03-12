import { buildAttemptInsights, formatConceptLabelFromSource } from "@poker-coach/core/browser";
import type { CanonicalDrill } from "@poker-coach/core/browser";
import type { AttemptRow } from "../../../../packages/db/src/repository";
import { buildTableSimPlayerIntelligence } from "./player-intelligence";
import {
  hydrateDrillAttempt,
  type ConceptMistakeEntry,
  type PersistentReviewSnapshot,
  type ReviewQueueEntry,
  type UnresolvedConceptEntry,
} from "./study-attempts";
import type { TableSimActivePool } from "./session-plan";
import type { DrillAttempt } from "./session-types";

export function buildPersistentReviewSnapshot(args: {
  drills: CanonicalDrill[];
  attempts: AttemptRow[];
  srs?: Array<{ drill_id: string; due_at: string }>;
  activePool: TableSimActivePool;
  now?: Date;
}): PersistentReviewSnapshot {
  const now = args.now ?? new Date();
  const drillMap = new Map(args.drills.map((drill) => [drill.drill_id, drill]));
  const hydratedAttempts = args.attempts.flatMap((row) => {
    const drill = drillMap.get(row.drill_id);
    if (!drill) {
      return [];
    }

    const attempt = hydrateDrillAttempt(row, drill);
    return attempt ? [attempt] : [];
  });
  const attemptInsights = buildAttemptInsights(args.attempts, drillMap);
  const playerIntelligence = buildTableSimPlayerIntelligence({
    drills: args.drills,
    attemptInsights,
    srs: args.srs,
    activePool: args.activePool,
    confidenceInsights: hydratedAttempts.map((attempt) => ({
      confidence: attempt.confidence,
      correct: attempt.correct,
      classificationTags: attempt.drill.tags,
      missedTags: attempt.missedTags,
    })),
    now,
  });

  const recentMistakes = hydratedAttempts
    .filter((attempt) => !attempt.correct)
    .slice(0, 8)
    .map(toReviewQueueEntry);

  const reviewQueue = [...hydratedAttempts]
    .sort(compareReviewPriority)
    .slice(0, 12)
    .map(toReviewQueueEntry);

  return {
    generatedAt: now.toISOString(),
    attempts: hydratedAttempts,
    reviewQueue,
    recentMistakes,
    conceptMistakes: buildConceptMistakes(hydratedAttempts),
    unresolvedConcepts: playerIntelligence.priorities
      .filter((concept) => concept.status === "weakness")
      .slice(0, 5)
      .map((concept): UnresolvedConceptEntry => ({
        conceptKey: concept.conceptKey,
        label: concept.label,
        summary: concept.summary,
        recommendedPool: concept.recommendedPool as TableSimActivePool,
      })),
  };
}

function toReviewQueueEntry(attempt: DrillAttempt): ReviewQueueEntry {
  return {
    attemptId: attempt.attemptId,
    drillId: attempt.drill.drill_id,
    title: attempt.drill.title,
    nodeId: attempt.drill.node_id,
    score: attempt.score,
    correct: attempt.correct,
    confidence: attempt.confidence,
    timestamp: attempt.timestamp,
    reviewTag: attempt.missedTags[0] ?? attempt.resolvedAnswer.required_tags[0] ?? null,
    conceptTags: attempt.drill.tags.filter((tag) => tag.startsWith("concept:")),
  };
}

function buildConceptMistakes(attempts: DrillAttempt[]): ConceptMistakeEntry[] {
  const grouped = new Map<string, ConceptMistakeEntry>();

  for (const attempt of attempts.filter((entry) => !entry.correct)) {
    const conceptTags = attempt.drill.tags.filter((tag) => tag.startsWith("concept:"));
    const sources = conceptTags.length > 0 ? conceptTags : attempt.missedTags;

    for (const source of sources) {
      const current = grouped.get(source);
      if (!current) {
        grouped.set(source, {
          conceptKey: source,
          label: formatConceptLabelFromSource(source),
          mistakeCount: 1,
          latestAttemptId: attempt.attemptId,
          latestTimestamp: attempt.timestamp,
        });
        continue;
      }

      current.mistakeCount += 1;
      if (new Date(attempt.timestamp).getTime() > new Date(current.latestTimestamp).getTime()) {
        current.latestAttemptId = attempt.attemptId;
        current.latestTimestamp = attempt.timestamp;
      }
    }
  }

  return [...grouped.values()]
    .sort((a, b) => b.mistakeCount - a.mistakeCount || b.latestTimestamp.localeCompare(a.latestTimestamp))
    .slice(0, 6);
}

function compareReviewPriority(a: DrillAttempt, b: DrillAttempt): number {
  if (a.correct !== b.correct) {
    return a.correct ? 1 : -1;
  }

  const aWeight = confidenceWeight(a) + missedTagWeight(a);
  const bWeight = confidenceWeight(b) + missedTagWeight(b);
  if (aWeight !== bWeight) {
    return bWeight - aWeight;
  }

  if (a.score !== b.score) {
    return a.score - b.score;
  }

  return b.timestamp.localeCompare(a.timestamp);
}

function confidenceWeight(attempt: DrillAttempt): number {
  if (attempt.correct) {
    return 0;
  }

  if (attempt.confidence === "certain") {
    return 3;
  }

  if (attempt.confidence === "pretty_sure") {
    return 2;
  }

  return 1;
}

function missedTagWeight(attempt: DrillAttempt): number {
  return attempt.missedTags.length;
}

