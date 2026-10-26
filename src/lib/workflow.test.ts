import { describe, expect, it } from "vitest";
import { query } from "./db";
import { STATUSES, type Status } from "./domain";
import { canTransition, transitionIssue } from "./workflow";

// Tests in this file share one in-memory DB, so each test sets the statuses it relies on.

const ALLOWED: [Status, Status][] = [
  ["todo", "in_progress"],
  ["in_progress", "todo"],
  ["in_progress", "in_review"],
  ["in_review", "in_progress"],
  ["in_review", "done"],
  ["done", "in_progress"],
];
const isAllowed = (from: Status, to: Status) => ALLOWED.some(([f, t]) => f === from && t === to);

const issueWhere = "project_id = (SELECT id FROM projects WHERE key = $1) AND number = $2";
const split = (key: string) => {
  const [p, n] = key.split("-");
  return [p, Number(n)] as const;
};
const statusOf = async (key: string) =>
  (await query<{ status: Status }>(`SELECT status FROM issues WHERE ${issueWhere}`, split(key) as never))[0].status;
const setStatus = (key: string, status: Status) =>
  query(`UPDATE issues SET status = $3 WHERE ${issueWhere}`, [...split(key), status]);
/** Put every issue of a project in `others`, then the listed keys in In Progress. */
async function boardWith(projectKey: string, inProgress: string[], others: Status = "todo") {
  await query("UPDATE issues SET status = $2 WHERE project_id = (SELECT id FROM projects WHERE key = $1)", [
    projectKey,
    others,
  ]);
  for (const key of inProgress) await setStatus(key, "in_progress");
}

describe("canTransition", () => {
  it("allows exactly the six moves in STORIES.md", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(isAllowed(from, to));
      }
    }
  });
});

describe("transitionIssue: workflow rules", () => {
  it("makes every allowed move and saves it", async () => {
    for (const [from, to] of ALLOWED) {
      await boardWith("TRK", []);
      await setStatus("TRK-1", from);
      expect(await transitionIssue("TRK-1", to), `${from} → ${to}`).toEqual({ status: 200 });
      expect(await statusOf("TRK-1")).toBe(to);
    }
  });

  it("returns 400 for an unknown status and 404 for an unknown issue", async () => {
    expect(await transitionIssue("TRK-1", "blocked")).toMatchObject({ status: 400 });
    expect(await transitionIssue("TRK-1", undefined)).toMatchObject({ status: 400 });
    expect(await transitionIssue("TRK-999", "in_progress")).toMatchObject({ status: 404 });
    expect(await transitionIssue("nope", "in_progress")).toMatchObject({ status: 404 });
  });
});
