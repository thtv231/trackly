"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRIORITIES, PRIORITY_LABEL, TYPES, TYPE_LABEL, type IssueType, type Priority } from "@/lib/domain";

type Props = {
  projectKey: string;
  assignees: { email: string; name: string }[];
  defaultAssignee: string;
};

const field =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";
const label = "mb-1 block text-sm font-medium text-zinc-700";

export function NewIssueForm({ projectKey, assignees, defaultAssignee }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>("task");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState(defaultAssignee);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const r = await fetch("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectKey, title, type, priority, assignee: assignee || null, description }),
    });
    const body = await r.json().catch(() => null);
    if (r.status !== 201) {
      setSending(false);
      setError(body?.error ?? "Could not create the issue");
      return;
    }
    router.push(`/issues/${body.key}`);
  }

  // No `required` on the title: the server's message must show in form-error (S04).
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="new-title" className={label}>
          Title
        </label>
        <input
          id="new-title"
          data-testid="new-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="new-type" className={label}>
            Type
          </label>
          <select
            id="new-type"
            data-testid="new-type"
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
            className={field}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-priority" className={label}>
            Priority
          </label>
          <select
            id="new-priority"
            data-testid="new-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className={field}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="new-assignee" className={label}>
            Assignee
          </label>
          <select
            id="new-assignee"
            data-testid="new-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={field}
          >
            <option value="">Unassigned</option>
            {assignees.map((a) => (
              <option key={a.email} value={a.email}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="new-description" className={label}>
          Description <span className="font-normal text-zinc-500">(Markdown)</span>
        </label>
        <textarea
          id="new-description"
          data-testid="new-description"
          rows={8}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={field}
        />
      </div>
      {error && (
        <p data-testid="form-error" role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-testid="new-submit"
        disabled={sending}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {sending ? "Creating…" : "Create issue"}
      </button>
    </form>
  );
}
