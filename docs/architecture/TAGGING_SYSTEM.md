# Tagging System

## Purpose

The tagging system classifies every drill and decision using structured conceptual labels.

Tags allow the system to:

- score drill attempts (rule tags)
- identify conceptual weaknesses (classification tags)
- group related drills for study blocks
- generate targeted study plans
- power AI coaching explanations
- drive leak detection analytics

---

## Two-Layer Architecture

The tagging system has two distinct layers with different purposes, formats, and validation rules.

### Layer 1: Rule Tags (Scoring)

**Purpose**: Evaluated during scoring to measure concept recognition.

**Format**: Flat `snake_case` strings.

**Validation**: Enum array in `packages/core/src/tags.ts` (`VALID_TAGS`).

**Used in**: `drill.answer.required_tags` (and `answer_by_pool.{pool}.required_tags`).

**How it works**: The player selects rule tags during a drill. The scoring engine compares selected tags against `required_tags` and awards proportional credit (30% weight).

**Current rule tags** (v1):

| Tag | Concept |
|---|---|
| `paired_top_river` | Top card paired on river — reduces villain value combos |
| `scare_river_ace` | Ace on river as scare card — population folds too much |
| `turn_overbet_faced` | Facing overbet on turn — polarized range response |
| `flush_complete_turn` | Flush completes on turn — adjusts continuing range |
| `four_liner_river` | Four-to-a-straight on river — board texture caution |
| `polar_turn_big_bet` | Polarized turn sizing — big bet = nuts or air |
| `overbet_opportunity` | Spot where overbetting is profitable |
| `multiway_context` | Multiway pot adjustments (reserved for v1.1) |

**Expansion plan**: As content grows, new rule tags are added to the `VALID_TAGS` array. Target: 30-50 rule tags covering board texture, bet sizing concepts, range dynamics, and exploit patterns.

**Future rule tag examples**:

| Tag | Concept |
|---|---|
| `cbet_dry_flop` | C-bet on dry/static flop texture |
| `cbet_wet_flop` | C-bet on wet/dynamic flop texture |
| `range_advantage_ip` | In-position range advantage at the spot |
| `nut_advantage` | Nut hand distribution favors one player |
| `equity_denial` | Betting to deny equity realization |
| `blocker_effect` | Hand contains key blockers to villain range |
| `merge_vs_passive` | Merge betting vs passive population |
| `overbluff_punish` | Exploit aggressive population's overbluffing |
| `underfold_exploit` | Exploit passive population's under-folding |
| `thin_value_deep` | Thin value extraction at deep stacks |

---

### Layer 2: Classification Tags (Analytics)

**Purpose**: Categorize drills for filtering, analytics, curriculum planning, leak detection, and AI coaching.

**Format**: `category:value` (colon-separated).

**Validation**: Category must be registered. Values are freeform within each category (or enum for fixed categories like street/pot).

**Used in**: `drill.tags[]`, node filtering, analytics queries, adaptive curriculum.

**Not used in scoring.** Classification tags are metadata — they describe what a drill is about, not what the player must recognize.

### Classification Tag Categories

#### street (fixed enum)

| Tag | Meaning |
|---|---|
| `street:preflop` | Preflop decision |
| `street:flop` | Flop decision |
| `street:turn` | Turn decision |
| `street:river` | River decision |

#### pot (fixed enum)

| Tag | Meaning |
|---|---|
| `pot:srp` | Single raised pot |
| `pot:3bp` | 3-bet pot |
| `pot:4bp` | 4-bet pot |
| `pot:limp` | Limped pot |
| `pot:multiway` | Multiway pot |
| `pot:squeeze` | Squeeze pot |

#### position (fixed enum)

| Tag | Meaning |
|---|---|
| `position:ip` | In position |
| `position:oop` | Out of position |

#### spot (freeform, convention-based)

Examples: `spot:btn_vs_bb`, `spot:co_vs_btn`, `spot:sb_vs_bb`

#### board (freeform, convention-based)

Examples: `board:paired`, `board:monotone`, `board:dynamic`, `board:dry`, `board:connected`

#### concept (freeform — the richest category)

Examples:
- `concept:range_advantage`
- `concept:polarization`
- `concept:equity_denial`
- `concept:blocker_effect`
- `concept:pot_odds`
- `concept:implied_odds`
- `concept:protection`
- `concept:merge_betting`
- `concept:thin_value`
- `concept:balance`
- `concept:node_lock`
- `concept:mdf`

#### decision (freeform, convention-based)

Examples: `decision:cbet`, `decision:check_raise`, `decision:bluff_catch`, `decision:value_bet`, `decision:probe`, `decision:overbet`, `decision:fold`, `decision:3bet`

#### pool (fixed enum)

| Tag | Meaning |
|---|---|
| `pool:pool_a` | Drilled against competent regulars |
| `pool:pool_b` | Drilled against passive recreationals |
| `pool:pool_c` | Drilled against aggressive gamblers |
| `pool:baseline` | GTO baseline (no exploit) |

---

## Tag Usage by System

| System | Uses Rule Tags | Uses Classification Tags |
|---|---|---|
| Scoring engine | Yes — 30% weight | No |
| SRS scheduling | Indirect (via score) | No |
| Drill authoring | Yes — required_tags | Yes — tags[] |
| Leak detection | Yes — missed_tags analysis | Yes — group by concept/decision |
| Adaptive curriculum | No | Yes — weakness by category |
| AI coaching | Yes — explain why tag matters | Yes — contextualize the spot |
| Review / reports | Yes — top missed tags | Yes — filter by category |
| Session config | No | Yes — filter drills by tag |

---

## Tag Validation Strategy

### Rule Tags
- Validated at content load time via Zod enum (`z.enum(VALID_TAGS)`)
- Adding a new rule tag requires updating the `VALID_TAGS` array
- This is intentionally strict — rule tags are part of the scoring contract

### Classification Tags
- Validated at content load time: category prefix must be registered
- New values within a category are allowed without code changes
- Adding a new category requires updating the category registry
- This is intentionally flexible — classification tags grow with content

---

## Design Principles

- Rule tags test **concept recognition** — the player must identify them
- Classification tags describe **what the drill is about** — the system uses them
- Every drill must include at least one rule tag in `required_tags`
- Every drill should include 3-6 classification tags in `tags[]`
- Tags should support analytics queries: "show me all my flop c-bet attempts" = `WHERE tags LIKE '%decision:cbet%' AND tags LIKE '%street:flop%'`
- The two-layer system preserves backward compatibility with all existing drills and scoring logic
