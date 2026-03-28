You are working in the `poker-coach-os` repo.

Your task is to rewrite this invalid batch in place:

- `out/reports/gold-lane-reviews/pending/live_cash_gold_btn_bb_river_claude_batch3.json`

Do not move it back into `content/drills` yet.
Do not edit any other files.

Read these files first:

- `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- `content/drills/live_cash_gold_btn_bb_river.json`
- `out/reports/gold-lane-reviews/batch3-review.md`

Why this needs rewrite:

This batch is not just semantically weak. It is in the wrong schema.

Current problems:
- written in a non-canonical drill shape
- `scenario.street` and `scenario.pot_type` are missing or wrong for every drill
- `board` is written as a flat array instead of canonical board object
- `action_history` uses the wrong shape
- `decision_point` is written as a string instead of the canonical object
- `answer_by_pool` uses string shortcuts instead of full answer objects
- `diagnostic_prompts` use non-canonical field names
- `coaching_context.what_changed_by_street` is a string instead of an array
- `metadata.created_at` is not valid datetime format

This means the file is not loadable by the app and must be rewritten into the real canonical schema.

Required rewrite:

1. Keep the same lane family:
- `BTN vs BB SRP`
- `river bluff-catching`
- `40-120bb live cash`
- `real-hand follow-up bridge drills`

2. Keep the same high-level teaching goals:
- pool-misread follow-ups
- blocker-direction follow-ups
- thin threshold/kicker follow-ups
- multi-step turn-to-river follow-ups

3. Rewrite all 10 drills into the canonical schema used by:
- `content/drills/live_cash_gold_btn_bb_river.json`

4. Every drill must include:
- canonical `prompt`
- canonical `scenario.street: "river"`
- canonical `scenario.pot_type: "SRP"`
- canonical board object with `flop`, `turn`, `river`
- canonical `scenario.action_history` entries with proper fields
- canonical `decision_point` object
- canonical `answer`
- canonical `answer_by_pool` objects only where pool variants are truly needed
- canonical `diagnostic_prompts` with valid `id`, `type`, `expected_reasoning`, `options[].id`, and valid `diagnosis`
- canonical `coaching_context.range_support`
- canonical `coaching_context.what_changed_by_street` as an array
- canonical `coaching_context.follow_up`
- canonical `metadata.source: "ai_generated"`

5. Do not output to `content/drills` yet
- keep the rewritten file in:
  - `out/reports/gold-lane-reviews/pending/live_cash_gold_btn_bb_river_claude_batch3.json`

Quality bar:

These drills should feel like the next rep after a real live mistake.

Every drill must answer:
- what real-hand mistake led to this rep
- why the combo is above or below threshold
- which value hands survive the line
- which bluffs still arrive by river
- what the turn action removed or preserved
- what exact leak is being corrected

Canonical enum rules:

`metadata.source`:
- `ai_generated`

`diagnostic_prompts[].type` must be one of:
- `line_understanding`
- `threshold`
- `range_construction`
- `blocker`
- `pool_assumption`
- `street_shift`
- `mix_reasoning`

`diagnostic_prompts[].options[].diagnosis` must be one of:
- `line_misunderstanding`
- `threshold_error`
- `range_construction_error`
- `blocker_blindness`
- `pool_assumption_error`
- `confidence_miscalibration`

Before finishing, run:
- `node scripts/validate-gold-lane.mjs --mode=batch out/reports/gold-lane-reviews/pending/live_cash_gold_btn_bb_river_claude_batch3.json`
- `pnpm review:gold-batch --batch=out/reports/gold-lane-reviews/pending/live_cash_gold_btn_bb_river_claude_batch3.json --report=out/reports/gold-lane-reviews/batch3-review-rewrite.md`

Do not run `pnpm content:init` with this file still in `pending/`, because that command only matters after the batch is accepted and moved into live content.

Success condition:
- the batch validator passes
- the review report recommendation is `ACCEPT` or close enough to require only minor semantic edits

Final response format:
1. A short summary of what you changed
2. The exact file path you edited
3. Whether the review report still shows soft flags or spot checks
4. Any drills that still feel strategically borderline
