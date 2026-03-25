"use client";

import { useEffect, useState } from "react";
import { ConceptCaseScreen, type ConceptCaseScreenState } from "@/components/concepts/ConceptCaseScreen";
import type { ConceptCaseResponse } from "@/lib/concept-case";
import { fetchCalibrationSurface, findCalibrationSurfaceConcept } from "@/lib/calibration-surface";

export function ConceptCaseView({ conceptId }: { conceptId: string }) {
  const [state, setState] = useState<ConceptCaseScreenState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    async function loadConceptCase() {
      setState({ loading: true });
      try {
        const [response, calibrationSurface] = await Promise.all([
          fetch(`/api/concept-case/${encodeURIComponent(conceptId)}`, { cache: "no-store" }),
          fetchCalibrationSurface({ limit: 12, topLimit: 4 }).catch((error) => {
            console.error("Failed to load calibration surface:", error);
            return null;
          }),
        ]);
        if (response.status === 404) {
          if (!cancelled) {
            setState({ loading: false, data: null, calibration: calibrationSurface });
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to load concept case");
        }
        const data = (await response.json()) as ConceptCaseResponse;
        if (!cancelled) {
          setState({
            loading: false,
            data,
            calibration: calibrationSurface,
            conceptCalibration: findCalibrationSurfaceConcept(calibrationSurface, data.conceptKey),
          });
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
