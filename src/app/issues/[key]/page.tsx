import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type IssueType,
  type Priority,
  type Status,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { IssueDetails, type Field } from "./issue-details";

type Props = { params: Promise<{ key: string }> };
type IssueDetail = {
  project_key: string;
  project_name: string;
  number: number;
  title: string;
  description: string;
  type: IssueType;
  status: Status;
  priority: Priority;
  assignee: string | null;
  assignee_email: string | null;
  reporter: string;
  points: number | null;
  due_date: string | null;
  created_at: Date;
  resolved_at: Date | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: key };
}

export default async function IssuePage({ params }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const match = /^([A-Z][A-Z0-9]{1,9})-(\d+)$/.exec(key);
  if (!match) notFound();
  const [issue] = await query<IssueDetail>(
    `SELECT p.key AS project_key, p.name AS project_name, i.number, i.title, i.description, i.type,
            i.status, i.priority, a.name AS assignee, a.email AS assignee_email, r.name AS reporter, i.points,
            to_char(i.due_date, 'YYYY-MM-DD') AS due_date, i.created_at, i.resolved_at
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users r ON r.id = i.reporter_id
       LEFT JOIN users a ON a.id = i.assignee_id
      WHERE p.key = $1 AND i.number = $2`,
    [match[1], Number(match[2])],
  );
  if (!issue) notFound();
  const issueKey = `${issue.project_key}-${issue.number}`;
  const canEdit = user.role !== "viewer";
  const assignees = canEdit
    ? await query<{ email: string; name: string }>(
        "SELECT email, name FROM users WHERE role IN ('admin', 'member') ORDER BY name",
      )
    : [];

  const fields: Field[] = [
    { label: "Type", testId: "issue-type", value: TYPE_LABEL[issue.type] },
    { label: "Status", testId: "issue-status", value: STATUS_LABEL[issue.status] },
    { label: "Priority", testId: "issue-priority", value: PRIORITY_LABEL[issue.priority], edit: "priority" },
    { label: "Assignee", testId: "issue-assignee", value: issue.assignee ?? "Unassigned", edit: "assignee" },
    { label: "Reporter", testId: "issue-reporter", value: issue.reporter },
    {
      label: "Points",
      testId: "issue-points",
      value: issue.points === null ? "None" : String(issue.points),
      edit: "points",
    },
    { label: "Due", testId: "issue-due", value: issue.due_date ? formatDate(issue.due_date) : "None" },
    { label: "Created", testId: "issue-created", value: formatDate(issue.created_at) },
    ...(issue.resolved_at
      ? [{ label: "Resolved", testId: "issue-resolved", value: formatDate(issue.resolved_at) }]
      : []),
  ];

  return (
    <>
      <nav className="mb-2 text-sm text-zinc-500">
        <Link href={`/projects/${issue.project_key}`} className="hover:underline">
          {issue.project_name}
        </Link>
        <span className="mx-1">/</span>
        <span data-testid="issue-key" className="font-mono font-semibold text-indigo-700">
          {issueKey}
        </span>
      </nav>
      <IssueDetails
        issueKey={issueKey}
        canEdit={canEdit}
        canDelete={user.role === "admin"}
        fields={fields}
        values={{
          title: issue.title,
          priority: issue.priority,
          assignee: issue.assignee_email ?? "",
          points: issue.points === null ? "" : String(issue.points),
        }}
        assignees={assignees}
      >
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Description</h2>
          <div data-testid="issue-description" className="text-zinc-800">
            {issue.description.trim() ? (
              <Markdown text={issue.description} />
            ) : (
              <p className="text-zinc-500">No description.</p>
            )}
          </div>
        </section>
      </IssueDetails>
    </>
  );
}
