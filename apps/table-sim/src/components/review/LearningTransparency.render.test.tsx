import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachDiagnosisCard, RangeSupportCard } from "./LearningTransparency";
import type { TransparencyDiagnosisView, TransparencyRangeView } from "@/lib/learning-transparency";

describe("LearningTransparency cards", () => {
  it("renders visible range sections, hand framing, and teaching hooks", () => {
    const rangeView: TransparencyRangeView = {
      title: "Why Bluff Catching Matters",
      subtitle: "Visible range truth authored for this node.",
      points: [
        "Calling works only if enough missed draws survive to river.",
        "What makes it difficult: the same card improves both ranges differently.",
      ],
      streetShifts: [
        {
          street: "turn",
          label: "Turn",
          summary: "The turn check removed clean double-barrel value and preserved delayed floats.",
          board: "Js 7c 3d 2h",
          availability: "structured",
          isDecisionStreet: false,
        },
        {
          street: "river",
          label: "River",
          summary: "The paired river tightened value but left enough air to defend trips.",
          board: "Js 7c 3d 2h Jd",
          availability: "structured",
          isDecisionStreet: true,
        },
      ],
      sections: [
        {
          title: "Villain Value Region",
          buckets: [
            {
              label: "Boats",
              combos: ["77", "33", "A7"],
              note: "These hands cleanly value bet large.",
            },
          ],
        },
        {
          title: "Hero Bluff Catchers",
          buckets: [
            {
              label: "High trips",
              combos: ["J9", "JT"],
              frequencyHint: "Mostly call",
            },
          ],
        },
      ],
      handFocus: {
        label: "This combo",
        summary: "High-end bluff catcher",
        note: "It blocks enough value to keep calling.",
      },
      blockerNotes: ["Holding a jack trims value."],
      thresholdNotes: ["This combo stays above threshold."],
      available: true,
    };

    const html = renderToStaticMarkup(<RangeSupportCard rangeView={rangeView} />);

    expect(html).toContain("Villain Value Region");
    expect(html).toContain("Hero Bluff Catchers");
    expect(html).toContain("High-end bluff catcher");
    expect(html).toContain("Street Shift Logic");
    expect(html).toContain("The turn check removed clean double-barrel value and preserved delayed floats.");
    expect(html).toContain("Blocker Logic");
    expect(html).toContain("Threshold Logic");
    expect(html).toContain("Mostly call");
  });

  it("renders coach diagnosis when a reasoning signal is present", () => {
    const diagnosis: TransparencyDiagnosisView = {
      available: true,
      headline: "This reads more like threshold error than a simple answer miss.",
      detail: "You found the right hand class, but the combo still landed on the wrong side of the calling threshold.",
      nextFocus: "Revisit river defense thresholds with more attention on which bluff catchers survive.",
      tags: ["threshold error", "river bluff catching"],
      promptType: "threshold",
      prompt: "Why is this still a candidate bluff-catcher?",
      selectedReasoning: "Second pair is simply too weak versus the overbet.",
      expectedReasoning: "Some second-pair hands must continue because the line still contains enough missed air.",
    };

    const html = renderToStaticMarkup(<CoachDiagnosisCard diagnosis={diagnosis} />);

    expect(html).toContain("Coach Diagnosis");
    expect(html).toContain("threshold error");
    expect(html).toContain("river bluff catching");
    expect(html).toContain("Reasoning Check");
    expect(html).toContain("Your Reasoning");
    expect(html).toContain("Expected Reasoning");
    expect(html).toContain("threshold");
  });
});
