import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { transaction } from "@/lib/db";
import { parseIssueKey } from "@/lib/issues";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/sprints/[id]/issues { key } → 200. Adds a backlog issue (same project, not Done,
// not already in a planned or active sprint) to a planned or active sprint.
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't plan sprints" }, { status: 403 });
  const { id } = await params;
  const sprintId = /^\d+$/.test(id) ? Number(id) : NaN;
  const json = await req.json().catch(() => undefined);
  if (json === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  const key = (json as { key?: unknown } | null)?.key;
  const parsed = typeof key === "string" ? parseIssueKey(key) : null;
  if (!parsed) return Response.json({ error: "A valid issue key is required" }, { status: 400 });
  if (!Number.isSafeInteger(sprintId)) return Response.json({ error: "Sprint not found" }, { status: 404 });
  const at = await now();

  const result = await transaction(async (q) => {
    const [sprint] = await q<{ project_id: number; state: string }>(
      "SELECT project_id, state FROM sprints WHERE id = $1 FOR UPDATE",
      [sprintId],
    );
    if (!sprint) return { status: 404, error: "Sprint not found" };
    if (sprint.state === "completed") return { status: 409, error: "The sprint is already completed" };

    const [issue] = await q<{ id: number; status: string; open_sprint: number | null }>(
      `SELECT i.id, i.status,
              (SELECT si.sprint_id FROM sprint_issues si JOIN sprints s ON s.id = si.sprint_id
                WHERE si.issue_id = i.id AND s.state IN ('planned', 'active') LIMIT 1) AS open_sprint
         FROM issues i JOIN projects p ON p.id = i.project_id
        WHERE p.key = $1 AND i.number = $2 AND i.project_id = $3`,
      [parsed.projectKey, parsed.number, sprint.project_id],
    );
    if (!issue) return { status: 404, error: "Issue not found in this sprint's project" };
    if (issue.open_sprint === sprintId) return { status: 200 };
    if (issue.open_sprint !== null) return { status: 409, error: "The issue is already in another sprint" };
    if (issue.status === "done") return { status: 409, error: "Done issues can't be planned" };

    await q("INSERT INTO sprint_issues (sprint_id, issue_id, added_at) VALUES ($1, $2, $3)", [sprintId, issue.id, at]);
    return { status: 200 };
  });

  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ key });
}
