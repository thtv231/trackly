import Link from "next/link";
import { PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Priority, type Status } from "@/lib/domain";

export type BoardCard = { key: string; number: number; title: string; status: Status; priority: Priority; assignee: string | null };

type Props = { cards: BoardCard[] };

export function Board({ cards }: Props) {
  return (
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
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">{STATUS_LABEL[status]}</h2>
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
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
