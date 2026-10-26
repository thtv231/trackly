import { query, type Query } from "./db";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from "./domain";

// The activity log (S21): one row per issue creation and per change of status, assignee or priority.
// Status and priority are stored as codes, the assignee as a user id (null = unassigned); names are looked up
// when the log is shown.

export type ActivityKind = "created" | "status" | "assignee" | "priority";

export async function logActivity(
  q: Query,
  issueId: number,
  actorId: number,
  kind: ActivityKind,
  at: Date,
  from: string | number | null = null,
  to: string | number | null = null,
): Promise<void> {
  await q(
    "INSERT INTO activity (issue_id, actor_id, kind, from_value, to_value, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [issueId, actorId, kind, from === null ? null : String(from), to === null ? null : String(to), at],
  );
}

export type ActivityItem = { id: number; actor: string; kind: ActivityKind; from: string; to: string; createdAt: Date };

/** The log of one issue, newest first, with values turned into the labels shown on the page. */
export async function issueActivity(projectKey: string, number: number): Promise<ActivityItem[]> {
  const rows = await query<{
    id: number;
    actor: string;
    kind: ActivityKind;
    from_value: string | null;
    to_value: string | null;
    from_user: string | null;
    to_user: string | null;
    created_at: Date;
  }>(
    `SELECT a.id, u.name AS actor, a.kind, a.from_value, a.to_value, fu.name AS from_user, tu.name AS to_user,
            a.created_at
       FROM activity a
       JOIN users u ON u.id = a.actor_id
       JOIN issues i ON i.id = a.issue_id
       JOIN projects p ON p.id = i.project_id
       LEFT JOIN users fu ON a.kind = 'assignee' AND fu.id::text = a.from_value
       LEFT JOIN users tu ON a.kind = 'assignee' AND tu.id::text = a.to_value
      WHERE p.key = $1 AND i.number = $2
      ORDER BY a.created_at DESC, a.id DESC`,
    [projectKey, number],
  );
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    kind: r.kind,
    from: label(r.kind, r.from_value, r.from_user),
    to: label(r.kind, r.to_value, r.to_user),
    createdAt: r.created_at,
  }));
}

function label(kind: ActivityKind, value: string | null, userName: string | null): string {
  if (kind === "status") return STATUS_LABEL[value as Status] ?? value ?? "";
  if (kind === "priority") return PRIORITY_LABEL[value as Priority] ?? value ?? "";
  if (kind === "assignee") return value === null ? "Unassigned" : (userName ?? "a removed user");
  return "";
}
