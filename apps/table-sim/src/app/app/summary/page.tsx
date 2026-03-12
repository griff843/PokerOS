"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";
import { SessionSummary } from "@/components/session/SessionSummary";

export default function SummaryPage() {
  const { state, dispatch } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.attempts.length === 0) {
      router.replace("/app/session");
    }
  }, [state.attempts.length, router]);

  if (state.attempts.length === 0) return null;

  function handleNewSession() {
    dispatch({ type: "RESET" });
    router.push("/app/session");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,67,0.14),rgba(3,7,18,0.98)_30%),linear-gradient(180deg,#020617_0%,#07111f_58%,#040816_100%)] px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <SessionSummary state={state} dispatch={dispatch} onNewSession={handleNewSession} />
      </div>
    </div>
  );
}
