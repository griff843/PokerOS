# Rule 04 — Testing and Verification

> **Scope:** All Poker Coach OS sprints that change code behavior

---

## Test Commands

| Command | What it tests | Required when |
|---|---|---|
| `pnpm test` | Vitest — all packages | Always |
| `pnpm typecheck` | TypeScript across monorepo | Always |
| `pnpm build:web` | Next.js production build | When Table Sim is in scope |

---

## Test Suite Scope

Current test files:
- `packages/core/src/scoring.test.ts` — 7 tests
- `packages/core/src/srs.test.ts` — 5 tests
- `packages/core/src/content-loader.test.ts` — 4 tests
- `apps/table-sim/src/lib/concept-audit-feed-ui.test.ts` — (new, count TBD)

**All tests must pass before a sprint can close.** If a pre-existing test was already failing before your sprint and is unrelated, document it explicitly.

---

## Test Categories

### Unit tests
- Single function or module behavior
- Location: co-located with source files (`*.test.ts`)
- Framework: Vitest

### Integration tests (when applicable)
- Multi-module behavior
- Drill scoring end-to-end
- SRS state transitions
- DB round-trips

### Build verification
- `pnpm build:web` confirms no import errors, type errors at build time, or broken routes
- Must be run whenever Table Sim routes or components change

---

## Verification Checklist

Before calling a sprint complete:

- [ ] `pnpm test` — all tests pass (run from repo root)
- [ ] `pnpm typecheck` — zero type errors
- [ ] `pnpm build:web` — build exits clean (if Table Sim in scope)
- [ ] Manual behavioral check — the feature works as expected in the app or CLI
- [ ] No regressions in adjacent behavior

---

## Behavioral Verification

For drill/scoring changes:
- Run `pnpm -w coach drill` and confirm scoring behaves correctly
- Check that action-name answer keys produce the expected score

For Table Sim changes:
- Load the route in the browser
- Step through the relevant session state transitions
- Confirm new/changed components render correctly

For DB schema changes:
- Run `pnpm -w coach init` on a fresh DB
- Confirm all tables are created correctly
- Confirm existing data (if any) is not corrupted

---

## Failed Tests

If tests fail:
1. Determine if the failure is pre-existing (unrelated to this sprint) or caused by this sprint
2. If caused by this sprint → fix it before closeout
3. If pre-existing → document it in `proof.md` under "Known Issues" and proceed
4. Never close a sprint with un-triaged test failures
