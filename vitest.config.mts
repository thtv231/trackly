import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests live next to the code (src/**/*.test.ts) and run on an in-memory Postgres (PGlite memory://).
// Acceptance tests (Playwright) live in tests/acceptance.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    env: { PGLITE_DIR: "memory://", TRACKLY_TEST: "1" },
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
