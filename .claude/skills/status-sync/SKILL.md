# Skill: status-sync

> **Portability:** Adapter-Based (Poker-adapted)
> **Invocation:** `/status-sync <SPRINT-NAME>`
> **Purpose:** Sync repo status docs after every sprint closeout. Prevent drift between what the code does, what docs say, and what is tracked.

---

## When to Use

Use `/status-sync` immediately after a sprint closeout:
- After writing the proof bundle (`/sprint-proof-bundle`)
- Before marking a sprint complete in any tracking system
- Whenever the current-state docs are stale relative to what was just built

---

## Decision Gate

Before running, confirm:
- Was a sprint actually completed? (If no, stop — running status-sync on incomplete work creates false status)
- Is the proof bundle written? (If no, write it first)
- Are you working in the correct branch?

---

## Status Docs to Update

| Doc | Path | When to update |
|---|---|---|
| Current system status | `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` | Every sprint |
| Context bundle | `out/ai/context/context_bundle.md` | Every sprint |
| Project adapter | `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` | When phase or constraints change |
| Drill schema | `docs/content/DRILL_SCHEMA.md` | When drill schema evolves |

---

## Procedure

### Step 1 — Read the closeout report

Read `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/proof.md`.

Extract:
- What was built
- What verification passed
- Any known issues
- Status doc update targets listed in the report

### Step 2 — Update CURRENT_SYSTEM_STATUS.md

Apply changes following UPDATE_RULES.md:
- Move completed items from "in progress" to "done"
- Remove completed items from "what is next" if they were there
- Add newly discovered gaps to "what is next"
- Update "Active constraints" if constraints changed
- Update "Last updated" date

### Step 3 — Update context_bundle.md

- Add sprint to "Recent Sprint History" table
- Update "What Is Complete" if a significant surface was added
- Update "Known Gaps / Next Work" to reflect new understanding
- Update "Generated" date

### Step 4 — Update adapter (if needed)

Update `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` only if:
- The active phase changed
- A key doc path was added or changed
- A new constraint was established
- The artifact conventions changed

### Step 5 — Verify no drift

After updates, read all three docs and confirm:
- They are internally consistent
- They all reflect the same current phase
- "What is next" is consistent between status doc and context bundle

---

## Output Format

```
Status sync complete for: <SPRINT-NAME>

Updated:
- docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md
- out/ai/context/context_bundle.md
- [docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md — if changed]

No drift detected. / Drift found: [description]
```

---

## Failure Protocol

If the closeout proof.md does not exist:
- Stop — do not update status docs
- Surface: "Proof bundle not found for <SPRINT-NAME>. Run /sprint-proof-bundle first."

If docs are contradictory after update:
- Name the contradiction
- Do not leave docs in an inconsistent state
