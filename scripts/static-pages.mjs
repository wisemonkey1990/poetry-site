/**
 * 静态诗篇页面生成的纯函数（供 vite.config.js 插件与测试使用）。
 */
export const SITE_NAME = "诗经 · 诗三百";
export const OG_IMAGE_FILE = "og-image.png";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 规范化站点地址：空 -> ""，否则保证以单个 "/" 结尾。 */
export function normalizeSiteUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return `${value.replace(/\/+$/, "")}/`;
}

/** 诗篇页的站内路径（无结尾斜杠，对应构建产物 poem/<id>.html） */
export function poemPath(id) {
  return `poem/${encodeURIComponent(String(id))}`;
}

export function categoryPath(key) {
  return `browse/${encodeURIComponent(String(key))}`;
}

/** siteUrl 为空时返回 null。 */
export function absoluteUrl(siteUrl, path = "") {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return null;
  return `${base}${String(path).replace(/^\/+/, "")}`;
}

export function buildPoemTitle(poem) {
  return `${poem.title} · ${poem.chapter}·${poem.section} · 诗经`;
}

export function buildPoemDescription(poem, maxLength = 150) {
  const lines = Array.isArray(poem.content) ? poem.content : [];
  const head = lines.slice(0, 2).join("");
  const body = head || String(poem.translation || "").trim() || "阅读诗经原文、注释与今译。";
  const text = `${poem.chapter}·${poem.section}《${poem.title}》：${body}`;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * 以构建好的 index.html 为模板生成某个路由的预渲染页面：
 * 替换标题、描述、canonical、Open Graph，把预渲染正文放进 #app（脚本加载后由 SPA 接管），
 * 可附带 JSON-LD。页面引用的 JS/CSS 与首页完全相同，因此样式一致、可直接交互。
 */
export function renderRoutePage(template, { title, description, url = null, image = null, type = "website", body = "", jsonLd = null, noindex = false }) {
  const replaceMeta = (html, pattern, value) => html.replace(pattern, (_m, head, tail) => `${head}${escapeHtml(value)}${tail}`);
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/\s*<link rel="canonical"[^>]*>/, "")
    .replace(/\s*<meta property="og:url"[^>]*>/, "")
    .replace(/\s*<meta name="twitter:(?:title|description)"[^>]*>/g, "");
  html = replaceMeta(html, /(<meta name="description" content=")[^"]*(")/, description);
  html = replaceMeta(html, /(<meta property="og:title" content=")[^"]*(")/, title);
  html = replaceMeta(html, /(<meta property="og:description" content=")[^"]*(")/, description);
  html = replaceMeta(html, /(<meta property="og:type" content=")[^"]*(")/, type);
  if (image) {
    html = replaceMeta(html, /(<meta property="og:image" content=")[^"]*(")/, image);
    html = replaceMeta(html, /(<meta name="twitter:image" content=")[^"]*(")/, image);
  }
  const head = [
    url && `<link rel="canonical" href="${escapeHtml(url)}" />`,
    url && `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    noindex && `<meta name="robots" content="noindex" />`,
    jsonLd && `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`,
  ].filter(Boolean).map((line) => `  ${line}\n`).join("");
  return html
    .replace("</head>", `${head}</head>`)
    .replace(/<div id="app">\s*<\/div>/, `<div id="app">${body}</div>`);
}

/** 预渲染的诗篇正文（语义化，供首屏与爬虫）；SPA 启动后会替换为完整阅读页 */
export function buildPoemBody(poem) {
  const lines = (Array.isArray(poem.content) ? poem.content : []).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const section = (heading, text) => (text ? `<section><h2>${heading}</h2><p>${escapeHtml(text)}</p></section>` : "");
  return `<main class="prerender"><article><header><p class="prerender-meta">${escapeHtml(poem.chapter)} · ${escapeHtml(poem.section)}</p><h1>${escapeHtml(poem.title)}</h1></header><div class="prerender-lines">${lines}</div>${section("注释", poem.annotation)}${section("今译", poem.translation)}</article><nav><a href="/">诗三百</a> · <a href="/${categoryPath(poem.chapter)}">${escapeHtml(poem.chapter)}</a></nav></main>`;
}

export function buildPoemJsonLd(poem, siteUrl) {
  const url = absoluteUrl(siteUrl, poemPath(poem.id));
  const home = absoluteUrl(siteUrl, "");
  const work = {
    "@type": "CreativeWork",
    name: poem.title,
    genre: "诗歌",
    inLanguage: "zh-CN",
    text: (poem.content || []).join("\n"),
    isPartOf: { "@type": "Book", name: "诗经", alternateName: "诗三百" },
    about: `${poem.chapter}·${poem.section}`,
    ...(url ? { url } : {}),
  };
  if (!home) return { "@context": "https://schema.org", ...work };
  const crumbs = [["诗三百", home], [poem.chapter, absoluteUrl(siteUrl, categoryPath(poem.chapter))], [poem.title, url]];
  return {
    "@context": "https://schema.org",
    "@graph": [work, {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
    }],
  };
}

export function buildPoemPage(template, poem, { siteUrl = "", image = null } = {}) {
  return renderRoutePage(template, {
    image,
    title: buildPoemTitle(poem),
    description: buildPoemDescription(poem),
    url: absoluteUrl(siteUrl, poemPath(poem.id)),
    type: "article",
    body: buildPoemBody(poem),
    jsonLd: buildPoemJsonLd(poem, siteUrl),
  });
}

export function buildSitemap(siteUrl, poems, lastmod, categories = []) {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return null;
  const urls = [base, `${base}browse`, ...categories.map((cat) => `${base}${categoryPath(cat.key)}`), ...poems.map((poem) => `${base}${poemPath(poem.id)}`)];
  const mod = lastmod ? `<lastmod>${escapeHtml(lastmod)}</lastmod>` : "";
  const items = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc>${mod}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export function buildRobots(siteUrl) {
  const base = normalizeSiteUrl(siteUrl);
  const lines = ["User-agent: *", "Allow: /"];
  if (base) lines.push("", `Sitemap: ${base}sitemap.xml`);
  return `${lines.join("\n")}\n`;
}
