import { apiUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseIssueKey, updateIssue } from "@/lib/issues";

type Ctx = { params: Promise<{ key: string }> };
type Row = {
  title: string;
  type: string;
  status: string;
  priority: string;
  assignee: string | null;
  points: number | null;
  labels: string[];
  resolved_at: Date | null;
  due_date: string | null;
};

// GET /api/issues/[key] → 200 { key, title, type, status, priority, assignee, points, labels, resolvedAt, dueDate }.
export async function GET(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { key } = await params;
  const parsed = parseIssueKey(key);
  const notFound = Response.json({ error: "Issue not found" }, { status: 404 });
  if (!parsed) return notFound;

  const [issue] = await query<Row>(
    `SELECT i.title, i.type, i.status, i.priority, a.email AS assignee, i.points,
            COALESCE((SELECT array_agg(l.name ORDER BY l.name)
                        FROM issue_labels il JOIN labels l ON l.id = il.label_id
                       WHERE il.issue_id = i.id), '{}') AS labels,
            i.resolved_at, to_char(i.due_date, 'YYYY-MM-DD') AS due_date
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       LEFT JOIN users a ON a.id = i.assignee_id
      WHERE p.key = $1 AND i.number = $2`,
    [parsed.projectKey, parsed.number],
  );
  if (!issue) return notFound;
  return Response.json({
    key: `${parsed.projectKey}-${parsed.number}`,
    title: issue.title,
    type: issue.type,
    status: issue.status,
    priority: issue.priority,
    assignee: issue.assignee,
    points: issue.points,
    labels: issue.labels,
    resolvedAt: issue.resolved_at ? new Date(issue.resolved_at).toISOString() : null,
    dueDate: issue.due_date,
  });
}

// PATCH /api/issues/[key] with any of title, type, priority, assignee, points, description, dueDate → 200.
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't edit issues" }, { status: 403 });
  const { key } = await params;
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });

  const result = await updateIssue(key, body);
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ key });
}

// DELETE /api/issues/[key] (admin only) → 200. The project's next_number is untouched, so the key is never reused.
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role !== "admin") return Response.json({ error: "Only admins can delete issues" }, { status: 403 });
  const { key } = await params;
  const parsed = parseIssueKey(key);
  if (!parsed) return Response.json({ error: "Issue not found" }, { status: 404 });

  const deleted = await query(
    `DELETE FROM issues WHERE number = $2 AND project_id = (SELECT id FROM projects WHERE key = $1) RETURNING id`,
    [parsed.projectKey, parsed.number],
  );
  if (deleted.length === 0) return Response.json({ error: "Issue not found" }, { status: 404 });
  return Response.json({ key });
}
