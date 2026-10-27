# ADR 0003: One schema file, no migrations

**Status:** Accepted for the course; to be revisited before production data exists · **Date:** 2026-10-27

## Context
The course builds 40 stories over many days, and students jump between days with `git checkout dNN-start`. A
migration history that grows with each story would make every checkout depend on the order migrations were applied,
and would add a tool to learn on top of the course content.

## Decision
`db/schema.sql` defines the tables for the **whole** domain from day one, written with `CREATE ... IF NOT EXISTS`.
`db/seed.sql` holds the demo data and empties every table before inserting. The schema is applied:
- to an empty PGlite folder on first start (`src/lib/db.ts`),
- on every test reset, after dropping and recreating the `public` schema (`/api/test/reset`),
- to a remote database with `scripts/db-push.ts` (schema only; `--seed` also loads the demo data, and refuses if
  the database already has users).

## Consequences
- Every checkout and every test run gets exactly the schema in the file, with no drift.
- `IF NOT EXISTS` only creates missing tables. It doesn't change existing ones, so a changed column definition never
  reaches a database that already has data.
- **Once production holds real data**, a schema change needs a hand-written, reviewed `ALTER` script, applied after a
  backup. At that point, adopt a migration tool (or numbered SQL files) and keep `schema.sql` as the snapshot.
- `seed.sql` is destructive by design; it must never run against production. `db-push` used to run it every time; it
  now runs only with `--seed`, and only on a database with no users.
