"use client";

import { useState } from "react";

type Props = { issueKey: string; labels: string[]; canEdit: boolean };

// Label chips on the issue page (S18). Enter in the input adds a label; the server lowercases and dedupes.
export function IssueLabels({ issueKey, labels: initial, canEdit }: Props) {
  const [labels, setLabels] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    const r = await fetch(`/api/issues/${issueKey}/labels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      setError(body?.error ?? "Could not add the label");
      return;
    }
    setError(null);
    // Merge rather than replace, so a slower earlier response can't drop a label added after it.
    setLabels((prev) => [...new Set([...prev, ...(body.labels as string[])])].sort());
  }

  return (
    <div>
      <dt className="text-zinc-500">Labels</dt>
      <dd className="mt-1 flex flex-wrap gap-1">
        {labels.length === 0 && !canEdit && <span className="font-medium text-zinc-900">None</span>}
        {labels.map((l) => (
          <span
            key={l}
            data-testid="label-chip"
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
          >
            {l}
          </span>
        ))}
      </dd>
      {canEdit && (
        <input
          aria-label="Add label"
          data-testid="label-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={add}
          placeholder="Add label…"
          className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
