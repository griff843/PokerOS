# Poker OS — GitHub Execution Model

## Purpose

This document defines how GitHub Issues and PRs function as the active execution control plane for Poker OS. It governs how work is scoped, tracked, validated, and closed.

Claude and Codex agents operate from this model. Human review governs lane approval and merge.

---

## Control Plane Principle

**GitHub Issues are the unit of work. PRs are the unit of proof.**

- No significant code change without a linked issue
- No issue closed without an acceptance-criteria checklist and proof artifact
- No PR merged without a linked issue and passing `pnpm verify`

---

## Issue Types

Two templates exist under `.github/ISSUE_TEMPLATE/`:

### `execution_lane.yml`
Standard work lane. Used for feature work, hardening, content, and surface additions.

Use when: scoping a bounded piece of implementation work with a clear proof path.

### `truth_audit.yml`
Reconciliation lane. Used when docs, gap tracker, or architecture claims diverge from code truth.

Use when: gap tracker rows need verification, route inventory doesn't match docs, or a "Missing" capability appears to be partially built.

---

## Label Taxonomy

Create these labels in the GitHub UI before creating issues.

### Type
| Label | Use |
|-------|-----|
| `type:execution-lane` | Implementation work |
| `type:truth-audit` | Reconciliation and verification |
| `type:content` | Drill authoring, node expansion |
| `type:infra` | Build, CI, migrations, tooling |

### Priority
| Label | Use |
|-------|-----|
| `priority:p0` | Blocks the core loop from functioning |
| `priority:p1` | Degrades coaching quality or data trust |
| `priority:p2` | Improvement, enrichment, expansion |

### Area
| Label | Use |
|-------|-----|
| `area:persistence` | DB writes, migrations, repository layer |
| `area:ui` | React components, pages, routing |
| `area:coaching-engine` | Player intelligence, intervention logic, session planning |
| `area:content` | Drills, nodes, tags, gold-lane content |
| `area:api` | Next.js API routes |
| `area:real-hands` | Hand import, follow-up session, real-play bridge |

### Phase
| Label | Use |
|-------|-----|
| `phase:3-integration` | Phase 3 — System Integration |
| `phase:4-coaching` | Phase 4 — Coaching Intelligence |
| `phase:5-real-play` | Phase 5 — Real Play Integration |

---

## Milestones

Align with MASTER_ROADMAP phases. Create in GitHub UI.

| Milestone | Scope |
|-----------|-------|
| Phase 3 — System Integration | Close all persistence gaps, unify session loop, harden SRS |
| Phase 4 — Coaching Intelligence | Diagnostic prompts, adaptive curriculum, intervention surface |
| Phase 5 — Real Play Integration | Hand ingestion, real-play leak analysis |

---

## Issue Scoping Rules

1. **One PR or tightly related PR set per issue.** If a lane would require 3+ unrelated PRs, split it.
2. **Acceptance criteria must be checkboxes.** If you cannot write verifiable checkboxes, scope is too vague.
3. **Every issue must name its proof artifact.** A passing `pnpm verify` plus a specific observable (route returns expected JSON, UI renders X, test output shows Y).
4. **Dependencies must be explicit.** List blocking issue numbers, not vague references.
5. **Out of scope must be filled in.** It defines the blast radius. If it is blank, the issue is too vague to execute.

---

## PR Protocol

Every PR must:

1. Link to the issue it closes (`Closes #N`)
2. Pass `pnpm verify` (typecheck + test + build)
3. Include proof: test output, API response sample, or screenshot for UI lanes
4. Have the acceptance criteria checklist reviewed before merge

The PR template at `.github/PULL_REQUEST_TEMPLATE.md` enforces this.

---

## Agent Operating Rules

When Claude or Codex works on an issue:

- Read the issue's **In scope** before touching anything
- Read the issue's **Out of scope** before touching anything
- Run `pnpm verify` before marking work complete
- Write the proof artifact as part of the PR, not after
- Do not expand scope mid-lane. Open a new issue if scope creep is discovered

---

## Execution Flow

```
INITIAL_GITHUB_BACKLOG.md
        ↓
  Create issues in GitHub UI
        ↓
  Assign to sprint / milestone
        ↓
  Agent or human picks up issue
        ↓
  Branch: <issue-number>/<short-slug>
        ↓
  Implement within In-scope bounds
        ↓
  pnpm verify passes
        ↓
  PR opened, acceptance criteria checked
        ↓
  Human reviews and merges
        ↓
  Issue closed, gap tracker updated if needed
```

---

## Gap Tracker Discipline

`COACH_EQUIVALENCE_GAP_TRACKER.md` must stay in sync with code truth.

- When a truth audit issue closes, update the gap tracker row
- Do not mark a capability "Complete" without a route or test to point at
- When code outpaces docs, a truth audit issue should be filed, not the gap tracker manually edited without proof

---

## Source of Truth Hierarchy

When docs and code disagree, trust this order:

1. Running code and passing tests
2. DB migrations (what tables exist)
3. API routes (what endpoints are live)
4. This execution model
5. Gap tracker
6. Roadmap docs
