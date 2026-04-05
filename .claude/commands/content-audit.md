# content-audit

Audit all drill and node content files against the canonical schema — surfaces schema violations, invalid tags, and structural drift.

## Usage

```
/content-audit [--drills] [--nodes] [--fix-report]
```

- `--drills` — audit `content/drills/` only (default: both)
- `--nodes` — audit `content/nodes/` only (default: both)
- `--fix-report` — write a machine-readable fix list to `out/reports/content-audit-<date>.json`

## Steps

1. Run the canonical drill validator:
   ```bash
   npx tsx scripts/validate-canonical-drills.ts
   ```

2. For each drill file, check:
   - `answer.correct` is one of: `CALL`, `FOLD`, `RAISE`, `BET`, `CHECK`
   - `options[].key` uses only canonical action names
   - `answer.required_tags` values are all present in `VALID_TAGS` (from `packages/core/src/tags.ts`)
   - `answer_by_pool` keys are only `A`, `B`, `C` and values are full answer objects
   - `scenario.street` is one of: `preflop | flop | turn | river`
   - `scenario.pot_type` is one of: `SRP | 3BP | 4BP | limp | squeeze | multiway`
   - `decision_point` is an object (not a string)
   - `metadata.source` is one of: `manual | ai_generated | session_import | solver`
   - `diagnostic_prompts[].type` uses only canonical enum values
   - `diagnostic_prompts[].options[].diagnosis` uses only canonical enum values

3. For each node file, check:
   - `id` matches `^[a-z0-9_]+$`
   - All referenced drill ids exist in `content/drills/`

4. Produce a summary:
   - Total files checked
   - Pass count / fail count
   - Per-file: list of violations with field path and expected vs actual value

5. If `--fix-report` is passed, write the structured violation list to `out/reports/content-audit-<YYYY-MM-DD>.json` for programmatic fixing.

## Reference

- `docs/content/DRILL_SCHEMA.md` — canonical field definitions
- `packages/core/src/tags.ts` — `VALID_TAGS` export
- `docs/curriculum/DRILL_AUTHORING_GUIDE.md` — authoring intent behind each field
