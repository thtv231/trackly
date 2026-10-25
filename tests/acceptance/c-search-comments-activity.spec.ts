import { expect, test } from "@playwright/test";
import { api, createIssue, login, moveTo, patchIssue, reset, row, rowKeys, setNow } from "./helpers";

// Group C: search, comments, activity (S16–S22)
test.beforeEach(async ({ request }) => reset(request));

test("S16 search", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-row")).toHaveCount(12);
  await page.getByTestId("issue-search").fill("trk-3");
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  expect(await rowKeys(page)).toEqual(["TRK-3"]);

  await page.getByTestId("issue-search").fill("login");
  await expect(page.getByTestId("issue-row")).toHaveCount(3);
  expect(await rowKeys(page)).toEqual(["TRK-2", "TRK-3", "TRK-12"]);

  await page.getByTestId("issue-search").fill("LOGIN");
  await expect(page.getByTestId("issue-row")).toHaveCount(3);

  await page.getByTestId("issue-search").fill("no such issue anywhere");
  await expect(page.getByTestId("issue-row")).toHaveCount(0);

  await page.getByTestId("issue-search").fill("");
  await expect(page.getByTestId("issue-row")).toHaveCount(12);
});

test("S17 filters in the URL", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-row")).toHaveCount(12);
  await page.getByTestId("filter-status").selectOption({ label: "To Do" });
  await expect(page.getByTestId("issue-row")).toHaveCount(6);
  await page.getByTestId("filter-priority").selectOption({ label: "High" });
  await expect(page).toHaveURL(/[?&]status=todo(&|$)/);
  await expect(page).toHaveURL(/[?&]priority=high(&|$)/);
  await expect(page.getByTestId("issue-row")).toHaveCount(2);
  expect(await rowKeys(page)).toEqual(["TRK-1", "TRK-10"]);

  await page.goto("/projects/TRK?status=todo&priority=high&type=bug");
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  expect(await rowKeys(page)).toEqual(["TRK-10"]);
  await expect(page.getByTestId("filter-status")).toHaveValue("todo");
  await expect(page.getByTestId("filter-priority")).toHaveValue("high");
  await expect(page.getByTestId("filter-type")).toHaveValue("bug");

  await page.goto("/projects/TRK?type=story");
  await expect(page.getByTestId("issue-row")).toHaveCount(6);
});

test("S18 labels", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/issues/TRK-11");
  await expect(page.getByTestId("label-chip")).toHaveCount(0);
  const input = page.getByTestId("label-input");
  await input.fill("Docs");
  await input.press("Enter");
  await expect(page.getByTestId("label-chip")).toHaveCount(1);
  await expect(page.getByTestId("label-chip")).toContainText("docs");
  await input.fill("docs");
  await input.press("Enter");
  await input.fill("Frontend");
  await input.press("Enter");
  await expect(page.getByTestId("label-chip")).toHaveCount(2);
  await expect(page.getByTestId("label-chip").filter({ hasText: "frontend" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("label-chip")).toHaveCount(2);
  await expect(page.getByTestId("label-chip").filter({ hasText: "docs" })).toHaveCount(1);

  await page.goto("/projects/TRK?label=frontend");
  await expect(page.getByTestId("issue-row")).toHaveCount(7);
  expect(await rowKeys(page)).toEqual(["TRK-2", "TRK-3", "TRK-4", "TRK-6", "TRK-8", "TRK-11", "TRK-12"]);
  await page.goto("/projects/TRK?label=docs");
  await expect(page.getByTestId("issue-row")).toHaveCount(1);
  expect(await rowKeys(page)).toEqual(["TRK-11"]);
});

test("S19 comments", async ({ page }) => {
  await login(page, "alice");
  await page.goto("/issues/TRK-4");
  await expect(page.getByTestId("comment")).toHaveCount(0);
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  await expect(page.getByTestId("comment")).toHaveCount(0);

  await page.getByTestId("comment-input").fill("First comment");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment")).toHaveCount(1);
  await page.getByTestId("comment-input").fill("Second comment");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment")).toHaveCount(2);

  await page.reload();
  const comments = page.getByTestId("comment");
  await expect(comments).toHaveCount(2);
  await expect(comments.nth(0)).toContainText("First comment");
  await expect(comments.nth(0)).toContainText("Alice Nguyen");
  await expect(comments.nth(1)).toContainText("Second comment");

  await login(page, "bob");
  await page.goto("/issues/TRK-4");
  await page.getByTestId("comment-input").fill("Third, from Bob");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment")).toHaveCount(3);
  await expect(page.getByTestId("comment").nth(2)).toContainText("Bob Smith");
});

test("S20 safe Markdown", async ({ page, request }) => {
  const evil =
    'Hello <script>window.__xss = 1</script> **bold** <img src=x onerror="window.__xss = 2"> [click](javascript:window.__xss=3)';
  await api(request, "alice");
  expect((await patchIssue(request, "TRK-4", { description: evil })).status()).toBe(200);

  await login(page, "alice");
  await page.goto("/issues/TRK-4");
  const desc = page.getByTestId("issue-description");
  await expect(desc.locator("strong")).toHaveText("bold");
  await expect(desc).toContainText("<script>");
  await expect(desc).toContainText("<img");
  await expect(desc.locator("script, img, iframe")).toHaveCount(0);
  await expect(desc.locator('a[href^="javascript"]')).toHaveCount(0);

  await page.getByTestId("comment-input").fill(evil);
  await page.getByTestId("comment-submit").click();
  const comment = page.getByTestId("comment").last();
  await expect(comment.locator("strong")).toHaveText("bold");
  await expect(comment).toContainText("<img");
  await expect(comment.locator("script, img, iframe")).toHaveCount(0);
  await expect(comment.locator('a[href^="javascript"]')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("issue-description").locator("strong")).toHaveText("bold");
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("S21 activity log", async ({ page, request }) => {
  await api(request, "alice");
  await moveTo(request, "TRK-1", "in_progress");
  await setNow(request, "2026-11-02T09:05:00.000Z");
  expect((await patchIssue(request, "TRK-1", { priority: "low" })).status()).toBe(200);
  await setNow(request, "2026-11-02T09:10:00.000Z");
  expect((await patchIssue(request, "TRK-1", { assignee: "carol@trackly.test" })).status()).toBe(200);
  // a title change is not logged
  expect((await patchIssue(request, "TRK-1", { title: "Set up the CI pipeline" })).status()).toBe(200);

  await login(page, "alice");
  await page.goto("/issues/TRK-1");
  const items = page.getByTestId("activity-item");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("Alice Nguyen changed assignee from Bob Smith to Carol Diaz");
  await expect(items.nth(1)).toContainText("Alice Nguyen changed priority from High to Low");
  await expect(items.nth(2)).toContainText("Alice Nguyen changed status from To Do to In Progress");
  await expect(items.nth(3)).toContainText("Alice Nguyen");
  await expect(items.nth(3)).toContainText("created");

  const key = await createIssue(request, { title: "Fresh issue" });
  await page.goto(`/issues/${key}`);
  await expect(page.getByTestId("activity-item")).toHaveCount(1);
  await expect(page.getByTestId("activity-item")).toContainText("created");
});

test("S22 pagination", async ({ page, request }) => {
  await api(request, "alice");
  for (let i = 1; i <= 28; i++) await createIssue(request, { title: `Bulk issue ${i}` });

  await login(page, "alice");
  await page.goto("/projects/TRK");
  await expect(page.getByTestId("issue-row")).toHaveCount(25);
  await expect(page.getByTestId("page-info")).toHaveText("1–25 of 40");
  const first = await rowKeys(page);
  expect(first[0]).toBe("TRK-1");
  expect(first[24]).toBe("TRK-25");

  await page.getByTestId("page-next").click();
  await expect(page.getByTestId("issue-row")).toHaveCount(15);
  await expect(page.getByTestId("page-info")).toHaveText("26–40 of 40");
  await expect(row(page, "TRK-26")).toHaveCount(1);
  await expect(row(page, "TRK-40")).toHaveCount(1);
  await expect(row(page, "TRK-1")).toHaveCount(0);
});
