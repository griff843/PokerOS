import { z } from "zod";
import { VALID_TAGS } from "./tags";

const RULE_TAG_SCHEMA = z.enum(VALID_TAGS as unknown as [string, ...string[]]);
const CARD_PATTERN = /^[2-9TJQKA][shdc]$/;
const NODE_ID_PATTERN = /^[a-z0-9_]+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const CLASSIFICATION_TAG_CATEGORIES = [
  "street",
  "pot",
  "position",
  "spot",
  "board",
  "concept",
  "decision",
  "pool",
] as const;

export const CLASSIFICATION_TAG_CATEGORY_SET = new Set<string>(
  CLASSIFICATION_TAG_CATEGORIES
);

function isLegacyNodeId(nodeId: string): boolean {
  return /^(hu|mw)_\d+$/.test(nodeId);
}

function isValidClassificationTag(tag: string): boolean {
  const parts = tag.split(":");
  if (parts.length !== 2) return false;
  const [category, value] = parts;
  return CLASSIFICATION_TAG_CATEGORY_SET.has(category) && value.trim().length > 0;
}

function hasAtLeastOnePoolEntry(answerByPool: Partial<Record<PoolKey, unknown>>): boolean {
  return Object.values(answerByPool).some((value) => value !== undefined);
}

function actionUsesSizing(action: string): boolean {
  return ["BET", "RAISE", "OPEN", "3BET", "4BET"].includes(action.toUpperCase());
}

function answerNeedsSizing(answer: { correct: string; accepted: string[] }): boolean {
  return actionUsesSizing(answer.correct) || answer.accepted.some((action) => actionUsesSizing(action));
}

export const NodeContextSchema = z.object({
  player_count_flop: z.number().int().min(2).default(2),
  position: z.string().optional(),
  street: z.string().optional(),
  pot_type: z.string().optional(),
  stack_depth: z.string().optional(),
  decision_type: z.string().optional(),
});

export const NodeDefaultsSchema = z.object({
  population_toggle: z.enum(["A", "B", "C"]).default("B"),
});

export const NodeFileSchema = z.object({
  node_id: z.string().regex(NODE_ID_PATTERN),
  name: z.string().min(1),
  version: z.string().regex(VERSION_PATTERN).default("1.0.0"),
  context: NodeContextSchema.default({}),
  triggers: z.array(z.string()).default([]),
  checklist_md: z.string().default(""),
  defaults: NodeDefaultsSchema.default({}),
});

export type NodeFile = z.infer<typeof NodeFileSchema>;

export const StreetSchema = z.enum(["preflop", "flop", "turn", "river"]);
export type Street = z.infer<typeof StreetSchema>;

export const PoolKeySchema = z.enum(["A", "B", "C"]);
export type PoolKey = z.infer<typeof PoolKeySchema>;

export const PotTypeSchema = z.enum(["SRP", "3BP", "4BP", "limp", "squeeze", "multiway"]);
export type PotType = z.infer<typeof PotTypeSchema>;

export const CardSchema = z.string().regex(CARD_PATTERN);
export type Card = z.infer<typeof CardSchema>;

export const BoardSchema = z.object({
  flop: z.tuple([CardSchema, CardSchema, CardSchema]),
  turn: CardSchema.nullable(),
  river: CardSchema.nullable(),
});
export type Board = z.infer<typeof BoardSchema>;

export const ActionHistoryStepSchema = z.object({
  street: StreetSchema,
  player: z.string().min(1),
  action: z.string().min(1),
  size_bb: z.number().positive().optional(),
  size_pct_pot: z.number().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.size_bb === undefined && value.size_pct_pot === undefined) {
    return;
  }
});
export type ActionHistoryStep = z.infer<typeof ActionHistoryStepSchema>;

export const ScenarioSchema = z.object({
  game: z.string().min(1).default("NLHE Cash"),
  street: StreetSchema,
  pot_type: PotTypeSchema,
  players_to_flop: z.number().int().min(2).default(2),
  hero_position: z.string().min(1),
  villain_position: z.string().min(1),
  effective_stack_bb: z.number().positive().optional(),
  pot_size_bb: z.number().nonnegative().optional(),
  board: BoardSchema.nullable().optional(),
  hero_hand: z.tuple([CardSchema, CardSchema]).nullable().optional(),
  action_history: z.array(ActionHistoryStepSchema).default([]),
}).superRefine((scenario, ctx) => {
  if (scenario.street === "preflop") {
    if (scenario.board !== null && scenario.board !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenario.board must be null or omitted for preflop drills",
        path: ["board"],
      });
    }
    return;
  }

  if (!scenario.board) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scenario.board is required for postflop drills",
      path: ["board"],
    });
    return;
  }

  if (scenario.street === "turn" && scenario.board.turn === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scenario.board.turn is required for turn drills",
      path: ["board", "turn"],
    });
  }

  if (scenario.street === "river") {
    if (scenario.board.turn === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenario.board.turn is required for river drills",
        path: ["board", "turn"],
      });
    }
    if (scenario.board.river === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scenario.board.river is required for river drills",
        path: ["board", "river"],
      });
    }
  }
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const SizeSpecSchema = z.object({
  size_bb: z.number().positive().optional(),
  size_pct_pot: z.number().positive().optional(),
  size_bucket: z.number().int().positive().optional(),
  tolerance_pct: z.number().positive().default(15).optional(),
}).refine(
  (value) => value.size_bb !== undefined || value.size_pct_pot !== undefined || value.size_bucket !== undefined,
  {
    message: "correct_size must provide size_bb, size_pct_pot, or size_bucket",
  }
);
export type SizeSpec = z.infer<typeof SizeSpecSchema>;

export const StrategyMixEntrySchema = z.object({
  action: z.string().min(1),
  frequency_pct: z.number().min(0).max(100),
  size_bucket: z.number().int().positive().optional(),
  label: z.string().min(1).optional(),
});
export type StrategyMixEntry = z.infer<typeof StrategyMixEntrySchema>;

export const AnswerSchema = z.object({
  correct: z.string().min(1),
  accepted: z.array(z.string().min(1)).default([]),
  correct_size: SizeSpecSchema.optional(),
  strategy_mix: z.array(StrategyMixEntrySchema).optional(),
  required_tags: z.array(RULE_TAG_SCHEMA).min(1),
  explanation: z.string().min(1),
});
export type DrillAnswer = z.infer<typeof AnswerSchema>;

export const AnswerByPoolSchema = z.object({
  A: AnswerSchema.optional(),
  B: AnswerSchema.optional(),
  C: AnswerSchema.optional(),
}).refine((value) => hasAtLeastOnePoolEntry(value), {
  message: "answer_by_pool must define at least one pool answer",
});
export type AnswerByPool = z.infer<typeof AnswerByPoolSchema>;

export const FacingSchema = z.object({
  action: z.string().min(1),
  size_pct_pot: z.number().positive().optional(),
  size_bb: z.number().positive().optional(),
});
export type Facing = z.infer<typeof FacingSchema>;

export const DecisionPointSchema = z.object({
  street: StreetSchema,
  facing: FacingSchema.nullable().optional(),
  sizing_buttons_enabled: z.boolean().default(false),
});
export type DecisionPoint = z.infer<typeof DecisionPointSchema>;

export const DrillOptionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});
export type DrillOption = z.infer<typeof DrillOptionSchema>;

export const BoardUpdateSchema = z.object({
  turn: CardSchema.nullable().optional(),
  river: CardSchema.nullable().optional(),
}).refine((value) => value.turn !== undefined || value.river !== undefined, {
  message: "board_update must provide turn or river",
});
export type BoardUpdate = z.infer<typeof BoardUpdateSchema>;

export const StreetChangeNoteSchema = z.object({
  street: StreetSchema,
  detail: z.string().min(1),
});
export type StreetChangeNote = z.infer<typeof StreetChangeNoteSchema>;

export const RangeBucketSchema = z.object({
  label: z.string().min(1),
  combos: z.array(z.string().min(1)).min(1),
  note: z.string().optional(),
  frequency_hint: z.string().optional(),
});
export type RangeBucket = z.infer<typeof RangeBucketSchema>;

export const RangeSpotlightSchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  note: z.string().optional(),
});
export type RangeSpotlight = z.infer<typeof RangeSpotlightSchema>;

export const RangeSupportSchema = z.object({
  value_buckets: z.array(RangeBucketSchema).optional(),
  bluff_buckets: z.array(RangeBucketSchema).optional(),
  bluff_catchers: z.array(RangeBucketSchema).optional(),
  combo_groups: z.array(RangeBucketSchema).optional(),
  threshold_notes: z.array(z.string().min(1)).optional(),
  blocker_notes: z.array(z.string().min(1)).optional(),
  hero_hand_bucket: RangeSpotlightSchema.optional(),
});
export type RangeSupport = z.infer<typeof RangeSupportSchema>;

export const DiagnosticErrorTypeSchema = z.enum([
  "line_misunderstanding",
  "threshold_error",
  "range_construction_error",
  "blocker_blindness",
  "pool_assumption_error",
  "confidence_miscalibration",
]);
export type DiagnosticErrorType = z.infer<typeof DiagnosticErrorTypeSchema>;

export const DiagnosticPromptTypeSchema = z.enum([
  "line_understanding",
  "threshold",
  "range_construction",
  "blocker",
  "pool_assumption",
  "street_shift",
  "mix_reasoning",
]);
export type DiagnosticPromptType = z.infer<typeof DiagnosticPromptTypeSchema>;

export const DiagnosticPromptOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  matches_expected: z.boolean().optional(),
  diagnosis: DiagnosticErrorTypeSchema.optional(),
});
export type DiagnosticPromptOption = z.infer<typeof DiagnosticPromptOptionSchema>;

export const DiagnosticPromptSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: DiagnosticPromptTypeSchema,
  concept: z.string().min(1).optional(),
  expected_reasoning: z.string().min(1),
  options: z.array(DiagnosticPromptOptionSchema).min(2).max(4).optional(),
});
export type DiagnosticPrompt = z.infer<typeof DiagnosticPromptSchema>;

export const CoachingContextSchema = z.object({
  key_concept: z.string().optional(),
  common_mistake: z.string().optional(),
  common_mistakes: z.array(z.string().min(1)).optional(),
  range_context: z.string().optional(),
  range_notes: z.array(z.string().min(1)).optional(),
  range_support: RangeSupportSchema.optional(),
  what_changed_by_street: z.array(StreetChangeNoteSchema).optional(),
  difficulty_reason: z.string().optional(),
  why_preferred_line_works: z.string().optional(),
  population_note: z.string().optional(),
  follow_up: z.string().optional(),
  follow_up_concepts: z.array(z.string().min(1)).optional(),
});
export type CoachingContext = z.infer<typeof CoachingContextSchema>;

export const StepSchema = z.object({
  step_id: z.string().min(1),
  street: z.enum(["flop", "turn", "river"]),
  prompt: z.string().min(1),
  board_update: BoardUpdateSchema.optional(),
  decision_point: DecisionPointSchema,
  options: z.array(DrillOptionSchema).min(2),
  answer: AnswerSchema,
  answer_by_pool: AnswerByPoolSchema.optional(),
  coaching_context: CoachingContextSchema.optional(),
}).superRefine((step, ctx) => {
  validateAnswerAgainstOptions(step.options, step.answer, ["answer"], ctx);
  if (step.decision_point.street !== step.street) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "step.decision_point.street must match step.street",
      path: ["decision_point", "street"],
    });
  }
  if (step.decision_point.sizing_buttons_enabled && answerNeedsSizing(step.answer) && !step.answer.correct_size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "step.answer.correct_size is required when sizing buttons are enabled",
      path: ["answer", "correct_size"],
    });
  }
  if (step.answer_by_pool) {
    validatePoolAnswers(step.options, step.answer_by_pool, ["answer_by_pool"], ctx);
  }
});
export type DrillStep = z.infer<typeof StepSchema>;

export const MetadataSchema = z.object({
  author: z.string().optional(),
  source: z.enum(["manual", "ai_generated", "session_import", "solver"]).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  source_hand_id: z.string().optional(),
  notes: z.array(z.string()).optional(),
});
export type DrillMetadata = z.infer<typeof MetadataSchema>;

export const CanonicalDrillSchema = z.object({
  drill_id: z.string().min(1),
  node_id: z.string().regex(NODE_ID_PATTERN),
  version: z.string().regex(VERSION_PATTERN).default("1.0.0"),
  title: z.string().min(1),
  prompt: z.string().min(1),
  scenario: ScenarioSchema,
  decision_point: DecisionPointSchema,
  options: z.array(DrillOptionSchema).min(2).max(5),
  answer: AnswerSchema,
  answer_by_pool: AnswerByPoolSchema.optional(),
  tags: z.array(z.string()).min(1),
  difficulty: z.number().int().min(1).max(5),
  steps: z.array(StepSchema).min(2).optional(),
  coaching_context: CoachingContextSchema.optional(),
  diagnostic_prompts: z.array(DiagnosticPromptSchema).optional(),
  metadata: MetadataSchema.optional(),
}).superRefine((drill, ctx) => {
  if (drill.scenario.street !== drill.decision_point.street) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "decision_point.street must match scenario.street",
      path: ["decision_point", "street"],
    });
  }

  validateAnswerAgainstOptions(drill.options, drill.answer, ["answer"], ctx);

  if (drill.answer_by_pool) {
    validatePoolAnswers(drill.options, drill.answer_by_pool, ["answer_by_pool"], ctx);
  }

  if (drill.decision_point.sizing_buttons_enabled && answerNeedsSizing(drill.answer) && !drill.answer.correct_size) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "answer.correct_size is required when sizing buttons are enabled",
      path: ["answer", "correct_size"],
    });
  }

  for (const [index, tag] of drill.tags.entries()) {
    if (!isValidClassificationTag(tag)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "tags must use registered category:value classification tags",
        path: ["tags", index],
      });
    }
  }
});
export type CanonicalDrill = z.infer<typeof CanonicalDrillSchema>;

export const CanonicalDrillsFileSchema = z.array(CanonicalDrillSchema);

export const LegacyDrillAnswerSchema = z.object({
  correct: z.string().min(1),
  accepted: z.array(z.string().min(1)).default([]),
  explanation: z.string().default(""),
  required_tags: z.array(RULE_TAG_SCHEMA).min(1),
});

export const LegacyCliDrillSchema = z.object({
  drill_id: z.string().min(1),
  node_id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(DrillOptionSchema).min(2),
  answer: LegacyDrillAnswerSchema,
  tags: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5).default(2),
});
export type LegacyCliDrill = z.infer<typeof LegacyCliDrillSchema>;

export const LegacyCliDrillsFileSchema = z.array(LegacyCliDrillSchema);

export const LegacyTableSimMetaSchema = z.object({
  game: z.string().default("NLHE Cash"),
  players_to_flop: z.number().int().min(2).default(2),
  hero_pos: z.string().min(1),
  villain_pos: z.string().min(1),
});

export const LegacyTableSimDecisionPointSchema = z.object({
  street: z.enum(["flop", "turn", "river"]),
  facing: z.object({
    action: z.string().min(1),
    size_pct_pot: z.number().nullable().default(null),
  }).nullable().default(null),
  options: z.array(z.string().min(1)).min(2),
  sizing_buttons_enabled: z.boolean().default(false),
});

export const LegacyTableSimAnswerSchema = z.object({
  correct_action: z.string().min(1),
  accepted_actions: z.array(z.string().min(1)).default([]),
  correct_size_bucket: z.number().nullable().default(null),
  required_tags: z.array(RULE_TAG_SCHEMA).min(1),
  explanation: z.string().min(1),
});

export const LegacyTableSimDrillSchema = z.object({
  drill_id: z.string().min(1),
  node_id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  meta: LegacyTableSimMetaSchema,
  board: BoardSchema,
  hero_hand: z.tuple([CardSchema, CardSchema]),
  pot_bb: z.number().nullable().default(null),
  decision_point: LegacyTableSimDecisionPointSchema,
  answer_key: LegacyTableSimAnswerSchema,
});
export type LegacyTableSimDrill = z.infer<typeof LegacyTableSimDrillSchema>;

export const LegacyTableSimDrillsFileSchema = z.array(LegacyTableSimDrillSchema);

export function isLegacyNodeIdOrCanonical(nodeId: string): boolean {
  return NODE_ID_PATTERN.test(nodeId) || isLegacyNodeId(nodeId);
}

function validateAnswerAgainstOptions(
  options: DrillOption[],
  answer: DrillAnswer,
  path: Array<string | number>,
  ctx: z.RefinementCtx
): void {
  const optionKeys = new Set(options.map((option) => option.key.toUpperCase()));
  if (!optionKeys.has(answer.correct.toUpperCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "answer.correct must match an option key",
      path: [...path, "correct"],
    });
  }

  for (const [index, accepted] of answer.accepted.entries()) {
    if (!optionKeys.has(accepted.toUpperCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answer.accepted entries must match option keys",
        path: [...path, "accepted", index],
      });
    }
  }
}

function validatePoolAnswers(
  options: DrillOption[],
  answerByPool: AnswerByPool,
  path: Array<string | number>,
  ctx: z.RefinementCtx
): void {
  for (const [poolKey, poolAnswer] of Object.entries(answerByPool)) {
    if (!poolAnswer) continue;
    validateAnswerAgainstOptions(options, poolAnswer, [...path, poolKey], ctx);
  }
}







