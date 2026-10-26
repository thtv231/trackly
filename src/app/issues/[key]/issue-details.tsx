"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { POINTS, PRIORITIES, PRIORITY_LABEL, type Priority } from "@/lib/domain";

export type Field = { label: string; testId: string; value: string; edit?: "priority" | "assignee" | "points" };
type Values = { title: string; priority: Priority; assignee: string; points: string }; // assignee: email or ""

type Props = {
  issueKey: string;
  canEdit: boolean;
  fields: Field[];
  values: Values;
  assignees: { email: string; name: string }[];
  children: React.ReactNode;
};

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

// Title and sidebar of the issue page (S07). Edit swaps the title and the Priority, Assignee and Points
// values for inputs in place; Save sends a PATCH and re-renders the page with the saved values.
export function IssueDetails({ issueKey, canEdit, fields, values, assignees, children }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const set = (patch: Partial<Values>) => setDraft((d) => ({ ...d, ...patch }));

  function startEditing() {
    setDraft(values);
    setError(null);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch(`/api/issues/${issueKey}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        priority: draft.priority,
        assignee: draft.assignee || null,
        points: draft.points === "" ? null : Number(draft.points),
      }),
    });
    const body = await r.json().catch(() => null);
    setSaving(false);
    if (!r.ok) {
      setError(body?.error ?? "Could not save the issue");
      return;
    }
    // Leave edit mode in the same transition as the refresh, so the old values never flash back.
    startTransition(() => {
      router.refresh();
      setEditing(false);
    });
  }

  function editor(kind: NonNullable<Field["edit"]>) {
    if (kind === "priority") {
      return (
        <select
          aria-label="Priority"
          data-testid="edit-priority"
          value={draft.priority}
          onChange={(e) => set({ priority: e.target.value as Priority })}
          className={input}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      );
    }
    if (kind === "assignee") {
      return (
        <select
          aria-label="Assignee"
          data-testid="edit-assignee"
          value={draft.assignee}
          onChange={(e) => set({ assignee: e.target.value })}
          className={input}
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.email} value={a.email}>
              {a.name}
            </option>
          ))}
        </select>
      );
    }
    return (
      <select
        aria-label="Points"
        data-testid="edit-points"
        value={draft.points}
        onChange={(e) => set({ points: e.target.value })}
        className={input}
      >
        <option value="">None</option>
        {POINTS.map((p) => (
          <option key={p} value={String(p)}>
            {p}
          </option>
        ))}
      </select>
    );
  }

  const button = "rounded-md px-3 py-1.5 text-sm font-medium";
  return (
    <form onSubmit={save}>
      <div className="mb-6 flex items-start justify-between gap-4">
        {editing ? (
          <input
            aria-label="Title"
            data-testid="edit-title"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            className={`${input} text-2xl font-bold`}
            autoFocus
          />
        ) : (
          <h1 data-testid="issue-title" className="text-2xl font-bold">
            {values.title}
          </h1>
        )}
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={`${button} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="issue-save"
                  disabled={saving}
                  className={`${button} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="issue-edit"
                onClick={startEditing}
                className={`${button} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p data-testid="form-error" role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        {children}
        <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <dl className="space-y-3 text-sm">
            {fields.map((f) => (
              <div key={f.testId}>
                <dt className="text-zinc-500">{f.label}</dt>
                {editing && f.edit ? (
                  <dd className="mt-1">{editor(f.edit)}</dd>
                ) : (
                  <dd data-testid={f.testId} className="font-medium text-zinc-900">
                    {f.value}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </form>
  );
}
