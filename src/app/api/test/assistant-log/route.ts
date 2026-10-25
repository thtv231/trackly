import { ASSISTANT_LOG, notInTestMode, readJsonSetting } from "@/lib/testing";

// TEST ONLY (TRACKLY_TEST=1): every request the app sent to the (fake) model, oldest first.
// → [{ model, system, messages, tools }]
export async function GET() {
  const blocked = notInTestMode();
  if (blocked) return blocked;
  return Response.json(await readJsonSetting<unknown[]>(ASSISTANT_LOG, []));
}
