#!/usr/bin/env node
// Stop hook: runs `npm run test` (Vitest unit tests). If they fail, blocks the stop and sends the
// failing output back to Claude. When stop_hook_active is true, Claude is already continuing
// because of this hook, so we let it stop to avoid an endless loop.

import { spawnSync } from "node:child_process";

const MAX_OUTPUT = 6000;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const input = JSON.parse(await readStdin());
  if (input.stop_hook_active) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const result = spawnSync("npm run test", {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: 240_000,
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
  });
  if (result.status === 0) process.exit(0);

  let output = `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "").trim();
  output ||= result.error?.message || "no output";
  if (output.length > MAX_OUTPUT) output = `…(truncated)\n${output.slice(-MAX_OUTPUT)}`;
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `Unit tests failed (npm run test). Fix them before stopping:\n\n${output}`,
    }),
  );
  process.exit(0);
}

main().catch((err) => {
  // Not a guard: report the failure without blocking the stop.
  process.stderr.write(`unit-tests-on-stop hook failed: ${err?.message ?? err}\n`);
  process.exit(1);
});
