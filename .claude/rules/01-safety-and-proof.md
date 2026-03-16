# Rule 01 — Safety and Proof

> **Scope:** All Poker Coach OS implementation and verification

---

## Minimum Proof Bundle

Every sprint closeout must have these artifacts in `out/poker/sprints/<SPRINT>/<DATE>/`:

| Artifact | Required | Source |
|---|---|---|
| `proof.md` | Always | Filled CLOSEOUT_TEMPLATE.md |
| `test-output.txt` | Always | `pnpm test` |
| `typecheck-output.txt` | Always | `pnpm typecheck` |
| `build-output.txt` | When Table Sim in scope | `pnpm build:web` |
| `git-state.txt` | Always | `git status` + `git log` |

---

## Proof File Formats

**proof.md** — Filled closeout template. Must include:
- Sprint name, date, objective
- What was built (bulleted)
- Verification results (table)
- Known issues (explicit "None" if none)
- Status doc update targets

**test-output.txt** — Raw output from `pnpm test`. Must show pass/fail counts.

**typecheck-output.txt** — Raw output from `pnpm typecheck`. Must show clean exit or error list.

---

## Forbidden Claims

Do not write any of the following in a closeout or status doc unless verified by command output:
- "All tests pass"
- "No type errors"
- "Build succeeds"
- "Sprint complete"
- "No regressions"

Unverified claims in the proof layer corrupt the status stack.

---

## Safety Rules

**Never force-push main without explicit confirmation.**

**Never delete files without confirming they are unused** — check imports and references first.

**Never modify migrations.ts in a way that could corrupt existing data** — always migrate forward, never destructively modify existing migration steps.

**Never change drill answer keys from action names to positional letters** — this breaks all scoring logic.

**Never mix rule tags and classification tags in the same field** — they serve different purposes and must stay separated.

---

## Proof Permanence

Once written to `out/poker/sprints/<SPRINT>/<DATE>/`, proof artifacts are permanent records. Do not modify them. If corrections are needed, create a new artifact with an updated date and note the reason.
