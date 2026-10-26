import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { query } from "@/lib/db";

type Ctx = { params: Promise<{ key: string }> };

const NAME_MAX = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// POST /api/projects/[key]/sprints { name, start, end } → 201 { id }, 400 if `end` is not after `start`.
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't create sprints" }, { status: 403 });
  const { key } = await params;
  const json = await req.json().catch(() => undefined);
  if (json === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });

  const { name: rawName, start, end } = (json ?? {}) as { name?: unknown; start?: unknown; end?: unknown };
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return Response.json({ error: "Sprint name is required" }, { status: 400 });
  if (name.length > NAME_MAX) {
    return Response.json({ error: `Sprint name must be ${NAME_MAX} characters or fewer` }, { status: 400 });
  }
  if (!isDate(start) || !isDate(end)) {
    return Response.json({ error: "Start and end must be dates (YYYY-MM-DD)" }, { status: 400 });
  }
  // 'YYYY-MM-DD' strings compare in date order.
  if (end <= start) return Response.json({ error: "End date must be after the start date" }, { status: 400 });

  const [row] = await query<{ id: number }>(
    `INSERT INTO sprints (project_id, name, start_date, end_date, created_at)
     SELECT id, $2, $3, $4, $5 FROM projects WHERE key = $1
     RETURNING id`,
    [key, name, start, end, await now()],
  );
  if (!row) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json({ id: row.id }, { status: 201 });
}
