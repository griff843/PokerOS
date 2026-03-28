"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { scoreTableSimDrill } from "@/lib/scoring-adapter";
import { buildTableSimPlayerIntelligence } from "@/lib/player-intelligence";
import type { DecisionConfidence } from "@/lib/session-types";
import { BoardScanPrompt } from "@/components/play/BoardScanPrompt";
import { CoachingPanel } from "@/components/play/CoachingPanel";
import { DecisionOverlay } from "@/components/play/DecisionOverlay";
import { SessionRail } from "@/components/play/SessionRail";
import { TableView } from "@/components/table/TableView";
import {
  actionNeedsSizing,
  extractConceptLabel,
  extractDecisionLabel,
  formatSessionLabel,
  isEditableTarget,
  resolveActionHotkey,
} from "@/lib/study-session-ui";

export default function PlayPage() {
  const { state, dispatch, submitDecision, setDiagnostic } = useSession();
  const router = useRouter();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<DecisionConfidence>("pretty_sure");

  useEffect(() => {
    if (state.phase === "configuring" && state.drills.length === 0) {
      router.replace("/app/session");
    }
    if (state.phase === "summary") {
      router.replace("/app/summary");
    }
  }, [state.phase, state.drills.length, router]);

  if (state.drills.length === 0) return null;

  const selectedDrill = state.drills[state.currentIndex];
  const drill = selectedDrill.drill;
  const isLast = state.currentIndex >= state.drills.length - 1;
  const needsSizing = drill.decision_point.sizing_buttons_enabled && actionNeedsSizing(selectedAction);
  const canSubmit = selectedAction !== null && selectedTags.length > 0 && (!needsSizing || selectedSize !== null);

  useEffect(() => {
    setSelectedAction(null);
    setSelectedSize(null);
    setSelectedTags([]);
    setConfidence("pretty_sure");
  }, [drill.drill_id, state.phase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (state.phase === "deciding") {
        const action = resolveActionHotkey(event.key, drill.options);
        if (action) {
          event.preventDefault();
          handleSelectAction(action);
          return;
        }

        if (event.key === "Enter" && canSubmit) {
          event.preventDefault();
          void handleSubmit();
        }
        return;
      }

      if (state.phase === "feedback" && (event.key === " " || event.key === "ArrowRight")) {
        event.preventDefault();
        handleNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSubmit, drill.options, state.phase, selectedAction, selectedSize, selectedTags, confidence]);

  function handleSelectAction(action: string) {
    setSelectedAction(action);
    if (!actionNeedsSizing(action)) {
      setSelectedSize(null);
    }
  }

  function handleToggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (!selectedAction) {
      return;
    }

    const elapsedMs = state.config.timed
      ? Date.now() - state.decisionStartedAt
      : 0;

    const result = scoreTableSimDrill({
      userAction: selectedAction,
      userSizeBucket: needsSizing ? selectedSize : null,
      userTags: selectedTags,
      drill,
      activePool: state.config.activePool,
    });

    try {
      await submitDecision({
        attemptId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        reflection: "",
        diagnostic: null,
        drill,
        selection: selectedDrill,
        activePool: state.config.activePool,
        resolvedAnswer: result.answer,
        userAction: selectedAction,
        userSizeBucket: needsSizing ? selectedSize : null,
        userTags: selectedTags,
        confidence,
        score: result.total,
        actionScore: result.actionScore,
        sizingScore: result.sizingScore,
        tagScore: result.tagScore,
        correct: result.correct,
        missedTags: result.missedTags,
        matchedTags: result.matchedTags,
        elapsedMs,
      });
    } catch (error) {
      console.error("Failed to persist attempt:", error);
    }
  }

  function handleNext() {
    dispatch({ type: "NEXT_DRILL" });
  }

  function handleExit() {
    router.push(state.attempts.length > 0 ? "/app/summary" : "/app/session");
  }

  const playerIntelligence = useMemo(() => {
    if (state.attempts.length === 0) {
      return undefined;
    }

    return buildTableSimPlayerIntelligence({
      drills: state.drills.map((entry) => entry.drill),
      attemptInsights: state.attempts.map((attempt) => ({
        drillId: attempt.drill.drill_id,
        nodeId: attempt.drill.node_id,
        score: attempt.score,
        correct: attempt.correct,
        missedTags: attempt.missedTags,
        classificationTags: attempt.drill.tags,
        activePool: attempt.activePool,
      })),
      activePool: state.config.activePool,
      confidenceInsights: state.attempts.map((attempt) => ({
        confidence: attempt.confidence,
        correct: attempt.correct,
        classificationTags: attempt.drill.tags,
        missedTags: attempt.missedTags,
      })),
      diagnosticInsights: state.attempts.flatMap((attempt) => attempt.diagnostic?.result.errorType ? [{
        conceptKey: attempt.diagnostic.result.conceptKey,
        concept: attempt.diagnostic.result.concept,
        errorType: attempt.diagnostic.result.errorType,
        confidenceMiscalibration: attempt.diagnostic.result.confidenceMiscalibration,
      }] : []),
    });
  }, [state.attempts, state.config.activePool, state.drills]);

  const adaptiveSignal = playerIntelligence?.adaptiveProfile.surfaceSignals.studySession;
  const adaptiveProfile = playerIntelligence?.adaptiveProfile;

  const conceptLabel = extractConceptLabel(drill);
  const decisionLabel = extractDecisionLabel(drill);
  const spotLabel = `${formatSessionLabel(drill.scenario.pot_type)} | ${drill.scenario.hero_position} vs ${drill.scenario.villain_position}`;
  const assignmentRationale = selectedDrill.metadata.assignmentRationale;
  const correctiveFocusNote = state.planMetadata?.notes.find((note) => note.startsWith("Corrective weighting applied:"));
  const followUpContextNote = state.planMetadata?.notes.find((note) =>
    note.includes("Memory-ambiguous follow-up")
    || note.includes("Manual reconstruction with a clear turn-line family")
    || note.includes("Sizing-fuzzy follow-up")
    || note.includes("Memory-decisive follow-up")
    || note.includes("Precise import follow-up"),
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,83,45,0.16),rgba(2,6,23,1)_30%),linear-gradient(180deg,rgba(2,6,23,1),rgba(3,7,18,1))] px-4 py-5 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <SessionRail
          drill={drill}
          attempts={state.attempts}
          assignmentBucket={selectedDrill.metadata.assignmentBucket}
          assignmentRationale={selectedDrill.metadata.assignmentRationale}
          correctiveFocus={correctiveFocusNote}
          onExit={handleExit}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="space-y-5">
            <section className="rounded-[30px] border border-white/8 bg-gray-900/75 px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">
                    Current Focus
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                      {conceptLabel}
                    </span>
                    <span className="rounded-full border border-white/8 bg-black/25 px-3 py-1 text-xs font-medium text-gray-300">
                      {decisionLabel}
                    </span>
                    <span className="rounded-full border border-white/8 bg-black/25 px-3 py-1 text-xs font-medium text-gray-400">
                      {spotLabel}
                    </span>
                  </div>
                </div>
                <p className="max-w-sm text-sm leading-6 text-gray-400">
                  {state.phase === "feedback"
                    ? "Decision logged. Absorb the one adjustment that matters, then move on."
                    : "Read the spot first, then commit to one clean line."}
                </p>
              </div>
              {followUpContextNote ? (
                <div className="mt-4 rounded-[22px] border border-amber-300/18 bg-amber-300/10 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                    Follow-Up Context
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-50/90">{followUpContextNote}</p>
                </div>
              ) : null}
              {assignmentRationale ? (
                <div className="mt-4 rounded-[22px] border border-sky-500/18 bg-sky-500/8 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200/85">
                    Why This Drill Was Picked
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{assignmentRationale}</p>
                </div>
              ) : null}
              {correctiveFocusNote ? (
                <div className="mt-4 rounded-[22px] border border-emerald-400/18 bg-emerald-500/8 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/85">
                    Corrective Focus
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/90">{correctiveFocusNote}</p>
                </div>
              ) : null}
            </section>

            <TableView
              drill={drill}
              zoomed={state.zoomBoard}
              onToggleZoom={() => dispatch({ type: "TOGGLE_ZOOM" })}
            />
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            {state.phase === "deciding" ? (
              <DecisionOverlay
                drill={drill}
                selectedAction={selectedAction}
                selectedSize={selectedSize}
                selectedTags={selectedTags}
                confidence={confidence}
                canSubmit={canSubmit}
                onSelectAction={handleSelectAction}
                onSelectSize={setSelectedSize}
                onToggleTag={handleToggleTag}
                onSetConfidence={setConfidence}
                onSubmit={() => void handleSubmit()}
              />
            ) : null}

            {state.phase === "feedback" && state.attempts.length > 0 ? (
              <CoachingPanel
                attempt={state.attempts[state.attempts.length - 1]}
                onAdvance={handleNext}
                onCaptureDiagnostic={(diagnostic) => void setDiagnostic(state.attempts.length - 1, diagnostic)}
                isLast={isLast}
                adaptiveSignal={adaptiveSignal}
                adaptiveProfile={adaptiveProfile}
              />
            ) : null}
          </div>
        </div>
      </div>

      {state.phase === "board_scan" ? (
        <BoardScanPrompt onDismiss={() => dispatch({ type: "DISMISS_BOARD_SCAN" })} />
      ) : null}
    </div>
  );
}


