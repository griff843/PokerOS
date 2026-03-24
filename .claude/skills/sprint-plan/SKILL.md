# Skill: sprint-plan

> **Portability:** Adapter-Based (Poker-adapted)
> **Invocation:** `/sprint-plan`
> **Purpose:** Read current status docs and produce the next best sprint recommendation with rationale, model choice, and a ready-to-paste prompt.

---

## When to Use

Use `/sprint-plan` when:
- Starting a new session and unsure what to work on next
- Evaluating several candidate sprints against current project state
- Wanting the AI to read the current truth stack and recommend the highest-value next move

Do not use for:
- Mid-sprint decisions (just continue the sprint)
- Pure architecture exploration (use Lane 1 with ChatGPT instead)

---

## Sources

Read these docs in order before producing a recommendation:

| Source | Path | What to extract |
|---|---|---|
| Current system status | `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` | What is done, in-progress, and next |
| Project adapter | `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` | Active phase, artifact conventions, constraints |
| Wave 2 plan | `docs/ai/AI_SKILL_WAVE_2_PLAN_v1.md` | Planned helpers and priority order |
| AI readiness checklist | `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` | What AI OS items are still open |

If there are sprint closeout reports in `out/poker/sprints/`, read the most recent one for context on what just completed.

---

## Procedure

### Step 1 — Read the status stack

Read all four sources above. Note:
- What phase is active
- What was recently completed
- What is marked as "next"
- Any known gaps or open items

### Step 2 — Classify candidate sprints

Using what you read, identify 2–4 candidate sprints. Classify each using the Poker sprint categories from SELECTION_RULES.md.

### Step 3 — Score and select

Score each candidate against:
- **Impact** — does it advance the active phase?
- **Readiness** — is the architecture settled? Are source-of-truth docs available?
- **Risk** — does it touch high-complexity or fragile areas?
- **Dependency** — does anything else block it?

Select the highest-scoring sprint that is ready to execute.

### Step 4 — Select model

Consult MODEL_SELECTION.md to determine which Claude model to recommend for the sprint.

### Step 5 — Produce output

Output:
1. **Recommended sprint** — one-sentence description
2. **Category** — from Poker sprint categories
3. **Rationale** — 2–3 sentences: why this sprint now, what it unblocks
4. **Model recommendation** — which model + why
5. **Starter prompt** — a ready-to-paste prompt template from PROMPT_TEMPLATES.md, pre-filled with sprint context

---

## Output Format

```
## Sprint Recommendation

**Sprint:** <SPRINT-NAME>
**Category:** <CATEGORY>
**Model:** <claude-sonnet-4-6 | claude-opus-4-6 | claude-haiku-4-5>

**Rationale:**
<2–3 sentences>

**Starter Prompt:**
<Filled template — paste into Claude Code to begin>
```

---

## Failure Protocol

If sources cannot be read or are contradictory:
- Name the missing or conflicting source
- Do not guess the current state
- Ask the operator to confirm before proceeding
