import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@poker-coach/core/browser": path.resolve(__dirname, "packages/core/src/browser.ts"),
      "@poker-coach/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@poker-coach/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@": path.resolve(__dirname, "apps/table-sim/src"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.test.tsx", "apps/*/src/**/*.test.ts", "apps/*/src/**/*.test.tsx"],
    globals: true,
  },
});

