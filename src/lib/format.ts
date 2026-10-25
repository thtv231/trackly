const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** 'Nov 2, 2026'. Accepts a Date, an ISO timestamp or a 'YYYY-MM-DD' date. */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return dateFmt.format(date);
}
