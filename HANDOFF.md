# Handoff test: following the README from a fresh clone

**Date:** 2026-10-27 · **Branch:** `d15` (commit `7645db7`) · **Machine:** Windows 10, Git Bash, Node v24.16.0, npm 11.13.0

A fresh agent got only `README.md` and was asked to clone the repo, install it, start the app, sign in and run the S02
acceptance test. It made no changes to the clone and didn't need to open any other file.

**Result:** all three steps worked from the README alone. It found five gaps, all fixed in the README in the same
commit as this file.

## Steps that worked
| Step | Command | Result |
|---|---|---|
| Clone | `git clone --branch d15 <repo> D:/rec/handoff/trackly` | OK, about 1 s |
| Install | `npm install` | OK, about 56 s, 400 packages, 0 vulnerabilities (one deprecation warning for eslint 9.39.5) |
| Start | `npm run dev` | OK, ready in 2.3 s, first page compiled in about 8 s |
| Pages | `GET /login` → 200, `GET /` signed out → 307 to `/login` | OK |
| Sign in | demo account `alice@trackly.test` / `trackly-demo` | OK once the endpoint was found (gap 2) |
| Playwright browser | `npx playwright install chromium` | OK (already cached on this machine; a new machine downloads it) |
| S02 test | `npx playwright test -g "S02 "` | **Passed**: `S02 list a project's issues (5.1s)`, `1 passed (2.0m)` |

## Where the README was missing or wrong
| # | README said | What happened | Fix in README |
|---|---|---|---|
| 1 | `npm run dev  # open http://localhost:3000` | Port 3000 was taken; Next moved to 3001 with only a warning, so the URL was wrong | "Usually 3000"; if it's busy, use the URL that `npm run dev` prints |
| 2 | Demo accounts and password only | No way to sign in without a browser; `POST /api/login` was found by trial after three wrong guesses (401s) | Documented `POST /api/login` with a curl example and the `trackly_session` cookie |
| 3 | No Node version | Unclear whether the Node version on the machine matters | "Needs Node.js 24 (the version CI uses)" |
| 4 | `npx playwright test -g "S03 "  # one acceptance story` | One story took 2 minutes, almost all of it starting the test server | Says each run starts and compiles the server first, about 2 minutes even for one story |
| 5 | Mentions a "projects page" | `/projects` is a 404; the projects page is `/` | Says `/` is the projects page and projects live at `/projects/<KEY>` |

## Other observations (not README errors)
- **Windows:** stopping a background `npm run dev` left its `next dev` child processes running and the port open. They
  had to be killed by PID (`taskkill /PID <pid> /T /F`).
- `next dev` listens on the LAN (it prints a Network URL). That's fine for development, but the dev server should not
  be left running on untrusted networks.
- The `eslint@9` deprecation warning on install is worth a dependency update after the handover.

## Cleanup
The clone in `D:/rec/handoff/trackly` was deleted after this test.
