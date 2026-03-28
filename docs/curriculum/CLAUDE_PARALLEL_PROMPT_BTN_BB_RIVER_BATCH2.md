# Claude Parallel Prompt - BTN vs BB SRP River Bluff-Catch Lane Batch 2

Use this prompt with Claude Code as a bounded parallel content-authoring task.

## Prompt

You are working in the `poker-coach-os` repo.

Your task is to author a **new independent batch** of gold-standard live cash drills for this lane:

- `BTN vs BB SRP`
- `river bluff-catching`
- `40-120bb live cash`

Do **not** modify existing gold-lane files.

Create a new file:

- `content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`

Read these files first:

- `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- `docs/curriculum/CLAUDE_PARALLEL_PROMPT_BTN_BB_RIVER.md`
- `content/drills/live_cash_gold_btn_bb_river.json`
- `content/drills/live_cash_gold_btn_bb_river_claude_batch1.json`
- `content/nodes/bluff_catch/bluff_catch_01.json`
- `content/nodes/bluff_catch/bluff_catch_02.json`

## Output Requirements

Author `10` new drills.

Required mix:

- `3` thin top-pair or second-pair bluff-catch spots where kicker quality is the main threshold driver
- `3` blocker-driven continue or fold spots where hero blocks bluffs or value in a non-trivial way
- `2` scare-card river spots that are **not** ace rivers
- `2` multi-step drills where the turn decision sets up the river bluff-catch

At least:

- `4` drills should use `node_id: "bluff_catch_01"`
- `4` drills should use `node_id: "bluff_catch_02"`
- `2` drills should include `steps`
- every drill must include `diagnostic_prompts`
- every drill must include `coaching_context.range_support`
- every drill must include `scenario.action_history`

## Canonical Enum Rules

Do not invent enum values.

### `metadata.source`

Use only:

- `manual`
- `ai_generated`
- `session_import`
- `solver`

For this batch, use:

- `metadata.source: "ai_generated"`

### `diagnostic_prompts[].type`

Use only:

- `line_understanding`
- `threshold`
- `range_construction`
- `blocker`
- `pool_assumption`
- `street_shift`
- `mix_reasoning`

### `diagnostic_prompts[].options[].diagnosis`

Use only:

- `line_misunderstanding`
- `threshold_error`
- `range_construction_error`
- `blocker_blindness`
- `pool_assumption_error`
- `confidence_miscalibration`

If you want to express "line reading", use `line_understanding`.

If you want to express "range discipline", use `range_construction`.

If you want to express "misread or ignored blocker", use `blocker_blindness`.

## Quality Bar

These drills are **not** quiz cards.

Every drill must feel coach-like and answer:

- Why is this combo above or below threshold?
- Which value hands survive the line?
- Which bluffs still arrive by river?
- What did the turn action remove or preserve?
- Why does pool type change the answer, if it does?

Reject shallow explanations like:

- "call because population overbluffs"
- "fold because line is strong"
- "top pair is too strong to fold"

## Constraints

- Use only valid rule tags from `packages/core/src/tags.ts`
- Keep classification tags in `category:value` form
- Prefer honest uncertainty over fake solver precision
- Do not invent exact solver frequencies
- Use pool variants only when the action meaningfully changes
- Keep the work narrowly inside this lane
- Do not copy prior drills with only card swaps; each spot should teach a meaningfully different threshold lesson

## Validation

Before finishing:

- make sure the JSON parses cleanly
- make sure the file shape matches the examples in `content/drills/live_cash_gold_btn_bb_river.json`
- run:
  - `node scripts/validate-gold-lane.mjs --mode=batch content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`
  - `pnpm content:init`
- if either command fails, fix the file before responding
- do not edit any files outside your assigned output file

## Final Response Format

Return:

1. A short summary of what you added
2. The exact file path you created
3. Any drills that felt borderline or uncertain

## Reviewer Workflow

After Claude returns, review the batch with:

- `pnpm review:gold-batch --batch=content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`

If the dry run passes and the content is semantically acceptable, merge it with:

- `pnpm review:gold-batch --batch=content/drills/live_cash_gold_btn_bb_river_claude_batch2.json --apply`
