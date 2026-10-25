// Codes and display names from the conventions in STORIES.md.

export const STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const TYPES = ["task", "bug", "story"] as const;
export type IssueType = (typeof TYPES)[number];
export const TYPE_LABEL: Record<IssueType, string> = { task: "Task", bug: "Bug", story: "Story" };

/** Highest first. */
export const PRIORITIES = ["highest", "high", "medium", "low", "lowest"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = {
  highest: "Highest",
  high: "High",
  medium: "Medium",
  low: "Low",
  lowest: "Lowest",
};

export const POINTS = [0, 1, 2, 3, 5, 8, 13] as const;

export type Role = "admin" | "member" | "viewer";
