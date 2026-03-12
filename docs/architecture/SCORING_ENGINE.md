# Scoring Engine

## Purpose

The scoring engine evaluates the quality of player decisions.

Scores determine spaced repetition updates, skill analytics, and leak detection.

---

## Scoring Modes

### CLI Scoring

| Component | Weight | Evaluation |
|---|---|---|
| Action correctness | 70% | Binary: correct/accepted = 0.7, else 0 |
| Concept reasoning (rule tags) | 30% | Proportional: matched/required x 0.3 |

### Table Sim Scoring (sizing enabled)

| Component | Weight | Evaluation |
|---|---|---|
| Action correctness | 50% | Binary: correct/accepted = 0.5, else 0 |
| Sizing accuracy | 20% | Binary: correct bucket = 0.2, else 0 |
| Concept reasoning (rule tags) | 30% | Proportional: matched/required x 0.3 |

### Table Sim Scoring (no sizing)

Falls back to CLI weights: 70% action + 30% tags.

---

## Score Range

- **0.0** — completely incorrect (wrong action, no tags)
- **0.3** — wrong action, all tags correct
- **0.7** — correct action, no tags
- **1.0** — fully correct (action + all tags)

## Pass Threshold

Default passing score: **0.6**

A score >= 0.6 triggers a positive SRS update (increased interval). Below 0.6 resets the drill to 1-day interval.

---

## Pool-Aware Scoring (Architecture)

When a drill includes pool-variant answers (`answer_by_pool`), the scoring engine evaluates against the active pool context for the session.

### Session Pool Selection

The player selects a pool type before starting a session:

- **Pool A** — Competent Regular
- **Pool B** — Passive Recreational (default)
- **Pool C** — Aggressive Gambler
- **Baseline** — GTO-approximation (no exploit)

### Drill Answer Resolution

```
If drill has answer_by_pool AND session has active pool:
  use answer_by_pool[active_pool] as the answer
Else:
  use drill.answer as the answer (default/baseline)
```

### Scoring Flow

```
1. Resolve the correct answer for the active pool
2. Compare player action vs resolved correct/accepted actions
3. Compare player tags vs resolved required_tags
4. Compute weighted score using the standard formula
5. Record attempt with pool context for analytics
```

### Attempt Record Extension

When pool-aware scoring is active, the attempt record includes:

```
{
  ...existing attempt fields,
  pool_context: "A" | "B" | "C" | "baseline" | null
}
```

This enables analytics queries like: "What is my accuracy on Pool B river bluff-catching spots?"

---

## Scoring Boundaries

The scoring engine intentionally does NOT evaluate:

| Capability | Status | Phase |
|---|---|---|
| Partial action credit | Not supported | Consider in Phase 3+ |
| Multi-street evaluation | Designed (average of per-step scores) | See DRILL_SCHEMA.md section 7 |
| Concept depth (why, not what) | Not supported | AI coaching handles this |
| Time pressure penalties | Data collected (elapsed_ms) but not scored | Consider in Phase 3+ |
| Confidence weighting | Not supported | Consider in Phase 4 |

These are documented boundaries, not bugs. The scoring model is designed to be simple and predictable. Deeper evaluation belongs in the AI coaching and analytics layers.

---

## Implementation Reference

- CLI scoring: `packages/core/src/scoring.ts` — `scoreDrill()`
- Table Sim scoring: `apps/table-sim/src/lib/scoring-adapter.ts` — `scoreTableSimDrill()`
- Constants: `ACTION_WEIGHT = 0.7`, `TAG_WEIGHT = 0.3`, `ACTION_ONLY_WEIGHT = 0.5`, `SIZING_WEIGHT = 0.2`
