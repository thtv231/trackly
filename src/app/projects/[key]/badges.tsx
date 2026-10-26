import { STATUS_LABEL, type Priority, type Status } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export const STATUS_TONE: Record<Status, { dot: string; badge: string; bar: string }> = {
  todo: { dot: "bg-stone-400", badge: "bg-stone-100 text-stone-700", bar: "border-t-stone-400" },
  in_progress: { dot: "bg-sky-500", badge: "bg-sky-50 text-sky-800", bar: "border-t-sky-500" },
  in_review: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-800", bar: "border-t-violet-500" },
  done: { dot: "bg-brand", badge: "bg-brand-soft text-brand-strong", bar: "border-t-brand" },
};

/** Number of filled bars (out of 4) for each priority. */
const PRIORITY_BARS: Record<Priority, number> = { highest: 4, high: 3, medium: 2, low: 1, lowest: 0 };

export function StatusBadge({ status }: { status: Status }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Signal-strength bars; the top two priorities use the accent color. */
export function PriorityMark({ priority }: { priority: Priority }) {
  const filled = PRIORITY_BARS[priority];
  const color = filled >= 3 ? "bg-accent" : "bg-ink-muted";
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={`w-1 rounded-sm ${n <= filled ? color : "bg-line"}`} style={{ height: 3 + n * 2 }} />
      ))}
    </span>
  );
}

export function OverdueBadge({ dueDate }: { dueDate: string }) {
  return (
    <span
      data-testid="overdue-badge"
      title={`Due ${formatDate(dueDate)}`}
      className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"
    >
      Overdue
    </span>
  );
}
