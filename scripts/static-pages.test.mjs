import { describe, expect, it } from "vitest";
import {
  absoluteUrl, buildPoemPage, buildRobots, buildSitemap, buildPoemDescription, escapeHtml, normalizeSiteUrl, poemPath,
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
    expect(absoluteUrl("https://a.io/x", poemPath(1))).toBe("https://a.io/x/poem/1/");
  });
});

describe("escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe("&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;");
  });
});

describe("buildPoemPage", () => {
  it("renders title, text and relative redirect", () => {
    const html = buildPoemPage(poem);
    expect(html).toContain("<title>关雎 · 国风·周南 · 诗经</title>");
    expect(html).toContain("<p>关关雎鸠，在河之洲。</p>");
    expect(html).toContain("<h2>注释</h2>");
    expect(html).toContain("<h2>今译</h2>");
    expect(html).toContain('location.replace("../../#/poem/1")');
    expect(html).toContain('content="../../og-image.png"');
    expect(html).not.toContain('rel="canonical"');
  });
  it("adds canonical and absolute og tags with site url", () => {
    const html = buildPoemPage(poem, { siteUrl: "https://a.io/s" });
    expect(html).toContain('<link rel="canonical" href="https://a.io/s/poem/1/" />');
    expect(html).toContain('property="og:image" content="https://a.io/s/og-image.png"');
  });
  it("escapes html in poem fields", () => {
    const html = buildPoemPage({ ...poem, title: `<b>"x"</b>`, content: ["<img src=x onerror=1>"], annotation: "", translation: "" });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=1&gt;");
    expect(html).not.toContain("<h2>注释</h2>");
  });
  it("truncates long descriptions", () => {
    expect(buildPoemDescription({ ...poem, content: ["啊".repeat(300)] }).length).toBe(150);
  });
});

describe("sitemap and robots", () => {
  it("returns null without site url", () => {
    expect(buildSitemap("", [poem])).toBeNull();
  });
  it("lists home and poems, escaped", () => {
    const xml = buildSitemap("https://a.io/s", [poem, { ...poem, id: 2 }], "2026-01-01");
    expect(xml).toContain("<loc>https://a.io/s/</loc>");
    expect(xml).toContain("<loc>https://a.io/s/poem/2/</loc>");
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).toContain("<lastmod>2026-01-01</lastmod>");
    expect(buildSitemap("https://a.io/?a=1&b=2", [])).toContain("&amp;");
  });
  it("robots references sitemap only with site url", () => {
    expect(buildRobots("")).not.toContain("Sitemap");
    expect(buildRobots("https://a.io/s")).toContain("Sitemap: https://a.io/s/sitemap.xml");
  });
});
