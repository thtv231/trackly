import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Priority, Status } from "@/lib/domain";
import { Board, type BoardCard } from "./board";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: `${key} board` };
}

export default async function ProjectBoard({ params }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const [project] = await query<{ id: number; key: string; name: string }>(
    "SELECT id, key, name FROM projects WHERE key = $1",
    [key],
  );
  if (!project) notFound();
  const rows = await query<{ number: number; title: string; status: Status; priority: Priority; assignee: string | null }>(
    `SELECT i.number, i.title, i.status, i.priority, u.name AS assignee
       FROM issues i LEFT JOIN users u ON u.id = i.assignee_id
      WHERE i.project_id = $1
      ORDER BY i.number`,
    [project.id],
  );
  const cards: BoardCard[] = rows.map((r) => ({ ...r, key: `${project.key}-${r.number}` }));
  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-sm font-semibold text-indigo-700">
          {project.key}
        </span>
        <Link href={`/projects/${project.key}`} className="ml-auto text-sm font-medium text-indigo-600 hover:underline">
          List view
        </Link>
      </div>
      <Board cards={cards} canMove={user.role !== "viewer"} />
    </>
  );
}
