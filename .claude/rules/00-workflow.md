# Rule 00 — Workflow

> **Scope:** All Poker Coach OS sprints and implementation sessions

---

## Sprint Phase Flow

All serious work must follow this phase sequence:

```
PREFLIGHT → IMPLEMENTATION → VERIFICATION → PROOF → CLOSEOUT → STATUS SYNC
```

**Never skip phases.** "It obviously worked" is not verification. "I'll update the docs later" is not closeout.

---

## Preflight Requirements

Before any implementation starts:
1. Read `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` — know the current state
2. Confirm sprint scope and non-goals are explicit
3. Confirm source of truth is identified
4. Use `/prompt-compose` for implementation-ready prompt

---

## Commit and Artifact Requirements

A sprint is not complete until:
- [ ] All changes are committed
- [ ] Tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Build passes (`pnpm build:web`) — if Table Sim in scope
- [ ] Proof artifacts exist in `out/poker/sprints/<SPRINT>/<DATE>/`
- [ ] Status docs are updated (`/status-sync`)

---

## Definition of Done

Work is done when ALL of the following are true:
1. Implementation is present in the repo
2. Relevant docs reflect the new truth
3. Verification has been run and captured
4. Proof artifacts exist
5. Status docs are updated
6. No known contradiction exists between docs, repo, and outputs

**"It works on my machine" is not done.**
**"Code is written" is not done.**
**"I'll test it later" is not done.**

---

## Session Close Standard

At the end of any implementation session:
- If the sprint is complete → run `/sprint-proof-bundle` then `/status-sync`
- If the sprint is incomplete → note what is done, what is next, and what is blocked
- Never leave the status docs stale

---

## Poker-Specific Constraints

These apply to ALL sprints:
- No network calls — local-first only
- All DB writes go through `packages/db/src/`
- Drill answer keys use action names (CALL/FOLD/RAISE) — never positional letters
- Rule tags: flat snake_case from VALID_TAGS enum only
- Classification tags: `category:value` format — never mixed with rule tags
- Pool-variant drills use `answer_by_pool` — never flatten to single answer
