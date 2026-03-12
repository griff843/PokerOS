import type { CanonicalDrill, DrillAnswer, PoolKey } from "./schemas";
import { resolveDrillAnswer } from "./answer-resolution";

export interface ScoreInput {
  userAnswer: string;
  userTags: string[];
  answer: DrillAnswer;
}

export interface ScoreResult {
  total: number;        // 0-1
  actionScore: number;  // 0 or 0.7
  tagScore: number;     // 0-0.3
  correct: boolean;
  missedTags: string[];
  matchedTags: string[];
}

export interface CanonicalScoreInput {
  userAnswer: string;
  userTags: string[];
  drill: Pick<CanonicalDrill, "answer" | "answer_by_pool">;
  activePool?: PoolKey | "baseline" | null;
}

export interface CanonicalScoreResult extends ScoreResult {
  answer: DrillAnswer;
  activePool: PoolKey | "baseline";
}

const ACTION_WEIGHT = 0.7;
const TAG_WEIGHT = 0.3;

/**
 * Deterministic scoring: 70% action correctness + 30% rule-tag correctness.
 * Action is correct if userAnswer matches answer.correct or is in answer.accepted.
 * Tag score is proportional to the fraction of required_tags matched by userTags.
 */
export function scoreDrill(input: ScoreInput): ScoreResult {
  const { userAnswer, userTags, answer } = input;

  // Action correctness
  const upperAnswer = userAnswer.toUpperCase().trim();
  const acceptedSet = new Set([
    answer.correct.toUpperCase(),
    ...answer.accepted.map((a) => a.toUpperCase()),
  ]);
  const actionCorrect = acceptedSet.has(upperAnswer);
  const actionScore = actionCorrect ? ACTION_WEIGHT : 0;

  // Tag correctness
  const requiredSet = new Set(answer.required_tags);
  const userTagSet = new Set(userTags.map((t) => t.trim().toLowerCase()));

  const matchedTags: string[] = [];
  const missedTags: string[] = [];

  for (const req of requiredSet) {
    if (userTagSet.has(req)) {
      matchedTags.push(req);
    } else {
      missedTags.push(req);
    }
  }

  const tagRatio = requiredSet.size > 0 ? matchedTags.length / requiredSet.size : 0;
  const tagScore = TAG_WEIGHT * tagRatio;

  const total = Math.round((actionScore + tagScore) * 1000) / 1000;

  return {
    total,
    actionScore,
    tagScore: Math.round(tagScore * 1000) / 1000,
    correct: actionCorrect,
    missedTags,
    matchedTags,
  };
}

export function scoreCanonicalDrill(input: CanonicalScoreInput): CanonicalScoreResult {
  const activePool = input.activePool ?? "baseline";
  const answer = resolveDrillAnswer(input.drill, activePool);
  const result = scoreDrill({
    userAnswer: input.userAnswer,
    userTags: input.userTags,
    answer,
  });

  return {
    ...result,
    answer,
    activePool,
  };
}

