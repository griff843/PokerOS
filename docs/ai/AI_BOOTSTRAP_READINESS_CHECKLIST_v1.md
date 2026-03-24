# AI Bootstrap Readiness Checklist — Poker v1

## Purpose
This checklist confirms whether Poker OS has the minimum local AI operating structure needed to begin using the governed AI workflow.

---

## Current installation status

### Portable core docs installed
Yes.

Poker has the portable AI-core structure installed under:

- `docs/ai-core/`
- `docs/ai-core/doctrine/`
- `docs/ai-core/install/`

### Poker adapter exists
Yes.

Poker has a local project adapter:

- `docs/ai/AI_PROJECT_ADAPTER_POKER_v1.md`

### Canonical current-state doc exists
Yes.

Poker now has a canonical current-state/status surface:

- `docs/poker-coach-os/status/CURRENT_SYSTEM_STATUS.md`

### Session context bundle exists
Yes.

Poker now has a manual context bundle for architecture sessions:

- `out/ai/context/context_bundle.md`

This should be refreshed before major ChatGPT architecture or sprint-shaping sessions.

---

## Can poker start using the AI workflow?
**Yes — fully enough to begin real governed sprint execution.**

Poker now has the minimum viable AI operating layer for:

- sprint shaping
- prompt generation
- closeout proof support
- status synchronization
- AI OS health checks
- governed architecture sessions

This is no longer just a bootstrap state.
Poker is ready for its first real sprint through the installed operating loop.

---

## Installed operating capabilities

### Skills installed
- `prompt-compose`
- `sprint-proof-bundle`
- `sprint-plan`
- `status-sync`
- `agent-health`

### Agent layer installed
Poker now has 7 agents installed, including support for:

- prompt optimization
- documentation maintenance
- repo auditing
- code optimization
- codebase navigation
- proof bundling
- sprint management

### Rules installed
Poker now has 4 rules installed, including workflow, proof, testing, and output expectations.

### Supported verification commands
Poker rules currently reference:

- `pnpm test`
- `pnpm type-check`
- `pnpm build:web`

---

## What is still missing before the first real sprint?

Poker has enough to begin, but should still tighten a few things as it matures:

- a canonical poker architecture blueprint if not already created
- a formal active phase doc if phase execution will be governed tightly
- a repeatable process for refreshing `out/ai/context/context_bundle.md`
- a defined first sprint target with clear verification scope
- consistent closeout discipline using proof + status sync after each sprint

These are maturity improvements, not blockers.

---

## First helper / skill to operationalize
This is already decided and installed:

### `prompt-compose`
Use `prompt-compose` first to convert poker sprint direction into a structured Claude Code implementation prompt.

This is the correct first operational skill because it turns rough direction into consistent execution input.

---

## First operating loop
Poker’s first real operating loop is now:

1. choose a real sprint
2. run `/prompt-compose`
3. execute the sprint
4. run `/sprint-proof-bundle <SPRINT>`
5. run `/status-sync <SPRINT>`
6. use `/agent-health` when AI operating drift or readiness is in question

---

## Current readiness verdict
**Status: Operationally ready**

Poker now has:

- portable core
- project adapter
- canonical current-state surface
- context bundle surface
- installed skills
- installed agents
- installed rules
- a usable first operating loop

Poker is ready to begin real governed sprint execution.