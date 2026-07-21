import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { toTitleRubyHTML } from "../utils/pinyin.js";
import { getFavorites, removeFavorite } from "../utils/storage.js";

export async function renderFavorites() {
  const ids = getFavorites();
  const poems = (await import("../data/poems.json")).default;
  const favorites = poems.filter((poem) => ids.includes(poem.id));
  const html = `
    <header class="page-header"><p class="page-eyebrow">COLLECTED VERSES</p><h1>藏诗</h1><p>${favorites.length ? `已收录 ${favorites.length} 篇，留待清夜重读。` : "尚未收录诗篇。"}</p></header>
    ${favorites.length ? `<div class="fav-list">${favorites.map((poem) => `
      <article class="card fav-item" data-id="${poem.id}"><a href="#/poem/${poem.id}" class="fav-item-content" data-nav="/poem/${poem.id}"><h4>${toTitleRubyHTML(poem.title)}</h4><p class="poem-excerpt">${poem.content[0]}</p><div class="poem-meta"><span class="tag">${poem.chapter}</span><span class="tag">${poem.section}</span></div></a><button class="btn btn-ghost remove-fav" data-id="${poem.id}" title="移出藏诗" aria-label="将${poem.title}移出藏诗"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6 6 18"/></svg></button></article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">藏</div><p>遇见心有所感的诗篇，点下星标便可收录于此。</p><a href="#/browse" class="btn btn-primary" data-nav="/browse">前往篇章</a></div>`}`;
  setupShell(); renderShell(html);
  document.querySelectorAll(".remove-fav").forEach((button) => button.addEventListener("click", () => { removeFavorite(Number(button.dataset.id)); updateNav(); renderFavorites(); }));
  return () => {};
}
export function setupFavorites() {}
