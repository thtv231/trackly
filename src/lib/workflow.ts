import { now } from "./clock";
import { query } from "./db";
import { STATUSES, TRANSITIONS, type Status } from "./domain";
import { parseIssueKey } from "./issues";

// Moving an issue between statuses (S11). WIP limit (S13), resolvedAt (S14) and activity (S21) come later.

export type TransitionResult = { status: 200 } | { status: 400 | 404 | 409; error: string };

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export async function transitionIssue(key: string, to: unknown): Promise<TransitionResult> {
  const parsed = parseIssueKey(key);
  if (!parsed) return { status: 404, error: "Issue not found" };
  if (!STATUSES.includes(to as Status)) return { status: 400, error: `Status must be one of ${STATUSES.join(", ")}` };

  const [issue] = await query<{ id: number; status: Status }>(
    `SELECT i.id, i.status FROM issues i JOIN projects p ON p.id = i.project_id
      WHERE p.key = $1 AND i.number = $2`,
    [parsed.projectKey, parsed.number],
  );
  if (!issue) return { status: 404, error: "Issue not found" };
  if (!canTransition(issue.status, to as Status)) return { status: 409, error: "Transition not allowed" };

  // The status in WHERE makes a concurrent move of the same issue fail instead of skipping the workflow.
  const moved = await query(
    "UPDATE issues SET status = $1, updated_at = $2 WHERE id = $3 AND status = $4 RETURNING id",
    [to, await now(), issue.id, issue.status],
  );
  if (moved.length === 0) return { status: 409, error: "Transition not allowed" };
  return { status: 200 };
}
