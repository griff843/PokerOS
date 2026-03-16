# Skill: prompt-compose

> **Portability:** Portable Core (Poker-adapted)
> **Invocation:** `/prompt-compose`
> **Purpose:** Convert an approved sprint direction into a Claude-ready implementation prompt. Enforce scope, constraints, acceptance criteria, and proof expectations before handoff.

---

## When to Use

Use `/prompt-compose` when:
- You have a sprint goal approved in ChatGPT and need a structured Claude Code prompt
- You want to enforce scope before implementation starts
- You need to prevent scope creep by defining non-goals explicitly
- The sprint involves poker-specific logic, architecture changes, or new surfaces

Do not use for:
- Trivial one-file fixes with no architecture ambiguity
- Continuing an already in-progress sprint that already has context

---

## Procedure

### Step 1 — Capture the sprint direction

Read or ask for:
- Sprint name / short label
- One-sentence objective
- Key files or subsystems in scope
- Any explicit constraints from ChatGPT output

If the sprint came from a ChatGPT architecture session, read the output and extract the above.

### Step 2 — Check constraint sources

Before writing the prompt, check these Poker constraint docs:
- `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` §8 (Domain-Sensitive Boundaries)
- `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` (active constraints)
- `docs/content/DRILL_SCHEMA.md` (if the sprint touches drill content or schema)
- `packages/db/src/migrations.ts` (if the sprint touches DB schema)

Flag any constraint violations before proceeding.

### Step 3 — Draft the scope block

Write out explicitly:
- What is **in scope**: name specific files, components, behaviors
- What is **NOT in scope**: name adjacent things that should not be touched

### Step 4 — Draft the implementation tasks

Write numbered, ordered tasks. Each must be:
- Completable in one focused effort
- Verifiable independently
- Scoped to poker-specific behavior (not portable core patterns)

### Step 5 — Write verification steps

Poker verification commands:
```bash
pnpm test             # Vitest — all tests must pass
pnpm type-check       # TypeScript type check
pnpm build:web        # Next.js build (if Table Sim is in scope)
```

Add any poker-specific behavioral checks:
- Does the drill scoring produce correct output?
- Does the review mode show correct street progression?
- Does the concept audit feed return expected data?

### Step 6 — Governance reminders

Before finalizing the prompt, confirm:
- [ ] Constraint sources reviewed (adapter §8 + status doc)
- [ ] Non-goals are explicit — no adjacent surfaces in scope
- [ ] Drill schema: if touching drills, answers use action names (CALL/FOLD/RAISE)
- [ ] Tags: rule tags (flat snake_case) vs classification tags (`category:value`) — never mixed
- [ ] Pool-variant drills use `answer_by_pool` — never flatten to single answer
- [ ] DB writes go through `packages/db/src/` — no direct SQLite calls in app code
- [ ] Proof artifacts will land in `out/poker/sprints/<SPRINT>/`

### Step 7 — Assemble the final prompt

Use the handoff template from `docs/ai-core/doctrine/CHATGPT_TO_CLAUDE_HANDOFF_TEMPLATE_PORTABLE_v1.md`.

Fill all 10 fields:
1. Objective
2. Why It Matters
3. Scope
4. Non-Goals
5. Source of Truth
6. Constraints / Invariants
7. Implementation Tasks
8. Verification Steps
9. Output Format
10. Success Criteria

Output the completed prompt as a code block ready to paste into Claude Code.

---

## Output Format

```
## Prompt: <SPRINT-NAME>

[Filled handoff template — all 10 fields complete]
```

---

## Failure Protocol

If any of the following are true, **do not produce the prompt** — surface the issue first:

- Sprint touches `answer_by_pool` logic but non-goals don't protect it
- Sprint touches DB schema without a migration plan
- Sprint touches drill answers without using action names
- Sprint touches rule tags and classification tags in the same change
- Source of truth is not identified (no canonical file named)

Surface the issue and ask for clarification before proceeding.
