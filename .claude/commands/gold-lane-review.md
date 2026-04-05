# gold-lane-review

Run the gold-lane acceptance review on a pending batch and produce a structured pass/fail report.

## Usage

```
/gold-lane-review [--batch=<path>] [--report=<path>]
```

- `--batch` — path to the pending batch JSON (default: most recently modified file under `out/reports/gold-lane-reviews/pending/`)
- `--report` — where to write the review report (default: `out/reports/gold-lane-reviews/<batch-stem>_review.md`)

## Steps

1. If `--batch` is not supplied, find the most recently modified `.json` file under `out/reports/gold-lane-reviews/pending/`.

2. Run the batch review command:
   ```bash
   pnpm review:gold-batch --batch=<batch> --report=<report>
   ```

3. Read the generated report and summarize:
   - Overall pass rate (N/total accepted)
   - List of drills that failed with the specific criterion that failed
   - List of drills that passed

4. For each failing drill, consult `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md` and state which acceptance criterion was not met and what change would fix it.

5. Present a decision:
   - **All pass** → ask if user wants to merge to `content/drills/` now.
   - **Some fail** → list required edits; ask whether to fix-and-revalidate or discard failures.

6. If merge is approved, run:
   ```bash
   pnpm review:gold-batch --batch=<batch> --report=<report> --merge
   ```
   Confirm which drill ids were written to `content/drills/`.

## Acceptance criteria reference

See `docs/curriculum/LIVE_CASH_GOLD_STANDARD_LANE.md` for the full rubric. Key gates:
- Decision point is strategically meaningful (not a trivially dominant action)
- Pool variants (`answer_by_pool`) are justified by genuine pool-driven action differences
- `diagnostic_prompts` cover the primary error modes for the spot
- Coaching context explains the why, not just the what
