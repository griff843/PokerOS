# Current System Status — Poker Coach OS

> **Last updated:** 2026-03-16 (post SPRINT-POKER-AI-TRUTH-CLI-FOUNDATION closeout)
> **Active phase:** Phase 1 — Coaching Surface Activation
> **Status tier:** Operational (v1.3.1 complete)

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

---

## What is in progress

### Current branch
`codex/concept-audit-feed-ui-adapter-v1`

**Pending commit:** AI OS install files (`.claude/`, `docs/ai-core/`, `docs/ai/`, `docs/poker-coach-os/`) are untracked. Commit as a dedicated AI OS layer commit.

---

## What is next

### Immediate
1. Commit AI OS install files in a dedicated commit
2. Build concept audit feed UI component — wire `buildConceptAuditFeedPreview()` into a React component on the coaching surface (next sprint: `concept-audit-feed-ui-component`)
3. Update `poker:ai:refresh` to fix `apps/table-sim/public/content/drills.json` path (surface reports missing — path may differ)

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
