import { apiUser } from "@/lib/auth";
import { assistantContext, ndjsonResponse, resumeLoop, takePending } from "@/lib/assistant/loop";

// POST /api/assistant/confirm { projectKey, pendingId, approve } → the rest of the reply as an NDJSON stream,
// after the user confirmed (approve: true) or cancelled a proposed write (S38). Each pendingId works once.
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => undefined)) as
    | { projectKey?: unknown; pendingId?: unknown; approve?: unknown }
    | undefined;
  if (typeof body?.projectKey !== "string" || typeof body.pendingId !== "string" || typeof body.approve !== "boolean") {
    return Response.json({ error: "projectKey, pendingId and approve are required" }, { status: 400 });
  }

  const ctx = await assistantContext(user, body.projectKey);
  if (ctx instanceof Response) return ctx;
  const state = await takePending(ctx, body.pendingId);
  if (!state) return Response.json({ error: "Nothing is waiting for confirmation" }, { status: 404 });
  const approve = body.approve;
  return ndjsonResponse((emit) => resumeLoop(ctx, state, approve, emit));
}
