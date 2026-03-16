# Linear Sync Guide — Poker Coach OS

> If Poker Coach OS uses Linear for issue tracking, use this guide to sync sprint closeouts to Linear after running `/status-sync`.

---

## When to Sync Linear

Sync Linear when:
- A sprint is closed out and verified
- A new sprint is starting (create the issue)
- A known gap discovered during closeout needs to be tracked

---

## Issue Format

Poker Coach OS Linear issues should use:
- **Title:** `[CATEGORY] Short description` — e.g., `[COACHING-SURFACE] Concept audit feed UI adapter`
- **Labels:** Use the sprint category from `sprint-plan/SELECTION_RULES.md`
- **Status:** Use standard Linear statuses (Todo, In Progress, Done)

---

## Sprint Closeout → Linear Update

After closing a sprint:

1. Find the Linear issue for the sprint
2. Mark it **Done**
3. Add a comment with the closeout summary:
   - What was built
   - Verification result
   - Artifact path (`out/poker/sprints/<SPRINT>/<DATE>/`)

---

## New Sprint → Linear Issue

When creating a new sprint issue:
- Title: `[CATEGORY] <sprint-name>`
- Description: paste the implementation prompt from `/prompt-compose`
- Assign to yourself
- Set status to **In Progress** when you start Claude Code

---

## If Poker Does Not Use Linear

Skip this file. No Linear sync is required. The status docs in `docs/poker-coach-os/status/` and `out/ai/context/context_bundle.md` are the canonical truth. Linear is optional enhancement.
