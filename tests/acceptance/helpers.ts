import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// Default fake time for every test: Monday, Nov 2, 2026, 09:00 UTC.
export const NOW = "2026-11-02T09:00:00.000Z";
export const PASSWORD = "trackly-demo";

// Seed users (db/seed.sql).
export const USERS = {
  alice: { email: "alice@trackly.test", name: "Alice Nguyen" }, // admin
  bob: { email: "bob@trackly.test", name: "Bob Smith" }, // member
  carol: { email: "carol@trackly.test", name: "Carol Diaz" }, // member
  dave: { email: "dave@trackly.test", name: "Dave Lee" }, // viewer
} as const;
export type UserName = keyof typeof USERS;

/** Rebuild the test database from the seed and set the fake clock. */
export async function reset(request: APIRequestContext, now = NOW) {
  const r = await request.post("/api/test/reset", { data: { now }, timeout: 60_000 });
  expect(r.ok(), "POST /api/test/reset must work (TRACKLY_TEST=1)").toBeTruthy();
}

/** Move the fake clock without touching the data. */
export async function setNow(request: APIRequestContext, now: string) {
  const r = await request.post("/api/test/clock", { data: { now }, timeout: 60_000 });
  expect(r.ok()).toBeTruthy();
}

/** Sign the browser in through the API (fast). The page and page.request share the cookie. */
export async function login(page: Page, user: UserName) {
  const r = await page.request.post("/api/login", { data: { email: USERS[user].email, password: PASSWORD } });
  expect(r.status(), "POST /api/login").toBe(200);
}

/** Sign an API request context in as `user` and return it (its cookie jar keeps the session). */
export async function api(request: APIRequestContext, user: UserName): Promise<APIRequestContext> {
  const r = await request.post("/api/login", { data: { email: USERS[user].email, password: PASSWORD } });
  expect(r.status(), "POST /api/login").toBe(200);
  return request;
}

type NewIssue = {
  projectKey?: string;
  title?: string;
  type?: string;
  priority?: string;
  assignee?: string | null;
  description?: string;
  points?: number | null;
};

/** POST /api/issues and return the new key (expects 201). */
export async function createIssue(request: APIRequestContext, input: NewIssue = {}): Promise<string> {
  const r = await request.post("/api/issues", {
    data: { projectKey: "TRK", title: "New issue", type: "task", priority: "medium", ...input },
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).key;
}

export async function getIssue(request: APIRequestContext, key: string) {
  const r = await request.get(`/api/issues/${key}`);
  expect(r.status(), await r.text()).toBe(200);
  return r.json();
}

export function patchIssue(request: APIRequestContext, key: string, data: Record<string, unknown>) {
  return request.patch(`/api/issues/${key}`, { data });
}

export function transition(request: APIRequestContext, key: string, to: string) {
  return request.post(`/api/issues/${key}/transition`, { data: { to } });
}

/** Move an issue through several statuses via the API, expecting 200 each time. */
export async function moveTo(request: APIRequestContext, key: string, ...path: string[]) {
  for (const to of path) {
    const r = await transition(request, key, to);
    expect(r.status(), `${key} → ${to}: ${await r.text()}`).toBe(200);
  }
}

/** POST /api/projects/[key]/sprints and return the new sprint id. */
export async function createSprint(
  request: APIRequestContext,
  name: string,
  start: string,
  end: string,
  projectKey = "TRK",
): Promise<number> {
  const r = await request.post(`/api/projects/${projectKey}/sprints`, { data: { name, start, end } });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).id;
}

export async function addToSprint(request: APIRequestContext, sprintId: number, key: string) {
  const r = await request.post(`/api/sprints/${sprintId}/issues`, { data: { key } });
  expect(r.status(), await r.text()).toBe(200);
}

/** The issue-row whose issue-key is exactly `key`. */
export function row(page: Page, key: string): Locator {
  return page
    .getByTestId("issue-row")
    .filter({ has: page.getByTestId("issue-key").filter({ hasText: new RegExp(`^\\s*${key}\\s*$`) }) });
}

/** The keys of the visible issue rows, in order. */
export async function rowKeys(page: Page): Promise<string[]> {
  return page.getByTestId("issue-row").getByTestId("issue-key").allInnerTexts();
}

export function column(page: Page, status: string): Locator {
  return page.locator(`[data-testid="board-column"][data-status="${status}"]`);
}

export function card(page: Page, key: string): Locator {
  return page.locator(`[data-testid="board-card"][data-key="${key}"]`);
}

/** data-key of every card in a column, in order. */
export async function cardKeys(col: Locator): Promise<string[]> {
  return col.getByTestId("board-card").evaluateAll((els) => els.map((e) => e.getAttribute("data-key") ?? ""));
}

// ---- Assistant (group F) ----

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id?: string; name: string; input: Record<string, unknown> };
export type ScriptedReply = { content: Block[]; chunkDelayMs?: number };

/** Queue replies for the scripted fake model. */
export async function scriptAssistant(request: APIRequestContext, replies: ScriptedReply[], configured?: boolean) {
  const r = await request.post("/api/test/assistant-script", { data: { replies, configured } });
  expect(r.ok()).toBeTruthy();
}

export type LoggedRequest = {
  model: string;
  system: unknown;
  messages: { role: string; content: unknown }[];
  tools: { name: string }[];
};

/** Every request the app sent to the model so far. */
export async function assistantLog(request: APIRequestContext): Promise<LoggedRequest[]> {
  const r = await request.get("/api/test/assistant-log");
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** The tool_result block for `toolUseId` in a logged request (searches the last user message). */
export function toolResult(req: LoggedRequest, toolUseId: string): { content: unknown; is_error?: boolean } | undefined {
  const last = req.messages[req.messages.length - 1];
  if (!last || last.role !== "user" || !Array.isArray(last.content)) return undefined;
  return (last.content as { type: string; tool_use_id?: string; content: unknown; is_error?: boolean }[]).find(
    (b) => b.type === "tool_result" && b.tool_use_id === toolUseId,
  );
}

/** Open the assistant on a project page and send one message. */
export async function askAssistant(page: Page, text: string, path = "/projects/TRK") {
  if (!page.url().endsWith(path)) await page.goto(path);
  const panel = page.getByTestId("assistant-panel");
  if (!(await panel.isVisible())) await page.getByTestId("assistant-open").click();
  await expect(panel).toBeVisible();
  await page.getByTestId("assistant-input").fill(text);
  await page.getByTestId("assistant-send").click();
}
