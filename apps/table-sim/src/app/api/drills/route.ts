import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { readCanonicalDrillsFromDirectory } from "../../../../../../packages/core/src/drills";

function resolveDrillsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "content", "drills"),
    path.resolve(process.cwd(), "..", "..", "content", "drills"),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ?? candidates[0];
}

export async function GET() {
  try {
    const drills = readCanonicalDrillsFromDirectory(resolveDrillsDir());
    return NextResponse.json(drills);
  } catch (error) {
    console.error("Failed to load canonical drills:", error);
    return NextResponse.json(
      { error: "Failed to load drills" },
      { status: 500 }
    );
  }
}
