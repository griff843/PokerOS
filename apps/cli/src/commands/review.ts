import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { openDatabase, getAllAttempts, getAllNodes, getDrill } from "@poker-coach/db";

export const reviewCommand = new Command("review")
  .description("Show weakest nodes, tags, and accuracy")
  .action(() => {
    const cwd = process.cwd();
    const dbPath = path.join(cwd, ".local", "coach.db");

    if (!fs.existsSync(dbPath)) {
      console.error("Database not found. Run 'coach init' first.");
      process.exit(1);
    }

    const db = openDatabase(dbPath);
    const attempts = getAllAttempts(db);

    if (attempts.length === 0) {
      console.log("No attempts found. Run 'coach drill' first.");
      db.close();
      return;
    }

    const nodes = getAllNodes(db);
    const nodeMap = new Map(nodes.map((n) => [n.node_id, n.name]));

    // Aggregate by node
    const nodeStats = new Map<string, { total: number; correct: number; scores: number[] }>();
    // Aggregate missed tags
    const tagMissCount = new Map<string, number>();

    for (const att of attempts) {
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

    // Overall
    const overallCorrect = attempts.filter((a) => a.correct_bool).length;
    const overallAccuracy = attempts.length > 0 ? (overallCorrect / attempts.length) * 100 : 0;
    const overallAvgScore = attempts.length > 0
      ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length
      : 0;

    console.log(`\n━━━ Poker Coach OS — Review ━━━\n`);
    console.log(`  Total attempts: ${attempts.length}`);
    console.log(`  Overall accuracy: ${overallAccuracy.toFixed(1)}%`);
    console.log(`  Average score: ${overallAvgScore.toFixed(3)}\n`);

    // Node breakdown (sorted by accuracy, worst first)
    const nodeEntries = [...nodeStats.entries()].sort((a, b) => {
      const accA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
      const accB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
      return accA - accB;
    });

    console.log("  Accuracy by Node (weakest first):");
    for (const [nodeId, stats] of nodeEntries) {
      const acc = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : "0.0";
      const avgScore = stats.scores.length > 0
        ? (stats.scores.reduce((s, v) => s + v, 0) / stats.scores.length).toFixed(3)
        : "0.000";
      const name = nodeMap.get(nodeId) ?? nodeId;
      console.log(`    ${nodeId} — ${name}: ${acc}% accuracy, avg score ${avgScore} (${stats.total} attempts)`);
    }

    // Top missed tags
    if (tagMissCount.size > 0) {
      const sortedTags = [...tagMissCount.entries()].sort((a, b) => b[1] - a[1]);
      console.log("\n  Top Missed Tags:");
      for (const [tag, count] of sortedTags.slice(0, 10)) {
        console.log(`    ${tag}: missed ${count} time(s)`);
      }
    }

    console.log("");
    db.close();
  });
