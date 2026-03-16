# Skill: agent-health

> **Portability:** Adapter-Based (Poker-adapted)
> **Invocation:** `/agent-health`
> **Purpose:** Diagnose the health of the Poker Coach OS AI operating layer — which skills, rules, agents, and docs are operational vs. missing vs. stale.

---

## When to Use

Use `/agent-health` when:
- Starting a new session and wanting to confirm AI OS integrity
- Something feels "off" about skill outputs — check if skills are reading stale docs
- After a major sprint to confirm status docs are current
- Periodically, to prevent silent drift in the AI operating layer

---

## Sources

| Source | Path | What to check |
|---|---|---|
| AI readiness checklist | `docs/ai/AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md` | Are all checklist items done? |
| Wave 2 skill plan | `docs/ai/AI_SKILL_WAVE_2_PLAN_v1.md` | What skills are planned vs. installed? |
| Project adapter | `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` | Is the adapter still accurate? |
| Current system status | `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md` | Is the status doc current? |
| Context bundle | `out/ai/context/context_bundle.md` | Is the context bundle up to date? |

---

## Procedure

### Step 1 — Skills Layer

Check which skills exist in `.claude/skills/`:

| Skill | Expected path | Status |
|---|---|---|
| `prompt-compose` | `.claude/skills/prompt-compose/SKILL.md` | Present / Missing |
| `sprint-proof-bundle` | `.claude/skills/sprint-proof-bundle/SKILL.md` | Present / Missing |
| `sprint-plan` | `.claude/skills/sprint-plan/SKILL.md` | Present / Missing |
| `status-sync` | `.claude/skills/status-sync/SKILL.md` | Present / Missing |
| `agent-health` | `.claude/skills/agent-health/SKILL.md` | Present / Missing |

### Step 2 — Rules Layer

Check which rules exist in `.claude/rules/`:

| Rule | Expected path | Status |
|---|---|---|
| Workflow | `.claude/rules/00-workflow.md` | Present / Missing |
| Safety + Proof | `.claude/rules/01-safety-and-proof.md` | Present / Missing |
| Testing + Verification | `.claude/rules/04-testing-and-verification.md` | Present / Missing |
| Output Formats | `.claude/rules/05-output-formats.md` | Present / Missing |

### Step 3 — Agents Layer

Check which agents exist in `.claude/agents/`:

| Agent | Expected path | Status |
|---|---|---|
| `ai-prompt-optimizer` | `.claude/agents/ai-prompt-optimizer.md` | Present / Missing |
| `documentation-maintainer` | `.claude/agents/documentation-maintainer.md` | Present / Missing |
| `repo-audit-specialist` | `.claude/agents/repo-audit-specialist.md` | Present / Missing |
| `code-optimizer` | `.claude/agents/code-optimizer.md` | Present / Missing |
| `codebase-navigator` | `.claude/agents/codebase-navigator.md` | Present / Missing |
| `proof-bundler` | `.claude/agents/proof-bundler.md` | Present / Missing |
| `sprint-manager` | `.claude/agents/sprint-manager.md` | Present / Missing |

### Step 4 — Status Doc Freshness

Check:
- When was `CURRENT_SYSTEM_STATUS.md` last updated? (See "Last updated" field)
- When was `context_bundle.md` last updated? (See "Generated" field)
- Is the current phase in the status doc still accurate given what is built?
- Is the "What is next" queue still relevant?

Flag as STALE if last update was more than 2 sprints ago with no update.

### Step 5 — Adapter Accuracy

Read `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md` §3 (Status surfaces) and §4 (Active phase).

Confirm:
- Active phase matches status doc
- Status doc paths are correct

### Step 6 — Classify result

**HEALTHY** — All skills present, rules present, agents present, status docs current, adapter accurate.

**DEGRADED** — One or more skills/agents missing, or status docs stale. List missing/stale items.

**CRITICAL** — Status docs are significantly outdated (3+ sprints behind), adapter is inaccurate, or multiple skills missing.

---

## Output Format

```
## Agent Health Report — Poker Coach OS
Date: <today>

Skills:  [■ ■ ■ ■ ■] 5/5 present / [■ ■ □ ■ ■] 4/5 — missing: <name>
Rules:   [■ ■ ■ ■] 4/4 present / [etc.]
Agents:  [■ ■ ■ ■ ■ ■ ■] 7/7 present / [etc.]

Status docs:
  CURRENT_SYSTEM_STATUS.md — last updated: <date> — CURRENT / STALE
  context_bundle.md        — last updated: <date> — CURRENT / STALE
  AI_PROJECT_ADAPTER       — phase: Phase <N> — ACCURATE / INACCURATE

Overall: HEALTHY / DEGRADED / CRITICAL

Issues:
- <issue 1 if any>
- <issue 2 if any>

Recommended action:
<one sentence — what to fix first if degraded/critical>
```

---

## Failure Protocol

If a source doc cannot be read:
- Mark the corresponding check as UNKNOWN
- Include in the Issues list
- Set overall status to DEGRADED at minimum
