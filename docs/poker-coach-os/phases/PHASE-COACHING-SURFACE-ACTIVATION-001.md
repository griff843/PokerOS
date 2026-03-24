# PHASE-COACHING-SURFACE-ACTIVATION-001

## Status
Draft

## Owner
Griff / Poker Coach OS

## Purpose
Close the gap between high-quality coaching intelligence and the actual user experience of being coached.

The system already performs strong diagnosis, longitudinal memory tracking, intervention selection, and transfer evaluation. This phase activates the coaching surface so the product does not merely report what happened, but teaches the player how to think, what to ask, and how to transfer study insights into real play.

## Core Problem Statement
The current system has stronger intelligence than most coaching products, but its teaching surface is underpowered.

Current gap:
- The app explains accurately but does not teach like a real coach
- The app tracks memory and progress but does not express relational continuity strongly enough
- Pool-aware curriculum architecture exists but is not yet operationalized end to end
- Real-play review exists as infrastructure but is not yet a first-class coaching loop

This creates an infrastructure-to-experience mismatch:
- strong internal coaching engine
- weaker external coaching experience

## Phase Objectives
1. Convert coaching output from diagnostic reporting into instructional coaching
2. Prove pool-aware runtime behavior is real and end-to-end correct
3. Activate a narrow coaching voice layer on high-value surfaces
4. Expand curriculum depth only after runtime truth is locked
5. Elevate real-play hand review into a primary coaching loop

## In Scope
- Canonical coaching response contract
- Interpretation vocabulary unification
- Regression semantics correction
- Runtime deduplication / recomputation cleanup
- Engine manifest fixture contract
- Pool-aware execution truth
- Coaching voice pilot on selected surfaces
- Content expansion planning and first batch rollout
- Real-play review loop design

## Out of Scope
- Full product-wide personality system
- Massive content authoring beyond first structured expansion batch
- Non-essential UI redesign unrelated to coaching surface activation
- New analytics surfaces not tied to teaching or transfer

## Required Preconditions
The following must be completed or landed before this phase can be declared active for full implementation:
1. Findings A and B committed and merged cleanly
2. `tsc --noEmit` clean on target branch
3. Replay interpretation vocabulary unified
4. `regressionCount` semantics corrected
5. Heavy duplicate computation removed where already identified
6. Engine manifest fixture factory established

## Workstreams

### Workstream 1 — Integrity Lock
Objective: eliminate semantic drift and misleading state before new coaching surfaces are added.

Required actions:
- Unify replay interpretation vocabulary into one canonical enum/type module
- Replace split vocabularies across replay and inspector surfaces
- Correct `regressionCount` to represent real count semantics if available in call chain
- If real count is not yet recoverable, rename temporary boolean field honestly and mark as non-canonical
- Land A/B fixes and fixture updates in same truth-preserving PR
- Ensure render/test fixtures adopt shared engine manifest factory

Acceptance criteria:
- One canonical replay interpretation vocabulary exists
- No producer/consumer defines its own interpretation state names
- Escalation logic is driven by honest semantics
- Fixtures no longer drift on manifest shape changes
- Branch passes clean typecheck

### Workstream 2 — Runtime Cleanup
Objective: remove duplicated expensive computation and redundant recomputation before scaling concept volume.

Required actions:
- Deduplicate `buildPlayerIntelligence` across snapshot and route layers
- Remove redundant `buildConceptDecisionAuditSummary` recomputation where canonical case bundles already provide decision audit output
- Pass canonical computed artifacts explicitly instead of rebuilding downstream

Acceptance criteria:
- Heaviest intelligence computation is performed once per request path where feasible
- Canonical outputs are consumed, not recomputed ad hoc
- Request path is measurably simpler and easier to reason about

### Workstream 3 — Pool-Aware Execution Truth Lock
Objective: prove that pool-aware content architecture is real at runtime before investing in content expansion.

Required actions:
- Ensure active pool selection is represented in session/runtime state
- Ensure scoring reads `answer_by_pool`
- Ensure correctness evaluation changes by pool where intended
- Ensure explanations/coaching responses reflect pool-conditioned truth
- Ensure intervention logic can distinguish concept performance by pool context
- Add tests proving end-to-end pool-conditioned behavior

Acceptance criteria:
- Pool selection changes accepted answer behavior where defined
- Pool-conditioned scoring is exercised by automated tests
- Explanation output is materially pool-aware where relevant
- No dormant pool architecture remains unverified in the runtime path

Kill condition:
- Do not enter broad content authoring if pool-aware runtime behavior remains partial, mocked, or unproven

### Workstream 4 — Coaching Response Contract
Objective: create the structured teaching protocol that every coaching response must obey.

The coaching layer must not merely summarize what happened. It must teach the player how to reason next time.

Canonical coaching response contract must include:
- diagnosis
- core mental mistake
- corrective reasoning
- transferable rule
- next-time trigger question
- confidence calibration note where relevant
- next-step prescription
- optional memory reference when useful

Example intent:
- not “you missed a threshold call”
- but “you failed to ask whether enough bluffs survive to river; next time, estimate bluff density before calling”

Acceptance criteria:
- Coaching responses can be generated from structured inputs without losing diagnostic precision
- Response contract supports both direct teaching and Socratic prompting
- Responses are explicitly designed for transfer into future play
- Structured cards and narrative coaching remain semantically aligned

### Workstream 5 — Coaching Voice Pilot
Objective: add a narrow LLM-backed coaching layer to validate teaching quality before full rollout.

Pilot surfaces:
1. Post-drill feedback
2. Weakness/concept explanation
3. Imported real-hand transfer-gap explanation

Rules:
- The LLM layer must sit on top of structured teaching inputs
- It must not invent diagnosis
- It must not replace canonical engine truth
- It may improve delivery, coaching tone, sequencing, and memory-aware narration

Acceptance criteria:
- Pilot responses feel like coaching, not dashboard summaries
- Coaching references prior struggles/progress when appropriate
- Tone is natural without becoming vague
- Narrative layer remains grounded in canonical engine outputs

Kill condition:
- Reject any implementation where LLM text becomes the source of truth instead of the delivery layer

### Workstream 6 — Curriculum Expansion
Objective: expand depth only after runtime truth and instructional contract are established.

Initial target:
- first batch of 20–30 new drills
- then 100+
- then path toward 200+ across broader concept coverage

Expansion principles:
- prioritize concept coverage over random scenario count
- include pool variants where runtime support is proven
- include contrastive spots that train reasoning differences, not only memorization
- distribute across preflop, flop, turn, river rather than overloading one street

Acceptance criteria:
- New drills are authored against active runtime contracts
- Content meaningfully increases concept and street coverage
- Repetition risk declines materially
- Curriculum supports sustained multi-week use without obvious exhaustion

### Workstream 7 — Real-Play Coaching Loop
Objective: turn transfer evaluation into a first-class coaching loop.

Target loop:
1. Player studies concept
2. Player imports real hand
3. System maps hand to concept and failure pattern
4. Coach explains live-play mistake in teaching language
5. Follow-up drills adjust accordingly
6. Retention/transfer is re-checked later

Acceptance criteria:
- Imported hands can trigger concept-linked coaching
- Real-play review affects training recommendations
- The loop is visible as a coaching flow, not just a data view
- Transfer becomes a primary product pillar, not a secondary screen

## Sequencing

### Stage 1 — Immediate Integrity Work
1. Land A/B fixes
2. Clean fixture drift
3. Unify interpretation vocabulary
4. Correct regression semantics

### Stage 2 — Runtime Hygiene
5. Deduplicate heavy intelligence computation
6. Remove redundant audit recomputation
7. Establish shared engine manifest fixture pattern

### Stage 3 — Pool Truth Lock
8. Prove pool-aware runtime behavior end to end

### Stage 4 — Dual-Track Product Lift
9. Run coaching response contract + coaching voice pilot
10. Expand curriculum in disciplined batches against verified runtime behavior

### Stage 5 — Canonical Coaching Loop
11. Elevate real-play review into primary coaching workflow

## Acceptance Criteria for Phase Completion
This phase is complete only when all of the following are true:

1. Replay/interpretation semantics are canonical and unified
2. Regression semantics are honest and operationally correct
3. Duplicate heavy computation has been removed in identified hotspots
4. Engine manifest fixtures follow a shared factory pattern
5. Pool-aware runtime behavior is tested and proven
6. A structured coaching response contract exists and is enforced on pilot surfaces
7. Coaching voice pilot is live on selected high-value surfaces
8. Curriculum depth has materially expanded from prototype level
9. Real-play review has a defined and functioning coaching loop

## Proof Artifacts
Expected artifacts for ratification:
- clean typecheck receipt
- diff showing replay interpretation vocabulary unification
- diff showing regression semantics correction
- runtime proof for deduplicated computation path
- automated tests proving pool-aware behavior
- sample before/after coaching outputs from pilot surfaces
- content expansion inventory snapshot
- real-play coaching loop walkthrough artifact

Suggested artifact paths:
- `out/phases/PHASE-COACHING-SURFACE-ACTIVATION-001/typecheck.txt`
- `out/phases/PHASE-COACHING-SURFACE-ACTIVATION-001/pool-runtime-proof.md`
- `out/phases/PHASE-COACHING-SURFACE-ACTIVATION-001/coaching-output-before-after.md`
- `out/phases/PHASE-COACHING-SURFACE-ACTIVATION-001/content-inventory.json`
- `out/phases/PHASE-COACHING-SURFACE-ACTIVATION-001/real-play-loop-proof.md`

## Risks
- Adding narrative coaching before structured teaching contracts are defined
- Scaling content into dormant or partially wired pool-aware architecture
- Letting LLM output override canonical engine truth
- Growing explanation verbosity without improving transfer
- Continuing to treat real-play review as auxiliary instead of canonical

## Strategic Outcome
When this phase is complete, Poker Coach OS should no longer feel like a high-intelligence analysis dashboard with training attached.

It should begin to feel like:
- a coach that remembers
- a coach that teaches
- a coach that adapts
- a coach that verifies whether training actually transferred into real play

## Decision Rule
If forced to choose between:
- more content without coaching truth
- or less content with real teaching and transfer loops

choose real teaching and transfer loops first.

That is the actual moat.