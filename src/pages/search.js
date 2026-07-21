import { renderShell, setupShell } from "../components/app-shell.js";
import { searchPoems } from "../utils/search.js";
import { getPoems } from "../services/poems.js";

export async function renderSearch(params, query) {
  const keyword = query.q || "";
  const poems = keyword ? await getPoems() : [];
  const results = keyword ? searchPoems(poems, keyword) : [];
  const html = `<div class="search-shell">
    <header class="page-header"><p class="page-eyebrow">SEARCH THE VERSES</p><h1>寻诗</h1><p>可寻诗题、诗句与章卷。试试「关关」「蒹葭」或「君子」。</p></header>
    <div class="search-area"><label class="search-box" for="searchInput"><svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="searchInput" type="search" placeholder="输入诗题或诗句……" value="${escapeHtml(keyword)}" autocomplete="off" /><span class="tag">回车寻诗</span></label></div>
    ${keyword ? `<section class="search-results"><p class="result-count">“${escapeHtml(keyword)}” · 共寻得 ${results.length} 篇</p>${results.length ? `<div class="search-result-list">${results.map((poem) => `<a href="#/poem/${poem.id}" class="card poem-card" data-nav="/poem/${poem.id}"><div class="poem-card-header"><h4>${poem.title}</h4><span class="tag">${poem.chapter} · ${poem.section}</span></div><p class="poem-excerpt">${highlightMatch(poem.content[0], keyword)}</p></a>`).join("")}</div>` : `<div class="no-result">未寻得相合诗篇，请换一词再试。</div>`}</section>` : `<div class="search-hint"><p>轻启墨卷，以一字寻一诗。</p></div>`}
  </div>`;
  setupShell(); renderShell(html); bindSearch(); return () => {};
}

function bindSearch() {
  const input = document.getElementById("searchInput"); if (!input) return;
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); const value = input.value.trim(); window.location.hash = value ? `#/search?q=${encodeURIComponent(value)}` : "#/search"; } });
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
}
function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function highlightMatch(text, keyword) { const escaped = escapeHtml(text); const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return escaped.replace(new RegExp(`(${safe})`, "gi"), "<mark>$1</mark>"); }
export function setupSearch() {}
