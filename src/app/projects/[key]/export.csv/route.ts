import { apiUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type IssueType,
  type Priority,
  type Status,
} from "@/lib/domain";

type Ctx = { params: Promise<{ key: string }> };

type Row = {
  number: number;
  title: string;
  type: IssueType;
  status: Status;
  priority: Priority;
  assignee: string | null;
  points: number | null;
  created: string;
};

const HEADER = ["Key", "Title", "Type", "Status", "Priority", "Assignee", "Points", "Created"];

/** RFC 4180: quote a field containing a comma, quote or line break, doubling inner quotes. */
function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

// GET /projects/[key]/export.csv → every issue in the project, ordered by number, as CSV.
export async function GET(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { key } = await params;

  const [project] = await query<{ id: number }>("SELECT id FROM projects WHERE key = $1", [key]);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const rows = await query<Row>(
    `SELECT i.number, i.title, i.type, i.status, i.priority, u.name AS assignee, i.points,
            to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created
     FROM issues i LEFT JOIN users u ON u.id = i.assignee_id
     WHERE i.project_id = $1
     ORDER BY i.number`,
    [project.id],
  );

  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        `${key}-${r.number}`,
        r.title,
        TYPE_LABEL[r.type],
        STATUS_LABEL[r.status],
        PRIORITY_LABEL[r.priority],
        r.assignee ?? "",
        r.points === null ? "" : String(r.points),
        r.created,
      ]
        .map(csvField)
        .join(","),
    );
  }

  return new Response(lines.map((l) => `${l}\r\n`).join(""), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${key}-issues.csv"`,
    },
  });
}
