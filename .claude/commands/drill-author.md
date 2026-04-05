# drill-author

Scaffold a new drill batch, stage it to pending, and validate it — ready for gold-lane review.

## Usage

```
/drill-author [--count=N] [--prefix=<name>] [--lane=<lane>]
```

- `--count` — number of drills to scaffold (default: 10)
- `--prefix` — id prefix for generated drills (default: `batch`)
- `--lane` — lane context hint passed to scaffold (e.g. `live_cash`, `preflop_3bp`)

## Steps

1. Determine the output path:
   - `out/reports/gold-lane-reviews/pending/<prefix>_<YYYY-MM-DD>.json`
   - Create the directory if it does not exist.

2. Run the scaffold command:
   ```bash
   pnpm drill:scaffold -- --out=<output-path> --count=<count> --prefix=<prefix>
   ```

3. Validate the batch immediately after scaffold:
   ```bash
   node scripts/validate-gold-lane.mjs --mode=batch <output-path>
   ```

4. Report the result:
   - List each drill id and whether it passed validation.
   - For any failure, show the field path and error message.
   - If all pass: confirm the batch is ready for `/gold-lane-review`.
   - If any fail: show the issues and wait for user direction before proceeding.

## Constraints

- Never write directly to `content/drills/` — all new drills go to pending first.
- `answer.correct` and `options[].key` must use canonical action names: `CALL`, `FOLD`, `RAISE`, `BET`, `CHECK`.
- `answer.required_tags` values must come from `VALID_TAGS` in `packages/core/src/tags.ts`.
- `answer_by_pool` entries must be full answer objects, not shorthand strings.
- `scenario.pot_type` must be one of: `SRP | 3BP | 4BP | limp | squeeze | multiway`.
- `scenario.street` must be one of: `preflop | flop | turn | river`.
