# Drill Authoring Guide

## Purpose

Defines standards for writing drills used by the training system. This guide is the practical reference for content authors. For the full technical schema specification, see `docs/content/DRILL_SCHEMA.md`.

---

## Drill JSON Schema

Every drill is a JSON object conforming to the canonical drill schema. Here is a complete example:

```json
{
  "drill_id": "srp_river_bluffcatch_01",
  "node_id": "hu_01",
  "version": "1.0.0",
  "title": "SRP River Bluff-Catch — Paired Top Card",
  "prompt": "SRP. You called preflop in the BB with Jh9h. Board: Js 7c 3d 2h Jd. Villain bets 75% pot on the river. The top card paired. Do you call or fold?",
  "scenario": {
    "game": "NLHE Cash",
    "street": "river",
    "pot_type": "SRP",
    "players_to_flop": 2,
    "hero_position": "BB",
    "villain_position": "BTN",
    "effective_stack_bb": 100,
    "pot_size_bb": 12,
    "board": {
      "flop": ["Js", "7c", "3d"],
      "turn": "2h",
      "river": "Jd"
    },
    "hero_hand": ["Jh", "9h"],
    "action_history": [
      { "street": "preflop", "player": "villain", "action": "open", "size_bb": 3 },
      { "street": "preflop", "player": "hero", "action": "call" },
      { "street": "flop", "player": "hero", "action": "check" },
      { "street": "flop", "player": "villain", "action": "bet", "size_pct_pot": 50 },
      { "street": "flop", "player": "hero", "action": "call" },
      { "street": "turn", "player": "hero", "action": "check" },
      { "street": "turn", "player": "villain", "action": "check" },
      { "street": "river", "player": "villain", "action": "bet", "size_pct_pot": 75 }
    ]
  },
  "decision_point": {
    "street": "river",
    "facing": { "action": "bet", "size_pct_pot": 75 }
  },
  "options": [
    { "key": "CALL", "label": "Call" },
    { "key": "FOLD", "label": "Fold" },
    { "key": "RAISE", "label": "Raise" }
  ],
  "answer": {
    "correct": "CALL",
    "accepted": [],
    "required_tags": ["paired_top_river"],
    "explanation": "You have trips with a decent kicker. The paired top card on the river reduces villain's value combos. Even vs Pool B which underbluffs, trips is too strong to fold."
  },
  "answer_by_pool": {
    "B": {
      "correct": "FOLD",
      "accepted": [],
      "required_tags": ["paired_top_river", "underfold_exploit"],
      "explanation": "Pool B under-bluffs this river. Their bet is value-heavy. Fold weak holdings."
    }
  },
  "tags": [
    "street:river",
    "pot:srp",
    "position:oop",
    "spot:btn_vs_bb",
    "board:paired",
    "concept:blocker_effect",
    "decision:bluff_catch"
  ],
  "difficulty": 2
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `drill_id` | Yes | Unique descriptive ID (see NODE_TAXONOMY.md) |
| `node_id` | Yes | FK to parent node, must match `^[a-z0-9_]+$` |
| `version` | Yes | Semver string, default "1.0.0" |
| `title` | Yes | Short human-readable title |
| `prompt` | Yes | Full scenario text shown to the player |
| `scenario` | Yes | Structured poker situation (see below) |
| `decision_point` | Yes | What the player decides (street, facing action) |
| `options` | Yes | 2-5 action choices. Key = action name, label = display text |
| `answer` | Yes | Baseline/GTO correct answer |
| `answer_by_pool` | No | Pool-variant answers (keys: "A", "B", "C") |
| `tags` | Yes | Classification tags in `category:value` format (min 1, target 3-6) |
| `difficulty` | Yes | 1 (basic) to 5 (advanced) |
| `steps` | No | Multi-street decision sequence (see DRILL_SCHEMA.md section 7) |
| `coaching_context` | No | Extra hints for AI coaching |
| `metadata` | No | Authoring info, source tracking |

### Important: Option keys are action names

Option `key` values must be **canonical action names in uppercase**: `CALL`, `FOLD`, `RAISE`, `BET`, `CHECK`, `OPEN`, `3BET`, `4BET`.

The `answer.correct` field must match an `options[].key` value exactly. This is a change from the legacy format which used positional letters ("A", "B", "C").

---

## Scenario Model

Every drill includes a structured `scenario` describing the poker situation:

| Field | Required | Description |
|---|---|---|
| `game` | Yes | Default "NLHE Cash" |
| `street` | Yes | "preflop", "flop", "turn", or "river" |
| `pot_type` | Yes | "SRP", "3BP", "4BP", "limp", "squeeze", "multiway" |
| `players_to_flop` | Yes | 2 for heads-up, 3+ for multiway |
| `hero_position` | Yes | "BB", "BTN", "CO", "SB", "HJ", "UTG" |
| `villain_position` | Yes | Primary villain's position |
| `effective_stack_bb` | No | Effective stacks in big blinds |
| `pot_size_bb` | No | Pot size at decision point |
| `board` | Conditional | Required for postflop. Null for preflop |
| `hero_hand` | No | `["Jh", "9h"]`. Null for range-level drills |
| `action_history` | No | Array of actions leading to this decision |

Card format: rank + suit — `2-9`, `T`, `J`, `Q`, `K`, `A` + `s`, `h`, `d`, `c`

---

## Two Tag Layers

Drills use **two distinct types of tags** with different purposes:

### Rule Tags (`answer.required_tags`)

- **Purpose**: Scored during drill attempts (30% of total score)
- **Format**: Flat `snake_case` strings from the `VALID_TAGS` enum
- **What they test**: The player's ability to identify the key concept at the spot
- **Examples**: `paired_top_river`, `cbet_dry_flop`, `equity_denial`
- **Minimum**: Every drill must have at least 1 rule tag

### Classification Tags (`tags[]`)

- **Purpose**: Categorize the drill for analytics, curriculum, and coaching
- **Format**: `category:value` (colon-separated)
- **Not scored**: Players never see or interact with classification tags
- **Target**: 3-6 per drill

Available categories: `street`, `pot`, `position`, `spot`, `board`, `concept`, `decision`, `pool`

See TAGGING_SYSTEM.md for the full category reference.

---

## Pool Variant Answers (`answer_by_pool`)

When the correct action changes based on opponent type, include `answer_by_pool`:

- **Key "A"**: Correct answer vs Competent Regular
- **Key "B"**: Correct answer vs Passive Recreational
- **Key "C"**: Correct answer vs Aggressive Gambler
- **Fallback**: `answer` is used when no pool is selected (baseline/GTO)

Not every drill needs pool variants. Include them only when the correct action genuinely differs. If the answer is the same regardless of pool, omit `answer_by_pool`.

Each pool entry has: `correct`, `accepted`, `required_tags`, `explanation`.

---

## Canonical Enums You Must Not Invent

Some fields are strict enums. If authors improvise here, the drill may look fine in JSON but fail the real content loader.

### `metadata.source`

Allowed values only:

- `manual`
- `ai_generated`
- `session_import`
- `solver`

### `diagnostic_prompts[].type`

Allowed values only:

- `line_understanding`
- `threshold`
- `range_construction`
- `blocker`
- `pool_assumption`
- `street_shift`
- `mix_reasoning`

### `diagnostic_prompts[].options[].diagnosis`

Allowed values only:

- `line_misunderstanding`
- `threshold_error`
- `range_construction_error`
- `blocker_blindness`
- `pool_assumption_error`
- `confidence_miscalibration`

### Common Wrong Values

These are examples of values that may sound reasonable but are invalid:

- `range_discipline`
- `line_reading`
- `blocker_misread`
- `blocker_ignored`
- custom `metadata.source` values like `claude_batch1`

If you need one of these concepts, map it to the nearest canonical enum rather than inventing a new one.

---

## Staging Rule For Claude Batches

Unreviewed Claude batches must not live in `content/drills`.

Why:

- `pnpm content:init` loads every JSON file inside `content/drills`
- one malformed Claude batch can break app boot and poison the live content path

Stage unreviewed batches under:

- `out/reports/gold-lane-reviews/pending/`

Only move a batch into `content/drills` after:

- `node scripts/validate-gold-lane.mjs --mode=batch <path>` passes
- `pnpm review:gold-batch --batch=<path>` produces an acceptable recommendation
- the batch is explicitly accepted for merge

---

## Prompt Requirements

Every prompt must include:

- **Positions**: Hero and villain positions (e.g., "BTN vs BB")
- **Pot type**: SRP, 3-bet pot, etc.
- **Board**: Full board for the decision street (omit for preflop)
- **Hero hand**: Specific holding
- **Stack depth**: Effective stacks if relevant (especially deep/shallow)
- **Action history**: What happened before this decision
- **Facing action**: What the player is responding to (e.g., "Villain bets 75% pot")

The prompt should give the player everything they need to make a decision, as if they were at the table. The `scenario` object provides the same information as structured data — the prompt is the human-readable version.

---

## Explanation Requirements

Every explanation (in `answer` and each `answer_by_pool` entry) must include:

1. **Why the answer is correct** — not just "call is correct" but the strategic reason
2. **The concept being applied** — connect to the rule tag(s)
3. **Range dynamics** — what does villain's range look like at this spot?
4. **Population context** — how does the opponent type affect the decision?
5. **What would need to be true for the other answer** — "to call profitably here, villain would need to bluff at least X% of the time"

---

## Design Principles

- Drills train **strategic reasoning**, not memorization
- The player should understand **why**, not just **what**
- Pool variant explanations should **contrast** answers: "vs Pool A you call because X, but vs Pool B you fold because Y"
- Avoid trivial spots where the answer is obvious
- Difficulty should increase from basic recognition (1-2) to nuanced exploitation (4-5)
- Each drill should be self-contained — no dependency on other drills

---

## Node ID Reference

Drill `node_id` values must match an existing node. See NODE_TAXONOMY.md for the ID convention:

- Legacy: `hu_01` through `hu_10` (existing nodes)
- New: descriptive IDs like `srp_river_bluffcatch_btn_vs_bb`, `pf_open_co`

---

## Full Schema Reference

For the complete technical specification including multi-street drills, Table Sim compatibility, validation rules, and downstream system dependencies, see:

**`docs/content/DRILL_SCHEMA.md`**
