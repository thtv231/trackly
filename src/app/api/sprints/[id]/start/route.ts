import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { transaction } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/sprints/[id]/start → 200. Makes a planned sprint active; 409 if another sprint of
// the project is already active.
export async function POST(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't start sprints" }, { status: 403 });
  const { id } = await params;
  const sprintId = /^\d+$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(sprintId)) return Response.json({ error: "Sprint not found" }, { status: 404 });
  const at = await now();

  const result = await transaction(async (q) => {
    const [sprint] = await q<{ project_id: number; state: string }>(
      "SELECT project_id, state FROM sprints WHERE id = $1",
      [sprintId],
    );
    if (!sprint) return { status: 404, error: "Sprint not found" };
    // Lock the project so two concurrent starts can't both find no active sprint.
    await q("SELECT id FROM projects WHERE id = $1 FOR UPDATE", [sprint.project_id]);
    const [current] = await q<{ state: string }>("SELECT state FROM sprints WHERE id = $1", [sprintId]);
    if (current.state === "active") return { status: 200 };
    if (current.state === "completed") return { status: 409, error: "The sprint is already completed" };
    const [active] = await q<{ name: string }>(
      "SELECT name FROM sprints WHERE project_id = $1 AND state = 'active' LIMIT 1",
      [sprint.project_id],
    );
    if (active) return { status: 409, error: `Another sprint is already active (${active.name})` };
    await q("UPDATE sprints SET state = 'active', started_at = $2 WHERE id = $1", [sprintId, at]);
    return { status: 200 };
  });

  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: sprintId, state: "active" });
}
