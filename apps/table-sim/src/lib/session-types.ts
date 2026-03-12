import type { DiagnosticCaptureResult } from "@poker-coach/core/browser";
import type { TableSimAnswer, TableSimDrill } from "./drill-schema";
import type {
  TableSimActivePool,
  TableSimSelectedDrill,
  TableSimSessionPlan,
  TableSimSessionPlanMetadata,
} from "./session-plan";

export type SessionPhase =
  | "configuring"
  | "board_scan"
  | "deciding"
  | "feedback"
  | "summary";

export type DecisionConfidence = "not_sure" | "pretty_sure" | "certain";

export interface SessionConfig {
  drillCount: number;
  timed: boolean;
  activePool: TableSimActivePool;
}

export interface DrillAttemptDiagnostic {
  promptId: string;
  prompt: string;
  promptType: string;
  concept?: string;
  expectedReasoning: string;
  optionId: string;
  optionLabel: string;
  result: DiagnosticCaptureResult;
}

export interface DrillAttempt {
  attemptId: string;
  timestamp: string;
  reflection: string;
  diagnostic?: DrillAttemptDiagnostic | null;
  drill: TableSimDrill;
  selection: TableSimSelectedDrill;
  activePool: TableSimActivePool;
  resolvedAnswer: TableSimAnswer;
  userAction: string;
  userSizeBucket: number | null;
  userTags: string[];
  confidence: DecisionConfidence;
  score: number;
  actionScore: number;
  sizingScore: number;
  tagScore: number;
  correct: boolean;
  missedTags: string[];
  matchedTags: string[];
  elapsedMs: number;
}

export interface SessionState {
  phase: SessionPhase;
  sessionId: string | null;
  config: SessionConfig;
  drills: TableSimSelectedDrill[];
  planMetadata: TableSimSessionPlanMetadata | null;
  currentIndex: number;
  attempts: DrillAttempt[];
  zoomBoard: boolean;
  decisionStartedAt: number;
  startedAt: number;
  reflections: Record<number, string>;
  reviewTimestamp: string | null;
  reviewInitialFilter: "all" | "incorrect";
  reviewInitialTag: string | null;
}

export interface StartSessionPayload {
  sessionId: string;
  config: SessionConfig;
  plan: TableSimSessionPlan;
}

