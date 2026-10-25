import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

// The title template in layout.tsx only applies to child segments, so the home page spells it out.
export const metadata: Metadata = { title: { absolute: "Projects · Trackly" } };

type ProjectCard = { key: string; name: string; description: string; open_count: number; total: number };

export default async function Home() {
  await requireUser();
  const projects = await query<ProjectCard>(
    `SELECT p.key, p.name, p.description,
            count(i.id) FILTER (WHERE i.status <> 'done')::int AS open_count,
            count(i.id)::int AS total
       FROM projects p LEFT JOIN issues i ON i.project_id = p.id
      GROUP BY p.id
      ORDER BY p.name`,
  );
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Projects</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.key}>
            <Link
              href={`/projects/${p.key}`}
              data-testid="project-card"
              className="block h-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 data-testid="project-name" className="text-lg font-semibold text-zinc-900">
                  {p.name}
                </h2>
                <span
                  data-testid="project-key"
                  className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-sm font-semibold text-indigo-700"
                >
                  {p.key}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{p.description}</p>
              <p className="mt-4 text-sm text-zinc-700">
                <span data-testid="project-open-count" className="font-semibold">
                  {p.open_count}
                </span>{" "}
                open · {p.total} total
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
