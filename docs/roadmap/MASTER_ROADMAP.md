# Master Roadmap

## Phase 1 — Architecture Completion [LOCKED 2026-03-08]

- [x] finalize node taxonomy (NODE_TAXONOMY.md — descriptive IDs, expanded hierarchy)
- [x] define tagging system (TAGGING_SYSTEM.md — two-layer: rule tags + classification tags)
- [x] document population model (POPULATION_MODEL.md — Pool A/B/C with exploit matrix, answer_by_pool schema)
- [x] complete drill schema (DRILL_AUTHORING_GUIDE.md — full field reference, pool variants, two tag layers)
- [x] document scoring engine (SCORING_ENGINE.md — pool-aware scoring design, boundaries documented)
- [x] architecture map (ARCHITECTURE_MAP.md — system flow, training pipeline, content model diagrams)
- [x] architecture lock report (DOCS_ARCHITECTURE_LOCK.md — audit findings resolved)

## Phase 2 — Content Expansion

Target: 80 nodes, ~700 base drills, ~1700 with pool variants

- expand node library (preflop, 3BP, 4BP, multiway, exploit-specific)
- build drill library with pool variants (answer_by_pool for key exploit spots)
- implement classification tags on all drills
- expand rule tag registry (target: 30-50 rule tags)
- unify drill schema (single source of truth for CLI + Table Sim)

Content authoring order (from POKER_DECISION_MAP.md):
1. River bluff-catching (highest exploit variance)
2. Flop c-betting SRP (most frequent decision)
3. Preflop opening + facing opens
4. Turn barreling + facing barrels
5. 3-bet pot flop/turn/river
6. River bluffing + value
7. Multiway spots
8. Exploit-specific nodes
9. 4-bet pots
10. Limped pots

## Phase 3 — System Integration

- connect Table Sim to SQLite (persist attempts, update SRS)
- unify CLI and web drill schemas
- add pool selector to session configuration
- implement pool-aware scoring in both CLI and Table Sim
- relax node_id regex in Zod schema to `^[a-z0-9_]+$`
- expand VALID_TAGS array for new rule tags
- add classification tag validation

## Phase 4 — Coaching Intelligence

- adaptive curriculum engine (weakness detection by classification tags)
- leak detection analytics (missed rule tags, per-pool accuracy)
- AI coaching layer (Anthropic API, conversational drill explanations)
- pool-contrastive coaching (contrast answers across pool types)
- concept mastery model (per-tag mastery tracking)

## Phase 5 — Real Play Integration

- session logger (log hands from live play)
- hand import tools (tag with relevant nodes/concepts)
- drill generation from logged hands
- bankroll/results tracker
- real-play analysis (connect study to table performance)
