import { describe, expect, it } from "vitest";
import {
  computeRetentionPlanningBoost,
  deriveRetentionScheduleState,
  recommendRetentionSchedule,
  type RetentionScheduleLike,
} from "../retention-scheduler";

describe("retention scheduler", () => {
  it("schedules a recovered concept for validation", () => {
    const recommendation = recommendRetentionSchedule({
      conceptKey: "river_bluff_catching",
      label: "River Bluff Catching",
      recoveryStage: "recovered",
      recurrenceCount: 1,
      regressionCount: 0,
      reviewPressure: 0,
      reviewAvoidancePattern: false,
    }, new Date("2026-03-12T12:00:00.000Z"));

    expect(recommendation.eligible).toBe(true);
    expect(recommendation.shouldSchedule).toBe(true);
    expect(recommendation.reason).toBe("recovered_validation");
    expect(recommendation.scheduledFor).toBe("2026-03-19T12:00:00.000Z");
  });

  it("schedules stabilizing concepts sooner", () => {
    const recommendation = recommendRetentionSchedule({
      conceptKey: "turn_defense",
      label: "Turn Defense",
      recoveryStage: "stabilizing",
      recurrenceCount: 0,
      regressionCount: 0,
      reviewPressure: 1,
      reviewAvoidancePattern: false,
    }, new Date("2026-03-12T12:00:00.000Z"));

    expect(recommendation.shouldSchedule).toBe(true);
    expect(recommendation.reason).toBe("stabilizing_followup");
    expect(recommendation.scheduledFor).toBe("2026-03-14T12:00:00.000Z");
    expect(recommendation.priority).toBeGreaterThanOrEqual(70);
  });

  it("suppresses duplicate active schedules unless the situation changes materially", () => {
    const latest: RetentionScheduleLike = {
      id: "ret-1",
      conceptKey: "turn_defense",
      createdAt: "2026-03-12T12:00:00.000Z",
      scheduledFor: "2026-03-15T12:00:00.000Z",
      status: "scheduled",
      reason: "stabilizing_followup",
      recoveryStageAtScheduling: "stabilizing",
      priority: 72,
    };

    const recommendation = recommendRetentionSchedule({
      conceptKey: "turn_defense",
      label: "Turn Defense",
      recoveryStage: "stabilizing",
      recurrenceCount: 0,
      regressionCount: 0,
      reviewPressure: 0,
      reviewAvoidancePattern: false,
      latestRetentionSchedule: latest,
    }, new Date("2026-03-12T12:00:00.000Z"));

    expect(recommendation.shouldSchedule).toBe(false);
    expect(recommendation.duplicateSuppressed).toBe(true);
    expect(recommendation.scheduledFor).toBe("2026-03-15T12:00:00.000Z");
  });

  it("marks schedules as due and overdue deterministically", () => {
    expect(deriveRetentionScheduleState({
      scheduledFor: "2026-03-14T12:00:00.000Z",
      status: "scheduled",
    }, new Date("2026-03-13T12:00:00.000Z"))).toBe("upcoming");

    expect(deriveRetentionScheduleState({
      scheduledFor: "2026-03-14T12:00:00.000Z",
      status: "scheduled",
    }, new Date("2026-03-14T18:00:00.000Z"))).toBe("due");

    expect(deriveRetentionScheduleState({
      scheduledFor: "2026-03-14T12:00:00.000Z",
      status: "scheduled",
    }, new Date("2026-03-17T12:30:00.000Z"))).toBe("overdue");
  });

  it("boosts due and overdue retention checks in planning", () => {
    const dueBoost = computeRetentionPlanningBoost({
      recoveryStage: "recovered",
      recurrenceCount: 1,
      regressionCount: 0,
      latestRetentionSchedule: {
        conceptKey: "river_bluff_catching",
        createdAt: "2026-03-12T12:00:00.000Z",
        scheduledFor: "2026-03-14T12:00:00.000Z",
        status: "scheduled",
        reason: "recovered_validation",
        recoveryStageAtScheduling: "recovered",
        priority: 60,
      },
      now: new Date("2026-03-14T13:00:00.000Z"),
    });

    const overdueBoost = computeRetentionPlanningBoost({
      recoveryStage: "stabilizing",
      recurrenceCount: 2,
      regressionCount: 1,
      latestRetentionSchedule: {
        conceptKey: "turn_defense",
        createdAt: "2026-03-12T12:00:00.000Z",
        scheduledFor: "2026-03-13T12:00:00.000Z",
        status: "due",
        reason: "stabilizing_followup",
        recoveryStageAtScheduling: "stabilizing",
        priority: 74,
      },
      now: new Date("2026-03-16T13:00:00.000Z"),
    });

    expect(dueBoost.shouldPrioritize).toBe(true);
    expect(dueBoost.reasons).toContain("retention_check");
    expect(overdueBoost.pressure).toBeGreaterThan(dueBoost.pressure);
  });
});
