import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { query } from "@/lib/db";
import { parseIssueKey } from "@/lib/issues";

type Ctx = { params: Promise<{ key: string }> };

const COMMENT_MAX = 10_000;

export type Comment = { id: number; author: string; body: string; created_at: string };

// POST /api/issues/[key]/comments { body } → 201 { comment }, 400 if empty.
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't comment" }, { status: 403 });
  const { key } = await params;
  const json = await req.json().catch(() => undefined);
  if (json === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  const parsed = parseIssueKey(key);
  if (!parsed) return Response.json({ error: "Issue not found" }, { status: 404 });

  const raw = (json as { body?: unknown } | null)?.body;
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return Response.json({ error: "Comment can't be empty" }, { status: 400 });
  if (body.length > COMMENT_MAX) {
    return Response.json({ error: `Comment must be ${COMMENT_MAX} characters or fewer` }, { status: 400 });
  }

  const [row] = await query<{ id: number; created_at: Date }>(
    `INSERT INTO comments (issue_id, author_id, body, created_at)
     SELECT i.id, $3, $4, $5 FROM issues i JOIN projects p ON p.id = i.project_id
      WHERE p.key = $1 AND i.number = $2
     RETURNING id, created_at`,
    [parsed.projectKey, parsed.number, user.id, body, await now()],
  );
  if (!row) return Response.json({ error: "Issue not found" }, { status: 404 });
  const comment: Comment = { id: row.id, author: user.name, body, created_at: row.created_at.toISOString() };
  return Response.json({ comment }, { status: 201 });
}
