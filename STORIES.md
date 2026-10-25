# Trackly: 40 user stories

Trackly is a small issue tracker for software teams: projects, issues, a Kanban board, sprints, and an AI assistant.
This file is the spec for the whole course. Every story has an acceptance test with the same ID in `tests/acceptance/`.
The tests are the final judge. `npm run scoreboard` runs all 40 and prints the **Trackly scoreboard**.

## Conventions
- **`data-testid` attributes** in parentheses are the contract between the UI and the tests. Change the UI freely, but keep the test IDs.
- **Issue keys:** `<PROJECT KEY>-<n>`, e.g. `TRK-12`. `n` counts per project, starts at 1, and is never reused, even after a delete.
- **Statuses:**

  | Code | Shown as |
  |---|---|
  | `todo` | To Do |
  | `in_progress` | In Progress |
  | `in_review` | In Review |
  | `done` | Done |

- **Allowed transitions:** `todo → in_progress`; `in_progress → todo | in_review`; `in_review → in_progress | done`; `done → in_progress` (reopen).
- **Types:** `task`, `bug`, `story`. **Priorities** (high to low): `highest`, `high`, `medium`, `low`, `lowest`.
- **Story points:** one of 0, 1, 2, 3, 5, 8, 13, or empty.
- **Dates and times:** stored as UTC; shown as `Nov 2, 2026`. All "today" logic uses the app clock (`src/lib/clock.ts`).
- **The test suite runs with:**
  - a fake clock: Monday, Nov 2, 2026, 09:00 UTC;
  - seed users, all with password `trackly-demo`: `alice@trackly.test` Alice Nguyen (admin), `bob@trackly.test` Bob Smith and `carol@trackly.test` Carol Diaz (members), `dave@trackly.test` Dave Lee (viewer);
  - seed projects `TRK` "Trackly Web" (issues TRK-1 … TRK-12, webhook secret `whsec_trk_demo`) and `OPS` "Operations" (OPS-1 … OPS-4, webhook secret `whsec_ops_demo`);
  - a scripted fake model instead of Claude for the assistant (see group F).

## Public API
All endpoints need a signed-in session (cookie from `POST /api/login`), otherwise `401 { error }`.
In the API, `assignee` is the user's email (or `null`), `dueDate` is `YYYY-MM-DD` (or `null`), `resolvedAt` is an ISO timestamp (or `null`).
- `POST /api/login` `{ email, password }` → `200`, sets the session cookie. `POST /api/logout`.
- `POST /api/issues` `{ projectKey, title, type, priority, assignee?, description?, points? }` → `201 { key }`, `400 { error }` on invalid input, `403` for viewers.
- `GET /api/issues/[key]` → `200 { key, title, type, status, priority, assignee, points, labels, resolvedAt, dueDate }`, `404` if missing.
- `PATCH /api/issues/[key]` with any of the fields above (except `key`, `status`) → `200`.
- `POST /api/issues/[key]/transition` `{ to }` → `200`, or `409 { error: "Transition not allowed" }`, or `409 { error: "WIP limit reached" }`.
- `DELETE /api/issues/[key]` → `204` (admins only, `403` otherwise).
- `POST /api/issues/[key]/comments` `{ body }` → `201`, `400` if empty.
- `POST /api/projects/[key]/sprints` `{ name, start, end }` (dates `YYYY-MM-DD`) → `201 { id }`, `400` if `end` is not after `start`.
- `POST /api/sprints/[id]/issues` `{ key }` → `200` (adds the issue to the sprint).
- `POST /api/sprints/[id]/start` → `200`, or `409` if another sprint of the project is active. `POST /api/sprints/[id]/complete` → `200`.
- `POST /api/assistant` `{ projectKey, messages }` → a streamed reply (group F). `POST /api/assistant/confirm` `{ projectKey, pendingId, approve }` → the streamed rest of the reply after the user confirms or cancels a write.

## A. Projects and issues
| ID | Story | Acceptance |
|---|---|---|
| S01 | See all projects | `/` shows one `project-card` per project, with the name (`project-name`), key (`project-key`) and the number of issues not Done (`project-open-count`) |
| S02 | List a project's issues | `/projects/TRK` shows one `issue-row` per issue, sorted by number ascending. Each row has `issue-key`, `issue-title`, `issue-status` (display name), `issue-priority` and `issue-assignee` ("Unassigned" if empty) |
| S03 | Issue detail | `/issues/TRK-3` shows `issue-key`, `issue-title`, `issue-type`, `issue-status`, `issue-priority`, `issue-assignee`, `issue-reporter` and the description rendered from Markdown (`issue-description`): `**bold**` becomes `<strong>` |
| S04 | Create an issue | `/projects/TRK/new` has `new-title`, `new-type`, `new-priority`, `new-assignee`, `new-description` and `new-submit`. Saving goes to the new issue page. An empty or 121+ character title shows `form-error` containing "Title" and the API returns 400 |
| S05 | Keys count per project | Creating an issue in OPS gives `OPS-5`; the next one in TRK gives `TRK-13` |
| S06 | Simultaneous creates | Five `POST /api/issues` sent at the same moment to TRK all return 201 with five different keys, `TRK-13` to `TRK-17` |
| S07 | Edit an issue | On the detail page, `issue-edit` opens the form (`edit-title`, `edit-priority`, `edit-assignee`, `edit-points`), `issue-save` saves title, priority, assignee and points. The detail page (`issue-points` for points) and the API show the new values |
| S08 | Delete an issue | Admins see `issue-delete`; after `confirm-delete` the issue page returns 404. The next issue created in that project still gets a new number (no reuse) |

## B. Board and workflow
| ID | Story | Acceptance |
|---|---|---|
| S09 | Kanban board | `/projects/TRK/board` has four `board-column` elements with `data-status` = `todo`, `in_progress`, `in_review`, `done`, in that order. Each issue is a `board-card` with `data-key` in its column |
| S10 | Column counts | Each column header shows its number of cards (`column-count`) |
| S11 | Move a card | Each card has a `card-move` select listing only the allowed next statuses (option values are status codes). Choosing one moves the card; after a reload it is still there and the API reports the new status |
| S12 | Enforce the workflow | `POST /api/issues/TRK-1/transition` from `todo` to `done` returns `409 { error: "Transition not allowed" }` and the status does not change |
| S13 | WIP limit | A project allows at most 3 issues In Progress. Moving a 4th returns `409 { error: "WIP limit reached" }`; on the board a `wip-error` message appears and the card stays put |
| S14 | Resolution date | Moving to Done sets `resolvedAt` to the clock time and the detail page shows it (`issue-resolved`). Reopening clears it |
| S15 | Card order | Within a column, cards are ordered by priority (highest first), then by key number ascending |

## C. Search, comments, activity
| ID | Story | Acceptance |
|---|---|---|
| S16 | Search | On `/projects/TRK`, typing in `issue-search` filters rows by title or key, case-insensitive: "trk-3" shows TRK-3, "login" shows every issue with "login" in the title |
| S17 | Filters in the URL | `filter-status`, `filter-priority` and `filter-type` (option values are codes) combine with AND and write to the URL (`?status=todo&priority=high`). Opening that URL shows the same filtered list |
| S18 | Labels | On the detail page, typing in `label-input` and pressing Enter adds a `label-chip`. Labels are lowercased and not duplicated. `/projects/TRK?label=frontend` lists only issues with that label |
| S19 | Comments | `comment-input` + `comment-submit` adds a `comment` showing the author name and text, oldest first. An empty comment is rejected with `form-error` |
| S20 | Safe Markdown | A description or comment containing `<script>` or `<img onerror=…>` is shown as text, never executed. `**bold**` still renders as `<strong>` |
| S21 | Activity log | The detail page lists `activity-item` entries, newest first, for creation and for every change of status, assignee or priority, e.g. "Alice Nguyen changed status from To Do to In Progress" |
| S22 | Pagination | A project list shows 25 rows per page. `page-info` reads "1–25 of 40" when there are 40 issues; `page-next` shows rows 26–40 |

## D. Sprints and reports
| ID | Story | Acceptance |
|---|---|---|
| S23 | Create a sprint | `/projects/TRK/sprints` has `sprint-name`, `sprint-start`, `sprint-end` and `sprint-create`. An end date not after the start date shows `form-error` |
| S24 | Plan a sprint | Backlog issues (`backlog-row`, not Done and not in a planned or active sprint) have `add-to-sprint`. The sprint lists them (`sprint-issue`; both rows carry `data-key`) and shows the total points (`sprint-points`). Setting points to 4 through the API returns 400 |
| S25 | Start a sprint | Each sprint is a `sprint-card` with its state (`sprint-state`: Planned, Active, Completed). `sprint-start-btn` makes the sprint active. Starting a second sprint while one is active shows `sprint-error` and the API returns 409 |
| S26 | Complete a sprint | `sprint-complete` ends the sprint. `sprint-summary` reads "Completed 3 of 5 issues (8 of 13 points)" with the real numbers, and unfinished issues return to the backlog |
| S27 | Burndown | `/projects/TRK/sprints/[id]/burndown` shows one `burndown-point` per sprint day with `data-date` (YYYY-MM-DD) and `data-remaining` = points not Done at the end of that day |
| S28 | Export CSV | `GET /projects/TRK/export.csv` returns `text/csv` with the header `Key,Title,Type,Status,Priority,Assignee,Points,Created`, one row per issue by number, e.g. `TRK-11,Write the onboarding guide,Task,To Do,Lowest,,,2026-10-21` (display names, assignee name, empty when none, created date `YYYY-MM-DD`); rows end with CRLF and titles containing commas or quotes are escaped per RFC 4180 |

## E. Accounts and notifications
| ID | Story | Acceptance |
|---|---|---|
| S29 | Sign in | `/login` has `login-email`, `login-password`, `login-submit`. Wrong credentials show `login-error` "Invalid email or password". `logout` signs out |
| S30 | Protected pages | Signed out, every page except `/login` redirects to `/login`, and the API returns 401 |
| S31 | Viewer role | Dave (viewer) can read everything but sees no create (`new-issue`), edit, move or delete controls, and those API calls return 403 |
| S32 | Notifications | Assigning an issue to Bob, or writing `@bob` in a comment, gives Bob a `notification-item` on `/notifications` and a badge (`notification-count`). `notifications-read` clears the badge |
| S33 | Webhooks | When an issue changes status, the app records a webhook delivery (visible at `GET /api/test/outbox`) with JSON `{ event: "issue.status_changed", key, from, to }` and header `X-Trackly-Signature` = HMAC-SHA256 of the body with the project's webhook secret, as lowercase hex. The outbox lists `{ event, body, headers }` per delivery |
| S34 | Due dates | An issue can have a due date (`issue-due`). Not Done and past due (by the app clock) shows an `overdue-badge` in the list and on the board |
| S35 | Mobile and accessibility | At 375 px wide, `/`, `/projects/TRK` and `/issues/TRK-1` have no horizontal scroll. Pages have `<html lang="en">`, titles ending in "· Trackly", and every form field has a label |

## F. AI assistant (built with the Claude API)
The assistant answers questions about a project and can change issues through tools. In production it calls Claude
(model from `TRACKLY_AI_MODEL`, default `claude-opus-5-5`) with tool use. Under test (`TRACKLY_TEST=1`) it calls a
**scripted fake model** instead: `POST /api/test/assistant-script` queues the replies the fake model will give
(text and/or tool calls), and `GET /api/test/assistant-log` returns every request the app sent to the model
(`{ model, system, messages, tools }`). Posting `{ "configured": false }` to the script endpoint makes the app behave as if
no API credentials were set.
The tests therefore check the app's side of the loop, not the model's wording.

| ID | Story | Acceptance |
|---|---|---|
| S36 | Assistant panel | Project pages have `assistant-open`, which opens `assistant-panel` with `assistant-input` and `assistant-send`. The reply appears as an `assistant-message` and is streamed (text appears before the reply is complete). Without credentials outside test mode, `assistant-error` reads "Assistant is not configured" |
| S37 | Grounded answers | When the model calls `get_issue` or `search_issues`, the app runs the tool against the database, shows a `assistant-tool` chip with the tool name, and the next model request contains the tool result (with the real issue title) |
| S38 | Confirm before writing | When the model calls `create_issue` or `update_issue`, nothing changes yet: an `assistant-confirm` card shows the proposed fields. `confirm-action` applies it (a new key such as TRK-13 appears in the chat); `cancel-action` applies nothing and tells the model it was cancelled |
| S39 | Same permissions as the user | For Dave (viewer), a confirmed write still fails with the same 403 rule as the API; the tool result sent back to the model says permission was denied and no issue changes |
| S40 | Untrusted content stays data | Issue text is passed to the model inside the tool result only, never in the system prompt. There is no delete tool. Even if the model calls a write tool right after reading an issue that says "ignore previous instructions", the confirmation card is still required |
