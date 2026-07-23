import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { toRubyHTML } from "../utils/pinyin.js";
import { convertLines } from "../utils/text-convert.js";
import { getCurrentUser } from "../services/auth.js";
import { isFavorite, toggleFavorite } from "../services/favorites.js";
import { sharePoem } from "../utils/share.js";
import { getPoems, getPoemById } from "../services/poems.js";

const icon = {
  pinyin: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
  layout: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 4h14v16H5zM9.5 4v16M14.5 4v16"/><path d="m7.2 7 1.1 1.2L7.2 9.4m5-2.4 1.1 1.2-1.1 1.2m5-2.4 1.1 1.2-1.1 1.2"/></svg>`,
  script: (traditional) => `<span class="script-icon" aria-hidden="true">${traditional ? "简" : "繁"}</span>`,
  favorite: (filled) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  share: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>`
};

function escapeAttr(value) {
  return String(value).replace(/[&"']/g, (char) => ({ "&": "&amp;", '"': "&quot;", "'": "&#39;" })[char]);
}

export async function renderDetail({ id }) {
  const poems = await getPoems();
  const poem = await getPoemById(Number(id));
  if (!poem) { setupShell(); renderShell(`<div class="empty-state">未找到此诗</div>`); return () => {}; }
  const useTraditional = localStorage.getItem("shijing_script") === "traditional";
  const showPinyin = localStorage.getItem("shijing_show_pinyin") !== "false";
  const readingLayout = localStorage.getItem("shijing_reading_layout") === "vertical" ? "vertical" : "horizontal";
  const favorited = getCurrentUser() ? await isFavorite(poem.id) : false;
  const currentIndex = poems.findIndex((item) => item.id === poem.id);
  const previous = currentIndex > 0 ? poems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? poems[currentIndex + 1] : null;

  let displayContent = [...poem.content];
  let displayTitle = poem.title;
  if (useTraditional) {
    const [bodyResult, titleResult] = await Promise.all([
      convertLines(poem.content, "s2t"),
      convertLines([poem.title], "s2t")
    ]);
    displayContent = bodyResult.lines;
    displayTitle = titleResult.lines[0];
  }
  const html = `
    <article class="poem-page">
      <header class="poem-header">
        <a href="#/browse/${poem.chapter}" class="poem-breadcrumb" data-nav="/browse/${poem.chapter}">${poem.chapter}<span>·</span>${poem.section}</a>
        <div class="poem-title-row"><h1 class="${Array.from(displayTitle).length >= 5 ? "long-title" : ""}">${displayTitle}</h1><div class="poem-actions">
          <button class="btn btn-ghost pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggle" title="切换拼音" aria-pressed="${showPinyin}">${icon.pinyin}</button>
          <button class="btn btn-ghost layout-toggle ${readingLayout === "vertical" ? "active" : ""}" id="layoutToggle" title="${readingLayout === "vertical" ? "切换为横排" : "切换为竖排"}" aria-label="${readingLayout === "vertical" ? "切换为横排阅读" : "切换为竖排阅读"}" aria-pressed="${readingLayout === "vertical"}">${icon.layout}</button>
          <button class="btn btn-ghost script-toggle ${useTraditional ? "active" : ""}" id="scriptToggle" title="${useTraditional ? "切换为简体" : "切换为繁体"}" aria-label="${useTraditional ? "切换为简体中文" : "切换为繁体中文"}" aria-pressed="${useTraditional}">${icon.script(useTraditional)}</button>
          <button class="btn btn-ghost fav-btn ${favorited ? "favorited" : ""}" id="favBtn" title="${favorited ? "取消收藏" : "收藏"}" aria-pressed="${favorited}">${icon.favorite(favorited)}</button>
          <button class="btn btn-ghost" id="shareBtn" title="分享">${icon.share}</button>
        </div></div>
        <div class="poem-tags"><span class="tag">诗序 ${String(poem.id).padStart(3, "0")}</span><span class="tag">${poem.chapter} · ${poem.section}</span></div>
      </header>
      <section class="poem-paper layout-${readingLayout}" id="poemPaper" aria-label="诗篇正文" data-layout="${readingLayout}">
        <span class="book-edge book-edge-left" aria-hidden="true"></span>
        <span class="book-edge book-edge-right" aria-hidden="true"></span>
        <span class="book-spine" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <div class="poem-scroll" id="poemScroll" tabindex="${readingLayout === "vertical" ? "0" : "-1"}"><div class="poem-body ${showPinyin ? "" : "hide-pinyin"}" id="poemBody">${displayContent.map((line) => `<p class="poem-line" data-text="${escapeAttr(line)}">${toRubyHTML(line)}</p>`).join("")}</div></div>
      </section>
      <div class="reading-tools">
        <button class="btn btn-ghost pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggleSecondary">${icon.pinyin}<span>${showPinyin ? "隐藏拼音" : "显示拼音"}</span></button>
        <button class="btn btn-ghost layout-toggle ${readingLayout === "vertical" ? "active" : ""}" id="layoutToggleSecondary" aria-pressed="${readingLayout === "vertical"}">${icon.layout}<span>${readingLayout === "vertical" ? "切换横排" : "切换竖排"}</span></button>
        <button class="btn btn-ghost script-toggle ${useTraditional ? "active" : ""}" id="scriptToggleSecondary" aria-pressed="${useTraditional}">${icon.script(useTraditional)}<span class="tool-label">${useTraditional ? "切换简体" : "切换繁体"}</span></button>
      </div>

      <div class="poem-notes-grid">
        <section class="poem-annotations"><h2 class="note-heading">注释</h2>${poem.annotation ? `<div class="annotation-content">${poem.annotation}</div>` : `<p class="text-muted">此篇注释尚在整理。</p>`}</section>
        <section class="poem-translation"><h2 class="note-heading">今译</h2>${poem.translation ? `<div class="translation-content">${poem.translation}</div>` : `<p class="text-muted">此篇译文尚在整理。</p>`}</section>
      </div>
      <nav class="poem-nav" aria-label="诗篇导航">${previous ? `<a href="#/poem/${previous.id}" class="btn btn-outline" data-nav="/poem/${previous.id}"><span>← 上一篇</span><strong>${previous.title}</strong></a>` : `<span></span>`}${next ? `<a href="#/poem/${next.id}" class="btn btn-outline" data-nav="/poem/${next.id}"><strong>${next.title}</strong><span>下一篇 →</span></a>` : `<span></span>`}</nav>
    </article>`;
  setupShell(); renderShell(html); bindActions(poem);
  if (readingLayout === "vertical") requestAnimationFrame(() => { const scroll = document.getElementById("poemScroll"); if (scroll) scroll.scrollLeft = scroll.scrollWidth; });
  return () => {};
}

function bindActions(poem) {
  const pinyinToggles = [document.getElementById("pinyinToggle"), document.getElementById("pinyinToggleSecondary")].filter(Boolean);
  pinyinToggles.forEach((button) => button.addEventListener("click", () => {
    const body = document.getElementById("poemBody");
    const hidden = body.classList.toggle("hide-pinyin");
    localStorage.setItem("shijing_show_pinyin", String(!hidden));
    pinyinToggles.forEach((item) => { item.classList.toggle("active", !hidden); item.setAttribute("aria-pressed", String(!hidden)); const label = item.querySelector("span"); if (label) label.textContent = hidden ? "显示拼音" : "隐藏拼音"; });
  }));

  const scriptToggles = [document.getElementById("scriptToggle"), document.getElementById("scriptToggleSecondary")].filter(Boolean);
  scriptToggles.forEach((button) => button.addEventListener("click", async () => {
    const nextTraditional = localStorage.getItem("shijing_script") !== "traditional";
    for (const btn of scriptToggles) { btn.disabled = true; btn.classList.add("script-pending"); }
    try {
      const [bodyResult, titleResult] = nextTraditional
        ? await Promise.all([convertLines(poem.content, "s2t"), convertLines([poem.title], "s2t")])
        : [{ lines: [...poem.content] }, { lines: [poem.title] }];
      const body = document.getElementById("poemBody");
      const lines = body.querySelectorAll(".poem-line");
      for (let i = 0; i < lines.length; i++) {
        const text = bodyResult.lines[i];
        if (text != null) { lines[i].innerHTML = toRubyHTML(text); lines[i].dataset.text = text; }
      }
      const titleEl = document.querySelector(".poem-title-row h1");
      const convertedTitle = titleResult.lines[0];
      if (titleEl && convertedTitle) {
        titleEl.textContent = convertedTitle;
        titleEl.classList.toggle("long-title", Array.from(convertedTitle).length >= 5);
      }
      localStorage.setItem("shijing_script", nextTraditional ? "traditional" : "simplified");
      for (const btn of scriptToggles) {
        btn.classList.toggle("active", nextTraditional);
        btn.setAttribute("aria-pressed", String(nextTraditional));
        btn.title = nextTraditional ? "切换为简体" : "切换为繁体";
        btn.setAttribute("aria-label", nextTraditional ? "切换为简体中文" : "切换为繁体中文");
        const scriptIcon = btn.querySelector(".script-icon");
        if (scriptIcon) scriptIcon.textContent = nextTraditional ? "简" : "繁";
        const label = btn.querySelector(".tool-label");
        if (label) label.textContent = nextTraditional ? "切换简体" : "切换繁体";
      }
      showToast(nextTraditional ? "已切换为繁体中文" : "已切换为简体中文");
    } catch (err) { console.error("繁简转换失败", err); showToast("繁简转换暂不可用"); }
    finally { for (const btn of scriptToggles) { btn.disabled = false; btn.classList.remove("script-pending"); } }
  }));
  const layoutToggles = [document.getElementById("layoutToggle"), document.getElementById("layoutToggleSecondary")].filter(Boolean);
  layoutToggles.forEach((button) => button.addEventListener("click", () => {
    const paper = document.getElementById("poemPaper");
    const scroll = document.getElementById("poemScroll");
    const vertical = !paper.classList.contains("layout-vertical");
    paper.classList.toggle("layout-vertical", vertical);
    paper.classList.toggle("layout-horizontal", !vertical);
    paper.dataset.layout = vertical ? "vertical" : "horizontal";
    scroll?.setAttribute("tabindex", vertical ? "0" : "-1");
    localStorage.setItem("shijing_reading_layout", vertical ? "vertical" : "horizontal");
    layoutToggles.forEach((item) => {
      item.classList.toggle("active", vertical);
      item.setAttribute("aria-pressed", String(vertical));
      item.title = vertical ? "切换为横排" : "切换为竖排";
      item.setAttribute("aria-label", vertical ? "切换为横排阅读" : "切换为竖排阅读");
      const label = item.querySelector("span");
      if (label) label.textContent = vertical ? "切换横排" : "切换竖排";
    });
    requestAnimationFrame(() => { if (vertical && scroll) scroll.scrollLeft = scroll.scrollWidth; });
    showToast(vertical ? "已切换为古籍竖排" : "已切换为横排阅读");
  }));
  document.getElementById("favBtn")?.addEventListener("click", async () => {
    if (!getCurrentUser()) {
      sessionStorage.setItem("shijing_auth_redirect", window.location.hash || `#/poem/${poem.id}`);
      window.location.hash = "#/auth?mode=login";
      return;
    }
    const button = document.getElementById("favBtn");
    const currentlyFavorite = button.classList.contains("favorited");
    button.disabled = true;
    try {
      const added = await toggleFavorite(poem.id, currentlyFavorite);
      button.classList.toggle("favorited", added);
      button.setAttribute("aria-pressed", String(added));
      button.title = added ? "取消收藏" : "收藏";
      button.innerHTML = icon.favorite(added);
      showToast(added ? "已收入藏诗" : "已移出藏诗");
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    const result = await sharePoem(`《诗经·${poem.title}》`, poem.content.slice(0, 2).join("\n"), window.location.href);
    if (result === "copied") showToast("诗篇链接已复制"); else if (!result) showToast("分享未完成");
  });
}

function showToast(message) { const toast = document.getElementById("toast"); if (!toast) return; toast.textContent = message; toast.classList.add("show"); clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.classList.remove("show"), 1800); }
export function setupDetail() {}
