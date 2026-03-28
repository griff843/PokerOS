# Poker OS — Coach Equivalence Gap Tracker

## Purpose

This document tracks which capabilities required for **coach-level training** are currently:

- Complete
- Partially implemented
- Missing

It should be updated as development progresses.

> **Audit completed (2026-03-28):** Issue #15 truth audit reconciled every `Missing*` row against current code. All suspected-stale claims are now resolved with exact evidence. See `out/reports/issue-15-truth-audit.md` for full findings.

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
| Solver frequency display | Missing | No solver data exists. `strategy_mix` field not populated in any drill. Previously marked Partial — corrected by Issue #15 audit. |

---

## Player Intelligence

| Capability | Status |
|------------|--------|
| Concept graph | Complete |
| Concept snapshots | Complete |
| Weakness inference | Complete |
| Recommendation engine | Partial |
| Intervention planning | Partial | Routes and pages exist: `/app/concepts/[conceptId]/execution/page.tsx`, `/app/training/session/[id]/page.tsx`, `/api/intervention-plan`, `/api/intervention-execution/[conceptId]`. DB tables (`coaching_interventions`, `intervention_decision_snapshots`) and functions exist. `syncInterventionDecisionSnapshots()` called from Command Center GET. Gap: play session → `coaching_diagnoses` write chain not wired. |

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
| Persistent session attempts | Partial | `POST /api/attempts` route exists. Play page calls `submitDecision()` which POSTs to `/api/attempts`. Attempts persisted to **local JSON** via `persistAttempt()`. `insertAttempt()` exists in `packages/db/src/repository.ts` but is not called from web app. SQLite write path not connected. |
| Persistent review queue | Partial | `GET /api/review-queue` route exists, calls `buildPersistentReviewSnapshot()`. Read path functional; downstream quality depends on attempt data. |
| Cross-session coaching memory | Partial | Tables exist: `coaching_diagnoses`, `coaching_interventions`, `intervention_decision_snapshots`, `transfer_evaluation_snapshots`, `retention_schedules`. `syncInterventionDecisionSnapshots()` and `syncTransferEvaluationSnapshots()` called from `GET /api/command-center`. Gap: play session never writes to `coaching_diagnoses`. |

---

## Diagnostic Coaching

| Capability | Status |
|------------|--------|
| Reasoning prompts | Missing | `diagnostic_prompts[]` schema exists on drills and `DrillAttempt.diagnostic` type is defined (`session-types.ts`). `CoachingPanel.tsx` has a generic `setDiagnostic()` callback but it is not wired to `drill.diagnostic_prompts[]`. Authored prompts in drills are never rendered in the play UI. |
| Misunderstanding classification | Missing | `coaching_diagnoses` table and `createDiagnosis()` exist in `packages/db/src/repository.ts`. Never called from web app play flow. |
| Concept misunderstanding detection | Partial |

---

## Content Depth

| Capability | Status |
|------------|--------|
| Rich drill schema | Partial |
| Action history per drill | Partial | Present in gold live-cash lane (`content/drills/live_cash_gold_btn_bb_river.json` and sibling families). Missing from most other drill families. |
| Strategy mix per drill | Missing | No solver data. `strategy_mix` field not populated anywhere. |
| Coaching context per drill | Partial | Present in gold live-cash lane. Missing from most other drill families. |

---

## Real Hand Analysis

| Capability | Status |
|------------|--------|
| Hand history ingestion | Partial | Manual reconstruction exists via `/app/hands`. PokerTracker/HM2 structured import not implemented. |
| Real-play leak analysis | Partial | `real-hands.ts`, `real-hand-persistence.ts`, `real-hand-bridge.ts` exist. `GET/POST /api/real-hands`, `POST /api/real-hands/follow-up-session`, `GET /api/real-hand-review-block` all exist. `follow_up_assignment_audits` written after follow-up session creation (`createFollowUpAssignmentAudit()` in `repository.ts`). `buildRealHandsSnapshot()` produces practice vs real-play comparison data. `/app/hands/page.tsx` exists. Gap: structured PokerTracker/HM2 import not implemented. |
| Practice vs real-play comparison | Partial | `buildRealHandsSnapshot()` produces comparison data. UI surface exists at `/app/hands`. |

---

# Priority Order

The next development phases should focus on:

1. SQLite write path from web sessions (attempts + SRS via `insertAttempt()` / `upsertSrs()`)
2. Play → `coaching_diagnoses` write chain
3. Diagnostic prompt surfacing in play UI
4. Rich drill truth depth outside the gold live-cash lane
5. Range/bucket visualization from existing authored data

---

# Notes

The current Poker OS architecture is already ahead of most poker training tools.

The primary remaining challenge is **increasing training truth and coaching depth**, not adding more product surfaces.
