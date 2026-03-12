# TypeScript Workspace Note

Root cause: the shared `tsconfig.base.json` was carrying `rootDir: "src"`, which is correct for package builds but incorrect for the root workspace config that aggregates multiple `apps/*` and `packages/*` source trees.

Chosen fix: make the base config workspace-neutral by removing `rootDir`, and keep `rootDir: "src"` only in leaf project configs that actually own a single source root.

Why this is correct: the root config is an orchestrator for the monorepo, while each package or app should define its own compiler boundary. That keeps root `tsc --noEmit` truthful without weakening package build constraints.
