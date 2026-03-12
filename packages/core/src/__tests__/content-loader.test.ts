import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, getAllNodes, getAllDrills } from "@poker-coach/db";
import { loadNodes, loadDrills, loadAllContent, CanonicalDrillSchema } from "../index";
import path from "node:path";

const CONTENT_DIR = path.resolve(__dirname, "../../../../content");

describe("content-loader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it("loads nodes from content/nodes idempotently", () => {
    const nodesDir = path.join(CONTENT_DIR, "nodes");
    const count1 = loadNodes(db, nodesDir);
    expect(count1).toBe(10);
    expect(getAllNodes(db)).toHaveLength(10);

    const count2 = loadNodes(db, nodesDir);
    expect(count2).toBe(10);
    expect(getAllNodes(db)).toHaveLength(10);
  });

  it("loads canonical drills from content/drills idempotently", () => {
    loadNodes(db, path.join(CONTENT_DIR, "nodes"));

    const drillsDir = path.join(CONTENT_DIR, "drills");
    const count1 = loadDrills(db, drillsDir);
    expect(count1).toBe(30);
    expect(getAllDrills(db)).toHaveLength(30);
    expect(CanonicalDrillSchema.parse(JSON.parse(getAllDrills(db)[0].content_json)).drill_id).toBeTruthy();

    const count2 = loadDrills(db, drillsDir);
    expect(count2).toBe(30);
    expect(getAllDrills(db)).toHaveLength(30);
  });

  it("loads truth-rich exemplar drills with authored history, steps, and pool contrast", () => {
    loadNodes(db, path.join(CONTENT_DIR, "nodes"));
    loadDrills(db, path.join(CONTENT_DIR, "drills"));

    const drills = getAllDrills(db).map((row) => CanonicalDrillSchema.parse(JSON.parse(row.content_json)));
    const stepDrill = drills.find((drill) => drill.drill_id === "d_04_01");
    const poolDrill = drills.find((drill) => drill.drill_id === "d_07_03");
    const valueDrill = drills.find((drill) => drill.drill_id === "d_03_02");
    const diagnosticDrill = drills.find((drill) => drill.drill_id === "d_01_01");

    expect(stepDrill?.scenario.action_history.length).toBeGreaterThan(0);
    expect(stepDrill?.coaching_context?.what_changed_by_street?.length).toBeGreaterThan(0);
    expect(stepDrill?.steps?.length).toBeGreaterThan(1);
    expect(stepDrill?.steps?.[0]?.coaching_context?.what_changed_by_street?.[0]?.detail).toBeTruthy();

    expect(poolDrill?.scenario.action_history.length).toBeGreaterThan(0);
    expect(poolDrill?.answer_by_pool?.B?.correct).toBeTruthy();
    expect(poolDrill?.coaching_context?.population_note).toBeTruthy();
    expect(poolDrill?.coaching_context?.range_support?.bluff_catchers?.[0]?.label).toContain("Ace-high");

    expect(valueDrill?.coaching_context?.range_support?.value_buckets?.length).toBeGreaterThan(0);
    expect(valueDrill?.coaching_context?.range_support?.hero_hand_bucket?.summary).toContain("Upper value region");

    expect(diagnosticDrill?.diagnostic_prompts?.[0]?.prompt).toContain("What bluffs still reach this river");
    expect(diagnosticDrill?.diagnostic_prompts?.[0]?.options?.some((option) => option.matches_expected)).toBe(true);
  });

  it("loads all content with loadAllContent", () => {
    const result = loadAllContent(db, CONTENT_DIR);
    expect(result.nodes).toBe(10);
    expect(result.drills).toBe(30);
  });

  it("returns 0 for non-existent directories", () => {
    const count = loadNodes(db, "/nonexistent/path");
    expect(count).toBe(0);
  });
});
