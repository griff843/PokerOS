"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import {
  sessionReducer,
  initialSessionState,
  type SessionAction,
} from "./session-reducer";
import type { DrillAttempt, SessionConfig, SessionState } from "./session-types";
import type { TableSimSessionPlan } from "./session-plan";
import { toPersistedAttemptRecord } from "./study-attempts";

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  startSession: (args: { config: SessionConfig; plan: TableSimSessionPlan }) => string;
  submitDecision: (attempt: DrillAttempt) => Promise<void>;
  setReflection: (index: number, text: string) => Promise<void>;
  setDiagnostic: (index: number, diagnostic: DrillAttempt["diagnostic"]) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  const value = useMemo<SessionContextValue>(() => ({
    state,
    dispatch,
    startSession: ({ config, plan }) => {
      const sessionId = crypto.randomUUID();
      dispatch({ type: "START_SESSION", sessionId, config, plan });
      return sessionId;
    },
    submitDecision: async (attempt) => {
      dispatch({ type: "SUBMIT_DECISION", attempt });

      if (!state.sessionId) {
        return;
      }

      const body = toPersistedAttemptRecord(attempt, state.sessionId);
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to persist attempt");
      }
    },
    setDiagnostic: async (index, diagnostic) => {
      dispatch({ type: "SET_DIAGNOSTIC", index, diagnostic });

      const attempt = state.attempts[index];
      if (!attempt) {
        return;
      }

      const response = await fetch(`/api/attempts/${attempt.attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnostic }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist diagnostic");
      }
    },
    setReflection: async (index, text) => {
      dispatch({ type: "SET_REFLECTION", index, text });

      const attempt = state.attempts[index];
      if (!attempt) {
        return;
      }

      const response = await fetch(`/api/attempts/${attempt.attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection: text }),
      });

      if (!response.ok) {
        throw new Error("Failed to persist reflection");
      }
    },
  }), [state]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

