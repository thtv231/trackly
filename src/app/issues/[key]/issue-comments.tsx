"use client";

import { useState } from "react";
import type { Comment } from "@/app/api/issues/[key]/comments/route";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown";

type Props = { issueKey: string; comments: Comment[]; canComment: boolean };

// Comment thread on the issue page (S19), oldest first. New comments are appended once the server accepts them.
export function IssueComments({ issueKey, comments: initial, canComment }: Props) {
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const r = await fetch(`/api/issues/${issueKey}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error ?? "Could not add the comment");
        return;
      }
      setError(null);
      setDraft("");
      setComments((prev) => [...prev, body.comment as Comment]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-zinc-500">Comments</h2>
      {comments.length === 0 && <p className="mb-3 text-sm text-zinc-500">No comments yet.</p>}
      <ul className="mb-4 space-y-3">
        {comments.map((c) => (
          <li key={c.id} data-testid="comment" className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
            <div className="mb-1 flex items-baseline gap-2 text-xs">
              <span className="font-semibold text-zinc-900">{c.author}</span>
              <span className="text-zinc-500">{formatDate(c.created_at)}</span>
            </div>
            <div className="text-sm text-zinc-800">
              <Markdown text={c.body} />
            </div>
          </li>
        ))}
      </ul>
      {canComment && (
        // Not a <form>: this sits inside IssueDetails' edit form, and forms can't nest.
        <div className="space-y-2">
          <textarea
            aria-label="Add a comment"
            data-testid="comment-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a comment…"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {error && (
            <p data-testid="form-error" role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            data-testid="comment-submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Comment
          </button>
        </div>
      )}
    </section>
  );
}
