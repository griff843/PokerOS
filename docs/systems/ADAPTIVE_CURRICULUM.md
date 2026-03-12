# Adaptive Curriculum

## Purpose

The adaptive curriculum automatically adjusts study sessions based on player performance, directing focus toward the weakest concepts and exploit patterns.

---

## Data Inputs

| Input | Source | Tag Layer |
|---|---|---|
| Drill attempt history | `attempts` table | — |
| Rule tag miss rate | `attempts.missed_tags_json` | Rule tags |
| Classification tag accuracy | `attempts` joined with `drills.tags_json` | Classification tags |
| Response times | `attempts.elapsed_ms` | — |
| Pool context | `attempts.pool_context` | — |
| SRS state | `srs` table | — |

---

## Weakness Detection

The system identifies weak areas by analyzing classification tags on failed or low-scoring attempts.

### By Classification Tag Category

Group attempts by classification tag and compute accuracy:

```
street:river accuracy = 45%        → WEAK
pot:srp accuracy = 72%             → OK
concept:blocker_effect accuracy = 38%  → WEAK
decision:bluff_catch accuracy = 41%    → WEAK
```

**Threshold**: Classification tag accuracy below 50% triggers a focused study recommendation.

### By Rule Tag Miss Rate

Track which rule tags players consistently fail to identify:

```
paired_top_river miss rate = 15%   → OK
underfold_exploit miss rate = 62%  → WEAK
overbluff_punish miss rate = 55%   → WEAK
```

**Threshold**: Rule tag miss rate above 40% triggers a tag-focused study block.

### By Pool Context

When pool-aware scoring is active, detect pool-specific weaknesses:

```
Pool B accuracy = 52%    → WEAK (not adjusting enough for passive players)
Pool A accuracy = 71%    → OK
Pool C accuracy = 68%    → OK
```

**Threshold**: Per-pool accuracy below 55% triggers a pool-focused study block.

---

## Study Plan Generation

When weaknesses are detected, the system generates targeted study sessions.

### Focused Drill Sessions

Select drills matching the weak classification tags:

```
Weakness: concept:blocker_effect accuracy < 50%
→ Query: drills WHERE tags LIKE '%concept:blocker_effect%'
→ Prioritize by: lowest accuracy first, then least recently attempted
→ Session size: 10-15 drills
```

### Node Checklist Review

Surface the relevant node's `checklist_md` as a study primer before drilling:

```
Weakness: decision:bluff_catch at street:river
→ Surface checklist for nodes tagged with river bluff-catching
→ Player reads checklist, then drills
```

### Pool Exploit Blocks

When pool-specific accuracy is low:

```
Weakness: Pool B accuracy < 55%
→ Generate session of drills that have answer_by_pool.B entries
→ Force pool context to "B" for the session
→ AI coaching highlights exploit adjustments throughout
```

---

## Integration with SRS

The adaptive curriculum works alongside SRS, not replacing it:

- **SRS** determines WHEN individual drills are reviewed (time-based scheduling)
- **Adaptive curriculum** determines WHAT to study next (weakness-based prioritization)

When a study session is generated:

1. Pull drills matching the weak tags
2. Among those, prioritize SRS-due drills first
3. Fill remaining slots with new or non-due drills from the same tag set
4. Record attempts normally — SRS updates as usual

---

## Concept Mastery Model

Each classification tag accumulates a mastery level based on recent attempt history:

```
mastery = weighted average of last N attempts on drills with this tag
  weight = recency (more recent attempts weighted higher)
  range = 0.0 (no mastery) to 1.0 (full mastery)
```

Mastery levels drive the adaptive curriculum and can be displayed in the player's dashboard:

| Mastery | Level | Study Action |
|---|---|---|
| 0.0 - 0.3 | Needs work | High-priority study block |
| 0.3 - 0.5 | Developing | Moderate-priority study block |
| 0.5 - 0.7 | Competent | SRS handles review scheduling |
| 0.7 - 1.0 | Mastered | Reduce frequency, focus elsewhere |

---

## Goal

Focus study time on the areas with the greatest improvement potential. The player should always know what to work on next, and the system should be smart enough to direct them there automatically.
