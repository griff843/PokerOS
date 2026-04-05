import { describe, expect, it } from "vitest";
import type { DailyStudyPlan } from "./daily-study-plan";
import { buildConceptFollowUpSessionHref, buildDailyPlanSessionHref, parseDailyPlanSessionOverride } from "./daily-plan-session-bridge";

function makePlan(overrides: Partial<DailyStudyPlan> = {}): DailyStudyPlan {
  return {
    sessionLength: 45,
    planSummary: "Focus on blocker effects.",
    whyThisPlan: "Because blocker effects are slipping.",
    blocks: [
      {
        kind: "focus_concept",
        title: "Focus Concept: Blocker Effects",
        estimatedMinutes: 15,
        reason: "Top priority leak.",
        conceptKey: "blocker_effect",
        conceptLabel: "Blocker Effects",
        destination: "/app/session",
        priority: 10,
        actionInstruction: "Run the focus block.",
        completionCondition: "Finish the reps.",
        nextStepHint: null,
      },
    ],
    urgencySignals: [],
    expectedOutcome: "Primary weakness addressed.",
    totalEstimatedMinutes: 15,
    mainFocus: "Concept focus",
    successCriteria: "Finish the focus reps.",
    firstAction: { label: "Start Session", destination: "/app/session" },
    sessionGoal: "Train blocker effects.",
    finishingCondition: "When the block is done.",
    ...overrides,
  };
}

describe("daily plan session bridge", () => {
  it("builds a focused session href with count, intent, and block context", () => {
    const plan = makePlan();
    const href = buildDailyPlanSessionHref({
      plan,
      block: plan.blocks[0],
    });

    expect(href).toContain("/app/session?");
    expect(href).toContain("source=daily-plan");
    expect(href).toContain("count=10");
    expect(href).toContain("sessionLength=45");
    expect(href).toContain("intent=focus_concept");
    expect(href).toContain("focusConcept=blocker_effect");
    expect(href).toContain("focusLabel=Blocker+Effects");
    expect(href).toContain("blockKind=focus_concept");
  });

  it("derives recommended count from session length when no explicit block is supplied", () => {
    const href20 = buildDailyPlanSessionHref({ plan: makePlan({ sessionLength: 20 }) });
    const href90 = buildDailyPlanSessionHref({ plan: makePlan({ sessionLength: 90 }) });

    expect(href20).toContain("count=5");
    expect(href90).toContain("count=15");
  });

  it("builds a focus-concept session href directly from a concept tag", () => {
    const href = buildConceptFollowUpSessionHref({
      conceptTag: "concept:blocker_effect",
    });

    expect(href).toContain("/app/session?");
    expect(href).toContain("source=daily-plan");
    expect(href).toContain("count=8");
    expect(href).toContain("sessionLength=45");
    expect(href).toContain("focusConcept=blocker_effect");
    expect(href).toContain("focusLabel=Blocker+Effect");
    expect(href).toContain("blockTitle=Focus+Concept%3A+Blocker+Effect");
  });

  it("parses a valid daily-plan override payload", () => {
    const override = parseDailyPlanSessionOverride({
      source: "daily-plan",
      count: "12",
      sessionLength: "90",
      focusConcept: "blocker_effect",
      focusLabel: "Blocker Effects",
      intent: "focus_concept",
      blockKind: "focus_concept",
      blockTitle: "Focus Concept: Blocker Effects",
    });

    expect(override).toEqual({
      source: "daily-plan",
      recommendedCount: 12,
      sessionLength: 90,
      focusConceptKey: "blocker_effect",
      focusConceptLabel: "Blocker Effects",
      intent: "focus_concept",
      blockKind: "focus_concept",
      blockTitle: "Focus Concept: Blocker Effects",
    });
  });

  it("returns null when the request was not launched from the daily plan", () => {
    expect(parseDailyPlanSessionOverride({ count: "10" })).toBeNull();
  });
});
