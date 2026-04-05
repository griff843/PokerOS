import fs from "node:fs";
import path from "node:path";

export const CONTENT_DRILLS_DIR = path.resolve(process.cwd(), "content", "drills");

export const EXPECTED_STREETS = ["preflop", "flop", "turn", "river"];
export const EXPECTED_POT_TYPES = ["SRP", "3BP", "4BP", "limp", "squeeze", "multiway"];

const CORE_COACHING_FIELDS = [
  "key_concept",
  "difficulty_reason",
  "why_preferred_line_works",
  "follow_up",
  "follow_up_concepts",
  "range_context",
  "range_notes",
  "range_support",
];

export function loadAllDrillFiles(drillsDir = CONTENT_DRILLS_DIR) {
  const entries = fs
    .readdirSync(drillsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const filePath = path.join(drillsDir, entry.name);
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const drills = Array.isArray(raw) ? raw : [raw];

      return {
        name: entry.name,
        path: filePath,
        drills,
      };
    });

  const allDrills = entries.flatMap((entry) =>
    entry.drills.map((drill) => ({
      ...drill,
      __file: entry.name,
      __path: entry.path,
    })),
  );

  return {
    files: entries,
    drills: allDrills,
  };
}

export function buildCoverageSummary(drills) {
  return {
    totalDrills: drills.length,
    withDiagnosticPrompts: countWhere(drills, hasDiagnosticPrompts),
    withCoachingContext: countWhere(drills, hasCoachingContext),
    withCompleteCoachingContext: countWhere(drills, hasCompleteCoachingContext),
    withFollowUp: countWhere(drills, hasFollowUp),
    withFollowUpConcepts: countWhere(drills, hasFollowUpConcepts),
    withAnswerByPool: countWhere(drills, hasAnswerByPool),
    byStreet: tally(drills, (drill) => drill.scenario?.street ?? "unknown"),
    byPotType: tally(drills, (drill) => drill.scenario?.pot_type ?? "unknown"),
    byDecision: tallyTags(drills, "decision"),
    byConcept: tallyTags(drills, "concept"),
    bySpot: tallyTags(drills, "spot"),
  };
}

export function buildPerFileSummary(files) {
  return files.map((file) => {
    const drills = file.drills;
    const coverage = buildCoverageSummary(drills);

    return {
      file: file.name,
      drills: drills.length,
      diagnosticCoverage: ratio(countWhere(drills, hasDiagnosticPrompts), drills.length),
      coachingCoverage: ratio(countWhere(drills, hasCompleteCoachingContext), drills.length),
      followUpCoverage: ratio(countWhere(drills, hasFollowUp), drills.length),
      followUpConceptCoverage: ratio(countWhere(drills, hasFollowUpConcepts), drills.length),
      answerByPoolCoverage: ratio(countWhere(drills, hasAnswerByPool), drills.length),
      streets: coverage.byStreet,
      potTypes: coverage.byPotType,
      topDecisions: topEntries(coverage.byDecision, 3),
      topConcepts: topEntries(coverage.byConcept, 3),
    };
  });
}

export function buildFollowUpAudit(drills) {
  const invalidConceptTags = [];
  const missingFollowUp = [];
  const missingFollowUpConcepts = [];
  const conceptUsage = {};

  drills.forEach((drill) => {
    const concepts = getFollowUpConcepts(drill);

    if (!hasFollowUp(drill)) {
      missingFollowUp.push(drill);
    }
    if (concepts.length === 0) {
      missingFollowUpConcepts.push(drill);
    }

    concepts.forEach((concept) => {
      if (!concept.startsWith("concept:")) {
        invalidConceptTags.push({ drillId: drill.drill_id, concept, file: drill.__file });
      }
      conceptUsage[concept] = (conceptUsage[concept] ?? 0) + 1;
    });
  });

  return {
    totalDrills: drills.length,
    withFollowUp: countWhere(drills, hasFollowUp),
    withFollowUpConcepts: countWhere(drills, hasFollowUpConcepts),
    invalidConceptTags,
    missingFollowUp,
    missingFollowUpConcepts,
    topFollowUpConcepts: topEntries(conceptUsage, 15),
  };
}

export function buildLaneGapReport(drills) {
  const coverage = buildCoverageSummary(drills);
  const recommendations = [];
  const criticalGaps = [];
  const imbalances = [];

  for (const street of EXPECTED_STREETS) {
    if (!coverage.byStreet[street]) {
      criticalGaps.push(`No ${street} drills exist yet.`);
    }
  }

  for (const potType of EXPECTED_POT_TYPES) {
    if (!coverage.byPotType[potType]) {
      criticalGaps.push(`No ${potType} drills exist yet.`);
    }
  }

  const total = Math.max(drills.length, 1);
  const streetShares = EXPECTED_STREETS.map((street) => ({
    street,
    count: coverage.byStreet[street] ?? 0,
    share: (coverage.byStreet[street] ?? 0) / total,
  }));

  streetShares.forEach(({ street, count, share }) => {
    if (count > 0 && share < 0.12) {
      imbalances.push(`${street} is underweight at ${formatPercent(share)} (${count}/${total}).`);
    }
  });

  const riverShare = (coverage.byStreet.river ?? 0) / total;
  if (riverShare > 0.45) {
    imbalances.push(`river dominates the library at ${formatPercent(riverShare)}.`);
  }

  const preflopShare = (coverage.byStreet.preflop ?? 0) / total;
  const flopShare = (coverage.byStreet.flop ?? 0) / total;
  if (preflopShare < 0.2) {
    recommendations.push("Expand preflop volume first: open/facing open/3-bet/4-bet trees are still too thin.");
  }
  if (flopShare < 0.2) {
    recommendations.push("Expand flop SRP and 3-bet-pot decision volume so training is not river-heavy.");
  }
  if (!coverage.byPotType.squeeze) {
    recommendations.push("Add squeeze drills: live cash players see these often and the library has none.");
  }
  if (!coverage.byPotType["4BP"]) {
    recommendations.push("Add 4-bet pot drills to cover high-leverage preflop and stack-off thresholds.");
  }
  if (!coverage.byPotType.multiway) {
    recommendations.push("Add multiway postflop drills so live-cash training reflects real table conditions.");
  }

  const topSpots = topEntries(coverage.bySpot, 10);
  const sparseDecisions = topEntries(coverage.byDecision, 20).filter((entry) => entry.count <= 3);
  const sparseConcepts = topEntries(coverage.byConcept, 20).filter((entry) => entry.count <= 3);

  return {
    totalDrills: drills.length,
    byStreet: coverage.byStreet,
    byPotType: coverage.byPotType,
    topSpots,
    criticalGaps,
    imbalances,
    sparseDecisions,
    sparseConcepts,
    recommendations,
  };
}

export function hasDiagnosticPrompts(drill) {
  return Array.isArray(drill.diagnostic_prompts) && drill.diagnostic_prompts.length > 0;
}

export function hasCoachingContext(drill) {
  return drill.coaching_context && typeof drill.coaching_context === "object";
}

export function hasCompleteCoachingContext(drill) {
  if (!hasCoachingContext(drill)) {
    return false;
  }

  return CORE_COACHING_FIELDS.every((field) => hasCoachingField(drill.coaching_context, field));
}

export function hasFollowUp(drill) {
  return nonEmptyString(drill.coaching_context?.follow_up);
}

export function hasFollowUpConcepts(drill) {
  return getFollowUpConcepts(drill).length > 0;
}

export function hasAnswerByPool(drill) {
  return drill.answer_by_pool && typeof drill.answer_by_pool === "object" && Object.keys(drill.answer_by_pool).length > 0;
}

export function getFollowUpConcepts(drill) {
  const concepts = drill.coaching_context?.follow_up_concepts;
  return Array.isArray(concepts) ? concepts.filter(nonEmptyString) : [];
}

export function tally(drills, selector) {
  return drills.reduce((counts, drill) => {
    const key = selector(drill);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function tallyTags(drills, category) {
  const counts = {};
  const prefix = `${category}:`;

  drills.forEach((drill) => {
    const tags = Array.isArray(drill.tags) ? drill.tags : [];
    tags
      .filter((tag) => typeof tag === "string" && tag.startsWith(prefix))
      .forEach((tag) => {
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
  });

  return counts;
}

export function topEntries(record, limit = 10) {
  return Object.entries(record)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function ratio(count, total) {
  return {
    count,
    total,
    pct: total === 0 ? 0 : Number(((count / total) * 100).toFixed(1)),
  };
}

export function formatRatio(summary) {
  return `${summary.count}/${summary.total} (${summary.pct}%)`;
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function countWhere(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function hasCoachingField(context, field) {
  const value = context[field];
  if (field === "follow_up_concepts" || field === "range_notes") {
    return Array.isArray(value) && value.length > 0;
  }
  if (field === "range_support") {
    return hasRangeSupport(value);
  }
  return nonEmptyString(value);
}

function hasRangeSupport(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Array.isArray(value.value_buckets) && value.value_buckets.length > 0
    && Array.isArray(value.bluff_buckets) && value.bluff_buckets.length > 0;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
