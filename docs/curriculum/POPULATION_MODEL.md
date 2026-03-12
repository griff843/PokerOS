# Population Model

## Purpose

The population model is the **core differentiator** of Poker Coach OS.

It defines common opponent archetypes in live mid/high stakes poker and provides a systematic framework for exploitative adjustments. No competing training platform offers structured exploit training against categorized live player pools.

Every drill, scoring decision, and coaching explanation should be informed by the population model.

---

## Core Pools

### Pool A — Competent Regular

**Profile**: Thinking player who understands theory. Found at mid/high stakes, often online converts or experienced live regs.

| Tendency | Detail |
|---|---|
| Aggression | Balanced — bets and checks at appropriate frequencies |
| Bluff frequency | Close to GTO — enough bluffs to make you indifferent |
| Fold frequency | Defends correctly vs standard sizing |
| Sizing | Intentional — uses different sizes for different ranges |
| Reads | Adjusts to your tendencies |

**Exploit adjustments vs Pool A**:
- Play close to GTO baseline (limited exploits available)
- Thin value becomes important — they call correctly
- Avoid unbalanced bluffs — they notice and adjust
- Look for specific leaks rather than population-level adjustments
- Focus on range and positional advantages

### Pool B — Passive Recreational

**Profile**: The most common live player type. Plays for entertainment, rarely studies. Found across all live stakes.

| Tendency | Detail |
|---|---|
| Aggression | Low — prefers calling over raising |
| Bluff frequency | Under-bluffs significantly |
| Fold frequency | Over-folds to aggression, especially raises |
| Sizing | Inconsistent — often min-bets or pot-bets |
| Reads | Minimal — plays own cards, not your range |

**Exploit adjustments vs Pool B**:
- **Bluff more**: They over-fold, especially to raises and multi-street aggression
- **Bluff-catch less**: Their bets (especially raises) are under-bluffed; believe them
- **Value bet thinner**: They call with wide ranges of medium-strength hands
- **Merge ranges**: Bet medium-strength hands for value that would check vs Pool A
- **Reduce check-raise bluffs**: They won't fold when they bet
- **Overbet for value**: They look at their hand, not the sizing

### Pool C — Aggressive Gambler

**Profile**: Action player who enjoys gambling. Over-represents bluffs, plays loose-aggressive. Found at all live stakes, especially late at night.

| Tendency | Detail |
|---|---|
| Aggression | Very high — raises and 3-bets frequently |
| Bluff frequency | Over-bluffs — bets and raises with too many weak hands |
| Fold frequency | Under-folds — hates folding, calls light |
| Sizing | Large and inconsistent — loves overbets and all-ins |
| Reads | Erratic — sometimes perceptive, often impulsive |

**Exploit adjustments vs Pool C**:
- **Bluff-catch more**: Their bets contain too many bluffs; call wider
- **Bluff less**: They don't fold enough; save your bluffs
- **Trap more**: Check strong hands to let them bluff
- **Tighten preflop**: Let them put money in bad; play premium hands in big pots
- **Call down lighter**: One pair is often good vs their range
- **Avoid hero folds**: Their aggression is often unfounded

---

## Exploit Matrix

Quick reference for how the correct action changes by pool:

| Spot | Pool A (GTO) | Pool B (Passive) | Pool C (Aggressive) |
|---|---|---|---|
| River facing bet | Call (indifferent) | Fold (under-bluffs) | Call (over-bluffs) |
| River with value hand | Bet standard | Bet thin / overbet | Check to induce |
| Turn barrel decision | Barrel balanced | Barrel more (they fold) | Barrel less (they call) |
| Facing raise | Depends on MDF | Usually fold (they have it) | Usually call (they bluff) |
| Preflop 3-bet defense | Defend GTO range | Fold more (they 3-bet tight) | Call/4-bet wider |
| C-bet multiway | Check often | Bet more (they fold) | Check-call more |

---

## Integration with Training Pipeline

### 1. Session Configuration

Before starting a drill session, the player selects a pool type:

```
Pool selection:
  [A] Competent Regular
  [B] Passive Recreational (default)
  [C] Aggressive Gambler
  [Baseline] GTO (no exploit)
```

The selected pool determines which answer variant is scored as correct.

### 2. Drill Schema: `answer_by_pool`

Drills that train exploit awareness include pool-conditional answers:

```json
{
  "drill_id": "srp_river_bluffcatch_01",
  "answer": {
    "correct": "CALL",
    "accepted": [],
    "explanation": "GTO baseline: call to remain indifferent...",
    "required_tags": ["paired_top_river"]
  },
  "answer_by_pool": {
    "A": {
      "correct": "CALL",
      "accepted": [],
      "explanation": "Pool A bluffs enough to make calling correct...",
      "required_tags": ["paired_top_river"]
    },
    "B": {
      "correct": "FOLD",
      "accepted": [],
      "explanation": "Pool B under-bluffs this river. Their bet is heavily weighted toward value...",
      "required_tags": ["paired_top_river", "underfold_exploit"]
    },
    "C": {
      "correct": "CALL",
      "accepted": [],
      "explanation": "Pool C over-bluffs. Call even with marginal bluff-catchers...",
      "required_tags": ["paired_top_river", "overbluff_punish"]
    }
  },
  "tags": ["street:river", "pot:srp", "decision:bluff_catch", "concept:blocker_effect", "board:paired"]
}
```

**Note**: The `"baseline"` pool option does not need a key in `answer_by_pool`. When the player selects "Baseline" (GTO, no exploit), the system uses the top-level `answer` field as the fallback. Only include `answer_by_pool` entries for pools where the correct action genuinely differs.

### 3. Scoring

The scoring engine resolves the correct answer based on the active pool context. See SCORING_ENGINE.md for details.

### 4. Analytics

Attempt records include `pool_context`, enabling queries like:
- "My accuracy vs Pool B on river spots"
- "Tags I miss most often when playing vs Pool C"
- "Am I adjusting enough between pool types?"

### 5. AI Coaching

The AI coaching layer uses pool context to explain WHY the correct answer differs:
- "You chose call, which is correct vs Pool A and Pool C. But you selected Pool B for this session. Pool B under-bluffs this river, so their bet is almost always value. Folding is correct here because..."

### 6. Adaptive Curriculum

When the player consistently misses pool-specific adjustments, the adaptive curriculum generates focused study blocks:
- "You're scoring well on baseline spots but poorly on Pool B exploit spots. Here's a focused session on identifying under-bluffed lines."

---

## Design Principles

- The population model is **central**, not supplementary — it should affect every drill
- Pool definitions should be **specific and actionable**, not vague personality types
- Exploit adjustments should be **concrete**: "fold more" not "adjust accordingly"
- Not every drill needs all 3 pool variants — some spots have the same answer regardless
- When answers differ by pool, the **explanation must teach why**
- The player should learn to **identify pool type at the table**, not just study against labels
