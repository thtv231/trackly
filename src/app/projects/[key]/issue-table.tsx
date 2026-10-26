"use client";

import Link from "next/link";
import { useState } from "react";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from "@/lib/domain";

export type IssueRow = { key: string; title: string; status: Status; priority: Priority; assignee: string | null };

type Props = { issues: IssueRow[] };

export function IssueTable({ issues }: Props) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? issues.filter((i) => i.key.toLowerCase().includes(needle) || i.title.toLowerCase().includes(needle))
    : issues;

  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title or key"
        aria-label="Search issues"
        data-testid="issue-search"
        className="mb-4 w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-2 font-medium">Key</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {shown.map((i) => (
              <tr key={i.key} data-testid="issue-row" className="hover:bg-zinc-50">
                <td className="px-4 py-2 font-mono whitespace-nowrap">
                  <Link
                    href={`/issues/${i.key}`}
                    data-testid="issue-key"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    {i.key}
                  </Link>
                </td>
                <td data-testid="issue-title" className="px-4 py-2 text-zinc-900">
                  {i.title}
                </td>
                <td data-testid="issue-status" className="px-4 py-2 whitespace-nowrap">
                  {STATUS_LABEL[i.status]}
                </td>
                <td data-testid="issue-priority" className="px-4 py-2 whitespace-nowrap">
                  {PRIORITY_LABEL[i.priority]}
                </td>
                <td data-testid="issue-assignee" className="px-4 py-2 whitespace-nowrap text-zinc-700">
                  {i.assignee ?? "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-4 py-3 text-sm text-zinc-600">No issues match your search.</p>}
      </div>
    </>
  );
}
