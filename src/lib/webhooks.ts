import { createHmac } from "node:crypto";
import type { Query } from "./db";

// Webhooks (S33): changes are written to the webhook_deliveries outbox in the same transaction as the change,
// signed with the project's secret. Sending them is left to a worker.

export function signWebhook(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function recordWebhook(
  q: Query,
  projectId: number,
  event: string,
  payload: Record<string, unknown>,
  at: Date,
): Promise<void> {
  const [project] = await q<{ webhook_secret: string }>("SELECT webhook_secret FROM projects WHERE id = $1", [projectId]);
  const body = JSON.stringify({ event, ...payload });
  await q("INSERT INTO webhook_deliveries (project_id, event, body, signature, created_at) VALUES ($1, $2, $3, $4, $5)", [
    projectId,
    event,
    body,
    signWebhook(body, project.webhook_secret),
    at,
  ]);
}
