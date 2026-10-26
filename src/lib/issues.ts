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
