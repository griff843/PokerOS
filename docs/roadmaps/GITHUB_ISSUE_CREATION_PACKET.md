# Poker OS - GitHub Issue Creation Packet

## Purpose

This packet converts the current roadmap and backlog into an immediate GitHub issue set that matches repo truth as of 2026-03-28.

GitHub is the active execution control plane. These issues are intentionally bounded, deterministic, and scoped for single-PR or tightly related PR sets. Where the initial backlog is stale against code, this packet replaces it with narrower lanes instead of repeating already-completed work.

## Recommended Labels List

Create or confirm these labels in GitHub before creating issues.

### Type

- `type:execution-lane`
- `type:truth-audit`
- `type:content`
- `type:infra`

### Priority

- `priority:p0`
- `priority:p1`
- `priority:p2`

### Area

- `area:persistence`
- `area:ui`
- `area:coaching-engine`
- `area:content`
- `area:api`
- `area:real-hands`

### Phase

- `phase:3-integration`
- `phase:4-coaching`
- `phase:5-real-play`

## Recommended Milestones List

Use current roadmap phases as milestones.

- `Phase 3 - System Integration`
- `Phase 4 - Coaching Intelligence`
- `Phase 5 - Real Play Integration`

## Oversized or Overlapping Lanes

The initial backlog is useful, but several items are stale, oversized, or overlapping against current repo truth.

### Split, merge, or resequence

- Initial Issue 2 (`Harden play session -> DB write path`) is **partially stale but the SQLite gap is real**.
  - `apps/table-sim/src/app/api/attempts/route.ts` exists and play page POSTs to it. Attempts are written to **local JSON** via `persistAttempt()`.
  - `insertAttempt()` exists in `packages/db/src/repository.ts` but is **not called** from the web app. SQLite write path is not connected.
  - **Do not recreate as written.** File a narrow lane: "Wire `insertAttempt()` from the attempt POST route." (Issue #15 audit — 2026-03-28)

- Initial Issue 8 (`Verify and harden SRS update path from web sessions`) is a **confirmed real gap**.
  - `upsertSrs()` exists in `packages/db/src/repository.ts` but is **never called** from the web app. `getAllSrs()` is read but never written back.
  - This is a genuine first-wave lane, not a duplicate. Wire `upsertSrs()` from the attempt POST route after the attempt write path is confirmed. (Issue #15 audit — 2026-03-28)

- Initial Issue 3 (`Verify and wire intervention surface end-to-end`) is too broad.
  - Current repo already has `/app/concepts/[conceptId]/execution`, `/app/training/session/[id]`, intervention APIs, and Command Center integration.
  - If a real defect is found, file a narrow execution lane from audit results instead of opening this as written.

- Initial Issue 4 (`Real-hand loop audit`) and Initial Issue 11 (`Follow-up audit persistence`) overlap heavily and are both stale.
  - Current repo already has `/api/real-hands`, `/api/real-hands/follow-up-session`, `/api/follow-up-audits`, `follow_up_assignment_audits`, persisted audit history, and audit UI.
  - Replace both with a narrower hand-ingestion boundary audit.

- Initial Issue 5 (`Content depth uplift`) and Initial Issue 9 (`Gold lane expansion`) are stale in their current wording.
  - The repo already has a large gold live-cash file at [live_cash_gold_btn_bb_river.json](/C:/Users/griff/poker-coach-os/content/drills/live_cash_gold_btn_bb_river.json) with rich coaching fields and sibling turn-to-river families.
  - Replace with an audit of non-gold active-lane content coverage, then a bounded fill lane.

- Initial Issue 6 (`Surface diagnostic reasoning prompts in the play UI`) is **partially stale but the core gap is real**.
  - `CoachingPanel.tsx` has a generic `setDiagnostic()` callback that captures user-selected coaching frames.
  - However, `drill.diagnostic_prompts[]` (authored per-drill reasoning prompts) are **never rendered** in the play UI. The `setDiagnostic()` path is unrelated to authored drill data.
  - **Do not recreate as written.** File a narrow lane: "Wire `drill.diagnostic_prompts[]` into the play feedback step." (Issue #15 audit — 2026-03-28)

- Initial Issue 10 (`Align roadmap phase numbering`) is valid but low priority.
  - Keep it late; do not let it outrank execution lanes tied to coaching depth.

## Recommended Issue Creation Order

Create issues in this order:

1. `[AUDIT] Reconcile gap tracker and initial backlog against repo truth`
2. `[LANE] Daily study plan -> prefilled session launch bridge`
3. `[AUDIT] Audit active-lane drill truth coverage outside the gold live-cash lane`
4. `[LANE] Fill active-lane drill truth gaps for coaching_context, action_history, and diagnostics`
5. `[LANE] Surface value/bluff bucket visualization from existing range_support`
6. `[LANE] Practice vs real-play comparison hardening on Hands and Command Center`
7. `[AUDIT] Hand ingestion boundary audit and parser split plan`
8. `[LANE] PokerStars import hardening and unsupported-format diagnostics`
9. `[LANE] Learner identity and persistence hardening`
10. `[LANE] Mixed-strategy framing for authored drills and coaching surfaces`

## First 3 Execution Lanes

These are the exact first three issues to create and execute.

1. `[AUDIT] Reconcile gap tracker and initial backlog against repo truth`
2. `[LANE] Daily study plan -> prefilled session launch bridge`
3. `[AUDIT] Audit active-lane drill truth coverage outside the gold live-cash lane`

Rationale:

- Issue 1 removes stale execution drift before more GitHub work accumulates.
- Issue 2 closes a visible product coherence gap that still exists in live code.
- Issue 3 prevents content work from widening blindly now that one lane is strong and others are uneven.

## Final Issue Bodies

### Issue 1

**Final title**

`[AUDIT] Reconcile gap tracker and initial backlog against current repo truth`

**Labels**

- `type:truth-audit`
- `priority:p0`
- `area:persistence`
- `area:coaching-engine`
- `phase:3-integration`

**Milestone / roadmap phase**

`Phase 3 - System Integration`

**Problem**

`COACH_EQUIVALENCE_GAP_TRACKER.md` and `INITIAL_GITHUB_BACKLOG.md` are no longer fully aligned with code truth. Several previously-missing capabilities now exist in routes, tables, or UI surfaces, which means the current backlog would create stale or duplicate GitHub issues.

**In scope**

- Audit every row in `COACH_EQUIVALENCE_GAP_TRACKER.md` marked `Missing` or `Partial`
- Audit every issue in `INITIAL_GITHUB_BACKLOG.md` against current repo truth
- For each stale claim, add the exact file, route, or migration that proves current state
- Update `COACH_EQUIVALENCE_GAP_TRACKER.md` to reflect actual repo truth
- Update `INITIAL_GITHUB_BACKLOG.md` or replace it with a note pointing to this packet if needed
- File only narrow follow-on issues for genuinely incomplete capabilities

**Out of scope**

- Implementing missing capabilities
- Redesigning roadmap phases
- Refactoring working code solely to match docs

**Acceptance criteria**

- [ ] Every `Missing` and `Partial` row in `COACH_EQUIVALENCE_GAP_TRACKER.md` has been verified against code
- [ ] Every stale initial-backlog issue is explicitly marked stale, replaced, merged, or kept with a current rationale
- [ ] Updated docs cite exact repo proof for changed status claims
- [ ] No first-wave GitHub issue remains based on already-complete work

**Proof / verification**

- Reviewer can open the updated gap tracker and backlog docs and trace each changed claim to a repo file, route, or migration

**Dependencies / blockers**

- None

---

### Issue 2

**Final title**

`[LANE] Daily study plan -> prefilled session launch bridge`

**Labels**

- `type:execution-lane`
- `priority:p1`
- `area:ui`
- `area:coaching-engine`
- `area:api`
- `phase:4-coaching`

**Milestone / roadmap phase**

`Phase 4 - Coaching Intelligence`

**Problem**

The daily plan exists at `/api/daily-study-plan` and the UI exists at `/app/daily`, but the primary CTA still routes generically to `/app/session`. The daily plan does not yet launch a session with the plan's focus, count, or block intent pre-applied, which creates coaching drift between recommendation and execution.

**In scope**

- Audit the current daily plan CTA flow in `apps/table-sim/src/components/daily/DailyStudyPlan.tsx`
- Add a deterministic bridge from the selected daily plan block to session configuration or direct session launch
- Carry at least the recommended drill count and focus concept/session intent into the launched session
- Ensure the launched session plan respects the passed focus when present
- Add tests for the bridge behavior

**Out of scope**

- Redesigning daily plan generation
- Adding new daily plan block kinds
- Reworking Command Center recommendations

**Acceptance criteria**

- [ ] Clicking the daily plan primary CTA no longer drops the user into a generic session with no plan context
- [ ] The launched session reflects the selected daily plan's intended focus and count
- [ ] The session plan remains valid when no daily-plan override is supplied
- [ ] Tests cover the new bridge behavior
- [ ] `pnpm verify` passes

**Proof / verification**

- Test output for the daily-plan launch bridge
- Manual walkthrough: `/app/daily` -> start plan -> session reflects the chosen daily focus

**Dependencies / blockers**

- Issue 1 recommended first

---

### Issue 3

**Final title**

`[AUDIT] Audit active-lane drill truth coverage outside the gold live-cash lane`

**Labels**

- `type:truth-audit`
- `priority:p1`
- `area:content`
- `phase:4-coaching`

**Milestone / roadmap phase**

`Phase 4 - Coaching Intelligence`

**Problem**

The repo now has a deep gold live-cash lane, but active content outside that lane is uneven. The current roadmap still speaks broadly about missing `action_history`, `coaching_context`, and diagnostics, but those claims are no longer true for the gold lane and may still be true elsewhere. Engineering needs a current coverage audit before opening more content lanes.

**In scope**

- Audit loaded drills outside the gold live-cash lane for:
  - `scenario.action_history`
  - `coaching_context`
  - `range_support`
  - `diagnostic_prompts`
- Produce a bounded summary by lane or file family
- Identify which active lanes are safe to use in product surfaces versus still schema-thin
- Recommend the minimum next fill lane from current truth

**Out of scope**

- Authoring or editing drill content
- Expanding the gold lane further
- UI changes

**Acceptance criteria**

- [ ] Coverage audit completed for active non-gold drill families
- [ ] Audit output names the exact lane/file groups with missing truth fields
- [ ] Gold live-cash lane is explicitly separated from weaker content families
- [ ] Follow-on content lane(s) are narrowed from audit evidence, not assumptions

**Proof / verification**

- Audit doc or report committed to `docs/roadmaps/` or `out/reports/`
- Reviewer can trace each cited gap to a specific content file

**Dependencies / blockers**

- Issue 1 recommended first

---

### Issue 4

**Final title**

`[LANE] Fill active-lane drill truth gaps for coaching_context, action_history, and diagnostics`

**Labels**

- `type:execution-lane`
- `type:content`
- `priority:p1`
- `area:content`
- `phase:4-coaching`

**Milestone / roadmap phase**

`Phase 4 - Coaching Intelligence`

**Problem**

Outside the gold live-cash lane, active drill families are not uniformly rich enough to support the coaching surfaces already in the app. This creates inconsistent teaching quality: some drills render real coaching truth, others render empty or thin states.

**In scope**

- Use the output of Issue 3 to choose one bounded non-gold lane or file family
- Add missing `scenario.action_history`
- Add missing `coaching_context` fields needed by current surfaces
- Add `diagnostic_prompts` only where the lane already has enough authored truth to support them
- Validate with repo authoring/loader workflow before merge

**Out of scope**

- Creating a new lane family
- Broad content expansion across unrelated nodes
- Mixed-strategy authoring

**Acceptance criteria**

- [ ] Chosen lane/file family is explicitly named in the issue before work starts
- [ ] Updated drills load cleanly with `pnpm content:init`
- [ ] Updated drills render current coaching surfaces without empty truth sections
- [ ] Validation/review commands pass for the touched content
- [ ] `pnpm verify` passes

**Proof / verification**

- `pnpm content:init`
- Content validation output
- Reviewer can open the updated drills and see the added fields

**Dependencies / blockers**

- Issue 3

---

### Issue 5

**Final title**

`[LANE] Surface value/bluff bucket visualization from existing range_support`

**Labels**

- `type:execution-lane`
- `priority:p1`
- `area:ui`
- `area:coaching-engine`
- `phase:4-coaching`

**Milestone / roadmap phase**

`Phase 4 - Coaching Intelligence`

**Problem**

The app already has authored `range_support` for the strongest lane and already renders parts of it, but the gap tracker still correctly says visible combo ranges and value/bluff bucket visualization are incomplete. The current surfaces do not yet make the value region, bluff region, and threshold boundary consistently legible across the coaching flow.

**In scope**

- Audit where `range_support` is already rendered in play/review surfaces
- Add explicit bucket visualization for value/bluff/call-down regions using existing authored data
- Keep rendering honest when data is absent
- Reuse current authored fields; do not invent solver frequencies
- Add tests for the new visualization states

**Out of scope**

- Authoring new content
- Solver-frequency products
- New route creation

**Acceptance criteria**

- [ ] At least one existing coaching surface renders explicit value/bluff bucket groups from `range_support`
- [ ] Missing-data states stay explicit and honest
- [ ] Tests cover rendered bucket sections
- [ ] `pnpm verify` passes

**Proof / verification**

- Component test output
- Reviewer can open the affected surface and see explicit bucket grouping from authored data

**Dependencies / blockers**

- Issue 4 recommended first for non-gold lanes; can proceed immediately for the current gold lane

---

### Issue 6

**Final title**

`[LANE] Practice vs real-play comparison hardening on Hands and Command Center`

**Labels**

- `type:execution-lane`
- `priority:p1`
- `area:real-hands`
- `area:ui`
- `phase:5-real-play`

**Milestone / roadmap phase**

`Phase 5 - Real Play Integration`

**Problem**

The repo already generates real-hand follow-up recommendations, assignment audits, and Hands/Command Center surfaces. The remaining gap is not existence but clarity: practice-vs-real-play comparison is still partial and not yet strong enough to reliably show where live evidence agrees or diverges from study performance.

**In scope**

- Audit existing comparison signals in `real-hands.ts`, Hands UI, and Command Center
- Make the comparison between study evidence and real-play evidence explicit for the selected hand/concept
- Keep the comparison deterministic and data-backed
- Add tests for the new comparison snapshot or UI state

**Out of scope**

- New parser formats
- New content authoring
- Intervention algorithm redesign

**Acceptance criteria**

- [ ] Hands or Command Center clearly shows practice-vs-real-play comparison for at least the selected hand/concept
- [ ] Comparison language is grounded in existing data, not heuristic filler
- [ ] Tests cover the comparison state
- [ ] `pnpm verify` passes

**Proof / verification**

- Test output for comparison snapshot/surface
- Manual walkthrough in `/app/hands` and/or Command Center

**Dependencies / blockers**

- Issue 1 recommended first

---

### Issue 7

**Final title**

`[AUDIT] Hand ingestion boundary audit and parser split plan`

**Labels**

- `type:truth-audit`
- `priority:p1`
- `area:real-hands`
- `phase:5-real-play`

**Milestone / roadmap phase**

`Phase 5 - Real Play Integration`

**Problem**

The repo supports manual reconstruction and a focused import path, but roadmap language still treats ingestion too broadly. Before adding more parser work, GitHub needs a precise audit of what formats are truly supported, where failures surface, and how to split future parser work into bounded lanes.

**In scope**

- Audit current ingestion paths in:
  - manual reconstruction
  - current text import route
  - unsupported-format behavior
- Name the exact supported path(s) and unsupported path(s)
- Document where parser limitations surface in API/UI
- Produce a bounded split plan for future parser issues

**Out of scope**

- Implementing new parsers
- Redesigning the Hands UI
- Real-play comparison work

**Acceptance criteria**

- [ ] Supported ingestion paths are explicitly documented from code truth
- [ ] Unsupported paths and failure modes are explicitly documented
- [ ] Follow-on parser work is split into bounded lanes, not one broad import epic
- [ ] Audit output is committed and reviewable

**Proof / verification**

- Audit report with file and route references

**Dependencies / blockers**

- Issue 1 recommended first

---

### Issue 8

**Final title**

`[LANE] PokerStars import hardening and unsupported-format diagnostics`

**Labels**

- `type:execution-lane`
- `priority:p2`
- `area:real-hands`
- `area:api`
- `phase:5-real-play`

**Milestone / roadmap phase**

`Phase 5 - Real Play Integration`

**Problem**

The current import path is intentionally narrow. Before widening parser support, the existing PokerStars-oriented path should fail cleanly and explain unsupported input deterministically so engineering and users can trust what was or was not ingested.

**In scope**

- Harden the existing supported text-import path
- Improve unsupported-format diagnostics at the API/UI boundary
- Ensure import notes clearly distinguish parse failure, partial parse, and unsupported format
- Add tests for supported and unsupported cases

**Out of scope**

- HM/PT parser implementation
- OCR or image-based hand ingestion
- Real-play coaching logic changes

**Acceptance criteria**

- [ ] Supported PokerStars-style input still imports successfully
- [ ] Unsupported input returns deterministic diagnostics instead of a generic failure
- [ ] Tests cover at least one supported and one unsupported import case
- [ ] `pnpm verify` passes

**Proof / verification**

- Import-path test output
- Manual API response sample for unsupported input

**Dependencies / blockers**

- Issue 7

---

### Issue 9

**Final title**

`[LANE] Learner identity and persistence hardening`

**Labels**

- `type:execution-lane`
- `priority:p1`
- `area:persistence`
- `area:coaching-engine`
- `phase:3-integration`

**Milestone / roadmap phase**

`Phase 3 - System Integration`

**Problem**

The repo has deep persistence tables and cross-session memory, but learner identity is still local-first and partially hardcoded. That leaves the gap tracker's `Persistent learner model` row correctly marked partial.

**In scope**

- Audit where learner identity is derived and where `local_user` assumptions still exist
- Replace hardcoded identity assumptions with one deterministic local identity path
- Ensure persisted coaching artifacts and follow-up audits are consistently tied to that identity
- Add tests where identity-sensitive writes are expected

**Out of scope**

- Multi-user auth redesign
- Cloud sync
- Session UI redesign

**Acceptance criteria**

- [ ] Hardcoded learner identity assumptions are removed from active persistence paths
- [ ] Cross-session artifacts are consistently associated with one deterministic learner identity
- [ ] Tests cover the identity-sensitive persistence path
- [ ] `pnpm verify` passes

**Proof / verification**

- Test output plus reviewer confirmation in the affected persistence helpers

**Dependencies / blockers**

- Issue 1 recommended first

---

### Issue 10

**Final title**

`[LANE] Mixed-strategy framing for authored drills and coaching surfaces`

**Labels**

- `type:execution-lane`
- `type:content`
- `priority:p2`
- `area:content`
- `area:ui`
- `phase:4-coaching`

**Milestone / roadmap phase**

`Phase 4 - Coaching Intelligence`

**Problem**

The gap tracker still correctly marks mixed-strategy framing as partial. The app is strongest at deterministic threshold coaching, but it still needs bounded, honest handling for authored spots where the right answer is mixed or intentionally uncertain.

**In scope**

- Audit which current drills already contain enough authored truth to support mixed-strategy framing
- Add honest mixed-strategy framing to one bounded content family and its current coaching surface
- Keep language qualitative and non-solver-precise unless the content explicitly supports more
- Add tests for the new mixed-framing rendering/state

**Out of scope**

- Solver integration
- Frequency dashboards
- Broad mixed-strategy authoring across all content

**Acceptance criteria**

- [ ] One bounded drill family supports explicit mixed-strategy or threshold-borderline framing
- [ ] Surface language stays honest and avoids fake precision
- [ ] Tests cover the new rendering/state
- [ ] `pnpm verify` passes

**Proof / verification**

- Component/content test output
- Reviewer can open the affected drill family and see explicit mixed-framing

**Dependencies / blockers**

- Issue 4 recommended first

## GitHub UI Actions

These still need to be done manually in GitHub:

- Create or confirm all labels listed in `Recommended Labels List`
- Create or confirm milestones:
  - `Phase 3 - System Integration`
  - `Phase 4 - Coaching Intelligence`
  - `Phase 5 - Real Play Integration`
- Create issues from the final issue bodies in this packet
- Apply the exact labels and milestone per issue
- After creation, link follow-on issues to the audits they depend on

## Final Recommended Issue Order

1. `[AUDIT] Reconcile gap tracker and initial backlog against current repo truth`
2. `[LANE] Daily study plan -> prefilled session launch bridge`
3. `[AUDIT] Audit active-lane drill truth coverage outside the gold live-cash lane`
4. `[LANE] Fill active-lane drill truth gaps for coaching_context, action_history, and diagnostics`
5. `[LANE] Surface value/bluff bucket visualization from existing range_support`
6. `[LANE] Practice vs real-play comparison hardening on Hands and Command Center`
7. `[AUDIT] Hand ingestion boundary audit and parser split plan`
8. `[LANE] PokerStars import hardening and unsupported-format diagnostics`
9. `[LANE] Learner identity and persistence hardening`
10. `[LANE] Mixed-strategy framing for authored drills and coaching surfaces`

## Biggest Remaining Source of Drift

The biggest remaining source of drift is still documentation and backlog language lagging behind the current repo. The code now contains deeper real-hand, assignment-audit, and gold-lane infrastructure than the older backlog assumes, so GitHub work must start with a truth audit or it will recreate already-complete lanes and miss the actual bottlenecks.

## What Engineering Should Execute First

Engineering should execute Issue 1 first:

`[AUDIT] Reconcile gap tracker and initial backlog against current repo truth`

Then execute Issue 2 immediately after:

`[LANE] Daily study plan -> prefilled session launch bridge`

That pair gives the team the cleanest control plane and the clearest product-level next win without widening scope.
