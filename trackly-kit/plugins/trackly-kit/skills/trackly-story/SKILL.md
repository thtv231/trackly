---
name: trackly-story
description: Implement one Trackly user story from STORIES.md end to end (read the spec row, build it, register new routes for pre-compile, run that story's acceptance test, commit). Use when asked to build, implement or finish a story by ID like S16.
argument-hint: <story-id, e.g. S16>
allowed-tools: Bash(npx playwright test:*)
---

# Implement story $ARGUMENTS

## Current repo state
- Git status:
!`git status --short --branch`
- Last 3 commits:
!`git log --oneline -3`

If the working tree has unrelated uncommitted changes, stop and ask before continuing.

## Steps

1. **Read the spec.** Find the `| $ARGUMENTS |` row in `STORIES.md` (and the Conventions / Public API sections it relies on). Also read the matching `test("$ARGUMENTS ...")` in `tests/acceptance/*.spec.ts`; the test is the final judge.
2. **Keep the `data-testid`s exactly.** Use every `data-testid` named in the story row and the test verbatim: same spelling, same casing, no renames. Restyle freely, but the IDs are the test contract.
3. **Build it** following `CLAUDE.md`: `requireUser()` on pages, `apiUser()` on API routes, data via `query()` / `transaction()`, `now()` from `src/lib/clock.ts` instead of `new Date()`, awaited `params`, Next.js 16 docs in `node_modules/next/dist/docs/`. Don't add npm packages without asking.
4. **Register new routes.** Every new page goes into `PAGES`, every new GET route into `GETS`, and every new POST route into `POSTS` in `tests/global-setup.ts`, so it is pre-compiled before the tests run: a first-hit compile takes 2–3 s and can exceed the 3 s test timeout.
5. **Run only this story's test:**
   ```bash
   npx playwright test -g "$ARGUMENTS "
   ```
   Keep the trailing space (as in CLAUDE.md: it keeps S03 from matching S30–S39). Don't run `npm run scoreboard`. Fix and re-run until it passes. If it still fails, report the output instead of committing.
6. **Commit** once the test passes, with the message format `$ARGUMENTS: short summary`, e.g. `S16: filter issue list by title or key`. Stage only the files this story changed.
