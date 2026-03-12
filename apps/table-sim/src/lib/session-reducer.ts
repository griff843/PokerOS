import type { SessionState, DrillAttempt, StartSessionPayload } from "./session-types";

export type SessionAction =
  | ({ type: "START_SESSION" } & StartSessionPayload)
  | { type: "DISMISS_BOARD_SCAN" }
  | { type: "SUBMIT_DECISION"; attempt: DrillAttempt }
  | { type: "NEXT_DRILL" }
  | { type: "TOGGLE_ZOOM" }
  | { type: "RESET" }
  | { type: "SET_REFLECTION"; index: number; text: string }
  | { type: "SET_DIAGNOSTIC"; index: number; diagnostic: DrillAttempt["diagnostic"] }
  | { type: "START_REVIEW"; filter: "all" | "incorrect"; tagFilter: string | null };

export const initialSessionState: SessionState = {
  phase: "configuring",
  sessionId: null,
  config: { drillCount: 10, timed: true, activePool: "baseline" },
  drills: [],
  planMetadata: null,
  currentIndex: 0,
  attempts: [],
  zoomBoard: false,
  decisionStartedAt: 0,
  startedAt: 0,
  reflections: {},
  reviewTimestamp: null,
  reviewInitialFilter: "all",
  reviewInitialTag: null,
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction
): SessionState {
  switch (action.type) {
    case "START_SESSION":
      return {
        ...state,
        phase: "board_scan",
        sessionId: action.sessionId,
        config: action.config,
        drills: action.plan.drills,
        planMetadata: action.plan.metadata,
        currentIndex: 0,
        attempts: [],
        zoomBoard: false,
        startedAt: Date.now(),
        decisionStartedAt: 0,
        reflections: {},
        reviewTimestamp: null,
        reviewInitialFilter: "all",
        reviewInitialTag: null,
      };

    case "DISMISS_BOARD_SCAN":
      return {
        ...state,
        phase: "deciding",
        decisionStartedAt: Date.now(),
      };

    case "SUBMIT_DECISION":
      return {
        ...state,
        phase: "feedback",
        attempts: [...state.attempts, action.attempt],
      };

    case "NEXT_DRILL": {
      const nextIndex = state.currentIndex + 1;
      if (nextIndex >= state.drills.length) {
        return { ...state, phase: "summary" };
      }
      return {
        ...state,
        phase: "board_scan",
        currentIndex: nextIndex,
        decisionStartedAt: 0,
      };
    }

    case "TOGGLE_ZOOM":
      return { ...state, zoomBoard: !state.zoomBoard };

    case "RESET":
      return initialSessionState;

    case "SET_DIAGNOSTIC": {
      const attempt = state.attempts[action.index];
      return {
        ...state,
        attempts: attempt
          ? state.attempts.map((entry, index) => index === action.index ? { ...entry, diagnostic: action.diagnostic } : entry)
          : state.attempts,
      };
    }

    case "SET_REFLECTION": {
      const attempt = state.attempts[action.index];
      return {
        ...state,
        attempts: attempt
          ? state.attempts.map((entry, index) => index === action.index ? { ...entry, reflection: action.text } : entry)
          : state.attempts,
        reflections: {
          ...state.reflections,
          [action.index]: action.text,
        },
      };
    }

    case "START_REVIEW":
      return {
        ...state,
        reviewTimestamp: state.reviewTimestamp ?? new Date().toISOString(),
        reviewInitialFilter: action.filter,
        reviewInitialTag: action.tagFilter,
      };

    default:
      return state;
  }
}

