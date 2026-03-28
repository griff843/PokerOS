# Lane Batch Generator

Use this when you want to scaffold a pending gold-lane batch from a compact config instead of hand-writing a long prompt.

## Command

```bash
pnpm drill:batch -- --config=scripts/templates/lane_batch_config_template.json
```

You can also override fields inline:

```bash
pnpm drill:batch -- --out=out/reports/gold-lane-reviews/pending/my_batch.json --count=10 --prefix=gold_bc_tr99 --title="Memory-Decisive River" --lane-family="BTN vs BB SRP turn-to-river"
```

## Config Fields

The generator reads a JSON object with these fields:

- `out`
- `count`
- `prefix`
- `title`
- `node` or `node_id`
- `laneFamily` or `lane_family`
- `promptTemplate` or `prompt_template`
- `metadataNotes` or `metadata_notes`
- `metadataTags` or `metadata_tags`

## Template Placeholders

`promptTemplate` supports these placeholders:

- `{{number}}`
- `{{index}}`
- `{{prefix}}`
- `{{title}}`
- `{{node}}`
- `{{laneFamily}}`
- `{{laneSlug}}`

## What It Guarantees

- writes only to the path you pass in `out`
- generates canonical scaffold drills from `scripts/templates/drill_batch_template.json`
- fills the required coaching sections used by the gold-lane workflow
- stamps lane-family metadata into each drill so the batch is easier to review later

## Recommended Workflow

1. Scaffold with `pnpm drill:batch`
2. Validate with `pnpm validate:canonical -- <pending-batch-path>`
3. Validate lane rules with `pnpm validate:gold-json -- --mode=batch <pending-batch-path>`
4. Review with `pnpm review:gold-batch`

