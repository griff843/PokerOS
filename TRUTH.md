# TRUTH.md

Ground truth for repo state. Updated after verified changes land.
Both Claude and Codex must read this before making claims about what is or isn't built.

Last verified: 2026-04-05

---

## Toolchain

Verification is currently runnable from this workspace. Do not assume Codex is blocked from `pnpm` or `better-sqlite3` in this repo without re-checking first.

| Command | Status | Notes |
|---|---|---|
| `pnpm typecheck` | PASSING | Clean, no errors |
| `pnpm vitest run` | PASSING | 53 files, 370 tests |
| `pnpm validate:canonical` | PASSING | 7 files, 241 drills |
| `pnpm verify` | PASSING | typecheck + tests + Next.js build |
| `pnpm drill:coverage` | PASSING | Audit CLI — reports depth, street/pot mix |
| `pnpm drill:lane-gaps` | PASSING | Audit CLI — reports critical gaps and imbalances |
| `pnpm drill:followups-audit` | PASSING | Audit CLI — reports follow_up and concept coverage |
| `pnpm drill:trace` | PASSING | Audit CLI — traces a single drill's full coaching chain |
| `pnpm drill:patch-quality` | PASSING | Quality gate for pending batches — checks completeness and template drift |
| `better-sqlite3` | COMPILED | Built with VS Build Tools 2022 (version 18 path). If pnpm install wipes it, rebuild with: `npx node-gyp rebuild --msvs_version=2022` from `node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3` |

---

## Wiring status

| Feature | Status | File(s) |
|---|---|---|
| Attempt persistence (SQLite) | WIRED | `apps/table-sim/src/lib/study-persistence.ts:11` → `insertAttempt()` |
| Diagnostic prompt capture | WIRED | `CoachingPanel.tsx` — appears at top of panel before coaching reveal, captured via `onCaptureDiagnostic` |
| Diagnostic result display | WIRED | `CoachingPanel.tsx` → `CoachDiagnosisCard` — shows after DrillCoachingSummary once answered |
| Diagnostic capture persistence | WIRED | `apps/table-sim/src/lib/session-context.tsx:53` → PATCH `/api/attempts/:id` |
| SRS scheduling | WIRED | `packages/core/src/srs.ts`, used in CLI and session planner |
| Session plan → play loop | WIRED | `/api/session-plan` → `session-plan-server.ts` → `generateSessionPlan()` |
| Daily plan → session launch | WIRED | `daily-plan-session-bridge.ts` → session URL with focus concept |
| Real-hand import + follow-up | WIRED | `/app/hands`, `/api/real-hands/*` |
| Intervention plan + execution | WIRED | `/app/concepts/[id]/execution`, `/api/intervention-execution/[id]` |
| `difficulty_reason` rendering | WIRED | `DrillCoachingSnapshot.difficultyReason` → `DrillCoachingSummary` "Why This Spot Is Hard" card |
| `key_concept` coaching language | FIXED | Headline no longer prefixed with "Key concept: " — authored text shows directly |

---

## Content

Strict coaching-context completeness = all 8 core fields present: `key_concept`, `difficulty_reason`, `why_preferred_line_works`, `follow_up`, `follow_up_concepts`, `range_context`, `range_notes`, `range_support`. Use `pnpm drill:coverage` for current counts.

| File | Drills | `diagnostic_prompts` | `coaching_context` depth |
|---|---|---|---|
| `live_cash_gold_btn_bb_river.json` | 88 | 88/88 (100%) | Deep: all 11+ fields present; 18/88 pass strict 8-field check (gaps are missing `follow_up_concepts` and `range_support` on some drills) |
| `hu_seed.json` | 30 | 30/30 (100%) | Sparse: 4/30 pass the strict 8-field check; most drills still lack follow_up and richer range fields |
| `live_cash_pack1.json` | 30 | 30/30 (100%) | Prose depth: 30/30 have key_concept + difficulty_reason + why_preferred_line_works; 0/30 have follow_up, range fields |
| `live_cash_pack2.json` | 30 | 30/30 (100%) | Prose depth: same as pack1 |
| `live_cash_pack3.json` | 30 | 30/30 (100%) | Prose depth: same as pack1 |
| `live_cash_pack4.json` | 30 | 30/30 (100%) | Prose depth: same as pack1 |
| `live_cash_exploit.json` | 3 | 3/3 (100%) | Minimal: no strict-complete coaching_context entries yet |
| **Total** | **241** | **241/241 (100%)** | Strict complete: 22/241 (9.1%) |

---

## CoachingPanel render order (as of 2026-04-04)

1. Header — Correct/Incorrect badge + score %, pool badge
2. **Reasoning Check** — diagnostic prompt capture (appears only before player answers; framed as "answer before reading coaching")
3. **DrillCoachingSummary** — verdict → adaptiveContext → exploitContrast → 4 tiles (whyCorrect, whyMistake, keyConcept, nextAdjustment) → **Why This Spot Is Hard** (difficulty_reason)
4. **CoachDiagnosisCard** — shows after reasoning check is answered (unified position, not split by correct/incorrect)
5. StreetHistoryCard — street context before range shape
6. TransparencyVerdictCard — solver-level verdict anchor
7. RangeSupportCard — range logic, follow_up, follow_up_concepts
8. StrategyFrequencyCard — solver honesty
9. Coaching Emphasis (adaptiveSignal)
10. Line read + Score split grid — metadata last
11. Next Drill / View Summary button

---

## Known gaps (not bugs — planned work)

- `follow_up`, `follow_up_concepts`, `range_context`, `range_notes`, `range_support` on pack1–4 are missing — range and follow-up authoring pass needed (Sprint 11).
- `hu_seed.json`: 25/30 drills have no coaching_context — full context pass needed.
- `live_cash_exploit.json`: coaching_context partial — follow_up and range fields not authored.
- No 4BP drills. No squeeze drills. Preflop and flop are underweight vs river (57.3% river) — Sprint 3/4 work.
- Duplicate diagnostic prompt text in pack1–4 (detected by `pnpm drill:patch-quality`) — prompts like "Which range fact matters most?" reused across 6 drills. Quality issue, not a schema error.
- SessionSummary does not yet synthesize `key_concept` or `difficulty_reason` cross-drill into debrief cards.
- CommandCenter `follow_up_concepts` routing is wired but concept block assignment logic is shallow — Sprint 2 work.

---

## What does NOT need to be built

- SQLite wiring from web app — already done
- Diagnostic prompt UI — already built and wired
- CoachingPanel component — exists at `apps/table-sim/src/components/play/CoachingPanel.tsx`
- Attempt persistence — done via `study-persistence.ts`
- `difficulty_reason` rendering — wired 2026-04-04
