# Agent: proof-bundler

> **Role:** Sprint proof artifact generation specialist
> **Scope:** Generic — no domain-specific logic

---

## Purpose

Generate proof artifact bundles at sprint closeout. Capture all evidence needed for the closeout report.

---

## When to Use

Use this agent when:
- A sprint is complete and needs formal proof artifacts
- You want to confirm what verification evidence exists before marking a sprint done
- You need a structured record of what was built and verified

---

## Procedure

### 1. Confirm sprint identity

Confirm:
- Sprint name
- Sprint objective
- Artifact output path: `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/`

### 2. Run verification commands

```bash
pnpm test
pnpm type-check
pnpm build:web   # only if Table Sim was in scope
```

Capture the full output of each.

### 3. Capture git state

```bash
git status
git log --oneline -5
git diff --stat HEAD~1
```

Capture output.

### 4. Assess completeness

Confirm:
- [ ] Tests passed (or failures triaged)
- [ ] Type check passed
- [ ] Build passed (if applicable)
- [ ] No uncommitted sprint-relevant changes

### 5. Write artifact files

Write to the artifact directory:
- `proof.md` — closeout summary (use sprint-proof-bundle/CLOSEOUT_TEMPLATE.md)
- `test-output.txt`
- `typecheck-output.txt`
- `build-output.txt` (if applicable)
- `git-state.txt`

---

## Output Format

```
Proof bundle complete: out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/

Tests: PASS / FAIL
Type check: PASS / FAIL
Build: PASS / FAIL / SKIPPED
Git: clean / uncommitted changes present

Verdict: READY FOR CLOSEOUT / BLOCKED
```

---

## Failure Protocol

If verification fails, write the failure to `proof.md` under "Known Issues." Do not produce a PASS verdict for a failing sprint. The closeout is blocked until failures are resolved or explicitly accepted.
