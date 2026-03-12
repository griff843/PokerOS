# Repo Setup And Ownership

This note is the shortest possible guide for where code should live in Poker OS.

## Source Of Truth

- `packages/core`
  - business logic
  - scoring
  - diagnostics
  - learner modeling
  - adaptive coaching
  - intervention planning
  - real-hand analysis
- `packages/db`
  - migrations
  - repository helpers
  - SQLite access only
- `apps/table-sim`
  - Next.js routes
  - server/client adapters
  - state wiring
  - rendering
- `content`
  - authored drill truth
- `docs`
  - product and architecture intent

## Keep These Boundaries Clean

### Put code in `packages/core` when it answers:

- What is the correct answer?
- Why is the answer right?
- Why did the learner miss?
- What concept is weak?
- What should the learner train next?
- How should coaching adapt to this learner?

### Put code in `apps/table-sim` when it answers:

- How is this shown?
- Which route loads it?
- Which component renders it?
- How does local app state flow into a core helper?

### Put code in `packages/db` when it answers:

- How is this persisted?
- What is the schema?
- How is a row inserted, updated, or queried?

## Anti-Patterns

- business logic in JSX
- duplicated scoring or coaching rules in route handlers
- content truth embedded in components
- persistence rules spread across app code
- fake learner certainty in UI copy

## Runtime And Generated Paths

- `.local/`
  - local database and runtime state
- `out/`
  - generated reports and proof artifacts
- `apps/table-sim/.next/`
  - Next.js build output
- `.tmp/`, `.pnpm-home/`
  - local workspace tooling state

These are not product source.

## Repo Entry Flow

1. Read `README.md`
2. Read the product constitution if you are changing behavior
3. Read the relevant roadmap if you are changing coaching depth
4. Make core changes before UI changes when behavior is involved
5. Verify with:

```bash
pnpm verify
```
