import { cookies } from "next/headers";
import { checkCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";

// POST /api/login { email, password } → 200 { user } and sets the session cookie.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (typeof body?.email !== "string" || typeof body?.password !== "string") {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  const user = await checkCredentials(body.email, body.password);
  if (!user) return Response.json({ error: "Invalid email or password" }, { status: 401 });

  const { token, expires } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return Response.json({ user: { email: user.email, name: user.name, role: user.role } });
}
