# Elite Daily Coach - 12 Sprint Execution Plan

## Purpose

This document is the strict execution plan for taking Poker OS from its current state to a product that is:

- credible for daily use
- stronger than generic poker training software
- competitive with top coaching tools in structured study workflows
- capable of coaching a serious live cash player toward low-stakes dominance and mid/high-stakes competence

This is not a vision memo.

This is an implementation document for future developers.

It is intentionally blunt.

---

## Non-Negotiable Framing

### What the goal is

The goal is not:

- "ship more features"
- "make the UI prettier"
- "add AI chat everywhere"
- "match solver software exactly"

The goal is:

> build the best software coach possible for structured poker improvement, with strong daily usability, persistent learner memory, rich drill truth, diagnostic coaching, and real-play transfer

### What success means after 12 sprints

At the end of Sprint 12, the product should be able to do all of the following reliably:

- assign a credible daily study block
- run a study session that feels coached rather than quiz-like
- explain why a line works in range-aware language
- capture why the user missed the spot
- persist and reuse learner history across sessions
- convert misses and real-play leaks into targeted follow-up work
- cover enough common live cash spots that daily use feels broad rather than narrow
- surface meaningful progress and recurring leak patterns over time

### What success does not mean

Even after Sprint 12, the product will still not fully replace:

- full solver exploration depth
- elite custom one-on-one human coaching
- emotional/psychological coaching
- subjective exploit prioritization from a live observer

That is acceptable.

The target is software that wins on structured coaching quality, daily usefulness, and repeatable improvement.

---

## Source-of-Truth Snapshot (As Of 2026-04-05)

This section is based on the repo state and current audit tooling, not on older roadmap claims.

### Verified current state

- `241` drills exist across `7` content files
- diagnostic prompt coverage is `241/241`
- complete gold-lane-style coaching depth is still thin across the full library
- strict coaching-context completeness is `22/241`
- follow-up coverage is `93/241`
- follow-up concept coverage is `73/241`
- pool-aware answers exist on `193/241` drills
- street mix is heavily river-weighted:
  - river: `138`
  - turn: `42`
  - preflop: `31`
  - flop: `30`
- pot-type mix is heavily SRP-weighted:
  - SRP: `212`
  - 3BP: `14`
  - limp: `9`
  - multiway: `6`
  - 4BP: `0`
  - squeeze: `0` canonical `scenario.pot_type` drills

### Product surfaces that already exist

- Command Center
- study session flow
- review/coaching detail
- session summary
- Weakness Explorer
- Growth Profile
- real-hand workflow surfaces

### Architecture strengths already present

- strong business logic separation in `packages/core`
- meaningful learner modeling and recommendation infrastructure
- concept graph and concept snapshots
- intervention planning scaffolding
- diagnostic prompt schema and rendering path
- real-hand bridge architecture

### Hard truths

The main problem is not "we need more product pages."

The main problems are:

1. content depth is still too narrow
2. range teaching is still too weak
3. the daily coach loop is better than before, but still not fully execution-oriented
4. real-play ingestion and transfer are not strong enough yet
5. repo/process discipline is not yet stable enough for 12 uninterrupted sprints without drift

---

## What We Have

### Strong enough to keep

- core architecture
- review/play/summary loop
- diagnostics schema and authored prompt coverage
- coaching snapshot infrastructure
- follow-up concepts and concept-aware review/session links
- real-hand workflow foundation
- batch validation and patch workflows
- newly added content audit CLIs

### Not strong enough yet

- breadth of training library
- visible range buckets and combo teaching
- intervention execution depth
- session-to-session memory quality
- daily plan specificity
- solver-backed truth layer
- structured import from mainstream poker tracking tools

### Missing completely or effectively missing

- canonical 4-bet-pot content coverage
- canonical squeeze-pot coverage
- visible combo/frequency range interface
- solver frequency display
- structured PokerTracker / Holdem Manager import
- enough preflop and flop volume to support elite daily use

---

## What We Must Not Do

These are anti-goals for the next 12 sprints.

- Do not widen product scope faster than truth depth.
- Do not add broad AI-chat surfaces as a substitute for authored strategic truth.
- Do not add flashy dashboards while the training library is still river-heavy and thin.
- Do not treat "content exists" as success if the coaching prose is templated.
- Do not collapse into solver theater with fake frequencies or vague range copy.
- Do not merge large content batches without validation, review, and explicit quality gating.
- Do not let roadmap docs drift from repo truth.

---

## Operating Rules For All 12 Sprints

### Every sprint must produce all of the following

- one clear product outcome
- one clear content/truth outcome
- one clear verification outcome
- one clear documentation outcome

### Every sprint must pass these gates before being called complete

1. implementation complete
2. targeted tests pass
3. content validation passes for changed content
4. docs updated where reality changed
5. next-sprint blockers identified explicitly

### Every sprint must name

- what changes in code
- what changes in content
- what becomes measurable that was not measurable before
- what we are still not solving yet

---

## Sprint Structure

Each sprint below includes:

- objective
- why it matters
- exact required work
- explicit exclusions
- acceptance criteria
- failure conditions

The order matters.

Do not reorder these casually.

---

## Sprint 1 - Repo Truth, Green Pipeline, And Execution Discipline

### Objective

Make the repo trustworthy enough to support the next 11 sprints without process collapse.

### Why this is first

If the repo is not green, branch tracking is loose, validation is inconsistent, and roadmap truth is stale, then every later sprint slows down and more subtle mistakes land.

### Required work

#### Git and branch hygiene

- ensure the active branch tracks its remote branch
- audit local vs remote state cleanly
- commit/stage work into logical groups instead of one massive undifferentiated diff
- document the working branch/PR discipline for this repo

#### Verification pipeline

- make `pnpm typecheck` reliable
- make `pnpm test` reliable
- make `pnpm verify` reliable
- make `pnpm validate:canonical` part of normal content acceptance

#### Tooling

- lock in `drill:coverage`
- lock in `drill:lane-gaps`
- lock in `drill:followups-audit`
- lock in `drill:trace`
- add `drill:patch-quality`

#### Docs

- update any stale roadmap or gap-tracker claims
- create a simple "current repo truth" reference if needed

### Explicitly not in scope

- large new product surfaces
- major content expansion
- solver integration

### Acceptance criteria

- `pnpm verify` passes from a clean checkout
- canonical validation is runnable and part of content workflow
- git branch/upstream state is sane
- new audit CLIs are committed and documented
- current roadmap truth matches actual repo behavior

### Failure conditions

- verification still depends on manual heroics
- content merges can still land without being audited
- stale roadmap claims remain

---

## Sprint 2 - Daily Coach Loop Reliability

### Objective

Make the daily workflow feel like a coherent coach loop, not a collection of good components.

### Why this matters

The user wants a daily training and learning tool. Daily trust comes before elite breadth.

### Required work

#### Command Center

- tighten daily assignment logic
- ensure today’s plan is explicit about:
  - what to study
  - why that block matters
  - what leak it is targeting
  - what success looks like

#### Session summary

- synthesize recurring misses into coach language
- carry authored follow-up truth into the summary
- show the next assigned block clearly

#### Follow-up execution

- make concept follow-up flows one click from summary and command center
- ensure follow-up session launch respects authored `follow_up_concepts`

#### Coaching voice

- make the product sound like one coach
- remove generic recap phrasing where it still survives

### Explicitly not in scope

- new major content families
- solver frequencies
- tracker imports

### Acceptance criteria

- a user can open the app and know exactly what to do today
- after a session, the app tells them exactly what to study next and why
- follow-up actions are executable, not decorative

### Failure conditions

- command center still reads like analytics instead of coaching
- session summary still reads like a post-hoc report instead of a prescription

---

## Sprint 3 - Preflop Coverage Foundation

### Objective

Fix the most obvious library weakness: thin preflop coverage.

### Why this matters

No serious poker training product can feel elite if preflop is under-covered.

### Required work

#### Content

Author and merge high-quality preflop drills for:

- opening ranges
- facing opens
- 3-bet defense
- 3-bet construction
- 4-bet thresholds
- squeeze candidates and squeeze defense
- live-pool exploit deviations where action truly changes

#### Coaching truth

Every new serious preflop drill must include:

- full coaching context
- one diagnostic prompt
- non-templated `key_concept`
- non-templated `difficulty_reason`
- non-templated `why_preferred_line_works`

#### Curriculum structure

- define the preflop lanes intentionally
- tag them consistently so session planning and concept assignment can use them

### Explicitly not in scope

- visual range grid UI
- full solver integration

### Acceptance criteria

- preflop no longer feels like a token slice of the library
- canonical `4BP` drills exist
- canonical squeeze drills exist
- preflop becomes a daily-usable lane, not a sparse side feature

### Failure conditions

- new preflop content is schema-valid but strategically generic
- 4-bet and squeeze spots are still absent

---

## Sprint 4 - Flop SRP And Flop 3BP Depth

### Objective

Build enough flop decision density that the product stops feeling river-centric.

### Why this matters

The current library is too river-heavy. Daily coaching cannot be elite if the user rarely trains the street where many strategic mistakes actually begin.

### Required work

#### Content

Add strong flop coverage for:

- SRP c-bet sizing
- flop checks and delayed c-bets
- IP vs OOP continuation decisions
- flop check-raise response
- 3-bet-pot flop continuation and defense

#### Coaching truth

Flop coaching must explain:

- equity denial
- range advantage
- board interaction
- over-cbetting vs under-cbetting leaks
- pool-specific simplifications

#### Product usage

- ensure session plans actually assign these new flop lanes
- ensure summary/debrief can mention flop-rooted mistakes explicitly

### Acceptance criteria

- flop study feels materially broader than before
- session recommendations include flop work naturally
- drill counts and lane mix show measurable flop growth

### Failure conditions

- added drills are numerous but repetitive
- new flop content does not improve session recommendations

---

## Sprint 5 - Range Teaching Surface V1

### Objective

Close the biggest "coach feel" gap: visible range teaching.

### Why this matters

Top-tier coaching software and strong human coaches teach ranges, not just actions.

### Required work

#### UI

Surface authored range support clearly:

- value buckets
- bluff buckets
- range context
- range notes

#### Presentation rules

- show range information after answer reveal in a scannable order
- make blocker- and threshold-relevant information visually legible
- do not dump raw JSON-looking content into the UI

#### Data model usage

- ensure authored `range_support` is actually consumed everywhere it should be
- improve review/detail surfaces where buckets are still buried or too generic

### Explicitly not in scope

- true solver explorer
- full combo matrix tooling

### Acceptance criteria

- users can see value/bluff buckets, not just read about them
- blocker-sensitive spots feel materially easier to understand after review
- the coaching panel looks more like teaching and less like recap

### Failure conditions

- ranges remain prose-only
- buckets are technically present but visually weak or hidden

---

## Sprint 6 - Diagnostic Coaching And Misunderstanding Capture V2

### Objective

Move from "prompt exists" to "reasoning diagnosis actually matters."

### Why this matters

This is one of the clearest potential differentiators versus generic tools.

### Required work

#### Diagnostic flow

- ensure reasoning checks happen at the right moment in the post-answer flow
- classify misses into meaningful misunderstanding categories
- connect diagnosis results to learner memory and follow-up planning

#### Persistence

- make diagnostic outcomes durable and queryable
- ensure session summaries and concept views can use them

#### Review UX

- show whether a miss was:
  - line misunderstanding
  - threshold error
  - range construction error
  - blocker blindness
  - pool assumption error
  - confidence miscalibration

### Acceptance criteria

- reasoning capture changes what the system prescribes next
- repeated misunderstandings can be seen across sessions
- diagnostic coaching feels like a real coaching advantage, not a UI extra

### Failure conditions

- diagnostic prompts are answered but do not influence anything downstream
- misunderstanding categories remain invisible or untrusted

---

## Sprint 7 - Persistent Learner Memory And Intervention Execution

### Objective

Make the product remember the player deeply enough to coach longitudinally.

### Why this matters

Without durable learner memory, the app is still session-smart rather than player-smart.

### Required work

#### Persistence layer

- ensure all relevant attempt and diagnosis data reaches durable storage
- ensure intervention snapshots and downstream learner state are populated consistently

#### Intervention execution

- move from intervention suggestion to intervention assignment and tracking
- show whether the user actually completed the assigned repair work
- track whether the assigned block reduced the original leak

#### Product surfaces

- concept detail pages should show intervention history, not just current weakness snapshots
- command center should know whether a previous intervention resolved, partially resolved, or failed

### Acceptance criteria

- the system can explain what it has already assigned and whether it helped
- learner memory persists across sessions and affects future prioritization

### Failure conditions

- coaching still feels stateless from day to day
- interventions still behave like recommendations with a new label

---

## Sprint 8 - Real-Hand Ingestion And Practice-to-Play Transfer

### Objective

Make real-play mistakes part of the same coaching system as drills.

### Why this matters

Elite training software cannot stop at curated reps.

### Required work

#### Real-hand ingestion

- strengthen manual reconstruction flow
- implement structured import for mainstream hand-tracking exports if feasible in this sprint
- if structured import is not fully ready, define the exact import contract and parser path

#### Comparison logic

- make practice leaks vs real-play leaks visible side by side
- map recurring real-hand leaks into drill assignments

#### Follow-up assignment

- create targeted follow-up blocks from real-play mistakes
- explain whether the recommended block is:
  - exact-match repair
  - adjacent transfer
  - bridge reconstruction

### Acceptance criteria

- a real hand can produce a believable next assignment
- the user can see how study and table performance connect

### Failure conditions

- real-hand review remains interesting but operationally weak
- follow-up assignments from real hands feel generic

---

## Sprint 9 - Solver-Backed Truth Layer V1

### Objective

Add the first credible solver-truth layer without pretending to be a full solver product.

### Why this matters

To compete at the top end, the product needs stronger truth for mixes, thresholds, and combo-level teaching.

### Required work

#### Data

- define the minimum viable solver-truth schema usage
- start populating `strategy_mix` where it adds real value
- avoid fake precision

#### UI

- show approximate frequencies when available
- clearly separate:
  - authored coaching truth
  - solver-backed frequency truth
  - missing data

#### Content priority

- start with the highest-leverage lanes:
  - preflop threshold spots
  - flop c-bet mix spots
  - river bluff-catching thresholds

### Acceptance criteria

- mixed-strategy spots no longer rely on vague prose alone
- the UI can show frequency guidance honestly

### Failure conditions

- solver language is added without real data
- mixed-strategy teaching becomes confusing rather than clarifying

---

## Sprint 10 - Coach Debrief, Milestones, And Longitudinal Development

### Objective

Make the system feel like a coach over weeks, not just sessions.

### Why this matters

Elite daily use requires the user to feel ongoing development, not isolated study reps.

### Required work

#### Debrief quality

- turn session summaries into longitudinal coaching debriefs
- identify repeating patterns over time
- explicitly say what has improved and what remains unstable

#### Milestones

- concept mastery milestones
- leak reduction milestones
- intervention completion milestones

#### Development record

- show trendlines that matter
- avoid vanity metrics
- tie every metric to coaching significance

### Acceptance criteria

- the user can tell what changed in their game this week
- the coach can point to improvements and unresolved leaks

### Failure conditions

- milestones are gamified badges with no coaching value
- progress reporting is broad but not actionable

---

## Sprint 11 - Breadth Expansion To Serious Daily Rotation

### Objective

Push the library from "promising" to "broad enough for ongoing serious use."

### Why this matters

Even a great coaching loop fails if the user keeps seeing the same narrow family of spots.

### Required work

#### Content breadth

Expand and balance coverage across:

- preflop
- flop
- turn
- river
- SRP
- 3BP
- 4BP
- squeeze
- multiway
- exploit-specific live cash lines

#### Rotation logic

- make sure session planning does not overfit familiar lanes
- preserve spaced repetition while broadening exposure

#### Audit discipline

- use coverage and lane-gap tooling to drive content priorities
- enforce stronger patch-quality checks on large content batches

### Acceptance criteria

- daily use no longer feels trapped in one subtree
- lane mix is materially healthier than the current river/SRP skew
- content expansion remains quality-controlled

### Failure conditions

- drill count grows but breadth remains fake
- the daily plan still mostly rotates river bluff-catching and near-adjacent variants

---

## Sprint 12 - Elite Readiness Hardening

### Objective

Take the product from "strong and ambitious" to "ready to be judged seriously."

### Why this matters

This is the sprint where the project proves whether it is actually elite-ready or just feature-rich.

### Required work

#### Full-system audit

- audit the daily workflow end to end
- audit the real-hand workflow end to end
- audit content coverage by lane, street, pot type, concept, and coaching depth
- audit green pipeline and merge discipline

#### Hardening

- fix weak or inconsistent coaching surfaces
- fix any stale roadmap truth
- remove brittle workflows discovered in prior sprints

#### Benchmarking

- compare the product honestly against:
  - solver trainers
  - coaching quiz products
  - leak-detection tools

#### Final readiness report

- what the product now clearly does better than competitors
- what remains weaker
- what should become Sprint 13+

### Acceptance criteria

- the repo is green
- the daily loop is credible
- the content library is broad enough for sustained use
- the coaching loop feels intentional and longitudinal
- the real-hand bridge is operationally meaningful
- remaining gaps are known and bounded, not vague

### Failure conditions

- the product still depends on narrative optimism to sound elite
- breadth, range teaching, or learner memory remain obviously incomplete

---

## Cross-Sprint Workstreams

These run across multiple sprints and must not be neglected.

### Workstream A - Content Truth Quality

Must improve every sprint.

Tracked by:

- coverage
- lane-gap
- patch-quality review
- gold-lane acceptance standards

### Workstream B - Coaching Voice Consistency

Must improve every sprint.

Tracked by:

- command center quality
- post-answer coaching quality
- session debrief quality
- follow-up assignment specificity

### Workstream C - Repo Discipline

Must remain stable every sprint.

Tracked by:

- green verification
- review quality
- branch hygiene
- docs sync

### Workstream D - Measurability

Every sprint must improve what can be measured.

Tracked by:

- drill counts by lane
- coaching depth coverage
- follow-up coverage
- intervention completion data
- real-hand to follow-up conversion

---

## Suggested Ownership Split

### Codex

- architecture and implementation owner
- UI/data-flow work
- validators and repo tooling
- audit and acceptance gate owner
- final merge readiness judgment

### Claude

- batch content production
- prose refinement in bounded content lanes
- command execution when explicitly packeted

### Human owner

- strategic prioritization
- quality veto
- deciding when a lane is good enough to merge
- deciding whether the product is actually becoming coach-like or merely bigger

---

## Definition Of "Elite" For This Repo

This repo should only be called elite when all of the following are true:

- daily use is friction-light and coaching-heavy
- the product teaches ranges, thresholds, blockers, and pool logic clearly
- misses lead to real diagnosis, not just grading
- the system remembers the player across time
- real-play mistakes feed believable training assignments
- coverage is broad enough that serious players do not outgrow it immediately
- the repo is disciplined enough that quality does not degrade as scope grows

If any one of those is still clearly false, the product is not elite yet.

---

## Immediate Next Action After This Document

Do not jump to Sprint 5+ work.

Start with:

1. Sprint 1 repo-truth and green-pipeline hardening
2. Sprint 2 daily coach loop tightening
3. Sprint 3 preflop expansion

That order is strict.

Trying to skip ahead to solver surfaces or flashy range UI before the first three are stable will slow the project down.

---

## Final Blunt Assessment

Poker OS is no longer a toy.

It is already structurally better than many poker apps because it has real coaching architecture.

But it is not yet elite.

Right now it is best described as:

> a strong coaching architecture with a narrow but improving training truth layer

The next 12 sprints are enough to change that if and only if:

- repo discipline stays high
- content quality does not collapse under volume pressure
- sprint order is respected
- range teaching and real-play transfer are treated as core product work, not polish

If those conditions are met, this can become a real top-tier daily poker training system.
