# Skill: sprint-proof-bundle

> **Portability:** Adapter-Based (Poker-adapted)
> **Invocation:** `/sprint-proof-bundle <SPRINT-NAME>`
> **Purpose:** Generate proof artifacts at sprint closeout. Captures all evidence needed for the closeout report.

---

## When to Use

Use `/sprint-proof-bundle` when:
- A sprint is functionally complete and ready for closeout
- You need to capture verification evidence before updating status docs
- You are producing the official record of what was built and verified

Do not use for:
- Mid-sprint checkpoints (use only at actual closeout)
- Exploratory or diagnostic sessions

---

## Procedure

### Step 1 — Confirm sprint identity

Confirm:
- Sprint name / label
- Sprint objective (one sentence)
- Artifact directory: `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/`

Create the directory if it does not exist.

### Step 2 — Run and capture verification

Run each verification command and capture the full output:

```bash
pnpm test
```
Capture: pass/fail count, any failures

```bash
pnpm type-check
```
Capture: pass or error output

```bash
pnpm build:web
```
Capture: success or build errors (only run if Table Sim was in scope)

### Step 3 — Capture git state

```bash
git status
git diff --stat HEAD~1
git log --oneline -5
```

Capture the output of each.

### Step 4 — Assess completeness

Check against EVIDENCE_RULES.md:
- [ ] Test suite passed (or all failures are documented + triaged)
- [ ] Type check passed
- [ ] Build passed (if applicable)
- [ ] Git state captured
- [ ] No uncommitted changes related to the sprint

### Step 5 — Generate closeout report

Fill out CLOSEOUT_TEMPLATE.md with:
- Sprint identity
- What was built
- Verification results
- Git state
- Known issues / follow-up items
- Status doc update targets

### Step 6 — Write artifacts to disk

Write to `out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/`:
- `proof.md` — filled CLOSEOUT_TEMPLATE
- `test-output.txt` — raw test output
- `typecheck-output.txt` — raw type-check output
- `build-output.txt` — raw build output (if applicable)
- `git-state.txt` — git status + log

---

## Output Format

Summary in conversation:
```
Sprint: <SPRINT-NAME>
Tests: PASS (<N> passed, <M> failed)
Type check: PASS / FAIL
Build: PASS / FAIL / SKIPPED
Artifacts: out/poker/sprints/<SPRINT-NAME>/<YYYYMMDD>/
Status: READY FOR CLOSEOUT / BLOCKED — see issues
```

---

## Failure Protocol

If verification fails:
- Do not write a "PASS" closeout
- Document the failure in `proof.md`
- List it as a known issue
- Do not update status docs as "complete" until failures are resolved or explicitly accepted as known
