import type { CanonicalDrill, DrillAnswer, DrillStep, PoolKey } from "./schemas";

export function resolveDrillAnswer(
  drill: Pick<CanonicalDrill, "answer" | "answer_by_pool">,
  activePool?: PoolKey | "baseline" | null
): DrillAnswer {
  if (!activePool || activePool === "baseline") {
    return drill.answer;
  }
  return drill.answer_by_pool?.[activePool] ?? drill.answer;
}

export function resolveStepAnswer(
  step: Pick<DrillStep, "answer" | "answer_by_pool">,
  activePool?: PoolKey | "baseline" | null
): DrillAnswer {
  if (!activePool || activePool === "baseline") {
    return step.answer;
  }
  return step.answer_by_pool?.[activePool] ?? step.answer;
}
