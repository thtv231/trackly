import { beforeAll, describe, expect, it } from "vitest";
import type { User } from "./auth";
import { query } from "./db";
import { createIssue, parseIssueKey, validateNewIssue } from "./issues";

const base = { projectKey: "TRK", title: "New issue", type: "task", priority: "medium" };
const error = (body: unknown) => {
  const r = validateNewIssue(body);
  return "error" in r ? r.error : null;
};
const nextNumber = async (key: string) =>
  (await query<{ n: number }>("SELECT next_number AS n FROM projects WHERE key = $1", [key]))[0].n;

let alice: User;
beforeAll(async () => {
  [alice] = await query<User>("SELECT id, email, handle, name, role FROM users WHERE email = 'alice@trackly.test'");
});

describe("validateNewIssue", () => {
  it("trims the title and requires 1–120 characters", () => {
    expect(error({ ...base, title: "" })).toContain("Title");
    expect(error({ ...base, title: "   " })).toContain("Title");
    expect(error({ ...base, title: undefined })).toContain("Title");
    expect(error({ ...base, title: "x".repeat(121) })).toContain("Title");
    expect(error({ ...base, title: "x".repeat(120) })).toBeNull();
    const r = validateNewIssue({ ...base, title: "  Spaced  " });
    expect("value" in r && r.value.title).toBe("Spaced");
  });

  it("rejects unknown types, priorities and points", () => {
    expect(error({ ...base, type: "epic" })).toContain("Type");
    expect(error({ ...base, priority: "urgent" })).toContain("Priority");
    expect(error({ ...base, points: 4 })).toContain("Points");
    expect(error({ ...base, points: 13 })).toBeNull();
    expect(error({ ...base, points: null })).toBeNull();
  });

  it("limits the description to 10,000 characters", () => {
    expect(error({ ...base, description: "x".repeat(10_001) })).toContain("Description");
    expect(error({ ...base, description: "x".repeat(10_000) })).toBeNull();
  });

  it("reports the first problem only", () => {
    expect(error({ ...base, title: "", type: "epic" })).toContain("Title");
  });
});

describe("createIssue", () => {
  it("counts keys per project", async () => {
    const ops = await nextNumber("OPS");
    const trk = await nextNumber("TRK");
    expect(await createIssue({ ...base, projectKey: "OPS" }, alice)).toEqual({ status: 201, key: `OPS-${ops}` });
    expect(await createIssue(base, alice)).toEqual({ status: 201, key: `TRK-${trk}` });
    expect(await createIssue({ ...base, projectKey: "OPS" }, alice)).toEqual({ status: 201, key: `OPS-${ops + 1}` });
  });

  it("saves the fields, the reporter and status todo", async () => {
    const r = await createIssue(
      { ...base, title: " Saved ", type: "bug", priority: "high", assignee: "carol@trackly.test", points: 5 },
      alice,
    );
    if (r.status !== 201) throw new Error(r.error);
    const { projectKey, number } = parseIssueKey(r.key)!;
    const [row] = await query<Record<string, unknown>>(
      `SELECT i.title, i.type, i.priority, i.status, i.points, a.email AS assignee, i.reporter_id
         FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users a ON a.id = i.assignee_id
        WHERE p.key = $1 AND i.number = $2`,
      [projectKey, number],
    );
    expect(row).toEqual({
      title: "Saved",
      type: "bug",
      priority: "high",
      status: "todo",
      points: 5,
      assignee: "carol@trackly.test",
      reporter_id: alice.id,
    });
  });

  it("rejects unknown projects and assignees without using up a number", async () => {
    const before = await nextNumber("TRK");
    expect(await createIssue({ ...base, projectKey: "NOPE" }, alice)).toMatchObject({ status: 404 });
    expect(await createIssue({ ...base, assignee: "dave@trackly.test" }, alice)).toMatchObject({ status: 400 });
    expect(await createIssue({ ...base, assignee: "nobody@trackly.test" }, alice)).toMatchObject({ status: 400 });
    expect(await createIssue({ ...base, title: "" }, alice)).toMatchObject({ status: 400 });
    expect(await nextNumber("TRK")).toBe(before);
  });
});

describe("parseIssueKey", () => {
  it("splits valid keys only", () => {
    expect(parseIssueKey("TRK-12")).toEqual({ projectKey: "TRK", number: 12 });
    expect(parseIssueKey("trk-12")).toBeNull();
    expect(parseIssueKey("TRK-")).toBeNull();
  });
});
