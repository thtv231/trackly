"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function markRead() {
    setBusy(true);
    await fetch("/api/notifications/read", { method: "POST" });
    setBusy(false);
    router.refresh();
  }
  return (
    <button
      type="button"
      data-testid="notifications-read"
      onClick={markRead}
      disabled={disabled || busy}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
    >
      Mark all as read
    </button>
  );
}
