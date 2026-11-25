// Guard for auto-generated correction PRs (branches named `correction/*`).
// Usage in CI: node scripts/check-correction-pr.mjs  (needs fetch-depth 0)
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const MAX_POEMS_JSON_LINES = 10;
export const POEMS_FILE = "src/data/poems.json";

const ALLOWED_EXACT = new Set([POEMS_FILE, "src/data/pinyin-table.json", "src/data/pinyin-overrides.json"]);
const READING_RE = /^src\/data\/reading\/[^/]+\.json$/;

export function isAllowedPath(path) {
  return ALLOWED_EXACT.has(path) || READING_RE.test(path);
}

/**
 * @param {string[]} changedPaths
 * @param {number} [poemsLinesChanged] added + deleted lines in poems.json
 * @returns {{ok: boolean, violations: string[]}}
 */
export function checkCorrectionPr(changedPaths, poemsLinesChanged = 0) {
  const violations = [];
  for (const p of changedPaths) {
    if (!isAllowedPath(p)) violations.push(`不允许修改的文件: ${p}`);
  }
  if (poemsLinesChanged > MAX_POEMS_JSON_LINES) {
    violations.push(`${POEMS_FILE} 改动 ${poemsLinesChanged} 行，超过上限 ${MAX_POEMS_JSON_LINES}`);
  }
  return { ok: violations.length === 0, violations };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function main() {
  const range = "origin/main...HEAD";
  const paths = git("diff", "--name-only", range).split("\n").filter(Boolean);
  let lines = 0;
  for (const row of git("diff", "--numstat", range, "--", POEMS_FILE).split("\n").filter(Boolean)) {
    const [add, del] = row.split("\t");
    lines += (Number(add) || 0) + (Number(del) || 0);
  }
  const { ok, violations } = checkCorrectionPr(paths, lines);
  if (!ok) {
    for (const v of violations) console.error(v);
    process.exit(1);
  }
  console.log(`correction guard ok (${paths.length} files, poems.json ${lines} lines)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
