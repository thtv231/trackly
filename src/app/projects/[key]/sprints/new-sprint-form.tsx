"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const field =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const label = "mb-1 block text-sm font-medium text-zinc-700";

export function NewSprintForm({ projectKey }: { projectKey: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const r = await fetch(`/api/projects/${projectKey}/sprints`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, start, end }),
    });
    const body = await r.json().catch(() => null);
    setSending(false);
    if (r.status !== 201) {
      setError(body?.error ?? "Could not create the sprint");
      return;
    }
    setName("");
    setStart("");
    setEnd("");
    router.refresh();
  }

  // No `required` or min/max on the inputs: the server's message must show in form-error (S23).
  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="mb-4 font-display text-lg font-semibold text-brand-strong">New sprint</h2>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="sprint-name" className={label}>
            Name
          </label>
          <input
            id="sprint-name"
            data-testid="sprint-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="sprint-start" className={label}>
            Start
          </label>
          <input
            id="sprint-start"
            data-testid="sprint-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="sprint-end" className={label}>
            End
          </label>
          <input
            id="sprint-end"
            data-testid="sprint-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={field}
          />
        </div>
        <button
          type="submit"
          data-testid="sprint-create"
          disabled={sending}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {sending ? "Creating…" : "Create sprint"}
        </button>
      </div>
      {error && (
        <p data-testid="form-error" role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
