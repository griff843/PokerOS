import { buildLaneGapReport, loadAllDrillFiles } from "./lib/drill-audit.mjs";

const jsonOutput = process.argv.includes("--json");
const { drills } = loadAllDrillFiles();
const report = buildLaneGapReport(drills);

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log("Drill lane gaps");
console.log(`Total drills: ${report.totalDrills}`);
console.log("");
console.log("Street counts");
Object.entries(report.byStreet).forEach(([street, count]) => {
  console.log(`- ${street}: ${count}`);
});
console.log("");
console.log("Pot-type counts");
Object.entries(report.byPotType).forEach(([potType, count]) => {
  console.log(`- ${potType}: ${count}`);
});
console.log("");
console.log("Critical gaps");
if (report.criticalGaps.length === 0) {
  console.log("- none");
} else {
  report.criticalGaps.forEach((item) => console.log(`- ${item}`));
}
console.log("");
console.log("Imbalances");
if (report.imbalances.length === 0) {
  console.log("- none");
} else {
  report.imbalances.forEach((item) => console.log(`- ${item}`));
}
console.log("");
console.log("Top spots");
report.topSpots.forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
console.log("");
console.log("Sparse decisions");
if (report.sparseDecisions.length === 0) {
  console.log("- none");
} else {
  report.sparseDecisions.forEach((entry) => console.log(`- ${entry.key}: ${entry.count}`));
}
console.log("");
console.log("Sparse concepts");
if (report.sparseConcepts.length === 0) {
  console.log("- none");
} else {
  report.sparseConcepts.forEach((entry) => console.log(`- ${entry.key}: ${entry.count}`));
}
console.log("");
console.log("Recommendations");
if (report.recommendations.length === 0) {
  console.log("- no urgent gaps detected");
} else {
  report.recommendations.forEach((item) => console.log(`- ${item}`));
}
