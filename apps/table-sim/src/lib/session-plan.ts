import { z } from "zod";
import { TableSimDrillSchema, type TableSimDrill } from "./drill-schema";
import type { FollowUpUncertaintyProfile } from "./real-hands";

export const TableSimActivePoolSchema = z.enum(["baseline", "A", "B", "C"]);
export const TableSimSelectionKindSchema = z.enum(["review", "new"]);
export const TableSimSelectionReasonSchema = z.enum([
  "due_review",
  "weakness_review",
  "weakness_new",
  "new_material_fill",
]);
export const TableSimPlanningReasonSchema = z.enum([
  "active_intervention",
  "recurring_leak",
  "regression_recovery",
  "weakness_balance",
  "retention_check",
  "freshness_mix",
]);
export const TableSimRecoveryStageSchema = z.enum([
  "unaddressed",
  "active_repair",
  "stabilizing",
  "recovered",
  "regressed",
]);

export const TableSimWeaknessTargetSchema = z.object({
  type: z.enum(["classification_tag", "rule_tag", "node"]),
  key: z.string(),
  scope: z.enum(["overall", "pool"]),
  pool: TableSimActivePoolSchema.optional(),
  sampleSize: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1).optional(),
  missRate: z.number().min(0).max(1).optional(),
  priority: z.number().nonnegative(),
});

export const TableSimInterventionTrainingBlockSchema = z.object({
  conceptKey: z.string(),
  label: z.string(),
  reps: z.number().int().positive(),
  plannedReps: z.number().int().nonnegative(),
  role: z.enum(["repair", "retest", "calibration"]),
  reason: z.string(),
  planningReasons: z.array(TableSimPlanningReasonSchema),
});

export const TableSimSelectedDrillSchema = z.object({
  drill: TableSimDrillSchema,
  kind: TableSimSelectionKindSchema,
  reason: TableSimSelectionReasonSchema,
  matchedWeaknessTargets: z.array(z.string()),
  metadata: z.object({
    dueAt: z.string().optional(),
    priorAttempts: z.number().int().nonnegative(),
    lastScore: z.number().min(0).max(1).optional(),
    weaknessPriority: z.number().nonnegative().optional(),
    assignmentRationale: z.string().optional(),
    assignmentBucket: z.enum([
      "exact_match",
      "turn_line_transfer",
      "sizing_stability",
      "bridge_reconstruction",
      "memory_decisive",
    ]).optional(),
    interventionConceptKey: z.string().optional(),
    interventionConceptLabel: z.string().optional(),
    interventionRole: z.enum(["repair", "retest", "calibration"]).optional(),
    prioritizationReasons: z.array(TableSimPlanningReasonSchema).optional(),
  }),
});

export const TableSimSessionPlanMetadataSchema = z.object({
  requestedCount: z.number().int().positive(),
  selectedCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  dueReviewCount: z.number().int().nonnegative(),
  weaknessReviewCount: z.number().int().nonnegative(),
  weaknessNewCount: z.number().int().nonnegative(),
  newMaterialFillCount: z.number().int().nonnegative(),
  activePool: TableSimActivePoolSchema,
  generatedAt: z.string(),
  weaknessTargets: z.array(TableSimWeaknessTargetSchema),
  notes: z.array(z.string()),
  followUpAudit: z.object({
    conceptKey: z.string(),
    handTitle: z.string().nullable().optional(),
    handSource: z.enum(["paste", "file", "manual"]).optional(),
    parseStatus: z.enum(["parsed", "partial", "unsupported"]).optional(),
    uncertaintyProfile: z.enum([
      "precise_history",
      "turn_line_clear",
      "sizing_fuzzy_line_clear",
      "turn_line_fuzzy",
      "memory_decisive",
    ]).optional(),
    bucketMix: z.array(z.object({
      bucket: z.enum([
        "exact_match",
        "turn_line_transfer",
        "sizing_stability",
        "bridge_reconstruction",
        "memory_decisive",
      ]),
      count: z.number().int().nonnegative(),
    })),
    selectedDrillIds: z.array(z.string()),
  }).optional(),
  intervention: z.object({
    id: z.string(),
    title: z.string(),
    rootConceptKey: z.string(),
    rootConceptLabel: z.string(),
    upstreamConceptKey: z.string().optional(),
    upstreamConceptLabel: z.string().optional(),
    rootLeakDiagnosis: z.string(),
    rationale: z.string(),
    nextSessionFocus: z.string(),
    totalTargetReps: z.number().int().positive(),
    totalPlannedReps: z.number().int().nonnegative(),
    planningReasons: z.array(TableSimPlanningReasonSchema),
    recoveryStage: TableSimRecoveryStageSchema,
    trainingBlocks: z.array(TableSimInterventionTrainingBlockSchema),
  }).optional(),
});

export const TableSimSessionPlanSchema = z.object({
  drills: z.array(TableSimSelectedDrillSchema),
  metadata: TableSimSessionPlanMetadataSchema,
});

export type TableSimActivePool = z.infer<typeof TableSimActivePoolSchema>;
export type TableSimSelectedDrill = z.infer<typeof TableSimSelectedDrillSchema>;
export type TableSimSessionPlanMetadata = z.infer<typeof TableSimSessionPlanMetadataSchema>;
export type TableSimSessionPlan = z.infer<typeof TableSimSessionPlanSchema>;
export type TableSimWeaknessTarget = z.infer<typeof TableSimWeaknessTargetSchema>;

export async function loadSessionPlan(
  count: number,
  activePool: TableSimActivePool = "baseline",
  interventionId?: string
): Promise<TableSimSessionPlan> {
  const params = new URLSearchParams({
    count: String(count),
    pool: activePool,
  });
  if (interventionId) {
    params.set("intervention", interventionId);
  }
  const res = await fetch(`/api/session-plan?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load session plan");

  const raw = await res.json();
  return TableSimSessionPlanSchema.parse(raw);
}

export async function loadRealHandFollowUpSessionPlan(args: {
  conceptKey: string;
  activePool?: TableSimActivePool;
  preferredDrillIds?: string[];
  correctiveBuckets?: Array<"exact_match" | "turn_line_transfer" | "sizing_stability" | "bridge_reconstruction" | "memory_decisive">;
  handTitle?: string | null;
  handSource?: "paste" | "file" | "manual";
  parseStatus?: "parsed" | "partial" | "unsupported";
  uncertaintyProfile?: FollowUpUncertaintyProfile;
  count?: number;
}): Promise<TableSimSessionPlan> {
  const res = await fetch("/api/real-hands/follow-up-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conceptKey: args.conceptKey,
      activePool: args.activePool ?? "baseline",
      preferredDrillIds: args.preferredDrillIds ?? [],
      correctiveBuckets: args.correctiveBuckets ?? [],
      handTitle: args.handTitle ?? null,
      handSource: args.handSource,
      parseStatus: args.parseStatus,
      uncertaintyProfile: args.uncertaintyProfile,
      count: args.count,
    }),
  });
  if (!res.ok) throw new Error("Failed to load real-hand follow-up session");

  const raw = await res.json();
  return TableSimSessionPlanSchema.parse(raw);
}

export function unwrapPlannedDrills(plan: TableSimSessionPlan): TableSimDrill[] {
  return plan.drills.map((entry) => entry.drill);
}
