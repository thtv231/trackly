import { apiUser } from "@/lib/auth";
import { createIssue } from "@/lib/issues";

// POST /api/issues { projectKey, title, type, priority, assignee?, description?, points? } → 201 { key }.
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  if (user.role === "viewer") return Response.json({ error: "Viewers can't create issues" }, { status: 403 });
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return Response.json({ error: "Request body must be JSON" }, { status: 400 });

  const result = await createIssue(body, user);
  if (result.status !== 201) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ key: result.key }, { status: 201 });
}
