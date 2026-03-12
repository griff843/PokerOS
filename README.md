# Poker OS

Canonical repository: [github.com/griff843/PokerOS](https://github.com/griff843/PokerOS)

Poker OS is a TypeScript `pnpm` monorepo for a coach-like poker training system.

The repo is organized around one rule:

- `packages/core` owns business logic
- `packages/db` owns persistence
- `apps/table-sim` owns app wiring and UI
- `content` owns authored training truth

## Workspace Map

- `apps/table-sim`
  - Next.js product app
  - renders Command Center, study, review, growth, weakness, and real-hand surfaces
  - should consume structured data from `@poker-coach/core` instead of recomputing coaching logic in JSX
- `apps/cli`
  - CLI entrypoint for local workflows and repo utilities
- `packages/core`
  - canonical drill schema
  - scoring and answer resolution
  - diagnostics
  - drill coaching snapshot generation
  - adaptive coaching and learner modeling
  - intervention planning
  - real-hand concept extraction
- `packages/db`
  - SQLite access
  - migrations
  - repository helpers
- `content`
  - authored drills and other strategic truth inputs
- `docs`
  - constitution, roadmaps, architecture notes, and product standards
- `.local`
  - local runtime data such as `coach.db`
- `out`
  - generated reports and proof artifacts

## Setup

1. Install dependencies.

```bash
pnpm install
```

2. Create the app env file if needed.

```bash
apps/table-sim/.env.local
```

Current local auth expects:

```env
COACH_APP_PASSCODE=changeme
```

3. Run the app.

```bash
pnpm dev
```

The main app is `apps/table-sim` and runs on port `3030`.

## Common Commands

- `pnpm dev`
  - start the Table Sim app in dev mode
- `pnpm dev:table-sim`
  - same as above, explicit app target
- `pnpm build`
  - build the Table Sim app
- `pnpm typecheck`
  - run the workspace TypeScript check
- `pnpm test`
  - run Vitest suites across apps and packages
- `pnpm verify`
  - run typecheck, tests, and the app build
- `pnpm coach`
  - run the CLI entrypoint

## Ownership Rules

- Put coaching, learner modeling, diagnostics, scoring, and intervention logic in `packages/core`.
- Put database schema, migrations, and raw persistence helpers in `packages/db`.
- Keep `apps/table-sim` focused on routes, adapters, state wiring, and rendering.
- Keep authored poker truth in `content`, not in UI components.
- Treat `.local`, `.tmp`, `.pnpm-home`, `.next`, and `out` as local/generated state, not product source.

## Key Docs

- [Docs Index](/C:/Users/griff/poker-coach-os/docs/README.md)
- [Product Constitution](/C:/Users/griff/poker-coach-os/docs/constitution/POKER_OS_PRODUCT_CONSTITUTION.md)
- [Master Roadmap](/C:/Users/griff/poker-coach-os/docs/roadmaps/MASTER_ROADMAP.md)
- [Coach Equivalence Roadmap](/C:/Users/griff/poker-coach-os/docs/roadmaps/COACH_EQUIVALENCE_ROADMAP.md)
- [Coach Equivalence Requirements](/C:/Users/griff/poker-coach-os/docs/roadmaps/COACH_EQUIVALENCE_REQUIREMENTS.md)
- [Coach Equivalence Gap Tracker](/C:/Users/griff/poker-coach-os/docs/roadmaps/COACH_EQUIVALENCE_GAP_TRACKER.md)
- [Repo Setup And Ownership](/C:/Users/griff/poker-coach-os/docs/architecture/REPO_SETUP.md)

## Practical Standard

Poker OS should feel like a coaching product, not a bag of features.

When adding code, prefer deeper truth and cleaner seams over wider surface area.

