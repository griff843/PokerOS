import { loadAllDrillFiles } from "./lib/drill-audit.mjs";

const rawArgs = process.argv.slice(2);
const jsonOutput = rawArgs.includes("--json");
const idArg = rawArgs.find((arg) => arg.startsWith("--id="));
const drillId = idArg ? idArg.split("=")[1] : rawArgs.find((arg) => !arg.startsWith("--"));

if (!drillId) {
  console.error("Usage: node scripts/drill-trace.mjs --id=<drill_id>");
  process.exit(1);
}

const { drills } = loadAllDrillFiles();
const drill = drills.find((entry) => entry.drill_id === drillId);

if (!drill) {
  console.error(`Drill not found: ${drillId}`);
  process.exit(1);
}

const coaching = drill.coaching_context ?? {};
const diagnostics = Array.isArray(drill.diagnostic_prompts) ? drill.diagnostic_prompts : [];
const payload = {
  drill_id: drill.drill_id,
  file: drill.__file,
  title: drill.title,
  prompt: drill.prompt,
  street: drill.scenario?.street ?? null,
  pot_type: drill.scenario?.pot_type ?? null,
  positions: {
    hero: drill.scenario?.hero_position ?? null,
    villain: drill.scenario?.villain_position ?? null,
  },
  answer: {
    correct: drill.answer?.correct ?? null,
    explanation: drill.answer?.explanation ?? null,
  },
  answer_by_pool_keys: drill.answer_by_pool ? Object.keys(drill.answer_by_pool) : [],
  tags: Array.isArray(drill.tags) ? drill.tags : [],
  diagnostics: diagnostics.map((entry) => ({
    id: entry.id,
    type: entry.type,
    prompt: entry.prompt,
    expected_reasoning: entry.expected_reasoning,
  })),
  coaching_context: {
    key_concept: coaching.key_concept ?? null,
    difficulty_reason: coaching.difficulty_reason ?? null,
    why_preferred_line_works: coaching.why_preferred_line_works ?? null,
    follow_up: coaching.follow_up ?? null,
    follow_up_concepts: Array.isArray(coaching.follow_up_concepts) ? coaching.follow_up_concepts : [],
    range_context: coaching.range_context ?? null,
    range_notes: Array.isArray(coaching.range_notes) ? coaching.range_notes : [],
    value_buckets: Array.isArray(coaching.range_support?.value_buckets) ? coaching.range_support.value_buckets : [],
    bluff_buckets: Array.isArray(coaching.range_support?.bluff_buckets) ? coaching.range_support.bluff_buckets : [],
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

console.log(`Drill trace :: ${payload.drill_id}`);
console.log(`File: ${payload.file}`);
console.log(`Title: ${payload.title}`);
console.log(`Street / pot: ${payload.street} / ${payload.pot_type}`);
console.log(`Positions: ${payload.positions.hero} vs ${payload.positions.villain}`);
console.log("");
console.log("Prompt");
console.log(payload.prompt);
console.log("");
console.log("Answer");
console.log(`- correct: ${payload.answer.correct}`);
console.log(`- explanation: ${payload.answer.explanation}`);
console.log(`- pool variants: ${payload.answer_by_pool_keys.join(", ") || "none"}`);
console.log("");
console.log("Tags");
payload.tags.forEach((tag) => console.log(`- ${tag}`));
console.log("");
console.log("Diagnostics");
if (payload.diagnostics.length === 0) {
  console.log("- none");
} else {
  payload.diagnostics.forEach((entry) => {
    console.log(`- ${entry.id} :: ${entry.type}`);
    console.log(`  prompt: ${entry.prompt}`);
    console.log(`  expected: ${entry.expected_reasoning}`);
  });
}
console.log("");
console.log("Coaching context");
Object.entries(payload.coaching_context).forEach(([key, value]) => {
  if (Array.isArray(value)) {
    console.log(`- ${key}: ${value.length > 0 ? value.join(" | ") : "none"}`);
    return;
  }
  console.log(`- ${key}: ${value ?? "none"}`);
});
