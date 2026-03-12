import { describe, it, expect } from "vitest";
import { computeSrsUpdate } from "../srs";
import type { SrsRow } from "@poker-coach/db";

const NOW = new Date("2025-01-15T12:00:00Z");

describe("computeSrsUpdate", () => {
  it("initializes new card with 1-day interval on pass", () => {
    const result = computeSrsUpdate(undefined, {
      drillId: "d_01",
      score: 0.7,
      now: NOW,
    });
    expect(result.drill_id).toBe("d_01");
    expect(result.repetitions).toBe(1);
    expect(result.interval_days).toBe(1);
    expect(result.last_score).toBe(0.7);
    // due_at should be 1 day from now
    const due = new Date(result.due_at);
    expect(due.getTime() - NOW.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("sets 6-day interval on second pass", () => {
    const first: SrsRow = {
      drill_id: "d_01",
      due_at: NOW.toISOString(),
      interval_days: 1,
      ease: 2.5,
      repetitions: 1,
      last_score: 0.7,
    };
    const result = computeSrsUpdate(first, {
      drillId: "d_01",
      score: 0.8,
      now: NOW,
    });
    expect(result.repetitions).toBe(2);
    expect(result.interval_days).toBe(6);
  });

  it("multiplies interval by ease on third+ pass", () => {
    const second: SrsRow = {
      drill_id: "d_01",
      due_at: NOW.toISOString(),
      interval_days: 6,
      ease: 2.5,
      repetitions: 2,
      last_score: 0.8,
    };
    const result = computeSrsUpdate(second, {
      drillId: "d_01",
      score: 1.0,
      now: NOW,
    });
    expect(result.repetitions).toBe(3);
    expect(result.interval_days).toBe(15); // 6 * 2.5 = 15
  });

  it("resets on fail (score < 0.6)", () => {
    const existing: SrsRow = {
      drill_id: "d_01",
      due_at: NOW.toISOString(),
      interval_days: 15,
      ease: 2.5,
      repetitions: 3,
      last_score: 1.0,
    };
    const result = computeSrsUpdate(existing, {
      drillId: "d_01",
      score: 0.3,
      now: NOW,
    });
    expect(result.repetitions).toBe(0);
    expect(result.interval_days).toBe(1);
    expect(result.ease).toBe(2.5); // unchanged on failure
  });

  it("never drops ease below 1.3", () => {
    const existing: SrsRow = {
      drill_id: "d_01",
      due_at: NOW.toISOString(),
      interval_days: 1,
      ease: 1.3,
      repetitions: 0,
      last_score: 0,
    };
    const result = computeSrsUpdate(existing, {
      drillId: "d_01",
      score: 0.6, // barely passing
      now: NOW,
    });
    expect(result.ease).toBeGreaterThanOrEqual(1.3);
  });
});

