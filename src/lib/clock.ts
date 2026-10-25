import { connection } from "next/server";
import { query } from "./db";

// The app's "now". Under test (TRACKLY_TEST=1) the tests store a fake time in the settings table,
// so results do not depend on when you run them. Use this instead of `new Date()` for anything
// that is saved or compared ("today", resolved dates, due dates, sprint days).
export async function now(): Promise<Date> {
  // "now" is always computed at request time, never frozen at build time (outside Next, e.g. unit tests, skip this).
  if (process.env.NEXT_RUNTIME) await connection();
  if (process.env.TRACKLY_TEST === "1") {
    const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'fake_now'");
    if (rows[0]) return new Date(rows[0].value);
  }
  return new Date();
}

/** UTC calendar date of a moment, as 'YYYY-MM-DD'. */
export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
