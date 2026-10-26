import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { transaction } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type Totals = {
  completed_issues: number;
  total_issues: number;
  completed_points: number;
  total_points: number;
};

// POST /api/sprints/[id]/complete → 200 with the summary totals. Ends an active sprint and
// freezes its done/total counts; unfinished issues fall back into the backlog because the
// backlog only excludes issues in planned or active sprints.
export async function POST(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't complete sprints" }, { status: 403 });
  const { id } = await params;
  const sprintId = /^\d+$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(sprintId)) return Response.json({ error: "Sprint not found" }, { status: 404 });
  const at = await now();

  const result = await transaction(async (q) => {
    const [sprint] = await q<{ state: string }>("SELECT state FROM sprints WHERE id = $1 FOR UPDATE", [
      sprintId,
    ]);
    if (!sprint) return { status: 404, error: "Sprint not found" };
    if (sprint.state === "planned") return { status: 409, error: "The sprint hasn't started yet" };
    if (sprint.state === "completed") return { status: 409, error: "The sprint is already completed" };
    const [totals] = await q<Totals>(
      `SELECT count(*) FILTER (WHERE i.status = 'done')::int AS completed_issues,
              count(*)::int AS total_issues,
              coalesce(sum(i.points) FILTER (WHERE i.status = 'done'), 0)::int AS completed_points,
              coalesce(sum(i.points), 0)::int AS total_points
         FROM sprint_issues si JOIN issues i ON i.id = si.issue_id
        WHERE si.sprint_id = $1`,
      [sprintId],
    );
    await q(
      `UPDATE sprints SET state = 'completed', completed_at = $2, completed_issues = $3,
              total_issues = $4, completed_points = $5, total_points = $6
        WHERE id = $1`,
      [sprintId, at, totals.completed_issues, totals.total_issues, totals.completed_points, totals.total_points],
    );
    return { status: 200, totals };
  });

  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: sprintId, state: "completed", ...result.totals });
}
