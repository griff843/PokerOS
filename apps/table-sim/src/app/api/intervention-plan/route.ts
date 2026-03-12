export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { WeaknessPool } from "@poker-coach/core/browser";
import { ensureInterventionForPlan, toDiagnosisHistoryEntries, toInterventionHistoryEntries } from "../../../lib/coaching-memory";
import { loadLocalStudyData, resolveDbPath } from "../../../lib/local-study-data";
import { createRecommendedInterventionDecision, createRecommendedInterventionPlan } from "../../../lib/session-plan-server";
import { openDatabase } from "../../../../../../packages/db/src";

export async function GET(request: NextRequest) {
  try {
    const { drills, attempts, srs, diagnoses, interventions } = loadLocalStudyData();
    const activePool = (request.nextUrl.searchParams.get("pool") ?? attempts[0]?.active_pool ?? "baseline") as WeaknessPool;
    const now = new Date();
    const decision = createRecommendedInterventionDecision({
      drills,
      attempts,
      srs,
      activePool,
      diagnosisHistory: toDiagnosisHistoryEntries(diagnoses),
      interventionHistory: toInterventionHistoryEntries(interventions),
      now,
    });
    const plan = createRecommendedInterventionPlan({
      drills,
      attempts,
      srs,
      activePool,
      diagnosisHistory: toDiagnosisHistoryEntries(diagnoses),
      interventionHistory: toInterventionHistoryEntries(interventions),
      now,
    });
    const requestedId = request.nextUrl.searchParams.get("id");

    if (requestedId && requestedId !== plan.id) {
      return NextResponse.json({ error: "Intervention plan is no longer current", currentId: plan.id }, { status: 404 });
    }

    const dbPath = resolveDbPath();
    if (dbPath) {
      const db = openDatabase(dbPath);
      try {
        if (decision && ["assign_intervention", "continue_intervention", "escalate_intervention", "change_intervention_strategy", "add_transfer_block", "reopen_intervention"].includes(decision.action)) {
          ensureInterventionForPlan({
            db,
            conceptKey: decision.conceptKey,
            source: "command_center",
            createdAt: plan.generatedAt,
          });
        }
      } finally {
        db.close();
      }
    }

    return NextResponse.json({ ...plan, nextInterventionDecision: decision });
  } catch (error) {
    console.error("Failed to build intervention plan:", error);
    return NextResponse.json({ error: "Failed to build intervention plan" }, { status: 500 });
  }
}

