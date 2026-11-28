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
/** 竖排诗句逐字成块 */
const chars = (line) => Array.from(line).map((ch) => html`<i>${ch}</i>`);
const count = (keys) => categories.filter((c) => keys.includes(c.key)).reduce((sum, c) => sum + c.poemCount, 0);

export function renderHome() {
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const markup = html`
    <section class="stage" aria-labelledby="heroTitle">
      <div class="stage-art" aria-hidden="true">
        <i class="stage-stars"></i>
        <i class="stage-orb"></i>
        <svg class="stage-birds" viewBox="0 0 120 40"><path d="M4 20q6-8 12 0q6-8 12 0M44 9q5-6 10 0q5-6 10 0M78 26q4-5 8 0q4-5 8 0"/></svg>
        <i class="ink-layer stage-far"></i>
        <i class="stage-mist stage-mist-a"></i>
        <i class="ink-layer stage-peaks"></i>
        <i class="stage-mist stage-mist-b"></i>
        <i class="ink-layer stage-near"></i>
        <span class="drift">${[...Array(14).keys()].map((n) => html`<b style="--i:${n}"></b>`)}</span>
      </div>

      <div class="stage-figure" aria-hidden="true"><i class="ink-layer figure-fill"></i><i class="ink-layer figure-line"></i></div>

      <p class="stage-verse" aria-hidden="true"><span class="stage-verse-title">${chars("周南·关雎")}</span>${heroVerse.map((line, i) => html`<span style="--d:${i}">${chars(line)}</span>`)}</p>
      <h1 class="stage-title" id="heroTitle" aria-label="诗经"><span aria-hidden="true">诗</span><span aria-hidden="true">经</span></h1>
      <p class="stage-sub" aria-hidden="true">${chars("诗三百")}<i class="gap"></i>${chars("思无邪")}</p>
      <div class="stage-seal" aria-hidden="true"><span>思无邪印</span></div>

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
      <a class="stage-cue" href="#unroll" aria-label="展卷：今日一诗"><span class="stage-cue-seal" aria-hidden="true">展</span><span class="stage-cue-text" aria-hidden="true">展卷而读</span><i aria-hidden="true"></i></a>
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
            <i class="ink-layer realm-art" aria-hidden="true"></i>
            <span class="realm-glyph" aria-hidden="true">${realm.glyph}</span>
            <p class="realm-line">${realm.line}</p>
            <h3 class="realm-name">${realm.name}<small>${count(realm.keys)} 篇</small></h3>
            <p class="realm-note">${realm.note}</p>
            <p class="realm-links">${realm.keys.map((key) => html`<a href="/browse/${encodeURIComponent(key)}" data-nav="/browse/${key}">${key}</a>`)}</p>
          </article>`)}
      </div>
    </section>

    <a class="scroll-entry reveal" href="/scroll" data-nav="/scroll">
      <span class="scroll-entry-art" aria-hidden="true"><i class="ink-layer"></i><i class="ink-layer"></i></span>
      <span class="scroll-entry-text"><small>另一种读法</small><strong>展开长卷</strong><span>三百零五篇题写在一幅水墨长卷上，自右向左，一卷读尽。</span></span>
      <span class="scroll-entry-seal" aria-hidden="true">卷</span>
    </a>

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
    <div class="daily-verse" aria-hidden="true">${clauses.map((line, i) => html`<span style="--d:${i}">${chars(line)}</span>`)}</div>
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
