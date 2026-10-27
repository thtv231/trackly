# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Trackly is a small Jira-like issue tracker built story by story during a Claude Code course. **`STORIES.md` is the spec** (conventions, public API, 40 user stories in groups A–F), and the Playwright acceptance tests in `tests/acceptance/` are the final judge. To build a story, use the `/trackly-story S16` skill.

## Project rules
1. **Tests:** run only the acceptance tests for the story you're working on, e.g. `npx playwright test -g "S03 "` (the trailing space keeps S03 from matching S30–S39). `npm run scoreboard` runs all 40 tests and takes about 4 minutes, so run it only when asked.
2. **Dependencies:** never add an npm package without asking first.
3. **Session and data:** every page checks the session with `requireUser()` and every API route with `apiUser()` (both in `src/lib/auth.ts`; `apiUser()` returns a 401 instead of redirecting). All data is read through `query()` / `transaction()` from `src/lib/db.ts`.
4. **Commits:** message format is `S03: short summary`.

## Next.js 16 caveat
This is Next.js 16 (React 19.3). APIs differ from older versions, so read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Request interception lives in `src/proxy.ts` (exported `proxy`, not `middleware`), and `params` is a `Promise` that must be awaited.

## Commands
```bash
npm run dev                 # http://localhost:3000, demo users alice/bob/carol/dave@trackly.test, password trackly-demo
npm run lint                # eslint
npm run test                # Vitest unit tests (src/**/*.test.ts, in-memory PGlite)
npx vitest run src/lib/foo.test.ts     # one unit test file
npx playwright test -g "S03 "          # one acceptance story (first time: npx playwright install chromium)
npm run scoreboard          # all 40 acceptance tests, ~4 min, only when asked
npm run db:reset            # reset dev DB (.data/pglite) to seed data; stop `npm run dev` first
```

## Architecture
- **Database:** `src/lib/db.ts` uses PGlite (in-process Postgres, data in `.data/`, one process per data dir) unless `DATABASE_URL` is set, then postgres.js. Raw SQL with `$1` params, no ORM. `db/schema.sql` already defines tables for the **whole** domain; `db/seed.sql` holds demo data. The schema is applied to an empty DB and on every test reset (drops and recreates `public`), so there are no migrations.
- **Clock:** use `now()` from `src/lib/clock.ts`, never `new Date()`, for anything saved or compared. Under test it returns a fake time (`fake_now` in `settings`): Monday Nov 2, 2026 09:00 UTC.
- **Auth:** `src/proxy.ts` is only a fast gate (no cookie: pages redirect to `/login`, `/api/*` returns 401); the real checks are in rule 3. Roles: admin, member, viewer (viewers can't write, 403; deletes are admin-only).
- **Domain:** statuses, types, priorities, points and labels are in `src/lib/domain.ts`; formatting in `src/lib/format.ts`. Issue keys `<PROJECT>-<n>` take `n` from `projects.next_number`: never reused, and safe under concurrent creates (S06).
- **Pages/routes:** App Router under `src/app/`; server components query the DB directly. Tailwind v4.
- **Test mode (`TRACKLY_TEST=1`):** Playwright starts its own `next dev -p 3100` with `PGLITE_DIR=.data/test` and `distDir=.next-test`, alongside your dev server. Test-only endpoints in `src/app/api/test/` return 404 outside test mode via `notInTestMode()` (`src/lib/testing.ts`). One worker, shared DB, 3 s action timeout.
- **AI assistant (group F):** production calls Claude (`TRACKLY_AI_MODEL`, default `claude-opus-5-5`), or Groq when only `GROQ_API_KEY` is set, with tool use; under test a scripted fake model reads its replies from `settings` and logs every request (keys in `src/lib/testing.ts`). Issue text reaches the model only inside tool results, writes need user confirmation, and there is no delete tool.

## Conventions the tests depend on
- `data-testid` attributes named in `STORIES.md` are the UI/test contract: restyle freely, keep the IDs.
- Dates are stored in UTC and shown like `Nov 2, 2026`.

## Course workflow
Git tags `dNN-start` / `dNN-end` mark each course day; `prompts/` holds the prompts used in the videos.
