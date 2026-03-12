# Poker OS - System Overview

_Last updated: 2026-03-11_

## Purpose

Poker OS is a coach-like poker training system.

The architecture is built to support a continuous improvement loop rather than isolated drill grading. The system should remember the learner, explain why decisions work or fail, adapt coaching emphasis, and prescribe targeted follow-up work.

## Current Architecture At A Glance

```text
content -> core truth + coaching logic -> db persistence -> app adapters -> premium product surfaces
```

More concretely:

```text
Authored Drills / Hand Inputs
-> Scoring + Answer Resolution
-> Diagnostics + Drill Coaching Snapshot
-> Player Intelligence + Adaptive Coaching
-> Intervention Planning
-> Table Sim Surfaces
```

## Workspace Ownership

### `packages/core`

Owns business logic and product behavior:

- canonical drill schema
- scoring and answer resolution
- drill coaching generation
- drill coaching snapshot seam
- diagnostics
- concept graph
- player intelligence
- adaptive coaching
- intervention planning
- real-hand parsing and concept extraction

### `packages/db`

Owns persistence:

- SQLite migrations
- repository functions
- attempt, SRS, and hand-import storage

### `apps/table-sim`

Owns delivery and rendering:

- Next.js routes
- route handlers and local adapters
- state management
- UI components
- app-level hydration of persisted attempts and hand data

### `content`

Owns authored strategic truth.

### `docs`

Owns product, architecture, and roadmap guidance.

## Main Product Surfaces

The current product includes:

- Command Center
- Study Session / Play
- Post-answer Coaching Panel
- Review Detail and Review Queue
- Session Summary
- Weakness Explorer
- Growth Profile
- Real Hand Review
- Training Session / Intervention entrypoints

## Key Shared Seams

### Drill coaching seam

`buildDrillCoachingSnapshot` is the main reusable decision-level coaching seam.

It keeps UI stable while allowing:

- deterministic coaching fallback
- pool-aware answer contrast
- learner-aware emphasis
- reuse across play and review surfaces

### Learner-modeling seam

`buildPlayerIntelligenceSnapshot` is the main learner-state seam.

It combines:

- attempts
- review pressure
- confidence patterns
- diagnostic results
- real-play concept signals
- concept graph structure

### Intervention seam

`buildInterventionPlan` converts learner state into the next coach-like prescription.

## Persistence Model

SQLite currently stores:

- drills and nodes
- attempts
- SRS rows
- settings
- hand imports
- imported hands

Some coaching signals, such as diagnostic payloads and richer attempt metadata, are currently stored inside serialized attempt payloads rather than as first-class normalized tables.

## Design Standard

The repo should preserve these boundaries:

- no strategy logic in JSX
- no fake certainty in learner modeling
- no content truth hidden in UI code
- no persistence logic spread casually through app code

When behavior changes, `packages/core` should usually change first and UI should adapt second.
