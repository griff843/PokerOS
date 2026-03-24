# Poker Coach OS — Architecture Map

> **Status:** Living document — update as the system grows
> **Last updated:** 2026-03-16
> **Active phase:** Phase 1 — Coaching Surface Activation

---

## System overview

Poker Coach OS is a local-first TypeScript monorepo for poker improvement. It combines spaced-repetition drills, coaching diagnostics, intervention tracking, and a web-based training UI into a single governed system.

---

## Monorepo structure

```
apps/
  cli/               — Node CLI (coach init / drill / review / report)
  table-sim/         — Next.js 14 web app (Table Sim coaching surface)
packages/
  core/              — scoring, SRS, schemas, tags, content-loader
  db/                — SQLite wrapper, migrations, repository CRUD
scripts/
  poker-ai-refresh.ts        — regenerates AI operating artifacts
  lib/
    poker-doc-collector.ts   — reads canonical docs
    poker-repo-inventory.ts  — scans repo surfaces
    poker-artifact-writer.ts — writes md/json artifacts
content/
  nodes/hu/          — 10 HU node JSON files
  drills/            — drill seed data
docs/
  content/           — DRILL_SCHEMA.md (canonical drill schema)
  ai/                — project adapter, readiness docs, AI coach architecture
  ai-core/           — portable AI operating doctrine
  poker-coach-os/    — status, phases, this file
.claude/
  skills/            — prompt-compose, sprint-plan, sprint-proof-bundle, status-sync, agent-health
  agents/            — 7 AI operating agents
  rules/             — workflow, safety-proof, testing-verification, output-formats
out/
  ai/                — auto-generated AI context artifacts (context_bundle.md, snapshots/)
  poker/sprints/     — sprint proof bundles (local only — out/ is gitignored)
```

---

## Key boundaries

| Boundary | Rule |
|---|---|
| Network | No network calls — local-first only |
| DB writes | Only through `packages/db/src/` |
| Drill answers | Action names (CALL/FOLD/RAISE) — never positional letters |
| Rule tags | Flat snake_case from VALID_TAGS enum |
| Classification tags | `category:value` format — never mixed with rule tags |
| Pool variants | `answer_by_pool` — never flatten to single answer |
| AI context | `out/ai/context/context_bundle.md` is auto-generated — do not edit |

---

## Data flow

```
content/ JSON files
    ↓ idempotent upsert
packages/db/ (SQLite, WAL mode)
    ↓ repository CRUD
packages/core/ (scoring, SRS, schemas)
    ↓
apps/cli/ (drill sessions, review, reports)
apps/table-sim/ (web coaching surface, API routes, React UI)
    ↓
out/ (proof artifacts, AI context bundle)
```

---

## Phase model

| Phase | Status | Description |
|---|---|---|
| Phase 0 — Foundation Lock | COMPLETE | Repo structure, doctrine, canonical docs, truth hierarchy |
| Phase 1 — Coaching Surface Activation | ACTIVE | Core coaching UI, concept views, intervention surface |
| Phase 2 — Review & Diagnosis System | Planned | Hand/session ingestion, leak clustering, diagnosis |
| Phase 3 — Intervention Engine | Planned | Active interventions, coaching loops, progress measurement |
| Phase 4 — Training Intelligence | Planned | Drill generation, study prioritization, reinforcement |
| Phase 5 — Performance Memory | Planned | Longitudinal tracking, recurring leaks, durable strengths |

---

## AI operating layer

| Component | Path | Description |
|---|---|---|
| Skills | `.claude/skills/` | prompt-compose, sprint-plan, sprint-proof-bundle, status-sync, agent-health |
| Agents | `.claude/agents/` | 7 agents for docs, prompts, repo audit, code review, sprint management |
| Rules | `.claude/rules/` | 00-workflow, 01-safety-proof, 04-testing-verification, 05-output-formats |
| Status doc | `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` | Current truth |
| Context bundle | `out/ai/context/context_bundle.md` | Auto-generated — run `pnpm poker:ai:refresh` |
| Truth compiler | `scripts/poker-ai-refresh.ts` | Regenerates all AI artifacts from canonical docs |
