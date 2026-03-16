# AI Skill Wave 2 Plan — Poker v1

## Purpose
This document defines the next-stage AI helper and skill roadmap for Poker OS.

Poker already has its first operating skill layer installed:

- `prompt-compose`
- `sprint-proof-bundle`
- `sprint-plan`
- `status-sync`
- `agent-health`

This document is about what comes next after the initial operating loop is live.

---

## Current baseline
Poker is no longer planning its first helpers from scratch.

It already has:

- prompt generation
- sprint recommendation support
- proof-bundle support
- status-sync support
- AI layer health diagnostics

Wave 2 should therefore focus on **poker-specialized operational helpers**, not generic bootstrap helpers.

---

## Priority philosophy
Wave 2 should improve one of four things:

- poker-specific diagnosis quality
- coaching / review workflow design
- architecture truth alignment
- execution reliability for real sprints

Wave 2 should not duplicate helpers Poker already has.

---

## Agent-health pattern for poker

### Current state
Installed now as a core health-check capability.

### Wave 2 direction
Evolve `agent-health` from general AI OS health into poker-aware operating diagnosis.

### Future poker-aware checks
- is `CURRENT_SYSTEM_STATUS.md` in sync with actual repo work
- is `out/ai/context/context_bundle.md` fresh enough for the next architecture session
- are required poker sprint docs present
- are proof-bundle artifacts being generated consistently
- are installed skills/rules/agents aligned with poker workflow reality
- are poker test commands still valid

### Goal
Turn `agent-health` into a true Poker OS operating integrity check.

---

## Prompt-compose pattern for poker

### Current state
Installed now as the first operational skill.

### Wave 2 direction
Expand `prompt-compose` so it supports poker-specific sprint categories and poker-aware prompt shaping.

### Future poker-aware prompt modes
- architecture sprint
- coaching surface sprint
- hand review / diagnosis sprint
- intervention engine sprint
- documentation / doctrine sprint
- verification / hardening sprint
- incident response / bug sprint

### Goal
Make poker prompt generation more domain-aware and less generic.

---

## Incident-triage pattern for poker

### Current state
Not installed yet as a dedicated poker helper.

### Why it is likely next
As Poker OS grows, issues will become harder to classify quickly.
A dedicated incident-triage pattern would reduce wasted motion and route work correctly.

### Future responsibilities
- classify whether a problem is docs, architecture, implementation, runtime, or verification
- distinguish coaching-surface issues from truth-model issues
- identify stale-context problems
- identify status drift vs actual code regression
- recommend the right next action:
  - sprint
  - diagnosis
  - proof regeneration
  - status sync
  - architecture correction

### Example poker incident classes
- coaching surface mismatch
- concept/intervention drift
- stale status doc
- stale context bundle
- broken review flow
- incomplete proof bundle
- architecture mismatch between docs and repo

### Goal
Create a fast routing surface for poker incidents before they become messy.

---

## Poker-specific future skill ideas

### 1. Coaching-surface planner
A helper for shaping new coaching UI or workflow surfaces from poker phase goals and current system truth.

### 2. Hand-review workflow shaper
A helper for designing or improving hand review flows, tagged review flows, and post-session diagnostic loops.

### 3. Leak / intervention mapper
A helper for mapping recurring mistakes, concepts, interventions, and remediation structures into a governed model.

### 4. Study-loop planner
A helper for turning identified leaks into drills, study blocks, and reinforcement plans.

### 5. Context-bundle refresh helper
A helper for standardizing what gets added to `out/ai/context/context_bundle.md` before each architecture session.

### 6. Poker proof-closeout assistant
A helper for defining what poker-specific evidence is needed for sprint closeout beyond generic proof artifacts.

### 7. Status truth auditor
A helper for checking whether poker’s status docs still match repo and sprint reality.

---

## Recommended Wave 2 rollout order

### Highest priority
1. **Incident Triage — Poker**
2. **Context Bundle Refresh — Poker**
3. **Status Truth Auditor — Poker**

### Medium priority
4. **Coaching Surface Planner**
5. **Hand Review Workflow Shaper**

### Later priority
6. **Leak / Intervention Mapper**
7. **Study Loop Planner**
8. **Poker Proof-Closeout Assistant**

---

## Boundaries
Wave 2 must keep a clean separation between:

- portable operating method
- poker domain logic

Portable patterns may be reused.
Poker-specific coaching logic, hand analysis logic, leak logic, intervention design, and study systems must remain poker-owned.

---

## Current roadmap conclusion
Poker now has its initial AI operating layer in place.

Wave 2 should focus on:
- better poker-specific diagnosis
- better context freshness
- better status truth integrity
- better routing of real implementation issues

The first installed layer made Poker operational.
Wave 2 should make Poker reliable, poker-aware, and easier to scale.