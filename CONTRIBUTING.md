# Contributing

Poker OS is built as a coaching product first.

Before changing behavior, read:

- `docs/constitution/POKER_OS_PRODUCT_CONSTITUTION.md`
- the relevant roadmap in `docs/roadmaps/`
- `docs/architecture/REPO_SETUP.md`

## Repo Rules

- Put business logic in `packages/core`.
- Put persistence logic in `packages/db`.
- Keep `apps/table-sim` focused on routes, adapters, state, and rendering.
- Keep authored poker truth in `content`.
- Prefer deterministic, explainable coaching behavior over vague AI-style behavior.

## Local Workflow

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @poker-coach/table-sim build
```

Or run the combined check:

```bash
pnpm verify
```

## Branching

Use a `codex/` branch name for local agent-driven changes.

Examples:

- `codex/repo-setup-baseline`
- `codex/drill-coaching-followup`

## Change Standard

Prefer changes that:

- deepen truth
- improve learner memory
- improve diagnosis
- improve intervention quality
- preserve clean seams between core and UI

Avoid changes that only add surface area without improving coaching quality.
