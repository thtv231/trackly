import Link from "next/link";

type Props = {
  project: { key: string; name: string };
  view: "list" | "board" | "sprints";
  children?: React.ReactNode;
};

const VIEWS = [
  { id: "list", label: "List", path: "" },
  { id: "board", label: "Board", path: "/board" },
  { id: "sprints", label: "Sprints", path: "/sprints" },
] as const;

/** Title row shared by the issue list, the board and sprints, with a view switch. */
export function ProjectHeader({ project, view, children }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-4">
      <div>
        <span className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          {project.key}
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-strong">
          {project.name}
        </h1>
      </div>
      <nav className="ml-auto flex rounded-lg border border-line bg-panel p-1 text-sm shadow-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/projects/${project.key}${v.path}`}
            aria-current={v.id === view ? "page" : undefined}
            className={`rounded-md px-3 py-1 font-medium transition-colors duration-200 ${
              v.id === view ? "bg-brand text-white" : "text-ink-muted hover:bg-brand-soft hover:text-brand"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
