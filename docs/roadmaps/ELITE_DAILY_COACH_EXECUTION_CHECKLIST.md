# Elite Daily Coach - 12 Sprint Execution Checklist

## Purpose

This document is the working execution checklist for the 12-sprint plan in [`ELITE_DAILY_COACH_12_SPRINT_PLAN.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/ELITE_DAILY_COACH_12_SPRINT_PLAN.md ).

Use this file for:

- sprint execution
- status tracking
- task ownership
- blockers
- validation evidence
- exit-gate enforcement

Do not use this file as the strategic source of truth.

That role belongs to:

- [`ELITE_DAILY_COACH_12_SPRINT_PLAN.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/ELITE_DAILY_COACH_12_SPRINT_PLAN.md )
- [`COACH_EQUIVALENCE_ROADMAP.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/COACH_EQUIVALENCE_ROADMAP.md )

This file exists so that execution status does not pollute the strategic roadmap.

---

## How To Use This Document

### Status values

Use only:

- `not_started`
- `in_progress`
- `blocked`
- `done`

### Ownership values

Use only:

- `codex`
- `claude`
- `human`
- `shared`

### Evidence rule

No checklist item is complete until evidence exists in one of these forms:

- merged code
- validated content batch
- passing command output
- updated doc path
- report path

### Sprint close rule

A sprint is not closed because work "basically landed."

A sprint closes only when:

1. all must-have checklist items are `done`
2. acceptance gate is satisfied
3. failure conditions are not triggered
4. evidence is written down in this file

---

## Global Checklist For Every Sprint

Complete this section for every sprint before marking it complete.

- [ ] Current sprint goal is explicitly restated in this document
- [ ] In-scope work is listed
- [ ] Out-of-scope work is listed
- [ ] Owners are assigned
- [ ] Validation commands are listed
- [ ] Evidence paths are recorded
- [ ] Blockers are recorded honestly
- [ ] Docs changed in the sprint are listed
- [ ] Next sprint handoff notes are written

---

## Sprint 1 - Repo Truth, Green Pipeline, And Execution Discipline

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `claude`

### Sprint goal

Make the repo trustworthy enough to support the next 11 sprints without drift, mystery state, or unreliable verification.

### Must-have outcomes

- [ ] Active branch has sane upstream tracking
- [ ] Local vs remote git truth is documented
- [ ] Working tree changes are grouped into logical commit units
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm validate:canonical` passes
- [ ] `pnpm verify` passes
- [ ] Content validation workflow is part of normal acceptance
- [ ] New audit CLIs are committed and documented
- [ ] Roadmap/gap-tracker truth is reconciled to repo reality

### Must-do tasks

#### Git truth and hygiene

- [ ] Confirm current branch and upstream
- [ ] Confirm whether local HEAD matches remote branch tip
- [ ] Summarize dirty worktree into logical groups
- [ ] Separate tooling changes from content changes from product changes
- [ ] Write or update branch/PR discipline guidance if needed

#### Verification reliability

- [ ] Fix environment/toolchain blockers preventing `pnpm` verification
- [ ] Ensure clean checkout can run the standard repo commands
- [ ] Ensure canonical content validation is reliable

#### Tooling

- [ ] Commit `drill:coverage`
- [ ] Commit `drill:lane-gaps`
- [ ] Commit `drill:followups-audit`
- [ ] Commit `drill:trace`
- [ ] Build `drill:patch-quality`

#### Documentation

- [ ] Update stale roadmap claims
- [ ] Ensure current-state docs reflect actual repo truth

### Out of scope

- [ ] No broad feature work
- [ ] No major content expansion
- [ ] No solver integration work

### Validation commands

```bash
git status --short --branch
git branch -vv
pnpm typecheck
pnpm test
pnpm validate:canonical
pnpm verify
pnpm drill:coverage
pnpm drill:lane-gaps
pnpm drill:followups-audit
```

### Acceptance gate

- [ ] Repo is green from a clean checkout
- [ ] Git state is understandable and intentional
- [ ] Tooling exists to measure content truth and lane gaps

### Failure conditions

- [ ] Verification still depends on ad hoc fixes
- [ ] Branch state is still ambiguous
- [ ] Roadmap truth is still stale

### Evidence

- Commands:
- Commits:
- Reports:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 2

- Not written yet

### Execution packet

#### Codex

- [ ] Audit git truth and branch/upstream state
- [ ] Define logical commit groups from the dirty worktree
- [ ] Fix verification blockers in repo code/tooling
- [ ] Build and verify `drill:patch-quality`
- [ ] Update roadmap/gap-tracker truth where repo reality drifted

#### Claude

- [ ] Execute git/verification command packet exactly
- [ ] Report failing commands with exact output
- [ ] Stage or commit only when explicitly instructed after grouping is approved
- [ ] Do not hide mixed worktree state

#### Human

- [ ] Approve logical commit grouping when mixed changes exist
- [ ] Decide whether repo should be cleaned via multiple commits or one stabilization PR

### Proof required to close

- [ ] Screenshot or pasted output of clean verification commands
- [ ] Git branch tracking confirmed
- [ ] Commit grouping written in this doc
- [ ] `drill:patch-quality` exists and runs

---

## Sprint 2 - Daily Coach Loop Reliability

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `claude`

### Sprint goal

Make the daily workflow feel like one coach guiding the user through today’s work, this session’s results, and the next assigned repair block.

### Must-have outcomes

- [ ] Command Center assigns a clear daily block
- [ ] Session summary explains what happened in coach language
- [ ] Follow-up actions are executable in one click
- [ ] Coaching voice is consistent across command center, session, and summary
- [ ] Daily workflow feels coherent end to end

### Must-do tasks

#### Command Center

- [ ] Tighten daily focus assignment logic
- [ ] Make "why this today" explicit
- [ ] Make targeted leak/focus concept explicit
- [ ] Make success condition explicit

#### Session summary

- [ ] Aggregate recurring miss patterns
- [ ] Carry authored follow-up truth into summary
- [ ] Present next assigned block clearly

#### Follow-up execution

- [ ] Ensure follow-up concepts launch actionable work
- [ ] Preserve concept-aware review flow where useful
- [ ] Prevent dead-end navigation

#### Coaching voice

- [ ] Remove generic recap copy
- [ ] Normalize tone across key surfaces

### Out of scope

- [ ] No major new content families
- [ ] No solver-frequency work
- [ ] No tracker import work

### Validation commands

```bash
pnpm vitest run apps/table-sim/src/lib/session-review.test.ts
pnpm vitest run apps/table-sim/src/lib/command-center.test.ts
pnpm vitest run apps/table-sim/src/lib/learning-transparency.test.ts
pnpm vitest run apps/table-sim/src/components/review/LearningTransparency.render.test.tsx
pnpm verify
```

### Acceptance gate

- [ ] User can open app and know what to study today
- [ ] User can finish a session and receive a believable next assignment
- [ ] Product reads like a coach, not like analytics software

### Failure conditions

- [ ] Command Center still sounds generic
- [ ] Summary still sounds like a report instead of a prescription

### Evidence

- Commands:
- Commits:
- Screens reviewed:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 3

- Not written yet

### Execution packet

#### Codex

- [ ] Audit command center/session summary/follow-up flow end to end
- [ ] Implement coaching-copy and flow-order improvements
- [ ] Ensure follow-up concepts open actionable work
- [ ] Define exact acceptance checks for “daily coach” quality

#### Claude

- [ ] Execute targeted UI test/verification commands
- [ ] Draft copy refinements for weak coach-language surfaces if requested
- [ ] Report any screen or flow that still reads generic

#### Human

- [ ] Judge whether the app feels like a coach assigning work
- [ ] Reject vague or analytics-heavy wording

### Proof required to close

- [ ] Command Center shows a believable daily assignment
- [ ] Session summary shows a believable next prescription
- [ ] Follow-up action is one click and lands somewhere useful
- [ ] Targeted tests pass

---

## Sprint 3 - Preflop Coverage Foundation

### Status

- Sprint status: `not_started`
- Primary owner: `claude`
- Secondary owner: `codex`

### Sprint goal

Turn preflop from a thin supporting lane into a serious daily-use training domain.

### Must-have outcomes

- [ ] Strong preflop opening/facing-open content exists
- [ ] Strong 3-bet offense/defense content exists
- [ ] Canonical 4-bet pot drills exist
- [ ] Canonical squeeze drills exist
- [ ] Preflop coaching prose is non-templated and gold-lane aware

### Must-do tasks

#### Content authoring

- [ ] Add opening-range drills
- [ ] Add facing-open drills
- [ ] Add 3-bet defense drills
- [ ] Add 3-bet construction drills
- [ ] Add 4-bet threshold drills
- [ ] Add squeeze candidate drills
- [ ] Add squeeze defense drills

#### Truth quality

- [ ] Every drill has full coaching context
- [ ] Every drill has one diagnostic prompt
- [ ] `key_concept` is drill-specific
- [ ] `difficulty_reason` is drill-specific
- [ ] `why_preferred_line_works` is drill-specific

#### Curriculum structure

- [ ] Tag preflop lanes cleanly
- [ ] Ensure session planning can assign them
- [ ] Ensure coverage tooling reflects them

### Out of scope

- [ ] No range-grid UI
- [ ] No full solver viewer

### Validation commands

```bash
node scripts/validate-gold-lane.mjs --mode=batch <pending-batch>
pnpm review:gold-batch --batch=<pending-batch> --report=<report-path>
pnpm validate:canonical
pnpm drill:coverage
pnpm drill:lane-gaps
```

### Acceptance gate

- [ ] Preflop coverage is materially broader
- [ ] 4BP count is no longer zero
- [ ] Squeeze coverage is no longer zero
- [ ] Preflop can be assigned as a real study block

### Failure conditions

- [ ] Content is valid but generic
- [ ] 4-bet and squeeze spots are still effectively absent

### Evidence

- Pending batches:
- Review reports:
- Merged files:
- Coverage delta:

### Blockers

- None recorded yet

### Handoff to Sprint 4

- Not written yet

### Execution packet

#### Codex

- [ ] Define exact preflop lane list and naming rules
- [ ] Review all pending preflop batches for schema and strategic quality
- [ ] Reject templated coaching prose
- [ ] Merge only validated, review-passing content
- [ ] Update coverage and lane-gap baselines after merge

#### Claude

- [ ] Generate bounded preflop batches in pending only
- [ ] Validate every batch before reporting done
- [ ] Refine any rejected prose or weak reasoning

#### Human

- [ ] Approve strategic lane priority order
- [ ] Veto weak preflop truths even if schema-valid

### Proof required to close

- [ ] Canonical `4BP` drills exist in source
- [ ] Canonical squeeze drills exist in source
- [ ] Preflop counts increase materially
- [ ] Coverage report attached in evidence

---

## Sprint 4 - Flop SRP And Flop 3BP Depth

### Status

- Sprint status: `not_started`
- Primary owner: `claude`
- Secondary owner: `codex`

### Sprint goal

Reduce river over-concentration by making flop decision training deep enough to matter daily.

### Must-have outcomes

- [ ] SRP flop c-bet and check-back lanes expand materially
- [ ] Flop check-raise response lanes exist and are usable
- [ ] 3BP flop continuation/defense lanes expand materially
- [ ] Flop-rooted mistakes show up in summary and recommendations

### Must-do tasks

- [ ] Add SRP c-bet sizing drills
- [ ] Add delayed c-bet drills
- [ ] Add IP continuation drills
- [ ] Add OOP continuation drills
- [ ] Add flop check-raise response drills
- [ ] Add 3BP flop continuation drills
- [ ] Add 3BP flop defense drills
- [ ] Ensure coaching copy explains equity denial and board interaction
- [ ] Ensure session planner can assign flop-heavy blocks

### Out of scope

- [ ] No combo-matrix UI
- [ ] No structured tracker import work

### Validation commands

```bash
pnpm validate:canonical
pnpm drill:coverage
pnpm drill:lane-gaps
pnpm test
```

### Acceptance gate

- [ ] Flop count increases materially
- [ ] Daily plan uses flop lanes naturally
- [ ] Summary can identify flop-rooted leaks

### Failure conditions

- [ ] Flop content is broad in count but shallow in teaching
- [ ] River still dominates recommendations by inertia

### Evidence

- Pending batches:
- Review reports:
- Merged files:
- Coverage delta:

### Blockers

- None recorded yet

### Handoff to Sprint 5

- Not written yet

### Execution packet

#### Codex

- [ ] Define exact flop lane expansion targets
- [ ] Review and merge only non-repetitive flop content
- [ ] Ensure product surfaces can actually assign and summarize these lanes
- [ ] Update lane-gap measurements post-merge

#### Claude

- [ ] Generate flop SRP and 3BP batches in pending
- [ ] Validate and refine batches
- [ ] Flag any under-specified concepts or spot families

#### Human

- [ ] Confirm the new flop lanes are practical and high-frequency enough
- [ ] Reject shallow repetition disguised as volume

### Proof required to close

- [ ] Flop counts rise materially
- [ ] Session planning includes new flop lanes
- [ ] Summary/debrief can identify flop-rooted leaks

---

## Sprint 5 - Range Teaching Surface V1

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `claude`

### Sprint goal

Make range teaching visible enough that users learn range logic instead of only receiving prose explanations.

### Must-have outcomes

- [ ] Value buckets are clearly visible in review
- [ ] Bluff buckets are clearly visible in review
- [ ] Range context and range notes are surfaced well
- [ ] Blocker-sensitive logic is easier to understand visually

### Must-do tasks

- [ ] Audit current `range_support` consumption
- [ ] Improve review/play UI ordering for range material
- [ ] Improve readability of bucket displays
- [ ] Ensure authored `range_context` is visible where it matters
- [ ] Ensure authored `range_notes` are visible where they matter
- [ ] Test blocker/threshold-heavy examples explicitly

### Out of scope

- [ ] No full solver explorer
- [ ] No full combo heatmap system unless already necessary

### Validation commands

```bash
pnpm test
pnpm verify
pnpm drill:trace -- --id=<representative-drill-id>
```

### Acceptance gate

- [ ] Users can see range buckets, not just hear about them
- [ ] Review surfaces feel more like teaching than recap

### Failure conditions

- [ ] Range truth remains mostly prose
- [ ] Buckets remain buried or visually weak

### Evidence

- Screens reviewed:
- Tests:
- Representative drills:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 6

- Not written yet

### Execution packet

#### Codex

- [ ] Audit where `range_support`, `range_context`, and `range_notes` are or are not consumed
- [ ] Implement the first strong range-teaching surface
- [ ] Ensure review/play surfaces present buckets clearly
- [ ] Test representative blocker/threshold spots

#### Claude

- [ ] Refine weak range prose where surfaced UI exposes templated copy
- [ ] Produce narrowly scoped content fixes if range fields are missing in high-value drills

#### Human

- [ ] Judge whether range teaching is actually visible and useful
- [ ] Reject any UI that still feels like prose-only coaching

### Proof required to close

- [ ] Users can see value and bluff buckets on representative drills
- [ ] At least one blocker-heavy and one threshold-heavy example look good in UI
- [ ] Tests and screenshots are recorded

---

## Sprint 6 - Diagnostic Coaching And Misunderstanding Capture V2

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `claude`

### Sprint goal

Make diagnostic reasoning capture materially affect learner modeling and next-step assignment.

### Must-have outcomes

- [ ] Reasoning checks influence what the app prescribes next
- [ ] Misunderstanding categories persist across sessions
- [ ] Diagnostic reasoning is visible in review and summary

### Must-do tasks

- [ ] Audit diagnostic flow end to end
- [ ] Ensure diagnostic answers are stored durably
- [ ] Ensure misunderstanding categories can be queried
- [ ] Surface misunderstanding type in review UX
- [ ] Use repeated misunderstanding patterns in follow-up assignment
- [ ] Use repeated misunderstanding patterns in concept views

### Out of scope

- [ ] No major content-volume sprint
- [ ] No solver data sprint

### Validation commands

```bash
pnpm test
pnpm verify
pnpm drill:trace -- --id=<diagnostic-heavy-drill-id>
```

### Acceptance gate

- [ ] Diagnostics change downstream coaching behavior
- [ ] Repeated misunderstanding types are visible over time

### Failure conditions

- [ ] Diagnostic answers still behave like local UI state
- [ ] Reasoning capture remains disconnected from coaching decisions

### Evidence

- Tests:
- Data flow proof:
- Screens reviewed:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 7

- Not written yet

### Execution packet

#### Codex

- [ ] Trace diagnostic flow from prompt render to persistence to downstream use
- [ ] Wire missing persistence and aggregation paths
- [ ] Surface misunderstanding type in review, summary, or concept views
- [ ] Ensure repeated misunderstandings affect follow-up assignment

#### Claude

- [ ] Run end-to-end diagnostic flow checks
- [ ] Produce narrow patch files for any drills missing strong diagnosis specificity if discovered

#### Human

- [ ] Judge whether diagnosis changes the coaching, not just the UI

### Proof required to close

- [ ] A diagnostic answer persists
- [ ] Repeated misunderstanding type is visible across sessions
- [ ] Follow-up assignment changes based on misunderstanding pattern

---

## Sprint 7 - Persistent Learner Memory And Intervention Execution

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `claude`

### Sprint goal

Move from session-smart behavior to real cross-session coaching memory and intervention tracking.

### Must-have outcomes

- [ ] Attempts and diagnoses persist reliably
- [ ] Intervention history is visible
- [ ] Intervention outcomes are measurable
- [ ] Future recommendations use past interventions

### Must-do tasks

- [ ] Audit attempt persistence path
- [ ] Audit diagnosis persistence path
- [ ] Audit intervention snapshot generation
- [ ] Surface intervention history in concept/command surfaces
- [ ] Track whether intervention blocks are completed
- [ ] Track whether assigned intervention reduced target leak

### Out of scope

- [ ] No new flashy UX unrelated to learner memory

### Validation commands

```bash
pnpm typecheck
pnpm test
pnpm verify
```

### Acceptance gate

- [ ] App can explain what it assigned before and whether it helped
- [ ] Learner memory clearly affects prioritization

### Failure conditions

- [ ] Coaching still resets emotionally or strategically each session
- [ ] Interventions still behave like untracked recommendations

### Evidence

- Tests:
- Database/state proof:
- Screens reviewed:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 8

- Not written yet

### Execution packet

#### Codex

- [ ] Audit attempt persistence, diagnosis persistence, intervention snapshots, and learner-memory reads
- [ ] Implement missing durable write paths
- [ ] Surface intervention history and status in relevant product surfaces
- [ ] Ensure prior interventions affect future prioritization

#### Claude

- [ ] Execute verification and state-inspection commands
- [ ] Report any mismatch between expected and actual persistence behavior

#### Human

- [ ] Confirm the app now feels like it remembers prior work

### Proof required to close

- [ ] Durable learner-memory path is demonstrated
- [ ] Intervention status is visible
- [ ] Future assignment references previous intervention history

---

## Sprint 8 - Real-Hand Ingestion And Practice-to-Play Transfer

### Status

- Sprint status: `not_started`
- Primary owner: `shared`
- Secondary owner: `human`

### Sprint goal

Make real-play mistakes feed the same coaching system as study misses.

### Must-have outcomes

- [ ] Manual reconstruction flow is strong and believable
- [ ] Practice vs real-play comparison is visible and useful
- [ ] Real-hand review can launch targeted follow-up work
- [ ] Structured import path is implemented or explicitly specified

### Must-do tasks

- [ ] Improve manual reconstruction UX if needed
- [ ] Audit existing real-hand bridge behavior
- [ ] Surface practice vs real-play leak comparison clearly
- [ ] Create targeted follow-up blocks from real hands
- [ ] Define exact-match vs adjacent-transfer vs bridge-reconstruction logic
- [ ] Implement structured import if feasible
- [ ] If not feasible, write exact parser contract and next-step technical path

### Out of scope

- [ ] No bankroll/tracker vanity features

### Validation commands

```bash
pnpm test
pnpm verify
```

### Acceptance gate

- [ ] A real hand produces a believable next assignment
- [ ] The user can see how table mistakes connect to practice work

### Failure conditions

- [ ] Real-hand analysis remains interesting but operationally weak
- [ ] Follow-up blocks from real hands feel generic

### Evidence

- Screens reviewed:
- Test flows:
- Import samples:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 9

- Not written yet

### Execution packet

#### Codex

- [ ] Define exact real-hand flow acceptance criteria
- [ ] Tighten reconstruction and follow-up assignment logic
- [ ] Implement structured import if feasible, otherwise define exact contract/docs
- [ ] Ensure practice-vs-real leakage is surfaced clearly

#### Claude

- [ ] Execute real-hand sample flows
- [ ] Prepare parser fixtures or import samples if structured import work proceeds

#### Human

- [ ] Confirm that real hands produce believable next assignments
- [ ] Reject generic transfer logic

### Proof required to close

- [ ] Real hand -> review -> follow-up path demonstrated
- [ ] Practice-vs-real comparison visible
- [ ] Structured import either works or has a precise contract doc

---

## Sprint 9 - Solver-Backed Truth Layer V1

### Status

- Sprint status: `not_started`
- Primary owner: `shared`
- Secondary owner: `human`

### Sprint goal

Introduce credible solver-backed frequency truth where it adds the most coaching value.

### Must-have outcomes

- [ ] `strategy_mix` starts being used meaningfully
- [ ] Frequency teaching appears in selected high-value lanes
- [ ] Missing solver data remains explicit and honest

### Must-do tasks

- [ ] Define minimum viable solver-backed schema usage
- [ ] Select first lanes for solver-backed truth
- [ ] Populate `strategy_mix` where justified
- [ ] Build UI support for honest frequency display
- [ ] Separate authored truth from solver-backed truth clearly

### Out of scope

- [ ] No fake precision
- [ ] No full solver explorer build

### Validation commands

```bash
pnpm validate:canonical
pnpm test
pnpm verify
```

### Acceptance gate

- [ ] Mixed spots no longer rely on vague wording alone
- [ ] Users can see honest frequency guidance

### Failure conditions

- [ ] Solver language appears without solver data
- [ ] Frequency display confuses more than it teaches

### Evidence

- Lanes chosen:
- Content files:
- Screens reviewed:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 10

- Not written yet

### Execution packet

#### Codex

- [ ] Define minimum viable solver-truth contract
- [ ] Select first lanes for `strategy_mix`
- [ ] Implement honest frequency display
- [ ] Preserve clear separation between authored truth and solver truth

#### Claude

- [ ] Help populate carefully bounded solver-backed content fields when inputs are available
- [ ] Validate that no fake precision language slips in

#### Human

- [ ] Approve whether displayed frequencies are honest enough to ship

### Proof required to close

- [ ] `strategy_mix` is populated in selected lanes
- [ ] UI shows frequency guidance honestly
- [ ] Missing solver data is still handled explicitly

---

## Sprint 10 - Coach Debrief, Milestones, And Longitudinal Development

### Status

- Sprint status: `not_started`
- Primary owner: `codex`
- Secondary owner: `human`

### Sprint goal

Make progress over weeks visible, interpretable, and coaching-relevant.

### Must-have outcomes

- [ ] Session debrief quality improves longitudinally
- [ ] Concept mastery and leak-reduction milestones exist
- [ ] Progress metrics are coaching-relevant, not vanity metrics

### Must-do tasks

- [ ] Aggregate weekly/longitudinal patterns
- [ ] Define milestone triggers carefully
- [ ] Surface improvements and unresolved leaks honestly
- [ ] Avoid gamified noise
- [ ] Tie every surfaced metric to coaching meaning

### Out of scope

- [ ] No empty badge systems
- [ ] No progress screens without coaching value

### Validation commands

```bash
pnpm test
pnpm verify
```

### Acceptance gate

- [ ] User can tell what improved this week
- [ ] User can tell what is still unstable

### Failure conditions

- [ ] Milestones feel cosmetic
- [ ] Longitudinal summary remains vague

### Evidence

- Screens reviewed:
- Tests:
- Metrics introduced:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 11

- Not written yet

### Execution packet

#### Codex

- [ ] Define coaching-significant milestone rules
- [ ] Build longitudinal debrief logic
- [ ] Ensure progress metrics are tied to real improvement, not vanity
- [ ] Review all surfaced milestone language for coaching usefulness

#### Claude

- [ ] Suggest milestone/debrief phrasing variants if needed
- [ ] Execute regression verification on longitudinal summary surfaces

#### Human

- [ ] Judge whether weekly progress feels real or fake

### Proof required to close

- [ ] Weekly/longitudinal debrief exists
- [ ] Milestones have coaching meaning
- [ ] Trendlines shown are actionable

---

## Sprint 11 - Breadth Expansion To Serious Daily Rotation

### Status

- Sprint status: `not_started`
- Primary owner: `claude`
- Secondary owner: `codex`

### Sprint goal

Expand breadth enough that daily rotation feels broad, intentional, and resistant to overfitting.

### Must-have outcomes

- [ ] Lane mix improves materially
- [ ] Daily plan rotates through a broader set of trustworthy spots
- [ ] Content growth stays quality-controlled

### Must-do tasks

- [ ] Expand preflop breadth further
- [ ] Expand flop breadth further
- [ ] Expand turn breadth further
- [ ] Expand 3BP coverage
- [ ] Expand 4BP coverage
- [ ] Expand squeeze coverage
- [ ] Expand multiway coverage
- [ ] Expand exploit-specific live cash coverage
- [ ] Use audit CLIs to prioritize weakest coverage
- [ ] Run patch-quality checks on big batches

### Out of scope

- [ ] No random widening not supported by audit output

### Validation commands

```bash
pnpm drill:coverage
pnpm drill:lane-gaps
pnpm drill:followups-audit
pnpm validate:canonical
pnpm verify
```

### Acceptance gate

- [ ] Daily rotation no longer feels trapped in one family
- [ ] Street and pot-type mix are materially healthier
- [ ] Content quality remains high under volume

### Failure conditions

- [ ] Drill count rises but coverage quality remains fake
- [ ] Daily plan still mostly pushes narrow adjacent variants

### Evidence

- Coverage delta:
- Pending batches:
- Review reports:
- Docs updated:

### Blockers

- None recorded yet

### Handoff to Sprint 12

- Not written yet

### Execution packet

#### Codex

- [ ] Use coverage/lane-gap/patch-quality tooling to identify highest-value breadth gaps
- [ ] Review and merge breadth-expansion batches with strict acceptance
- [ ] Ensure rotation logic uses the broader library rather than overfitting old families

#### Claude

- [ ] Produce bounded breadth-expansion batches in priority order from audit output
- [ ] Validate each batch and refine rejected ones

#### Human

- [ ] Approve which gaps are highest-value for live use
- [ ] Reject quantity without truth depth

### Proof required to close

- [ ] Coverage deltas show healthier street/pot/lane mix
- [ ] Daily plan uses broader rotation
- [ ] Large content batches still pass quality gates

---

## Sprint 12 - Elite Readiness Hardening

### Status

- Sprint status: `not_started`
- Primary owner: `shared`
- Secondary owner: `human`

### Sprint goal

Prove, with evidence, whether the product is actually ready to be taken seriously as an elite daily coaching tool.

### Must-have outcomes

- [ ] Full-system audit is complete
- [ ] Daily workflow is credible end to end
- [ ] Real-hand workflow is credible end to end
- [ ] Content breadth is broad enough for sustained use
- [ ] Remaining gaps are known, bounded, and honest

### Must-do tasks

- [ ] Audit daily workflow end to end
- [ ] Audit real-hand workflow end to end
- [ ] Audit content breadth by lane, street, pot type, concept, and coaching depth
- [ ] Audit repo discipline and green pipeline
- [ ] Benchmark strengths vs competitors honestly
- [ ] Write elite-readiness report
- [ ] Define Sprint 13+ based on actual remaining gaps

### Out of scope

- [ ] No narrative inflation
- [ ] No declaring elite readiness without evidence

### Validation commands

```bash
pnpm drill:coverage
pnpm drill:lane-gaps
pnpm drill:followups-audit
pnpm typecheck
pnpm test
pnpm validate:canonical
pnpm verify
```

### Acceptance gate

- [ ] Repo is green
- [ ] Daily coach loop is credible
- [ ] Breadth is no longer obviously thin
- [ ] Real-play transfer is operationally meaningful
- [ ] Remaining weaknesses are specific, not vague

### Failure conditions

- [ ] Product still needs optimism to sound elite
- [ ] One of the core pillars is still obviously weak

### Evidence

- Final audit report:
- Benchmark notes:
- Coverage snapshot:
- Verification results:

### Blockers

- None recorded yet

### Handoff beyond Sprint 12

- Not written yet

### Execution packet

#### Codex

- [ ] Run the final system audit
- [ ] Produce the elite-readiness report
- [ ] Identify exact remaining weaknesses and Sprint 13+ backlog

#### Claude

- [ ] Execute benchmark and verification command packets
- [ ] Help summarize competitor comparisons if needed

#### Human

- [ ] Decide whether the product is truly ready to be judged as elite
- [ ] Refuse optimistic labeling unsupported by evidence

### Proof required to close

- [ ] Final audit report exists
- [ ] Repo is green
- [ ] Breadth, coaching loop, and real-hand transfer are all evidenced
- [ ] Remaining gaps are specific and bounded

---

## Document Relationship To Other Roadmaps

Use the docs this way:

### Strategic north star

- [`COACH_EQUIVALENCE_ROADMAP.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/COACH_EQUIVALENCE_ROADMAP.md )

This explains the high-level transformation from trainer to coach-like system.

### Primary execution roadmap

- [`ELITE_DAILY_COACH_12_SPRINT_PLAN.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/ELITE_DAILY_COACH_12_SPRINT_PLAN.md )

This is the blunt ordered roadmap for the next 12 sprints.

### Working sprint checklist

- [`ELITE_DAILY_COACH_EXECUTION_CHECKLIST.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/ELITE_DAILY_COACH_EXECUTION_CHECKLIST.md )

This is the active working document for implementation.

### Narrower live-cash lens

- [`LIVE_CASH_READINESS_SPRINTS.md`]( /C:/Dev/poker-coach-os/docs/roadmaps/LIVE_CASH_READINESS_SPRINTS.md )

This remains useful, but it is narrower than the 12-sprint plan and should be treated as a supporting lens rather than the master execution sequence.

---

## Final Rule

If these documents ever disagree:

1. repo truth wins
2. the 12-sprint execution plan wins over older narrower sprint docs
3. this checklist must be updated immediately after reality changes
