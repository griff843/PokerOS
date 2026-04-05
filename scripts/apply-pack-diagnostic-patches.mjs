import { spawnSync } from "node:child_process";

const DATE = "2026-04-03";

const jobs = [
  {
    target: "content/drills/live_cash_pack1.json",
    patch: `out/reports/gold-lane-reviews/pending/pack1_diagnostic_prompts_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack2.json",
    patch: `out/reports/gold-lane-reviews/pending/pack2_diagnostic_prompts_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack3.json",
    patch: `out/reports/gold-lane-reviews/pending/pack3_diagnostic_prompts_${DATE}.json`,
  },
  {
    target: "content/drills/live_cash_pack4.json",
    patch: `out/reports/gold-lane-reviews/pending/pack4_diagnostic_prompts_${DATE}.json`,
  },
];

const apply = process.argv.includes("--apply");

for (const job of jobs) {
  const args = [
    "scripts/apply-diagnostic-patch.mjs",
    `--target=${job.target}`,
    `--patch=${job.patch}`,
  ];
  if (apply) {
    args.push("--apply");
  }

  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
