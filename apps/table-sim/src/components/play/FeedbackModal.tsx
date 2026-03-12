"use client";

import { useMemo } from "react";
import { buildReviewCoachModeViews, getDefaultReviewCoachMode } from "@/lib/drill-coach-view";
import type { DrillAttempt } from "@/lib/session-types";

interface FeedbackModalProps {
  attempt: DrillAttempt;
  onNext: () => void;
  isLast: boolean;
}

export function FeedbackModal({ attempt, onNext, isLast }: FeedbackModalProps) {
  const {
    correct,
    score,
    actionScore,
    sizingScore,
    tagScore,
    matchedTags,
    missedTags,
    userAction,
    userSizeBucket,
    elapsedMs,
    activePool,
    resolvedAnswer,
  } = attempt;
  const answer = resolvedAnswer;
  const drillCoach = useMemo(() => {
    const views = buildReviewCoachModeViews(attempt);
    return views.find((view) => view.mode === getDefaultReviewCoachMode(attempt))?.response ?? views[0].response;
  }, [attempt]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-700 p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div
          className={`text-center py-2 rounded-lg mb-4 font-bold text-lg ${
            correct
              ? "bg-emerald-600/30 text-emerald-400 border border-emerald-600/50"
              : "bg-red-600/30 text-red-400 border border-red-600/50"
          }`}
        >
          {correct ? "Correct!" : "Incorrect"}
        </div>

        <div className="text-center text-xs text-amber-300 mb-4 uppercase tracking-wide">
          Pool: {activePool}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="bg-gray-800 rounded-lg p-2.5 text-center">
            <div className="text-gray-400 text-xs">Total</div>
            <div className="font-bold text-lg text-white">
              {(score * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2.5 text-center">
            <div className="text-gray-400 text-xs">Time</div>
            <div className="font-bold text-lg text-white">
              {(elapsedMs / 1000).toFixed(1)}s
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-gray-400 text-xs">Action</div>
            <div className="font-semibold text-white">{actionScore > 0 ? actionScore.toFixed(1) : "0"}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-gray-400 text-xs">Tags</div>
            <div className="font-semibold text-white">{tagScore > 0 ? tagScore.toFixed(2) : "0"}</div>
          </div>
          {sizingScore > 0 && (
            <div className="bg-gray-800 rounded-lg p-2 text-center col-span-2">
              <div className="text-gray-400 text-xs">Sizing</div>
              <div className="font-semibold text-white">{sizingScore.toFixed(1)}</div>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Your action:</span>
            <span className={correct ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
              {userAction}{userSizeBucket ? ` ${userSizeBucket}%` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Correct:</span>
            <span className="text-white font-medium">
              {answer.correct}{answer.correct_size?.size_bucket ? ` ${answer.correct_size.size_bucket}%` : ""}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Required Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {answer.required_tags.map((tag) => {
              const matched = matchedTags.includes(tag);
              return (
                <span
                  key={tag}
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    matched
                      ? "bg-emerald-600/30 text-emerald-400 border border-emerald-600/50"
                      : "bg-red-600/30 text-red-400 border border-red-600/50"
                  }`}
                >
                  {matched ? "\u2713" : "\u2717"} {tag.replace(/_/g, " ")}
                </span>
              );
            })}
          </div>
          {missedTags.length > 0 && (
            <p className="text-xs text-red-400/70 mt-1">
              Missed: {missedTags.map((tag) => tag.replace(/_/g, " ")).join(", ")}
            </p>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            {answer.explanation}
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">
            Drill Coach
          </p>
          <p className="text-sm text-emerald-100 leading-relaxed">
            {drillCoach.headline}
          </p>
          <div className="space-y-2">
            {drillCoach.sections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-emerald-300/80">
                  {section.title}
                </p>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {section.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-colors"
        >
          {isLast ? "View Summary" : "Next Drill"}
        </button>
      </div>
    </div>
  );
}
