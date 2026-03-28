# GitHub Execution Model

## Purpose

GitHub is the active execution control plane for Poker OS.

Use it to track bounded work, link code to decisions, and keep planning close to the repo.

## Authority order

1. Repo code and tests
2. Canonical docs in `docs/`
3. GitHub issues and pull requests
4. Chat summaries and external notes

If these disagree, resolve the disagreement in that order.

## What belongs in GitHub

### Issues

Use issues for:

- execution lanes
- truth audits
- product gaps
- blocked work
- follow-up work discovered during implementation

### Pull requests

Every PR should:

- link the issue it closes or advances
- state what changed
- state how it was verified
- note any doc truth that changed

## Lane sizing rule

A good lane is:

- small enough to review cleanly
- large enough to produce a meaningful product or system outcome
- bounded enough that acceptance criteria are unambiguous

Avoid vague mega-issues.

## Suggested labels

Create and use these labels in GitHub:

- `truth-audit`
- `content`
- `persistence`
- `coach-surface`
- `coaching-intelligence`
- `real-play`
- `docs-sync`
- `blocked`

## Suggested milestones

Map milestones to the current roadmap:

- `Phase 2 — Content Expansion`
- `Phase 3 — System Integration`
- `Phase 4 — Coaching Intelligence`
- `Phase 5 — Real Play Integration`

## Operating rhythm

### Before opening a lane

- check `docs/roadmaps/MASTER_ROADMAP.md`
- check `docs/roadmaps/COACH_EQUIVALENCE_GAP_TRACKER.md`
- check whether the issue is really a truth correction, a product gap, or an execution lane

### During execution

- keep scope bounded
- do not smuggle in adjacent work
- open follow-up issues instead of silently widening scope

### At closeout

- verify code and tests
- update docs if product truth changed
- close the linked issue only when acceptance criteria are actually met

## First recommended issue set

1. Truth audit — reconcile gap tracker against current persistence and route-layer reality
2. Coaching loop closure — persist daily plan/session execution state
3. Intervention surface v1 — surface active intervention and intervention history cleanly
4. Real-hand loop audit — define current state vs target productized real-play loop

## Notes

This model is intentionally simple.

The goal is not more process. The goal is cleaner truth, tighter repo linkage, and less execution drift.
