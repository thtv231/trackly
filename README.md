# Trackly: a small issue tracker

Trackly is the course project of the **Claude Code course**. It is a small Jira-like tracker for software teams:
projects, issues with keys like `TRK-12`, a Kanban board with a workflow and a WIP limit, sprints with a burndown,
notifications, webhooks, and an AI assistant built with the Claude API. During the course you build it with Claude Code,
one group of user stories at a time.

## Run it
Needs Node.js 24 (the version CI uses) and npm.
```bash
npm install
npm run dev          # usually http://localhost:3000
```
If port 3000 is already taken, Next picks the next free port (3001, …) and prints it: open the URL from the
`npm run dev` output.

Sign in with one of the demo accounts (password `trackly-demo`): `alice@trackly.test` (admin),
`bob@trackly.test` and `carol@trackly.test` (members), `dave@trackly.test` (viewer). After signing in, `/` is the
projects page; each project lives at `/projects/<KEY>` (for example `/projects/TRK`).

To sign in without a browser (curl, scripts), post JSON to `/api/login`; it sets the `trackly_session` cookie:
```bash
curl -c cookies.txt -H 'content-type: application/json' \
  -d '{"email":"alice@trackly.test","password":"trackly-demo"}' http://localhost:3000/api/login
curl -b cookies.txt http://localhost:3000/
```

No database to install: in development Trackly uses [PGlite](https://pglite.dev), a Postgres that runs inside Node and
stores its data in `.data/` (see [ADR 0001](docs/adr/0001-pglite-locally-postgres-deployed.md)). `npm run db:reset`
puts the dev database back to the demo data (stop `npm run dev` first).

The assistant panel needs `ANTHROPIC_API_KEY` (see [Environment variables](#environment-variables)); without it the
panel answers "Assistant is not configured" and the rest of the app works normally.

## Test it
```bash
npm run lint                     # eslint
npm run test                     # Vitest unit tests (src/**/*.test.ts, in-memory PGlite)
npx playwright install chromium  # first time only
npx playwright test -g "S03 "    # one acceptance story (the trailing space keeps S03 from matching S30–S39)
npm run scoreboard               # all 40 acceptance tests, about 4 minutes
```
The acceptance tests (the stories are in `STORIES.md`) start their own server on port 3100 with `TRACKLY_TEST=1`, a
separate database in `.data/test`, a fake clock (Monday Nov 2, 2026 09:00 UTC) and a scripted fake model instead of
Claude (see [ADR 0002](docs/adr/0002-fake-model-in-assistant-tests.md)). They never touch your dev server or call the
real Claude API, so they are free and deterministic. Every run starts and compiles that server first, so even a
single story takes about 2 minutes, almost all of it startup.

**CI** (`.github/workflows/ci.yml`) runs lint, unit tests, a production build and the scoreboard on every pull request
and on every push to `main`.

## Deploy it
Trackly is a standard Next.js app (`npm run build`, then `npm start`) backed by any Postgres, for example Supabase.

1. **Create the database** and apply the schema from your machine, with the connection string in a local env file
   (gitignored, never committed):
   ```bash
   npx tsx --env-file=.env.supabase scripts/db-push.ts          # schema only; safe to run again
   npx tsx --env-file=.env.supabase scripts/db-push.ts --seed   # + demo data; refuses if any users exist
   ```
   `db/schema.sql` is the single source of truth for the schema; there are no migrations
   (see [ADR 0003](docs/adr/0003-one-schema-file-no-migrations.md)). Don't seed a real production database: the demo
   users, including the admin `alice`, have the public password `trackly-demo`.
2. **Set the environment variables** below on your host. At least `DATABASE_URL`; in production the app refuses to
   start a database without it instead of quietly writing to the local disk.
3. **Build and start**: `npm ci && npm run build && npm start`. `next start` runs with `NODE_ENV=production`, which
   marks the session cookie `Secure`, so serve the app over HTTPS.

Before go-live, also decide on:
- **Backups.** The repo has none. Turn on your database provider's backups (on Supabase, check the plan's daily
  backups and point-in-time recovery), and test a restore once.
- **Assistant spending.** There is no limit per user or per day in the app, only per message (8 model calls, 16k
  output tokens each). Give the app its own Anthropic API key with a spend limit set in the Anthropic Console.
- **Branch protection** on `main` so a red CI run blocks a merge.

## Environment variables
| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | Production | Postgres connection string (postgres.js). Unset in dev = PGlite in `.data/pglite`. In production (`NODE_ENV=production`) the app errors without it, unless `PGLITE_DIR` is set. |
| `ANTHROPIC_API_KEY` | For the assistant | Claude API key, read on the server only. `ANTHROPIC_AUTH_TOKEN` also works. Unset = "Assistant is not configured". |
| `TRACKLY_AI_MODEL` | No | Assistant model, default `claude-opus-5-5`. A cheaper model lowers the cost per message. |
| `PGLITE_DIR` | No | PGlite data folder (default `.data/pglite`). In production, set it only to run on PGlite on purpose (single process, persistent disk). |
| `TRACKLY_TEST` | **Never in production** | `1` = test mode: enables the unauthenticated `/api/test/*` endpoints (database reset, fake clock), the fake clock and the fake model. Playwright sets it for its own server. |
| `NODE_ENV` | Set by Next | `production` under `next build` / `next start`; turns on the `Secure` cookie flag and the `DATABASE_URL` check. |

Keep real values out of git: `.env*` files are gitignored. For local development put them in `.env.local`, which Next
loads automatically.

## Following the course
| Tag | State |
|---|---|
| `d01-start` | The starting point: app shell, sign-in, projects page, database and seed, all 40 tests |
| `dNN-start` / `dNN-end` | Start and end of course day NN. Wherever you are, `git checkout dNN-start` lets you continue from there |

The `prompts/` folder holds every prompt used in the videos, so you can copy them.

## Folder structure
```
STORIES.md                    the 40 user stories: the spec for the whole course
db/schema.sql, db/seed.sql    tables for the whole domain and the demo data
docs/adr/                     architecture decision records
scripts/db-push.ts            apply the schema (and optionally the demo data) to DATABASE_URL
src/lib/db.ts                 query() over PGlite (dev, test) or a real Postgres (DATABASE_URL)
src/lib/clock.ts              the app clock (fake under test)
src/lib/auth.ts               passwords, sessions, current user
src/lib/assistant/            the AI assistant: tool loop, tools, Claude model and fake model
src/proxy.ts                  signed out: pages redirect to /login, the API answers 401
src/app/                      pages and API routes (Next.js App Router)
src/app/api/test/             test-only endpoints (reset, clock, outbox, assistant script and log)
tests/acceptance/             the 40 acceptance tests (Playwright), one file per group
scripts/scoreboard.ts         the Trackly scoreboard
prompts/                      prompts from the videos, one file per day
```
