import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Priority, Status } from "@/lib/domain";
import { ProjectHeader } from "../project-header";
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
      <ProjectHeader project={project} view="board" />
      <Board cards={cards} canMove={user.role !== "viewer"} />
    </>
  );
}
