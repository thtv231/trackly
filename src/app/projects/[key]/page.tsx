import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { now, utcDate } from "@/lib/clock";
import { query } from "@/lib/db";
import {
  PRIORITIES,
  STATUSES,
  TYPES,
  type IssueType,
  type Priority,
  type Status,
} from "@/lib/domain";
import { IssueTable, type Filters } from "./issue-table";
import { ProjectHeader } from "./project-header";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type DbIssue = {
  number: number;
  title: string;
  status: Status;
  priority: Priority;
  type: IssueType;
  assignee: string | null;
  due_date: string | null;
};

/** Keeps a URL filter value only if it is a known code. */
function pick<T extends string>(
  value: string | string[] | undefined,
  codes: readonly T[],
): T | "" {
  return typeof value === "string" &&
    (codes as readonly string[]).includes(value)
    ? (value as T)
    : "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: key };
}

export default async function ProjectIssues({ params, searchParams }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const sp = await searchParams;
  const filters: Filters = {
    status: pick(sp.status, STATUSES),
    priority: pick(sp.priority, PRIORITIES),
    type: pick(sp.type, TYPES),
  };
  const [project] = await query<{ id: number; key: string; name: string }>(
    "SELECT id, key, name FROM projects WHERE key = $1",
    [key],
  );
  if (!project) notFound();
  const label = typeof sp.label === "string" ? sp.label.trim().toLowerCase() : "";
  const issues = await query<DbIssue>(
    `SELECT i.number, i.title, i.status, i.priority, i.type, u.name AS assignee,
            to_char(i.due_date, 'YYYY-MM-DD') AS due_date
       FROM issues i LEFT JOIN users u ON u.id = i.assignee_id
      WHERE i.project_id = $1
        AND ($2 = '' OR EXISTS (SELECT 1 FROM issue_labels il JOIN labels l ON l.id = il.label_id
                                 WHERE il.issue_id = i.id AND l.name = $2))
      ORDER BY i.number`,
    [project.id, label],
  );
  const today = utcDate(await now());
  return (
    <>
      <ProjectHeader project={project} view="list">
        {user.role !== "viewer" && (
          <Link
            href={`/projects/${project.key}/new`}
            data-testid="new-issue"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105"
          >
            New issue
          </Link>
        )}
      </ProjectHeader>
      {issues.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-panel/70 px-4 py-8 text-center text-ink-muted">
          No issues yet.
        </p>
      ) : (
        <IssueTable
          issues={issues.map(({ number, due_date, ...i }) => ({
            ...i,
            dueDate: due_date,
            key: `${project.key}-${number}`,
          }))}
          initialFilters={filters}
          today={today}
        />
      )}
    </>
  );
}
