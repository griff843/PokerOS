import type { SrsRow } from "@poker-coach/db";

export interface SrsUpdate {
  drillId: string;
  score: number; // 0–1 from scoring
  now: Date;
}

const MIN_EASE = 1.3;
const PASS_THRESHOLD = 0.6;

/**
 * SM-2-ish spaced repetition update.
 *
 * quality = score * 5  (maps 0–1 to 0–5)
 *
 * If score >= 0.6 (pass):
 *   repetitions += 1
 *   interval = 1 (rep 1), 6 (rep 2), prev * ease (rep 3+)
 *   ease adjusted by quality
 *
 * If score < 0.6 (fail):
 *   repetitions = 0
 *   interval = 1
 *   ease unchanged
 */
export function computeSrsUpdate(current: SrsRow | undefined, update: SrsUpdate): SrsRow {
  const quality = update.score * 5;
  const prev = current ?? {
    drill_id: update.drillId,
    due_at: update.now.toISOString(),
    interval_days: 0,
    ease: 2.5,
    repetitions: 0,
    last_score: 0,
  };

  let newInterval: number;
  let newEase = prev.ease;
  let newReps: number;

  if (update.score >= PASS_THRESHOLD) {
    newReps = prev.repetitions + 1;

    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prev.interval_days * prev.ease * 100) / 100;
    }

    // Adjust ease factor
    newEase = prev.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEase = Math.max(newEase, MIN_EASE);
    newEase = Math.round(newEase * 100) / 100;
  } else {
    // Failed: reset
    newReps = 0;
    newInterval = 1;
    // ease unchanged on failure
  }

  const dueAt = new Date(update.now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    drill_id: update.drillId,
    due_at: dueAt.toISOString(),
    interval_days: newInterval,
    ease: newEase,
    repetitions: newReps,
    last_score: update.score,
  };
}
