import React, { type ReactNode } from "react";
import Link from "next/link";
import type { ReplayComparisonSummary, ReplayEngineSection, ReplayInspectorResponse } from "@/lib/replay-inspector";
import type { InterventionRecommendationInputSnapshotPayload, TransferEvaluationInputSnapshotPayload } from "@/lib/input-snapshots";
import type { InterventionDecisionAuditRecord } from "@/lib/intervention-decision-audit";
import type { TransferAuditRecord } from "@/lib/transfer-audit";

export interface ReplayInspectorScreenState {
  loading: boolean;
  error?: string | null;
  data?: ReplayInspectorResponse | null;
}

export function ReplayInspectorScreen({ state }: { state: ReplayInspectorScreenState }) {
  if (state.loading) {
    return (
      <ReplayPageFrame>
        <ReplayPanel eyebrow="Replay Inspector" title="Loading replay history" tone="neutral">
          <p className="text-sm leading-6 text-slate-300">Reading persisted input and output snapshot pairs for the latest recommendation and transfer history.</p>
        </ReplayPanel>
      </ReplayPageFrame>
    );
  }

  if (state.error) {
    return (
      <ReplayPageFrame>
        <ReplayPanel eyebrow="Replay Inspector" title="Replay inspector unavailable" tone="warning">
          <p className="text-sm leading-6 text-slate-200">{state.error}</p>
          <ReplayNav conceptKey={state.data?.conceptKey} />
        </ReplayPanel>
      </ReplayPageFrame>
    );
  }

  if (!state.data) {
    return (
      <ReplayPageFrame>
        <ReplayPanel eyebrow="Replay Inspector" title="No replay data found" tone="neutral">
          <p className="text-sm leading-6 text-slate-300">There is not enough persisted snapshot history yet to inspect this concept’s replay trail.</p>
          <ReplayNav />
        </ReplayPanel>
      </ReplayPageFrame>
    );
  }

  return (
    <ReplayPageFrame>
      <div className="space-y-6">
        <ReplayInspectorHeader data={state.data} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.94fr)_minmax(320px,1.06fr)]">
          <ReplaySummaryCard data={state.data} />
          <ReplayInterpretationCard data={state.data} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <SnapshotPairCard
            eyebrow="Recommendation Replay"
            title="Recommendation input/output history"
            section={state.data.recommendation}
            renderInputSummary={renderRecommendationInputSummary}
            renderOutputSummary={renderRecommendationOutputSummary}
          />
          <SnapshotPairCard
            eyebrow="Transfer Replay"
            title="Transfer input/output history"
            section={state.data.transfer}
            renderInputSummary={renderTransferInputSummary}
            renderOutputSummary={renderTransferOutputSummary}
          />
        </div>
        <ReplayNav conceptKey={state.data.conceptKey} />
      </div>
    </ReplayPageFrame>
  );
}

export function ReplayInspectorHeader({ data }: { data: ReplayInspectorResponse }) {
  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <HeaderChip label="Coach Replay Inspector" />
          <HeaderChip label={data.summary.historyAvailability} subtle />
          <HeaderChip label={data.summary.operatorInterpretation.replace(/_/g, " ")} subtle />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{data.conceptKey}</p>
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">{data.label}</h1>
          <p className="max-w-3xl text-sm leading-7 text-amber-50/88 sm:text-base">
            Inspect the persisted normalized evidence and linked outputs that shaped the latest recommendation and transfer judgments for this concept.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <HeaderMetric label="Recommendation history" value={String(data.recommendation.inputHistoryCount)} />
          <HeaderMetric label="Transfer history" value={String(data.transfer.inputHistoryCount)} />
          <HeaderMetric label="Generated" value={formatDateTime(data.generatedAt)} />
        </div>
      </div>
    </section>
  );
}

export function ReplaySummaryCard({ data }: { data: ReplayInspectorResponse }) {
  return (
    <ReplayPanel eyebrow="Concept Replay Summary" title="Replay Summary" tone="neutral">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryStat
          label="History availability"
          detail={`Recommendation replay is ${data.recommendation.historyState}. Transfer replay is ${data.transfer.historyState}.`}
        />
        <SummaryStat
          label="Recommendation interpretation"
          detail={formatInterpretation(data.recommendation.comparison)}
        />
        <SummaryStat
          label="Transfer interpretation"
          detail={formatInterpretation(data.transfer.comparison)}
        />
        <SummaryStat
          label="Linked pairs"
          detail={`${data.recommendation.linkedPairCount} recommendation pair${data.recommendation.linkedPairCount === 1 ? "" : "s"} and ${data.transfer.linkedPairCount} transfer pair${data.transfer.linkedPairCount === 1 ? "" : "s"} currently link input to output cleanly.`}
        />
      </div>
    </ReplayPanel>
  );
}

export function ReplayInterpretationCard({ data }: { data: ReplayInspectorResponse }) {
  return (
    <ReplayPanel eyebrow="Operator Read" title="What Changed" tone="good">
      <div className="space-y-4">
        <InterpretationBlock
          title="Recommendation"
          detail={formatInterpretation(data.recommendation.comparison)}
        />
        <InterpretationBlock
          title="Transfer"
          detail={formatInterpretation(data.transfer.comparison)}
        />
        <div className="rounded-[22px] border border-amber-500/18 bg-amber-500/8 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Grounding rule</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            These summaries compare persisted evidence and persisted outputs. They indicate whether outputs shifted alongside evidence, not whether one proved the other.
          </p>
        </div>
      </div>
    </ReplayPanel>
  );
}

export function SnapshotPairCard<InputPayload, OutputRecord extends { createdAt: string }>({
  eyebrow,
  title,
  section,
  renderInputSummary,
  renderOutputSummary,
}: {
  eyebrow: string;
  title: string;
  section: ReplayEngineSection<InputPayload, OutputRecord>;
  renderInputSummary: (payload: InputPayload) => string;
  renderOutputSummary: (output: OutputRecord) => string;
}) {
  return (
    <ReplayPanel eyebrow={eyebrow} title={title} tone="neutral">
      <div className="space-y-5">
        <ComparisonBlock comparison={section.comparison} />
        {section.latestPair ? (
          <PairDetailCard
            title="Latest pair"
            pair={section.latestPair}
            renderInputSummary={renderInputSummary}
            renderOutputSummary={renderOutputSummary}
          />
        ) : (
          <EmptyPairCard text="No persisted input/output pair is available yet for this engine." />
        )}
        {section.previousPair ? (
          <PairDetailCard
            title="Previous pair"
            pair={section.previousPair}
            renderInputSummary={renderInputSummary}
            renderOutputSummary={renderOutputSummary}
          />
        ) : (
          <EmptyPairCard text="Only one persisted pair is available so far, so there is not enough history for a prior comparison." />
        )}
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Recent snapshot chain</p>
          {section.recentPairs.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-300">No persisted pairs are available yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
              {section.recentPairs.map((pair) => (
                <li key={pair.input.id}>
                  {formatDateTime(pair.input.createdAt)} · input `{pair.input.id}` · output `{pair.linkedOutputId ?? "unlinked"}` · {pair.linkStatus.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ReplayPanel>
  );
}

function ComparisonBlock({ comparison }: { comparison: ReplayComparisonSummary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SummaryStat label="Interpretation" detail={formatInterpretation(comparison)} />
      <SummaryStat
        label="Comparison coverage"
        detail={comparison.interpretation === "insufficient_history"
          ? "Not enough paired history yet to compare current and previous snapshots cleanly."
          : `${comparison.changedEvidenceFields.length} evidence field change${comparison.changedEvidenceFields.length === 1 ? "" : "s"} and ${comparison.changedOutputFields.length} output field change${comparison.changedOutputFields.length === 1 ? "" : "s"} detected.`}
      />
      <ChangeList title="Evidence changes" items={comparison.changedEvidenceFields} emptyText="No evidence-field change detected across the latest comparable pairs." />
      <ChangeList title="Output changes" items={comparison.changedOutputFields} emptyText="No output-field change detected across the latest comparable pairs." />
    </div>
  );
}

function PairDetailCard<InputPayload, OutputRecord extends { createdAt: string }>({
  title,
  pair,
  renderInputSummary,
  renderOutputSummary,
}: {
  title: string;
  pair: ReplayEngineSection<InputPayload, OutputRecord>["latestPair"];
  renderInputSummary: (payload: InputPayload) => string;
  renderOutputSummary: (output: OutputRecord) => string;
}) {
  if (!pair) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <HeaderChip label={title} subtle />
        <HeaderChip label={pair.linkStatus.replace(/_/g, " ")} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <PairPane
          title="Input snapshot"
          timestamp={pair.input.createdAt}
          id={pair.input.id}
          version={pair.input.schemaVersion}
          summary={renderInputSummary(pair.input.payload)}
          metadata={[
            `Recovery stage: ${pair.input.recoveryStage}`,
            `Pattern count: ${pair.input.patternTypes.length}`,
            pair.input.sourceContext ? `Source: ${pair.input.sourceContext}` : null,
          ]}
        />
        <PairPane
          title="Output snapshot"
          timestamp={pair.output ? String(pair.output.createdAt) : undefined}
          id={pair.linkedOutputId ?? undefined}
          version={undefined}
          summary={pair.output ? renderOutputSummary(pair.output) : "No linked output snapshot was found for this persisted input snapshot."}
          metadata={[
            pair.output ? "Linked output present." : "Linked output missing.",
          ]}
        />
      </div>
    </div>
  );
}

function PairPane({
  title,
  timestamp,
  id,
  version,
  summary,
  metadata,
}: {
  title: string;
  timestamp?: string;
  id?: string;
  version?: string;
  summary: string;
  metadata: Array<string | null | undefined>;
}) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{summary}</p>
      <div className="mt-3 space-y-1.5 text-xs uppercase tracking-[0.18em] text-slate-400">
        {id ? <p>ID: {id}</p> : null}
        {version ? <p>Version: {version}</p> : null}
        {timestamp ? <p>At: {formatDateTime(timestamp)}</p> : null}
        {metadata.filter(Boolean).map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function ChangeList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-300">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-white/8 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyPairCard({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function ReplayPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

function ReplayPanel({
  eyebrow,
  title,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  tone: "good" | "warning" | "neutral";
  children: ReactNode;
}) {
  const toneClass = tone === "good"
    ? "border-emerald-500/14 bg-[linear-gradient(180deg,rgba(7,18,24,0.94),rgba(8,16,28,0.9))]"
    : tone === "warning"
      ? "border-amber-500/14 bg-[linear-gradient(180deg,rgba(24,17,7,0.92),rgba(20,14,8,0.88))]"
      : "border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,14,27,0.86))]";

  return (
    <section className={`rounded-[30px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryStat({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function InterpretationBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function HeaderChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${subtle ? "border-white/8 bg-white/5 text-slate-300" : "border-amber-400/25 bg-amber-500/10 text-amber-100"}`}>
      {label}
    </span>
  );
}

function ReplayNav({ conceptKey }: { conceptKey?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      {conceptKey ? (
        <Link
          href={`/app/concepts/${encodeURIComponent(conceptKey)}`}
          className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
        >
          Open concept case
        </Link>
      ) : null}
      <Link
        href="/app/session"
        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
      >
        Return To Command Center
      </Link>
    </div>
  );
}

function renderRecommendationInputSummary(payload: InterventionRecommendationInputSnapshotPayload): string {
  return `${payload.diagnosisSummary.count} diagnosis entries, ${payload.interventionSummary.count} intervention records, ${payload.patternSummary.count} pattern signals, recovery ${payload.recoveryStage}, urgency ${Math.round(payload.trainingUrgency * 100)}%.`;
}

function renderRecommendationOutputSummary(output: InterventionDecisionAuditRecord): string {
  return `${output.action.replace(/_/g, " ")} via ${output.recommendedStrategy.replace(/_/g, " ")} at ${output.confidence} confidence, priority ${output.priority}.`;
}

function renderTransferInputSummary(payload: TransferEvaluationInputSnapshotPayload): string {
  return `${payload.studySummary.sampleSize} study reps, ${payload.realPlaySummary.occurrences} real-play occurrences, ${payload.patternSummary.count} transfer-relevant patterns, recovery ${payload.recoveryStage}.`;
}

function renderTransferOutputSummary(output: TransferAuditRecord): string {
  return `${output.status.replace(/_/g, " ")} at ${output.confidence} confidence with ${output.evidenceSufficiency} evidence and ${output.pressure} pressure.`;
}

function formatInterpretation(comparison: ReplayComparisonSummary): string {
  switch (comparison.interpretation) {
    case "stable":
      return "The latest comparable pair stayed stable: no meaningful evidence-field or output-field shift was detected.";
    case "output_changed_after_evidence_shift":
      return "The latest output shifted after the stored normalized evidence changed. This supports an evidence-linked change, not exact causality.";
    case "output_stable_after_evidence_shift":
      return "The normalized evidence shifted, but the output stayed stable across the latest comparable pair.";
    case "output_changed_after_engine_shift":
      return "The latest output shifted under an engine-manifest change while normalized evidence stayed stable. Treat this as version drift, not direct causal proof.";
    case "output_stable_after_engine_shift":
      return "The engine manifest changed, but the latest comparable output stayed stable across the replay pair.";
    case "output_changed_after_evidence_and_engine_shift":
      return "Both normalized evidence and engine manifest changed before the latest output shift, so the comparison is informative but not strongly attributable to one cause.";
    case "comparison_not_strongly_interpretable":
      return "The latest pair includes both evidence and manifest drift without an output change, so the comparison should be treated conservatively.";
    case "output_changed_without_evidence_shift":
      return "The output shifted without a detected input-bundle delta in the latest comparable pair. That is useful for operator review.";
    case "insufficient_history":
      return "There is not enough paired replay history yet to compare the latest state against a prior one cleanly.";
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
