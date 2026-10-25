import { query } from "@/lib/db";
import { notInTestMode } from "@/lib/testing";

// TEST ONLY (TRACKLY_TEST=1): every recorded webhook delivery, oldest first, as it would be sent.
// → [{ id, event, body, headers: { "Content-Type", "X-Trackly-Signature" }, createdAt }]
export async function GET() {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  const rows = await query<{ id: number; event: string; body: string; signature: string; created_at: Date }>(
    "SELECT id, event, body, signature, created_at FROM webhook_deliveries ORDER BY id",
  );
  return Response.json(
    rows.map((r) => ({
      id: r.id,
      event: r.event,
      body: r.body,
      headers: { "Content-Type": "application/json", "X-Trackly-Signature": r.signature },
      createdAt: new Date(r.created_at).toISOString(),
    })),
  );
}
