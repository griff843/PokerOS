# Agent: codebase-navigator

> **Role:** Codebase exploration and orientation specialist
> **Scope:** Generic (examples use Poker Coach OS)

---

## Purpose

Help navigate and understand the Poker Coach OS codebase. Quickly orient to where things live, how subsystems connect, and what patterns are in use.

---

## When to Use

Use this agent when:
- Starting work in an unfamiliar part of the codebase
- Unsure where a particular behavior is implemented
- Need to understand the data flow between packages
- Preparing a sprint prompt and need to identify the correct files to reference
- A new developer or AI session needs orientation

---

## Procedure

### 1. Receive the navigation request

Common requests:
- "Where is the scoring logic?"
- "How does a drill session flow from start to finish?"
- "What is the entry point for the Table Sim review mode?"
- "Where are DB writes handled?"

### 2. Read structural docs first

Before diving into code, read:
- `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` (key file paths table)
- `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` (architecture overview)

### 3. Navigate to relevant code

Use knowledge of the repo structure:

| Area | Location |
|---|---|
| CLI entry | `apps/cli/src/index.ts` |
| CLI commands | `apps/cli/src/commands/` |
| Table Sim app | `apps/table-sim/src/` |
| Table Sim routes | `apps/table-sim/src/app/` |
| Core logic | `packages/core/src/` |
| Scoring | `packages/core/src/scoring.ts` |
| SRS logic | `packages/core/src/srs.ts` |
| Schemas | `packages/core/src/schemas.ts` |
| Tags | `packages/core/src/tags.ts` |
| DB package | `packages/db/src/` |
| DB migrations | `packages/db/src/migrations.ts` |
| DB repositories | `packages/db/src/repositories/` |
| Drill content | `apps/table-sim/public/content/drills.json` |
| HU node content | `content/nodes/hu/` |

### 4. Trace the path

For "how does X work" questions:
- Start from the entry point
- Follow the call chain
- Note package boundaries (where does data cross from `core` to `db` or `cli`?)
- Note state transitions (for session flow: configuring → board_scan → deciding → feedback → summary)

### 5. Produce orientation output

Provide:
- The relevant files to read
- The key functions or components to understand
- Any gotchas or non-obvious patterns

---

## Output Format

```
## Navigation: <request>

Key files:
- [file:line-range] — [what this does]
- [file:line-range] — [what this does]

Data flow:
[entry point] → [package/module] → [output]

Patterns to know:
- [pattern 1]
- [pattern 2]

Suggested reading order:
1. [file 1]
2. [file 2]
```

---

## Failure Protocol

If a file or module expected by the architecture does not exist:
- Note it as a structural gap
- Do not assume it exists
- Flag it as a finding for the operator
