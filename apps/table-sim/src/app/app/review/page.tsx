"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { buildTableSimPlayerIntelligence } from "@/lib/player-intelligence";
import { ReviewDrillList } from "@/components/review/ReviewDrillList";
import { ReviewFilterBar } from "@/components/review/ReviewFilterBar";
import { ReviewDrillDetail } from "@/components/review/ReviewDrillDetail";
import type { ReviewFilter } from "@/lib/review-types";
import type { PersistentReviewSnapshot } from "@/lib/study-attempts";

export default function ReviewPage() {
  const { state, dispatch, setReflection } = useSession();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<PersistentReviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState<ReviewFilter>(state.reviewInitialFilter);
  const [tagFilter, setTagFilter] = useState<string | null>(state.reviewInitialTag);
  const [zoomed, setZoomed] = useState(false);
  const [persistedReflections, setPersistedReflections] = useState<Record<string, string>>({});

  const didDispatchReview = useRef(false);
  useEffect(() => {
    if (!didDispatchReview.current && state.attempts.length > 0) {
      didDispatchReview.current = true;
      dispatch({
        type: "START_REVIEW",
        filter: state.reviewInitialFilter,
        tagFilter: state.reviewInitialTag,
      });
    }
  }, [state.attempts.length, state.reviewInitialFilter, state.reviewInitialTag, dispatch]);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      setLoading(true);
      try {
        const response = await fetch("/api/review-queue", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load review queue");
        }

        const data = (await response.json()) as PersistentReviewSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setPersistedReflections(Object.fromEntries(data.attempts.map((attempt) => [attempt.attemptId, attempt.reflection])));
        }
      } catch (error) {
        console.error("Failed to load review queue:", error);
        if (!cancelled) {
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const attempts = state.attempts.length > 0 ? state.attempts : (snapshot?.attempts ?? []);
  const usingPersistedAttempts = state.attempts.length === 0;

  const filteredIndices = useMemo(() => {
    return attempts
      .map((_, index) => index)
      .filter((index) => {
        const attempt = attempts[index];
        if (filter === "incorrect" && attempt.correct) return false;
        if (tagFilter) {
          const hasRequired = attempt.drill.answer.required_tags.includes(tagFilter);
          const hasMissed = attempt.missedTags.includes(tagFilter);
          const hasClassification = attempt.drill.tags.includes(tagFilter);
          if (!hasRequired && !hasMissed && !hasClassification) return false;
        }
        return true;
      });
  }, [attempts, filter, tagFilter]);

  useEffect(() => {
    if (filteredIndices.length > 0 && !filteredIndices.includes(selectedIndex)) {
      setSelectedIndex(filteredIndices[0]);
    }
  }, [filteredIndices, selectedIndex]);

  const handleReflectionChange = useCallback(async (text: string) => {
    const attempt = attempts[selectedIndex];
    if (!attempt) {
      return;
    }

    if (usingPersistedAttempts) {
      setPersistedReflections((current) => ({ ...current, [attempt.attemptId]: text }));
      const response = await fetch(`/api/attempts/${attempt.attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection: text }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist reflection");
      }
      return;
    }

    await setReflection(selectedIndex, text);
  }, [attempts, selectedIndex, setReflection, usingPersistedAttempts]);

  const currentAttempt = attempts[selectedIndex];
  const currentReflection = currentAttempt
    ? (usingPersistedAttempts ? persistedReflections[currentAttempt.attemptId] ?? currentAttempt.reflection : state.reflections[selectedIndex] ?? currentAttempt.reflection)
    : "";
  const playerIntelligence = useMemo(() => {
    if (attempts.length === 0) {
      return undefined;
    }

    return buildTableSimPlayerIntelligence({
      drills: attempts.map((attempt) => attempt.drill),
      attemptInsights: attempts.map((attempt) => ({
        drillId: attempt.drill.drill_id,
        nodeId: attempt.drill.node_id,
        score: attempt.score,
        correct: attempt.correct,
        missedTags: attempt.missedTags,
        classificationTags: attempt.drill.tags,
        activePool: attempt.activePool,
      })),
      activePool: state.config.activePool,
      confidenceInsights: attempts.map((attempt) => ({
        confidence: attempt.confidence,
        correct: attempt.correct,
        classificationTags: attempt.drill.tags,
        missedTags: attempt.missedTags,
      })),
      diagnosticInsights: attempts.flatMap((attempt) => attempt.diagnostic?.result.errorType ? [{
        conceptKey: attempt.diagnostic.result.conceptKey,
        concept: attempt.diagnostic.result.concept,
        errorType: attempt.diagnostic.result.errorType,
        confidenceMiscalibration: attempt.diagnostic.result.confidenceMiscalibration,
      }] : []),
    });
  }, [attempts, state.config.activePool]);

  const adaptiveSignal = playerIntelligence?.adaptiveProfile.surfaceSignals.review;
  const adaptiveProfile = playerIntelligence?.adaptiveProfile;

  return (
    <div className="min-h-screen py-4 px-3">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Review Session</h1>
          <button
            onClick={() => router.push(state.attempts.length > 0 ? "/app/summary" : "/app/session")}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {state.attempts.length > 0 ? "Back to Summary" : "Back to Command Center"}
          </button>
        </div>

        <ReviewFilterBar
          filter={filter}
          tagFilter={tagFilter}
          onFilterChange={setFilter}
          onTagFilterChange={setTagFilter}
        />

        <div className="mt-4 mb-4">
          <ReviewDrillList
            attempts={attempts}
            filteredIndices={filteredIndices}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading review history.</p>
        ) : filteredIndices.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            {attempts.length === 0 ? "No persisted review history yet." : "No drills match the current filter."}
          </p>
        ) : (
          currentAttempt && (
            <ReviewDrillDetail
              key={currentAttempt.attemptId}
              attempt={currentAttempt}
              reflection={currentReflection}
              onReflectionChange={(text) => {
                void handleReflectionChange(text);
              }}
              zoomed={zoomed}
              onToggleZoom={() => setZoomed((value) => !value)}
              adaptiveSignal={adaptiveSignal}
              adaptiveProfile={adaptiveProfile}
            />
          )
        )}
      </div>
    </div>
  );
}

