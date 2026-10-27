// Apply db/schema.sql to the remote database in DATABASE_URL (e.g. Supabase):
//   npx tsx --env-file=.env.supabase scripts/db-push.ts            schema only (safe to run again)
//   npx tsx --env-file=.env.supabase scripts/db-push.ts --seed     schema + demo data, empty database only
// schema.sql is idempotent (CREATE ... IF NOT EXISTS). seed.sql empties every table first and adds demo users
// with a public password, so --seed refuses to run on a database that already has users.
import { exec, query, sqlFile } from "../src/lib/db";

async function main() {
  // Without DATABASE_URL, exec() would silently write to the local PGlite folder instead.
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (load it with --env-file)");
  await exec(sqlFile("schema.sql"));
  console.log("Applied db/schema.sql");
  if (!process.argv.includes("--seed")) return;
  const [{ n }] = await query<{ n: number }>("SELECT count(*)::int AS n FROM users");
  if (n > 0) throw new Error(`Refusing to seed: the database already has ${n} users (seed.sql would delete them)`);
  await exec(sqlFile("seed.sql"));
  console.log("Applied db/seed.sql");
}

main().then(
  // db.ts keeps the postgres.js pool open, so exit explicitly.
  () => process.exit(0),
  (err) => {
    // Never print the connection string, even if a driver error happens to include it.
    const url = process.env.DATABASE_URL;
    const msg = String(err instanceof Error ? err.message : err);
    console.error("db-push failed:", url ? msg.split(url).join("<DATABASE_URL>") : msg);
    process.exit(1);
  },
);
