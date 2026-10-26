"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIORITY_LABEL, STATUSES, STATUS_LABEL, TRANSITIONS, type Priority, type Status } from "@/lib/domain";

export type BoardCard = { key: string; number: number; title: string; status: Status; priority: Priority; assignee: string | null };

type Props = { cards: BoardCard[]; canMove: boolean };

export function Board({ cards: initial, canMove }: Props) {
  const [cards, setCards] = useState(initial);
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
              className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-3"
            >
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                {STATUS_LABEL[status]}
                <span data-testid="column-count" className="rounded-full bg-zinc-200 px-2 text-xs text-zinc-700">
                  {column.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {column.map((c) => (
                  <li
                    key={c.key}
                    data-testid="board-card"
                    data-key={c.key}
                    className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <Link href={`/issues/${c.key}`} className="font-mono text-xs font-semibold text-indigo-600 hover:underline">
                      {c.key}
                    </Link>
                    <p className="mt-1 text-zinc-900">{c.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-600">
                      <span>{PRIORITY_LABEL[c.priority]}</span>
                      <span>{c.assignee ?? "Unassigned"}</span>
                    </div>
                    {canMove && (
                      <select
                        data-testid="card-move"
                        aria-label={`Move ${c.key}`}
                        value=""
                        disabled={moving === c.key}
                        onChange={(e) => move(c.key, e.target.value as Status)}
                        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
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
