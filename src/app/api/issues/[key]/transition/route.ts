import { apiUser } from "@/lib/auth";
import { transitionIssue } from "@/lib/workflow";

type Ctx = { params: Promise<{ key: string }> };

// POST /api/issues/[key]/transition { to } → 200, or 409 { error: "Transition not allowed" }.
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't move issues" }, { status: 403 });
  const { key } = await params;
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });

  const result = await transitionIssue(key, (body as { to?: unknown } | null)?.to, user);
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ key, status: body.to });
}
