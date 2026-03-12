import type { TableSimDrill, TableSimAnswer } from "./drill-schema";
import { resolveDrillAnswer } from "../../../../packages/core/src/answer-resolution";
import type { TableSimActivePool } from "./session-plan";

const ACTION_WEIGHT = 0.7;
const TAG_WEIGHT = 0.3;
const ACTION_ONLY_WEIGHT = 0.5;
const SIZING_WEIGHT = 0.2;

export interface TableSimScoreInput {
  userAction: string;
  userSizeBucket: number | null;
  userTags: string[];
  drill: TableSimDrill;
  activePool?: TableSimActivePool;
}

export interface TableSimScoreResult {
  total: number;
  actionScore: number;
  sizingScore: number;
  tagScore: number;
  correct: boolean;
  missedTags: string[];
  matchedTags: string[];
  answer: TableSimAnswer;
}

export function scoreTableSimDrill(
  input: TableSimScoreInput
): TableSimScoreResult {
  const { userAction, userSizeBucket, userTags, drill, activePool } = input;
  const answer = resolveDrillAnswer(drill, activePool);

  const upperAction = userAction.toUpperCase().trim();
  const acceptedSet = new Set(
    answer.accepted.map((action) => action.toUpperCase())
  );
  acceptedSet.add(answer.correct.toUpperCase());
  const actionCorrect = acceptedSet.has(upperAction);

  const requiredSet = new Set(answer.required_tags);
  const userTagSet = new Set(userTags.map((tag) => tag.trim().toLowerCase()));
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
  const tagScore = Math.round(TAG_WEIGHT * tagRatio * 1000) / 1000;

  const hasSizing =
    drill.decision_point.sizing_buttons_enabled &&
    answer.correct_size?.size_bucket !== undefined;

  let actionScore: number;
  let sizingScore = 0;

  if (hasSizing && actionCorrect) {
    actionScore = ACTION_ONLY_WEIGHT;
    const sizingCorrect = userSizeBucket === answer.correct_size?.size_bucket;
    sizingScore = sizingCorrect ? SIZING_WEIGHT : 0;
  } else {
    actionScore = actionCorrect ? ACTION_WEIGHT : 0;
  }

  const total = Math.round((actionScore + sizingScore + tagScore) * 1000) / 1000;

  return {
    total,
    actionScore,
    sizingScore,
    tagScore,
    correct: actionCorrect,
    missedTags,
    matchedTags,
    answer,
  };
}

