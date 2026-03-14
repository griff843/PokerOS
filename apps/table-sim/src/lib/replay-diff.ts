import type {
  CoachingInputSnapshotRow,
  InterventionDecisionSnapshotRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import type { EngineManifestDriftSummary } from "./engine-manifest";
import {
  buildReplayInspector,
  type ReplayComparisonSummary,
  type ReplayEngineSection,
  type ReplayInspectorEngine,
} from "./replay-inspector";

export type ReplayDiffEngine = ReplayInspectorEngine;
export type ReplayDiffState = "no_history" | "partial_history" | "comparable";

export interface ReplayDiffPairMetadata {
  inputSnapshotId: string;
  inputCreatedAt: string;
  inputSchemaVersion: string;
  outputSnapshotId?: string | null;
  outputCreatedAt?: string | null;
  outputSummary?: string | null;
  linkedOutputId?: string | null;
  linkStatus: "linked" | "missing_output_link";
  engineVersion: string;
}

export interface ReplayDiffSparseHistory {
  isSparse: boolean;
  reason: "no_history" | "single_pair_only" | "missing_linked_output" | "enough_history";
}

export interface ReplayDiffResponse {
  conceptKey: string;
  label: string;
  engine: ReplayDiffEngine;
  state: ReplayDiffState;
  historyState: "none" | "partial" | "paired";
  inputHistoryCount: number;
  outputHistoryCount: number;
  linkedPairCount: number;
  latestPair?: ReplayDiffPairMetadata;
  previousPair?: ReplayDiffPairMetadata;
  changedEvidenceFields: string[];
  changedOutputFields: string[];
  manifestDrift: EngineManifestDriftSummary;
  interpretation: ReplayComparisonSummary["interpretation"];
  sparseHistory: ReplayDiffSparseHistory;
}

export function buildReplayDiff(args: {
  conceptKey: string;
  engine: ReplayDiffEngine;
  inputSnapshots?: CoachingInputSnapshotRow[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  transferSnapshots?: TransferEvaluationSnapshotRow[];
  now?: Date;
}): ReplayDiffResponse {
  const replay = buildReplayInspector({
    conceptKey: args.conceptKey,
    inputSnapshots: args.inputSnapshots,
    decisionSnapshots: args.decisionSnapshots,
    transferSnapshots: args.transferSnapshots,
    now: args.now,
  });
  const section = args.engine === "recommendation" ? replay.recommendation : replay.transfer;

  return {
    conceptKey: replay.conceptKey,
    label: replay.label,
    engine: args.engine,
    state: deriveReplayDiffState(section),
    historyState: section.historyState,
    inputHistoryCount: section.inputHistoryCount,
    outputHistoryCount: section.outputHistoryCount,
    linkedPairCount: section.linkedPairCount,
    latestPair: toReplayDiffPair(section.latestPair),
    previousPair: toReplayDiffPair(section.previousPair),
    changedEvidenceFields: section.comparison.changedEvidenceFields,
    changedOutputFields: section.comparison.changedOutputFields,
    manifestDrift: section.comparison.manifestDrift,
    interpretation: section.comparison.interpretation,
    sparseHistory: deriveSparseHistory(section),
  };
}

function deriveReplayDiffState(
  section: ReplayEngineSection<unknown, unknown>
): ReplayDiffState {
  if (section.inputHistoryCount === 0 && section.outputHistoryCount === 0) {
    return "no_history";
  }
  if (!section.latestPair || !section.previousPair || section.latestPair.linkStatus !== "linked" || section.previousPair.linkStatus !== "linked") {
    return "partial_history";
  }
  return "comparable";
}

function deriveSparseHistory(
  section: ReplayEngineSection<unknown, unknown>
): ReplayDiffSparseHistory {
  if (section.inputHistoryCount === 0 && section.outputHistoryCount === 0) {
    return { isSparse: true, reason: "no_history" };
  }
  if (!section.latestPair || !section.previousPair) {
    return { isSparse: true, reason: "single_pair_only" };
  }
  if (section.latestPair.linkStatus !== "linked" || section.previousPair.linkStatus !== "linked") {
    return { isSparse: true, reason: "missing_linked_output" };
  }
  return { isSparse: false, reason: "enough_history" };
}

function toReplayDiffPair(
  pair: ReplayEngineSection<unknown, unknown>["latestPair"] | undefined
): ReplayDiffPairMetadata | undefined {
  if (!pair) {
    return undefined;
  }

  return {
    inputSnapshotId: pair.input.id,
    inputCreatedAt: pair.input.createdAt,
    inputSchemaVersion: pair.input.schemaVersion,
    outputSnapshotId: getOutputField(pair.output, "id"),
    outputCreatedAt: getOutputField(pair.output, "createdAt"),
    outputSummary: summarizeOutput(pair.output),
    linkedOutputId: pair.linkedOutputId ?? null,
    linkStatus: pair.linkStatus,
    engineVersion: pair.input.engineManifest.engineVersion,
  };
}

function getOutputField(output: unknown, field: "id" | "createdAt"): string | null {
  if (!output || typeof output !== "object" || !(field in output)) {
    return null;
  }

  const value = (output as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function summarizeOutput(output: unknown): string | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  if ("action" in output && "recommendedStrategy" in output) {
    const recommendation = output as { action: string; recommendedStrategy: string };
    return `${recommendation.action}:${recommendation.recommendedStrategy}`;
  }
  if ("status" in output && "confidence" in output) {
    const transfer = output as { status: string; confidence: string };
    return `${transfer.status}:${transfer.confidence}`;
  }
  return null;
}
