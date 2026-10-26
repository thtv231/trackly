# SPEC: Create an issue (S04, S05)

Scope: the `/projects/[key]/new` page, the `POST /api/issues` route, and per-project issue keys.
Source of truth: `STORIES.md` (S04, S05, Public API) and `tests/acceptance/a-projects-issues.spec.ts`.
Where this spec and the tests disagree, the tests win.

## Out of scope
- **S06 (simultaneous creates).** Not a goal here and not verified. Keys still come from `projects.next_number` (see "Keys"), so S06 can build on this later.
- **Side effects:** no `activity` row, no notification, no webhook delivery. Later stories add them to the create path.
- Editing, deleting, labels, due dates, sprints.

## Decisions

| Topic | Decision |
|---|---|
| Submit path | Client form calls `POST /api/issues` with `fetch`. On `201 { key }` it navigates to `/issues/<key>`. On an error it shows the response's `error` in `form-error`. All validation lives on the server, in one place. |
| Form defaults | Type **Task**, priority **Medium**, assignee **the signed-in user**. |
| Assignee options | "Unassigned" plus all **admins and members**, labelled by name, value = email. No viewers. |
| Title | Trim, then 1–120 characters (measured after trimming). Store the trimmed value. |
| Description | Optional, trimmed, max 10,000 characters. Empty means `''`. |
| Points | Accepted by the API (`0,1,2,3,5,8,13` or `null`/missing). **Not** shown on the form. |
| Viewers | The project page hides the "New issue" button. `/projects/[key]/new` shows a permission message instead of the form (HTTP 200: a real 403 page would need Next's experimental `authInterrupts`). The API returns `403`. |
| Unknown project | `/projects/NOPE/new` → not-found page. `POST /api/issues` with `projectKey: "NOPE"` → `404 { error: "Project not found" }`. |
| Errors | One message in `form-error`: the first problem the server finds. The form keeps what the user typed. The submit button is disabled while the request runs. |
| Entry point | A "New issue" link on `/projects/[key]` (admins and members only). |

## API: `POST /api/issues`

Body: `{ projectKey, title, type, priority, assignee?, description?, points? }`

Checks, in this order (the first failure wins):

| # | Check | Response |
|---|---|---|
| 1 | Signed in (`apiUser()`) | `401 { error }` |
| 2 | Role is not `viewer` | `403 { error }` |
| 3 | `title` is a string, 1–120 chars after trimming | `400 { error: "Title is required" }` / `400 { error: "Title must be 120 characters or fewer" }` |
| 4 | `type` is one of `task`, `bug`, `story` | `400 { error: "Type must be one of task, bug, story" }` |
| 5 | `priority` is one of `highest`, `high`, `medium`, `low`, `lowest` | `400 { error: "Priority must be one of highest, high, medium, low, lowest" }` |
| 6 | `points` is missing, `null`, or one of `0,1,2,3,5,8,13` | `400 { error: "Points must be one of 0, 1, 2, 3, 5, 8, 13" }` |
| 7 | `description` is missing or a string of 10,000 chars or fewer after trimming | `400 { error: "Description must be 10,000 characters or fewer" }` |
| 8 | Project with key `projectKey` exists | `404 { error: "Project not found" }` |
| 9 | `assignee` is missing, `null`, `""`, or the email of an admin or member | `400 { error: "Assignee must be an admin or member" }` |

On success: `201 { key }`, e.g. `{ "key": "TRK-13" }`.
The new issue has status `todo`, reporter = signed-in user, `created_at`/`updated_at` = `now()` from `src/lib/clock.ts`.
A body that isn't valid JSON returns `400 { error }`.

## Keys (S05)
- Inside one `transaction()`: read the project's `next_number`, insert the issue with that number, and increment `next_number`.
- Keys count per project: creating in OPS doesn't change TRK's counter.
- Numbers are never reused (the counter only goes up). A failed create (any 4xx above) doesn't use up a number, because validation runs before the transaction.

## Page: `/projects/[key]/new`
- Server component: `requireUser()`, loads the project (or `notFound()`), the role check, and the assignee list. It renders a client form component.
- Test IDs: `new-title` (text input), `new-type` (select: Task/Bug/Story), `new-priority` (select: Highest…Lowest), `new-assignee` (select: Unassigned + names), `new-description` (textarea, Markdown), `new-submit` (button), `form-error` (shown only when there is an error).
- Option labels come from `TYPE_LABEL` / `PRIORITY_LABEL` in `src/lib/domain.ts`. Option values are the codes.

## Housekeeping
- Add `/projects/TRK/new` to `PAGES` and `POST /api/issues` to `POSTS` in `tests/global-setup.ts`.
- No new npm packages.
- Commits: `S04: …` and `S05: …`.

## Acceptance criteria

### S04: create an issue (`npx playwright test -g "S04 "`)
- [ ] As Alice, `/projects/TRK/new` shows all six `new-*` controls.
- [ ] Submitting with an empty title shows `form-error` containing "Title", and nothing is created.
- [ ] Filling in title "Export issues to PDF", type Bug, priority High, assignee Carol Diaz and description `Needs **page numbers**.`, then submitting, lands on `/issues/TRK-13`, which shows that title, Bug, High, Carol Diaz, and reporter Alice Nguyen.
- [ ] The API returns `400 { error }` for titles `""`, `"   "` and 121 × `x`, for type `epic`, and for priority `urgent`.
- [ ] A title of exactly 120 characters succeeds and gets `TRK-14` (the earlier 400s didn't use up numbers).
- [ ] The form opens with Task, Medium and the signed-in user preselected.
- [ ] As Dave (viewer), the project page has no "New issue" link, `/projects/TRK/new` shows a permission message instead of the form, and `POST /api/issues` returns `403`.
- [ ] The API returns `400` for a viewer or unknown email as `assignee` and for `points: 4`.

### S05: keys count per project (`npx playwright test -g "S05 "`)
- [ ] Creating in OPS returns `OPS-5`, then TRK returns `TRK-13`, then OPS returns `OPS-6`.
- [ ] `GET /api/issues/OPS-5` returns title "Renew the domain". **Note:** this needs `GET /api/issues/[key]` from the Public API, which doesn't exist yet. It's included in this work, with the response shape listed in `STORIES.md`.
- [ ] `projectKey: "NOPE"` returns `404`.
- [ ] `/projects/NOPE/new` shows the not-found page.

### Regression
- [ ] `npx playwright test -g "S0[1-3] "` still passes. `npm run lint` and `npm run test` are clean.
