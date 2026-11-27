import { html, setHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import categories from "../data/categories.json";
import { getPoemIndex } from "../services/poems.js";

const glyphs = { "国风": "风", "小雅": "雅", "大雅": "雅", "周颂": "颂", "鲁颂": "颂", "商颂": "颂" };

export function renderHome() {
  const markup = html`
    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero-copy">
        <p class="hero-kicker">中国最早的诗歌总集</p>
        <h1 class="hero-title" id="heroTitle">诗经</h1>
        <p class="hero-subtitle">诗三百 · 思无邪</p>
        <p class="hero-desc">循风而歌，因雅而正，以颂为祭。三百零五篇歌谣，越过两千余年的光阴，在一卷宣纸间重新相逢。</p>
        <div class="hero-actions">
          <a href="/browse" class="btn btn-primary" data-nav="/browse">阅览篇章</a>
          <a href="/search" class="btn btn-outline" data-nav="/search">循句寻诗</a>
        </div>
      </div>
      <figure class="hero-figure" aria-hidden="true">
        <picture><source type="image/avif" srcset="/images/confucius-salute-transparent-474.avif 474w, /images/confucius-salute-transparent-711.avif 711w, /images/confucius-salute-transparent-948.avif 948w" sizes="(max-width: 760px) 68vw, 470px"><source type="image/webp" srcset="/images/confucius-salute-transparent-474.webp 474w, /images/confucius-salute-transparent-711.webp 711w, /images/confucius-salute-transparent-948.webp 948w" sizes="(max-width: 760px) 68vw, 470px"><img src="/images/confucius-salute-transparent-474.png" alt="" width="948" height="1659" loading="eager" decoding="async" fetchpriority="high"></picture>
      </figure>
      <div class="hero-seal" aria-hidden="true">思<br>无<br>邪</div>
    </section>

    <section class="section" aria-labelledby="catalogTitle">
      <div class="section-heading">
        <div class="section-title-wrap"><span class="section-mark">卷</span><div><h2 class="section-title" id="catalogTitle">风雅颂篇目</h2><p class="section-note">展开章卷，浏览该类全部诗题</p></div></div>
        <span class="section-note">共三百零五篇</span>
      </div>
      <div class="home-category-list">
        ${categories.map((cat, index) => html`
          <details class="home-cat-group" ${index === 0 ? "open" : ""}>
            <summary class="home-cat-summary">
              <span class="category-glyph" aria-hidden="true">${glyphs[cat.key]}</span>
              <span class="home-cat-name"><h3>${cat.name}</h3><p>${cat.description}</p></span>
              <span class="tag">${cat.poemCount} 篇</span>
              <svg class="accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="home-cat-poems" data-chapter="${cat.key}"><div class="loading">展卷中……</div></div>
          </details>`)}
      </div>
    </section>`;
  setupShell();
  renderShell(markup);
  loadCategoryPoems();
  return () => {};
}

async function loadCategoryPoems() {
  const poems = await getPoemIndex();
  for (const category of categories) {
    const target = document.querySelector(`.home-cat-poems[data-chapter="${category.key}"]`);
    if (!target) continue;
    setHtml(target, poems.filter((poem) => poem.chapter === category.key).map((poem) => html`
	      <a href="/poem/${poem.id}" class="home-poem-link" data-nav="/poem/${poem.id}" title="${poem.content[0]}">
	        <span class="home-poem-index">${String(poem.id).padStart(3, "0")}</span><span class="home-poem-title">${poem.title}</span>
	      </a>`));
  }
}

export function setupHome() {}
