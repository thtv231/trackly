"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Starts a planned sprint; shows the API's error (e.g. another sprint is active) inline. */
export function StartSprintButton({ sprintId }: { sprintId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/sprints/${sprintId}/start`, { method: "POST" });
    const body = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) {
      setError(body?.error ?? "Could not start the sprint");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="sprint-start-btn"
        disabled={busy}
        onClick={start}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60"
      >
        Start sprint
      </button>
      {error && (
        <p
          role="alert"
          data-testid="sprint-error"
          className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
