import { expect, test } from "@playwright/test";
import { api, createIssue, getIssue, login, reset, row, rowKeys } from "./helpers";

// Group A: projects and issues (S01–S08)
test.beforeEach(async ({ request }) => reset(request));

test("S01 see all projects", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/");
  const cards = page.getByTestId("project-card");
  await expect(cards).toHaveCount(2);
  const trk = cards.filter({ has: page.getByTestId("project-key").filter({ hasText: /^\s*TRK\s*$/ }) });
  await expect(trk.getByTestId("project-name")).toHaveText("Trackly Web");
  await expect(trk.getByTestId("project-open-count")).toHaveText("10");
  const ops = cards.filter({ has: page.getByTestId("project-key").filter({ hasText: /^\s*OPS\s*$/ }) });
  await expect(ops.getByTestId("project-name")).toHaveText("Operations");
  await expect(ops.getByTestId("project-open-count")).toHaveText("3");
});

test("S02 list a project's issues", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-row")).toHaveCount(12);
  expect(await rowKeys(page)).toEqual(Array.from({ length: 12 }, (_, i) => `TRK-${i + 1}`));

  const r4 = row(page, "TRK-4");
  await expect(r4.getByTestId("issue-title")).toHaveText("Drag and drop cards on the board");
  await expect(r4.getByTestId("issue-status")).toHaveText("To Do");
  await expect(r4.getByTestId("issue-priority")).toHaveText("Medium");
  await expect(r4.getByTestId("issue-assignee")).toHaveText("Unassigned");

  const r3 = row(page, "TRK-3");
  await expect(r3.getByTestId("issue-status")).toHaveText("In Progress");
  await expect(r3.getByTestId("issue-priority")).toHaveText("High");
  await expect(r3.getByTestId("issue-assignee")).toHaveText("Bob Smith");
  await expect(row(page, "TRK-7").getByTestId("issue-status")).toHaveText("In Review");
});

test("S03 issue detail", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/issues/TRK-3");
  await expect(page.getByTestId("issue-key")).toHaveText("TRK-3");
  await expect(page.getByTestId("issue-title")).toHaveText("Add password reset to the login flow");
  await expect(page.getByTestId("issue-type")).toHaveText("Story");
  await expect(page.getByTestId("issue-status")).toHaveText("In Progress");
  await expect(page.getByTestId("issue-priority")).toHaveText("High");
  await expect(page.getByTestId("issue-assignee")).toHaveText("Bob Smith");
  await expect(page.getByTestId("issue-reporter")).toHaveText("Alice Nguyen");
  const desc = page.getByTestId("issue-description");
  await expect(desc.locator("strong")).toHaveText("password reset");
  await expect(desc.locator("li")).toHaveCount(2);
  await expect(desc).not.toContainText("**");
});

test("S04 create an issue", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/new");
  await page.getByTestId("new-submit").click();
  await expect(page.getByTestId("form-error")).toContainText("Title");

  await page.getByTestId("new-title").fill("Export issues to PDF");
  await page.getByTestId("new-type").selectOption({ label: "Bug" });
  await page.getByTestId("new-priority").selectOption({ label: "High" });
  await page.getByTestId("new-assignee").selectOption({ label: "Carol Diaz" });
  await page.getByTestId("new-description").fill("Needs **page numbers**.");
  await page.getByTestId("new-submit").click();
  await expect(page).toHaveURL(/\/issues\/TRK-13$/);
  await expect(page.getByTestId("issue-title")).toHaveText("Export issues to PDF");
  await expect(page.getByTestId("issue-type")).toHaveText("Bug");
  await expect(page.getByTestId("issue-priority")).toHaveText("High");
  await expect(page.getByTestId("issue-assignee")).toHaveText("Carol Diaz");
  await expect(page.getByTestId("issue-reporter")).toHaveText("Alice Nguyen");

  await api(request, "alice");
  const base = { projectKey: "TRK", type: "task", priority: "medium" };
  for (const title of ["", "   ", "x".repeat(121)]) {
    const r = await request.post("/api/issues", { data: { ...base, title } });
    expect(r.status(), `title of length ${title.length}`).toBe(400);
    expect((await r.json()).error).toBeTruthy();
  }
  expect((await request.post("/api/issues", { data: { ...base, title: "Epic", type: "epic" } })).status()).toBe(400);
  expect((await request.post("/api/issues", { data: { ...base, title: "Bad", priority: "urgent" } })).status()).toBe(400);
  expect(await createIssue(request, { title: "x".repeat(120) })).toBe("TRK-14");
});

test("S05 keys count per project", async ({ request }) => {
  await api(request, "alice");
  expect(await createIssue(request, { projectKey: "OPS", title: "Renew the domain" })).toBe("OPS-5");
  expect(await createIssue(request, { projectKey: "TRK", title: "Keyboard shortcuts" })).toBe("TRK-13");
  expect(await createIssue(request, { projectKey: "OPS", title: "Patch the kernel" })).toBe("OPS-6");
  expect((await getIssue(request, "OPS-5")).title).toBe("Renew the domain");
  const unknown = await request.post("/api/issues", { data: { projectKey: "NOPE", title: "x", type: "task", priority: "low" } });
  expect([400, 404]).toContain(unknown.status());
});

test("S06 simultaneous creates", async ({ request }) => {
  await api(request, "alice");
  const responses = await Promise.all(
    [1, 2, 3, 4, 5].map((i) =>
      request.post("/api/issues", { data: { projectKey: "TRK", title: `Parallel ${i}`, type: "task", priority: "medium" } }),
    ),
  );
  for (const r of responses) expect(r.status(), await r.text()).toBe(201);
  const keys = await Promise.all(responses.map(async (r) => (await r.json()).key as string));
  expect(new Set(keys).size).toBe(5);
  expect([...keys].sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]))).toEqual([
    "TRK-13",
    "TRK-14",
    "TRK-15",
    "TRK-16",
    "TRK-17",
  ]);
  const titles = new Set<string>();
  for (const k of keys) titles.add((await getIssue(request, k)).title);
  expect(titles.size).toBe(5);
  expect(await createIssue(request, { title: "After the burst" })).toBe("TRK-18");
});

test("S07 edit an issue", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/issues/TRK-4");
  await page.getByTestId("issue-edit").click();
  await page.getByTestId("edit-title").fill("Drag and drop cards between columns");
  await page.getByTestId("edit-priority").selectOption({ label: "Highest" });
  await page.getByTestId("edit-assignee").selectOption({ label: "Bob Smith" });
  await page.getByTestId("edit-points").selectOption({ label: "5" });
  await page.getByTestId("issue-save").click();
  await expect(page.getByTestId("issue-title")).toHaveText("Drag and drop cards between columns");
  await expect(page.getByTestId("issue-priority")).toHaveText("Highest");
  await expect(page.getByTestId("issue-assignee")).toHaveText("Bob Smith");
  await expect(page.getByTestId("issue-points")).toHaveText("5");

  await page.reload();
  await expect(page.getByTestId("issue-title")).toHaveText("Drag and drop cards between columns");
  await api(request, "alice");
  const issue = await getIssue(request, "TRK-4");
  expect(issue).toMatchObject({
    title: "Drag and drop cards between columns",
    priority: "highest",
    assignee: "bob@trackly.test",
    points: 5,
  });
});

test("S08 delete an issue", async ({ page, request }) => {
  await login(page, "bob");
  await page.goto("/issues/TRK-11");
  await expect(page.getByTestId("issue-title")).toBeVisible();
  await expect(page.getByTestId("issue-delete")).toHaveCount(0);
  await api(request, "bob");
  expect((await request.delete("/api/issues/TRK-11")).status()).toBe(403);

  await login(page, "alice");
  await page.goto("/issues/TRK-12");
  await page.getByTestId("issue-delete").click();
  await page.getByTestId("confirm-delete").click();
  await expect(page).not.toHaveURL(/\/issues\/TRK-12$/);
  const res = await page.goto("/issues/TRK-12");
  expect(res?.status()).toBe(404);

  await api(request, "alice");
  expect((await request.get("/api/issues/TRK-12")).status()).toBe(404);
  expect((await request.delete("/api/issues/TRK-12")).status()).toBe(404);
  expect(await createIssue(request, { title: "Comes after the deleted one" })).toBe("TRK-13");
  await page.goto("/projects/TRK");
  await expect(row(page, "TRK-12")).toHaveCount(0);
  await expect(row(page, "TRK-13")).toHaveCount(1);
});
