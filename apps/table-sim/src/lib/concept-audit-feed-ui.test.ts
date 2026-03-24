import { describe, expect, it, vi } from "vitest";
import type { ConceptAuditFeedResponse } from "./concept-audit-feed";
import {
  buildConceptAuditFeedPreview,
  fetchConceptAuditFeed,
  selectRecentConceptAuditEvents,
  summarizeConceptAuditFamilies,
} from "./concept-audit-feed-ui";

function makeFeed(overrides: Partial<ConceptAuditFeedResponse> = {}): ConceptAuditFeedResponse {
  return {
    conceptKey: overrides.conceptKey ?? "river_bluff_catching",
    state: overrides.state ?? "audit_history",
    eventCount: overrides.eventCount ?? 4,
    familiesPresent: overrides.familiesPresent ?? ["diagnosis", "retention", "transfer"],
    events: overrides.events ?? [
      {
        id: "retention:1",
        timestamp: "2026-03-14T12:00:00.000Z",
        eventType: "retention_completed_fail",
        sourceFamily: "retention",
        label: "Retention check failed",
        severity: "important",
        metadata: {},
      },
      {
        id: "transfer:1",
        timestamp: "2026-03-14T11:00:00.000Z",
        eventType: "transfer_status_recorded",
        sourceFamily: "transfer",
        label: "Transfer status changed to transfer regressed",
        severity: "important",
        metadata: {},
      },
      {
        id: "diagnosis:2",
        timestamp: "2026-03-13T12:00:00.000Z",
        eventType: "diagnosis_recorded",
        sourceFamily: "diagnosis",
        label: "Diagnosis recorded: threshold error",
        severity: "notable",
        metadata: {},
      },
      {
        id: "diagnosis:1",
        timestamp: "2026-03-12T12:00:00.000Z",
        eventType: "diagnosis_recorded",
        sourceFamily: "diagnosis",
        label: "Diagnosis recorded: range misread",
        severity: "info",
        metadata: {},
      },
    ],
  };
}

describe("concept audit feed ui adapter", () => {
  it("fetches and parses audit feed responses", async () => {
    const feed = makeFeed();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => feed,
    } as Response)) as typeof fetch;

    await expect(fetchConceptAuditFeed("river bluff", fetchImpl)).resolves.toEqual(feed);
    expect(fetchImpl).toHaveBeenCalledWith("/api/concept-audit-feed/river%20bluff", { cache: "no-store" });
  });

  it("handles not-found and sparse histories cleanly", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
    } as Response)) as typeof fetch;

    await expect(fetchConceptAuditFeed("missing", fetchImpl)).resolves.toBeNull();

    const preview = buildConceptAuditFeedPreview(makeFeed({
      state: "no_history",
      eventCount: 0,
      familiesPresent: [],
      events: [],
    }));

    expect(preview).toEqual({
      conceptKey: "river_bluff_catching",
      state: "no_history",
      eventCount: 0,
      familiesPresent: [],
      recentEvents: [],
      familySummaries: [],
    });
  });

  it("selects recent events without reshaping the canonical order", () => {
    const feed = makeFeed();

    expect(selectRecentConceptAuditEvents(feed, 2).map((event) => event.id)).toEqual([
      "retention:1",
      "transfer:1",
    ]);
    expect(selectRecentConceptAuditEvents(feed, 0)).toEqual([]);
  });

  it("builds lightweight family summaries for UI snippets", () => {
    const feed = makeFeed();

    expect(summarizeConceptAuditFamilies(feed)).toEqual([
      {
        family: "retention",
        count: 1,
        latestTimestamp: "2026-03-14T12:00:00.000Z",
        latestLabel: "Retention check failed",
        highestSeverity: "important",
      },
      {
        family: "transfer",
        count: 1,
        latestTimestamp: "2026-03-14T11:00:00.000Z",
        latestLabel: "Transfer status changed to transfer regressed",
        highestSeverity: "important",
      },
      {
        family: "diagnosis",
        count: 2,
        latestTimestamp: "2026-03-13T12:00:00.000Z",
        latestLabel: "Diagnosis recorded: threshold error",
        highestSeverity: "notable",
      },
    ]);
  });

  it("builds a reusable preview bundle for recent-event surfaces", () => {
    const feed = makeFeed();

    expect(buildConceptAuditFeedPreview(feed, 3)).toEqual({
      conceptKey: "river_bluff_catching",
      state: "audit_history",
      eventCount: 4,
      familiesPresent: ["diagnosis", "retention", "transfer"],
      recentEvents: feed.events.slice(0, 3),
      familySummaries: summarizeConceptAuditFamilies(feed),
    });
  });
});
