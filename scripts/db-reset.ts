// Put the dev database (.data/pglite) back to the demo data. Stop `npm run dev` first:
// only one process at a time can open a PGlite data folder.
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  // Delete the old folder completely, so a changed schema.sql is applied from scratch.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(dir);
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  await db.exec(readFileSync("db/seed.sql", "utf8"));
  await db.close();
  console.log("Database reset to the demo data:", dir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
