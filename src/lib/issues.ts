import type { User } from "./auth";
import { now } from "./clock";
import { query, transaction } from "./db";
import { POINTS, PRIORITIES, TYPES, type IssueType, type Priority } from "./domain";

// Creating issues (S04, S05). Shared by POST /api/issues and the unit tests; the checks follow SPEC.md.

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 10_000;

export type NewIssue = {
  projectKey: string;
  title: string;
  type: IssueType;
  priority: Priority;
  assignee: string | null; // email
  description: string;
  points: number | null;
};

/** Checks that need no database, in SPEC.md order. The first problem wins. */
export function validateNewIssue(body: unknown): { value: NewIssue } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "Title is required" };
  if (title.length > TITLE_MAX) return { error: `Title must be ${TITLE_MAX} characters or fewer` };
  if (!TYPES.includes(b.type as IssueType)) return { error: `Type must be one of ${TYPES.join(", ")}` };
  if (!PRIORITIES.includes(b.priority as Priority)) {
    return { error: `Priority must be one of ${PRIORITIES.join(", ")}` };
  }
  const points = b.points ?? null;
  if (points !== null && !POINTS.includes(points as (typeof POINTS)[number])) {
    return { error: `Points must be one of ${POINTS.join(", ")}` };
  }
  if (b.description != null && typeof b.description !== "string") return { error: "Description must be text" };
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length > DESCRIPTION_MAX) return { error: "Description must be 10,000 characters or fewer" };
  if (typeof b.projectKey !== "string" || !b.projectKey) return { error: "Project is required" };
  if (b.assignee != null && typeof b.assignee !== "string") return { error: "Assignee must be an email" };
  return {
    value: {
      projectKey: b.projectKey,
      title,
      type: b.type as IssueType,
      priority: b.priority as Priority,
      assignee: typeof b.assignee === "string" && b.assignee.trim() ? b.assignee.trim() : null,
      description,
      points: points as number | null,
    },
  };
}

export type CreateResult = { status: 201; key: string } | { status: 400 | 404; error: string };

/** Validate and insert a new issue. A rejected create never uses up an issue number. */
export async function createIssue(body: unknown, reporter: User): Promise<CreateResult> {
  const checked = validateNewIssue(body);
  if ("error" in checked) return { status: 400, error: checked.error };
  const input = checked.value;

  const [project] = await query<{ id: number; key: string }>("SELECT id, key FROM projects WHERE key = $1", [
    input.projectKey,
  ]);
  if (!project) return { status: 404, error: "Project not found" };

  let assigneeId: number | null = null;
  if (input.assignee) {
    const [u] = await query<{ id: number }>(
      "SELECT id FROM users WHERE email = lower($1) AND role IN ('admin', 'member')",
      [input.assignee],
    );
    if (!u) return { status: 400, error: "Assignee must be an admin or member" };
    assigneeId = u.id;
  }

  const at = await now();
  const number = await transaction(async (q) => {
    // One statement reads and bumps the counter, so numbers are never handed out twice.
    const [{ number }] = await q<{ number: number }>(
      "UPDATE projects SET next_number = next_number + 1 WHERE id = $1 RETURNING next_number - 1 AS number",
      [project.id],
    );
    await q(
      `INSERT INTO issues (project_id, number, title, description, type, priority, assignee_id, reporter_id, points,
                           created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [project.id, number, input.title, input.description, input.type, input.priority, assigneeId, reporter.id,
        input.points, at],
    );
    return number;
  });
  return { status: 201, key: `${project.key}-${number}` };
}

/** 'TRK-12' → { projectKey: 'TRK', number: 12 }, or null if it is not a key. */
export function parseIssueKey(key: string): { projectKey: string; number: number } | null {
  const match = /^([A-Z][A-Z0-9]{1,9})-(\d+)$/.exec(key);
  return match ? { projectKey: match[1], number: Number(match[2]) } : null;
}

// Editing issues (S07). PATCH /api/issues/[key] may send any subset of these fields. `status` changes go
// through /transition, so it is ignored here like any unknown field.

export type IssuePatch = Partial<Omit<NewIssue, "projectKey"> & { dueDate: string | null }>;

/** Checks that need no database, for the fields present in the body. The first problem wins. */
export function validateIssuePatch(body: unknown): { value: IssuePatch } | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const value: IssuePatch = {};
  if ("title" in b) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) return { error: "Title is required" };
    if (title.length > TITLE_MAX) return { error: `Title must be ${TITLE_MAX} characters or fewer` };
    value.title = title;
  }
  if ("type" in b) {
    if (!TYPES.includes(b.type as IssueType)) return { error: `Type must be one of ${TYPES.join(", ")}` };
    value.type = b.type as IssueType;
  }
  if ("priority" in b) {
    if (!PRIORITIES.includes(b.priority as Priority)) {
      return { error: `Priority must be one of ${PRIORITIES.join(", ")}` };
    }
    value.priority = b.priority as Priority;
  }
  if ("points" in b) {
    const points = b.points ?? null;
    if (points !== null && !POINTS.includes(points as (typeof POINTS)[number])) {
      return { error: `Points must be one of ${POINTS.join(", ")}` };
    }
    value.points = points as number | null;
  }
  if ("description" in b) {
    if (b.description != null && typeof b.description !== "string") return { error: "Description must be text" };
    const description = typeof b.description === "string" ? b.description.trim() : "";
    if (description.length > DESCRIPTION_MAX) return { error: "Description must be 10,000 characters or fewer" };
    value.description = description;
  }
  if ("assignee" in b) {
    if (b.assignee != null && typeof b.assignee !== "string") return { error: "Assignee must be an email" };
    value.assignee = typeof b.assignee === "string" && b.assignee.trim() ? b.assignee.trim() : null;
  }
  if ("dueDate" in b) {
    const due = b.dueDate ?? null;
    if (due !== null && (typeof due !== "string" || !isIsoDate(due))) return { error: "Due date must be YYYY-MM-DD" };
    value.dueDate = due as string | null;
  }
  return { value };
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export type UpdateResult = { status: 200 } | { status: 400 | 404; error: string };

/** Validate and apply a partial update. Only the fields present in the body change. */
export async function updateIssue(key: string, body: unknown): Promise<UpdateResult> {
  const parsed = parseIssueKey(key);
  if (!parsed) return { status: 404, error: "Issue not found" };
  const checked = validateIssuePatch(body);
  if ("error" in checked) return { status: 400, error: checked.error };
  const input = checked.value;

  const [issue] = await query<{ id: number }>(
    "SELECT i.id FROM issues i JOIN projects p ON p.id = i.project_id WHERE p.key = $1 AND i.number = $2",
    [parsed.projectKey, parsed.number],
  );
  if (!issue) return { status: 404, error: "Issue not found" };

  const columns: Record<string, unknown> = {};
  if (input.title !== undefined) columns.title = input.title;
  if (input.type !== undefined) columns.type = input.type;
  if (input.priority !== undefined) columns.priority = input.priority;
  if (input.points !== undefined) columns.points = input.points;
  if (input.description !== undefined) columns.description = input.description;
  if (input.dueDate !== undefined) columns.due_date = input.dueDate;
  if (input.assignee !== undefined) {
    columns.assignee_id = null;
    if (input.assignee) {
      const [u] = await query<{ id: number }>(
        "SELECT id FROM users WHERE email = lower($1) AND role IN ('admin', 'member')",
        [input.assignee],
      );
      if (!u) return { status: 400, error: "Assignee must be an admin or member" };
      columns.assignee_id = u.id;
    }
  }
  if (Object.keys(columns).length === 0) return { status: 200 };

  // Column names come from the fixed list above, never from the request.
  columns.updated_at = await now();
  const names = Object.keys(columns);
  const sets = names.map((name, i) => `${name} = $${i + 2}`).join(", ");
  await query(`UPDATE issues SET ${sets} WHERE id = $1`, [issue.id, ...names.map((n) => columns[n])]);
  return { status: 200 };
}
