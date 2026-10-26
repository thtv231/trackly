import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ProjectHeader } from "../project-header";
import { NewSprintForm } from "./new-sprint-form";

type Props = { params: Promise<{ key: string }> };

type Sprint = { id: number; name: string; start: string; end: string; state: "planned" | "active" | "completed" };

const STATE_LABEL: Record<Sprint["state"], string> = { planned: "Planned", active: "Active", completed: "Completed" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: `${key} sprints` };
}

export default async function SprintsPage({ params }: Props) {
  const user = await requireUser();
  const { key } = await params;
  const [project] = await query<{ id: number; key: string; name: string }>(
    "SELECT id, key, name FROM projects WHERE key = $1",
    [key],
  );
  if (!project) notFound();
  const sprints = await query<Sprint>(
    `SELECT id, name, state, to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS "end"
       FROM sprints WHERE project_id = $1
      ORDER BY start_date, id`,
    [project.id],
  );

  return (
    <>
      <ProjectHeader project={project} view="sprints" />
      {user.role !== "viewer" && <NewSprintForm projectKey={project.key} />}
      {sprints.length === 0 ? (
        <p className="text-ink-muted">No sprints yet.</p>
      ) : (
        <ul className="space-y-3">
          {sprints.map((s) => (
            <li key={s.id} data-testid="sprint-card" className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-lg font-semibold text-brand-strong">{s.name}</h2>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                  {STATE_LABEL[s.state]}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {formatDate(s.start)} – {formatDate(s.end)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
