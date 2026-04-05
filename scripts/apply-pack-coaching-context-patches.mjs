import { spawnSync } from "node:child_process";

// Update DATE when a new refined patch batch lands in pending/
const DATE = "2026-04-04";

const jobs = [
  {
    target: "content/drills/live_cash_pack1.json",
    patch: `out/reports/gold-lane-reviews/pending/pack1_coaching_context_refined_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack2.json",
    patch: `out/reports/gold-lane-reviews/pending/pack2_coaching_context_refined_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack3.json",
    patch: `out/reports/gold-lane-reviews/pending/pack3_coaching_context_refined_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack4.json",
    patch: `out/reports/gold-lane-reviews/pending/pack4_coaching_context_refined_${DATE}.json`,
  },
];

const apply = process.argv.includes("--apply");

for (const job of jobs) {
  const args = [
    "scripts/apply-coaching-context-patch.mjs",
    `--target=${job.target}`,
    `--patch=${job.patch}`,
    ...(apply ? ["--apply"] : []),
  ];

  console.log(`\n${apply ? "Applying" : "Dry run"}: ${job.patch} → ${job.target}`);
  const result = spawnSync("node", args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!apply) {
  console.log("\nAll dry runs passed. Re-run with --apply to write changes.");
}
