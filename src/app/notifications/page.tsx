import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { userNotifications } from "@/lib/notifications";
import { MarkReadButton } from "./mark-read-button";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await userNotifications(user.id);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
        <MarkReadButton disabled={unread === 0} />
      </div>
      {items.length === 0 ? (
        <p className="text-zinc-500">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {items.map((n) => (
            <li
              key={n.id}
              data-testid="notification-item"
              className={`flex items-center justify-between gap-4 px-4 py-3 ${n.read ? "text-zinc-500" : "font-medium"}`}
            >
              <span className="flex items-center gap-2">
                {!n.read && <span className="inline-block h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread" />}
                {n.issueKey ? (
                  <Link href={`/issues/${n.issueKey}`} className="hover:text-indigo-600">
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
              </span>
              <span className="shrink-0 text-sm text-zinc-500">{formatDate(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
