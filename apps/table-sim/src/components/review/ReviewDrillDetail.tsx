"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdaptiveCoachingProfile } from "@poker-coach/core/browser";
import { TableView } from "@/components/table/TableView";
import { ReplayControls } from "./ReplayControls";
import { CoachDiagnosisCard, RangeSupportCard, StreetHistoryCard, StrategyFrequencyCard, TransparencyVerdictCard } from "./LearningTransparency";
import { DrillCoachingSummary } from "./DrillCoachingSummary";
import type { DrillAttempt } from "@/lib/session-types";
import {
  REVIEW_COACH_MODE_OPTIONS,
  buildDrillCoachingSnapshotFromAttempt,
  buildReviewCoachModeViews,
  getDefaultReviewCoachMode,
  type ReviewCoachMode,
} from "@/lib/drill-coach-view";
import {
  buildTransparencySnapshot,
  getVisibleBoardCards,
  type ReplayStreet,
} from "@/lib/learning-transparency";
import { detectTextures, getTextureHighlightMap } from "@/lib/board-texture";

interface ReviewDrillDetailProps {
  attempt: DrillAttempt;
  reflection: string;
  onReflectionChange: (text: string) => void;
  zoomed: boolean;
  onToggleZoom: () => void;
  adaptiveSignal?: string;
  adaptiveProfile?: AdaptiveCoachingProfile;
}

export function ReviewDrillDetail({
  attempt,
  reflection,
  onReflectionChange,
  zoomed,
  onToggleZoom,
  adaptiveSignal,
  adaptiveProfile,
}: ReviewDrillDetailProps) {
  const { drill, activePool } = attempt;
  const transparency = useMemo(() => buildTransparencySnapshot(attempt), [attempt]);
  const coachViews = useMemo(() => buildReviewCoachModeViews(attempt, adaptiveProfile), [attempt, adaptiveProfile]);
  const coachingSnapshot = useMemo(() => buildDrillCoachingSnapshotFromAttempt(attempt, adaptiveProfile), [attempt, adaptiveProfile]);

  const [currentStreet, setCurrentStreet] = useState<ReplayStreet>(transparency.decisionStreet);
  const [coachMode, setCoachMode] = useState<ReviewCoachMode>(getDefaultReviewCoachMode(attempt));

  useEffect(() => {
    setCurrentStreet(transparency.decisionStreet);
    setCoachMode(getDefaultReviewCoachMode(attempt));
  }, [attempt, transparency.decisionStreet]);

  const visibleCards = useMemo(
    () => getVisibleBoardCards(drill, currentStreet),
    [drill, currentStreet]
  );

  const flopCards = drill.scenario.board?.flop ?? [];
  const textureHighlights = useMemo(
    () => getTextureHighlightMap(visibleCards, flopCards),
    [visibleCards, flopCards]
  );

  const textures = useMemo(
    () => detectTextures(visibleCards, flopCards),
    [visibleCards, flopCards]
  );

  const activeCoachView = coachViews.find((view) => view.mode === coachMode) ?? coachViews[0];
  const currentStreetIndex = transparency.streets.indexOf(currentStreet);

  return (
    <div className="space-y-5">
      <TableView
        drill={drill}
        zoomed={zoomed}
        onToggleZoom={onToggleZoom}
        showHeroHand={true}
        replayStreet={currentStreet}
        textureHighlights={textureHighlights}
      />

      {textures.highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {textures.highlights.map((label) => (
            <span
              key={label}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${textureBadgeClass(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      <ReviewSummaryHeader attempt={attempt} />

      <StreetHistoryCard history={transparency.history} />

      <TransparencyVerdictCard verdict={transparency.verdict} />

      <ReplayControls
        streets={transparency.streets}
        currentStreet={currentStreet}
        onSelectStreet={setCurrentStreet}
        onStepForward={() => setCurrentStreet(transparency.streets[Math.min(currentStreetIndex + 1, transparency.streets.length - 1)] ?? currentStreet)}
        onStepBack={() => setCurrentStreet(transparency.streets[Math.max(currentStreetIndex - 1, 0)] ?? currentStreet)}
      />

      <StrategyFrequencyCard frequencyView={transparency.frequencies} />

      <CoachModeSelector activeMode={coachMode} onSelect={setCoachMode} />

      <DrillCoachingSummary
        snapshot={coachingSnapshot}
        activePool={activePool}
        focus={{
          label: activeCoachView.label,
          headline: activeCoachView.response.headline,
          detail: activeCoachView.response.sections.map((section) => section.text).join(" "),
          applicable: activeCoachView.applicable,
          emptyHeadline: activeCoachView.emptyHeadline,
          emptyMessage: activeCoachView.emptyMessage,
        }}
      />

      {adaptiveSignal ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-4 shadow-[0_18px_60px_rgba(14,165,233,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-sky-200">Coaching Emphasis</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{adaptiveSignal}</p>
        </div>
      ) : null}

      <RangeSupportCard rangeView={transparency.rangeView} />

      <CoachDiagnosisCard diagnosis={transparency.diagnosis} />

      <div>
        <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
          Reflection
        </label>
        <textarea
          value={reflection}
          onChange={(e) => onReflectionChange(e.target.value)}
          placeholder="What changed by street, and what does that do to the range?"
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
        />
      </div>
    </div>
  );
}

function ReviewSummaryHeader({ attempt }: { attempt: DrillAttempt }) {
  const resultTone = attempt.correct
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : "bg-red-500/15 text-red-300 border-red-500/30";
  const requiredTags = attempt.resolvedAnswer.required_tags.slice(0, 4);

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber-300">Review Drill</p>
          <h2 className="text-lg font-semibold text-white">{attempt.drill.title}</h2>
          <p className="text-sm leading-relaxed text-gray-300">{attempt.drill.prompt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${resultTone}`}>
            {attempt.correct ? "Correct" : "Needs Work"}
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
            Pool {attempt.activePool}
          </span>
          <span className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-200">
            Score {(attempt.score * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionSnapshot label="Your Line" value={formatAction(attempt.userAction, attempt.userSizeBucket)} tone={attempt.correct ? "good" : "warning"} />
        <ActionSnapshot label="Resolved Line" value={formatAction(attempt.resolvedAnswer.correct, attempt.resolvedAnswer.correct_size?.size_bucket ?? null)} tone="neutral" />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">Key Concepts</p>
        <div className="flex flex-wrap gap-2">
          {requiredTags.map((tag) => {
            const matched = attempt.matchedTags.includes(tag);
            return (
              <span
                key={tag}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  matched
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/30 bg-red-500/10 text-red-200"
                }`}
              >
                {matched ? "Seen" : "Missed"} {tag.replace(/_/g, " ")}
              </span>
            );
          })}
          {attempt.userTags
            .filter((tag) => !requiredTags.includes(tag))
            .slice(0, 2)
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs font-medium text-gray-300"
              >
                + {tag.replace(/_/g, " ")}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function CoachModeSelector({
  activeMode,
  onSelect,
}: {
  activeMode: ReviewCoachMode;
  onSelect: (mode: ReviewCoachMode) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-2">
      <div className="grid grid-cols-2 gap-2">
        {REVIEW_COACH_MODE_OPTIONS.map((option) => {
          const active = option.mode === activeMode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => onSelect(option.mode)}
              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/12 shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                  : "border-transparent bg-gray-800/70 hover:border-gray-700 hover:bg-gray-800"
              }`}
            >
              <p className={`text-sm font-semibold ${active ? "text-emerald-100" : "text-gray-100"}`}>
                {option.label}
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${active ? "text-emerald-200/80" : "text-gray-400"}`}>
                {option.subtitle}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionSnapshot({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warning" | "neutral";
}) {
  const toneClasses =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-red-500/30 bg-red-500/10 text-red-100"
        : "border-gray-700 bg-gray-800 text-gray-100";

  return (
    <div className={`rounded-xl border p-3 space-y-1 ${toneClasses}`}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-current/70">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatAction(action: string, sizeBucket: number | null | undefined): string {
  return sizeBucket ? `${action} ${sizeBucket}%` : action;
}

function textureBadgeClass(label: string): string {
  switch (label) {
    case "Flush Complete":
    case "Flush Draw":
    case "Monotone":
      return "bg-blue-600/30 text-blue-400 border border-blue-600/50";
    case "Paired Board":
      return "bg-purple-600/30 text-purple-400 border border-purple-600/50";
    case "Four-Liner":
      return "bg-orange-600/30 text-orange-400 border border-orange-600/50";
    case "Scare Ace":
      return "bg-red-600/30 text-red-400 border border-red-600/50";
    default:
      return "bg-gray-600/30 text-gray-400 border border-gray-600/50";
  }
}

