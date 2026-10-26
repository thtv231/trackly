import { logActivity } from "./activity";
import type { User } from "./auth";
import { now } from "./clock";
import { transaction } from "./db";
import { STATUSES, TRANSITIONS, type Status } from "./domain";
import { parseIssueKey } from "./issues";

// Moving an issue between statuses (S11), with the WIP limit (S13), resolvedAt (S14) and the activity log (S21).

export type TransitionResult = { status: 200 } | { status: 400 | 404 | 409; error: string };

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export async function transitionIssue(key: string, to: unknown, actor: User): Promise<TransitionResult> {
  const parsed = parseIssueKey(key);
  if (!parsed) return { status: 404, error: "Issue not found" };
  if (!STATUSES.includes(to as Status)) return { status: 400, error: `Status must be one of ${STATUSES.join(", ")}` };

  const at = await now();
  return transaction(async (q) => {
    // Locking the project row serializes moves within a project, so two moves can't both take the last WIP slot.
    const [issue] = await q<{ id: number; status: Status; project_id: number; wip_limit: number }>(
      `SELECT i.id, i.status, p.id AS project_id, p.wip_limit
         FROM projects p JOIN issues i ON i.project_id = p.id
        WHERE p.key = $1 AND i.number = $2
          FOR UPDATE OF p`,
      [parsed.projectKey, parsed.number],
    );
    if (!issue) return { status: 404, error: "Issue not found" };
    if (!canTransition(issue.status, to as Status)) return { status: 409, error: "Transition not allowed" };
    if (to === "in_progress") {
      const [{ n }] = await q<{ n: number }>(
        "SELECT count(*)::int AS n FROM issues WHERE project_id = $1 AND status = 'in_progress'",
        [issue.project_id],
      );
      if (n >= issue.wip_limit) return { status: 409, error: "WIP limit reached" };
    }
    // Done stamps the resolution time; any other status (a reopen) clears it.
    await q("UPDATE issues SET status = $1, updated_at = $2, resolved_at = $3 WHERE id = $4", [
      to,
      at,
      to === "done" ? at : null,
      issue.id,
    ]);
    await logActivity(q, issue.id, actor.id, "status", at, issue.status, to as Status);
    return { status: 200 };
  });
}
