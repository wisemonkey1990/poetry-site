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

export function poemPath(id) {
  return `poem/${encodeURIComponent(String(id))}/`;
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
 * 生成单篇诗歌的静态页面。
 * 页面含语义化正文供爬虫读取；真实用户通过内联脚本跳转到 SPA 的 hash 路由。
 * 页面位于 <base>/poem/<id>/index.html，因此返回根目录用 "../../"，兼容 GitHub Pages 子路径。
 */
export function buildPoemPage(poem, { siteUrl = "" } = {}) {
  const id = String(poem.id);
  const title = buildPoemTitle(poem);
  const description = buildPoemDescription(poem);
  const pageUrl = absoluteUrl(siteUrl, poemPath(poem.id));
  const image = absoluteUrl(siteUrl, OG_IMAGE_FILE) || `../../${OG_IMAGE_FILE}`;
  const target = `../../#/poem/${encodeURIComponent(id)}`;
  const lines = (Array.isArray(poem.content) ? poem.content : [])
    .map((line) => `        <p>${escapeHtml(line)}</p>`)
    .join("\n");
  const section = (heading, text) =>
    text ? `\n      <section>\n        <h2>${heading}</h2>\n        <p>${escapeHtml(text)}</p>\n      </section>` : "";
  const meta = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    pageUrl && `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    pageUrl && `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].filter(Boolean).map((line) => `  ${line}`).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
${meta}
  <meta name="theme-color" content="#3e2c1a" />
  <link rel="icon" type="image/svg+xml" href="../../favicon.svg" />
  <style>body{margin:0;background:#f3eddf;color:#24221f;font-family:"Noto Serif SC","Songti SC",serif;line-height:1.9}main{max-width:36rem;margin:0 auto;padding:2rem 1rem}h1{color:#9f2f24}a{color:#9f2f24}</style>
  <script>location.replace(${JSON.stringify(target)});</script>
  <noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(target)}" /></noscript>
</head>
<body>
  <main id="static-poem">
    <article>
      <header>
        <h1>${escapeHtml(poem.title)}</h1>
        <p>${escapeHtml(poem.chapter)} · ${escapeHtml(poem.section)}</p>
      </header>
      <div>
${lines}
      </div>${section("注释", poem.annotation)}${section("今译", poem.translation)}
    </article>
    <p><a href="${escapeHtml(target)}">在《诗经 · 诗三百》中阅读</a> · <a href="../../">返回首页</a></p>
  </main>
</body>
</html>
`;
}

export function buildSitemap(siteUrl, poems, lastmod) {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return null;
  const urls = [base, ...poems.map((poem) => `${base}${poemPath(poem.id)}`)];
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
