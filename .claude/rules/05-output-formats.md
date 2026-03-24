# Rule 05 — Output Formats

> **Scope:** All Poker Coach OS sprints, proof artifacts, and closeout reports

---

## Sprint Closeout Report Format

Location: `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/proof.md`

Required sections (in order):
1. Sprint identity (name, date, branch, phase)
2. Objective (one sentence)
3. What Was Built (bulleted)
4. Verification Results (table: command | result | notes)
5. Git State (log + diff stat)
6. Known Issues / Follow-up (explicit "None" if none)
7. Status Doc Updates Required (checklist)
8. Closeout Verdict (CLOSED / BLOCKED)

---

## Proof File Formats

| File | Format | Required content |
|---|---|---|
| `proof.md` | Markdown | Closeout template (see Rule 01) |
| `test-output.txt` | Plain text | Raw `pnpm test` output |
| `typecheck-output.txt` | Plain text | Raw `pnpm typecheck` output |
| `build-output.txt` | Plain text | Raw `pnpm build:web` output |
| `git-state.txt` | Plain text | `git status` + `git log --oneline -5` + `git diff --stat HEAD~1` |

---

## Directory Structure Conventions

```
out/
  poker/
    sprints/
      <SPRINT-NAME>/
        <YYYYMMDD>/
          proof.md
          test-output.txt
          typecheck-output.txt
          build-output.txt      (if applicable)
          git-state.txt
    reports/
    proof/
    diagnostics/
  ai/
    context/
      context_bundle.md
```

**Sprint names:** Use kebab-case. Match the Linear issue or ChatGPT sprint name. Examples:
- `concept-audit-feed-ui-adapter`
- `canonical-drill-schema-migration`
- `ai-os-step-4-7-install`

**Dates:** YYYYMMDD format. Example: `20260316`

---

## Status Doc Format

`docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md`:
- Section headers: `##` level
- Completion markers: `COMPLETE` in bold for finished surfaces
- Last updated date at top
- Active phase at top
- Key file paths as a table

`out/ai/context/context_bundle.md`:
- Prefixed with "Generated:" date
- Recent sprint history as a table
- Known gaps as a numbered list

---

## Skill and Agent Output Formats

All skill and agent outputs should use:
- Code blocks for commands and command output
- Tables for structured comparisons
- Checklists for verification items
- Bold for verdicts (`HEALTHY`, `DEGRADED`, `PASS`, `FAIL`, `CLOSED`, `BLOCKED`)

Verbosity standard: concise but complete. No filler. Every sentence should carry information.
