import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const poems = JSON.parse(fs.readFileSync(path.join(root, "src/data/poems.json"), "utf8"));

function slugify(title, id) {
  const py = pinyin(title, { toneType: "none", type: "array" })
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
  return `${String(id).padStart(3, "0")}-${py || "poem"}`;
}

function literal(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const rows = poems.map((poem) => `(${poem.id}, ${literal(slugify(poem.title, poem.id))}, ${literal(poem.title)}, ${literal(poem.chapter)}, ${literal(poem.section)}, ${literal(JSON.stringify(poem.content))}::jsonb, ${literal(poem.annotation)}, ${literal(poem.translation)}, ${poem.id}, true)`);

const sql = `-- 由 scripts/generate-poems-seed.mjs 自动生成\ninsert into public.poems\n  (id, slug, title, chapter, section, content, annotation, translation, sort_order, is_published)\nvalues\n${rows.join(",\n")}\non conflict (id) do update set\n  slug = excluded.slug,\n  title = excluded.title,\n  chapter = excluded.chapter,\n  section = excluded.section,\n  content = excluded.content,\n  annotation = excluded.annotation,\n  translation = excluded.translation,\n  sort_order = excluded.sort_order,\n  is_published = excluded.is_published;\n`;

const output = path.join(root, "supabase/migrations/002_seed_poems.sql");
fs.writeFileSync(output, sql, "utf8");
console.log(`Generated ${output} with ${poems.length} poems.`);
