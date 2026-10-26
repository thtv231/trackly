import { apiUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { markAllRead } from "@/lib/notifications";

// POST /api/notifications/read → 200 { ok: true }: marks all of the current user's notifications as read.
export async function POST() {
  const user = await apiUser();
  if (user instanceof Response) return user;
  await markAllRead(user.id, await now());
  return Response.json({ ok: true });
}
