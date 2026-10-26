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
  isOverdue,
  type IssueType,
  type Priority,
  type Status,
} from "@/lib/domain";
import { OverdueBadge, PriorityMark, StatusBadge } from "./badges";

export type IssueRow = {
  key: string;
  title: string;
  status: Status;
  priority: Priority;
  type: IssueType;
  assignee: string | null;
  dueDate: string | null;
};

/** "" means no filter on that field. */
export type Filters = {
  status: Status | "";
  priority: Priority | "";
  type: IssueType | "";
};

/** `today` is the app clock's UTC date ('YYYY-MM-DD'), for the overdue badge. */
type Props = { issues: IssueRow[]; initialFilters: Filters; today: string };

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

export function IssueTable({ issues, initialFilters, today }: Props) {
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

  // Narrow screens drop the assignee column and the priority word so the
  // table fits 375 px without scrolling sideways.
  const cell = "px-3 py-3 sm:px-4";
  const field =
    "rounded-lg border border-line bg-panel px-3 py-2 text-sm shadow-sm transition-colors duration-200 hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none";

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
          className={`w-full max-w-sm ${field}`}
        />
        {SELECTS.map((f) => (
          <select
            key={f.name}
            value={filters[f.name]}
            onChange={(e) => setFilter(f.name, e.target.value)}
            aria-label={`Filter by ${f.label.toLowerCase()}`}
            data-testid={`filter-${f.name}`}
            className={`${field} ${filters[f.name] ? "border-brand bg-brand-soft text-brand-strong" : ""}`}
          >
            <option value="">All {f.label.toLowerCase()}</option>
            {f.codes.map((c) => (
              <option key={c} value={c}>
                {f.labels[c]}
              </option>
            ))}
          </select>
        ))}
        <span className="ml-auto self-center text-sm text-ink-muted">
          {shown.length} of {issues.length} issues
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(14_79_71/0.18)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface/60 text-xs tracking-wider text-ink-muted uppercase">
            <tr>
              <th className={`${cell} font-semibold`}>Key</th>
              <th className={`${cell} font-semibold`}>Title</th>
              <th className={`${cell} font-semibold`}>Status</th>
              <th className={`${cell} font-semibold`}>
                <span className="sr-only sm:not-sr-only">Priority</span>
              </th>
              <th className={`hidden sm:table-cell ${cell} font-semibold`}>Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {shown.map((i) => (
              <tr
                key={i.key}
                data-testid="issue-row"
                className="group transition-colors duration-150 hover:bg-brand-soft/50"
              >
                <td className={`border-l-2 border-transparent ${cell} font-mono text-xs whitespace-nowrap transition-colors duration-150 group-hover:border-accent`}>
                  <Link
                    href={`/issues/${i.key}`}
                    data-testid="issue-key"
                    className="font-semibold text-brand hover:text-accent"
                  >
                    {i.key}
                  </Link>
                  {isOverdue(i.status, i.dueDate, today) && i.dueDate && (
                    <div className="mt-1 font-sans">
                      <OverdueBadge dueDate={i.dueDate} />
                    </div>
                  )}
                </td>
                <td
                  data-testid="issue-title"
                  className={`${cell} font-medium break-words text-ink`}
                >
                  {i.title}
                </td>
                <td
                  data-testid="issue-status"
                  className={`${cell} whitespace-nowrap`}
                >
                  <StatusBadge status={i.status} />
                </td>
                <td
                  data-testid="issue-priority"
                  className={`${cell} whitespace-nowrap text-ink-muted`}
                >
                  <span className="inline-flex items-center gap-2">
                    <PriorityMark priority={i.priority} />
                    <span className="sr-only sm:not-sr-only">
                      {PRIORITY_LABEL[i.priority]}
                    </span>
                  </span>
                </td>
                <td
                  data-testid="issue-assignee"
                  className={`hidden sm:table-cell ${cell} whitespace-nowrap ${i.assignee ? "text-ink" : "text-ink-muted italic"}`}
                >
                  {i.assignee ?? "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">
            No issues match your search or filters.
          </p>
        )}
      </div>
    </>
  );
}
