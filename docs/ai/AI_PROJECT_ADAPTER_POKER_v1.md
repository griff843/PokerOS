# AI Project Adapter — Poker v1

## Project identity

### Project name
Poker Coach OS

### Domain summary
Poker Coach OS is a poker improvement and decision-support system designed to help the user study, review, diagnose, and improve real poker play over time. The system is intended to combine hand history review, coaching workflows, leak detection, intervention tracking, study planning, and performance feedback into one governed operating surface.

### Primary purpose
The primary purpose of Poker Coach OS is to create a structured, repeatable, and auditable system for improving poker performance through:

- hand review
- leak detection
- pattern recognition
- intervention planning
- coaching feedback loops
- study prioritization
- progress tracking over time

### Main operating surfaces
The main operating surfaces for Poker Coach OS are expected to include:

- **Coaching surface** — the primary interface for diagnosing weaknesses, reviewing progress, and surfacing next actions
- **Training surface** — study plans, interventions, drills, exercises, and learning loops
- **Session / hand review surface** — post-session analysis, mistake capture, tagged hand review, and decision analysis
- **Concept / intervention surface** — tracks concepts being worked on, active interventions, and progress against known leaks
- **Artifacts / reports surface** — generated outputs, summaries, proof bundles, and review documents
- **AI operating surface** — governed architecture, doctrine, prompts, workflow rules, and project-specific reasoning context

---

## Canonical documentation map

### Roadmap docs
Roadmap and phase-planning documents should live under a dedicated poker roadmap area, such as:

- `docs/poker-coach-os/roadmap/`
- `docs/poker-coach-os/phases/`
- milestone-specific implementation plans and activation docs

These docs define what the system is becoming, what phase it is in, and what comes next.

### Architecture docs
Architecture docs should live under poker-specific architecture surfaces, such as:

- `docs/poker-coach-os/architecture/`
- `docs/poker-coach-os/system/`
- `docs/poker-coach-os/contracts/`

These docs describe core system structure, data flow, boundaries, operating rules, and how the poker system is designed.

### Current-state docs
Current-state docs should capture what is true now, including:

- current implementation status
- active surfaces already built
- known gaps
- recent completed work
- current operational assumptions

Recommended location:

- `docs/poker-coach-os/status/`
- or a canonical top-level poker status document such as `CURRENT_SYSTEM_STATUS.md` within the poker docs tree

### Governance docs
Governance docs should define how work is shaped, executed, verified, and ratified. Recommended location:

- `docs/poker-coach-os/governance/`
- `docs/ai-core/doctrine/` for shared AI operating doctrine that is adapted for poker

Governance docs should include:

- operating rules
- implementation boundaries
- verification expectations
- truth hierarchy
- artifact requirements
- closeout standards

### Status docs
Status docs should provide the latest operational truth for the poker system. Recommended locations:

- `docs/poker-coach-os/status/`
- `docs/poker-coach-os/phases/`
- milestone closeout docs
- current focus / next sprint docs

---

## Roadmap / phase model

### What phases or milestones poker uses
Poker Coach OS should use a phase model centered on coaching-system maturity, operational reliability, and usable improvement loops. A strong baseline model is:

#### Phase 0 — Foundation Lock
Establish repo structure, doctrine, canonical docs, project adapter, truth hierarchy, and artifact conventions.

#### Phase 1 — Coaching Surface Activation
Stand up the first usable coaching surface with core UI, concept summaries, intervention views, and high-level progress visibility.

#### Phase 2 — Review & Diagnosis System
Build hand/session ingestion, review workflows, diagnosis logic, leak clustering, and mistake categorization.

#### Phase 3 — Intervention Engine
Define and track active interventions, concept remediation plans, coaching loops, and progress measurement.

#### Phase 4 — Training Intelligence
Add drill generation, study prioritization, concept reinforcement, and personalized learning paths.

#### Phase 5 — Performance Memory & Longitudinal Tracking
Track repeated mistakes, recurring leaks, improving concepts, durable strengths, and trend movement across time.

#### Phase 6 — Operational Governance & Verification
Harden verification, reporting, proof bundles, and governed closeout so the system becomes durable and trustworthy.

#### Phase 7 — Productization / Expansion
Extend the system into a complete poker operating system with stronger automation, better diagnostics, and advanced reporting.

### Current active phase
Based on current context, Poker Coach OS appears to be in an **early activation stage**, most likely:

- **Phase 0 — Foundation Lock**, if canonical doctrine, roadmap, and truth surfaces are still being established
- or
- **Phase 1 — Coaching Surface Activation**, if the coaching UI and concept/intervention surfaces are already partially working

For current practical use, the safest default is:

**Current active phase: Phase 1 — Coaching Surface Activation**

This should be updated once poker status docs are formalized.

---

## Status surfaces

### Where current progress is tracked
Current progress for Poker Coach OS should be tracked in a small number of canonical places:

- phase documents under `docs/poker-coach-os/phases/`
- poker status docs under `docs/poker-coach-os/status/`
- implementation handoff docs and sprint closeout docs
- proof/report artifacts under `out/`
- any project-specific AI operating docs under `docs/ai-core/`

### What the latest truth docs are
Until a larger poker status system exists, the latest truth docs should be treated as:

- this adapter file
- the active phase document for poker
- the latest poker status document
- the latest implementation closeout / sprint closeout doc
- any canonical architecture overview doc for Poker Coach OS

A recommended canonical truth stack is:

1. `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md`
2. `docs/poker-coach-os/phases/<ACTIVE_PHASE_DOC>.md`
3. `docs/poker-coach-os/architecture/MASTER_SYSTEM_BLUEPRINT.md`
4. `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md`
5. latest proof bundle / closeout report under `out/`

---

## Truth sources

### Repo truth
The repository is the primary design and implementation truth for:

- source code
- folder structure
- contracts
- docs
- tests
- generated outputs committed as artifacts when applicable

### Artifacts
Artifacts should be treated as proof of execution, verification, and system state at a point in time. These include:

- generated reports
- closeout bundles
- diagnosis outputs
- intervention summaries
- coaching summaries
- validation results
- screenshots or exports where applicable

### Runtime truth if any
If Poker Coach OS has runtime surfaces, runtime truth may include:

- live coaching UI behavior
- generated API responses
- training summaries
- concept/intervention state as rendered in-app
- local execution outputs
- persisted derived summaries

If no persistent runtime exists yet, runtime truth is limited to local builds, generated outputs, and verification runs.

### Diagnostics surfaces if any
Diagnostics surfaces may include:

- build/typecheck/test outputs
- local app routes and API responses
- generated diagnosis reports
- concept audit feeds
- intervention execution summaries
- out-based verification artifacts
- console/runtime logs where relevant

---

## Artifact conventions

### Where outputs / proof / reports should live
All outputs, proof, and reports should live under a governed `out/` structure.

Recommended structure:

- `out/poker/`
- `out/poker/reports/`
- `out/poker/proof/`
- `out/poker/diagnostics/`
- `out/poker/screens/`
- `out/poker/sprints/<SPRINT_OR_PHASE>/`

This keeps poker artifacts separate from portable AI-core doctrine and from other projects.

### Convention principles
Artifacts should be:

- timestamped or phase-tagged when appropriate
- clearly named
- scoped to one sprint, phase, or verification target
- easy to audit later
- treated as evidence, not casual scratch output

---

## Governance / closeout path

### How work is considered complete
Poker work should only be considered complete when all of the following are true:

- the implementation is present in the repo
- relevant docs are updated
- the active phase/status docs reflect the new truth
- verification has been run
- output/proof artifacts exist where required
- the delivered behavior matches the intended poker-specific use case
- no known contradiction exists between docs, repo, and outputs

### What verification / proof is required
Verification should scale to the task, but should generally include some combination of:

- build verification
- typecheck verification
- test verification
- runtime validation of affected flows
- artifact generation for meaningful outputs
- screenshots or route proof for visible UI surfaces
- sample diagnosis/intervention proof for poker logic
- closeout summary documenting what changed and how it was verified

A preferred closeout sequence is:

1. plan
2. implement
3. verify
4. generate proof artifacts
5. update status docs
6. produce closeout summary

---

## Domain-sensitive boundaries

### What is poker-specific and should never be treated as portable core
The following should be treated as **poker-domain specific** and must not be assumed portable core:

- hand history logic
- session review logic
- leak detection models
- concept taxonomy tied to poker strategy
- intervention logic for poker mistakes or player pool exploits
- solver-informed feedback structures
- poker-specific coaching summaries
- stake / format / position / population reads
- betting-line logic specific to poker hands and nodes
- improvement heuristics specific to poker decision-making
- tags, labels, and classifications tied to poker concepts
- study plans built around poker formats, positions, or recurring leaks
- hand review workflows and post-session feedback loops

### What can be shared with portable AI core
Only the following categories should be treated as potentially portable:

- doctrine patterns
- governance rules
- proof conventions
- artifact structure patterns
- workflow templates
- AI operating standards
- project adapter patterns
- status-sync and closeout conventions

Portable core should supply **operating method**, not poker logic.

---

## Operating interpretation

Poker Coach OS should be treated as a **domain-bound coaching intelligence system** that uses shared AI-core operating discipline but maintains its own:

- roadmap
- architecture
- truth hierarchy
- artifact outputs
- diagnostic surfaces
- coaching logic
- intervention models
- improvement framework

The portable core supports how the system is run.  
Poker-specific docs define what the system is.

---

## Initial implementation note
This document should act as the first canonical poker adapter until it is superseded by a more complete poker doctrine stack. As the poker project matures, this file should be revised to point to:

- exact canonical doc paths
- exact active phase names
- exact status docs
- exact verification commands
- exact artifact directories
- exact closeout workflow rules