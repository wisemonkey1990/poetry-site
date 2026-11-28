import { html, setHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import categories from "../data/categories.json";
import { getPoemIndex } from "../services/poems.js";
import { sceneFor } from "../utils/ink-scene.js";
import { updateSeo } from "../utils/seo.js";
import { chineseNumber } from "../utils/chinese-number.js";
import { songPaintingFor } from "../utils/song-art.js";

/** 缩略图上的四段：国风、小雅、大雅、颂 */
const GROUPS = [
  { name: "国风", keys: ["国风"] },
  { name: "小雅", keys: ["小雅"] },
  { name: "大雅", keys: ["大雅"] },
  { name: "颂", keys: ["周颂", "鲁颂", "商颂"] },
];

/** 长卷上的一行题记：首章第一句（到句号为止，最多十字），逗号换成空格 */
export function scrollLine(stanza) {
  const sentence = String(stanza ?? "").split(/[。！？；]/u)[0] ?? "";
  const chars = Array.from(sentence.replace(/[，、：]/gu, "　"));
  const out = chars.slice(0, 10).join("").trim();
  return chars.length > 10 ? `${out}……` : out;
}

/** 每卷一段山水：按卷里诗的意象挑一种前景，远山错开位置，避免一段段重复 */
function sectionArt(poems, index) {
  const scene = sceneFor({ id: index * 37 + 11, title: "", content: poems.map((poem) => poem.content?.[0] ?? "") });
  return { plant: scene.plants[0] ?? "", water: scene.water, mountain: index % 3 === 0 ? "peaks" : index % 3 === 1 ? "hills" : "distant" };
}

export async function renderScroll() {
  updateSeo({ title: "长卷 · 诗经三百零五篇 · 诗三百", description: "把《诗经》三百零五篇题写在一幅水墨长卷上，自右向左徐徐展开。" });
  setupShell();
  renderShell(html`
    <section class="handscroll" aria-labelledby="scrollTitle">
      <header class="hs-head">
        <h1 id="scrollTitle">长卷</h1>
        <p>三百零五篇，一卷展尽。自右向左，滚动鼠标或左右滑动，点篇名展读。</p>
      </header>
      <div class="hs-frame">
        <i class="hs-roller hs-roller-r" aria-hidden="true"></i>
        <div class="hs-track" id="hsTrack" tabindex="0" role="region" aria-label="诗经长卷，可左右滚动"><p class="loading">展卷中……</p></div>
        <i class="hs-roller hs-roller-l" aria-hidden="true"></i>
      </div>
      <nav class="hs-mini" id="hsMini" aria-label="长卷缩略">
        ${GROUPS.map((group) => html`<button type="button" data-group="${group.name}" style="flex:${categories.filter((c) => group.keys.includes(c.key)).reduce((n, c) => n + c.poemCount, 0)}"><span>${group.name}</span></button>`)}
        <i class="hs-window" id="hsWindow" aria-hidden="true"></i>
      </nav>
    </section>`);
  const poems = await getPoemIndex();
  const byId = new Map(poems.map((poem) => [poem.id, poem]));
  const track = document.getElementById("hsTrack");
  if (!track) return () => {};
  let sectionIndex = 0;
  setHtml(track, html`<div class="hs-strip">${categories.map((cat) => cat.sections.map((section) => {
    const list = section.poemIds.map((id) => byId.get(id)).filter(Boolean);
    const index = sectionIndex++;
    const art = sectionArt(list, index);
    const painted = list.map((poem) => songPaintingFor(poem.id)).filter(Boolean);
    return html`
      <div class="hs-section" data-group="${GROUPS.find((g) => g.keys.includes(cat.key))?.name ?? ""}" data-mountain="${art.mountain}" style="--o:${(index * 397) % 1000}px">
        <i class="ink-layer hs-far" aria-hidden="true"></i>
        <i class="ink-layer hs-hills" aria-hidden="true"></i>
        ${art.water ? html`<i class="ink-layer hs-water" aria-hidden="true"></i>` : ""}
        ${art.plant && !painted.length ? html`<i class="ink-layer hs-plant ink-${art.plant}" aria-hidden="true"></i>` : ""}
        ${painted.length ? html`<i class="hs-song-bg" aria-hidden="true" style="background-image:url(${painted[0].artSmall})"></i>` : ""}
        <header class="hs-section-head">
          <h2>${section.name}</h2>
          <p>${cat.name} · ${chineseNumber(list.length)}篇</p>
          <span class="hs-seal" aria-hidden="true">${cat.key.slice(-1)}${chineseNumber(index + 1)}</span>
        </header>
        <ol class="hs-poems">
          ${list.map((poem) => html`<li><a href="/poem/${poem.id}" data-nav="/poem/${poem.id}" aria-label="${poem.title}：${scrollLine(poem.content?.[0])}"><b>${poem.title}</b><span aria-hidden="true">${scrollLine(poem.content?.[0])}</span><em aria-hidden="true">${chineseNumber(poem.id)}</em>${songPaintingFor(poem.id) ? html`<i class="hs-song" title="有南宋马和之画">画</i>` : ""}</a></li>`)}
        </ol>
      </div>`;
  }))}</div>`);
  return bindScroll(track);
}

function bindScroll(track) {
  const windowEl = document.getElementById("hsWindow");
  const mini = document.getElementById("hsMini");
  // 竖向滚轮转成横向：往下滚，长卷向左展开（rtl 滚动区 scrollLeft 从 0 往负数走）
  const onWheel = (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const max = track.scrollWidth - track.clientWidth;
    const pos = -track.scrollLeft;
    if ((event.deltaY > 0 && pos >= max - 1) || (event.deltaY < 0 && pos <= 0)) return;
    event.preventDefault();
    track.scrollBy({ left: -event.deltaY * 1.4 });
  };
  const sync = () => {
    if (!windowEl) return;
    const total = track.scrollWidth;
    const width = Math.max(0.02, track.clientWidth / total);
    const from = -track.scrollLeft / total;
    windowEl.style.setProperty("--w", String(width));
    windowEl.style.setProperty("--x", String(from));
  };
  // 点缩略条上的一段：跳到那一卷的开头
  const onMini = (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-group]") : null;
    const target = button instanceof HTMLElement ? track.querySelector(`.hs-section[data-group="${button.dataset.group}"]`) : null;
    if (!(target instanceof HTMLElement)) return;
    const trackRect = track.getBoundingClientRect();
    track.scrollBy({ left: target.getBoundingClientRect().right - trackRect.right, behavior: "smooth" });
  };
  track.addEventListener("wheel", onWheel, { passive: false });
  track.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  mini?.addEventListener("click", onMini);
  requestAnimationFrame(sync);
  return () => { window.removeEventListener("resize", sync); };
}

export function setupScroll() {}
