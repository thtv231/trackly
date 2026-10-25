import { expect, test } from "@playwright/test";
import { api, card, cardKeys, column, getIssue, login, moveTo, NOW, patchIssue, reset, setNow, transition } from "./helpers";

// Group B: board and workflow (S09–S15)
test.beforeEach(async ({ request }) => reset(request));

/** Values of the non-empty options of a card's move select. */
async function moveOptions(page: import("@playwright/test").Page, key: string) {
  const values = await card(page, key)
    .getByTestId("card-move")
    .locator("option")
    .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v));
  return values.sort();
}

test("S09 Kanban board", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/board");
  const cols = page.getByTestId("board-column");
  await expect(cols).toHaveCount(4);
  const statuses = await cols.evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
  expect(statuses).toEqual(["todo", "in_progress", "in_review", "done"]);
  await expect(page.getByTestId("board-card")).toHaveCount(12);
  await expect(column(page, "in_progress").locator('[data-testid="board-card"][data-key="TRK-3"]')).toBeVisible();
  await expect(column(page, "done").locator('[data-testid="board-card"][data-key="TRK-5"]')).toBeVisible();
  await expect(column(page, "todo").locator('[data-testid="board-card"][data-key="TRK-1"]')).toBeVisible();
  await expect(card(page, "TRK-3")).toContainText("Add password reset to the login flow");
  // only this project's issues
  await expect(page.locator('[data-testid="board-card"][data-key^="OPS-"]')).toHaveCount(0);
});

test("S10 column counts", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/board");
  const counts = { todo: "6", in_progress: "2", in_review: "2", done: "2" };
  for (const [s, n] of Object.entries(counts)) {
    await expect(column(page, s).getByTestId("column-count")).toHaveText(n);
  }
  await api(request, "alice");
  await moveTo(request, "TRK-1", "in_progress");
  await page.reload();
  await expect(column(page, "todo").getByTestId("column-count")).toHaveText("5");
  await expect(column(page, "in_progress").getByTestId("column-count")).toHaveText("3");
});

test("S11 move a card", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/board");
  expect(await moveOptions(page, "TRK-1")).toEqual(["in_progress"]);
  expect(await moveOptions(page, "TRK-3")).toEqual(["in_review", "todo"]);
  expect(await moveOptions(page, "TRK-7")).toEqual(["done", "in_progress"]);
  expect(await moveOptions(page, "TRK-5")).toEqual(["in_progress"]);

  await card(page, "TRK-1").getByTestId("card-move").selectOption("in_progress");
  await expect(column(page, "in_progress").locator('[data-testid="board-card"][data-key="TRK-1"]')).toBeVisible();
  await page.reload();
  await expect(column(page, "in_progress").locator('[data-testid="board-card"][data-key="TRK-1"]')).toBeVisible();
  await expect(column(page, "todo").locator('[data-testid="board-card"][data-key="TRK-1"]')).toHaveCount(0);
  await api(request, "alice");
  expect((await getIssue(request, "TRK-1")).status).toBe("in_progress");
});

test("S12 enforce the workflow", async ({ request }) => {
  await api(request, "alice");
  const r = await transition(request, "TRK-1", "done");
  expect(r.status()).toBe(409);
  expect(await r.json()).toEqual({ error: "Transition not allowed" });
  expect((await getIssue(request, "TRK-1")).status).toBe("todo");

  for (const [key, to] of [
    ["TRK-1", "in_review"],
    ["TRK-5", "todo"],
    ["TRK-5", "in_review"],
    ["TRK-7", "todo"],
    ["TRK-3", "done"],
  ]) {
    const res = await transition(request, key, to);
    expect(res.status(), `${key} → ${to}`).toBe(409);
  }
  expect((await getIssue(request, "TRK-5")).status).toBe("done");
  // allowed ones still work
  await moveTo(request, "TRK-7", "done", "in_progress");
  // status cannot be changed through PATCH
  await patchIssue(request, "TRK-1", { status: "done" });
  expect((await getIssue(request, "TRK-1")).status).toBe("todo");
});

test("S13 WIP limit", async ({ page, request }) => {
  await api(request, "alice");
  await moveTo(request, "TRK-1", "in_progress"); // 3rd In Progress: allowed
  const r = await transition(request, "TRK-4", "in_progress");
  expect(r.status()).toBe(409);
  expect(await r.json()).toEqual({ error: "WIP limit reached" });
  expect((await getIssue(request, "TRK-4")).status).toBe("todo");
  // the limit is per project
  await moveTo(request, "OPS-1", "in_progress");

  await login(page, "alice");
  await page.goto("/projects/TRK/board");
  await card(page, "TRK-2").getByTestId("card-move").selectOption("in_progress");
  await expect(page.getByTestId("wip-error")).toContainText("WIP limit");
  await expect(column(page, "todo").locator('[data-testid="board-card"][data-key="TRK-2"]')).toBeVisible();
  await page.reload();
  await expect(column(page, "todo").locator('[data-testid="board-card"][data-key="TRK-2"]')).toBeVisible();
  await expect(column(page, "in_progress").getByTestId("board-card")).toHaveCount(3);

  // freeing a slot allows the move again
  await moveTo(request, "TRK-3", "in_review");
  await moveTo(request, "TRK-4", "in_progress");
});

test("S14 resolution date", async ({ page, request }) => {
  await api(request, "alice");
  expect((await getIssue(request, "TRK-7")).resolvedAt).toBeNull();
  await moveTo(request, "TRK-7", "done");
  const done = await getIssue(request, "TRK-7");
  expect(new Date(done.resolvedAt).toISOString()).toBe(NOW);

  await login(page, "alice");
  await page.goto("/issues/TRK-7");
  await expect(page.getByTestId("issue-resolved")).toContainText("Nov 2, 2026");

  await setNow(request, "2026-11-05T14:30:00.000Z");
  await moveTo(request, "TRK-7", "in_progress"); // reopen
  expect((await getIssue(request, "TRK-7")).resolvedAt).toBeNull();
  await page.reload();
  await expect(page.getByTestId("issue-status")).toHaveText("In Progress");
  await expect(page.getByTestId("issue-resolved")).toHaveCount(0);

  await moveTo(request, "TRK-7", "in_review", "done");
  expect(new Date((await getIssue(request, "TRK-7")).resolvedAt).toISOString()).toBe("2026-11-05T14:30:00.000Z");
});

test("S15 card order", async ({ page, request }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK/board");
  await expect(column(page, "todo").getByTestId("board-card")).toHaveCount(6);
  expect(await cardKeys(column(page, "todo"))).toEqual(["TRK-2", "TRK-1", "TRK-10", "TRK-4", "TRK-8", "TRK-11"]);
  expect(await cardKeys(column(page, "in_review"))).toEqual(["TRK-7", "TRK-12"]);

  await api(request, "alice");
  expect((await patchIssue(request, "TRK-11", { priority: "highest" })).status()).toBe(200);
  await page.reload();
  await expect(column(page, "todo").getByTestId("board-card")).toHaveCount(6);
  expect(await cardKeys(column(page, "todo"))).toEqual(["TRK-2", "TRK-11", "TRK-1", "TRK-10", "TRK-4", "TRK-8"]);
});
