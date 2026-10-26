import { query, type Query } from "./db";

// Notifications (S32): a user is notified when someone else assigns an issue to them or @mentions their handle
// in a comment. Acting on yourself never notifies you.

export type NotificationKind = "assigned" | "mentioned";

/** Handles written as `@handle` in a text, lowercased and without duplicates. */
export function mentionedHandles(text: string): string[] {
  const handles = new Set<string>();
  for (const m of text.matchAll(/(?<![\w@.])@([a-z0-9_-]+)/gi)) handles.add(m[1].toLowerCase());
  return [...handles];
}

export async function notifyAssigned(q: Query, issueId: number, userId: number, actor: { id: number; name: string }, issueKey: string, at: Date) {
  if (userId === actor.id) return;
  await q(
    "INSERT INTO notifications (user_id, issue_id, kind, message, created_at) VALUES ($1, $2, 'assigned', $3, $4)",
    [userId, issueId, `${actor.name} assigned ${issueKey} to you`, at],
  );
}

export async function notifyMentioned(q: Query, issueId: number, body: string, actor: { id: number; name: string }, issueKey: string, at: Date) {
  const handles = mentionedHandles(body);
  if (handles.length === 0) return;
  await q(
    `INSERT INTO notifications (user_id, issue_id, kind, message, created_at)
     SELECT id, $2, 'mentioned', $3, $4 FROM users WHERE handle = ANY($1::text[]) AND id <> $5`,
    [handles, issueId, `${actor.name} mentioned you on ${issueKey}`, at, actor.id],
  );
}

export async function unreadCount(userId: number): Promise<number> {
  const [row] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId],
  );
  return row.n;
}

export type NotificationItem = { id: number; kind: NotificationKind; message: string; issueKey: string | null; read: boolean; createdAt: Date };

export async function userNotifications(userId: number): Promise<NotificationItem[]> {
  const rows = await query<{ id: number; kind: NotificationKind; message: string; issue_key: string | null; read_at: Date | null; created_at: Date }>(
    `SELECT n.id, n.kind, n.message, p.key || '-' || i.number AS issue_key, n.read_at, n.created_at
       FROM notifications n
       LEFT JOIN issues i ON i.id = n.issue_id
       LEFT JOIN projects p ON p.id = i.project_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC, n.id DESC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, message: r.message, issueKey: r.issue_key, read: r.read_at !== null, createdAt: r.created_at }));
}

export async function markAllRead(userId: number, at: Date): Promise<void> {
  await query("UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL", [userId, at]);
}
