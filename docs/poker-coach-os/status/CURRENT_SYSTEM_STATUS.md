# Current System Status — Poker Coach OS

> **Last updated:** 2026-03-24 (post daily-study-plan-v3 sprint)
> **Active phase:** Phase 1 — Coaching Surface Activation
> **Status tier:** Operational (Daily Study Plan v3 complete)

---

## What is done

### v1 CLI Layer (COMPLETE)
- `coach init` — DB + content loading (SQLite, WAL mode)
- `coach drill` — interactive spaced-repetition drill sessions
- `coach review` — weakest nodes/tags report
- `coach report --weekly` — markdown report generation
- 16 tests passing (scoring, SRS, content-loader)
- 30 drills across 10 HU nodes (3 per node), 7 rule tags

### v1.3 Table Sim (COMPLETE)
- Next.js 14 App Router + Tailwind — mobile-first poker table UI
- Routes: `/login`, `/app/session`, `/app/play`, `/app/summary`, `/app/review`
- Session state machine: configuring → board_scan → deciding → feedback → summary
- 30 enriched drills in `apps/table-sim/public/content/drills.json`
- Auth: passcode cookie, middleware on `/app/*`
- Scoring adapter: action + sizing + tags (pool-aware design)

### v1.3.1 Review Mode (COMPLETE)
- `/app/review` — replay session hands street-by-street
- Filter by mistakes / tags
- Board texture utility (`board-texture.ts`)
- 4 review components: ReviewFilterBar, ReviewDrillList, ReplayControls, ReviewDrillDetail
- JSON export includes `reflections` + `review_timestamp`

### Architecture Foundation Lock (2026-03-08, COMPLETE)
- Node IDs: relaxed to `^[a-z0-9_]+$`
- Tags: rule tags (scoring) + classification tags (analytics, `category:value`)
- Population model: `answer_by_pool` for per-pool correct answers
- Target scale: 80 nodes, ~700 base drills, ~1700 with pool variants
- Canonical drill schema locked: `docs/content/DRILL_SCHEMA.md`

### AI Operating Layer (2026-03-16, COMPLETE)
- Steps 1–3: portable core docs + project adapter + readiness checklist
- Steps 4–7: status wiring, skills, agents, rules — all installed
- Skills: prompt-compose, sprint-proof-bundle, sprint-plan, status-sync, agent-health
- Agents: 7 agents (prompt optimizer, docs maintainer, repo auditor, code optimizer, navigator, proof bundler, sprint manager)
- Rules: 00-workflow, 01-safety-and-proof, 04-testing-and-verification, 05-output-formats
- Verification: `pnpm typecheck` (not `pnpm type-check`)

### AI OS Install Lock (2026-03-16, COMPLETE)
- All AI OS install files tracked: `.claude/`, `docs/ai-core/`, `docs/ai/`, `docs/poker-coach-os/`
- Created: `docs/poker-coach-os/ARCHITECTURE_MAP.md` (canonical architecture stub)
- Fixed: drills.json surface path in truth compiler (→ drills API route)
- `pnpm poker:ai:refresh` now reports READY with all 9 surfaces present
- Committed: 4d45adf

### AI Truth CLI — poker:ai:refresh (2026-03-16, COMPLETE)
- Command: `pnpm poker:ai:refresh`
- Source: `scripts/poker-ai-refresh.ts` + `scripts/lib/` (poker-doc-collector, poker-repo-inventory, poker-artifact-writer)
- Reads canonical docs → generates 5 AI artifacts under `out/ai/`
- Outputs: `context_bundle.md` (auto), `context_bundle.json`, `doc_inventory.json`, `repo_snapshot.json`, `ai_readiness.json`
- Readiness states: READY / PARTIAL / BLOCKED (exits 1 if blocked)
- `out/ai/context/context_bundle.md` is now auto-generated — do not edit manually
- Committed: 3808b7d

### Concept Audit Feed UI Adapter (2026-03-16, COMPLETE)
- `apps/table-sim/src/lib/concept-audit-feed-ui.ts`
- fetchConceptAuditFeed, selectRecentConceptAuditEvents, summarizeConceptAuditFamilies, buildConceptAuditFeedPreview
- 5 tests passing (concept-audit-feed-ui.test.ts)
- Committed: 194b8e0
- Proof: out/poker/sprints/concept-audit-feed-ui-adapter/20260316/ (local only — out/ is gitignored)

### Daily Study Plan v3 (2026-03-24, COMPLETE)
- `apps/table-sim/src/lib/daily-study-plan.ts` — pure adapter (buildDailyStudyPlanBundle)
- `apps/table-sim/src/app/api/daily-study-plan/route.ts` — GET /api/daily-study-plan
- `apps/table-sim/src/components/daily/DailyStudyPlan.tsx` — client component with session-length selector + MainFocusCard
- `apps/table-sim/src/app/app/daily/page.tsx` — /app/daily route
- `apps/table-sim/src/lib/daily-study-plan.test.ts` — 55 tests (all states, all lengths, all block types, v2 fields)
- States: no_history, sparse_history, ready
- Session lengths: 20 (top-2 blocks, capped 10 min each) / 45 (max 3, greedy) / 90 (max 5, greedy)
- Block kinds: focus_concept, execute_intervention, retention_check, review_real_hands, secondary_concept, inspect_replay_drift
- v2 additions: mainFocus, successCriteria, firstAction — surfaces on /app/daily via MainFocusCard
- Sparse state: now generates 2 blocks (drill + review recent session as default support)
- v3 additions: real-hand bridge integration, session arc ordering, enriched block reasons
- v3: route calls bridge builder; bridgeBundle enriches review_real_hands/execute_intervention/inspect_replay_drift/whyThisPlan
- v3: session arc enforced post-selection (execute_intervention→focus_concept→retention_check→review_real_hands→secondary_concept→inspect_replay_drift)
- 307/307 tests pass, typecheck clean, build passes

---

## What is in progress

Working tree: modified files unstaged. Branch: `codex/concept-audit-feed-ui-adapter-v1`

Daily Study Plan v2 is complete. Ready to commit.

---

## What is next

### Immediate
1. Commit Daily Study Plan v2 and open PR
2. Wire DailyStudyPlan link into the app navigation (layout.tsx or coaching surface)

### Near-term
3. Build concept audit feed UI component — wire `buildConceptAuditFeedPreview()` into a React component on the coaching surface

### Near-term
- Canonical drill schema migration (merge CLI + Table Sim formats)
- Content expansion: expand toward 80 nodes / 700 drills
- Coaching surface: concept detail view showing audit feed events + family summaries

### Roadmap
- Phase 2 — Review & Diagnosis System (hand/session ingestion, leak clustering)
- Phase 3 — Intervention Engine (active interventions, coaching loops)
- Phase 4 — Training Intelligence (drill generation, study prioritization)
- Phase 5 — Performance Memory & Longitudinal Tracking

---

## Active constraints

- No network calls (local-first)
- SQLite (better-sqlite3, WAL mode) — single writer
- Path aliases: `@poker-coach/core`, `@poker-coach/db`
- `pnpm -w coach` runs CLI
- `pnpm dev:web` runs Table Sim on port 3030
- Tests: `pnpm test` (vitest)
- Type check: `pnpm typecheck` (not `pnpm type-check`)
- Build: `pnpm build:web` (Next.js)

---

## Key file paths

| Surface | Entry point |
|---|---|
| CLI | `apps/cli/src/index.ts` |
| Table Sim | `apps/table-sim/src/` |
| Core package | `packages/core/src/` |
| DB package | `packages/db/src/` |
| Drills content | `apps/table-sim/public/content/drills.json` |
| Drill schema | `docs/content/DRILL_SCHEMA.md` |
| AI adapter | `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` |
| Architecture map | `docs/poker-coach-os/ARCHITECTURE_MAP.md` (if created) |
| Status (this file) | `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` |
| Sprints artifacts | `out/poker/sprints/` |
| Context bundle (auto) | `out/ai/context/context_bundle.md` — regenerate with `pnpm poker:ai:refresh` |
| AI snapshots | `out/ai/snapshots/` (doc_inventory, repo_snapshot, ai_readiness) |
| AI refresh CLI | `scripts/poker-ai-refresh.ts` |
| Daily Study Plan adapter | `apps/table-sim/src/lib/daily-study-plan.ts` |
| Daily Study Plan API | `apps/table-sim/src/app/api/daily-study-plan/route.ts` |
| Daily Study Plan page | `apps/table-sim/src/app/app/daily/page.tsx` |
