# Architecture Lock Report — Poker Coach OS

_Generated: 2026-03-08 | Architecture Foundation Lock Sprint_

---

## Executive Summary

The 10 foundation documents were audited against the live codebase. The implementation matches all documented claims with **zero factual discrepancies**. However, the audit identified **6 structural issues** that must be resolved before content expansion can begin. The most critical: the tag system design doc describes a future architecture that contradicts the current implementation, and the population exploit model has no functional integration with any system component.

---

## System Strengths

### 1. Solid Core Engine
The scoring engine, SRS algorithm, and content loader are clean, tested, and production-ready. The SM-2 implementation is correct. The scoring formula is well-calibrated. All 16 tests pass.

### 2. Clean Data Model
The 5-table SQLite schema is normalized, properly indexed, and sufficient for the target scale (thousands of drills, tens of thousands of attempts). WAL mode ensures concurrent read safety.

### 3. Dual Interface Architecture
CLI and Table Sim share `@poker-coach/core` via proper workspace package exports, with a browser-safe entry point that excludes Node-only dependencies. This is well-architected.

### 4. Content Pipeline
Idempotent JSON-to-SQLite loading with Zod validation is exactly right for scaling the content library. The companion checklist.md pattern is elegant.

### 5. Board Texture Detection
The Table Sim's board texture system (paired, flush, four-liner, scare ace, monotone) with color-coded highlights is a real differentiator for visual learning.

### 6. Proof Artifact Culture
The system generates proof artifacts for every pipeline, making verification systematic and auditable.

---

## Audit Findings

### FINDING 1: Tag System — Design/Implementation Mismatch [CRITICAL]

**Risk**: Blocks content expansion, analytics, adaptive curriculum, AI coaching

**Current implementation** (`packages/core/src/tags.ts`):
- 8 flat string tags in a `VALID_TAGS` const array
- Validated by Zod enum: `z.enum(VALID_TAGS)`
- All tags are board-texture concepts: `paired_top_river`, `scare_river_ace`, etc.

**Design doc** (`TAGGING_SYSTEM.md`):
- Structured `category:value` format across 8 categories
- Categories: street, pot type, position, spot, board texture, strategic concepts, decision type, population type
- Example: `concept:range_advantage`, `pool:pool_b`, `decision:cbet`

**The problem**: These are incompatible systems. The code validates against a fixed enum of 8 flat strings. The doc describes an open-ended structured taxonomy. Expanding the content library requires knowing which system to build.

**Required resolution**:
- Adopt the `category:value` format as the canonical tag architecture
- Distinguish between **rule tags** (the existing 7, used in `required_tags` for scoring) and **classification tags** (the new structured tags, used in `tags[]` for analytics/curriculum)
- This allows the existing scoring system to keep working while enabling the broader tag taxonomy

### FINDING 2: Population Exploit Model — Not Functional [CRITICAL]

**Risk**: The stated #1 differentiator has no integration with any system component

**Current state**:
- `population_toggle` field exists in `NodeDefaultsSchema` (defaults to "B")
- No code reads this field for any purpose
- No drill has pool-variant answers
- No scoring path considers pool context
- No session configuration allows pool selection

**The problem**: The architecture docs position Pool A/B/C as the product's core differentiator, but it exists only as a dormant schema field and explanation text. Before authoring hundreds of drills, the exploit model needs a concrete integration architecture.

**Required resolution**:
- Define how pool context enters the training pipeline (session-level selection? per-drill? both?)
- Define how pool-variant answers are structured in the drill schema
- Define how scoring evaluates pool-aware responses
- Decide: are pool variants separate drills or a single drill with conditional answers?

### FINDING 3: Node ID Format — Too Restrictive [HIGH]

**Risk**: Blocks preflop and 3BP/4BP content creation

**Current**: Node IDs must match `^(hu|mw)_\d+$`

This means every node is prefixed as either heads-up or multiway. But the target taxonomy needs:
- Preflop nodes (not tied to HU/MW)
- 3-bet pot nodes
- 4-bet pot nodes
- Squeeze pot nodes
- Limped pot nodes

**Required resolution**:
- Expand the regex to support a richer prefix scheme, OR
- Make the ID format opaque (any string) and move all classification into the `context` fields
- Recommendation: Use descriptive IDs like `pf_open_utg`, `hu_srp_flop_cbet_btn_bb`, `3bp_flop_ip_cbet` with a relaxed regex like `^[a-z0-9_]+$`

### FINDING 4: Dual Drill Schema — Content Sync Risk [HIGH]

**Risk**: Content drift between CLI and Table Sim

**Current state**:
- CLI uses `DrillFileEntrySchema` from `@poker-coach/core`
- Table Sim uses `TableSimDrillSchema` from `apps/table-sim/src/lib/drill-schema.ts`
- Content lives in two files: `content/drills/hu_seed.json` and `apps/table-sim/public/content/drills.json`
- No automated sync between them

**The problem**: At 30 drills, manual sync is manageable. At 800+ drills, it becomes a reliability hazard. When drills are updated, both files must be changed.

**Required resolution**:
- Define a canonical drill schema that serves both CLI and Table Sim
- Single source of truth for content (one file or one generation pipeline)
- Table Sim enrichment (board cards, hero hand, visual data) should either be in the canonical schema or generated from it

### FINDING 5: Scoring Model — No Partial Credit or Exploit Awareness [MEDIUM]

**Risk**: Limits training depth as content grows

**Current scoring**:
- Action is binary: 0 or full weight (0.7 CLI / 0.5 Table Sim)
- No concept of "close but wrong" (e.g., calling when raising is correct but calling is acceptable)
- The `accepted` array partially addresses this but gives full credit, not partial

**Missing capabilities for target architecture**:
- Pool-aware scoring (different correct answer per pool)
- Partial action credit (half credit for a suboptimal-but-reasonable action)
- Multi-street evaluation (decision quality across a hand tree)
- Concept understanding scoring beyond tag selection

**Required resolution**:
- For now, document the scoring model's boundaries explicitly
- Pool-aware scoring is the highest priority addition
- Multi-street and partial credit are Phase 2+ concerns
- Add a `pool_answers` field or `answer_by_pool` structure to the drill schema

### FINDING 6: Adaptive Curriculum — No Data Model [MEDIUM]

**Risk**: The richest planned feature has no specification beyond a paragraph

**Current state**: `ADAPTIVE_CURRICULUM.md` describes the concept (detect low-accuracy concepts, generate targeted study) but specifies no:
- Data structures for concept mastery tracking
- Algorithm for weakness detection thresholds
- Study plan generation logic
- Integration with SRS scheduling

**Required resolution**:
- This is Phase 4 work, not blocking Phase 2 content expansion
- However, the tag system design (Finding 1) must be resolved first because adaptive curriculum depends on rich concept tags
- Document the adaptive curriculum data model before implementation begins

---

## Required Changes to Foundation Docs

### 1. NODE_TAXONOMY.md — Expand

| Change | Reason |
|---|---|
| Relax node ID format to `^[a-z0-9_]+$` | Support preflop, 3bp, 4bp, squeeze, limp nodes |
| Add node ID naming convention | Consistent, descriptive IDs across all pot types |
| Define full node context fields | Ensure `context` carries all classification data |
| Add example nodes for each pot type | Preflop, SRP, 3BP, 4BP, MW |

### 2. TAGGING_SYSTEM.md — Restructure

| Change | Reason |
|---|---|
| Define two tag layers: rule tags + classification tags | Resolve design/implementation mismatch |
| Specify rule tags (scoring) vs classification tags (analytics) | Different validation, different purposes |
| Define initial tag registry for each category | Concrete starting point for content authors |
| Specify tag validation strategy for open-ended categories | Move from enum to registry |

### 3. SCORING_ENGINE.md — Expand

| Change | Reason |
|---|---|
| Document pool-aware scoring design | Enable exploit training |
| Define `answer_by_pool` schema structure | Per-pool correct answers |
| Document scoring boundaries (what it does NOT evaluate) | Set clear expectations |
| Add Table Sim scoring adapter specification | Currently undocumented |

### 4. POPULATION_MODEL.md — Deepen

| Change | Reason |
|---|---|
| Define integration points with training pipeline | Make the model functional |
| Specify drill schema for pool variants | Enable content authoring |
| Define pool selection UX flow | Session configuration |
| Add concrete exploit adjustment rules per pool | Content authors need these |
| Specify how AI coaching uses pool context | Future-proof for Phase 4 |

### 5. POKER_DECISION_MAP.md — Enumerate

| Change | Reason |
|---|---|
| List specific node categories with target counts | Guide content expansion |
| Add position pair matrix | Define which matchups to cover |
| Add stack depth considerations | Live poker stack depth varies widely |
| Prioritize nodes by frequency in live mid/high stakes | Focus content work |

---

## Recommended Architecture Adjustments

### A. Two-Layer Tag System

```
RULE TAGS (scoring layer)
  Purpose: evaluated in scoreDrill() / scoreTableSimDrill()
  Format: flat snake_case strings
  Validation: enum array in tags.ts
  Used in: drill.answer.required_tags
  Scale: 20-40 tags as content grows
  Examples: paired_top_river, cbet_dry_flop, overbet_polarized

CLASSIFICATION TAGS (analytics layer)
  Purpose: curriculum planning, leak detection, AI coaching, filtering
  Format: category:value
  Validation: registry (category must exist, value is freeform or enum per category)
  Used in: drill.tags[], node.context, attempt analytics
  Scale: 100+ combinations across 8+ categories
  Examples: street:flop, pot:3bp, concept:range_advantage, pool:pool_b
```

This preserves backward compatibility (existing scoring works unchanged) while enabling the full analytics/curriculum/coaching system.

### B. Pool-Variant Drill Schema

```
Option 1: Separate drills per pool (simple, explicit)
  d_01_01_pool_a, d_01_01_pool_b, d_01_01_pool_c
  Pro: simple schema, simple scoring
  Con: 3x content volume, harder to maintain

Option 2: Conditional answers within one drill (compact, powerful)
  drill.answer_by_pool: {
    "A": { correct: "call", explanation: "...", required_tags: [...] },
    "B": { correct: "fold", explanation: "...", required_tags: [...] },
    "C": { correct: "call", explanation: "...", required_tags: [...] }
  }
  Pro: single drill, easy to compare pool adjustments
  Con: schema change, scoring must be pool-aware

RECOMMENDATION: Option 2 (conditional answers)
  - Aligns with the product vision (same spot, different reads)
  - Teaches the player to think about WHY the answer changes
  - Less content to maintain
  - The AI coaching layer can contrast answers across pools
```

### C. Unified Drill Schema

```
Canonical drill format (serves both CLI and Table Sim):
  drill_id, node_id, title, prompt
  meta: { game, players_to_flop, hero_pos, villain_pos }
  board: { flop, turn, river }  (nullable for preflop)
  hero_hand: [card, card]  (nullable for range drills)
  pot_bb: number | null
  decision_point: { street, facing, options, sizing_enabled }
  answer: { correct, accepted, explanation, required_tags }
  answer_by_pool: { A: {...}, B: {...}, C: {...} }  (optional)
  tags: string[]  (classification tags)
  difficulty: 1-5

Single source: content/drills/*.json
CLI: loads directly via content-loader
Table Sim: build step or API route serves the same data
```

### D. Expanded Node ID Convention

```
Format: {scope}_{pottype}_{street}_{spot}_{positions}
  or shorter descriptive form

Examples:
  pf_open_utg          (preflop, opening, UTG)
  pf_3bet_btn_vs_co    (preflop, 3-bet, BTN vs CO)
  srp_flop_cbet_ip     (SRP, flop, c-bet, in position)
  3bp_turn_barrel_oop  (3-bet pot, turn, barrel, out of position)
  mw_flop_squeeze_co   (multiway, flop, squeeze pot, CO)

Regex: ^[a-z0-9_]+$  (relaxed, descriptive)
Classification: carried by context fields, not parsed from ID
```

---

## Scalability Assessment

### Can the architecture support 200+ nodes?
**Yes, with changes.** The content loader, SQLite schema, and query layer are ready. The node ID format and taxonomy need the documented expansion. No structural code changes needed.

### Can it support thousands of drills?
**Yes.** SQLite handles this easily. The JSON loading pipeline works at scale. The dual-schema issue must be resolved to avoid content drift.

### Can the tag system support analytics and coaching?
**Not yet.** The current 8-tag enum is insufficient. The two-layer tag system (rule tags + classification tags) must be implemented. Once the tag registry exists, analytics queries become straightforward (`SELECT ... WHERE tags LIKE '%concept:range_advantage%'`).

### Is the population model central enough?
**No.** It is a dormant schema field. The `answer_by_pool` schema design and pool-aware scoring must be built before the exploit model becomes functional.

### Can the adaptive curriculum work?
**Yes, once tags are expanded.** The data (attempts, scores, missed tags) already flows into SQLite. Weakness detection is a query over attempts grouped by tag. The missing piece is the tag taxonomy — with 8 tags there's nothing to analyze. With 50+ structured tags, the data becomes actionable.

---

## Lock Status

| Foundation Area | Status | Blocking? |
|---|---|---|
| System architecture | LOCKED | No |
| Data model (SQLite) | LOCKED | No |
| Scoring engine (current) | LOCKED | No |
| SRS algorithm | LOCKED | No |
| Content loader | LOCKED | No |
| CLI interface | LOCKED | No |
| Table Sim interface | LOCKED | No |
| Node taxonomy | NEEDS UPDATE | Yes — blocks content expansion |
| Tag system | NEEDS UPDATE | Yes — blocks content expansion |
| Scoring engine (pool-aware) | NEEDS DESIGN | Yes — blocks exploit content |
| Population model | NEEDS UPDATE | Yes — blocks exploit content |
| Drill schema (unified) | NEEDS DESIGN | Yes — blocks content expansion |
| Decision map | NEEDS UPDATE | No — informational |
| Adaptive curriculum | NEEDS SPEC | No — Phase 4 |
| AI coaching | NEEDS SPEC | No — Phase 4 |

### Verdict

**5 foundation docs require updates before content expansion can begin.** The changes are design-level (schemas, conventions, integration points), not code-level. Once these docs are updated and internally consistent, the architecture is locked and Phase 2 content work can proceed.
