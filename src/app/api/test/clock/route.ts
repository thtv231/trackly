import { query } from "@/lib/db";
import { notInTestMode } from "@/lib/testing";

// TEST ONLY (TRACKLY_TEST=1): change the fake clock without touching the data.
// Body: { "now": "2026-11-04T10:00:00.000Z" }
export async function POST(req: Request) {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  const { now } = (await req.json().catch(() => ({}))) as { now?: string };
  if (!now || Number.isNaN(Date.parse(now))) return Response.json({ error: "now must be an ISO time" }, { status: 400 });
  await query(
    "INSERT INTO settings (key, value) VALUES ('fake_now', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [now],
  );
  return Response.json({ ok: true });
}
