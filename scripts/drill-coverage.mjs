import {
  buildCoverageSummary,
  buildPerFileSummary,
  formatRatio,
  loadAllDrillFiles,
  topEntries,
} from "./lib/drill-audit.mjs";

const jsonOutput = process.argv.includes("--json");
const { files, drills } = loadAllDrillFiles();
const overall = buildCoverageSummary(drills);
const perFile = buildPerFileSummary(files);

if (jsonOutput) {
  console.log(JSON.stringify({ overall, perFile }, null, 2));
  process.exit(0);
}

console.log("Drill coverage");
console.log(`Total drills: ${overall.totalDrills}`);
console.log(`Diagnostic prompts: ${formatRatio({ count: overall.withDiagnosticPrompts, total: overall.totalDrills, pct: overall.totalDrills === 0 ? 0 : Number(((overall.withDiagnosticPrompts / overall.totalDrills) * 100).toFixed(1)) })}`);
console.log(`Complete coaching_context: ${formatRatio({ count: overall.withCompleteCoachingContext, total: overall.totalDrills, pct: overall.totalDrills === 0 ? 0 : Number(((overall.withCompleteCoachingContext / overall.totalDrills) * 100).toFixed(1)) })}`);
console.log(`Follow-up coverage: ${formatRatio({ count: overall.withFollowUp, total: overall.totalDrills, pct: overall.totalDrills === 0 ? 0 : Number(((overall.withFollowUp / overall.totalDrills) * 100).toFixed(1)) })}`);
console.log(`Follow-up concept coverage: ${formatRatio({ count: overall.withFollowUpConcepts, total: overall.totalDrills, pct: overall.totalDrills === 0 ? 0 : Number(((overall.withFollowUpConcepts / overall.totalDrills) * 100).toFixed(1)) })}`);
console.log(`Pool-aware answers: ${formatRatio({ count: overall.withAnswerByPool, total: overall.totalDrills, pct: overall.totalDrills === 0 ? 0 : Number(((overall.withAnswerByPool / overall.totalDrills) * 100).toFixed(1)) })}`);
console.log("");
console.log("By file");
perFile.forEach((entry) => {
  console.log(`- ${entry.file}: drills=${entry.drills}, diagnostics=${formatRatio(entry.diagnosticCoverage)}, coaching=${formatRatio(entry.coachingCoverage)}, follow_up=${formatRatio(entry.followUpCoverage)}, concepts=${formatRatio(entry.followUpConceptCoverage)}, answer_by_pool=${formatRatio(entry.answerByPoolCoverage)}`);
});
console.log("");
console.log("Street mix");
topEntries(overall.byStreet, 10).forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
console.log("");
console.log("Pot-type mix");
topEntries(overall.byPotType, 10).forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
console.log("");
console.log("Top decision tags");
topEntries(overall.byDecision, 10).forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
console.log("");
console.log("Top concept tags");
topEntries(overall.byConcept, 10).forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
