# Claude Drill Workflow

Use this workflow whenever Claude authors or rewrites drill batches.

The goal is to reduce schema friction, shorten prompts, and keep unreviewed content out of the live runtime path.

## Scope

This workflow applies to:
- new gold-lane batches
- rewrites of rejected or `NEEDS_REWRITE` batches
- sibling-lane expansion batches

It does not replace lane-specific instructions. It is the shared operational workflow.

## 1. Read The Right Context

Before authoring, Claude should read:
- `CLAUDE.md`
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md`
- the relevant lane spec
- the accepted seed file for that lane
- the latest review report for that lane, if one exists

Do not re-derive enum values or schema rules from memory.

## 2. Stage, Never Land Directly

Unreviewed batch files must go under:

- `out/reports/gold-lane-reviews/pending/`

Do not write unreviewed files into:

- `content/drills`

Why:
- `pnpm content:init` loads every JSON file in `content/drills`
- one malformed batch can break the live content path

## 3. Scaffold First

Before authoring from scratch, generate a valid shell:

```bash
pnpm drill:scaffold -- --out=<pending-batch-path> --count=<N> --prefix=<batch_prefix> --title="<batch title>"
```

Then edit that scaffolded file in place.

For repeatable lane families, the compact config generator is faster:

```bash
pnpm drill:batch -- --config=scripts/templates/lane_batch_config_template.json
```

The config format is documented in:

- `docs/curriculum/LANE_BATCH_GENERATOR.md`

## 4. Canonical Validation Loop

After authoring, run:

```bash
pnpm validate:gold-json -- --mode=batch <pending-batch-path>
```

If validation fails:
- read `errors[]`
- fix by `errors[].path`
- do not guess
- re-run until `ok: true`

## 5. Editorial Review Loop

Then run:

```bash
pnpm review:gold-batch --batch=<pending-batch-path> --report=<review-report-path>
```

Goal:
- `Recommended: ACCEPT`

If review says `NEEDS_REWRITE`:
- fix the exact semantic issues
- re-run review
- do not move the batch yet

## 6. Final Response Format

Claude should return only:

1. What was added
2. Exact file path
3. Whether validator passed
4. Whether review produced soft flags or spot checks
5. Any strategically borderline drills
6. Any validator limitations or false positives

## 7. Hard Rules

- Do not invent enum values
- Do not invent schema fields
- Do not use shorthand pool answers
- Do not put strings where arrays or objects are required
- Do not fake solver precision
- Prefer honest uncertainty over fake certainty
- Keep the lane narrow and strategic
- Do not copy prior drills with simple card swaps
- Do not move a batch into `content/drills` before explicit acceptance

## 8. Canonical Commands

Scaffold:

```bash
pnpm drill:scaffold -- --out=<pending-batch-path> --count=<N> --prefix=<prefix> --title="<title>"
```

Structured validation:

```bash
pnpm validate:gold-json -- --mode=batch <pending-batch-path>
```

Editorial review:

```bash
pnpm review:gold-batch --batch=<pending-batch-path> --report=<review-report-path>
```

## 9. Canonical Enum Reminder

`metadata.source`:
- `manual`
- `ai_generated`
- `session_import`
- `solver`

`diagnostic_prompts[].type`:
- `line_understanding`
- `threshold`
- `range_construction`
- `blocker`
- `pool_assumption`
- `street_shift`
- `mix_reasoning`

`diagnostic_prompts[].options[].diagnosis`:
- `line_misunderstanding`
- `threshold_error`
- `range_construction_error`
- `blocker_blindness`
- `pool_assumption_error`
- `confidence_miscalibration`

## 10. Canonical Shape Reminder

- `prompt` is required
- `scenario.street` must be one of `preflop | flop | turn | river`
- `scenario.pot_type` must be one of `SRP | 3BP | 4BP | limp | squeeze | multiway`
- `scenario.board` is an object with:
  - `flop`
  - `turn`
  - `river`
- `scenario.action_history[]` entries use:
  - `street`
  - `player`
  - `action`
  - optional `size_bb`
  - optional `size_pct_pot`
- `decision_point` is an object, not a string
- `answer_by_pool` entries are full answer objects, not shorthand action strings
- `coaching_context.what_changed_by_street` is an array of `{ street, detail }`
- `coaching_context.range_support.threshold_notes` is an array, not a string
- `diagnostic_prompts[]` require:
  - `id`
  - `type`
  - `prompt`
  - `expected_reasoning`
  - `options[].id`
  - `options[].label`
  - `options[].diagnosis`

## 11. Acceptance And Merge

Claude should not merge batches unless explicitly asked.

Once a batch is accepted, the main agent can:
- merge it into the lane file
- archive the batch under `out/reports/gold-lane-reviews/merged-batches/`
- keep `content/drills` free of accepted batch duplicates
