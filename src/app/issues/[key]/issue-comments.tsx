"use client";

import { useRef, useState } from "react";
import type { Comment } from "@/app/api/issues/[key]/comments/route";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { useFormError } from "./issue-details";

type Props = { issueKey: string; comments: Comment[]; canComment: boolean };

// Comment thread on the issue page (S19), oldest first. New comments are appended once the server accepts them.
// The list is the server's comments plus the ones added here since, so a router.refresh() still shows new ones.
export function IssueComments({ issueKey, comments: fromServer, canComment }: Props) {
  const [added, setAdded] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const { error, show: showError, clear: clearError } = useFormError("comment");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false); // `saving` only disables the button after a re-render, too late for a double click
  const serverIds = new Set(fromServer.map((c) => c.id));
  const comments = [...fromServer, ...added.filter((c) => !serverIds.has(c.id))];

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    const sent = draft;
    try {
      const r = await fetch(`/api/issues/${issueKey}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: sent }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        showError(body?.error ?? "Could not add the comment");
        return;
      }
      clearError();
      // Keep anything typed while the request was in flight.
      setDraft((d) => (d === sent ? "" : d));
      setAdded((prev) => [...prev, body.comment as Comment]);
    } catch {
      showError("Could not add the comment. Check your connection and try again.");
    } finally {
      inFlight.current = false;
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
