import { expect, test } from "@playwright/test";
import { addToSprint, api, createSprint, login, moveTo, patchIssue, reset, setNow } from "./helpers";

// Group D: sprints and reports (S23–S28)
test.beforeEach(async ({ request }) => reset(request));

const backlogRow = (page: import("@playwright/test").Page, key: string) =>
  page.locator(`[data-testid="backlog-row"][data-key="${key}"]`);
const sprintIssue = (page: import("@playwright/test").Page, key: string) =>
  page.locator(`[data-testid="sprint-issue"][data-key="${key}"]`);

test("S23 create a sprint", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/sprints");
  await page.getByTestId("sprint-name").fill("Sprint 1");
  await page.getByTestId("sprint-start").fill("2026-11-02");
  await page.getByTestId("sprint-end").fill("2026-11-13");
  await page.getByTestId("sprint-create").click();
  const created = page.getByTestId("sprint-card").filter({ hasText: "Sprint 1" });
  await expect(created).toHaveCount(1);
  await expect(created).toContainText("Nov 2, 2026");
  await expect(created).toContainText("Nov 13, 2026");

  await page.getByTestId("sprint-name").fill("Bad sprint");
  await page.getByTestId("sprint-start").fill("2026-11-10");
  await page.getByTestId("sprint-end").fill("2026-11-10");
  await page.getByTestId("sprint-create").click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByTestId("sprint-card").filter({ hasText: "Bad sprint" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("sprint-card")).toHaveCount(1);
  await api(request, "alice");
  const bad = await request.post("/api/projects/TRK/sprints", {
    data: { name: "Backwards", start: "2026-11-20", end: "2026-11-10" },
  });
  expect(bad.status()).toBe(400);
});

test("S24 plan a sprint", async ({ page, request }) => {
  await api(request, "alice");
  await createSprint(request, "Sprint 1", "2026-11-02", "2026-11-13");

  await login(page, "alice");
  await page.goto("/projects/TRK/sprints");
  await expect(backlogRow(page, "TRK-1")).toBeVisible();
  await expect(backlogRow(page, "TRK-5")).toHaveCount(0); // Done issues are not in the backlog
  await backlogRow(page, "TRK-1").getByTestId("add-to-sprint").click();
  await expect(sprintIssue(page, "TRK-1")).toBeVisible();
  await expect(backlogRow(page, "TRK-1")).toHaveCount(0);
  await backlogRow(page, "TRK-4").getByTestId("add-to-sprint").click();
  await expect(sprintIssue(page, "TRK-4")).toBeVisible();
  await expect(page.getByTestId("sprint-points")).toContainText("11");

  const bad = await patchIssue(request, "TRK-4", { points: 4 });
  expect(bad.status()).toBe(400);
  expect((await patchIssue(request, "TRK-4", { points: 5 })).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId("sprint-issue")).toHaveCount(2);
  await expect(page.getByTestId("sprint-points")).toContainText("8");
});

test("S25 start a sprint", async ({ page, request }) => {
  await api(request, "alice");
  await createSprint(request, "Sprint A", "2026-11-02", "2026-11-13");
  const b = await createSprint(request, "Sprint B", "2026-11-16", "2026-11-27");

  await login(page, "alice");
  await page.goto("/projects/TRK/sprints");
  const cardA = page.getByTestId("sprint-card").filter({ hasText: "Sprint A" });
  const cardB = page.getByTestId("sprint-card").filter({ hasText: "Sprint B" });
  await expect(cardA.getByTestId("sprint-state")).toHaveText("Planned");
  await cardA.getByTestId("sprint-start-btn").click();
  await expect(cardA.getByTestId("sprint-state")).toHaveText("Active");

  await cardB.getByTestId("sprint-start-btn").click();
  await expect(page.getByTestId("sprint-error")).toBeVisible();
  await page.reload();
  await expect(cardB.getByTestId("sprint-state")).toHaveText("Planned");
  await expect(cardA.getByTestId("sprint-state")).toHaveText("Active");

  const r = await request.post(`/api/sprints/${b}/start`);
  expect(r.status()).toBe(409);
});

test("S26 complete a sprint", async ({ page, request }) => {
  await api(request, "alice");
  const id = await createSprint(request, "Sprint 1", "2026-11-02", "2026-11-13");
  // points: TRK-7 5, TRK-12 2, TRK-1 3, TRK-2 2, TRK-8 3 → 15
  for (const key of ["TRK-7", "TRK-12", "TRK-1", "TRK-2", "TRK-8"]) await addToSprint(request, id, key);
  expect((await request.post(`/api/sprints/${id}/start`)).status()).toBe(200);
  await moveTo(request, "TRK-7", "done");
  await moveTo(request, "TRK-12", "done");
  await moveTo(request, "TRK-1", "in_progress", "in_review", "done");

  await login(page, "alice");
  await page.goto("/projects/TRK/sprints");
  const sprint = page.getByTestId("sprint-card").filter({ hasText: "Sprint 1" });
  await sprint.getByTestId("sprint-complete").click();
  await expect(sprint.getByTestId("sprint-summary")).toHaveText("Completed 3 of 5 issues (10 of 15 points)");
  await expect(sprint.getByTestId("sprint-state")).toHaveText("Completed");
  await expect(backlogRow(page, "TRK-2")).toBeVisible();
  await expect(backlogRow(page, "TRK-8")).toBeVisible();
  await expect(backlogRow(page, "TRK-7")).toHaveCount(0);

  // a new sprint can start now
  const next = await createSprint(request, "Sprint 2", "2026-11-16", "2026-11-27");
  expect((await request.post(`/api/sprints/${next}/start`)).status()).toBe(200);
});

test("S27 burndown", async ({ page, request }) => {
  await api(request, "alice");
  const id = await createSprint(request, "Sprint 1", "2026-11-02", "2026-11-06");
  for (const key of ["TRK-7", "TRK-12", "TRK-2"]) await addToSprint(request, id, key); // 5 + 2 + 2 = 9
  expect((await request.post(`/api/sprints/${id}/start`)).status()).toBe(200);
  await moveTo(request, "TRK-7", "done"); // Nov 2
  await setNow(request, "2026-11-04T10:00:00.000Z");
  await moveTo(request, "TRK-12", "done"); // Nov 4

  await login(page, "alice");
  await page.goto(`/projects/TRK/sprints/${id}/burndown`);
  const points = page.getByTestId("burndown-point");
  await expect(points).toHaveCount(5);
  const data = await points.evaluateAll((els) =>
    els.map((e) => [e.getAttribute("data-date"), e.getAttribute("data-remaining")]),
  );
  expect(data).toEqual([
    ["2026-11-02", "4"],
    ["2026-11-03", "4"],
    ["2026-11-04", "2"],
    ["2026-11-05", "2"],
    ["2026-11-06", "2"],
  ]);
});

test("S28 export CSV", async ({ request }) => {
  await api(request, "alice");
  expect((await patchIssue(request, "TRK-1", { title: 'Fix "quoted", comma title' })).status()).toBe(200);
  const r = await request.get("/projects/TRK/export.csv");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/csv");
  const lines = (await r.text()).split("\r\n").filter((l) => l !== "");
  expect(lines[0]).toBe("Key,Title,Type,Status,Priority,Assignee,Points,Created");
  expect(lines).toHaveLength(13);
  expect(lines[1]).toBe('TRK-1,"Fix ""quoted"", comma title",Task,To Do,High,Bob Smith,3,2026-10-05');
  expect(lines).toContain("TRK-11,Write the onboarding guide,Task,To Do,Lowest,,,2026-10-21");
  expect(lines).toContain("TRK-3,Add password reset to the login flow,Story,In Progress,High,Bob Smith,5,2026-10-07");
});
