# verify-all

Run the full verification suite (typecheck + tests + verify) and report a structured pass/fail summary.

## Usage

```
/verify-all [--fix]
```

- `--fix` — if supplied, attempt to fix type errors and lint issues before re-running (use with caution)

## Steps

1. Run all three checks in sequence, capturing output for each:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm verify
   ```

2. Report results in a structured table:

   | Check | Status | Details |
   |---|---|---|
   | typecheck | PASS / FAIL | error count and first 3 errors if failing |
   | test | PASS / FAIL | failed test names and file paths |
   | verify | PASS / FAIL | first failing rule |

3. If everything passes: confirm the branch is clean to commit or PR.

4. If anything fails:
   - Show the exact error output (truncated to the most actionable lines).
   - Do not attempt automatic fixes unless `--fix` was passed.
   - Suggest the most likely root cause based on the error messages.

## Notes

- Run from the repo root so pnpm workspace resolution works correctly.
- `pnpm verify` runs both lint and additional project-specific checks — do not skip it in favor of `pnpm typecheck` alone.
- For a single package or file, prefer the targeted commands from CLAUDE.md rather than this skill.
