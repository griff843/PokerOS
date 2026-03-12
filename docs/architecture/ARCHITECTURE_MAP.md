# Architecture Map - Poker OS

_Last updated: 2026-03-11_

This file replaces the earlier foundation-era architecture map with a current high-level view of the repo.

## 1. Monorepo Shape

```text
poker-coach-os/
|- apps/
|  |- cli/
|  `- table-sim/
|- packages/
|  |- core/
|  `- db/
|- content/
|- docs/
|- scripts/
|- .local/
`- out/
```

## 2. Ownership Map

| Area | Owns | Does Not Own |
|---|---|---|
| `packages/core` | product behavior, coaching logic, learner modeling, intervention planning | React rendering, raw DB access |
| `packages/db` | migrations, queries, persistence helpers | product logic, coaching decisions |
| `apps/table-sim` | routes, adapters, hydration, state wiring, rendering | core strategic truth |
| `content` | authored poker truth | runtime coaching logic |
| `docs` | product intent and architecture guidance | executable behavior |

## 3. Current Product Loop

```text
Command Center
-> Study Session
-> Post-answer Coaching
-> Review Detail / Queue
-> Session Summary
-> Weakness Explorer
-> Growth Profile
-> Real Hand Review
```

## 4. Core Data Flow

### Drill flow

```text
Authored Drill
-> Answer resolution
-> Scoring
-> Attempt persistence
-> Drill coaching snapshot
-> Play / Review surfaces
```

### Learner-state flow

```text
Persisted attempts
+ confidence
+ diagnostics
+ review pressure
+ real-play concept signals
-> Player intelligence snapshot
-> adaptive profile
-> intervention plan
-> command center / growth / weakness / session review
```

### Real-hand flow

```text
Imported hand text
-> parser
-> concept matches + review spots
-> real-play concept signals
-> player intelligence + intervention weighting
```

## 5. Key Core Modules

| Module | Role |
|---|---|
| `schemas.ts` | canonical content and validation layer |
| `answer-resolution.ts` | baseline and pool-aware answer resolution |
| `drill-coach.ts` | deterministic/provider drill coaching generation |
| `drill-coaching-snapshot.ts` | reusable decision-level coaching seam |
| `diagnostics.ts` | structured reasoning capture and error typing |
| `concept-graph.ts` | concept relationships and signal mapping |
| `player-intelligence.ts` | concept snapshots, priorities, recommendations |
| `adaptive-coaching.ts` | learner-style inference and coaching emphasis |
| `intervention-planner.ts` | targeted next training prescription |
| `real-hands.ts` | hand parsing, concept extraction, real-play signals |

## 6. Current Persistence Scope

SQLite currently stores:

- nodes
- drills
- attempts
- SRS state
- settings
- hand imports
- imported hands

Important note:

- some richer attempt context is still stored inside serialized attempt payloads instead of normalized tables
- this is workable, but it is a known architectural limitation for long-term learner memory depth

## 7. Stable Seams To Protect

### Coaching seam

`buildDrillCoachingSnapshot`

Use this when decision-level coaching needs to appear across multiple surfaces.

### Learner-model seam

`buildPlayerIntelligenceSnapshot`

Use this when a surface needs learner-aware priorities, strengths, adaptive signals, or growth framing.

### Intervention seam

`buildInterventionPlan`

Use this when the system needs to prescribe the next focused block rather than merely ranking weaknesses.

## 8. Current Architectural Truth

The repo is no longer a simple drill trainer.

It already contains:

- structured drill coaching
- diagnostic classification
- learner modeling
- adaptive coaching emphasis
- intervention planning
- real-hand ingestion
- cross-surface coaching summaries

The main architectural challenge now is not adding more pages. It is deepening truth, learner memory, and training transfer while keeping business logic centralized in `packages/core`.
