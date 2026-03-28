# Claude Parallel Prompt - BTN vs BB SRP River Bluff-Catch Lane

Use this prompt with Claude Code as a bounded parallel content-authoring task.

## Prompt

You are working in the `poker-coach-os` repo.

Your task is to author a **new independent batch** of gold-standard live cash drills for this lane:

- `BTN vs BB SRP`
- `river bluff-catching`
- `40-120bb live cash`

Do **not** modify existing gold-lane files.

Create a new file:

- `content/drills/live_cash_gold_btn_bb_river_claude_batch1.json`

Read these files first:

- `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- `content/drills/live_cash_gold_btn_bb_river.json`
- `content/nodes/bluff_catch/bluff_catch_01.json`
- `content/nodes/bluff_catch/bluff_catch_02.json`

## Output Requirements

Author `12` new drills.

Required mix:

- `3` paired top-card river bluff-catch spots
- `3` scare-card ace river spots
- `3` polar or overbet river defense spots
- `3` blocker-sensitive folds or thin continues

At least:

- `4` drills should use `node_id: "bluff_catch_01"`
- `4` drills should use `node_id: "bluff_catch_02"`
- `2` drills should include `steps`
- every drill must include `diagnostic_prompts`
- every drill must include `coaching_context.range_support`
- every drill must include `scenario.action_history`

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

## Validation

Before finishing:

- make sure the JSON parses cleanly
- make sure the file shape matches the examples in `content/drills/live_cash_gold_btn_bb_river.json`
- do not edit any files outside your assigned output file

## Final Response Format

Return:

1. A short summary of what you added
2. The exact file path you created
3. Any drills that felt borderline or uncertain
