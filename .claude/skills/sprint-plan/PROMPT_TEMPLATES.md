# Prompt Templates — Sprint Planning

> These are starter prompt templates for common Poker Coach OS sprint categories.
> `/sprint-plan` will fill in the relevant template before producing its recommendation.

---

## Template: COACHING-SURFACE Sprint

```
## Sprint: <SPRINT-NAME>

I need to implement a coaching surface sprint for Poker Coach OS.

**Objective:** <one sentence>

**Active phase:** Phase 1 — Coaching Surface Activation

**What exists today:**
- Table Sim web UI: apps/table-sim/src/
- Session state machine (configuring → board_scan → deciding → feedback → summary)
- Review mode: /app/review
- Concept audit feed API: [path if known]

**What needs to be built:**
<describe the surface, component, or behavior>

**Source of truth:**
<canonical doc or existing file to follow>

**Constraints:**
- No network calls — local-first only
- Follow existing Table Sim component patterns
- Types must be defined before use — no any
- Use Tailwind for styling, following existing conventions

**Verification:**
- [ ] pnpm type-check passes
- [ ] pnpm build:web passes
- [ ] UI renders correctly at /app/<route>
```

---

## Template: CONTENT Sprint

```
## Sprint: <SPRINT-NAME>

I need to expand or migrate drill/node content for Poker Coach OS.

**Objective:** <one sentence>

**Canonical schema:** docs/content/DRILL_SCHEMA.md

**What needs to change:**
<describe content additions or migrations>

**Key constraints:**
- Answer keys must use action names (CALL/FOLD/RAISE) — not positional letters
- Pool variants require answer_by_pool — do not flatten to single answer
- Rule tags: flat snake_case from VALID_TAGS enum only
- Classification tags: category:value format only — never mix with rule tags

**Verification:**
- [ ] pnpm test passes (content-loader tests)
- [ ] pnpm type-check passes
- [ ] New drills load correctly via coach init
```

---

## Template: AI-OS Sprint

```
## Sprint: <SPRINT-NAME>

I need to install or adapt an AI operating system component for Poker Coach OS.

**Objective:** <one sentence>

**Status docs to read first:**
- docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md
- docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md

**What needs to be built or adapted:**
<describe skill, agent, rule, or doc>

**Poker-specific paths to reference:**
<list any existing Poker docs the skill should read>

**Verification:**
- [ ] Skill/agent invocation produces Poker-specific output
- [ ] No Unit Talk domain references remain
- [ ] Output format matches the skill's declared format
```

---

## Template: SCHEMA Sprint

```
## Sprint: <SPRINT-NAME>

I need to evolve the DB schema or drill schema for Poker Coach OS.

**Objective:** <one sentence>

**Migration strategy:**
<describe the migration approach — additive? breaking? rollback plan?>

**Files in scope:**
- packages/db/src/migrations.ts
- [other affected files]

**Constraints:**
- All schema changes go through packages/db/src/migrations.ts
- WAL mode must be preserved
- No direct SQLite calls outside packages/db/
- Rollback must be possible for any migration

**Verification:**
- [ ] pnpm test passes
- [ ] pnpm type-check passes
- [ ] coach init runs without error on a fresh DB
```
