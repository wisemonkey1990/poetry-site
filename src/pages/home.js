import { html, setHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import categories from "../data/categories.json";
import { getPoemIndex } from "../services/poems.js";

const glyphs = { "国风": "风", "小雅": "雅", "大雅": "雅", "周颂": "颂", "鲁颂": "颂", "商颂": "颂" };

export function renderHome() {
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const markup = html`
    <section class="hero" aria-labelledby="heroTitle">
      <div class="hero-sky" aria-hidden="true"><i class="hero-sun"></i><i class="hero-mist hero-mist-a"></i><i class="hero-mist hero-mist-b"></i>
        <svg class="hero-hills hero-hills-far" viewBox="0 0 1600 360" preserveAspectRatio="none"><path d="M0 250 C90 200 150 120 240 150 C320 176 360 90 450 70 C540 52 590 150 680 170 C760 188 820 110 910 96 C1010 80 1060 170 1150 176 C1240 182 1290 104 1380 90 C1470 76 1540 150 1600 170 L1600 360 L0 360Z"/></svg>
        <svg class="hero-hills hero-hills-mid" viewBox="0 0 1600 360" preserveAspectRatio="none"><path d="M0 280 C120 230 200 200 300 236 C400 272 450 190 560 176 C670 162 720 250 830 250 C940 250 990 160 1100 150 C1210 140 1290 230 1400 226 C1480 222 1550 190 1600 200 L1600 360 L0 360Z"/></svg>
        <svg class="hero-hills hero-hills-near" viewBox="0 0 1600 360" preserveAspectRatio="none"><path d="M0 318 C140 296 220 262 340 280 C460 298 520 252 650 262 C780 272 840 318 980 310 C1120 302 1200 256 1330 268 C1440 278 1520 306 1600 296 L1600 360 L0 360Z"/></svg>
        <span class="hero-petals">${[...Array(16).keys()].map((n) => html`<b style="--i:${n}"></b>`)}</span>
      </div>
      <p class="hero-verse" aria-hidden="true"><span>关关雎鸠</span><span>在河之洲</span></p>
      <div class="hero-copy">
        <p class="hero-kicker">中国最早的诗歌总集</p>
        <h1 class="hero-title" id="heroTitle">诗经</h1>
        <p class="hero-subtitle">诗三百 · 思无邪</p>
        <p class="hero-desc">循风而歌，因雅而正，以颂为祭。三百零五篇歌谣，越过两千余年的光阴，在一卷宣纸间重新相逢。</p>
        <div class="hero-actions">
          <a href="/browse" class="btn btn-primary" data-nav="/browse">阅览篇章</a>
          <a href="/search" class="btn btn-outline" data-nav="/search">循句寻诗</a>
        </div>
        <dl class="hero-stats"><div><dt>305</dt><dd>篇</dd></div><div><dt>3</dt><dd>体：风雅颂</dd></div><div><dt>2500</dt><dd>载余韵</dd></div></dl>
      </div>
      <figure class="hero-figure" aria-hidden="true">
        <picture><source type="image/avif" srcset="/images/confucius-salute-transparent-474.avif 474w, /images/confucius-salute-transparent-711.avif 711w, /images/confucius-salute-transparent-948.avif 948w" sizes="(max-width: 760px) 68vw, 470px"><source type="image/webp" srcset="/images/confucius-salute-transparent-474.webp 474w, /images/confucius-salute-transparent-711.webp 711w, /images/confucius-salute-transparent-948.webp 948w" sizes="(max-width: 760px) 68vw, 470px"><img src="/images/confucius-salute-transparent-474.png" alt="" width="948" height="1659" loading="eager" decoding="async" fetchpriority="high"></picture>
      </figure>
      <div class="hero-seal" aria-hidden="true">思<br>无<br>邪</div>
    </section>

    <section class="daily reveal" id="dailyPoem" aria-labelledby="dailyTitle"></section>

    <section class="section reveal" aria-labelledby="catalogTitle">
      <div class="section-heading">
        <div class="section-title-wrap"><span class="section-mark">卷</span><div><h2 class="section-title" id="catalogTitle">风雅颂篇目</h2><p class="section-note">展开章卷，浏览该类全部诗题</p></div></div>
        <span class="section-note">共三百零五篇</span>
      </div>
      <div class="home-category-list">
        ${categories.map((cat, index) => html`
          <details class="home-cat-group" data-glyph="${glyphs[cat.key]}" ${index === 0 && wide ? "open" : ""}>
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
  const reveal = observeReveal();
  return () => reveal?.disconnect();
}

function observeReveal() {
  const items = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window)) return null;
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
  return io;
}

function renderDaily(poems) {
  const target = document.getElementById("dailyPoem");
  if (!target || !poems.length) return;
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
  const poem = poems[day % poems.length];
  const random = poems[Math.floor(Math.random() * poems.length)];
  const clauses = (poem.content[0] || "").split(/[，。！？；、：]/).map((part) => part.trim()).filter(Boolean);
  const lines = clauses.slice(0, 4);
  const excerpt = (poem.content[0] || "").replace(/\s+/g, "");
  setHtml(target, html`
    <div class="daily-verse" aria-hidden="true">${lines.map((line) => html`<span>${line}</span>`)}</div>
    <div class="daily-info">
      <p class="daily-kicker">今日一诗 · ${now.getMonth() + 1} 月 ${now.getDate()} 日</p>
      <h2 class="daily-title" id="dailyTitle">${poem.title}</h2>
      <p class="daily-meta">诗序 ${String(poem.id).padStart(3, "0")} · ${poem.chapter} · ${poem.section}</p>
      <p class="daily-lines">${excerpt}</p>
      <div class="daily-actions">
        <a href="/poem/${poem.id}" class="btn btn-primary" data-nav="/poem/${poem.id}">诵读全篇</a>
        <a href="/poem/${random.id}" class="btn btn-outline" data-nav="/poem/${random.id}">随缘翻一篇</a>
      </div>
    </div>`);
}

async function loadCategoryPoems() {
  const poems = await getPoemIndex();
  renderDaily(poems);
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
