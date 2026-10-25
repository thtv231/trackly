import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";

// POST /api/logout → ends the session and clears the cookie.
export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
