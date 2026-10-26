import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from "@/lib/domain";

type Props = { params: Promise<{ key: string }> };
type IssueRow = { number: number; title: string; status: Status; priority: Priority; assignee: string | null };

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
  const issues = await query<IssueRow>(
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
        {user.role !== "viewer" && (
          <Link
            href={`/projects/${project.key}/new`}
            data-testid="new-issue"
            className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New issue
          </Link>
        )}
      </div>
      {issues.length === 0 ? (
        <p className="text-zinc-600">No issues yet.</p>
      ) : (
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
              {issues.map((i) => {
                const issueKey = `${project.key}-${i.number}`;
                return (
                  <tr key={i.number} data-testid="issue-row" className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-mono whitespace-nowrap">
                      <Link
                        href={`/issues/${issueKey}`}
                        data-testid="issue-key"
                        className="font-semibold text-indigo-600 hover:underline"
                      >
                        {issueKey}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
