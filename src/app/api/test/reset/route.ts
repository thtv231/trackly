import { exec, query, sqlFile } from "@/lib/db";
import { notInTestMode } from "@/lib/testing";

// TEST ONLY (TRACKLY_TEST=1): rebuild the database from db/schema.sql + db/seed.sql and set the fake clock.
// Body: { "now": "2026-11-02T09:00:00.000Z" }  (leave out = real time)
export async function POST(req: Request) {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { now?: string };
  // Drop everything first, so a changed schema.sql (new column, new table) is always applied.
  await exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await exec(sqlFile("schema.sql"));
  await exec(sqlFile("seed.sql"));
  if (body.now) {
    await query("INSERT INTO settings (key, value) VALUES ('fake_now', $1)", [body.now]);
  }
  return Response.json({ ok: true });
}
