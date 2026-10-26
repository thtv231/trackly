import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ProjectHeader } from "../../../project-header";

type Props = { params: Promise<{ key: string; id: string }> };

type Point = { date: string; remaining: number };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  return { title: `${key} burndown` };
}

export default async function BurndownPage({ params }: Props) {
  await requireUser();
  const { key, id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [sprint] = await query<{ id: number; name: string; start: string; end: string; project_key: string; project_name: string }>(
    `SELECT s.id, s.name, to_char(s.start_date, 'YYYY-MM-DD') AS start, to_char(s.end_date, 'YYYY-MM-DD') AS "end",
            p.key AS project_key, p.name AS project_name
       FROM sprints s JOIN projects p ON p.id = s.project_id
      WHERE p.key = $1 AND s.id = $2`,
    [key, Number(id)],
  );
  if (!sprint) notFound();

  // For each sprint day, the status of every sprint issue at the end of that day (UTC) comes from the
  // activity log: the last status change before midnight, or, with no change yet, the status the first
  // later change moved away from (no change at all: the current status).
  const points = await query<Point>(
    `WITH days AS (
       SELECT d::date AS day FROM generate_series($2::date, $3::date, interval '1 day') AS d
     )
     SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(i.points) FILTER (WHERE COALESCE(
              (SELECT a.to_value FROM activity a
                WHERE a.issue_id = i.id AND a.kind = 'status'
                  AND a.created_at < ((days.day + 1)::timestamp AT TIME ZONE 'UTC')
                ORDER BY a.created_at DESC, a.id DESC LIMIT 1),
              (SELECT a.from_value FROM activity a
                WHERE a.issue_id = i.id AND a.kind = 'status'
                ORDER BY a.created_at, a.id LIMIT 1),
              i.status) <> 'done'), 0)::int AS remaining
       FROM days
       LEFT JOIN sprint_issues si ON si.sprint_id = $1
       LEFT JOIN issues i ON i.id = si.issue_id
      GROUP BY days.day
      ORDER BY days.day`,
    [sprint.id, sprint.start, sprint.end],
  );

  const max = Math.max(1, ...points.map((p) => p.remaining));
  const w = 600;
  const h = 240;
  const pad = 32;
  const x = (i: number) => pad + (points.length > 1 ? (i * (w - 2 * pad)) / (points.length - 1) : (w - 2 * pad) / 2);
  const y = (v: number) => h - pad - (v * (h - 2 * pad)) / max;
  const line = points.map((p, i) => `${x(i)},${y(p.remaining)}`).join(" ");

  return (
    <>
      <ProjectHeader project={{ key: sprint.project_key, name: sprint.project_name }} view="sprints" />
      <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-lg font-semibold text-brand-strong">{sprint.name} burndown</h2>
          <span className="text-sm text-ink-muted">
            {formatDate(sprint.start)} – {formatDate(sprint.end)}
          </span>
          <Link href={`/projects/${sprint.project_key}/sprints`} className="ml-auto text-sm text-brand hover:underline">
            Back to sprints
          </Link>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" role="img" aria-label="Points remaining per day">
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="stroke-line" />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} className="stroke-line" />
          {points.length > 1 && (
            <line
              x1={x(0)}
              y1={y(points[0].remaining)}
              x2={x(points.length - 1)}
              y2={y(0)}
              className="stroke-ink-muted"
              strokeDasharray="4 4"
            />
          )}
          <polyline points={line} fill="none" className="stroke-brand" strokeWidth={2} />
          {points.map((p, i) => (
            <g key={p.date} data-testid="burndown-point" data-date={p.date} data-remaining={p.remaining}>
              <circle cx={x(i)} cy={y(p.remaining)} r={4} className="fill-brand" />
              <text x={x(i)} y={y(p.remaining) - 10} textAnchor="middle" className="fill-ink text-xs">
                {p.remaining}
              </text>
              <text x={x(i)} y={h - pad + 18} textAnchor="middle" className="fill-ink-muted text-xs">
                {formatDate(p.date).replace(/, \d{4}$/, "")}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
