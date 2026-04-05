import { buildFollowUpAudit, loadAllDrillFiles } from "./lib/drill-audit.mjs";

const jsonOutput = process.argv.includes("--json");
const { drills } = loadAllDrillFiles();
const report = buildFollowUpAudit(drills);

if (jsonOutput) {
  console.log(JSON.stringify({
    ...report,
    missingFollowUp: report.missingFollowUp.map((drill) => ({ drill_id: drill.drill_id, file: drill.__file })),
    missingFollowUpConcepts: report.missingFollowUpConcepts.map((drill) => ({ drill_id: drill.drill_id, file: drill.__file })),
  }, null, 2));
  process.exit(0);
}

console.log("Follow-up audit");
console.log(`Drills with follow_up: ${report.withFollowUp}/${report.totalDrills}`);
console.log(`Drills with follow_up_concepts: ${report.withFollowUpConcepts}/${report.totalDrills}`);
console.log("");
console.log("Top follow-up concepts");
report.topFollowUpConcepts.forEach((entry) => {
  console.log(`- ${entry.key}: ${entry.count}`);
});
console.log("");
console.log("Invalid follow-up concept tags");
if (report.invalidConceptTags.length === 0) {
  console.log("- none");
} else {
  report.invalidConceptTags.forEach((entry) => {
    console.log(`- ${entry.file} :: ${entry.drillId} :: ${entry.concept}`);
  });
}
console.log("");
console.log("Missing follow_up");
if (report.missingFollowUp.length === 0) {
  console.log("- none");
} else {
  report.missingFollowUp.slice(0, 20).forEach((drill) => {
    console.log(`- ${drill.__file} :: ${drill.drill_id}`);
  });
  if (report.missingFollowUp.length > 20) {
    console.log(`- ... ${report.missingFollowUp.length - 20} more`);
  }
}
console.log("");
console.log("Missing follow_up_concepts");
if (report.missingFollowUpConcepts.length === 0) {
  console.log("- none");
} else {
  report.missingFollowUpConcepts.slice(0, 20).forEach((drill) => {
    console.log(`- ${drill.__file} :: ${drill.drill_id}`);
  });
  if (report.missingFollowUpConcepts.length > 20) {
    console.log(`- ... ${report.missingFollowUpConcepts.length - 20} more`);
  }
}
