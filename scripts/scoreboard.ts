// Trackly scoreboard: runs the 40 acceptance tests and prints ✓/✗ per group.
//   npm run scoreboard
// Every run appends a line to .scoreboard/history.csv, so you can watch the score grow day by day.
import { execSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

type Spec = { title: string; ok: boolean };
type Suite = { specs?: Spec[]; suites?: Suite[] };

const GROUPS: [string, string, number, number][] = [
  ["A", "Projects and issues", 1, 8],
  ["B", "Board and workflow", 9, 15],
  ["C", "Search, comments, activity", 16, 22],
  ["D", "Sprints and reports", 23, 28],
  ["E", "Accounts and notifications", 29, 35],
  ["F", "AI assistant", 36, 40],
];

mkdirSync(".scoreboard", { recursive: true });
rmSync(".scoreboard/results.json", { force: true }); // never print an old run by mistake
const t0 = Date.now();
spawnSync("npx playwright test --reporter=json", {
  stdio: ["ignore", "ignore", "inherit"],
  shell: true,
  env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: ".scoreboard/results.json" },
});
const seconds = Math.round((Date.now() - t0) / 1000);

if (!existsSync(".scoreboard/results.json")) {
  console.error("Could not read the test results. Try running: npx playwright test");
  process.exit(1);
}
const report = JSON.parse(readFileSync(".scoreboard/results.json", "utf8")) as { suites: Suite[] };
const result = new Map<number, boolean>();
const titles = new Map<number, string>();
const walk = (s: Suite) => {
  for (const sp of s.specs ?? []) {
    const m = /^S(\d{2}) (.*)$/.exec(sp.title);
    if (m) {
      result.set(Number(m[1]), sp.ok);
      titles.set(Number(m[1]), m[2]);
    }
  }
  (s.suites ?? []).forEach(walk);
};
report.suites.forEach(walk);

let total = 0;
console.log("\n  TRACKLY SCOREBOARD\n");
for (const [g, name, a, b] of GROUPS) {
  let pass = 0;
  const lines: string[] = [];
  for (let i = a; i <= b; i++) {
    const ok = result.get(i) === true;
    if (ok) pass++;
    lines.push(`    ${ok ? "✓" : "✗"} S${String(i).padStart(2, "0")} ${titles.get(i) ?? ""}`);
  }
  total += pass;
  console.log(`  ${g}. ${name}: ${pass}/${b - a + 1}`);
  console.log(lines.join("\n"));
}
console.log(`\n  TOTAL: ${total}/40   (${seconds} s)\n`);

let commit = "uncommitted";
try {
  commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {}
const hist = ".scoreboard/history.csv";
if (!existsSync(hist)) appendFileSync(hist, "time,commit,score\n");
appendFileSync(hist, `${new Date().toISOString()},${commit},${total}\n`);
