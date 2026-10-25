-- Trackly demo data. Safe to run again: it empties every table first.
-- All four users have the password 'trackly-demo'.
TRUNCATE assistant_pending, webhook_deliveries, notifications, sprint_issues, sprints, activity, comments, issue_labels, labels,
         issues, projects, sessions, users, settings RESTART IDENTITY CASCADE;

INSERT INTO users (email, handle, name, role, password_hash) VALUES
  ('alice@trackly.test', 'alice', 'Alice Nguyen', 'admin',  'scrypt$72aecd86579467d23ca7e2915669b081$9f08f29cf868db7989961006820211c6825971f02376b32fcf380541946ee8eb'),
  ('bob@trackly.test',   'bob',   'Bob Smith',    'member', 'scrypt$ae6b7e44443844570dd2a7962b5586ba$2c043e3ec60a22ff9175f0fe77aa440dffb5b0bcdd61d928b1d4d8aec124e22c'),
  ('carol@trackly.test', 'carol', 'Carol Diaz',   'member', 'scrypt$7679aba8ab380587d798c59b4a62237d$80204a983acab6c04244e1ac4deef5fc190da6c9df1b872eaa8d494573b0c379'),
  ('dave@trackly.test',  'dave',  'Dave Lee',     'viewer', 'scrypt$781ad133cea9b5cf119cb67eb03f6d74$b5b388000f1cec311c76cdb2423c1d2e66ff9200ab9de6964c0079005018e997');

INSERT INTO projects (key, name, description, next_number, wip_limit, webhook_secret, created_at) VALUES
  ('TRK', 'Trackly Web', 'The Trackly web app: board, sprints, search and the assistant.', 13, 3, 'whsec_trk_demo', '2026-10-01T08:00:00Z'),
  ('OPS', 'Operations',  'Servers, backups, certificates and on-call.',                    5, 3, 'whsec_ops_demo', '2026-10-01T08:00:00Z');

-- Users: 1 Alice, 2 Bob, 3 Carol, 4 Dave.  Projects: 1 TRK, 2 OPS.
-- TRK has 2 issues In Progress (WIP limit 3), so one more can start.
INSERT INTO issues (project_id, number, title, description, type, status, priority, assignee_id, reporter_id, points, due_date, resolved_at, created_at, updated_at) VALUES
  (1, 1, 'Set up CI pipeline',
      E'Run lint, type check and tests on every push.\n\nUse the same Node version as production.',
      'task', 'todo', 'high', 2, 1, 3, NULL, NULL, '2026-10-05T09:00:00Z', '2026-10-05T09:00:00Z'),
  (1, 2, 'Login page shows the wrong error message',
      E'Entering a wrong password says **Server error** instead of "Invalid email or password".',
      'bug', 'todo', 'highest', 3, 2, 2, NULL, NULL, '2026-10-06T10:15:00Z', '2026-10-06T10:15:00Z'),
  (1, 3, 'Add password reset to the login flow',
      E'Users who forget their password are stuck. Add a **password reset** link to the sign-in page that emails a one-time link.\n\n- The link expires after 1 hour\n- It works for every role',
      'story', 'in_progress', 'high', 2, 1, 5, NULL, NULL, '2026-10-07T08:30:00Z', '2026-10-20T14:00:00Z'),
  (1, 4, 'Drag and drop cards on the board',
      E'Moving a card with the select works, but people expect to *drag* cards between columns.',
      'story', 'todo', 'medium', NULL, 3, 8, '2026-11-10', NULL, '2026-10-08T11:00:00Z', '2026-10-08T11:00:00Z'),
  (1, 5, 'Nightly database backups',
      E'Back up the production database every night and keep 14 days.',
      'task', 'done', 'medium', 1, 1, 2, '2026-10-20', '2026-10-19T16:45:00Z', '2026-10-09T09:20:00Z', '2026-10-19T16:45:00Z'),
  (1, 6, 'Typo on the settings page',
      E'"Notifcations" should be "Notifications".',
      'bug', 'done', 'low', 3, 4, 1, NULL, '2026-10-14T10:00:00Z', '2026-10-12T13:00:00Z', '2026-10-14T10:00:00Z'),
  (1, 7, 'Rate limit the public API',
      E'Limit each session to 100 requests per minute and return **429** above that.',
      'story', 'in_review', 'high', 2, 1, 5, NULL, NULL, '2026-10-13T08:00:00Z', '2026-10-28T17:30:00Z'),
  (1, 8, 'Dark mode',
      E'Follow the operating system setting, with a manual switch in the user menu.',
      'story', 'todo', 'low', NULL, 3, 3, NULL, NULL, '2026-10-14T15:10:00Z', '2026-10-14T15:10:00Z'),
  (1, 9, 'Email notifications for mentions',
      E'When someone writes @name in a comment, send that person an email with a link to the issue.',
      'story', 'in_progress', 'medium', 3, 1, 5, NULL, NULL, '2026-10-15T09:45:00Z', '2026-10-27T11:00:00Z'),
  (1, 10, 'Search is slow on large projects',
      E'Searching a project with 5,000 issues takes 4 seconds. Add an index or full-text search.',
      'bug', 'todo', 'high', 1, 2, 3, '2026-10-30', NULL, '2026-10-19T12:00:00Z', '2026-10-19T12:00:00Z'),
  (1, 11, 'Write the onboarding guide',
      E'A one-page guide for new team members: sign in, find your project, move your first card.',
      'task', 'todo', 'lowest', NULL, 1, NULL, NULL, NULL, '2026-10-21T10:30:00Z', '2026-10-21T10:30:00Z'),
  (1, 12, 'Remember me checkbox on login',
      E'Keep people signed in for 30 days when they tick **Remember me**.',
      'story', 'in_review', 'medium', 3, 2, 2, NULL, NULL, '2026-10-22T14:20:00Z', '2026-10-29T09:10:00Z'),
  (2, 1, 'Rotate TLS certificates',
      E'The certificate for api.trackly.test expires on Nov 20.',
      'task', 'todo', 'high', 1, 1, 2, '2026-11-15', NULL, '2026-10-10T08:00:00Z', '2026-10-10T08:00:00Z'),
  (2, 2, 'Upgrade Postgres to version 17',
      E'Test the upgrade on staging first and write down the rollback steps.',
      'task', 'in_progress', 'medium', 2, 1, 5, NULL, NULL, '2026-10-11T09:00:00Z', '2026-10-26T10:00:00Z'),
  (2, 3, 'On-call rotation for December',
      E'Two people per week, swap requests in the team channel.',
      'task', 'done', 'low', 3, 1, 1, NULL, '2026-10-23T15:00:00Z', '2026-10-16T13:30:00Z', '2026-10-23T15:00:00Z'),
  (2, 4, 'Disk usage alert on the build server',
      E'Alert at 80% full. The build server ran out of disk twice last month.',
      'bug', 'todo', 'medium', NULL, 2, 2, NULL, NULL, '2026-10-24T11:45:00Z', '2026-10-24T11:45:00Z');

INSERT INTO labels (project_id, name) VALUES
  (1, 'frontend'), (1, 'backend'), (1, 'security'), (2, 'infra');

-- Labels: 1 frontend, 2 backend, 3 security (TRK), 4 infra (OPS). Issue ids follow the insert order above.
INSERT INTO issue_labels (issue_id, label_id) VALUES
  (1, 2),
  (2, 1),
  (3, 1), (3, 2), (3, 3),
  (4, 1),
  (5, 2),
  (6, 1),
  (7, 2), (7, 3),
  (8, 1),
  (9, 2),
  (10, 2),
  (12, 1),
  (13, 4), (14, 4), (16, 4);

INSERT INTO comments (issue_id, author_id, body, created_at) VALUES
  (3, 2, E'I will reuse the email sender from the notifications work. @carol can you review?', '2026-10-20T14:05:00Z'),
  (7, 3, E'Looks good. Can we make the limit a setting?', '2026-10-28T18:00:00Z');

-- Every issue starts with a 'created' entry in its activity log.
INSERT INTO activity (issue_id, actor_id, kind, created_at)
SELECT id, reporter_id, 'created', created_at FROM issues ORDER BY id;
