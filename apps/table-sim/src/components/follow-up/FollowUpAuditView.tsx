"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatCorrectiveBucketLabels,
  inferCorrectiveBucketsFromWarnings,
  type FollowUpAuditProfile,
  type FollowUpAuditSummary,
} from "@/lib/follow-up-audit";
import { formatSessionLabel } from "@/lib/study-session-ui";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { loadRealHandFollowUpSessionPlan, type TableSimActivePool } from "@/lib/session-plan";

export function FollowUpAuditView() {
  const router = useRouter();
  const { startSession } = useSession();
  const [summary, setSummary] = useState<FollowUpAuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [warningFilter, setWarningFilter] = useState<"all" | "warnings_only" | "aligned_only">("all");
  const [profileFilter, setProfileFilter] = useState<"all" | FollowUpAuditProfile>("all");
  const [sortMode, setSortMode] = useState<"newest" | "warning_heavy">("newest");
  const [startingAuditId, setStartingAuditId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      try {
        const response = await fetch("/api/follow-up-audits", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load follow-up audits");
        }
        const data = (await response.json()) as FollowUpAuditSummary;
        if (!cancelled) {
          setSummary(data);
        }
      } catch (error) {
        console.error("Failed to load follow-up audits:", error);
        if (!cancelled) {
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const entries = summary?.recentEntries ?? [];
    return [...entries]
      .filter((entry) => {
        if (warningFilter === "warnings_only" && entry.warningCount === 0) {
          return false;
        }
        if (warningFilter === "aligned_only" && entry.warningCount > 0) {
          return false;
        }
        if (profileFilter !== "all" && entry.uncertaintyProfile !== profileFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortMode === "warning_heavy") {
          return right.warningCount - left.warningCount || right.createdAt.localeCompare(left.createdAt);
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }, [profileFilter, sortMode, summary?.recentEntries, warningFilter]);

  async function startCorrectiveBlock(entry: FollowUpAuditSummary["recentEntries"][number]) {
    setStartingAuditId(entry.id);
    try {
      const plan = await loadRealHandFollowUpSessionPlan({
        conceptKey: entry.conceptKey,
        activePool: entry.activePool as TableSimActivePool,
        preferredDrillIds: entry.selectedDrillIds,
        correctiveBuckets: inferCorrectiveBucketsFromWarnings(entry.warnings),
        handTitle: entry.handTitle,
        handSource: entry.handSource === "unknown" ? undefined : entry.handSource,
        parseStatus: entry.parseStatus === "unknown" ? undefined : entry.parseStatus,
        uncertaintyProfile: entry.uncertaintyProfile === "unknown" ? "turn_line_fuzzy" : entry.uncertaintyProfile,
        count: 6,
      });
      startSession({
        config: {
          drillCount: plan.drills.length,
          timed: true,
          activePool: plan.metadata.activePool,
        },
        plan,
      });
      router.push("/app/play");
    } catch (error) {
      console.error("Failed to start corrective block:", error);
      setStartingAuditId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AuditHeader loading={loading} summary={summary} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)]">
          <HealthCard loading={loading} summary={summary} />
          <ProfileCountsCard loading={loading} summary={summary} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <RecentAuditsCard
            loading={loading}
            summary={summary}
            entries={filteredEntries}
            startingAuditId={startingAuditId}
            warningFilter={warningFilter}
            profileFilter={profileFilter}
            sortMode={sortMode}
            onStartCorrectiveBlock={startCorrectiveBlock}
            onWarningFilterChange={setWarningFilter}
            onProfileFilterChange={setProfileFilter}
            onSortModeChange={setSortMode}
          />
          <BucketDistributionCard loading={loading} summary={summary} />
        </div>

        <TrendCard loading={loading} summary={summary} />
      </div>
    </div>
  );
}

function AuditHeader({ loading, summary }: { loading: boolean; summary: FollowUpAuditSummary | null }) {
  return (
    <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
      <div className="space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Follow-Up Audits</p>
          <div className="flex flex-wrap gap-2">
            <HeaderChip label={summary?.health.label ?? "Audit loading"} />
            <HeaderChip label={`${summary?.totalAudits ?? 0} persisted audits`} subtle />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">
            {summary
              ? "A clean read on whether the follow-up assignment engine is prescribing the right kinds of reps."
              : loading
                ? "Reading recent assignment audits"
                : "No follow-up audit history yet."}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">
            {summary?.health.detail ?? "Once real-hand follow-up blocks are created, this page will show whether the drill mix matched the hand’s uncertainty profile."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/hands"
              className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
            >
              Open Real Hands
            </Link>
            <Link
              href="/app/session"
              className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/16 hover:bg-white/10"
            >
              Return To Command Center
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function HealthCard({ loading, summary }: { loading: boolean; summary: FollowUpAuditSummary | null }) {
  const healthTone = summary?.health.label === "Aligned"
    ? "border-emerald-500/18 bg-emerald-500/8"
    : summary?.health.label === "Needs review"
      ? "border-amber-500/18 bg-amber-500/8"
      : "border-white/8 bg-black/20";

  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Assignment Health</p>
      <div className={`mt-4 rounded-[24px] border p-4 ${healthTone}`}>
        <p className="text-2xl font-semibold text-white">{summary?.health.label ?? (loading ? "Loading" : "No data")}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{summary?.health.detail ?? "No audit history is available yet."}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Audits" value={String(summary?.totalAudits ?? 0)} />
          <MetricTile label="Warnings" value={String(summary?.warningCounts.totalWarnings ?? 0)} />
          <MetricTile label="Warning avg" value={summary ? summary.warningCounts.averageWarningsPerEntry.toFixed(1) : "0.0"} />
        </div>
      </div>
    </section>
  );
}

function ProfileCountsCard({ loading, summary }: { loading: boolean; summary: FollowUpAuditSummary | null }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Uncertainty Profiles</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Which reconstruction states are driving the most follow-up assignments lately.</p>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading profile counts.</p>
        ) : summary && summary.profileCounts.length > 0 ? (
          summary.profileCounts.map((entry) => (
            <div key={entry.profile} className="rounded-[20px] border border-white/8 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{formatSessionLabel(entry.profile)}</p>
                <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">{entry.count}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-400">No persisted follow-up audits are available yet.</p>
        )}
      </div>
    </section>
  );
}

function RecentAuditsCard({
  loading,
  summary,
  entries,
  startingAuditId,
  warningFilter,
  profileFilter,
  sortMode,
  onStartCorrectiveBlock,
  onWarningFilterChange,
  onProfileFilterChange,
  onSortModeChange,
}: {
  loading: boolean;
  summary: FollowUpAuditSummary | null;
  entries: FollowUpAuditSummary["recentEntries"];
  startingAuditId: string | null;
  warningFilter: "all" | "warnings_only" | "aligned_only";
  profileFilter: "all" | FollowUpAuditProfile;
  sortMode: "newest" | "warning_heavy";
  onStartCorrectiveBlock: (entry: FollowUpAuditSummary["recentEntries"][number]) => Promise<void>;
  onWarningFilterChange: (value: "all" | "warnings_only" | "aligned_only") => void;
  onProfileFilterChange: (value: "all" | FollowUpAuditProfile) => void;
  onSortModeChange: (value: "newest" | "warning_heavy") => void;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Recent Audit Entries</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">The latest follow-up blocks, with enough detail to spot when the assignment engine is drifting.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <FilterGroup
          label="Warning filter"
          value={warningFilter}
          options={[
            { value: "all", label: "All" },
            { value: "warnings_only", label: "Warnings only" },
            { value: "aligned_only", label: "Aligned only" },
          ]}
          onChange={(value) => onWarningFilterChange(value as "all" | "warnings_only" | "aligned_only")}
        />
        <FilterGroup
          label="Profile"
          value={profileFilter}
          options={[
            { value: "all", label: "All profiles" },
            ...(summary?.profileCounts ?? []).map((entry) => ({
              value: entry.profile,
              label: formatSessionLabel(entry.profile),
            })),
          ]}
          onChange={(value) => onProfileFilterChange(value as "all" | FollowUpAuditProfile)}
        />
        <FilterGroup
          label="Sort"
          value={sortMode}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "warning_heavy", label: "Warning-heavy first" },
          ]}
          onChange={(value) => onSortModeChange(value as "newest" | "warning_heavy")}
        />
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading recent audit entries.</p>
        ) : entries.length > 0 ? (
          entries.map((entry) => {
            const correctiveBuckets = inferCorrectiveBucketsFromWarnings(entry.warnings);
            const correctiveLabels = formatCorrectiveBucketLabels(correctiveBuckets);

            return (
            <div key={entry.id} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">{entry.handTitle}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatSessionLabel(entry.conceptKey)} - {formatSessionLabel(entry.uncertaintyProfile)}</p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{entry.createdAtLabel}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {entry.bucketMixLabel || "No bucket mix recorded."}
                {" "}
                <span className="text-slate-500">Pool {entry.activePool === "baseline" ? "Baseline" : entry.activePool}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.selectedDrillIds.slice(0, 5).map((drillId) => (
                  <code key={drillId} className="rounded-full border border-white/8 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
                    {drillId}
                  </code>
                ))}
              </div>
              <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.16em] ${entry.warningCount > 0 ? "text-amber-200" : "text-emerald-200"}`}>
                {entry.warningCount > 0 ? `${entry.warningCount} warnings` : "Mix aligned"}
              </p>
              {correctiveLabels.length > 0 ? (
                <div className="mt-3 rounded-[18px] border border-amber-400/20 bg-amber-500/8 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Corrective focus</p>
                  <p className="mt-1 text-sm leading-6 text-amber-50/90">
                    This corrective block will overweight {joinWithAnd(correctiveLabels)}.
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onStartCorrectiveBlock(entry)}
                  disabled={startingAuditId === entry.id}
                  className="rounded-[16px] bg-emerald-500 px-3.5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-700/70 disabled:text-white"
                >
                  {startingAuditId === entry.id ? "Loading block" : entry.warningCount > 0 ? "Start corrective block" : "Replay this block"}
                </button>
              </div>
            </div>
          );
          })
        ) : (
          <p className="text-sm leading-6 text-slate-400">
            {summary?.recentEntries.length
              ? "No audit entries match the current filters."
              : "No follow-up audits have been persisted yet."}
          </p>
        )}
      </div>
    </section>
  );
}

function BucketDistributionCard({ loading, summary }: { loading: boolean; summary: FollowUpAuditSummary | null }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Bucket Distribution</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">How the assignment engine is currently spreading work across exact-match, transfer, bridge, and memory-decisive reps.</p>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading bucket distribution.</p>
        ) : summary ? (
          summary.bucketDistribution.map((entry) => (
            <div key={entry.bucket} className="rounded-[20px] border border-white/8 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{formatSessionLabel(entry.bucket)}</p>
                <span className="text-xs text-slate-400">{entry.count} reps</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-900">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{ width: `${Math.max(6, Math.round(entry.share * 100))}%` }}
                />
              </div>
            </div>
          ))
        ) : null}
      </div>
    </section>
  );
}

function TrendCard({ loading, summary }: { loading: boolean; summary: FollowUpAuditSummary | null }) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Trend Deltas</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Recent vs previous bucket movement, so we can see if the planner is quietly over-indexing one kind of follow-up rep.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading trend deltas.</p>
        ) : summary ? (
          summary.bucketTrend.deltas.map((entry) => (
            <div key={entry.bucket} className="rounded-[20px] border border-white/8 bg-black/20 p-3">
              <p className="text-sm font-semibold text-white">{formatSessionLabel(entry.bucket)}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">Recent {entry.recentCount} / Previous {entry.previousCount}</p>
              <p className={`mt-3 text-lg font-semibold ${entry.delta > 0 ? "text-emerald-300" : entry.delta < 0 ? "text-amber-300" : "text-slate-300"}`}>
                {entry.delta > 0 ? "+" : ""}{entry.delta}
              </p>
            </div>
          ))
        ) : null}
      </div>
    </section>
  );
}

function HeaderChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${subtle ? "border border-white/8 bg-white/5 text-slate-300" : "border border-emerald-400/25 bg-emerald-500/10 text-emerald-100"}`}>
      {label}
    </span>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[16px] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function joinWithAnd(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}
