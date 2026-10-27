# ADR 0001: PGlite locally, Postgres when deployed

**Status:** Accepted · **Date:** 2026-10-27

## Context
Trackly is a course project: students clone it and should get a working app with `npm install && npm run dev`, with
no database server to install. Deployed, it needs a real, durable, shared Postgres (for example Supabase). The
acceptance tests also need their own database next to the dev one.

## Decision
`src/lib/db.ts` exposes one `query()` / `transaction()` API with two backends:
- **`DATABASE_URL` unset:** [PGlite](https://pglite.dev), Postgres compiled to WASM, running inside the Node process
  with its data in `.data/pglite` (dev) or `PGLITE_DIR` (tests use `.data/test`). An empty folder gets
  `db/schema.sql` and `db/seed.sql` automatically.
- **`DATABASE_URL` set:** postgres.js against a real Postgres (`prepare: false`, so it works behind the Supabase
  pooler).

Both are real Postgres, so the app writes one dialect: raw SQL with `$1` parameters and no ORM.

## Consequences
- Zero-setup dev and test; the tests reset their database through `/api/test/reset` in milliseconds.
- Only one process at a time can open a PGlite folder (stop `npm run dev` before `npm run db:reset`).
- Dev and production run different drivers, so a driver-specific difference can slip through; CI only tests PGlite.
- A missing `DATABASE_URL` in production used to fall back to PGlite on the local disk without a word, which loses
  data on hosts with temporary disks. Since the handover, `NODE_ENV=production` without `DATABASE_URL` is an error
  unless `PGLITE_DIR` is set on purpose.
