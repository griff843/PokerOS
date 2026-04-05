# Poker OS — Coach Equivalence Gap Tracker

## Purpose

This document tracks which capabilities required for **coach-level training** are currently:

- Complete
- Partially implemented
- Missing

It should be updated as development progresses.

> **Audit completed (2026-03-28):** Issue #15 truth audit reconciled every `Missing*` row against current code. All suspected-stale claims are now resolved with exact evidence. See `out/reports/issue-15-truth-audit.md` for full findings.
>
> **Sprint 1 truth refresh (2026-04-05):** Reconciled again after diagnostic prompt rollout, coaching-context enrichment, follow-up concept routing, and content audit CLI additions. The main remaining blockers are now repo-green discipline, content breadth, range visibility, solver-backed truth, and real-hand import depth.

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
| Intervention planning | Partial | Routes and pages exist: `/app/concepts/[conceptId]/execution/page.tsx`, `/app/training/session/[id]/page.tsx`, `/api/intervention-plan`, `/api/intervention-execution/[conceptId]`. DB tables (`coaching_interventions`, `intervention_decision_snapshots`) and functions exist. `syncInterventionDecisionSnapshots()` is called from Command Center GET, and attempt persistence now syncs coaching memory. Remaining gap: intervention planning and execution are still not deep enough to feel like a full coach-owned repair loop. |

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
| Persistent session attempts | Complete | `POST /api/attempts` persists via `persistAttempt()` in `apps/table-sim/src/lib/study-persistence.ts`, which calls `insertAttempt()` into SQLite and updates coaching memory. `loadLocalStudyData()` reads attempts back from the local DB. |
| Persistent review queue | Partial | `GET /api/review-queue` route exists and downstream read paths are functional. Remaining gap: review quality still depends on richer breadth, richer coaching truth, and stronger learner-memory usage rather than simple persistence wiring. |
| Cross-session coaching memory | Partial | Tables exist: `coaching_diagnoses`, `coaching_interventions`, `intervention_decision_snapshots`, `transfer_evaluation_snapshots`, `retention_schedules`. Attempt persistence now syncs diagnoses and reflections into coaching memory, and command-center reads sync intervention/transfer snapshots. Remaining gap: intervention execution depth and longitudinal assignment quality are still partial. |

---

## Diagnostic Coaching

| Capability | Status |
|------------|--------|
| Reasoning prompts | Complete | `CoachingPanel.tsx` now pulls the primary authored diagnostic prompt with `getPrimaryDiagnosticPrompt()`, renders the options in the play feedback loop, and stores the selected reasoning result on the attempt. Current content coverage is `241/241` drills with `diagnostic_prompts`. |
| Misunderstanding classification | Partial | `coaching_diagnoses` are now written through the attempt persistence/coaching-memory sync path. Remaining gap: repeated misunderstanding categories still need stronger downstream use in intervention planning, concept views, and longitudinal coaching. |
| Concept misunderstanding detection | Partial |

---

## Content Depth

| Capability | Status |
|------------|--------|
| Rich drill schema | Partial |
| Action history per drill | Partial | Present in gold live-cash lane (`content/drills/live_cash_gold_btn_bb_river.json` and sibling families). Missing from most other drill families. |
| Strategy mix per drill | Missing | No solver data. `strategy_mix` field not populated anywhere. |
| Coaching context per drill | Partial | Gold lane is deep, and live cash packs now have materially better coaching prose, but full gold-lane-style coaching-context depth is still sparse across the total corpus. Current audit tooling shows complete coaching-context depth remains limited relative to total drill count. |

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

1. Repo-green discipline and verification reliability
2. Rich drill truth depth and breadth outside the current gold lane
3. Range/bucket visualization from existing authored data
4. Stronger intervention planning and longitudinal learner-memory usage
5. Real-hand import depth and practice-to-play transfer quality

---

# Notes

The current Poker OS architecture is already ahead of most poker training tools.

The primary remaining challenge is **increasing training truth, breadth, and coaching depth**, not adding more product surfaces.
