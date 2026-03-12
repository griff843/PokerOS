export type ReviewFilter = "all" | "incorrect";

export const FILTERABLE_TAGS = [
  "flush_complete_turn",
  "polar_turn_big_bet",
  "paired_top_river",
  "scare_river_ace",
  "four_liner_river",
  "overbet_opportunity",
] as const;

export type FilterableTag = (typeof FILTERABLE_TAGS)[number];
