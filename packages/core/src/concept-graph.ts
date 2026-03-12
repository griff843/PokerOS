import { resolveDrillAnswer } from "./answer-resolution";
import type { CanonicalDrill } from "./schemas";
import { isValidTag, tagLabel, type RuleTag } from "./tags";

export type ConceptRelationType = "supports" | "related";

export interface ConceptNodeDefinition {
  key: string;
  label: string;
  summary: string;
  aliases?: string[];
  sourceTags?: string[];
}

export interface ConceptEdge {
  from: string;
  to: string;
  type: ConceptRelationType;
  note: string;
}

export interface ConceptGraph {
  nodes: ConceptNodeDefinition[];
  edges: ConceptEdge[];
}

const BASE_CONCEPT_NODES: ConceptNodeDefinition[] = [
  {
    key: "range_advantage",
    label: "Range Advantage",
    summary: "Understanding when your range can apply pressure and support broader aggression.",
    aliases: ["concept:range_advantage", "range_advantage_ip", "nut_advantage"],
    sourceTags: ["concept:leverage"],
  },
  {
    key: "board_connectivity",
    label: "Board Connectivity",
    summary: "Reading how turn and river cards change who benefits from the runout.",
    aliases: ["concept:board_connectivity", "flush_complete_turn", "four_liner_river"],
  },
  {
    key: "blocker_effects",
    label: "Blocker Effects",
    summary: "Using card removal and combo blocking to evaluate bluff-catching and bluffing decisions.",
    aliases: ["concept:blocker_effect", "blocker_effect", "paired_top_river"],
  },
  {
    key: "equity_denial",
    label: "Equity Denial",
    summary: "Choosing pressure lines that deny realization when ranges are still wide.",
    aliases: ["concept:equity_denial", "equity_denial", "cbet_wet_flop"],
  },
  {
    key: "polarization",
    label: "Polarization",
    summary: "Recognizing when big bet ranges are polarized and how that changes defense.",
    aliases: ["concept:polarization", "polar_turn_big_bet", "turn_overbet_faced"],
  },
  {
    key: "leverage",
    label: "Leverage",
    summary: "Applying large sizing and nut-pressure concepts when ranges permit it.",
    aliases: ["concept:leverage", "overbet_opportunity", "nut_advantage"],
  },
  {
    key: "turn_defense",
    label: "Turn Defense",
    summary: "Handling pressure on the turn before the hand reaches river bluff-catching spots.",
    aliases: ["turn_overbet_faced", "flush_complete_turn", "polar_turn_big_bet", "concept:turn_probe"],
  },
  {
    key: "river_defense",
    label: "River Defense",
    summary: "Managing river bluff-catching, overfolding, and final-street pressure decisions.",
    aliases: ["paired_top_river", "four_liner_river", "scare_river_ace", "decision:bluff_catch"],
  },
  {
    key: "bluff_catching",
    label: "Bluff Catching",
    summary: "Separating call-down candidates from folds when bluff density matters.",
    aliases: ["decision:bluff_catch", "paired_top_river", "overbluff_punish"],
  },
  {
    key: "scare_card_pressure",
    label: "Scare Card Pressure",
    summary: "Responding correctly when high leverage scare cards shift the strategic story.",
    aliases: ["concept:scare_card_pressure", "scare_river_ace"],
  },
  {
    key: "population_pressure",
    label: "Population Pressure",
    summary: "Adapting to over-bluffing, under-folding, and passive or aggressive population tendencies.",
    aliases: ["underfold_exploit", "overbluff_punish", "merge_vs_passive"],
  },
  {
    key: "value_targeting",
    label: "Value Targeting",
    summary: "Finding the right value line and sizing against capped or sticky ranges.",
    aliases: ["thin_value_deep", "merge_vs_passive"],
  },
  {
    key: "cbetting",
    label: "C-Betting",
    summary: "Applying flop initiative decisions with the right board and range logic.",
    aliases: ["cbet_dry_flop", "cbet_wet_flop"],
  },
  {
    key: "multiway_awareness",
    label: "Multiway Awareness",
    summary: "Adjusting thresholds and incentives when more players see the flop.",
    aliases: ["multiway_context"],
  },
];

const BASE_CONCEPT_EDGES: ConceptEdge[] = [
  { from: "range_advantage", to: "leverage", type: "supports", note: "Range advantage often unlocks leverage and overbet opportunities." },
  { from: "range_advantage", to: "scare_card_pressure", type: "supports", note: "Scare-card pressure is easier to interpret when range advantage is understood." },
  { from: "range_advantage", to: "cbetting", type: "supports", note: "C-betting quality depends on understanding range ownership." },
  { from: "board_connectivity", to: "turn_defense", type: "supports", note: "Turn defense improves when runout interaction is read correctly." },
  { from: "board_connectivity", to: "river_defense", type: "supports", note: "River defense often inherits board-structure mistakes from earlier streets." },
  { from: "polarization", to: "turn_defense", type: "supports", note: "Turn defense depends on reading polarized pressure correctly." },
  { from: "polarization", to: "river_defense", type: "supports", note: "River defense sharpens when polar betting ranges are understood." },
  { from: "turn_defense", to: "river_defense", type: "supports", note: "Repeated river mistakes can be downstream of earlier turn-defense leaks." },
  { from: "blocker_effects", to: "bluff_catching", type: "supports", note: "Blockers frequently drive bluff-catching thresholds." },
  { from: "blocker_effects", to: "river_defense", type: "supports", note: "River defense is often shaped by blocker-driven combo shifts." },
  { from: "population_pressure", to: "bluff_catching", type: "supports", note: "Population reads reinforce bluff-catching decisions." },
  { from: "population_pressure", to: "value_targeting", type: "supports", note: "Value lines shift when pools under-fold or over-fold." },
  { from: "leverage", to: "value_targeting", type: "supports", note: "Leverage and value targeting are closely linked." },
  { from: "river_defense", to: "bluff_catching", type: "related", note: "Many bluff-catching mistakes are a subtype of river defense." },
  { from: "scare_card_pressure", to: "river_defense", type: "related", note: "Scare-card decisions often show up on river defense nodes." },
  { from: "equity_denial", to: "cbetting", type: "related", note: "Equity-denial decisions commonly overlap with c-bet logic." },
];

const CONCEPT_SOURCE_TO_KEY = new Map<string, string>();

for (const node of BASE_CONCEPT_NODES) {
  CONCEPT_SOURCE_TO_KEY.set(node.key, node.key);
  CONCEPT_SOURCE_TO_KEY.set(node.label.toLowerCase(), node.key);
  for (const alias of node.aliases ?? []) {
    CONCEPT_SOURCE_TO_KEY.set(alias, node.key);
  }
  for (const sourceTag of node.sourceTags ?? []) {
    CONCEPT_SOURCE_TO_KEY.set(sourceTag, node.key);
  }
}

const RULE_TAG_TO_CONCEPTS: Record<RuleTag, string[]> = {
  paired_top_river: ["river_defense", "bluff_catching", "blocker_effects"],
  scare_river_ace: ["scare_card_pressure", "river_defense", "range_advantage"],
  turn_overbet_faced: ["turn_defense", "polarization"],
  flush_complete_turn: ["board_connectivity", "turn_defense"],
  four_liner_river: ["board_connectivity", "river_defense"],
  polar_turn_big_bet: ["polarization", "turn_defense"],
  overbet_opportunity: ["leverage", "range_advantage"],
  cbet_dry_flop: ["cbetting", "range_advantage"],
  cbet_wet_flop: ["cbetting", "equity_denial", "board_connectivity"],
  range_advantage_ip: ["range_advantage"],
  nut_advantage: ["range_advantage", "leverage"],
  equity_denial: ["equity_denial"],
  blocker_effect: ["blocker_effects", "bluff_catching"],
  merge_vs_passive: ["population_pressure", "value_targeting"],
  overbluff_punish: ["population_pressure", "bluff_catching"],
  underfold_exploit: ["population_pressure", "value_targeting"],
  thin_value_deep: ["value_targeting", "leverage"],
  multiway_context: ["multiway_awareness"],
};

export function buildConceptGraph(drills: CanonicalDrill[] = []): ConceptGraph {
  const nodesByKey = new Map(BASE_CONCEPT_NODES.map((node) => [node.key, node]));
  for (const drill of drills) {
    for (const source of collectDrillConceptSources(drill)) {
      if (!source.startsWith("concept:") || CONCEPT_SOURCE_TO_KEY.has(source)) {
        continue;
      }

      const key = source.slice("concept:".length);
      if (nodesByKey.has(key)) {
        continue;
      }

      nodesByKey.set(key, {
        key,
        label: toTitleCase(key),
        summary: "Observed concept label from existing drill metadata.",
        aliases: [source],
      });
    }
  }

  return {
    nodes: [...nodesByKey.values()].sort((a, b) => a.label.localeCompare(b.label)),
    edges: [...BASE_CONCEPT_EDGES],
  };
}

export function mapSignalToConceptKeys(signal: string): string[] {
  if (isValidTag(signal)) {
    return RULE_TAG_TO_CONCEPTS[signal];
  }

  const direct = CONCEPT_SOURCE_TO_KEY.get(signal);
  if (direct) {
    return [direct];
  }

  if (signal.startsWith("concept:")) {
    return [signal.slice("concept:".length)];
  }

  return [];
}

export function getSupportingConcepts(graph: ConceptGraph, key: string): ConceptNodeDefinition[] {
  return graph.edges
    .filter((edge) => edge.type === "supports" && edge.to === key)
    .map((edge) => graph.nodes.find((node) => node.key === edge.from))
    .filter((node): node is ConceptNodeDefinition => Boolean(node));
}

export function getSupportedConcepts(graph: ConceptGraph, key: string): ConceptNodeDefinition[] {
  return graph.edges
    .filter((edge) => edge.type === "supports" && edge.from === key)
    .map((edge) => graph.nodes.find((node) => node.key === edge.to))
    .filter((node): node is ConceptNodeDefinition => Boolean(node));
}

export function collectDrillConceptSources(drill: CanonicalDrill): string[] {
  const collected = new Set<string>();

  for (const tag of drill.tags) {
    collected.add(tag);
  }

  for (const tag of drill.answer.required_tags) {
    collected.add(tag);
  }

  if (drill.answer_by_pool) {
    for (const pool of ["A", "B", "C"] as const) {
      const answer = resolveDrillAnswer(drill, pool);
      for (const tag of answer.required_tags) {
        collected.add(tag);
      }
    }
  }

  for (const prompt of drill.diagnostic_prompts ?? []) {
    if (prompt.concept) {
      collected.add(`concept:${normalizeDiagnosticConcept(prompt.concept)}`);
    }
  }

  return [...collected];
}

export function formatConceptLabelFromSource(source: string): string {
  if (isValidTag(source)) {
    return tagLabel(source);
  }

  if (source.startsWith("concept:")) {
    return toTitleCase(source.slice("concept:".length));
  }

  if (source.startsWith("decision:")) {
    return toTitleCase(source.slice("decision:".length));
  }

  return toTitleCase(source);
}

function toTitleCase(value: string): string {
  return value
    .split(/[_:\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}



function normalizeDiagnosticConcept(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
