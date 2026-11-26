/**
 * 把一条经审核的纠错精确应用到 src/data/poems.json。
 *
 * 用法：
 *   node scripts/apply-correction.mjs --poem 1 --field content --old "齐了游敖" --new "齐子游敖" [--all] [--dry-run]
 *   node scripts/apply-correction.mjs --poem 98 --field annotation --old "蓵（jié）" --new "寁（zǎn）"
 *
 * 安全约束（任何一条不满足都会拒绝，不写文件）：
 *  - 只能改 content / annotation / translation 三个字段；
 *  - old 必须在目标字段里恰好出现一次（加 --all 时允许 2 到 MAX_OCCURRENCES 次，用于同一错字在多个诗节重复）；
 *  - old 与 new 都不能为空、不能相同、不能含换行/控制字符/反引号/尖括号/@/链接；
 *  - 长度变化不超过 MAX_LENGTH_DELTA 个字符；
 *  - 写回格式与现有文件逐字节一致（JSON.stringify(..., null, 2) + 换行）。
 * 成功后自动运行 scripts/generate-reading-data.mjs 重新生成预计算拼音与繁体数据（--dry-run 或 --no-regenerate 除外）。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ALLOWED_FIELDS = ["content", "annotation", "translation"];
export const MAX_OCCURRENCES = 6;
export const MAX_LENGTH_DELTA = 10;
export const MAX_TEXT_LENGTH = 200;

// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f`<>@]|https?:\/\//i;

export class CorrectionError extends Error {}

function fail(message) { throw new CorrectionError(message); }

function validateRequest({ poemId, field, oldText, newText }) {
  if (!Number.isInteger(poemId) || poemId < 1) fail("poemId 必须是正整数");
  if (!ALLOWED_FIELDS.includes(field)) fail(`field 只能是 ${ALLOWED_FIELDS.join("/")}`);
  for (const [name, value] of [["old", oldText], ["new", newText]]) {
    if (typeof value !== "string" || !value.trim()) fail(`${name} 不能为空`);
    if (value.length > MAX_TEXT_LENGTH) fail(`${name} 过长`);
    if (FORBIDDEN.test(value)) fail(`${name} 含有不允许的字符（换行/控制符/反引号/尖括号/@/链接）`);
  }
  if (oldText === newText) fail("old 与 new 相同");
  if (Math.abs(newText.length - oldText.length) > MAX_LENGTH_DELTA) fail("替换前后长度变化过大");
}

function countOccurrences(text, needle) {
  let count = 0;
  for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + needle.length)) count += 1;
  return count;
}

/**
 * 纯函数：返回修改后的新 poems 数组与变更摘要，不修改入参。
 * @returns {{ poems: object[], replaced: number, poemTitle: string }}
 */
export function applyCorrection(poems, { poemId, field, oldText, newText, all = false }) {
  validateRequest({ poemId, field, oldText, newText });
  const index = poems.findIndex((poem) => poem.id === poemId);
  if (index === -1) fail(`找不到诗篇 ${poemId}`);
  const poem = poems[index];
  const target = poem[field];
  if (target == null) fail(`诗篇 ${poemId} 没有 ${field} 字段`);

  const isLines = Array.isArray(target);
  const haystacks = isLines ? target : [target];
  const total = haystacks.reduce((sum, text) => sum + countOccurrences(String(text), oldText), 0);
  if (total === 0) fail(`在诗篇 ${poemId} 的 ${field} 中找不到「${oldText}」`);
  if (!all && total !== 1) fail(`「${oldText}」在 ${field} 中出现 ${total} 次，必须恰好一次（同一错字多处重复请加 --all）`);
  if (all && (total < 2 || total > MAX_OCCURRENCES)) fail(`--all 仅用于 2 到 ${MAX_OCCURRENCES} 次重复，实际 ${total} 次`);

  const replaceAllIn = (text) => String(text).split(oldText).join(newText);
  const updated = isLines ? target.map(replaceAllIn) : replaceAllIn(target);
  const next = poems.map((item, i) => (i === index ? { ...item, [field]: updated } : item));
  return { poems: next, replaced: total, poemTitle: poem.title };
}

export function serializePoems(poems) { return `${JSON.stringify(poems, null, 2)}\n`; }

function parseArgs(argv) {
  const args = { all: false, dryRun: false, regenerate: true };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--all") args.all = true;
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--no-regenerate") args.regenerate = false;
    else if (["--poem", "--field", "--old", "--new"].includes(flag)) { args[flag.slice(2)] = argv[i + 1]; i += 1; }
    else fail(`未知参数 ${flag}`);
  }
  return args;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "src/data/poems.json");
  const args = parseArgs(process.argv.slice(2));
  const source = fs.readFileSync(file, "utf8");
  const poems = JSON.parse(source);
  if (serializePoems(poems) !== source) fail("poems.json 的现有格式与标准序列化不一致，拒绝写入以免产生无关改动");
  const result = applyCorrection(poems, { poemId: Number(args.poem), field: args.field, oldText: args.old, newText: args.new, all: args.all });
  console.log(`诗篇 ${args.poem}《${result.poemTitle}》${args.field}：「${args.old}」→「${args.new}」共 ${result.replaced} 处`);
  if (args.dryRun) { console.log("--dry-run：未写入文件"); return; }
  fs.writeFileSync(file, serializePoems(result.poems));
  if (args.regenerate) execFileSync(process.execPath, [path.join(root, "scripts/generate-reading-data.mjs")], { stdio: "inherit", cwd: root });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    if (error instanceof CorrectionError) { console.error(`拒绝：${error.message}`); process.exit(2); }
    throw error;
  }
}
