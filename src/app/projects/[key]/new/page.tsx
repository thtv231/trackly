import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NewIssueForm } from "./new-issue-form";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: `New issue · ${key}` };
}

export default async function NewIssuePage({ params }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const [project] = await query<{ key: string; name: string }>("SELECT key, name FROM projects WHERE key = $1", [key]);
  if (!project) notFound();

  const heading = (
    <>
      <nav className="mb-2 text-sm text-zinc-500">
        <Link href={`/projects/${project.key}`} className="hover:underline">
          {project.name}
        </Link>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">New issue</h1>
    </>
  );

  if (user.role === "viewer") {
    return (
      <>
        {heading}
        <p className="rounded-md bg-amber-50 px-4 py-3 text-amber-800">
          You don&apos;t have permission to create issues. Viewers can only read.
        </p>
      </>
    );
  }

  const assignees = await query<{ email: string; name: string }>(
    "SELECT email, name FROM users WHERE role IN ('admin', 'member') ORDER BY name",
  );
  return (
    <>
      {heading}
      <NewIssueForm projectKey={project.key} assignees={assignees} defaultAssignee={user.email} />
    </>
  );
}
