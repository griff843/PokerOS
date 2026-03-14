"use client";

import { useEffect, useState } from "react";
import { ReplayInspectorScreen, type ReplayInspectorScreenState } from "@/components/concepts/ReplayInspectorScreen";
import type { ReplayInspectorResponse } from "@/lib/replay-inspector";

export function ReplayInspectorView({ conceptId }: { conceptId: string }) {
  const [state, setState] = useState<ReplayInspectorScreenState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    async function loadReplayInspector() {
      setState({ loading: true });
      try {
        const response = await fetch(`/api/replay-inspector/${encodeURIComponent(conceptId)}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load replay inspector");
        }
        const data = (await response.json()) as ReplayInspectorResponse;
        if (!cancelled) {
          setState({ loading: false, data });
        }
      } catch (error) {
        console.error("Failed to load replay inspector:", error);
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load replay inspector",
          });
        }
      }
    }

    loadReplayInspector();
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  return <ReplayInspectorScreen state={state} />;
}
