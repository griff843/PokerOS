# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

Before making claims about what is or is not built, read `TRUTH.md` first.
For the 12-sprint execution plan, see `docs/roadmaps/ELITE_DAILY_COACH_12_SPRINT_PLAN.md`.

## Commands

```bash
# Development
pnpm dev
pnpm coach

# Verification
pnpm typecheck
pnpm test
pnpm verify

# Build
pnpm build:web

# Content validation
pnpm validate:canonical        # schema + structure check across all drill files
pnpm validate:gold-lane        # gold-lane depth check
pnpm validate:gold-seed        # validate the seed file specifically

# Content audit CLIs
pnpm drill:coverage            # drill count by street, pot type, concept
pnpm drill:lane-gaps           # identify undertaught lanes
pnpm drill:followups-audit     # follow_up and follow_up_concepts coverage
pnpm drill:trace               # trace a single drill's coaching chain

# Content patch application
pnpm apply:diagnostic-patch
pnpm apply:pack-diagnostic-patches
pnpm apply:coaching-context-patch
pnpm apply:pack-coaching-context-patches

# Single test file
pnpm vitest run packages/core/src/__tests__/scoring.test.ts
pnpm vitest run apps/table-sim/src/lib/daily-study-plan.test.ts
```

## Monorepo Structure

```text
apps/cli/          - Commander.js CLI (init, drill, review, report commands)
apps/table-sim/    - Next.js 14 web app, mobile-first poker table UI
packages/core/     - Business logic: scoring, SRS, coaching, diagnostics
packages/db/       - SQLite (WAL mode), migrations, CRUD repository
content/           - Authored JSON drills and node definitions (source of truth)
docs/              - Architecture specs, curriculum guides, system design
scripts/           - Audit CLIs, patch tools, validators, scaffold utilities
```

Path aliases:
- `@poker-coach/core` -> `packages/core/src/index.ts`
- `@poker-coach/core/browser` -> `packages/core/src/browser.ts`
- `@poker-coach/db` -> `packages/db/src/index.ts`
- `@` -> `apps/table-sim/src`

## Architecture

### packages/core - The Coaching Brain

All scoring, learner modeling, coaching logic, and diagnostics live here.

The package has two export surfaces:
- `@poker-coach/core` - full Node.js entry
- `@poker-coach/core/browser` - browser-safe subset

Key modules:
- `scoring.ts` - 70% action + 30% tag match
- `srs.ts` - SM-2, pass threshold 0.6
- `tags.ts` - all valid rule tags
- `schemas.ts` - canonical record shapes
- `answer-resolution.ts` - pool-aware answer mapping
- `drill-coaching-snapshot.ts` - builds the coaching panel data structure from drill + attempt
- `session-generator.ts` - generates session drill queues, supports focus-concept filtering

### packages/db - Persistence Layer

SQLite via `better-sqlite3` in WAL mode. `openDatabase()` creates `.local/coach.db` and runs migrations automatically.

### apps/table-sim - Web App

Next.js 14 App Router. Auth is passcode + httpOnly cookie.

Session state flows through React Context + useReducer:
- `configuring`
- `board_scan`
- `deciding`
- `feedback`
- `summary`

Key lib modules:
- `daily-plan-session-bridge.ts` - canonical adapter between DailyStudyPlan block selection and session launch; use `buildConceptFollowUpSessionHref` to route follow-up concept clicks
- `session-plan.ts` - loads session plan from API, supports `dailyPlanOverride` for focus concept and block kind
- `session-plan-server.ts` - server-side plan builder, handles override parameters
- `session-review.ts` - builds post-session review snapshot; surfaces authored `follow_up` and `follow_up_concepts` from drill data
- `command-center.ts` - command center snapshot builder; exposes `coachBriefing.followUpConcepts`

### content - Drill and Node JSON

Drills are JSON arrays. Nodes are single JSON objects. Content is loaded via `packages/core/src/content-loader.ts` with idempotent upserts.

**Current state (verified 2026-04-05):** 241 drills across 7 files, 241/241 diagnostic prompt coverage.

Key drill rules:
- `answer.correct` and `options[].key` use canonical action names like `CALL`, `FOLD`, `RAISE`, `BET`, `CHECK`
- rule tags in `answer.required_tags` must come from `VALID_TAGS` in `packages/core/src/tags.ts`
- classification tags in `tags[]` use `category:value`
- `answer_by_pool` keys are `A`, `B`, `C`
- `size_pct_pot` is the canonical percent-of-pot sizing field

See:
- `docs/content/DRILL_SCHEMA.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`

### Tag System

Two tag layers:
- rule tags in `required_tags` are scored during attempts
- classification tags in `tags[]` are for analytics and curriculum only

Classification categories:
- `street`
- `pot`
- `position`
- `spot`
- `board`
- `concept`
- `decision`
- `pool`

### Population Model

Pool variants shift the correct answer based on opponent type. Use `answer_by_pool` only when the action genuinely differs across pools. Baseline `answer` is the fallback.

## Key Constraints

- `pnpm.onlyBuiltDependencies` includes `better-sqlite3`
- `.local/`, `out/`, `dist/`, and `*.db` are gitignored
- `.claude/settings.local.json` and `.codex/` are gitignored (local tool state)
- `.claude/commands/*.md` are project slash commands and ARE committed
- `out/ai/context/context_bundle.md` is auto-generated
- node ids must match `^[a-z0-9_]+$`
- TypeScript target is ES2022 with Node16 module resolution

## Architecture Docs

Consult these first for structural changes:
- `TRUTH.md` - verified wiring and content counts; read before claiming anything is missing or built
- `docs/roadmaps/ELITE_DAILY_COACH_12_SPRINT_PLAN.md` - 12-sprint execution plan
- `docs/architecture/ARCHITECTURE_MAP.md`
- `docs/content/DRILL_SCHEMA.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- `docs/curriculum/CLAUDE_DRILL_WORKFLOW.md`
- `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`
- `docs/curriculum/POPULATION_MODEL.md`

## Drill Authoring Cheat Sheet

Use this when authoring or rewriting drills so you do not keep re-deriving the same schema rules.

### Canonical enum values

- `metadata.source`
  - `manual`
  - `ai_generated`
  - `session_import`
  - `solver`

- `diagnostic_prompts[].type`
  - `line_understanding`
  - `threshold`
  - `range_construction`
  - `blocker`
  - `pool_assumption`
  - `street_shift`
  - `mix_reasoning`

- `diagnostic_prompts[].options[].diagnosis`
  - `line_misunderstanding`
  - `threshold_error`
  - `range_construction_error`
  - `blocker_blindness`
  - `pool_assumption_error`
  - `confidence_miscalibration`

### Canonical shape reminders

- `prompt` is required
- `scenario.street` must be one of `preflop | flop | turn | river`
- `scenario.pot_type` must be one of `SRP | 3BP | 4BP | limp | squeeze | multiway`
- `scenario.board` is an object like:
  - `{ "flop": ["As", "Kd", "2c"], "turn": "7h", "river": "3d" }`
- `scenario.action_history[]` entries use:
  - `street`
  - `player`
  - `action`
  - optional `size_bb`
  - optional `size_pct_pot`
- `decision_point` is an object, not a string
- `answer_by_pool` entries are full answer objects, not shorthand action strings
- `coaching_context.what_changed_by_street` is an array of `{ street, detail }`
- `coaching_context.range_support.threshold_notes` is an array, not a string
- `diagnostic_prompts[]` need:
  - `id`
  - `type`
  - `prompt`
  - `expected_reasoning`
  - `options[].id`
  - `options[].label`
  - `options[].diagnosis`

### Authoring workflow

- Stage unreviewed batches under:
  - `out/reports/gold-lane-reviews/pending/`
- Do not write unreviewed batches into `content/drills`
- Validate with:
  - `node scripts/validate-gold-lane.mjs --mode=batch <path>`
- Review with:
  - `pnpm review:gold-batch --batch=<path> --report=<path>`
- Check coverage gaps before authoring:
  - `pnpm drill:lane-gaps`
  - `pnpm drill:followups-audit`
- Merge only after acceptance

### Fast starting points

- Canonical batch template:
  - `scripts/templates/drill_batch_template.json`
- Scaffold command:
  - `pnpm drill:scaffold -- --out=<pending-path> --count=10 --prefix=my_lane`
