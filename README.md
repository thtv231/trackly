# Trackly: a small issue tracker

Trackly is the course project of the **Claude Code course**. It is a small Jira-like tracker for software teams:
projects, issues with keys like `TRK-12`, a Kanban board with a workflow and a WIP limit, sprints with a burndown,
notifications, webhooks, and an AI assistant built with the Claude API. During the course you build it with Claude Code,
one group of user stories at a time.

## Run it
```bash
npm install
npm run dev          # open http://localhost:3000
```
Sign in with one of the demo accounts (password `trackly-demo`): `alice@trackly.test` (admin),
`bob@trackly.test` and `carol@trackly.test` (members), `dave@trackly.test` (viewer).

No database to install: Trackly uses [PGlite](https://pglite.dev), a Postgres that runs inside Node and stores its data
in `.data/`. Set `DATABASE_URL` to switch to a real Postgres when you deploy. `npm run db:reset` puts the dev database
back to the demo data (stop `npm run dev` first).

## The scoreboard
```bash
npx playwright install chromium   # first time only
npm run scoreboard
```
This runs the 40 acceptance tests (the stories are in `STORIES.md`) against a separate server on port 3100 with its own
database, a fake clock and a scripted fake model, then prints the **Trackly scoreboard**. At the start, 3 of 40 pass
(projects page, sign-in, protected pages). Your goal is 40/40. `npm run test` runs the unit tests (Vitest).

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
src/lib/db.ts                 query() over PGlite (dev, test) or a real Postgres (DATABASE_URL)
src/lib/clock.ts              the app clock (fake under test)
src/lib/auth.ts               passwords, sessions, current user
src/proxy.ts                  signed out: pages redirect to /login, the API answers 401
src/app/                      pages and API routes (Next.js App Router)
src/app/api/test/             test-only endpoints (reset, clock, outbox, assistant script and log)
tests/acceptance/             the 40 acceptance tests (Playwright), one file per group
scripts/scoreboard.ts         the Trackly scoreboard
prompts/                      prompts from the videos, one file per day
```
