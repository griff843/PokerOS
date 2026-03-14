import type {
  CoachingInputSnapshotRow,
  InterventionDecisionSnapshotRow,
  TransferEvaluationSnapshotRow,
} from "../../../../packages/db/src/repository";
import { toInterventionDecisionAuditRecord, type InterventionDecisionAuditRecord } from "./intervention-decision-audit";
import {
  toCoachingInputSnapshotRecord,
  type CoachingInputSnapshotRecord,
  type InterventionRecommendationInputSnapshotPayload,
  type TransferEvaluationInputSnapshotPayload,
} from "./input-snapshots";
import { compareEngineManifests, type EngineManifestDriftSummary, type TableSimEngineManifest } from "./engine-manifest";
import { toTransferAuditRecord, type TransferAuditRecord } from "./transfer-audit";

export type ReplayInspectorEngine = "recommendation" | "transfer";
export type ReplayInspectorInterpretation =
  | "insufficient_history"
  | "stable"
  | "output_changed_after_evidence_shift"
  | "output_stable_after_evidence_shift"
  | "output_changed_after_engine_shift"
  | "output_stable_after_engine_shift"
  | "output_changed_after_evidence_and_engine_shift"
  | "comparison_not_strongly_interpretable"
  | "output_changed_without_evidence_shift";

export interface ReplaySnapshotPair<InputPayload, OutputRecord> {
  input: CoachingInputSnapshotRecord & { payload: InputPayload };
  output?: OutputRecord;
  linkedOutputId?: string | null;
  linkStatus: "linked" | "missing_output_link";
}

export interface ReplayComparisonSummary {
  inputChanged: boolean;
  outputChanged: boolean;
  changedEvidenceFields: string[];
  changedOutputFields: string[];
  latestManifest?: TableSimEngineManifest;
  previousManifest?: TableSimEngineManifest;
  manifestDrift: EngineManifestDriftSummary;
  interpretation: ReplayInspectorInterpretation;
}

export interface ReplayEngineSection<InputPayload, OutputRecord> {
  engine: ReplayInspectorEngine;
  historyState: "none" | "partial" | "paired";
  inputHistoryCount: number;
  outputHistoryCount: number;
  linkedPairCount: number;
  latestPair?: ReplaySnapshotPair<InputPayload, OutputRecord>;
  previousPair?: ReplaySnapshotPair<InputPayload, OutputRecord>;
  recentPairs: Array<ReplaySnapshotPair<InputPayload, OutputRecord>>;
  latestOutputOnly?: OutputRecord;
  comparison: ReplayComparisonSummary;
}

export interface ConceptReplaySummary {
  historyAvailability: "none" | "partial" | "paired";
  recommendationInterpretation: ReplayInspectorInterpretation;
  transferInterpretation: ReplayInspectorInterpretation;
  operatorInterpretation: "insufficient_history" | "partial_history" | "paired_history";
}

export interface ReplayInspectorResponse {
  conceptKey: string;
  label: string;
  generatedAt: string;
  summary: ConceptReplaySummary;
  recommendation: ReplayEngineSection<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord>;
  transfer: ReplayEngineSection<TransferEvaluationInputSnapshotPayload, TransferAuditRecord>;
}

export function buildReplayInspector(args: {
  conceptKey: string;
  inputSnapshots?: CoachingInputSnapshotRow[];
  decisionSnapshots?: InterventionDecisionSnapshotRow[];
  transferSnapshots?: TransferEvaluationSnapshotRow[];
  now?: Date;
}): ReplayInspectorResponse {
  const recommendation = buildRecommendationReplaySection({
    conceptKey: args.conceptKey,
    inputSnapshots: args.inputSnapshots ?? [],
    decisionSnapshots: args.decisionSnapshots ?? [],
  });
  const transfer = buildTransferReplaySection({
    conceptKey: args.conceptKey,
    inputSnapshots: args.inputSnapshots ?? [],
    transferSnapshots: args.transferSnapshots ?? [],
  });
  const label = deriveConceptLabel(args.conceptKey, recommendation, transfer);

  return {
    conceptKey: args.conceptKey,
    label,
    generatedAt: (args.now ?? new Date()).toISOString(),
    summary: {
      historyAvailability: deriveHistoryAvailability(recommendation, transfer),
      recommendationInterpretation: recommendation.comparison.interpretation,
      transferInterpretation: transfer.comparison.interpretation,
      operatorInterpretation: deriveOperatorInterpretation(recommendation, transfer),
    },
    recommendation,
    transfer,
  };
}

function buildRecommendationReplaySection(args: {
  conceptKey: string;
  inputSnapshots: CoachingInputSnapshotRow[];
  decisionSnapshots: InterventionDecisionSnapshotRow[];
}): ReplayEngineSection<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord> {
  const inputs = args.inputSnapshots
    .filter((row) => row.concept_key === args.conceptKey && row.snapshot_type === "intervention_recommendation")
    .sort(compareRowsDesc)
    .map((row) => toCoachingInputSnapshotRecord(row) as CoachingInputSnapshotRecord & { payload: InterventionRecommendationInputSnapshotPayload });
  const outputs = args.decisionSnapshots
    .filter((row) => row.concept_key === args.conceptKey)
    .sort(compareRowsDesc);
  const outputsById = new Map(outputs.map((row) => [row.id, toInterventionDecisionAuditRecord(row)]));
  const recentPairs = inputs.slice(0, 3).map((input) => {
    const linkedOutputId = input.linkedDecisionSnapshotId ?? null;
    const output = linkedOutputId ? outputsById.get(linkedOutputId) : undefined;
    return {
      input,
      output,
      linkedOutputId,
      linkStatus: output ? "linked" : "missing_output_link",
    } satisfies ReplaySnapshotPair<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord>;
  });

  return {
    engine: "recommendation",
    historyState: deriveEngineHistoryState(inputs.length, outputs.length, recentPairs),
    inputHistoryCount: inputs.length,
    outputHistoryCount: outputs.length,
    linkedPairCount: recentPairs.filter((pair) => pair.linkStatus === "linked").length,
    latestPair: recentPairs[0],
    previousPair: recentPairs[1],
    recentPairs,
    latestOutputOnly: recentPairs.length === 0 ? outputsById.get(outputs[0]?.id ?? "") : undefined,
    comparison: buildComparisonSummary(
      recentPairs[0],
      recentPairs[1],
      diffRecommendationOutputs
    ),
  };
}

function buildTransferReplaySection(args: {
  conceptKey: string;
  inputSnapshots: CoachingInputSnapshotRow[];
  transferSnapshots: TransferEvaluationSnapshotRow[];
}): ReplayEngineSection<TransferEvaluationInputSnapshotPayload, TransferAuditRecord> {
  const inputs = args.inputSnapshots
    .filter((row) => row.concept_key === args.conceptKey && row.snapshot_type === "transfer_evaluation")
    .sort(compareRowsDesc)
    .map((row) => toCoachingInputSnapshotRecord(row) as CoachingInputSnapshotRecord & { payload: TransferEvaluationInputSnapshotPayload });
  const outputs = args.transferSnapshots
    .filter((row) => row.concept_key === args.conceptKey)
    .sort(compareRowsDesc);
  const outputsById = new Map(outputs.map((row) => [row.id, toTransferAuditRecord(row)]));
  const recentPairs = inputs.slice(0, 3).map((input) => {
    const linkedOutputId = input.linkedTransferSnapshotId ?? null;
    const output = linkedOutputId ? outputsById.get(linkedOutputId) : undefined;
    return {
      input,
      output,
      linkedOutputId,
      linkStatus: output ? "linked" : "missing_output_link",
    } satisfies ReplaySnapshotPair<TransferEvaluationInputSnapshotPayload, TransferAuditRecord>;
  });

  return {
    engine: "transfer",
    historyState: deriveEngineHistoryState(inputs.length, outputs.length, recentPairs),
    inputHistoryCount: inputs.length,
    outputHistoryCount: outputs.length,
    linkedPairCount: recentPairs.filter((pair) => pair.linkStatus === "linked").length,
    latestPair: recentPairs[0],
    previousPair: recentPairs[1],
    recentPairs,
    latestOutputOnly: recentPairs.length === 0 ? outputsById.get(outputs[0]?.id ?? "") : undefined,
    comparison: buildComparisonSummary(
      recentPairs[0],
      recentPairs[1],
      diffTransferOutputs
    ),
  };
}

function buildComparisonSummary<InputPayload, OutputRecord>(
  latestPair: ReplaySnapshotPair<InputPayload, OutputRecord> | undefined,
  previousPair: ReplaySnapshotPair<InputPayload, OutputRecord> | undefined,
  diffOutputs: (latest: OutputRecord, previous: OutputRecord) => string[]
): ReplayComparisonSummary {
  if (!latestPair || !previousPair) {
    return {
      inputChanged: false,
      outputChanged: false,
      changedEvidenceFields: [],
      changedOutputFields: [],
      latestManifest: latestPair?.input.engineManifest,
      previousManifest: previousPair?.input.engineManifest,
      manifestDrift: {
        matches: false,
        changedFields: [],
        priorVersion: previousPair?.input.engineManifest.engineVersion,
        latestVersion: latestPair?.input.engineManifest.engineVersion,
      },
      interpretation: "insufficient_history",
    };
  }

  const changedEvidenceFields = diffRecords(latestPair.input.payload, previousPair.input.payload);
  const manifestDrift = compareEngineManifests(
    latestPair.input.engineManifest,
    previousPair.input.engineManifest
  );
  const changedOutputFields = latestPair.output && previousPair.output
    ? diffOutputs(latestPair.output, previousPair.output)
    : [];
  const inputChanged = changedEvidenceFields.length > 0;
  const outputChanged = changedOutputFields.length > 0;

  return {
    inputChanged,
    outputChanged,
    changedEvidenceFields,
    changedOutputFields,
    latestManifest: latestPair.input.engineManifest,
    previousManifest: previousPair.input.engineManifest,
    manifestDrift,
    interpretation: !inputChanged && !outputChanged && manifestDrift.matches
      ? "stable"
      : inputChanged && outputChanged && !manifestDrift.matches
        ? "output_changed_after_evidence_and_engine_shift"
        : inputChanged && outputChanged
        ? "output_changed_after_evidence_shift"
        : inputChanged && !manifestDrift.matches
          ? "comparison_not_strongly_interpretable"
        : inputChanged
          ? "output_stable_after_evidence_shift"
          : !manifestDrift.matches && outputChanged
            ? "output_changed_after_engine_shift"
            : !manifestDrift.matches
              ? "output_stable_after_engine_shift"
          : "output_changed_without_evidence_shift",
  };
}

function diffRecommendationOutputs(
  latest: InterventionDecisionAuditRecord,
  previous: InterventionDecisionAuditRecord
): string[] {
  return diffNamedFields({
    action: latest.action,
    recommendedStrategy: latest.recommendedStrategy,
    confidence: latest.confidence,
    priority: latest.priority,
    suggestedIntensity: latest.suggestedIntensity,
    recoveryStage: latest.recoveryStage,
    currentInterventionStatus: latest.currentInterventionStatus ?? null,
    reasonCodes: latest.reasonCodes,
    patternTypes: latest.patternTypes,
    recurringLeak: latest.recurringLeak,
    transferGap: latest.transferGap,
    actedUpon: latest.actedUpon,
    linkedInterventionId: latest.linkedInterventionId ?? null,
  }, {
    action: previous.action,
    recommendedStrategy: previous.recommendedStrategy,
    confidence: previous.confidence,
    priority: previous.priority,
    suggestedIntensity: previous.suggestedIntensity,
    recoveryStage: previous.recoveryStage,
    currentInterventionStatus: previous.currentInterventionStatus ?? null,
    reasonCodes: previous.reasonCodes,
    patternTypes: previous.patternTypes,
    recurringLeak: previous.recurringLeak,
    transferGap: previous.transferGap,
    actedUpon: previous.actedUpon,
    linkedInterventionId: previous.linkedInterventionId ?? null,
  });
}

function diffTransferOutputs(
  latest: TransferAuditRecord,
  previous: TransferAuditRecord
): string[] {
  return diffNamedFields({
    status: latest.status,
    confidence: latest.confidence,
    evidenceSufficiency: latest.evidenceSufficiency,
    pressure: latest.pressure,
    studySampleSize: latest.studySampleSize,
    studyPerformance: latest.studyPerformance ?? null,
    studyRecentAverage: latest.studyRecentAverage ?? null,
    studyAverage: latest.studyAverage ?? null,
    studyFailedCount: latest.studyFailedCount,
    realPlayPerformance: latest.realPlayPerformance ?? null,
    realPlayOccurrences: latest.realPlayOccurrences,
    realPlayReviewSpotCount: latest.realPlayReviewSpotCount,
    studyVsRealPlayDelta: latest.studyVsRealPlayDelta ?? null,
    recoveryStage: latest.recoveryStage,
    retentionState: latest.retentionState ?? null,
    retentionResult: latest.retentionResult ?? null,
    patternTypes: latest.patternTypes,
    riskFlags: latest.riskFlags,
    linkedDecisionSnapshotId: latest.linkedDecisionSnapshotId ?? null,
    linkedRetentionScheduleId: latest.linkedRetentionScheduleId ?? null,
  }, {
    status: previous.status,
    confidence: previous.confidence,
    evidenceSufficiency: previous.evidenceSufficiency,
    pressure: previous.pressure,
    studySampleSize: previous.studySampleSize,
    studyPerformance: previous.studyPerformance ?? null,
    studyRecentAverage: previous.studyRecentAverage ?? null,
    studyAverage: previous.studyAverage ?? null,
    studyFailedCount: previous.studyFailedCount,
    realPlayPerformance: previous.realPlayPerformance ?? null,
    realPlayOccurrences: previous.realPlayOccurrences,
    realPlayReviewSpotCount: previous.realPlayReviewSpotCount,
    studyVsRealPlayDelta: previous.studyVsRealPlayDelta ?? null,
    recoveryStage: previous.recoveryStage,
    retentionState: previous.retentionState ?? null,
    retentionResult: previous.retentionResult ?? null,
    patternTypes: previous.patternTypes,
    riskFlags: previous.riskFlags,
    linkedDecisionSnapshotId: previous.linkedDecisionSnapshotId ?? null,
    linkedRetentionScheduleId: previous.linkedRetentionScheduleId ?? null,
  });
}

function diffRecords(left: unknown, right: unknown): string[] {
  return diffNamedFields(left as Record<string, unknown>, right as Record<string, unknown>);
}

function diffNamedFields(left: Record<string, unknown>, right: Record<string, unknown>): string[] {
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...fields]
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .sort();
}


function deriveConceptLabel(
  conceptKey: string,
  recommendation: ReplayEngineSection<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord>,
  transfer: ReplayEngineSection<TransferEvaluationInputSnapshotPayload, TransferAuditRecord>
): string {
  return recommendation.latestPair?.input.payload.label
    ?? transfer.latestPair?.input.payload.label
    ?? recommendation.previousPair?.input.payload.label
    ?? transfer.previousPair?.input.payload.label
    ?? conceptKey;
}

function deriveHistoryAvailability(
  recommendation: ReplayEngineSection<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord>,
  transfer: ReplayEngineSection<TransferEvaluationInputSnapshotPayload, TransferAuditRecord>
): ConceptReplaySummary["historyAvailability"] {
  const states = [recommendation.historyState, transfer.historyState];
  if (states.every((state) => state === "none")) {
    return "none";
  }
  if (states.every((state) => state === "paired" || state === "none")) {
    return "paired";
  }
  return "partial";
}

function deriveOperatorInterpretation(
  recommendation: ReplayEngineSection<InterventionRecommendationInputSnapshotPayload, InterventionDecisionAuditRecord>,
  transfer: ReplayEngineSection<TransferEvaluationInputSnapshotPayload, TransferAuditRecord>
): ConceptReplaySummary["operatorInterpretation"] {
  const availability = deriveHistoryAvailability(recommendation, transfer);
  if (availability === "paired") {
    return "paired_history";
  }
  if (availability === "partial") {
    return "partial_history";
  }
  return "insufficient_history";
}

function deriveEngineHistoryState<InputPayload, OutputRecord>(
  inputCount: number,
  outputCount: number,
  pairs: Array<ReplaySnapshotPair<InputPayload, OutputRecord>>
): ReplayEngineSection<InputPayload, OutputRecord>["historyState"] {
  if (inputCount === 0 && outputCount === 0) {
    return "none";
  }
  if (pairs.some((pair) => pair.linkStatus === "linked")) {
    return "paired";
  }
  return "partial";
}

function compareRowsDesc(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id);
}
