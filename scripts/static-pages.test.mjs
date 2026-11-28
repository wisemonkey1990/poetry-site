import { describe, expect, it } from "vitest";
import {
  absoluteUrl, buildPoemPage, renderRoutePage, buildRobots, buildSitemap, buildPoemDescription, escapeHtml, normalizeSiteUrl, poemPath,
} from "./static-pages.mjs";

const poem = {
  id: 1, title: "关雎", chapter: "国风", section: "周南",
  content: ["关关雎鸠，在河之洲。", "窈窕淑女，君子好逑。"],
  annotation: "关关：象声词", translation: "雎鸠鸟关关地鸣叫",
};

describe("url helpers", () => {
  it("normalizes site url", () => {
    expect(normalizeSiteUrl("")).toBe("");
    expect(normalizeSiteUrl(undefined)).toBe("");
    expect(normalizeSiteUrl("https://a.github.io/shijing")).toBe("https://a.github.io/shijing/");
    expect(normalizeSiteUrl("https://a.io//")).toBe("https://a.io/");
  });
  it("builds absolute urls", () => {
    expect(absoluteUrl("", "poem/1/")).toBeNull();
    expect(absoluteUrl("https://a.io/x", poemPath(1))).toBe("https://a.io/x/poem/1");
  });
});

describe("escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe("&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;");
  });
});

const template = `<!DOCTYPE html><html lang="zh-CN"><head>
  <title>诗经 · 诗三百</title>
  <meta name="description" content="默认描述" />
  <meta property="og:title" content="默认" />
  <meta property="og:description" content="默认描述" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://a.io/s/og-image.png" />
  <meta name="twitter:image" content="https://a.io/s/og-image.png" />
  <script type="module" crossorigin src="/assets/index-abc.js"></script>
  <link rel="canonical" href="https://a.io/s/" />
  <meta property="og:url" content="https://a.io/s/" />
</head><body><div id="app"></div></body></html>`;

describe("buildPoemPage", () => {
  it("基于站点模板：保留脚本，替换标题与描述，正文预渲染进 #app", () => {
    const html = buildPoemPage(template, poem);
    expect(html).toContain("<title>关雎 · 国风·周南 · 诗经</title>");
    expect(html).toContain('src="/assets/index-abc.js"');
    expect(html).toMatch(/<div id="app"><main class="prerender">.*<p>关关雎鸠，在河之洲。<\/p>/s);
    expect(html).toContain("<h2>注释</h2>");
    expect(html).toContain("<h2>今译</h2>");
    expect(html).toContain('property="og:type" content="article"');
    expect(html).not.toContain("默认描述");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("location.replace");
  });
  it("有站点地址时 canonical 指向新路径，并带 JSON-LD 面包屑", () => {
    const html = buildPoemPage(template, poem, { siteUrl: "https://a.io/s" });
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('<link rel="canonical" href="https://a.io/s/poem/1" />');
    expect(html).toContain('<meta property="og:url" content="https://a.io/s/poem/1" />');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    expect(ld["@graph"][0].name).toBe("关雎");
    expect(ld["@graph"][1].itemListElement.map((x) => x.name)).toEqual(["诗三百", "国风", "关雎"]);
  });
  it("转义诗篇字段，JSON-LD 不会提前闭合 script", () => {
    const html = buildPoemPage(template, { ...poem, title: `<b>"x"</b></script>`, content: ["<img src=x onerror=1>"], annotation: "", translation: "" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=1&gt;");
    expect(html).not.toContain("<h2>注释</h2>");
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });
  it("truncates long descriptions", () => {
    expect(buildPoemDescription({ ...poem, content: ["啊".repeat(300)] }).length).toBe(150);
  });
  it("noindex 页面带 robots 标记", () => {
    expect(renderRoutePage(template, { title: "t", description: "d", noindex: true })).toContain('<meta name="robots" content="noindex" />');
  });
});

describe("sitemap and robots", () => {
  it("returns null without site url", () => {
    expect(buildSitemap("", [poem])).toBeNull();
  });
  it("lists home and poems, escaped", () => {
    const xml = buildSitemap("https://a.io/s", [poem, { ...poem, id: 2 }], "2026-01-01", [{ key: "国风" }]);
    expect(xml).toContain("<loc>https://a.io/s/</loc>");
    expect(xml).toContain("<loc>https://a.io/s/browse</loc>");
    expect(xml).toContain("<loc>https://a.io/s/browse/%E5%9B%BD%E9%A3%8E</loc>");
    expect(xml).toContain("<loc>https://a.io/s/poem/2</loc>");
    expect(xml).toContain("<loc>https://a.io/s/scroll</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(6);
    expect(xml).toContain("<lastmod>2026-01-01</lastmod>");
    expect(buildSitemap("https://a.io/?a=1&b=2", [])).toContain("&amp;");
  });
  it("robots references sitemap only with site url", () => {
    expect(buildRobots("")).not.toContain("Sitemap");
    expect(buildRobots("https://a.io/s")).toContain("Sitemap: https://a.io/s/sitemap.xml");
  });
});
