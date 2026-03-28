# Content Operator Handbook

Use this when operating the gold-lane content pipeline by hand.

## 1. Create A Pending Batch

Never write unreviewed batches into `content/drills`.

Create batches under:

- `out/reports/gold-lane-reviews/pending/`

For repeatable batches, prefer the compact config generator:

```bash
pnpm drill:batch -- --config=scripts/templates/lane_batch_config_template.json
```

If you want a one-off shell, use the scaffold helper:

```bash
pnpm drill:scaffold -- --out=<pending-batch-path> --count=<N> --prefix=<prefix> --title="<title>"
```

The config format and placeholder fields are documented in:

- `docs/curriculum/LANE_BATCH_GENERATOR.md`

## 2. Validate Canonical Schema First

This is the real schema gate.

```bash
pnpm validate:canonical -- <pending-batch-path>
```

Structured JSON form:

```bash
pnpm validate:canonical -- --json <pending-batch-path>
```

## 3. Validate Lane Rules

This checks lane-specific mix and policy requirements.

```bash
pnpm validate:gold-json -- --mode=batch <pending-batch-path>
```

## 4. Review The Batch

```bash
pnpm review:gold-batch --batch=<pending-batch-path> --report=<review-report-path>
```

Do not merge if:
- canonical validation fails
- review recommends `NEEDS_REWRITE` or `REJECT`

## 5. Merge Only After Acceptance

```bash
pnpm review:gold-batch --batch=<pending-batch-path> --apply --report=<merge-report-path> --decision=accept --decision-notes="<notes>"
```

## 6. Archive The Accepted Batch

Move it out of `pending/` into:

- `out/reports/gold-lane-reviews/merged-batches/`

## 7. Validate Live Content

After merge, run:

```bash
pnpm validate:gold-seed
pnpm content:init
```

`pnpm content:init` is the final truth check.

If review passed but `content:init` fails, trust `content:init`.

## 8. Canonical Failure Patterns To Watch

- `range_support` buckets must be objects, not strings
- `steps[]` must include:
  - `step_id`
  - `street`
  - `decision_point`
  - `answer.required_tags`
- accepted content is not finished until the live content path loads cleanly
