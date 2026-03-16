import type {
  ConceptAuditEvent,
  ConceptAuditFeedResponse,
  ConceptAuditSeverity,
  ConceptAuditSourceFamily,
} from "./concept-audit-feed";

export interface ConceptAuditFamilySummary {
  family: ConceptAuditSourceFamily;
  count: number;
  latestTimestamp: string;
  latestLabel: string;
  highestSeverity: ConceptAuditSeverity;
}

export interface ConceptAuditFeedPreview {
  conceptKey: string;
  state: ConceptAuditFeedResponse["state"];
  eventCount: number;
  familiesPresent: ConceptAuditSourceFamily[];
  recentEvents: ConceptAuditEvent[];
  familySummaries: ConceptAuditFamilySummary[];
}

export async function fetchConceptAuditFeed(
  conceptId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConceptAuditFeedResponse | null> {
  const response = await fetchImpl(
    `/api/concept-audit-feed/${encodeURIComponent(conceptId)}`,
    { cache: "no-store" } as RequestInit,
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Failed to load concept audit feed");
  }

  return await response.json() as ConceptAuditFeedResponse;
}

export function selectRecentConceptAuditEvents(
  feed: ConceptAuditFeedResponse | null | undefined,
  limit = 5,
): ConceptAuditEvent[] {
  if (!feed || limit <= 0) {
    return [];
  }

  return feed.events.slice(0, limit);
}

export function summarizeConceptAuditFamilies(
  feed: ConceptAuditFeedResponse | null | undefined,
): ConceptAuditFamilySummary[] {
  if (!feed) {
    return [];
  }

  const byFamily = new Map<ConceptAuditSourceFamily, ConceptAuditFamilySummary>();

  for (const event of feed.events) {
    const existing = byFamily.get(event.sourceFamily);
    if (!existing) {
      byFamily.set(event.sourceFamily, {
        family: event.sourceFamily,
        count: 1,
        latestTimestamp: event.timestamp,
        latestLabel: event.label,
        highestSeverity: event.severity,
      });
      continue;
    }

    existing.count += 1;
    if (compareSeverity(event.severity, existing.highestSeverity) > 0) {
      existing.highestSeverity = event.severity;
    }
  }

  return [...byFamily.values()].sort((left, right) =>
    new Date(right.latestTimestamp).getTime() - new Date(left.latestTimestamp).getTime()
      || right.family.localeCompare(left.family)
  );
}

export function buildConceptAuditFeedPreview(
  feed: ConceptAuditFeedResponse | null | undefined,
  limit = 5,
): ConceptAuditFeedPreview | null {
  if (!feed) {
    return null;
  }

  return {
    conceptKey: feed.conceptKey,
    state: feed.state,
    eventCount: feed.eventCount,
    familiesPresent: feed.familiesPresent,
    recentEvents: selectRecentConceptAuditEvents(feed, limit),
    familySummaries: summarizeConceptAuditFamilies(feed),
  };
}

function compareSeverity(left: ConceptAuditSeverity, right: ConceptAuditSeverity): number {
  return severityRank(left) - severityRank(right);
}

function severityRank(severity: ConceptAuditSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "important":
      return 3;
    case "notable":
      return 2;
    default:
      return 1;
  }
}
