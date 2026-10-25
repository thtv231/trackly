-- Trackly: Postgres schema (runs on PGlite in dev/test and on a real Postgres when DATABASE_URL is set).
-- Every timestamp is timestamptz in UTC. The app passes "now" from src/lib/clock.ts, so tests can fake the time.

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  handle        text NOT NULL UNIQUE,              -- used for @mentions, e.g. 'bob'
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  password_hash text NOT NULL,                     -- 'scrypt$<salt hex>$<hash hex>'
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  user_id     int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id              serial PRIMARY KEY,
  key             text NOT NULL UNIQUE CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  next_number     int  NOT NULL DEFAULT 1,         -- number the next new issue gets; never goes down
  wip_limit       int  NOT NULL DEFAULT 3,         -- max issues In Progress at once
  webhook_url     text,                            -- where deliveries would be POSTed (optional)
  webhook_secret  text NOT NULL,                   -- HMAC-SHA256 key for X-Trackly-Signature
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issues (
  id           serial PRIMARY KEY,
  project_id   int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number       int  NOT NULL,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  type         text NOT NULL CHECK (type IN ('task', 'bug', 'story')),
  status       text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  priority     text NOT NULL CHECK (priority IN ('highest', 'high', 'medium', 'low', 'lowest')),
  assignee_id  int REFERENCES users(id) ON DELETE SET NULL,
  reporter_id  int NOT NULL REFERENCES users(id),
  points       int CHECK (points IN (0, 1, 2, 3, 5, 8, 13)),
  due_date     date,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

CREATE TABLE IF NOT EXISTS labels (
  id          serial PRIMARY KEY,
  project_id  int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (name = lower(name)),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS issue_labels (
  issue_id  int NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id  int NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id          serial PRIMARY KEY,
  issue_id    int  NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id   int  NOT NULL REFERENCES users(id),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per event on an issue: 'created', or a change of 'status' | 'assignee' | 'priority'.
CREATE TABLE IF NOT EXISTS activity (
  id          serial PRIMARY KEY,
  issue_id    int  NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_id    int  NOT NULL REFERENCES users(id),
  kind        text NOT NULL,                       -- 'created' | 'status' | 'assignee' | 'priority'
  from_value  text,
  to_value    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sprints (
  id                serial PRIMARY KEY,
  project_id        int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              text NOT NULL,
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  state             text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned', 'active', 'completed')),
  started_at        timestamptz,
  completed_at      timestamptz,
  -- filled in when the sprint is completed
  completed_issues  int,
  total_issues      int,
  completed_points  int,
  total_points      int,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS sprint_issues (
  sprint_id  int NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  issue_id   int NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sprint_id, issue_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          serial PRIMARY KEY,
  user_id     int  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_id    int  REFERENCES issues(id) ON DELETE CASCADE,
  kind        text NOT NULL,                       -- 'assigned' | 'mentioned'
  message     text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Outbox of webhook deliveries: the app writes a row in the same request as the change,
-- a worker (or the test endpoint /api/test/outbox) reads them later.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            serial PRIMARY KEY,
  project_id    int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event         text NOT NULL,                     -- e.g. 'issue.status_changed'
  body          text NOT NULL,                     -- exact JSON body that is signed and sent
  signature     text NOT NULL,                     -- X-Trackly-Signature header value
  created_at    timestamptz NOT NULL DEFAULT now(),
  delivered_at  timestamptz,
  attempts      int NOT NULL DEFAULT 0
);

-- Assistant (group F): a write tool call waiting for the user to confirm or cancel it.
-- `state` holds the conversation so far and the tool calls still to run, so the loop can continue
-- in the confirm request. Rows are single-use.
CREATE TABLE IF NOT EXISTS assistant_pending (
  id          text PRIMARY KEY,
  user_id     int  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  int  NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  state       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Key/value settings. Under test (TRACKLY_TEST=1): 'fake_now', the assistant script and log.
CREATE TABLE IF NOT EXISTS settings (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

CREATE INDEX IF NOT EXISTS issues_project_status ON issues (project_id, status);
CREATE INDEX IF NOT EXISTS activity_issue ON activity (issue_id, created_at);
CREATE INDEX IF NOT EXISTS comments_issue ON comments (issue_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, read_at);
