"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Completes an active sprint; shows the API's error inline. */
export function CompleteSprintButton({ sprintId }: { sprintId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/sprints/${sprintId}/complete`, { method: "POST" });
    const body = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) {
      setError(body?.error ?? "Could not complete the sprint");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="sprint-complete"
        disabled={busy}
        onClick={complete}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-60"
      >
        Complete sprint
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
