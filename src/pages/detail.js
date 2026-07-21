import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { toRubyHTML } from "../utils/pinyin.js";
import { isFavorite, toggleFavorite } from "../utils/storage.js";
import { sharePoem } from "../utils/share.js";

const icon = {
  pinyin: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>`,
  favorite: (filled) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>`,
  share: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>`
};

export async function renderDetail({ id }) {
  const poems = (await import("../data/poems.json")).default;
  const poem = poems.find((item) => item.id === Number(id));
  if (!poem) { setupShell(); renderShell(`<div class="empty-state">未找到此诗</div>`); return () => {}; }
  const showPinyin = localStorage.getItem("shijing_show_pinyin") !== "false";
  const favorited = isFavorite(poem.id);
  const previous = poems[poem.id - 2];
  const next = poems[poem.id];
  const html = `
    <article class="poem-page">
      <header class="poem-header">
        <a href="#/browse/${poem.chapter}" class="poem-breadcrumb" data-nav="/browse/${poem.chapter}">${poem.chapter}<span>·</span>${poem.section}</a>
        <div class="poem-title-row"><h1>${poem.title}</h1><div class="poem-actions">
          <button class="btn btn-ghost pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggle" title="切换拼音" aria-pressed="${showPinyin}">${icon.pinyin}</button>
          <button class="btn btn-ghost fav-btn ${favorited ? "favorited" : ""}" id="favBtn" title="${favorited ? "取消收藏" : "收藏"}" aria-pressed="${favorited}">${icon.favorite(favorited)}</button>
          <button class="btn btn-ghost" id="shareBtn" title="分享">${icon.share}</button>
        </div></div>
        <div class="poem-tags"><span class="tag">诗序 ${String(poem.id).padStart(3, "0")}</span><span class="tag">${poem.chapter} · ${poem.section}</span></div>
      </header>
      <section class="poem-paper"><div class="poem-body ${showPinyin ? "" : "hide-pinyin"}" id="poemBody">${poem.content.map((line) => `<p class="poem-line">${toRubyHTML(line)}</p>`).join("")}</div></section>
      <div class="reading-tools"><button class="btn btn-ghost pinyin-toggle ${showPinyin ? "active" : ""}" id="pinyinToggleSecondary">${icon.pinyin}<span>${showPinyin ? "隐藏拼音" : "显示拼音"}</span></button></div>
      <div class="poem-notes-grid">
        <section class="poem-annotations"><h2 class="note-heading">注释</h2>${poem.annotation ? `<div class="annotation-content">${poem.annotation}</div>` : `<p class="text-muted">此篇注释尚在整理。</p>`}</section>
        <section class="poem-translation"><h2 class="note-heading">今译</h2>${poem.translation ? `<div class="translation-content">${poem.translation}</div>` : `<p class="text-muted">此篇译文尚在整理。</p>`}</section>
      </div>
      <nav class="poem-nav" aria-label="诗篇导航">${previous ? `<a href="#/poem/${previous.id}" class="btn btn-outline" data-nav="/poem/${previous.id}"><span>← 上一篇</span><strong>${previous.title}</strong></a>` : `<span></span>`}${next ? `<a href="#/poem/${next.id}" class="btn btn-outline" data-nav="/poem/${next.id}"><strong>${next.title}</strong><span>下一篇 →</span></a>` : `<span></span>`}</nav>
    </article>`;
  setupShell(); renderShell(html); bindActions(poem); return () => {};
}

function bindActions(poem) {
  const toggles = [document.getElementById("pinyinToggle"), document.getElementById("pinyinToggleSecondary")].filter(Boolean);
  toggles.forEach((button) => button.addEventListener("click", () => {
    const body = document.getElementById("poemBody");
    const hidden = body.classList.toggle("hide-pinyin");
    localStorage.setItem("shijing_show_pinyin", String(!hidden));
    toggles.forEach((item) => { item.classList.toggle("active", !hidden); item.setAttribute("aria-pressed", String(!hidden)); const label = item.querySelector("span"); if (label) label.textContent = hidden ? "显示拼音" : "隐藏拼音"; });
  }));
  document.getElementById("favBtn")?.addEventListener("click", () => {
    const added = toggleFavorite(poem.id); const button = document.getElementById("favBtn");
    button.classList.toggle("favorited", added); button.setAttribute("aria-pressed", String(added)); button.title = added ? "取消收藏" : "收藏"; button.innerHTML = icon.favorite(added); updateNav(); showToast(added ? "已收入藏诗" : "已移出藏诗");
  });
  document.getElementById("shareBtn")?.addEventListener("click", async () => {
    const result = await sharePoem(`《诗经·${poem.title}》`, poem.content.slice(0, 2).join("\n"), window.location.href);
    if (result === "copied") showToast("诗篇链接已复制"); else if (!result) showToast("分享未完成");
  });
}

function showToast(message) { const toast = document.getElementById("toast"); if (!toast) return; toast.textContent = message; toast.classList.add("show"); clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.classList.remove("show"), 1800); }
export function setupDetail() {}
