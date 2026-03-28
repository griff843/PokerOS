# Poker OS — Initial GitHub Backlog

This is the first canonical GitHub backlog for Poker OS. It defines the execution-ready issues that translate the `COACH_EQUIVALENCE_GAP_TRACKER.md` findings and `MASTER_ROADMAP.md` Phase 3–5 scope into bounded, verifiable GitHub work items. GitHub is the active execution control plane — this document is the source for creating issues in the GitHub UI.

These 11 issues are ordered by execution priority. Create them using the templates in `.github/ISSUE_TEMPLATE/`. Set up labels and milestones (listed at the bottom) before creating any issues.

Issues 1–4 are required by the PM system spec. Issues 5–11 are the next logical follow-on lanes from repo truth.

---

## Post-Audit Status (Issue #15 — 2026-03-28)

Issue #15 truth audit reconciled all 11 issues against current repo code. See `out/reports/issue-15-truth-audit.md` for full evidence. The canonical forward-looking issue set is now in `GITHUB_ISSUE_CREATION_PACKET.md`.

| # | Title | Audit Status |
|---|-------|-------------|
| 1 | Truth audit — gap tracker reconciliation | **EXECUTED** — completed as Issue #15 |
| 2 | Harden play session → DB write path | **NARROWED** — `/api/attempts` POST exists; attempts persist to local JSON. `insertAttempt()` in repository.ts not called from web app. Real gap: wire SQLite write path. |
| 3 | Verify and wire intervention surface end-to-end | **NARROWED** — routes, pages, and DB tables exist. Real gap: play session → `coaching_diagnoses` write chain not wired. |
| 4 | Real-hand loop audit | **SUPERSEDED** — pipeline substantially implemented. Follow-up session writes to `follow_up_assignment_audits`. See Issue 7 in creation packet. |
| 5 | Content depth uplift — gold-lane drills | **SUPERSEDED** — gold lane already has `action_history` and `coaching_context`. Gap is non-gold lanes. See Issues 3+4 in creation packet. |
| 6 | Surface diagnostic reasoning prompts in play UI | **VALID** — `drill.diagnostic_prompts[]` never rendered. `CoachingPanel.tsx` has generic `setDiagnostic()` unrelated to authored prompts. Confirmed real gap. |
| 7 | Daily study plan → session plan bridge | **VALID** — confirmed gap. Maps to Issue 2 in creation packet. |
| 8 | Verify and harden SRS update path | **VALID** — `upsertSrs()` exists in repository.ts but never called from web app. Confirmed real gap. |
| 9 | Gold lane expansion — adjacent turn/river | **SUPERSEDED** — adjacent families already exist. See Issues 3+4 in creation packet. |
| 10 | Align roadmap phase numbering | **VALID, low priority** — doc alignment, no code impact. |
| 11 | Follow-up audit persistence | **SUPERSEDED** — `createFollowUpAssignmentAudit()` called from `/api/real-hands/follow-up-session`. Write path confirmed. |

**Forward-looking execution order:** Use `GITHUB_ISSUE_CREATION_PACKET.md` as the active backlog.

---

## Issue 1 — [AUDIT] Reconcile gap tracker against route and DB truth

**Template:** truth_audit
**Labels:** `type:truth-audit`, `priority:p0`, `area:persistence`
**Milestone:** Phase 3 — System Integration

### Problem

`COACH_EQUIVALENCE_GAP_TRACKER.md` contains multiple rows that appear to be stale against actual code. The gap tracker drives prioritization — if it is wrong, the execution order is wrong.

Known divergences before this audit:
- "Persistent session attempts" is listed as **Missing**, but `packages/db/src/migrations.ts` has an `attempts` table with `correct_bool`, `score`, `confidence`, `missed_tags_json`, and `active_pool` columns. `/api/attempts/route.ts` also exists.
- "Intervention planning" is listed as **Missing**, but `/app/app/concepts/[conceptId]/execution/page.tsx` and `/app/app/training/session/[id]/page.tsx` both exist.
- "Persistent review queue" is listed as **Missing**, but `/api/review-queue/route.ts` exists.
- "Cross-session coaching memory" is listed as **Missing**, but `coaching_diagnoses`, `coaching_interventions`, `intervention_decision_snapshots`, `transfer_evaluation_snapshots`, and `retention_schedules` tables all exist in migrations.

### In Scope

- Walk every "Missing" and "Partial" row in the gap tracker
- For each: identify the route, table, or component that implements it (if any)
- Update the gap tracker row to reflect code truth: Complete / Partial / Missing
- Add a note on each Partial row explaining what is incomplete
- File a follow-on execution lane issue for each genuinely missing capability

### Out of Scope

- Implementing any missing capability (that goes in follow-on issues)
- Changing any code
- Updating MASTER_ROADMAP phases

### Acceptance Criteria

- [ ] Every "Missing" row in the gap tracker has been verified against code
- [ ] Every "Partial" row has a note describing what specifically is incomplete
- [ ] Gap tracker updated to reflect code truth as of this audit
- [ ] Follow-on execution lane issues filed for each genuinely missing or incomplete capability
- [ ] No row remains "Missing" without either a code pointer proving it exists or a linked issue proving it is planned

### Proof / Verification

Reviewer reads the updated gap tracker and can verify each row change by opening the cited file or route.

### Dependencies / Blockers

None — this unblocks everything else.

---

## Issue 2 — [LANE] Harden play session → DB write path

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p0`, `area:persistence`, `area:api`, `phase:3-integration`
**Milestone:** Phase 3 — System Integration

### Problem

The play session (`/app/play`) writes attempts to React state (via `useReducer`) during a drill session. It is not confirmed that these attempts are persisted to SQLite via `/api/attempts` after each drill or at session end. If the write path is broken or missing, coaching memory never updates across sessions — the Command Center, intervention engine, and retention system all operate on stale or empty data.

### In Scope

- Audit `apps/table-sim/src/app/app/play/page.tsx` for calls to `/api/attempts`
- If the write is missing, implement a POST to `/api/attempts` after each drill attempt is committed
- Verify the write includes: `drill_id`, `session_id`, `selected_action`, `confidence`, `correct_bool`, `score`, `elapsed_ms`, `missed_tags_json`, `active_pool`
- Verify that after a 10-drill session, `getAllAttempts()` returns the new rows
- Add a test that simulates a session write and confirms DB persistence

### Out of Scope

- SRS updates (covered in Issue 8)
- Diagnosis persistence (that is a separate write path)
- Daily study plan persistence
- Any UI changes to the play surface

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] After completing a drill session in the web app, `getAllAttempts()` returns rows for each attempt with correct `drill_id`, `score`, `correct_bool`, and `missed_tags_json`
- [ ] `session_id` is populated consistently so attempts can be grouped into a session
- [ ] Test added: simulates a session and verifies DB write output
- [ ] `/api/attempts` returns 201 on success, not a silent no-op

### Proof / Verification

Test output from `pnpm vitest run` covering the new session persistence test.

### Dependencies / Blockers

Issue 1 (truth audit) recommended first to confirm the exact gap, but this can proceed in parallel.

---

## Issue 3 — [LANE] Verify and wire intervention surface end-to-end

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p1`, `area:ui`, `area:coaching-engine`, `phase:4-coaching`
**Milestone:** Phase 4 — Coaching Intelligence

### Problem

The intervention infrastructure exists (blueprint builder, execution route, training session page, concept execution page) but the end-to-end flow has not been verified as a complete loop: Command Center recommends an intervention → user opens training session → completes drills → attempts persisted → intervention status updated → Command Center reflects the change.

The link `recommendedTrainingBlock.href = /app/training/session/${interventionPlan.id}` in the Command Center snapshot may resolve to a page that does not correctly wire the plan into a playable session, or the attempt writes from that session may not update the intervention status.

### In Scope

- Trace the full loop: Command Center → training session → play → attempt write → intervention update
- Identify any broken link in the chain (missing API call, missing status update, missing route handler)
- Fix any broken link found within this scope
- Verify that after completing a recommended training session, `getUserInterventions()` returns an updated status for the target concept key
- Add a test covering the intervention status update after session completion

### Out of Scope

- New intervention recommendation logic (coaching engine is not in scope)
- UI redesign of the training session page
- Retention scheduling updates
- Range visualization

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] Navigating to `/app/training/session/[id]` from the Command Center loads a playable session plan for the correct concept
- [ ] After completing the session, the intervention row in `coaching_interventions` has an updated `status`
- [ ] The Command Center's `interventions.active` section reflects the change on next load
- [ ] Test added verifying the intervention update path

### Proof / Verification

Manual walkthrough: Command Center → start recommended session → complete drills → return to Command Center → confirm intervention status changed. Plus test output.

### Dependencies / Blockers

Issue 2 (play session write path) must be confirmed working first.

---

## Issue 4 — [AUDIT] Real-hand loop audit — import to follow-up session to coaching memory

**Template:** truth_audit
**Labels:** `type:truth-audit`, `priority:p1`, `area:real-hands`, `area:persistence`, `phase:5-real-play`
**Milestone:** Phase 5 — Real Play Integration

### Problem

The real-hand workflow is the most complex loop in the system:

1. Hand imported via `/app/hands` → `imported_hands` table
2. Follow-up session plan built via `createRealHandFollowUpSessionPlan`
3. Plan surfaced in Command Center via `followUpMonitor`
4. User starts a follow-up session → play surface
5. Attempts persisted to DB with `session_id` tied to the source hand
6. Follow-up assignment audit written to `follow_up_assignment_audits` table
7. Command Center reloads and reflects the completed follow-up

The gap tracker claims "Real-play leak analysis" is **Missing**. The code has `/app/app/hands/page.tsx`, `real-hand-persistence.ts`, `real-hands.ts`, `real-hand-bridge.ts`, and `real-hand-review-block.ts`. The actual gap is unclear.

### Stale / Unverified Claim

`COACH_EQUIVALENCE_GAP_TRACKER.md`: "Real-play leak analysis | Missing"

But the following files exist:
- `apps/table-sim/src/lib/real-hands.ts`
- `apps/table-sim/src/lib/real-hand-persistence.ts`
- `apps/table-sim/src/lib/real-hand-bridge.ts`
- `apps/table-sim/src/app/api/real-hands/route.ts`
- `apps/table-sim/src/app/api/real-hands/follow-up-session/route.ts`
- `apps/table-sim/src/app/api/real-hand-review-block/route.ts`
- `apps/table-sim/src/app/app/hands/page.tsx`

### Audit Steps

1. Read `real-hand-persistence.ts` — what does it write to DB and when?
2. Read `/api/real-hands/route.ts` — what does GET return vs what does POST write?
3. Read `/api/real-hands/follow-up-session/route.ts` — does it launch a playable session?
4. Confirm that follow-up session attempts are tagged with source hand metadata
5. Check `follow_up_assignment_audits` table — is it being written to after sessions, not just read?
6. Confirm `buildRealHandsSnapshot` output actually surfaces practice vs real-play comparison data

### Expected Outcome

Gap tracker updated per finding. If the loop is broken at any step, file a follow-on execution lane issue for each broken link. If the loop is complete, mark "Real-play leak analysis" as Partial (manual import only, no PokerTracker/HM2 ingestion) and document the actual limitation.

### Dependencies / Blockers

Issue 1 (general gap tracker audit) should run first but this can proceed in parallel given its specificity.

---

## Issue 5 — [LANE] Content depth uplift — add action_history and coaching_context to gold-lane drills

**Template:** execution_lane
**Labels:** `type:execution-lane`, `type:content`, `priority:p1`, `area:content`, `phase:4-coaching`
**Milestone:** Phase 4 — Coaching Intelligence

### Problem

The coaching engine surfaces `coaching_context` fields (range notes, common mistakes, what changed by street) and `action_history` in drill detail views. Most existing drills in the gold live-cash lane do not populate these fields. The UI is ready for this information, but drills feed it empty data, so the coaching layer cannot teach from real strategic truth.

Per COACH_EQUIVALENCE_ROADMAP.md Phase 8: "The UI is ready for this information, but the drills rarely supply it."

### In Scope

- Audit the current gold-lane drills (BTN vs BB SRP river bluff-catch family + sibling lanes) for missing `action_history`, `coaching_context.range_notes`, `coaching_context.common_mistakes`, and `coaching_context.what_changed_by_street`
- Author these fields for drills that are missing them, using the gold-lane authoring workflow (`docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`)
- Stage under `out/reports/gold-lane-reviews/pending/` and validate with `node scripts/validate-gold-lane.mjs`
- Merge only after validator passes and review passes

### Out of Scope

- Adding new drills (that is a separate content lane)
- `strategy_mix` / solver frequency fields (no solver data available yet)
- Changes to the coaching engine or UI components

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] All gold-lane river bluff-catch drills have `action_history` populated
- [ ] All gold-lane drills have at least one `coaching_context.common_mistakes` entry
- [ ] Validator passes: `node scripts/validate-gold-lane.mjs --mode=batch <path>`
- [ ] Review passes: `pnpm review:gold-batch`
- [ ] `pnpm content:init` loads the updated drills without errors

### Proof / Verification

Validator output + `pnpm content:init` run showing drill count loaded cleanly.

### Dependencies / Blockers

None — this is content authoring, not code change.

---

## Issue 6 — [LANE] Surface diagnostic reasoning prompts in the play UI

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p1`, `area:ui`, `area:coaching-engine`, `phase:4-coaching`
**Milestone:** Phase 4 — Coaching Intelligence

### Problem

Drills support `diagnostic_prompts[]` in the schema (with `type`, `prompt`, `expected_reasoning`, and `options[].diagnosis`). The `DrillAttempt` type has a `diagnostic` field that captures the result. However, it is unclear whether the play surface (`/app/play`) actually renders diagnostic prompts during a session and writes the result to the attempt.

If diagnostic prompts are not surfaced, the `coaching_diagnoses` table never receives entries from schema-level diagnostic data, and the coaching engine cannot classify misunderstandings.

### In Scope

- Audit `play/page.tsx` and the play components for diagnostic prompt rendering
- If the prompts are not rendered: add a post-decision diagnostic prompt step in the play flow for drills that have `diagnostic_prompts`
- Write the selected diagnostic option to the attempt as `diagnostic.result.errorType` and `diagnostic.result.conceptKey`
- Persist the diagnosis to `coaching_diagnoses` via the existing `/api/attempts` or a new diagnosis write
- Add a test verifying that a drill with a diagnostic prompt produces a `coaching_diagnoses` row after completion

### Out of Scope

- Authoring new diagnostic prompts on drills (content lane)
- Changing the diagnostic scoring logic
- Misunderstanding classification visualization (that's a separate surface)

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] A drill with `diagnostic_prompts` shows a follow-up question after the action decision
- [ ] Selecting a diagnostic option writes `errorType` to the attempt
- [ ] `getUserDiagnosisHistory()` returns entries after a session with diagnostic drills
- [ ] Test added covering diagnostic capture and persistence

### Proof / Verification

Test output + manual confirmation that the diagnostic prompt appears in the play flow for a drill that has one.

### Dependencies / Blockers

Issue 2 (play session write path) must be wired before this.

---

## Issue 7 — [LANE] Daily study plan → session plan bridge

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p2`, `area:coaching-engine`, `area:api`, `phase:4-coaching`
**Milestone:** Phase 4 — Coaching Intelligence

### Problem

The daily study plan (`/api/daily-study-plan`) and the session plan (`/api/session-plan`) are computed independently. The daily plan produces a structured block (focus_concept, execute_intervention, retention_check, etc.) but does not directly feed the session plan selector. The user sees a daily plan recommendation on one page and a session configuration on another, with no link between them.

This creates a coaching coherence gap: the daily plan says "focus on river bluff-catching" but the session plan is re-derived from scratch and may suggest something different.

### In Scope

- Audit whether `createTableSimSessionPlan` accepts or respects daily plan output
- If not: add a `preferredConceptKey` or `dailyPlanOverride` parameter to the session plan builder
- Wire the daily study plan's `focus_concept` block to pre-populate the session config on `/app/session`
- The daily plan's recommended session length should pre-populate the drill count selector

### Out of Scope

- Redesigning the daily study plan algorithm
- Adding new block types to the daily plan
- Changing the SRS algorithm

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] Clicking "Start Session" from the daily plan page opens the session configuration pre-populated with the daily plan's focus concept and count
- [ ] The session plan respects the daily plan's `focus_concept` when provided
- [ ] No regression in the existing daily study plan tests (29 tests must still pass)

### Proof / Verification

Manual walkthrough: daily plan shows "focus on river bluff-catching" → Start Session → session config pre-filled with river bluff-catch drills.

### Dependencies / Blockers

Issue 2 (write path) should be confirmed first to avoid testing on a broken persistence layer.

---

## Issue 8 — [LANE] Verify and harden SRS update path from web sessions

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p1`, `area:persistence`, `area:api`, `phase:3-integration`
**Milestone:** Phase 3 — System Integration

### Problem

The SRS table (`srs`) drives due-review selection in the session planner. The CLI updates SRS after each attempt. It is not confirmed that the web play session updates SRS via the same path. If SRS is not updated from web sessions, the session planner has no signal to schedule review — every drill is always treated as new, and the coaching system cannot detect mastery.

### In Scope

- Audit `/api/attempts/route.ts` — does it call `updateSrs()` or equivalent after writing an attempt?
- Audit `getAllSrs()` usage in `loadLocalStudyData()` — is it reading fresh data after a session?
- If SRS is not being updated from web: add the SRS update to the attempt write path
- Add a test: write a "correct" attempt, verify the SRS row for that drill_id has an updated `next_review_at`

### Out of Scope

- Changing the SM-2 algorithm
- Pool-aware SRS (separate issue)
- Review queue UI changes

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] After writing a correct attempt via `/api/attempts`, `getAllSrs()` returns an updated row for the drill
- [ ] After writing an incorrect attempt, the SRS row reflects the regression schedule
- [ ] Test added verifying SRS update on attempt write

### Proof / Verification

Test output showing SRS rows update correctly after simulated attempts.

### Dependencies / Blockers

Issue 2 (play session write path) — SRS update should be part of the same atomic write.

---

## Issue 9 — [LANE] Gold lane expansion — adjacent turn/river lane family

**Template:** execution_lane
**Labels:** `type:execution-lane`, `type:content`, `priority:p1`, `area:content`, `area:real-hands`, `phase:3-integration`
**Milestone:** Phase 3 — System Integration

### Problem

Per `LIVE_CASH_READINESS_SPRINTS.md` Sprint 2: the system currently has one strong gold lane (BTN vs BB SRP river bluff-catch). Daily use will feel trapped in one subtree until at least a second adjacent lane family is production-ready.

The target adjacent lane per the sprint doc: **turn probe / delayed river decision and threshold carryover** (turn-line-clear and turn-line-fuzzy profiles).

### In Scope

- Define node(s) for the adjacent turn probe / delayed cbet / turn-to-river threshold family
- Author a batch of 8–12 drills covering turn probe spots with river follow-through
- Drills must include `action_history`, `coaching_context`, and correct `answer_by_pool` where relevant
- Stage under `out/reports/gold-lane-reviews/pending/`
- Validate and review per gold-lane workflow
- Merge into `content/drills/` only after acceptance

### Out of Scope

- 3-bet pot lanes
- Preflop expansion
- Multiway expansion
- Any code changes

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] Validator passes on the new batch
- [ ] `pnpm content:init` loads the new nodes and drills without errors
- [ ] New family is confirmed tagged with the correct `spot:`, `street:`, and `concept:` classification tags
- [ ] Follow-up session assignment correctly routes to the new lane from a real-hand with a turn probe history

### Proof / Verification

`pnpm content:init` output showing new node and drill count. Validator output on the batch.

### Dependencies / Blockers

Issue 5 (content depth uplift on existing lane) should complete first to establish the authoring quality bar.

---

## Issue 10 — [LANE] Align MASTER_ROADMAP phase numbering with COACH_EQUIVALENCE_ROADMAP

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p2`, `area:infra`, `phase:3-integration`
**Milestone:** Phase 3 — System Integration

### Problem

`MASTER_ROADMAP.md` uses Phases 1–5 (Architecture, Content, Integration, Coaching Intelligence, Real Play). `COACH_EQUIVALENCE_ROADMAP.md` uses Phases 7–12 (Persistent Coaching Depth, Rich Training Truth, Range Truth, Diagnostic Coaching, Intervention Planning, Real Hand Coaching). The numbering overlap creates confusion when assigning issues to milestones.

The GitHub execution model uses Phase 3/4/5 labels. The coach equivalence roadmap's Phase 7 maps to Phase 3+4 combined. The two docs must either align in numbering or explicitly cross-reference each other.

### In Scope

- Add a cross-reference table to both roadmap docs mapping MASTER_ROADMAP phases to COACH_EQUIVALENCE_ROADMAP phases
- Update `docs/roadmaps/README.md` to note which doc governs execution priority vs product direction
- No phase renumbering — just cross-references

### Out of Scope

- Changing any phases or their content
- Updating GITHUB_EXECUTION_MODEL.md (its labels are based on MASTER_ROADMAP and stay)

### Acceptance Criteria

- [ ] Both roadmap docs have a "Phase Mapping" section showing MASTER_ROADMAP Phase N → COACH_EQUIVALENCE_ROADMAP Phase M
- [ ] `docs/roadmaps/README.md` designates MASTER_ROADMAP as the execution reference and COACH_EQUIVALENCE_ROADMAP as the product direction reference
- [ ] `pnpm verify` passes (no code changes, but typecheck should still run)

### Proof / Verification

Reviewer can open either roadmap doc and find the cross-reference table without confusion.

### Dependencies / Blockers

None.

---

## Issue 11 — [LANE] Follow-up audit persistence — confirm write path and Command Center surface

**Template:** execution_lane
**Labels:** `type:execution-lane`, `priority:p1`, `area:persistence`, `area:real-hands`, `area:api`, `phase:3-integration`
**Milestone:** Phase 3 — System Integration

### Problem

The Command Center surfaces `followUpMonitor` using `recentFollowUpAudits` loaded from `getUserFollowUpAssignmentAudits()`. The `follow_up_assignment_audits` table must be written after a real-hand follow-up session completes. It is not confirmed that this write happens correctly, or that the `bucket_mix_json`, `hand_title`, `uncertainty_profile`, and `corrective_focus` fields are populated.

If this write is missing or partial, the Command Center's follow-up monitor section shows no history, and the corrective weighting logic (`inferCorrectiveBucketsFromWarnings`) cannot improve over time.

### In Scope

- Audit `/api/real-hands/follow-up-session/route.ts` — does it write to `follow_up_assignment_audits` after the session plan is built?
- Audit whether the write includes `bucket_mix_json` with the correct bucket counts
- Fix the write if it is missing or incomplete
- Add a test: build a follow-up plan for a mock hand, verify a `follow_up_assignment_audits` row is written with expected fields

### Out of Scope

- Redesigning the follow-up session plan algorithm
- Changes to `buildFollowUpMonitorWarnings` logic
- UI changes to the Command Center

### Acceptance Criteria

- [ ] `pnpm verify` passes
- [ ] After creating a real-hand follow-up plan via `/api/real-hands/follow-up-session`, `getUserFollowUpAssignmentAudits()` returns a row for the hand
- [ ] The row has a non-empty `bucket_mix_json` with the correct bucket distribution
- [ ] `hand_title` and `uncertainty_profile` are populated on the row
- [ ] Test added verifying the write

### Proof / Verification

Test output showing the `follow_up_assignment_audits` write with expected field values.

### Dependencies / Blockers

Issue 4 (real-hand loop audit) should complete first to map the current state of the write path.

---

## Execution Order

### Create First (in GitHub UI)

| # | Issue | Why First |
|---|-------|-----------|
| 1 | Truth audit — gap tracker reconciliation | Unblocks correct prioritization of everything else |
| 2 | Play session → DB write path | Core loop is broken without this |
| 8 | SRS update path from web | Directly depends on issue 2 and unblocks review scheduling |

### Create Next (once 1 and 2 are in flight)

Issues 3, 4, 6, 11 — these verify or close the intervention and real-hand loops that build on the write path.

### Create Later (parallel content and alignment work)

Issues 5, 7, 9, 10 — content depth, daily plan bridge, adjacent lane expansion, and doc alignment.

---

## Remaining Manual GitHub UI Setup

Before creating issues, set up in GitHub UI:

**Labels to create:**
- `type:execution-lane` (blue)
- `type:truth-audit` (orange)
- `type:content` (green)
- `type:infra` (gray)
- `priority:p0` (red)
- `priority:p1` (yellow)
- `priority:p2` (light gray)
- `area:persistence`
- `area:ui`
- `area:coaching-engine`
- `area:content`
- `area:api`
- `area:real-hands`
- `phase:3-integration`
- `phase:4-coaching`
- `phase:5-real-play`

**Milestones to create:**
- `Phase 3 — System Integration`
- `Phase 4 — Coaching Intelligence`
- `Phase 5 — Real Play Integration`

**Issue creation order:** Start with Issues 1, 2, 8 (open all three simultaneously — they can proceed in parallel).
