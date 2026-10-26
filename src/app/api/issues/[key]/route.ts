import { apiUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseIssueKey } from "@/lib/issues";

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
