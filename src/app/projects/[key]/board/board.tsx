"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIORITY_LABEL, STATUSES, STATUS_LABEL, TRANSITIONS, type Priority, type Status } from "@/lib/domain";
import { PriorityMark, STATUS_TONE } from "../badges";

export type BoardCard = { key: string; number: number; title: string; status: Status; priority: Priority; assignee: string | null };

type Props = { cards: BoardCard[]; canMove: boolean };

export function Board({ cards: initial, canMove }: Props) {
  const [cards, setCards] = useState(initial);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  async function move(key: string, to: Status) {
    setMoving(key);
    setError(null);
    const r = await fetch(`/api/issues/${key}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to }),
    });
    setMoving(null);
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      setError(body?.error ?? "Could not move the issue");
      return;
    }
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, status: to } : c)));
    setLanded(key);
  }

  return (
    <>
      {error && (
        <p
          data-testid="wip-error"
          role="alert"
          className="animate-card-in mb-4 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {STATUSES.map((status) => {
          const column = cards.filter((c) => c.status === status);
          return (
            <section
              key={status}
              data-testid="board-column"
              data-status={status}
              className={`flex flex-col rounded-2xl border border-t-4 border-line bg-panel/60 p-3 backdrop-blur-sm ${STATUS_TONE[status].bar}`}
            >
              <h2 className="mb-3 flex items-center justify-between px-1 font-display text-sm font-semibold tracking-tight text-ink">
                {STATUS_LABEL[status]}
                <span
                  data-testid="column-count"
                  className="min-w-6 rounded-full bg-panel px-2 py-0.5 text-center font-mono text-xs text-ink-muted ring-1 ring-line"
                >
                  {column.length}
                </span>
              </h2>
              <ul className="min-h-16 space-y-2.5">
                {column.map((c) => (
                  <li
                    key={c.key}
                    data-testid="board-card"
                    data-key={c.key}
                    className={`rounded-xl border border-line bg-panel p-3 text-sm shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md ${
                      landed === c.key ? "animate-card-in ring-2 ring-accent/40" : ""
                    } ${moving === c.key ? "opacity-60" : ""}`}
                  >
                    <Link
                      href={`/issues/${c.key}`}
                      className="font-mono text-xs font-semibold text-brand transition-colors hover:text-accent"
                    >
                      {c.key}
                    </Link>
                    <p className="mt-1 leading-snug font-medium text-ink">{c.title}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <PriorityMark priority={c.priority} />
                        {PRIORITY_LABEL[c.priority]}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {c.assignee && (
                          <span
                            className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-semibold text-white"
                            aria-hidden
                          >
                            {c.assignee[0]}
                          </span>
                        )}
                        <span className={c.assignee ? "" : "italic"}>{c.assignee ?? "Unassigned"}</span>
                      </span>
                    </div>
                    {canMove && (
                      <select
                        data-testid="card-move"
                        aria-label={`Move ${c.key}`}
                        value=""
                        disabled={moving === c.key}
                        onChange={(e) => move(c.key, e.target.value as Status)}
                        className="mt-3 w-full cursor-pointer rounded-lg border border-line bg-surface/60 px-2 py-1 text-xs text-ink-muted transition-colors duration-150 hover:border-brand/40 hover:text-ink focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
                      >
                        <option value="">Move to…</option>
                        {TRANSITIONS[c.status].map((to) => (
                          <option key={to} value={to}>
                            {STATUS_LABEL[to]}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
