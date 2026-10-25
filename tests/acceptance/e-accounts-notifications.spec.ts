import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { api, card, getIssue, login, moveTo, patchIssue, PASSWORD, reset, row, setNow, transition, USERS } from "./helpers";

// Group E: accounts and notifications (S29–S35)
test.beforeEach(async ({ request }) => reset(request));

test("S29 sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(USERS.alice.email);
  await page.getByTestId("login-password").fill("wrong-password");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toHaveText("Invalid email or password");
  await page.getByTestId("login-email").fill("nobody@trackly.test");
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toHaveText("Invalid email or password");

  await page.getByTestId("login-email").fill(USERS.alice.email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("logout")).toBeVisible();
  await expect(page.getByText(USERS.alice.name).first()).toBeVisible();

  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/issues/TRK-1")).status()).toBe(401);
});

test("S30 protected pages", async ({ page, request, baseURL }) => {
  for (const path of ["/", "/projects/TRK", "/projects/TRK/board", "/projects/TRK/sprints", "/issues/TRK-1", "/notifications"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login/);
  }
  await expect(page.getByTestId("login-email")).toBeVisible();

  for (const [method, path] of [
    ["GET", "/api/issues/TRK-1"],
    ["POST", "/api/issues"],
    ["PATCH", "/api/issues/TRK-1"],
    ["DELETE", "/api/issues/TRK-1"],
    ["POST", "/api/issues/TRK-1/transition"],
    ["POST", "/api/assistant"],
  ]) {
    const r = await request.fetch(path, { method, data: method === "GET" || method === "DELETE" ? undefined : {} });
    expect(r.status(), `${method} ${path}`).toBe(401);
    expect((await r.json()).error, `${method} ${path}`).toBeTruthy();
  }

  // a made-up session cookie is not a session
  await page.context().addCookies([{ name: "trackly_session", value: "not-a-real-session", url: baseURL! }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("S31 viewer role", async ({ page }) => {
  await login(page, "dave");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-row")).toHaveCount(12);
  await expect(page.getByTestId("new-issue")).toHaveCount(0);

  await page.goto("/issues/TRK-1");
  await expect(page.getByTestId("issue-title")).toHaveText("Set up CI pipeline");
  await expect(page.getByTestId("issue-edit")).toHaveCount(0);
  await expect(page.getByTestId("issue-delete")).toHaveCount(0);
  await expect(page.getByTestId("label-input")).toHaveCount(0);

  await page.goto("/projects/TRK/board");
  await expect(page.getByTestId("board-card")).toHaveCount(12);
  await expect(page.getByTestId("card-move")).toHaveCount(0);

  const req = page.request;
  expect((await req.get("/api/issues/TRK-1")).status()).toBe(200);
  expect(
    (await req.post("/api/issues", { data: { projectKey: "TRK", title: "Viewer issue", type: "task", priority: "low" } })).status(),
  ).toBe(403);
  expect((await patchIssue(req, "TRK-1", { title: "Changed by a viewer" })).status()).toBe(403);
  expect((await transition(req, "TRK-1", "in_progress")).status()).toBe(403);
  expect((await req.delete("/api/issues/TRK-1")).status()).toBe(403);
  const issue = await getIssue(req, "TRK-1");
  expect(issue).toMatchObject({ title: "Set up CI pipeline", status: "todo" });

  // a member does see the controls
  await login(page, "bob");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("new-issue")).toBeVisible();
});

test("S32 notifications", async ({ page, request }) => {
  await api(request, "alice");
  expect((await patchIssue(request, "TRK-4", { assignee: USERS.bob.email })).status()).toBe(200);
  await api(request, "carol");
  const c = await request.post("/api/issues/TRK-1/comments", { data: { body: "@bob can you take a look?" } });
  expect(c.status(), await c.text()).toBe(201);
  // assigning yourself does not notify you
  expect((await patchIssue(request, "TRK-8", { assignee: USERS.carol.email })).status()).toBe(200);

  await login(page, "bob");
  await page.goto("/notifications");
  const items = page.getByTestId("notification-item");
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: "TRK-4" })).toHaveCount(1);
  await expect(items.filter({ hasText: "TRK-1" })).toHaveCount(1);
  await expect(page.getByTestId("notification-count")).toHaveText("2");

  await page.getByTestId("notifications-read").click();
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  await expect(page.getByTestId("notification-item")).toHaveCount(2);

  await login(page, "carol");
  await page.goto("/notifications");
  await expect(page.getByTestId("notification-item")).toHaveCount(0);
});

test("S33 webhooks", async ({ request }) => {
  await api(request, "alice");
  await moveTo(request, "TRK-1", "in_progress");
  expect((await transition(request, "TRK-2", "done")).status()).toBe(409); // refused: no delivery
  await moveTo(request, "OPS-1", "in_progress");

  type Delivery = { event: string; body: string; headers: Record<string, string> };
  const out = (await (await request.get("/api/test/outbox")).json()) as Delivery[];
  const changes = out.filter((d) => d.event === "issue.status_changed");
  expect(changes).toHaveLength(2);

  const [trk, ops] = changes;
  expect(JSON.parse(trk.body)).toMatchObject({ event: "issue.status_changed", key: "TRK-1", from: "todo", to: "in_progress" });
  expect(trk.headers["X-Trackly-Signature"]).toBe(createHmac("sha256", "whsec_trk_demo").update(trk.body).digest("hex"));
  expect(JSON.parse(ops.body)).toMatchObject({ key: "OPS-1", from: "todo", to: "in_progress" });
  expect(ops.headers["X-Trackly-Signature"]).toBe(createHmac("sha256", "whsec_ops_demo").update(ops.body).digest("hex"));
});

test("S34 due dates", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK");
  await expect(row(page, "TRK-10").getByTestId("overdue-badge")).toBeVisible(); // due Oct 30, To Do
  await expect(row(page, "TRK-4").getByTestId("overdue-badge")).toHaveCount(0); // due Nov 10
  await expect(row(page, "TRK-5").getByTestId("overdue-badge")).toHaveCount(0); // due Oct 20 but Done
  await expect(page.getByTestId("overdue-badge")).toHaveCount(1);

  await page.goto("/projects/TRK/board");
  await expect(card(page, "TRK-10").getByTestId("overdue-badge")).toBeVisible();
  await expect(card(page, "TRK-4").getByTestId("overdue-badge")).toHaveCount(0);

  await page.goto("/issues/TRK-4");
  await expect(page.getByTestId("issue-due")).toContainText("Nov 10, 2026");

  await api(request, "alice");
  expect((await patchIssue(request, "TRK-8", { dueDate: "2026-11-11" })).status()).toBe(200);
  expect((await getIssue(request, "TRK-8")).dueDate).toBe("2026-11-11");
  expect((await patchIssue(request, "TRK-8", { dueDate: "next week" })).status()).toBe(400);

  await setNow(request, "2026-11-11T09:00:00.000Z");
  await page.goto("/projects/TRK");
  await expect(row(page, "TRK-4").getByTestId("overdue-badge")).toBeVisible(); // Nov 10 has passed
  await expect(row(page, "TRK-8").getByTestId("overdue-badge")).toHaveCount(0); // due today is not overdue
});

test("S35 mobile and accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const unlabeled = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => (el as HTMLInputElement).type !== "hidden")
        .filter(
          (el) =>
            !((el as HTMLInputElement).labels?.length ?? 0) &&
            !el.getAttribute("aria-label") &&
            !el.getAttribute("aria-labelledby"),
        )
        .map((el) => el.outerHTML.slice(0, 100)),
    );

  await page.goto("/login");
  await expect(page.getByTestId("login-email")).toBeVisible();
  expect(await unlabeled()).toEqual([]);

  await login(page, "alice");
  const pages: [string, string][] = [
    ["/", "project-card"],
    ["/projects/TRK", "issue-row"],
    ["/issues/TRK-1", "issue-title"],
    ["/projects/TRK/new", "new-title"],
  ];
  for (const [path, testId] of pages) {
    await page.goto(path);
    await expect(page.getByTestId(testId).first(), path).toBeVisible();
    await expect(page.locator("html"), path).toHaveAttribute("lang", "en");
    await expect(page, path).toHaveTitle(/· Trackly$/);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${path} scroll width`).toBeLessThanOrEqual(375);
    expect(await unlabeled(), path).toEqual([]);
  }
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-search")).toBeVisible();
  expect(await unlabeled()).toEqual([]);
});
