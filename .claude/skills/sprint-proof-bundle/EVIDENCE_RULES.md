# Evidence Rules — Sprint Proof Bundle

> These rules define what counts as valid proof for a Poker Coach OS sprint closeout.

---

## Minimum Required Evidence

Every sprint closeout must have:

| Evidence | Required | Command |
|---|---|---|
| Test output | Always | `pnpm test` |
| Type check output | Always | `pnpm type-check` |
| Build output | When Table Sim in scope | `pnpm build:web` |
| Git state | Always | `git status` + `git log` |
| Closeout report | Always | Filled `CLOSEOUT_TEMPLATE.md` |

---

## What Counts as PASS

**Tests:** All tests pass. If tests fail, failures must be explicitly triaged:
- Is it a pre-existing failure unrelated to this sprint? → Document and proceed.
- Is it caused by this sprint? → Fix before closeout.

**Type check:** Zero type errors. Warnings are acceptable; errors are not.

**Build:** Next.js build exits with code 0. A build warning does not block closeout; a build error does.

---

## What Does NOT Count as Evidence

- "Tests pass in my head" — run the commands
- "I can see it working in the browser" — capture the build output as well
- A partial test run (only a subset of tests) without explanation
- Uncommitted changes in files relevant to the sprint

---

## Artifact Permanence

Once written to `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/`, artifacts must not be modified. If corrections are needed, create a new dated artifact and note the reason.

---

## Forbidden Claims

Do not write any of the following in a closeout report unless verified:
- "All tests pass" — without `pnpm test` output
- "No type errors" — without `pnpm type-check` output
- "Build succeeds" — without `pnpm build:web` output
- "Sprint complete" — without all required evidence

Unverified claims create false confidence in the status layer. They must not appear in poker closeout artifacts.
