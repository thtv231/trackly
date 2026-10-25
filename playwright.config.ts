import { defineConfig, devices } from "@playwright/test";

// Trackly acceptance tests: 40 user stories (see STORIES.md).
// The tests start their own server on port 3100 with its own database (.data/test), a fake clock
// and a scripted fake model, so they never touch your `npm run dev` server or call the real Claude API.
export default defineConfig({
  testDir: "tests/acceptance",
  globalSetup: "./tests/global-setup.ts", // compile every page once before the tests run
  fullyParallel: false,
  workers: 1, // the tests share one database
  timeout: 20_000,
  expect: { timeout: 3_000 },
  reporter: [["list"], ["json", { outputFile: ".scoreboard/results.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    actionTimeout: 3_000, // an unbuilt story fails fast instead of waiting 20 seconds
    ...devices["Desktop Chrome"],
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TRACKLY_TEST: "1",
      PGLITE_DIR: ".data/test",
    },
  },
});
