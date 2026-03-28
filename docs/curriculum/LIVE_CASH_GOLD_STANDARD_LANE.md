# Live Cash Gold-Standard Lane

## Purpose

This document defines the first lane we should push to coach-like quality before expanding the rest of live cash:

- `BTN vs BB SRP`
- `river bluff-catching`
- `40-120bb live cash`

This is the best first proving ground because it scores highest on:

- frequency
- EV impact
- exploit variance
- transfer value into real live sessions

If this lane does not feel coach-level, widening the product will only create polished mediocrity.

## Gold-Standard Definition

A drill in this lane is **not** good enough just because it has:

- a plausible hand
- a correct action
- a short explanation

A drill in this lane is only gold-standard if it includes:

1. Full line context
2. Pool-aware answer shifts when they are real
3. Explicit range logic
4. At least one reasoning check
5. Honest threshold language
6. A clear follow-up concept

## Minimum Authoring Standard

Every new drill in this lane should include:

- `scenario.action_history`
- `answer_by_pool` when the answer changes in live pools
- `coaching_context.range_support`
- `coaching_context.what_changed_by_street`
- `coaching_context.common_mistakes`
- `diagnostic_prompts`

Target shape per authored batch:

- `8-12` drills
- at least `2` paired-board bluff-catch spots
- at least `2` scare-card river spots
- at least `2` polar overbet spots
- at least `2` blocker-sensitive threshold spots

## What Good Looks Like

The explanation should answer all of these:

- Why is this combo above or below threshold?
- Which value hands survive this line?
- Which bluffs still arrive by river?
- What did the turn action remove or preserve?
- Why does pool type change the threshold, if it does?

## What Bad Looks Like

Reject drills that sound like:

- "Call because population overbluffs."
- "Fold because this line is strong."
- "He has missed draws often enough."
- "Top pair is too good to fold."

Those are shortcuts, not coaching truth.

## Authoring Rules For Claude

When using Claude Code to mass-author content in this lane:

- Keep the node tightly scoped to `BTN vs BB SRP river bluff-catching`.
- Prefer fewer stronger drills over many shallow drills.
- Do not invent solver frequencies unless they are deliberately marked as heuristic.
- Always write range buckets in human poker language first, combo examples second.
- Always include one diagnostic prompt with at least `3` answer options.
- Include pool variants only when the action meaningfully changes.
- When unsure, choose honest uncertainty over fake precision.

## Immediate Build Order

1. Paired top-card rivers after turn check-through
2. Scare-card ace rivers after turn check-through
3. Polar river overbets from aggro recreational players
4. Thin threshold bluff-catch folds with bad blockers

## Exit Criteria

We can say this lane is ready when:

- the drills feel coach-like on review, not quiz-like
- the app can point to range buckets instead of generic prose
- the reasoning check catches real misunderstandings
- real hands from this lane can map back into follow-up drills
- the player can study this lane for a week and clearly explain why combos call or fold
