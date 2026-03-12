/** All valid rule tags for v1 + v1.1 reserved */
export const VALID_TAGS = [
  "paired_top_river",
  "scare_river_ace",
  "turn_overbet_faced",
  "flush_complete_turn",
  "four_liner_river",
  "polar_turn_big_bet",
  "overbet_opportunity",
  "cbet_dry_flop",
  "cbet_wet_flop",
  "range_advantage_ip",
  "nut_advantage",
  "equity_denial",
  "blocker_effect",
  "merge_vs_passive",
  "overbluff_punish",
  "underfold_exploit",
  "thin_value_deep",
  "multiway_context", // reserved for v1.1
] as const;

export type RuleTag = (typeof VALID_TAGS)[number];

export function isValidTag(tag: string): tag is RuleTag {
  return (VALID_TAGS as readonly string[]).includes(tag);
}

/** Returns human-readable label for a tag */
export function tagLabel(tag: RuleTag): string {
  const labels: Record<RuleTag, string> = {
    paired_top_river: "Paired top card on river",
    scare_river_ace: "Scare card ace on river",
    turn_overbet_faced: "Facing turn overbet",
    flush_complete_turn: "Flush completes on turn",
    four_liner_river: "Four-liner straight on river",
    polar_turn_big_bet: "Polar turn big bet",
    overbet_opportunity: "Overbet opportunity",
    cbet_dry_flop: "C-bet on a dry flop",
    cbet_wet_flop: "C-bet on a wet flop",
    range_advantage_ip: "In-position range advantage",
    nut_advantage: "Nut advantage",
    equity_denial: "Betting to deny equity",
    blocker_effect: "Blocker effects matter",
    merge_vs_passive: "Merged betting versus passive pools",
    overbluff_punish: "Punish over-bluffing populations",
    underfold_exploit: "Exploit under-folding populations",
    thin_value_deep: "Thin value at deep stacks",
    multiway_context: "Multiway context (v1.1)",
  };
  return labels[tag];
}
