import { query } from "./db";

// Helpers for test mode (TRACKLY_TEST=1). The test-only endpoints in src/app/api/test/ use them,
// and so does the scripted fake model of the assistant (group F).

export function isTestMode(): boolean {
  return process.env.TRACKLY_TEST === "1";
}

/** 404 for test-only endpoints when the app is not running under test. */
export function notInTestMode(): Response | null {
  return isTestMode() ? null : new Response("Not found", { status: 404 });
}

export async function readJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0] ? (JSON.parse(rows[0].value) as T) : fallback;
}

export async function writeJsonSetting(key: string, value: unknown): Promise<void> {
  await query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, JSON.stringify(value)],
  );
}

// Keys used by the assistant's fake model.
export const ASSISTANT_SCRIPT = "assistant_script"; // queue of replies the fake model will give
export const ASSISTANT_LOG = "assistant_log"; // every request the app sent to the model
export const ASSISTANT_CONFIGURED = "assistant_configured"; // false = behave as if no credentials
