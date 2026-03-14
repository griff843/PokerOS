"use client";

import { useEffect, useState } from "react";
import { ConceptCaseScreen, type ConceptCaseScreenState } from "@/components/concepts/ConceptCaseScreen";
import type { ConceptCaseResponse } from "@/lib/concept-case";

export function ConceptCaseView({ conceptId }: { conceptId: string }) {
  const [state, setState] = useState<ConceptCaseScreenState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    async function loadConceptCase() {
      setState({ loading: true });
      try {
        const response = await fetch(`/api/concept-case/${encodeURIComponent(conceptId)}`, { cache: "no-store" });
        if (response.status === 404) {
          if (!cancelled) {
            setState({ loading: false, data: null });
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to load concept case");
        }
        const data = (await response.json()) as ConceptCaseResponse;
        if (!cancelled) {
          setState({ loading: false, data });
        }
      } catch (error) {
        console.error("Failed to load concept case:", error);
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load concept case",
          });
        }
      }
    }

    loadConceptCase();
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  return <ConceptCaseScreen state={state} />;
}
