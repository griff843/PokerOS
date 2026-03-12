"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { InterventionPlan } from "@poker-coach/core/browser";
import { RecommendedTrainingBlockCard } from "@/components/training/RecommendedTrainingBlockCard";
import { useSession } from "@/lib/session-context";
import { loadSessionPlan } from "@/lib/session-plan";

interface InterventionPlanResponse extends InterventionPlan {
  currentId?: string;
  error?: string;
}

export default function TrainingSessionPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { startSession } = useSession();
  const [plan, setPlan] = useState<InterventionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planId = useMemo(() => String(params?.id ?? ""), [params]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/intervention-plan?id=${encodeURIComponent(planId)}`, { cache: "no-store" });
        const payload = (await response.json()) as InterventionPlanResponse;
        if (!response.ok) {
          throw new Error(payload.currentId
            ? `That recommendation has been refreshed. Open the current coach plan instead: ${payload.currentId}.`
            : payload.error ?? "Failed to load intervention plan");
        }
        if (!cancelled) {
          setPlan(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPlan(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to load intervention plan");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (planId) {
      loadPlan();
    }

    return () => {
      cancelled = true;
    };
  }, [planId]);

  async function handleStart() {
    if (!plan) {
      return;
    }

    setStarting(true);
    try {
      const sessionPlan = await loadSessionPlan(plan.totalTargetReps, plan.activePool, plan.id);
      startSession({
        config: {
          drillCount: sessionPlan.metadata.selectedCount,
          timed: true,
          activePool: plan.activePool,
        },
        plan: sessionPlan,
      });
      router.push("/app/play");
    } catch (startError) {
      console.error("Failed to start intervention session:", startError);
      setError(startError instanceof Error ? startError.message : "Failed to start intervention session");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)] px-6 py-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-200/85">Coach Plan</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2.7rem]">Intervention Session</h1>
            <p className="max-w-3xl text-sm leading-7 text-emerald-50/88 sm:text-base">
              A prescribed block built from your latest diagnostic signals, so the next session repairs the actual leak instead of just revisiting the loudest symptom.
            </p>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(9,14,27,0.84))] p-5 text-sm text-slate-300 shadow-[0_24px_80px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            Reading the current coach prescription.
          </section>
        ) : error ? (
          <section className="space-y-4 rounded-[30px] border border-amber-500/18 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] p-5 text-sm leading-6 text-amber-50 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => router.push("/app/session")}
              className="rounded-[20px] bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
            >
              Return to Command Center
            </button>
          </section>
        ) : plan ? (
          <RecommendedTrainingBlockCard
            plan={plan}
            onOpen={handleStart}
            ctaLabel={starting ? "Starting Session" : "Start Intervention Session"}
          />
        ) : null}
      </div>
    </div>
  );
}
