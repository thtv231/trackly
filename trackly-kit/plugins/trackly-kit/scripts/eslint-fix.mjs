#!/usr/bin/env node
// PostToolUse hook for Edit and Write: runs `npx eslint --fix` on the edited .ts/.tsx file.
// Problems eslint can't fix are sent back to Claude (exit 2); the edit itself has already happened.

import { spawnSync } from "node:child_process";
import path from "node:path";

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
  const filePath = input.tool_input?.file_path;
  if (!filePath || !/\.tsx?$/i.test(filePath)) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const rel = path.relative(root, path.resolve(root, filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).includes("node_modules")) process.exit(0);

  const result = spawnSync(`npx eslint --fix ${JSON.stringify(rel)}`, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    timeout: 60_000,
  });

  if (result.status === 0) process.exit(0);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || result.error?.message || "unknown error";
  process.stderr.write(`eslint --fix left problems in ${rel}:\n${output}\n`);
  process.exit(2);
}

main().catch((err) => {
  // Not a guard: report the failure without blocking.
  process.stderr.write(`eslint-fix hook failed: ${err?.message ?? err}\n`);
  process.exit(1);
});
