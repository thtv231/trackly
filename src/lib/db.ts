import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { connection } from "next/server";
import postgres from "postgres";

// One query() function for both environments:
// - DATABASE_URL set (e.g. Supabase when deployed) → postgres.js
// - not set → PGlite, a Postgres that runs inside the Node process and stores data in .data/
type Params = unknown[];
export type Query = <T = Record<string, unknown>>(text: string, params?: Params) => Promise<T[]>;

const g = globalThis as unknown as { __tracklyPg?: Promise<PGlite>; __tracklySql?: postgres.Sql };

function pglite(): Promise<PGlite> {
  g.__tracklyPg ??= (async () => {
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
    const db = await PGlite.create(dir);
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'projects'",
    );
    if (rows[0].n === 0) {
      await db.exec(sqlFile("schema.sql"));
      await db.exec(sqlFile("seed.sql"));
    }
    return db;
  })().catch((e) => {
    g.__tracklyPg = undefined; // do not keep a failed start around
    throw e;
  });
  return g.__tracklyPg;
}

function remote(): postgres.Sql {
  g.__tracklySql ??= postgres(process.env.DATABASE_URL!, { prepare: false });
  return g.__tracklySql;
}

export function sqlFile(name: string): string {
  return readFileSync(path.join(process.cwd(), "db", name), "utf8");
}

export const query: Query = async (text, params = []) => {
  // Always read the DB at request time, never freeze data at build time (outside Next, e.g. unit tests, skip this).
  if (process.env.NEXT_RUNTIME) await connection();
  if (process.env.DATABASE_URL) return (await remote().unsafe(text, params as never[])) as never;
  const r = await (await pglite()).query(text, params);
  return r.rows as never;
};

/** Run several statements in one transaction. */
export async function transaction<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  if (process.env.DATABASE_URL) {
    return (await remote().begin(async (tx) =>
      fn(async (text, params = []) => (await tx.unsafe(text, params as never[])) as never),
    )) as T;
  }
  return (await pglite()).transaction(async (tx) =>
    fn(async (text, params = []) => (await tx.query(text, params)).rows as never),
  );
}

/** Run a whole multi-statement SQL file (schema, seed). */
export async function exec(text: string): Promise<void> {
  if (process.env.DATABASE_URL) await remote().unsafe(text);
  else await (await pglite()).exec(text);
}
