# Claude Rewrite Prompt - BTN vs BB SRP River Bluff-Catch Batch 2

Use this prompt with Claude Code as a focused rewrite pass on the existing batch 2 file.

## Prompt

You are working in the `poker-coach-os` repo.

Your task is to revise this file in place:

- `content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`

Do not create a new batch file. Do not edit any other files.

Read these files first:

- `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- `docs/curriculum/CLAUDE_PARALLEL_PROMPT_BTN_BB_RIVER_BATCH2.md`
- `out/reports/gold-lane-reviews/batch2-review.md`
- `content/drills/live_cash_gold_btn_bb_river.json`

## Why This Needs Rewrite

The batch passed hard validation but is not yet gold-lane quality.

Current review result:

- `Recommended: NEEDS_REWRITE`

Main problem:

- all 10 drills are missing `coaching_context.what_changed_by_street`
- all 10 drills are missing `coaching_context.follow_up`

That means the batch is structurally valid but still too flat for coach-level review.

## Required Rewrite

For each of the 10 drills in `content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`:

1. Add `coaching_context.what_changed_by_street`
   - include street-specific notes that explain what each street removed, preserved, or reweighted
   - do not use generic filler like "range got stronger" or "line looks weak"
   - each note should name actual value or bluff regions when possible

2. Add `coaching_context.follow_up`
   - one concrete next study idea per drill
   - it should point at the next threshold question, blocker question, or pool-adjustment question
   - keep it short but specific

3. Add `coaching_context.follow_up_concepts` where appropriate
   - use existing `concept:*` style classification strings when helpful

4. Keep all current canonical enums valid
   - do not regress `metadata.source`
   - do not invent new `diagnostic_prompts[].type`
   - do not invent new `diagnostic_prompts[].options[].diagnosis`

## Quality Bar

The new `what_changed_by_street` notes must make the coaching panel feel like a real hand-history explanation.

Good examples:

- "Turn check removes AQ and KQ that wanted protection, but preserves delayed floats like J9 and T8."
- "Ace river improves some value, but more importantly it gives missed broadway floats a credible bluffing story."
- "Paired river tightens value toward boats while leaving delayed air largely unchanged."

Bad examples:

- "The turn changed things."
- "The river is scary."
- "Villain got stronger."

The `follow_up` line should feel like a coach assigning the next rep:

- "Study where T9 crosses threshold on paired-top rivers after turn x/x."
- "Compare this blocker fold to Q-high hands that block value instead of bluffs."

## Validation

Before finishing, run:

- `node scripts/validate-gold-lane.mjs --mode=batch content/drills/live_cash_gold_btn_bb_river_claude_batch2.json`
- `pnpm content:init`
- `pnpm review:gold-batch --batch=content/drills/live_cash_gold_btn_bb_river_claude_batch2.json --report=out/reports/gold-lane-reviews/batch2-review-rewrite.md`

The goal is for the review report recommendation to improve from `NEEDS_REWRITE` to `ACCEPT`.

## Final Response Format

Return:

1. A short summary of what you changed
2. The exact file path you edited
3. Whether the new review report still contains any soft flags
