import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import type { Role } from "./domain";
import { SESSION_COOKIE } from "./session-cookie";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

export type User = { id: number; email: string; handle: string; name: string; role: Role };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return ["scrypt", salt.toString("hex"), scryptSync(password, salt, 32).toString("hex")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Check email + password; returns the user or null. */
export async function checkCredentials(email: string, password: string): Promise<User | null> {
  const rows = await query<User & { password_hash: string }>(
    "SELECT id, email, handle, name, role, password_hash FROM users WHERE email = lower($1)",
    [email.trim()],
  );
  const u = rows[0];
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  return { id: u.id, email: u.email, handle: u.handle, name: u.name, role: u.role };
}

export async function createSession(userId: number): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [token, userId, expires]);
  return { token, expires };
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}

/** The signed-in user from the session cookie, or null. Works in pages, layouts and route handlers. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await query<User>(
    `SELECT u.id, u.email, u.handle, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  return rows[0] ?? null;
}

/** For pages: the signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: the signed-in user, or a 401 response to return. */
export async function apiUser(): Promise<User | Response> {
  const user = await currentUser();
  return user ?? Response.json({ error: "Not signed in" }, { status: 401 });
}
