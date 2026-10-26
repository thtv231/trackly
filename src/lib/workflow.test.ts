import { beforeEach, describe, expect, it } from "vitest";
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
const setWipLimit = (projectKey: string, limit: number) =>
  query("UPDATE projects SET wip_limit = $2 WHERE key = $1", [projectKey, limit]);

beforeEach(async () => {
  await setWipLimit("TRK", 3);
  await setWipLimit("OPS", 3);
});

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

  it("refuses every other move with 409 and leaves the status alone", async () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (isAllowed(from, to)) continue;
        await boardWith("TRK", []);
        await setStatus("TRK-1", from);
        expect(await transitionIssue("TRK-1", to), `${from} → ${to}`).toEqual({
          status: 409,
          error: "Transition not allowed",
        });
        expect(await statusOf("TRK-1")).toBe(from);
      }
    }
  });

  it("returns 400 for an unknown status and 404 for an unknown issue", async () => {
    expect(await transitionIssue("TRK-1", "blocked")).toMatchObject({ status: 400 });
    expect(await transitionIssue("TRK-1", undefined)).toMatchObject({ status: 400 });
    expect(await transitionIssue("TRK-999", "in_progress")).toMatchObject({ status: 404 });
    expect(await transitionIssue("nope", "in_progress")).toMatchObject({ status: 404 });
  });
});

describe("transitionIssue: WIP limit", () => {
  it("allows the 3rd In Progress issue and refuses the 4th", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2"]);
    expect(await transitionIssue("TRK-3", "in_progress")).toEqual({ status: 200 });
    expect(await transitionIssue("TRK-4", "in_progress")).toEqual({ status: 409, error: "WIP limit reached" });
    expect(await statusOf("TRK-4")).toBe("todo");
  });

  it("applies to reopening a Done issue too", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2", "TRK-3"]);
    await setStatus("TRK-4", "done");
    expect(await transitionIssue("TRK-4", "in_progress")).toEqual({ status: 409, error: "WIP limit reached" });
    expect(await statusOf("TRK-4")).toBe("done");
  });

  it("doesn't block moves to other columns when In Progress is full", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2", "TRK-3"]);
    await setStatus("TRK-4", "in_review");
    expect(await transitionIssue("TRK-4", "done")).toEqual({ status: 200 });
    expect(await transitionIssue("TRK-1", "in_review")).toEqual({ status: 200 });
  });

  it("frees a slot when an issue leaves In Progress", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2", "TRK-3"]);
    expect(await transitionIssue("TRK-1", "todo")).toEqual({ status: 200 });
    expect(await transitionIssue("TRK-4", "in_progress")).toEqual({ status: 200 });
  });

  it("counts per project", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2", "TRK-3"]);
    await boardWith("OPS", []);
    expect(await transitionIssue("OPS-1", "in_progress")).toEqual({ status: 200 });
  });

  it("uses the project's own wip_limit", async () => {
    await setWipLimit("TRK", 1);
    await boardWith("TRK", ["TRK-1"]);
    expect(await transitionIssue("TRK-2", "in_progress")).toEqual({ status: 409, error: "WIP limit reached" });
  });

  // PGlite runs one transaction at a time, so this checks the outcome but can't catch a missing
  // FOR UPDATE lock (removing it still passes). Only a real Postgres (DATABASE_URL) would.
  it("lets only one of two simultaneous moves take the last slot", async () => {
    await boardWith("TRK", ["TRK-1", "TRK-2"]);
    const results = await Promise.all([transitionIssue("TRK-3", "in_progress"), transitionIssue("TRK-4", "in_progress")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const [{ n }] = await query<{ n: number }>(
      "SELECT count(*)::int AS n FROM issues WHERE project_id = (SELECT id FROM projects WHERE key = 'TRK') AND status = 'in_progress'",
    );
    expect(n).toBe(3);
  });
});
