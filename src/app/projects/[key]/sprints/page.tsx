import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { STATUS_LABEL, type Status } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { ProjectHeader } from "../project-header";
import { Backlog, type BacklogIssue } from "./backlog";
import { NewSprintForm } from "./new-sprint-form";

type Props = { params: Promise<{ key: string }> };

type Sprint = {
  id: number;
  name: string;
  start: string;
  end: string;
  state: "planned" | "active" | "completed";
};
type SprintIssue = BacklogIssue & { sprint_id: number; status: Status };

const STATE_LABEL: Record<Sprint["state"], string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

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
  // Backlog: not Done and not in a planned or active sprint (S24).
  const backlog = await query<BacklogIssue>(
    `SELECT p.key || '-' || i.number AS key, i.title, i.points
       FROM issues i JOIN projects p ON p.id = i.project_id
      WHERE i.project_id = $1 AND i.status <> 'done'
        AND NOT EXISTS (SELECT 1 FROM sprint_issues si JOIN sprints s ON s.id = si.sprint_id
                         WHERE si.issue_id = i.id AND s.state IN ('planned', 'active'))
      ORDER BY i.number`,
    [project.id],
  );
  const sprintIssues = await query<SprintIssue>(
    `SELECT si.sprint_id, p.key || '-' || i.number AS key, i.title, i.points, i.status
       FROM sprint_issues si
       JOIN sprints s ON s.id = si.sprint_id
       JOIN issues i ON i.id = si.issue_id
       JOIN projects p ON p.id = i.project_id
      WHERE s.project_id = $1
      ORDER BY i.number`,
    [project.id],
  );
  const openSprints = sprints.filter((s) => s.state !== "completed");
  const canEdit = user.role !== "viewer";

  return (
    <>
      <ProjectHeader project={project} view="sprints" />
      {canEdit && <NewSprintForm projectKey={project.key} />}
      <Backlog
        issues={backlog}
        sprints={openSprints.map(({ id, name }) => ({ id, name }))}
        canEdit={canEdit}
      />
      {sprints.length === 0 ? (
        <p className="text-ink-muted">No sprints yet.</p>
      ) : (
        <ul className="space-y-3">
          {sprints.map((s) => {
            const issues = sprintIssues.filter((i) => i.sprint_id === s.id);
            const points = issues.reduce((sum, i) => sum + (i.points ?? 0), 0);
            return (
              <li
                key={s.id}
                data-testid="sprint-card"
                className="rounded-xl border border-line bg-panel p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-display text-lg font-semibold text-brand-strong">
                    {s.name}
                  </h2>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                    {STATE_LABEL[s.state]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatDate(s.start)} – {formatDate(s.end)}
                </p>
                <p
                  data-testid="sprint-points"
                  className="mt-2 text-sm font-medium text-ink"
                >
                  {points} points · {issues.length}{" "}
                  {issues.length === 1 ? "issue" : "issues"}
                </p>
                {issues.length > 0 && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {issues.map((i) => (
                      <li
                        key={i.key}
                        data-testid="sprint-issue"
                        data-key={i.key}
                        className="flex items-center gap-3 py-2"
                      >
                        <a
                          href={`/issues/${i.key}`}
                          className="font-mono text-sm text-ink-muted hover:text-brand"
                        >
                          {i.key}
                        </a>
                        <span className="flex-1 truncate">{i.title}</span>
                        <span className="text-xs text-ink-muted">
                          {STATUS_LABEL[i.status]}
                        </span>
                        <span className="text-sm text-ink-muted">
                          {i.points ?? "–"} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
