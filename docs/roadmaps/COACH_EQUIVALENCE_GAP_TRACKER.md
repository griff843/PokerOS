# Poker OS — Coach Equivalence Gap Tracker

## Purpose

This document tracks which capabilities required for **coach-level training** are currently:

- Complete
- Partially implemented
- Missing

It should be updated as development progresses.

> **Audit Notice (2026-03-27):** Several rows below are suspected stale against code truth. Issue #1 in `INITIAL_GITHUB_BACKLOG.md` is a formal truth audit that will reconcile every row. Do not treat "Missing" rows as authoritative until that audit closes. Suspected divergences noted inline.

---

# Current Capability Status

## Training Loop

| Capability | Status |
|------------|--------|
| Command Center guidance | Complete |
| Structured session planning | Complete |
| Session review coaching | Complete |
| Weakness Explorer | Complete |
| Growth Profile | Complete |

---

## Learning Transparency

| Capability | Status |
|------------|--------|
| Honest missing-data handling | Complete |
| Replay streets | Complete |
| Mixed strategy framing | Partial |
| Solver frequency display | Partial |

---

## Player Intelligence

| Capability | Status |
|------------|--------|
| Concept graph | Complete |
| Concept snapshots | Complete |
| Weakness inference | Complete |
| Recommendation engine | Partial |
| Intervention planning | Missing* | ← *Suspected stale: `/app/concepts/[conceptId]/execution` and `/app/training/session/[id]` exist. Needs end-to-end wire verification (Issue #3).* |

---

## Range Teaching

| Capability | Status |
|------------|--------|
| Range-aware explanation text | Partial |
| Visible combo ranges | Missing |
| Value/bluff bucket visualization | Missing |
| Blocker-aware explanations | Partial |

---

## Persistence

| Capability | Status |
|------------|--------|
| Persistent learner model | Partial |
| Persistent session attempts | Missing* | ← *Suspected stale: `attempts` table exists in migrations, `/api/attempts/route.ts` exists. Play→DB write path unconfirmed (Issue #2).* |
| Persistent review queue | Missing* | ← *Suspected stale: `/api/review-queue/route.ts` exists. Needs verification (Issue #1).* |
| Cross-session coaching memory | Missing* | ← *Suspected stale: `coaching_diagnoses`, `coaching_interventions`, `intervention_decision_snapshots`, `retention_schedules` tables all exist. Exact write path unverified.* |

---

## Diagnostic Coaching

| Capability | Status |
|------------|--------|
| Reasoning prompts | Missing* | ← *Suspected stale: `diagnostic_prompts[]` schema exists on drills, `DrillAttempt.diagnostic` field exists. UI surfacing unconfirmed (Issue #6).* |
| Misunderstanding classification | Missing* | ← *`coaching_diagnoses` table exists with `diagnostic_type` column. Write path from play session unconfirmed.* |
| Concept misunderstanding detection | Partial |

---

## Content Depth

| Capability | Status |
|------------|--------|
| Rich drill schema | Partial |
| Action history per drill | Missing |
| Strategy mix per drill | Missing |
| Coaching context per drill | Missing |

---

## Real Hand Analysis

| Capability | Status |
|------------|--------|
| Hand history ingestion | Partial | Manual reconstruction exists via `/app/hands`. PokerTracker/HM2 import not implemented. |
| Real-play leak analysis | Missing* | ← *Suspected stale: `real-hands.ts`, `real-hand-bridge.ts`, `/api/real-hands/`, `/app/app/hands/` all exist. Actual gap TBD (Issue #4).* |
| Practice vs real-play comparison | Partial | `buildRealHandsSnapshot` produces comparison data. UI surface exists at `/app/hands`. Depth of comparison TBD (Issue #4). |

---

# Priority Order

The next development phases should focus on:

1. Persistent coaching depth
2. Rich drill truth
3. Range visualization
4. Diagnostic coaching
5. Real hand analysis

---

# Notes

The current Poker OS architecture is already ahead of most poker training tools.

The primary remaining challenge is **increasing training truth and coaching depth**, not adding more product surfaces.