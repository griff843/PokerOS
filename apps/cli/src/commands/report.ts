import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { openDatabase, getAllAttempts, getAttemptsSince, getAllNodes, getDrill, getDueDrills } from "@poker-coach/db";

export const reportCommand = new Command("report")
  .description("Generate reports")
  .option("--weekly", "Generate a weekly report", false)
  .action((opts) => {
    if (!opts.weekly) {
      console.log("Use --weekly to generate a weekly report.");
      return;
    }

    const cwd = process.cwd();
    const dbPath = path.join(cwd, ".local", "coach.db");

    if (!fs.existsSync(dbPath)) {
      console.error("Database not found. Run 'coach init' first.");
      process.exit(1);
    }

    const db = openDatabase(dbPath);

    // Get attempts from last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekAttempts = getAttemptsSince(db, weekAgo);
    const allAttempts = getAllAttempts(db);
    const nodes = getAllNodes(db);
    const nodeMap = new Map(nodes.map((n) => [n.node_id, n.name]));

    // Overall stats
    const weekCorrect = weekAttempts.filter((a) => a.correct_bool).length;
    const weekAccuracy = weekAttempts.length > 0 ? ((weekCorrect / weekAttempts.length) * 100).toFixed(1) : "N/A";
    const weekAvgScore = weekAttempts.length > 0
      ? (weekAttempts.reduce((s, a) => s + a.score, 0) / weekAttempts.length).toFixed(3)
      : "N/A";

    // Time stats
    const timedAttempts = weekAttempts.filter((a) => a.elapsed_ms > 0);
    const avgTimeMs = timedAttempts.length > 0
      ? timedAttempts.reduce((s, a) => s + a.elapsed_ms, 0) / timedAttempts.length
      : 0;
    const minTimeMs = timedAttempts.length > 0
      ? Math.min(...timedAttempts.map((a) => a.elapsed_ms))
      : 0;
    const maxTimeMs = timedAttempts.length > 0
      ? Math.max(...timedAttempts.map((a) => a.elapsed_ms))
      : 0;

    // By node
    const nodeStats = new Map<string, { total: number; correct: number; scores: number[] }>();
    const tagMissCount = new Map<string, number>();

    for (const att of weekAttempts) {
      const drill = getDrill(db, att.drill_id);
      if (!drill) continue;

      const nodeId = drill.node_id;
      if (!nodeStats.has(nodeId)) {
        nodeStats.set(nodeId, { total: 0, correct: 0, scores: [] });
      }
      const ns = nodeStats.get(nodeId)!;
      ns.total++;
      if (att.correct_bool) ns.correct++;
      ns.scores.push(att.score);

      const missed: string[] = JSON.parse(att.missed_tags_json);
      for (const tag of missed) {
        tagMissCount.set(tag, (tagMissCount.get(tag) ?? 0) + 1);
      }
    }

    // Due drills (recommendations)
    const now = new Date().toISOString();
    const dueDrills = getDueDrills(db, now, 10);
    const dueList = dueDrills.map((s) => {
      const drill = getDrill(db, s.drill_id);
      return drill ? `${drill.drill_id} (${drill.node_id})` : s.drill_id;
    });

    // Build markdown report
    const lines: string[] = [
      `# Weekly Report — Poker Coach OS`,
      ``,
      `**Generated:** ${new Date().toISOString()}`,
      `**Period:** Last 7 days`,
      ``,
      `## Overall Stats`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Drills attempted (this week) | ${weekAttempts.length} |`,
      `| Drills attempted (all time) | ${allAttempts.length} |`,
      `| Accuracy (this week) | ${weekAccuracy}% |`,
      `| Average score (this week) | ${weekAvgScore} |`,
      ``,
    ];

    if (timedAttempts.length > 0) {
      lines.push(
        `## Time Stats`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Timed drills | ${timedAttempts.length} |`,
        `| Avg time | ${(avgTimeMs / 1000).toFixed(1)}s |`,
        `| Fastest | ${(minTimeMs / 1000).toFixed(1)}s |`,
        `| Slowest | ${(maxTimeMs / 1000).toFixed(1)}s |`,
        ``,
      );
    }

    // Accuracy by node
    lines.push(`## Accuracy by Node`, ``);
    const nodeEntries = [...nodeStats.entries()].sort((a, b) => {
      const accA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
      const accB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
      return accA - accB;
    });

    if (nodeEntries.length > 0) {
      lines.push(`| Node | Name | Accuracy | Avg Score | Attempts |`);
      lines.push(`|------|------|----------|-----------|----------|`);
      for (const [nodeId, stats] of nodeEntries) {
        const acc = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : "0.0";
        const avgScore = stats.scores.length > 0
          ? (stats.scores.reduce((s, v) => s + v, 0) / stats.scores.length).toFixed(3)
          : "0.000";
        const name = nodeMap.get(nodeId) ?? nodeId;
        lines.push(`| ${nodeId} | ${name} | ${acc}% | ${avgScore} | ${stats.total} |`);
      }
      lines.push(``);
    } else {
      lines.push(`*No node data for this week.*`, ``);
    }

    // Top missed tags
    lines.push(`## Top Missed Tags`, ``);
    if (tagMissCount.size > 0) {
      const sortedTags = [...tagMissCount.entries()].sort((a, b) => b[1] - a[1]);
      lines.push(`| Tag | Times Missed |`);
      lines.push(`|-----|-------------|`);
      for (const [tag, count] of sortedTags.slice(0, 10)) {
        lines.push(`| ${tag} | ${count} |`);
      }
      lines.push(``);
    } else {
      lines.push(`*No missed tags this week.*`, ``);
    }

    // Recommended drills
    lines.push(`## Recommended Next Drills`, ``);
    if (dueList.length > 0) {
      for (const item of dueList) {
        lines.push(`- ${item}`);
      }
    } else {
      lines.push(`*No drills currently due. All caught up!*`);
    }
    lines.push(``);

    const markdown = lines.join("\n");

    // Write report
    const reportsDir = path.join(cwd, "out", "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, "weekly.md");
    fs.writeFileSync(reportPath, markdown, "utf-8");

    // Write proof
    const proofsDir = path.join(cwd, "out", "proofs");
    fs.mkdirSync(proofsDir, { recursive: true });
    const proofPath = path.join(proofsDir, "proof_weekly_report.md");
    const proofContent = [
      `Poker Coach OS — Weekly Report Proof`,
      `Date: ${new Date().toISOString()}`,
      `Command: coach report --weekly`,
      ``,
      `Report written to: ${reportPath}`,
      `Week attempts: ${weekAttempts.length}`,
      `All-time attempts: ${allAttempts.length}`,
      ``,
      `Status: SUCCESS`,
    ].join("\n");
    fs.writeFileSync(proofPath, proofContent, "utf-8");

    console.log(`\nPoker Coach OS — Weekly Report`);
    console.log(`  Report: ${reportPath}`);
    console.log(`  Proof: ${proofPath}`);

    // Also print report to console
    console.log(`\n${markdown}`);

    db.close();
  });
