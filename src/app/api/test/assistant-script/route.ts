import { ASSISTANT_CONFIGURED, ASSISTANT_SCRIPT, notInTestMode, readJsonSetting, writeJsonSetting } from "@/lib/testing";

// TEST ONLY (TRACKLY_TEST=1): queue the replies the assistant's scripted fake model will give.
// Body: {
//   "replies": [
//     { "content": [{ "type": "tool_use", "name": "get_issue", "input": { "key": "TRK-3" } }] },
//     { "content": [{ "type": "text", "text": "TRK-3 is about password reset." }], "chunkDelayMs": 50 }
//   ],
//   "configured": true      // optional; false = behave as if there were no API credentials
// }
// Each request the app sends to the model takes the next reply from the queue.
export async function POST(req: Request) {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { replies?: unknown[]; configured?: boolean };
  if (body.replies) {
    const queue = await readJsonSetting<unknown[]>(ASSISTANT_SCRIPT, []);
    await writeJsonSetting(ASSISTANT_SCRIPT, [...queue, ...body.replies]);
  }
  if (typeof body.configured === "boolean") await writeJsonSetting(ASSISTANT_CONFIGURED, body.configured);
  return Response.json({ ok: true });
}

export async function GET() {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  return Response.json(await readJsonSetting<unknown[]>(ASSISTANT_SCRIPT, []));
}
