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
  // v1.2 — Live Cash Pack 2
  {
    key: "iso_raise",
    label: "Iso-Raising",
    summary: "Punishing live limpers with isolation raises and playing IP in inflated pots.",
    aliases: ["iso_raise_live", "concept:iso_raise"],
  },
  {
    key: "bb_defense",
    label: "BB Defense",
    summary: "Adjusting BB defending thresholds and 3-bet frequency based on live opponent pool tendencies.",
    aliases: ["bb_defend_live", "concept:bb_defense"],
  },
  {
    key: "delayed_aggression",
    label: "Delayed Aggression",
    summary: "C-betting or probing on later streets after checking back the flop or facing a check-through.",
    aliases: ["delayed_cbet", "concept:delayed_cbet"],
  },
  {
    key: "thin_value_extraction",
    label: "Thin Value Extraction",
    summary: "Betting for value in marginal spots against capped or passive ranges that cannot fold medium-strength hands.",
    aliases: ["river_thin_value", "concept:thin_value"],
  },
  {
    key: "multiway_late_street",
    label: "Multiway Late Street",
    summary: "Managing turn and river decisions in multiway pots — lower bluffing incentives, tighter value thresholds.",
    aliases: ["multiway_turn_discipline", "concept:multiway_discipline"],
  },
  // v1.2 — Exploit Framing
  {
    key: "exploit_framing",
    label: "Live Pool Exploit Framing",
    summary: "Adjusting decisions based on population tendencies: fold more vs under-bluffing pools, value-bet wider vs over-callers, size up vs under-raising tables.",
    aliases: ["live_exploit_framing", "concept:exploit_framing"],
  },
  // v1.3 — Live Cash Pack 3
  {
    key: "squeeze_play",
    label: "Squeeze Play",
    summary: "3-betting vs an opener and one or more callers to charge trapped flatters and build a pot with initiative.",
    aliases: ["squeeze_live", "concept:squeeze_play"],
  },
  {
    key: "cold_call_defense",
    label: "Cold-Call Defense",
    summary: "Discipline around cold-calling and overcalling preflop — when calling adds value vs when 4-betting or folding is correct.",
    aliases: ["cold_call_live", "concept:cold_call_defense"],
  },
  {
    key: "probe_betting",
    label: "OOP Probe Betting",
    summary: "Leading the turn OOP after the IP aggressor checks back the flop — reclaiming initiative and charging equity when IP is capped.",
    aliases: ["probe_discipline", "concept:probe_betting"],
  },
  {
    key: "check_raise_discipline",
    label: "Check-Raise Discipline",
    summary: "Selecting the right hands to check-raise vs call in live pools — balancing semi-bluff draws, combo hands, and trap lines.",
    aliases: ["check_raise_live", "concept:check_raise_discipline"],
  },
  {
    key: "bet_fold_discipline",
    label: "River Bet-Fold Discipline",
    summary: "Betting for value on the river while planning to fold to a raise — essential live-cash skill separating good value bets from hero calls.",
    aliases: ["river_bet_fold", "concept:bet_fold_discipline"],
  },
  {
    key: "passive_station_reads",
    label: "Passive Station Reads",
    summary: "Identifying and exploiting passive calling stations — value-bet every street, never bluff, size up for maximum extraction.",
    aliases: ["passive_station_exploit", "concept:passive_station_reads"],
  },
  {
    key: "aggro_rec_reads",
    label: "Aggro Recreational Reads",
    summary: "Identifying and exploiting aggro recreational players — trap with strong hands, call down bluff-catchers, and let them over-bluff.",
    aliases: ["aggro_rec_exploit", "concept:aggro_rec_reads"],
  },
  // v1.4 — Live Cash Pack 4
  {
    key: "turn_overbet_construction",
    label: "Turn Overbet Construction",
    summary: "Building polar overbet ranges on the turn IP — selecting value hands and bluffs that benefit from 120%+ sizing in live pools.",
    aliases: ["turn_overbet_ip", "concept:turn_overbet_construction"],
  },
  {
    key: "donk_small_response",
    label: "Small Donk Bet Response",
    summary: "Responding correctly to small OOP leads (20–35% pot) — raising thin value, calling draws, folding air with discipline.",
    aliases: ["donk_small", "concept:donk_small_response"],
  },
  {
    key: "donk_polar_response",
    label: "Large Polar Donk Response",
    summary: "Responding to large/polar OOP leads (75%+ pot) — folding medium-strength hands, raising the nuts, and not paying off the polar range.",
    aliases: ["donk_large", "concept:donk_polar_response"],
  },
  {
    key: "cr_follow_through",
    label: "CR Follow-Through",
    summary: "Managing river decisions as the turn check-raiser — committing with value and semi-bluffs, shutting down when equity evaporates.",
    aliases: ["cr_river_follow_through", "concept:cr_follow_through"],
  },
  {
    key: "population_bluff_catch",
    label: "Population Bluff Catching",
    summary: "Adjusting bluff-catching thresholds pool-by-pool — widening vs over-bluffing populations, tightening vs under-bluffing passive pools.",
    aliases: ["bluff_catch_live", "concept:population_bluff_catch"],
  },
  {
    key: "blind_live_discipline",
    label: "Blind Live Discipline",
    summary: "Correcting SB/BB live mistakes — avoiding weak completes from SB, not over-defending BB, and squeezing when the spots arise.",
    aliases: ["blind_live_mistake", "concept:blind_live_discipline"],
  },
  {
    key: "limp_reraise_tree",
    label: "Limp-Reraise Tree",
    summary: "Navigating limp-reraise and unusual live preflop trees — recognizing the strong-hand signal, folding medium holdings, and trapping correctly.",
    aliases: ["limp_reraise", "concept:limp_reraise_tree"],
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
  // v1.2 edges
  { from: "iso_raise", to: "range_advantage", type: "supports", note: "Iso-raising builds IP range advantage in inflated pots." },
  { from: "iso_raise", to: "population_pressure", type: "related", note: "Iso-raise frequency and sizing depend heavily on pool tendencies." },
  { from: "bb_defense", to: "population_pressure", type: "supports", note: "BB defense thresholds are highly pool-dependent in live cash games." },
  { from: "delayed_aggression", to: "cbetting", type: "related", note: "Delayed c-bets are an extension of post-flop aggression principles." },
  { from: "delayed_aggression", to: "range_advantage", type: "supports", note: "Delayed stabs exploit IP range advantage when opponent shows weakness." },
  { from: "thin_value_extraction", to: "value_targeting", type: "supports", note: "Thin value depends on opponent's inability to fold medium-strength hands." },
  { from: "thin_value_extraction", to: "population_pressure", type: "supports", note: "Thin value opportunities increase against passive, over-calling pools." },
  { from: "multiway_late_street", to: "multiway_awareness", type: "supports", note: "Late-street multiway discipline builds on flop multiway threshold awareness." },
  { from: "multiway_late_street", to: "value_targeting", type: "related", note: "Thin value thresholds tighten significantly in multiway late-street spots." },
  // Exploit framing edges
  { from: "exploit_framing", to: "population_pressure", type: "supports", note: "Exploit framing is the applied arm of population pressure — converting reads into decisions." },
  { from: "exploit_framing", to: "value_targeting", type: "supports", note: "Thin value extractions depend on identifying over-calling tendencies." },
  { from: "exploit_framing", to: "bluff_catching", type: "supports", note: "Bluff-catch width narrows against under-bluffing live pools." },
  { from: "exploit_framing", to: "iso_raise", type: "related", note: "ISO sizing exploits under-raising passive tables directly." },
  // v1.3 edges
  { from: "squeeze_play", to: "range_advantage", type: "supports", note: "Squeeze plays create IP range advantage by trapping flatters." },
  { from: "squeeze_play", to: "population_pressure", type: "supports", note: "Squeeze sizing and frequency adapt heavily to live pool fold tendencies." },
  { from: "cold_call_defense", to: "population_pressure", type: "supports", note: "Overcall and cold-call decisions shift based on pool tendencies." },
  { from: "cold_call_defense", to: "multiway_awareness", type: "supports", note: "Overcalls work in tandem with multiway pot construction." },
  { from: "probe_betting", to: "range_advantage", type: "supports", note: "Probes exploit the range-capping signal of an IP check-through." },
  { from: "probe_betting", to: "equity_denial", type: "supports", note: "Probe bets deny free equity to IP's medium-strength hands and draws." },
  { from: "check_raise_discipline", to: "equity_denial", type: "supports", note: "Check-raises are a primary equity-denial tool OOP." },
  { from: "check_raise_discipline", to: "value_targeting", type: "supports", note: "Selecting the right combos to CR is a value-targeting skill." },
  { from: "bet_fold_discipline", to: "river_defense", type: "supports", note: "River bet-fold is the flip side of river defense — betting while managing fold decisions." },
  { from: "bet_fold_discipline", to: "value_targeting", type: "supports", note: "Knowing when to bet-fold vs check-back requires accurate value targeting." },
  { from: "passive_station_reads", to: "value_targeting", type: "supports", note: "Station reads enable wider value betting and eliminate bluffing." },
  { from: "passive_station_reads", to: "population_pressure", type: "supports", note: "Station identification is a core population-pressure skill." },
  { from: "aggro_rec_reads", to: "bluff_catching", type: "supports", note: "Aggro rec reads directly expand bluff-catching ranges." },
  { from: "aggro_rec_reads", to: "population_pressure", type: "supports", note: "Aggro rec identification is a core population-pressure read." },
  // v1.4 edges
  { from: "turn_overbet_construction", to: "polarization", type: "supports", note: "Overbet construction requires understanding polarized range composition." },
  { from: "turn_overbet_construction", to: "range_advantage", type: "supports", note: "IP overbet incentives depend on range and nut advantage." },
  { from: "donk_small_response", to: "value_targeting", type: "supports", note: "Responding correctly to small donks is a thin-value and raise discipline skill." },
  { from: "donk_small_response", to: "population_pressure", type: "supports", note: "Small donk frequencies and ranges vary sharply by player pool." },
  { from: "donk_polar_response", to: "polarization", type: "supports", note: "Large polar donks signal a polar range — response depends on understanding polarization." },
  { from: "donk_polar_response", to: "bluff_catching", type: "related", note: "Calling large donks is a form of bluff-catching against polar OOP leads." },
  { from: "cr_follow_through", to: "check_raise_discipline", type: "supports", note: "CR follow-through builds on the decision to check-raise the turn." },
  { from: "cr_follow_through", to: "bet_fold_discipline", type: "related", note: "River follow-through decisions overlap with bet-fold discipline on final streets." },
  { from: "population_bluff_catch", to: "bluff_catching", type: "supports", note: "Population bluff catching is the applied, pool-adjusted form of core bluff-catching." },
  { from: "population_bluff_catch", to: "population_pressure", type: "supports", note: "Bluff-catch width is one of the most important population-sensitive decisions." },
  { from: "blind_live_discipline", to: "population_pressure", type: "supports", note: "Blind mistakes in live cash are often driven by poor population reads." },
  { from: "blind_live_discipline", to: "bb_defense", type: "supports", note: "BB live discipline extends core BB defense to real game spots." },
  { from: "limp_reraise_tree", to: "range_advantage", type: "supports", note: "Recognizing limp-reraise signals informs range-reading and folding discipline." },
  { from: "limp_reraise_tree", to: "population_pressure", type: "supports", note: "Limp-reraise frequency is highly pool-dependent in live cash." },
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
  probe_bet_turn: ["turn_aggression", "range_advantage"],
  "3bet_pot_cbet": ["cbetting", "3bet_pot_play"],
  preflop_3bet: ["preflop_decision", "range_advantage"],
  turn_give_up: ["turn_aggression", "equity_denial"],
  // v1.2
  iso_raise_live: ["iso_raise", "range_advantage", "population_pressure"],
  bb_defend_live: ["bb_defense", "population_pressure"],
  delayed_cbet: ["delayed_aggression", "cbetting", "range_advantage"],
  river_thin_value: ["thin_value_extraction", "value_targeting", "population_pressure"],
  multiway_turn_discipline: ["multiway_late_street", "multiway_awareness", "turn_defense"],
  // v1.2 — Exploit Framing
  live_exploit_framing: ["exploit_framing", "population_pressure", "value_targeting", "bluff_catching"],
  // v1.3 — Live Cash Pack 3
  squeeze_live: ["squeeze_play", "range_advantage", "population_pressure"],
  cold_call_live: ["cold_call_defense", "population_pressure", "multiway_awareness"],
  probe_discipline: ["probe_betting", "range_advantage", "equity_denial"],
  check_raise_live: ["check_raise_discipline", "equity_denial", "value_targeting"],
  river_bet_fold: ["bet_fold_discipline", "value_targeting", "river_defense"],
  passive_station_exploit: ["passive_station_reads", "value_targeting", "population_pressure"],
  aggro_rec_exploit: ["aggro_rec_reads", "bluff_catching", "population_pressure"],
  // v1.4 — Live Cash Pack 4
  turn_overbet_ip: ["turn_overbet_construction", "polarization", "range_advantage"],
  donk_small: ["donk_small_response", "value_targeting", "population_pressure"],
  donk_large: ["donk_polar_response", "polarization", "bluff_catching"],
  cr_river_follow_through: ["cr_follow_through", "check_raise_discipline", "bet_fold_discipline"],
  bluff_catch_live: ["population_bluff_catch", "bluff_catching", "population_pressure"],
  blind_live_mistake: ["blind_live_discipline", "bb_defense", "population_pressure"],
  limp_reraise: ["limp_reraise_tree", "range_advantage", "population_pressure"],
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
