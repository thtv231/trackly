"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type BacklogIssue = { key: string; title: string; points: number | null };

/** Backlog rows with an add-to-sprint button; the target is the first open sprint unless the user picks another. */
export function Backlog({
  issues,
  sprints,
  canEdit,
}: {
  issues: BacklogIssue[];
  sprints: { id: number; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<number | null>(sprints[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sprintId = sprints.some((s) => s.id === target) ? target : (sprints[0]?.id ?? null);

  async function add(key: string) {
    if (sprintId === null) return;
    setBusy(key);
    setError(null);
    const r = await fetch(`/api/sprints/${sprintId}/issues`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const body = await r.json().catch(() => null);
    setBusy(null);
    if (!r.ok) {
      setError(body?.error ?? "Could not add the issue");
      return;
    }
    router.refresh();
  }

  return (
    <section className="mb-8 rounded-xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-brand-strong">Backlog</h2>
        {canEdit && sprints.length > 1 && (
          <label className="text-sm text-ink-muted">
            Add to{" "}
            <select
              value={sprintId ?? ""}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="rounded-md border border-line bg-white px-2 py-1"
            >
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {issues.length === 0 ? (
        <p className="text-sm text-ink-muted">The backlog is empty.</p>
      ) : (
        <ul className="divide-y divide-line">
          {issues.map((i) => (
            <li key={i.key} data-testid="backlog-row" data-key={i.key} className="flex items-center gap-3 py-2">
              <a href={`/issues/${i.key}`} className="font-mono text-sm text-ink-muted hover:text-brand">
                {i.key}
              </a>
              <span className="flex-1 truncate">{i.title}</span>
              <span className="text-sm text-ink-muted">{i.points ?? "–"} pts</span>
              {canEdit && sprintId !== null && (
                <button
                  type="button"
                  data-testid="add-to-sprint"
                  disabled={busy !== null}
                  onClick={() => add(i.key)}
                  className="rounded-md border border-line px-2.5 py-1 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-60"
                >
                  Add to sprint
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
