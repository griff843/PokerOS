import fs from "node:fs";
import path from "node:path";
import {
  CanonicalDrillSchema,
  CanonicalDrillsFileSchema,
  LegacyTableSimDrillSchema,
  type CanonicalDrill,
  type DrillOption,
  type LegacyTableSimDrill,
} from "./schemas";

export { resolveDrillAnswer, resolveStepAnswer } from "./answer-resolution";

export interface StoredCanonicalDrillRow {
  drill_id: string;
  node_id: string;
  prompt: string;
  options_json: string;
  answer_json: string;
  tags_json: string;
  difficulty: number;
  content_json: string;
  created_at: string;
}

interface LegacyTableSimAdapterOptions {
  version?: string;
  tags?: string[];
  difficulty?: number;
  metadata?: CanonicalDrill["metadata"];
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_ ]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function inferPositionTag(heroPosition: string, villainPosition: string): string {
  if (heroPosition === "BB" || heroPosition === "SB") return "position:oop";
  if (villainPosition === "BB" || villainPosition === "SB") return "position:ip";
  if (heroPosition === "BTN") return "position:ip";
  return "position:ip";
}

function defaultTagsForLegacyTableSim(drill: LegacyTableSimDrill): string[] {
  return [
    `street:${drill.decision_point.street}`,
    "pot:srp",
    inferPositionTag(drill.meta.hero_pos, drill.meta.villain_pos),
    `spot:${drill.meta.villain_pos.toLowerCase()}_vs_${drill.meta.hero_pos.toLowerCase()}`,
    `concept:${drill.answer_key.required_tags[0]}`,
    "decision:legacy_adapter",
    "pool:baseline",
  ];
}

export function adaptLegacyTableSimDrill(
  drill: LegacyTableSimDrill,
  options: LegacyTableSimAdapterOptions = {}
): CanonicalDrill {
  const parsed = LegacyTableSimDrillSchema.parse(drill);
  const canonicalOptions: DrillOption[] = parsed.decision_point.options.map((action) => ({
    key: action,
    label: titleCase(action),
  }));

  return CanonicalDrillSchema.parse({
    drill_id: parsed.drill_id,
    node_id: parsed.node_id,
    version: options.version ?? "1.0.0",
    title: parsed.title,
    prompt: parsed.prompt,
    scenario: {
      game: parsed.meta.game,
      street: parsed.decision_point.street,
      pot_type: "SRP",
      players_to_flop: parsed.meta.players_to_flop,
      hero_position: parsed.meta.hero_pos,
      villain_position: parsed.meta.villain_pos,
      pot_size_bb: parsed.pot_bb ?? undefined,
      board: parsed.board,
      hero_hand: parsed.hero_hand,
      action_history: [],
    },
    decision_point: {
      street: parsed.decision_point.street,
      facing: parsed.decision_point.facing
        ? {
            action: parsed.decision_point.facing.action,
            ...(parsed.decision_point.facing.size_pct_pot == null
              ? {}
              : { size_pct_pot: parsed.decision_point.facing.size_pct_pot }),
          }
        : null,
      sizing_buttons_enabled: parsed.decision_point.sizing_buttons_enabled,
    },
    options: canonicalOptions,
    answer: {
      correct: parsed.answer_key.correct_action,
      accepted: parsed.answer_key.accepted_actions.filter(
        (action) => action !== parsed.answer_key.correct_action
      ),
      ...(parsed.answer_key.correct_size_bucket == null
        ? {}
        : {
            correct_size: {
              size_bucket: parsed.answer_key.correct_size_bucket,
              tolerance_pct: 15,
            },
          }),
      required_tags: parsed.answer_key.required_tags,
      explanation: parsed.answer_key.explanation,
    },
    tags: options.tags ?? defaultTagsForLegacyTableSim(parsed),
    difficulty: options.difficulty ?? 2,
    metadata: options.metadata,
  });
}

export function parseCanonicalDrillsFile(raw: unknown): CanonicalDrill[] {
  return CanonicalDrillsFileSchema.parse(raw);
}

export function readCanonicalDrillsFromDirectory(drillsDir: string): CanonicalDrill[] {
  if (!fs.existsSync(drillsDir)) return [];

  const drills: CanonicalDrill[] = [];
  for (const entry of fs.readdirSync(drillsDir, { withFileTypes: true })) {
    if (!entry.name.endsWith(".json")) continue;
    const fullPath = path.join(drillsDir, entry.name);
    const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    drills.push(...parseCanonicalDrillsFile(raw));
  }
  return drills;
}

export function parseStoredCanonicalDrill(row: StoredCanonicalDrillRow): CanonicalDrill {
  if (!row.content_json || row.content_json === "{}") {
    throw new Error(`Drill ${row.drill_id} does not contain canonical content_json`);
  }

  return CanonicalDrillSchema.parse(JSON.parse(row.content_json));
}
