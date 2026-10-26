#!/usr/bin/env node
// PreToolUse hook for Edit, Write and Bash.
// Blocks (exit 2) anything that looks like a secret, except in db/seed.sql and tests/,
// plus `git add` of .env files and `git add --force`. Any internal error also blocks.

import path from "node:path";

const SECRET_PATTERNS = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{8,}/],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["Stripe key", /\b[rs]k_(?:live|test)_[A-Za-z0-9]{10,}/],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["private key", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ["Postgres URL with a password", /postgres(?:ql)?:\/\/[^\s:\/@'"]+:[^\s@\/'"]+@/i],
  ["webhook secret (whsec_)", /whsec_[A-Za-z0-9_+\/=-]{4,}/],
];

const ALLOWED_FILES = ["db/seed.sql"];
const ALLOWED_DIRS = ["tests/"];

function block(message) {
  process.stderr.write(`secret-guard: ${message}\n`);
  process.exit(2);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function projectRelative(filePath, cwd) {
  const root = process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd();
  const abs = path.resolve(root, filePath);
  let rel = path.relative(root, abs).split(path.sep).join("/");
  if (process.platform === "win32") rel = rel.toLowerCase();
  return rel;
}

function isAllowedPath(rel) {
  if (rel.startsWith("../") || path.isAbsolute(rel)) return false;
  return ALLOWED_FILES.includes(rel) || ALLOWED_DIRS.some((dir) => rel.startsWith(dir));
}

function findSecret(text) {
  if (typeof text !== "string" || text === "") return null;
  for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) return name;
  return null;
}

// Split a shell command into simple commands, then into words (quotes stripped).
function gitAddArgs(command) {
  const results = [];
  for (const segment of command.split(/&&|\|\||[;|&\n]/)) {
    const words = segment.match(/"[^"]*"|'[^']*'|\S+/g)?.map((w) => w.replace(/^["']|["']$/g, "")) ?? [];
    const gitIndex = words.findIndex((w) => /(^|[\\/])git(\.exe)?$/i.test(w));
    if (gitIndex === -1) continue;
    // Skip git's global options (-C <dir>, -c <k=v>, --git-dir=..., etc.) to find the subcommand.
    let i = gitIndex + 1;
    while (i < words.length && words[i].startsWith("-")) {
      if (["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(words[i])) i++;
      i++;
    }
    if (words[i] === "add") results.push(words.slice(i + 1));
  }
  return results;
}

function checkGitAdd(command) {
  for (const args of gitAddArgs(command)) {
    for (const arg of args) {
      if (arg === "--force" || /^-[A-Za-z]*f[A-Za-z]*$/.test(arg)) {
        block("`git add --force` / `-f` is not allowed. Fix .gitignore instead of forcing files in.");
      }
      const base = arg.split(/[\\/]/).pop();
      if (/^\.env(\..*)?$/i.test(base) || /\.env$/i.test(base)) {
        block(`\`git add ${arg}\` is not allowed: .env files hold secrets and must never be committed.`);
      }
    }
  }
}

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};

  if (tool === "Bash") {
    const command = ti.command ?? "";
    checkGitAdd(command);
    const found = findSecret(command);
    if (found) {
      block(`this command contains what looks like a secret (${found}). Keep secrets in .env.local (gitignored) and read them from process.env.`);
    }
    process.exit(0);
  }

  if (tool === "Write" || tool === "Edit") {
    if (!ti.file_path) block("no file_path in tool input.");
    const rel = projectRelative(ti.file_path, input.cwd);
    if (isAllowedPath(rel)) process.exit(0);
    const text = tool === "Write" ? ti.content : ti.new_string;
    const found = findSecret(text);
    if (found) {
      block(`refusing to write what looks like a secret (${found}) to ${rel}. Secrets are only allowed in db/seed.sql and tests/. Put real secrets in .env.local and read them from process.env.`);
    }
    process.exit(0);
  }

  process.exit(0);
}

process.on("uncaughtException", (err) => block(`hook failed (${err?.message ?? err}); blocking to be safe.`));
process.on("unhandledRejection", (err) => block(`hook failed (${err?.message ?? err}); blocking to be safe.`));

main().catch((err) => block(`hook failed (${err?.message ?? err}); blocking to be safe.`));
