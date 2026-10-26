import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Priority, Status } from "@/lib/domain";
import { IssueTable } from "./issue-table";

type Props = { params: Promise<{ key: string }> };
type DbIssue = { number: number; title: string; status: Status; priority: Priority; assignee: string | null };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: key };
}

export default async function ProjectIssues({ params }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const [project] = await query<{ id: number; key: string; name: string }>(
    "SELECT id, key, name FROM projects WHERE key = $1",
    [key],
  );
  if (!project) notFound();
  const issues = await query<DbIssue>(
    `SELECT i.number, i.title, i.status, i.priority, u.name AS assignee
       FROM issues i LEFT JOIN users u ON u.id = i.assignee_id
      WHERE i.project_id = $1
      ORDER BY i.number`,
    [project.id],
  );
  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-sm font-semibold text-indigo-700">
          {project.key}
        </span>
        <Link
          href={`/projects/${project.key}/board`}
          className="ml-auto text-sm font-medium text-indigo-600 hover:underline"
        >
          Board
        </Link>
        {user.role !== "viewer" && (
          <Link
            href={`/projects/${project.key}/new`}
            data-testid="new-issue"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New issue
          </Link>
        )}
      </div>
      {issues.length === 0 ? (
        <p className="text-zinc-600">No issues yet.</p>
      ) : (
        <IssueTable issues={issues.map(({ number, ...i }) => ({ ...i, key: `${project.key}-${number}` }))} />
      )}
    </>
  );
}
