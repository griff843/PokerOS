# Poker OS - System Overview

_Last updated: 2026-03-11_

## Purpose

Poker OS is a local-first poker coaching system built as a TypeScript `pnpm` monorepo.

It is not just a drill runner. The product is designed to connect:

- deliberate practice
- drill-level explanation
- learner diagnosis
- adaptive coaching emphasis
- intervention planning
- real-hand review
- longitudinal growth feedback

The current product center of gravity is the Table Sim app in `apps/table-sim`, with shared coaching and learner-modeling logic in `packages/core` and persistence in `packages/db`.

## Workspace Summary

- `apps/table-sim`
  - Next.js application
  - command center, study, review, weakness, growth, summary, and real-hands surfaces
- `apps/cli`
  - local CLI entrypoint for repo and training workflows
- `packages/core`
  - schemas, answer resolution, scoring, diagnostics, drill coaching, adaptive coaching, learner intelligence, intervention planning, real-hand analysis
- `packages/db`
  - SQLite migrations and repository helpers
- `content`
  - authored drill truth
- `docs`
  - constitution, roadmaps, architecture notes, and content standards

## Current Product Loop

The live product loop is:

```text
Command Center
-> Study Session
-> Post-answer coaching
-> Review Detail / Review Queue
-> Session Summary
-> Weakness Explorer
-> Growth Profile
-> Real Hand Review
```

This loop is backed by shared learner-state logic rather than page-local heuristics.

## Core Runtime Flow

### 1. Authored truth

Authored drills in `content` provide the strategic source of truth.

This includes:

- canonical drill schema
- pool-aware answers
- coaching context
- structured study truth
- optional diagnostic prompts

### 2. Attempt capture

When a learner answers a drill, Poker OS stores:

- selected action
- score
- confidence
- elapsed time
- missed tags
- matched tags
- reflection
- optional diagnostic result
- active pool

Attempts persist to SQLite and are later rehydrated into richer app-level attempt records.

### 3. Coaching and diagnosis

Core helpers turn a scored attempt into:

- deterministic drill coaching responses
- a shared `DrillCoachingSnapshot`
- transparency/range-support views
- diagnostic classification when structured reasoning is captured

### 4. Learner modeling

Core learner-modeling helpers combine:

- persisted attempt insights
- confidence patterns
- diagnostic insights
- review pressure
- concept graph structure
- imported-hand concept signals

This produces a `PlayerIntelligenceSnapshot` with:

- concept snapshots
- strengths and priorities
- adaptive coaching profile
- coach-style next recommendations

### 5. Intervention planning

The intervention planner converts learner state into focused practice prescriptions, including:

- upstream-first repair when a leak is downstream
- retest blocks
- calibration blocks
- adaptive weighting based on learner style
- real-play transfer emphasis when imported hands support it

### 6. Real-play loop

Imported hands are parsed into:

- concept matches
- review spots
- real-play concept signals

Those signals feed learner modeling, growth framing, weakness ranking, and intervention planning.

## Current Coaching Capabilities

Poker OS currently supports:

- deterministic scoring and pool-aware answer resolution
- structured post-answer drill coaching
- review-detail coaching with pool contrast
- learner diagnostics for common reasoning failures
- adaptive coaching emphasis based on recurring tendencies
- intervention plans built from learner state
- real-hand ingestion with concept extraction
- growth, weakness, and session-level feedback surfaces

## Important Boundaries

- `packages/core` owns behavior and coaching logic.
- `packages/db` owns persistence mechanics.
- `apps/table-sim` should render structured outputs from core rather than recomputing strategy or coaching logic in JSX.
- `content` owns strategic truth.

## What This Repo Is Not

Poker OS is not:

- a solver backend
- a generic poker dashboard
- a chat-first AI product
- a static content library

The repo should continue to deepen learner memory, diagnosis, intervention quality, and real-play transfer before expanding surface area.
