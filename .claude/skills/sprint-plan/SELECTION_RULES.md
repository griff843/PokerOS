# Sprint Selection Rules — Poker Coach OS

> These rules determine how to prioritize and categorize sprints when running `/sprint-plan`.

---

## Poker Sprint Categories

| Category | Description | Examples |
|---|---|---|
| `AI-OS` | AI operating layer — skills, agents, rules, context bundle, adapters | Install sprint-plan skill, build agent-health |
| `CONTENT` | Drill content, node content, schema evolution | Add 10 new HU drills, migrate to canonical schema |
| `SCHEMA` | DB schema, migrations, drill schema | Add `pool_context` column, canonical schema migration |
| `COACHING-SURFACE` | UI views, coaching panels, concept/intervention displays | Concept audit feed UI adapter, drill replay panel |
| `REVIEW` | Hand/session review, mistake capture, replay logic | Session ingestion, hand import, mistake tagging |
| `DIAGNOSIS` | Leak detection, pattern recognition, performance analysis | Leak cluster view, tag-based weakness report |
| `INTERVENTION` | Active intervention tracking, coaching loops | Intervention execution view, progress tracking |
| `TRAINING` | Drills, study plans, learning loops | Pool-aware drill routing, difficulty progression |
| `INFRA` | Auth, middleware, monorepo structure, build | Passcode auth hardening, package dependency fixes |
| `PROOF` | Proof artifacts, closeout reports, verification | Proof bundle generation, context bundle script |

---

## Priority Rules

### Rule 1 — Active phase first
Sprints that directly advance the current active phase score higher than sprints outside the current phase.

### Rule 2 — Unblocked > blocked
A sprint where the architecture is settled and a clear source of truth exists scores higher than a sprint requiring architecture resolution first.

### Rule 3 — AI-OS is foundational in Phase 0–1
During Phase 0 and Phase 1, AI-OS sprints have elevated priority because they improve every subsequent sprint's execution quality.

### Rule 4 — Content before Training
Content must precede Training sprints — drills cannot be generated without content schemas and node coverage.

### Rule 5 — Schema changes require migration plans
No SCHEMA sprint may be recommended unless a migration strategy is documented or explicitly included in scope.

### Rule 6 — Review before Diagnosis
Review surfaces must precede Diagnosis sprints — you cannot diagnose leaks without ingested hand/session data.

---

## Disqualifiers

A sprint is disqualified from recommendation if:
- Its source-of-truth doc does not exist
- It requires architecture decisions that haven't been made
- It touches the canonical drill schema without including a migration strategy
- It touches `answer_by_pool` logic without explicit scope protection
