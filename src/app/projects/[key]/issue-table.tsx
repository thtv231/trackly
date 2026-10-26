"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  TYPES,
  TYPE_LABEL,
  type IssueType,
  type Priority,
  type Status,
} from "@/lib/domain";

export type IssueRow = {
  key: string;
  title: string;
  status: Status;
  priority: Priority;
  type: IssueType;
  assignee: string | null;
};

/** "" means no filter on that field. */
export type Filters = {
  status: Status | "";
  priority: Priority | "";
  type: IssueType | "";
};

type Props = { issues: IssueRow[]; initialFilters: Filters };

const SELECTS = [
  {
    name: "status",
    label: "Status",
    codes: STATUSES,
    labels: STATUS_LABEL as Record<string, string>,
  },
  {
    name: "priority",
    label: "Priority",
    codes: PRIORITIES,
    labels: PRIORITY_LABEL as Record<string, string>,
  },
  {
    name: "type",
    label: "Type",
    codes: TYPES,
    labels: TYPE_LABEL as Record<string, string>,
  },
] as const;

export function IssueTable({ issues, initialFilters }: Props) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(initialFilters);

  function setFilter(name: keyof Filters, value: string) {
    const next = { ...filters, [name]: value } as Filters;
    setFilters(next);
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(next)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    window.history.replaceState(null, "", url);
  }

  const needle = search.trim().toLowerCase();
  const shown = issues.filter(
    (i) =>
      (!filters.status || i.status === filters.status) &&
      (!filters.priority || i.priority === filters.priority) &&
      (!filters.type || i.type === filters.type) &&
      (!needle ||
        i.key.toLowerCase().includes(needle) ||
        i.title.toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or key"
          aria-label="Search issues"
          data-testid="issue-search"
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {SELECTS.map((f) => (
          <select
            key={f.name}
            value={filters[f.name]}
            onChange={(e) => setFilter(f.name, e.target.value)}
            aria-label={`Filter by ${f.label.toLowerCase()}`}
            data-testid={`filter-${f.name}`}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All {f.label.toLowerCase()}</option>
            {f.codes.map((c) => (
              <option key={c} value={c}>
                {f.labels[c]}
              </option>
            ))}
          </select>
        ))}
      </div>
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
              <tr
                key={i.key}
                data-testid="issue-row"
                className="hover:bg-zinc-50"
              >
                <td className="px-4 py-2 font-mono whitespace-nowrap">
                  <Link
                    href={`/issues/${i.key}`}
                    data-testid="issue-key"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    {i.key}
                  </Link>
                </td>
                <td
                  data-testid="issue-title"
                  className="px-4 py-2 text-zinc-900"
                >
                  {i.title}
                </td>
                <td
                  data-testid="issue-status"
                  className="px-4 py-2 whitespace-nowrap"
                >
                  {STATUS_LABEL[i.status]}
                </td>
                <td
                  data-testid="issue-priority"
                  className="px-4 py-2 whitespace-nowrap"
                >
                  {PRIORITY_LABEL[i.priority]}
                </td>
                <td
                  data-testid="issue-assignee"
                  className="px-4 py-2 whitespace-nowrap text-zinc-700"
                >
                  {i.assignee ?? "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-3 text-sm text-zinc-600">
            No issues match your search or filters.
          </p>
        )}
      </div>
    </>
  );
}
