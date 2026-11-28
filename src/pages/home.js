import { html, raw, setHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import categories from "../data/categories.json";
import { getPoemIndex } from "../services/poems.js";
import { TIMES, TIME_LABELS, currentTime, setTime } from "../utils/ambience.js";

const glyphs = { "国风": "风", "小雅": "雅", "大雅": "雅", "周颂": "颂", "鲁颂": "颂", "商颂": "颂" };

/** 风、雅、颂三幅挂轴 */
const realms = [
  { glyph: "风", name: "国风", line: "风出于土", note: "十五国的里巷歌谣，男女相与咏歌，各言其情。", keys: ["国风"] },
  { glyph: "雅", name: "雅", line: "雅成于朝", note: "朝会燕飨之乐，正声雅音，有小大之分。", keys: ["小雅", "大雅"] },
  { glyph: "颂", name: "颂", line: "颂用于庙", note: "宗庙祭祀的舞曲，美盛德之形容，告于神明。", keys: ["周颂", "鲁颂", "商颂"] },
];

/** 名句长廊：句子只用于展示，链接按篇名在诗库里查找 */
const famous = [
  ["关雎", "关关雎鸠，在河之洲"],
  ["桃夭", "桃之夭夭，灼灼其华"],
  ["蒹葭", "蒹葭苍苍，白露为霜"],
  ["子衿", "青青子衿，悠悠我心"],
  ["击鼓", "死生契阔，与子成说"],
  ["木瓜", "投我以木桃，报之以琼瑶"],
  ["采薇", "昔我往矣，杨柳依依"],
  ["淇奥", "如切如磋，如琢如磨"],
];

const heroVerse = ["关关雎鸠", "在河之洲", "窈窕淑女", "君子好逑"];
const count = (keys) => categories.filter((c) => keys.includes(c.key)).reduce((sum, c) => sum + c.poemCount, 0);

export function renderHome() {
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const markup = html`
    <section class="stage" aria-labelledby="heroTitle">
      <div class="stage-sky" aria-hidden="true">
        <i class="stage-stars"></i><i class="stage-orb"></i>
        <svg class="hills hills-far" viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="M0 290 C80 250 130 170 210 160 C290 150 330 230 400 220 C470 210 500 110 590 86 C680 62 720 170 800 188 C880 206 930 130 1010 116 C1100 100 1150 196 1230 204 C1320 212 1360 120 1440 104 C1520 88 1570 160 1600 180 L1600 400 L0 400Z"/></svg>
        <i class="stage-mist stage-mist-a"></i>
        <svg class="hills hills-mid" viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="M0 320 C110 280 180 236 280 250 C380 264 420 300 520 280 C620 260 650 196 760 190 C870 184 900 270 1010 282 C1120 294 1180 214 1290 204 C1400 194 1460 266 1600 250 L1600 400 L0 400Z"/></svg>
        <i class="stage-mist stage-mist-b"></i>
        <svg class="hills hills-near" viewBox="0 0 1600 400" preserveAspectRatio="none"><path d="M0 352 C150 330 230 300 360 312 C490 324 560 350 700 340 C840 330 900 296 1040 300 C1180 304 1260 344 1400 336 C1500 330 1560 318 1600 322 L1600 400 L0 400Z"/></svg>
        <span class="drift">${[...Array(18).keys()].map((n) => html`<b style="--i:${n}"></b>`)}</span>
      </div>

      <figure class="stage-figure" aria-hidden="true">
        <picture><source type="image/avif" srcset="/images/confucius-salute-transparent-474.avif 474w, /images/confucius-salute-transparent-711.avif 711w, /images/confucius-salute-transparent-948.avif 948w" sizes="(max-width: 760px) 60vw, 420px"><source type="image/webp" srcset="/images/confucius-salute-transparent-474.webp 474w, /images/confucius-salute-transparent-711.webp 711w, /images/confucius-salute-transparent-948.webp 948w" sizes="(max-width: 760px) 60vw, 420px"><img src="/images/confucius-salute-transparent-474.png" alt="" width="948" height="1659" loading="eager" decoding="async" fetchpriority="high"></picture>
      </figure>

      <h1 class="stage-title" id="heroTitle" aria-label="诗经"><span aria-hidden="true">诗</span><span aria-hidden="true">经</span></h1>
      <p class="stage-verse" aria-hidden="true">${heroVerse.map((line, i) => html`<span style="--d:${i}">${line}</span>`)}</p>
      <div class="stage-seal" aria-hidden="true">思<br>无<br>邪</div>

      <div class="stage-copy">
        <p class="stage-kicker">中国最早的诗歌总集 · 三百零五篇</p>
        <p class="stage-desc">循风而歌，因雅而正，以颂为祭。越过两千五百年的光阴，在一卷宣纸间重新相逢。</p>
        <div class="stage-actions">
          <a href="/browse" class="btn btn-primary" data-nav="/browse">阅览篇章</a>
          <a href="/search" class="btn btn-outline" data-nav="/search">循句寻诗</a>
        </div>
      </div>

      <div class="stage-time" role="group" aria-label="时辰：山水随晨昼暮夜变色">
        ${TIMES.map((time) => html`<button type="button" data-time="${time}" aria-pressed="false" title="${TIME_LABELS[time]}">${TIME_LABELS[time]}</button>`)}
      </div>
      <a class="stage-cue" href="#unroll" aria-label="向下展卷"><span>展卷</span><i aria-hidden="true"></i></a>
    </section>

    <section class="unroll" id="unroll" aria-labelledby="dailyTitle">
      <div class="unroll-frame">
        <i class="unroll-roller unroll-roller-l" aria-hidden="true"></i>
        <div class="unroll-paper" id="dailyPoem"><p class="loading">展卷中……</p></div>
        <i class="unroll-roller unroll-roller-r" aria-hidden="true"></i>
      </div>
    </section>

    <section class="realms reveal" aria-labelledby="realmsTitle">
      <header class="realms-head"><p class="realms-kicker">风 · 雅 · 颂</p><h2 id="realmsTitle">三体六卷</h2><p>风出于土，雅成于朝，颂用于庙。</p></header>
      <div class="realms-row">
        ${realms.map((realm) => html`
          <article class="realm" data-glyph="${realm.glyph}">
            <span class="realm-glyph" aria-hidden="true">${realm.glyph}</span>
            <p class="realm-line">${realm.line}</p>
            <h3 class="realm-name">${realm.name}<small>${count(realm.keys)} 篇</small></h3>
            <p class="realm-note">${realm.note}</p>
            <p class="realm-links">${realm.keys.map((key) => html`<a href="/browse/${encodeURIComponent(key)}" data-nav="/browse/${key}">${key}</a>`)}</p>
          </article>`)}
      </div>
    </section>

    <section class="gallery reveal" aria-label="名句长廊">
      <div class="gallery-track" id="gallery">
        ${[0, 1].map((copy) => html`<p class="gallery-row" ${copy ? raw('aria-hidden="true"') : ""}>${famous.map(([, line]) => html`<span>${line}</span>`)}</p>`)}
      </div>
    </section>

    <section class="section catalog reveal" aria-labelledby="catalogTitle">
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
  const stopTime = setupTimeSwitch();
  const reveal = observeReveal();
  loadCategoryPoems();
  return () => { reveal?.disconnect(); stopTime(); };
}

function setupTimeSwitch() {
  const group = document.querySelector(".stage-time");
  const sync = () => group?.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.time === currentTime())));
  group?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-time]") : null;
    if (button instanceof HTMLElement && button.dataset.time) setTime(button.dataset.time);
  });
  window.addEventListener("shijing:ambience", sync);
  sync();
  return () => window.removeEventListener("shijing:ambience", sync);
}

function observeReveal() {
  const items = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("in")); return null; }
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
  }), { rootMargin: "0px 0px -6% 0px" });
  items.forEach((el) => io.observe(el));
  return io;
}

function renderDaily(poems) {
  const target = document.getElementById("dailyPoem");
  if (!target || !poems.length) return;
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
  const poem = poems[day % poems.length];
  const random = poems[(day * 7 + Math.floor(Math.random() * poems.length)) % poems.length];
  const stanza = (poem.content[0] || "").replace(/\s+/g, "");
  const clauses = stanza.split(/[，。！？；、：]/).map((part) => part.trim()).filter(Boolean).slice(0, 6);
  setHtml(target, html`
    <div class="daily-verse" aria-hidden="true">${clauses.map((line, i) => html`<span style="--d:${i}">${line}</span>`)}</div>
    <div class="daily-info">
      <p class="daily-kicker">今日一诗 · ${now.getMonth() + 1} 月 ${now.getDate()} 日</p>
      <h2 class="daily-title" id="dailyTitle">${poem.title}</h2>
      <p class="daily-meta">诗序 ${String(poem.id).padStart(3, "0")} · ${poem.chapter} · ${poem.section}</p>
      <p class="daily-lines">${stanza}</p>
      <div class="daily-actions">
        <a href="/poem/${poem.id}" class="btn btn-primary" data-nav="/poem/${poem.id}">诵读全篇</a>
        <a href="/poem/${random.id}" class="btn btn-outline" data-nav="/poem/${random.id}">随缘翻一篇</a>
      </div>
    </div>
    <span class="daily-seal" aria-hidden="true">今日</span>`);
}

function renderGallery(poems) {
  const track = document.getElementById("gallery");
  if (!track) return;
  const byTitle = new Map(poems.map((poem) => [poem.title, poem]));
  const items = famous.map(([title, line]) => ({ line, title, poem: byTitle.get(title) }));
  setHtml(track, html`${[0, 1].map((copy) => html`<p class="gallery-row" ${copy ? raw('aria-hidden="true"') : ""}>${items.map((item) => item.poem
    ? html`<a href="/poem/${item.poem.id}" data-nav="/poem/${item.poem.id}" ${copy ? raw('tabindex="-1"') : ""}>${item.line}<small>《${item.title}》</small></a>`
    : html`<span>${item.line}<small>《${item.title}》</small></span>`)}</p>`)}`);
}

async function loadCategoryPoems() {
  const poems = await getPoemIndex();
  renderDaily(poems);
  renderGallery(poems);
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
