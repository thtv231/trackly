import { chromium, type FullConfig } from "@playwright/test";

// The test server runs `next dev`: each page is compiled the first time it is opened (2–3 seconds),
// which can exceed the 3-second test timeout. Open every page once with a real browser first, so both
// the server code and the browser JS are compiled. Add new pages here when you add them to the app.
const PAGES = [
  "/login",
  "/",
  "/projects/TRK",
  "/projects/TRK/new",
  "/projects/TRK/board",
  "/projects/TRK/sprints",
  "/projects/TRK/sprints/1/burndown",
  "/issues/TRK-1",
  "/notifications",
];
const GETS = ["/api/issues/TRK-1", "/projects/TRK/export.csv", "/api/test/outbox", "/api/test/assistant-log"];
// POSTs with an empty body only answer 400/404 and change nothing, but they compile the route.
const POSTS = [
  "/api/issues",
  "/api/issues/TRK-0/transition",
  "/api/issues/TRK-0/comments",
  "/api/issues/TRK-0/labels",
  "/api/projects/TRK/sprints",
  "/api/sprints/0/issues",
  "/api/sprints/0/start",
  "/api/sprints/0/complete",
  "/api/notifications/read",
  "/api/assistant",
  "/api/assistant/confirm",
  "/api/test/assistant-script",
  "/api/test/clock",
];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const t = { timeout: 120_000 };
  await page.request.post("/api/test/reset", { data: { now: "2026-11-02T09:00:00.000Z" }, ...t });
  await page.goto("/login", { waitUntil: "load", ...t });
  await page.request.post("/api/login", { data: { email: "alice@trackly.test", password: "trackly-demo" }, ...t });
  for (const url of PAGES) await page.goto(url, { waitUntil: "load", ...t });
  for (const url of GETS) await page.request.get(url, t);
  await page.request.patch("/api/issues/TRK-0", { data: {}, ...t });
  await page.request.delete("/api/issues/TRK-0", t);
  for (const url of POSTS) await page.request.post(url, { data: {}, ...t });
  await browser.close();
}
