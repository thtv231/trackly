import type Anthropic from "@anthropic-ai/sdk";
import type { User } from "../auth";
import { query } from "../db";
import { POINTS, PRIORITIES, TYPES } from "../domain";
import { createIssue, parseIssueKey, updateIssue } from "../issues";

// The assistant's tools (S37, S38, S40). Reads run at once; writes only after the user confirms (see loop.ts).
// There is deliberately no delete tool. Issue text reaches the model only through these tool results.

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_issue",
    description: "Get one issue by key, e.g. TRK-3: title, type, status, priority, assignee, points, labels, due date and description.",
    input_schema: {
      type: "object",
      properties: { key: { type: "string", description: "Issue key such as TRK-3" } },
      required: ["key"],
    },
  },
  {
    name: "search_issues",
    description: "Search the current project's issues by words in the title or by key. Returns at most 20 issues.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Text to look for, case-insensitive" } },
      required: ["query"],
    },
  },
  {
    name: "create_issue",
    description: "Propose a new issue in the current project. The user must confirm before it is created.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: [...TYPES] },
        priority: { type: "string", enum: [...PRIORITIES] },
        assignee: { type: "string", description: "Email of an admin or member" },
        description: { type: "string", description: "Markdown" },
        points: { type: "integer", enum: [...POINTS] },
      },
      required: ["title", "type", "priority"],
    },
  },
  {
    name: "update_issue",
    description:
      "Propose changes to an issue in the current project. Only the fields given change. Status can't be changed here. " +
      "The user must confirm before anything is saved.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Issue key such as TRK-3" },
        title: { type: "string" },
        type: { type: "string", enum: [...TYPES] },
        priority: { type: "string", enum: [...PRIORITIES] },
        assignee: { type: ["string", "null"], description: "Email of an admin or member, or null to unassign" },
        description: { type: "string", description: "Markdown" },
        points: { type: ["integer", "null"], enum: [...POINTS, null] },
        dueDate: { type: ["string", "null"], description: "YYYY-MM-DD, or null to clear" },
      },
      required: ["key"],
    },
  },
];

export const WRITE_TOOLS = new Set(["create_issue", "update_issue"]);

export type ToolOutput = { content: string; is_error?: boolean };

const fail = (content: string): ToolOutput => ({ content, is_error: true });
const asObject = (input: unknown) => (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

/** Run get_issue or search_issues. Results are JSON text; the issue text in them is data, not instructions. */
export async function runReadTool(name: string, rawInput: unknown, projectKey: string): Promise<ToolOutput> {
  const input = asObject(rawInput);
  if (name === "get_issue") {
    const parsed = typeof input.key === "string" ? parseIssueKey(input.key.trim().toUpperCase()) : null;
    if (!parsed) return fail("Not a valid issue key");
    const [issue] = await query(
      `SELECT p.key || '-' || i.number AS key, i.title, i.type, i.status, i.priority, a.name AS assignee, i.points,
              COALESCE((SELECT array_agg(l.name ORDER BY l.name)
                          FROM issue_labels il JOIN labels l ON l.id = il.label_id
                         WHERE il.issue_id = i.id), '{}') AS labels,
              to_char(i.due_date, 'YYYY-MM-DD') AS "dueDate", i.description
         FROM issues i
         JOIN projects p ON p.id = i.project_id
         LEFT JOIN users a ON a.id = i.assignee_id
        WHERE p.key = $1 AND i.number = $2`,
      [parsed.projectKey, parsed.number],
    );
    return issue ? { content: JSON.stringify(issue) } : fail(`Issue ${parsed.projectKey}-${parsed.number} not found`);
  }
  if (name === "search_issues") {
    const text = typeof input.query === "string" ? input.query.trim() : "";
    if (!text) return fail("The query is empty");
    const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const issues = await query(
      `SELECT p.key || '-' || i.number AS key, i.title, i.status, i.priority, a.name AS assignee
         FROM issues i
         JOIN projects p ON p.id = i.project_id
         LEFT JOIN users a ON a.id = i.assignee_id
        WHERE p.key = $1 AND (i.title ILIKE $2 OR p.key || '-' || i.number ILIKE $2)
        ORDER BY i.number
        LIMIT 20`,
      [projectKey, pattern],
    );
    return { content: JSON.stringify(issues) };
  }
  return fail(`Unknown tool ${name}`);
}

/** Run a confirmed create_issue or update_issue as `user`, with the same rules as the API. */
export async function runWriteTool(name: string, rawInput: unknown, user: User, projectKey: string): Promise<ToolOutput> {
  const input = asObject(rawInput);
  if (user.role === "viewer") return fail(`Permission denied: viewers can't ${name === "create_issue" ? "create" : "edit"} issues`);
  if (name === "create_issue") {
    // The project comes from the panel the user is in, never from the model.
    const result = await createIssue({ ...input, projectKey }, user);
    return result.status === 201 ? { content: `Created ${result.key}` } : fail(result.error);
  }
  if (name === "update_issue") {
    const { key, ...patch } = input;
    const parsed = typeof key === "string" ? parseIssueKey(key.trim().toUpperCase()) : null;
    if (!parsed || parsed.projectKey !== projectKey) return fail(`Only issues of project ${projectKey} can be changed here`);
    const issueKey = `${parsed.projectKey}-${parsed.number}`;
    const result = await updateIssue(issueKey, patch, user);
    return result.status === 200 ? { content: `Updated ${issueKey}` } : fail(result.error);
  }
  return fail(`Unknown tool ${name}`);
}
