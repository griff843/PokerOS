"use client";

import { useEffect, useState } from "react";
import {
  InterventionExecutionScreen,
  type InterventionExecutionScreenState,
} from "@/components/concepts/InterventionExecutionScreen";
import type { InterventionExecutionBundle } from "@/lib/intervention-execution";

export function InterventionExecutionView({ conceptId }: { conceptId: string }) {
  const [state, setState] = useState<InterventionExecutionScreenState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    async function loadExecution() {
      setState({ loading: true });
      try {
        const response = await fetch(
          `/api/intervention-execution/${encodeURIComponent(conceptId)}`,
          { cache: "no-store" }
        );
        if (response.status === 404) {
          if (!cancelled) setState({ loading: false, data: null });
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to load intervention execution data");
        }
        const data = (await response.json()) as InterventionExecutionBundle;
        if (!cancelled) setState({ loading: false, data });
      } catch (error) {
        console.error("Failed to load intervention execution:", error);
        if (!cancelled) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load intervention execution data",
          });
        }
      }
    }

    loadExecution();
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  return <InterventionExecutionScreen state={state} />;
}
