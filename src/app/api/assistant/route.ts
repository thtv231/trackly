import { apiUser } from "@/lib/auth";
import { assistantContext, ndjsonResponse, normalizeMessages, runLoop } from "@/lib/assistant/loop";

// POST /api/assistant { projectKey, messages } → the reply as an NDJSON stream of events (S36–S40).
// `messages` is the panel's conversation as text turns: [{ role: "user" | "assistant", content: string }].
export async function POST(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const body = (await req.json().catch(() => undefined)) as { projectKey?: unknown; messages?: unknown } | undefined;
  const messages = normalizeMessages(body?.messages);
  if (typeof body?.projectKey !== "string" || !messages) {
    return Response.json({ error: "projectKey and messages ending with a user turn are required" }, { status: 400 });
  }

  const ctx = await assistantContext(user, body.projectKey);
  if (ctx instanceof Response) return ctx;
  return ndjsonResponse((emit) => runLoop(ctx, messages, emit));
}
