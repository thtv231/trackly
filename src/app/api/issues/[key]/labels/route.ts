import { apiUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { parseIssueKey } from "@/lib/issues";

type Ctx = { params: Promise<{ key: string }> };

const LABEL_MAX = 30;

// POST /api/issues/[key]/labels { name } → 200 { labels }. Names are lowercased; adding one twice is a no-op.
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't edit issues" }, { status: 403 });
  const { key } = await params;
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  const parsed = parseIssueKey(key);
  if (!parsed) return Response.json({ error: "Issue not found" }, { status: 404 });

  const raw = (body as { name?: unknown } | null)?.name;
  const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!name) return Response.json({ error: "Label is required" }, { status: 400 });
  if (name.length > LABEL_MAX) {
    return Response.json({ error: `Label must be ${LABEL_MAX} characters or fewer` }, { status: 400 });
  }

  const labels = await transaction(async (q) => {
    const [issue] = await q<{ id: number; project_id: number }>(
      `SELECT i.id, i.project_id FROM issues i JOIN projects p ON p.id = i.project_id
        WHERE p.key = $1 AND i.number = $2`,
      [parsed.projectKey, parsed.number],
    );
    if (!issue) return null;
    await q("INSERT INTO labels (project_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [issue.project_id, name]);
    await q(
      `INSERT INTO issue_labels (issue_id, label_id)
       SELECT $1, id FROM labels WHERE project_id = $2 AND name = $3
       ON CONFLICT DO NOTHING`,
      [issue.id, issue.project_id, name],
    );
    const rows = await q<{ name: string }>(
      `SELECT l.name FROM issue_labels il JOIN labels l ON l.id = il.label_id
        WHERE il.issue_id = $1 ORDER BY l.name`,
      [issue.id],
    );
    return rows.map((r) => r.name);
  });
  if (!labels) return Response.json({ error: "Issue not found" }, { status: 404 });
  return Response.json({ key, labels });
}
