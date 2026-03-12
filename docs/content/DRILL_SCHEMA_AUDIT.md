# Drill Schema Audit — Poker Coach OS

_Sprint: SPRINT-DRILL-SCHEMA-FOUNDATION | Date: 2026-03-08_

---

## Current State

### Two competing drill formats exist

**CLI Format** (`DrillFileEntrySchema` in `packages/core/src/schemas.ts`):

```typescript
{
  drill_id: string
  node_id: string
  prompt: string
  options: [{ key: "A"|"B"|"C"|"D", label: string }]
  answer: {
    correct: "A"              // references option key
    accepted: ["A"]           // option key array
    explanation: string
    required_tags: RuleTag[]  // validated against VALID_TAGS enum
  }
  tags: string[]              // unvalidated flat strings
  difficulty: 1-5
}
```

Location: `content/drills/hu_seed.json` (30 drills)

**Table Sim Format** (`TableSimDrillSchema` in `apps/table-sim/src/lib/drill-schema.ts`):

```typescript
{
  drill_id: string
  node_id: string
  title: string
  prompt: string
  meta: { game, players_to_flop, hero_pos, villain_pos }
  board: { flop: [3], turn: string|null, river: string|null }
  hero_hand: [string, string]
  pot_bb: number|null
  decision_point: { street, facing, options: string[], sizing_buttons_enabled }
  answer_key: {
    correct_action: "CALL"       // action name
    accepted_actions: ["CALL"]   // action name array
    correct_size_bucket: number|null
    required_tags: string[]      // not validated against VALID_TAGS
    explanation: string
  }
}
```

Location: `apps/table-sim/public/content/drills.json` (30 drills, same content)

### Database storage format

```typescript
DrillRow {
  drill_id: string
  node_id: string
  prompt: string
  options_json: string     // serialized JSON
  answer_json: string      // serialized JSON
  tags_json: string        // serialized JSON
  difficulty: number
  created_at: string
}
```

The DB stores serialized JSON blobs, so it can accommodate any drill structure without schema migration. Only the Zod validation and content loader determine what gets stored.

### Content loader

`loadDrills()` in `packages/core/src/content-loader.ts`:
- Reads JSON files from `content/drills/`
- Validates with `DrillSeedFileSchema` (array of `DrillFileEntrySchema`)
- Serializes to `DrillRow` and upserts
- No knowledge of Table Sim format

### Scoring engines

**CLI** (`scoreDrill` in `packages/core/src/scoring.ts`):
- Input: `{ userAnswer: string, userTags: string[], answer: DrillAnswer }`
- Compares `userAnswer` against `answer.correct` and `answer.accepted`
- 70% action + 30% tag match

**Table Sim** (`scoreTableSimDrill` in `apps/table-sim/src/lib/scoring-adapter.ts`):
- Input: `{ userAction: string, userSizeBucket: number|null, userTags: string[], drill: TableSimDrill }`
- Compares action names directly
- 50/20/30 split when sizing is enabled

### Node ID validation

Zod schema: `z.string().regex(/^(hu|mw)_\d+$/)` — **still restrictive** despite architecture lock changing convention to `^[a-z0-9_]+$`. This is a code change needed at implementation time.

---

## Gaps Found

### GAP 1: Dual format / no single source of truth [CRITICAL]

The same 30 drills exist in two different formats in two different files. Content changes require updating both, with no automated sync. At scale (700+ drills), this is unsustainable.

### GAP 2: No scenario model in CLI format [CRITICAL]

CLI drills embed the poker situation in prompt text. Board state, hero hand, positions, and action history are not structured data. This means:
- No programmatic filtering by board texture, position, etc.
- AI coaching must parse free-text prompts
- Analytics cannot group by scenario properties

### GAP 3: Incompatible answer key formats [HIGH]

CLI uses option key letters (`correct: "A"`), Table Sim uses action names (`correct_action: "CALL"`). These are fundamentally different reference mechanisms. A unified scoring path requires one format.

### GAP 4: No answer_by_pool support [HIGH]

Neither schema has `answer_by_pool`. This is the core exploit training feature defined in the architecture lock and population model. It must be added before pool-variant content can be authored.

### GAP 5: No multi-street support [HIGH]

Both formats represent exactly one decision point. No mechanism exists for linked decisions across streets. Multi-street drills are a Phase 2 curriculum requirement.

### GAP 6: No version field [MEDIUM]

No drill versioning exists. When drill content is updated (explanation improved, tags added, answer changed), there is no way to distinguish versions. This affects content management and SRS continuity.

### GAP 7: No coaching context [MEDIUM]

Static explanation text is the only coaching data. No structured fields for common mistakes, range context, or population notes. The AI coaching layer must infer everything from the explanation string.

### GAP 8: Classification tags are unstructured [MEDIUM]

CLI drills have tags like `["river", "bluffcatch", "SRP"]` — flat strings with no `category:value` format. The architecture lock specifies classification tags must use `category:value`. Existing tags need migration.

### GAP 9: No metadata or provenance [LOW]

No tracking of who authored a drill, when, or from what source. Important for AI-generated and session-imported drills.

### GAP 10: Table Sim tags are not validated [LOW]

Table Sim `answer_key.required_tags` accepts any string array — not validated against `VALID_TAGS` like the CLI schema. This could allow invalid tags to enter the system.

---

## Canonical Decisions

### Decision 1: One schema to rule them all

A single canonical drill schema replaces both the CLI and Table Sim formats. The canonical format is a superset — it contains all fields from both schemas, plus new fields for pool variants, multi-street, versioning, and coaching context.

**Rationale**: Eliminates content sync issues, enables all downstream systems to consume one format.

### Decision 2: Action names as canonical answer keys

Answers use action names (e.g., "CALL", "FOLD", "RAISE") not option key letters ("A", "B", "C").

**Rationale**: Action names are semantically meaningful, interface-independent, and already used by Table Sim scoring. The CLI will need a thin adapter to map action names to displayed options.

### Decision 3: Structured scenario model

Every drill carries a `scenario` object with game format, street, positions, board, hero hand, stacks, pot size, and action history as structured data.

**Rationale**: Enables programmatic filtering, analytics grouping, AI coaching context, and Table Sim rendering from a single source.

### Decision 4: Embedded steps for multi-street

Multi-street drills use an embedded `steps[]` array within the drill object, where each step has its own decision point and answer.

**Rationale**: Keeps multi-street drills self-contained for SRS, authoring, and AI coaching. No cross-drill dependencies.

### Decision 5: Top-level classification tags, answer-level rule tags

- `tags[]` at the drill level = classification tags (`category:value`, for analytics)
- `answer.required_tags` = rule tags (flat strings, for scoring)

**Rationale**: Maintains the two-layer tag architecture from the architecture lock. Scoring uses answer-level tags; analytics uses drill-level tags.

### Decision 6: Optional fields for progressive adoption

Pool variants (`answer_by_pool`), multi-street (`steps`), coaching context, and metadata are all optional. This means:
- Existing drills can be migrated with only required fields
- Simple drills remain simple
- Advanced features are available when needed

---

## Compatibility Notes

### Content loader needs update

`loadDrills()` currently validates against `DrillFileEntrySchema`. It must be updated to validate against a new `CanonicalDrillSchema`. The DB serialization logic is format-agnostic (JSON blobs), so the database schema does NOT need migration.

### CLI drill engine needs adapter

The interactive CLI currently reads `answer.correct` as an option key ("A") and presents lettered options. Two options:

1. **Adapter approach**: At display time, map canonical option keys to positional letters. Map user input back to canonical keys for scoring. This is the minimal-change path.
2. **Direct approach**: Display action names as buttons/choices. More natural but larger UI change.

Recommendation: Adapter approach for Phase 2 (minimal disruption), direct approach for Phase 3+ when CLI gets a visual refresh.

### Table Sim needs field path updates

Table Sim reads `meta.hero_pos`, `board`, `hero_hand`, `answer_key.correct_action`, etc. These paths change in the canonical format (`scenario.hero_position`, `scenario.board`, `answer.correct`). Either:

1. Write an adapter that maps canonical format to current Table Sim types, or
2. Update Table Sim components to read canonical field paths directly

Recommendation: Option 2, done alongside Phase 3 (Table Sim → SQLite integration).

### Scoring engines need pool resolution

Both scoring engines currently receive a single answer. With `answer_by_pool`, an upstream resolution step must select the correct answer based on the session's active pool before passing it to the scoring engine. The scoring engine itself does not need to change — it still scores one answer.

### Existing 30 drills need migration

A one-time migration script merges the CLI and Table Sim formats into canonical format:
- CLI provides `options` (with key-to-action mapping), `answer`, `tags`, `difficulty`
- Table Sim provides `title`, `board`, `hero_hand`, `meta`, `decision_point`
- Classification tags get `category:value` format
- New required fields (`version`, `scenario`) are constructed from available data

---

## Risks / Open Questions

### Risk 1: Multi-street scoring complexity

Multi-street drills average scores across steps. But what if a player gets the flop decision wrong — should they still see the turn decision? Two options:
- **Continue regardless**: Player sees all streets, scores averaged. Better for learning (see consequences of early mistakes).
- **Stop on failure**: Session ends at the failed step. SRS records the partial attempt.

**Recommendation**: Continue regardless for learning value. Record per-step scores for analytics. Total score is the average. This can be revisited based on player feedback.

### Risk 2: Option key migration for existing CLI users

Changing option keys from "A"/"B"/"C" to action names may affect CLI users with muscle memory. The adapter approach mitigates this by keeping the display format familiar.

**Status**: Low risk — only 30 existing drills, no large user base.

### Risk 3: Action history length for complex hands

The `action_history` array could get long for multi-street hands (8-10 entries). This is acceptable for content authoring but may affect prompt display in the CLI.

**Mitigation**: The `prompt` field is a human-readable summary. `action_history` is structured data for systems, not for display.

### Risk 4: Preflop drills with null board

Table Sim rendering assumes a board exists. Preflop drills set `scenario.board: null`. The Table Sim needs to handle this gracefully (show face-down community cards or an empty table).

**Status**: Table Sim is not yet showing preflop drills. This is a Phase 2 implementation concern, not a schema concern. The schema correctly represents null board for preflop.

### Open Question 1: Should `options` be optional for free-form drills?

The current schema requires options (multiple-choice format). Future drill types (e.g., "what size would you bet?") might need free-form input. For now, all drills are multiple-choice. Free-form can be added as an extension later without breaking existing drills.

**Decision**: Keep `options` required. Revisit if free-form drills become a priority.

### Open Question 2: How should range-level drills work?

The architecture mentions range-level drills where the player decides for a set of hands, not one specific holding. The canonical schema supports `scenario.hero_hand: null` for this, but the scoring and UI implications are not yet designed.

**Decision**: Schema is ready. Scoring/UI design deferred to Phase 4 (range visualization).
