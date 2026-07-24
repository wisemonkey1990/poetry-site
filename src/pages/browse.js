import { escapeHtml } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import categories from "../data/categories.json";
import { getPoems } from "../services/poems.js";

const glyphs = { "国风": "风", "小雅": "雅", "大雅": "雅", "周颂": "颂", "鲁颂": "颂", "商颂": "颂" };

export function renderBrowse() {
  const html = `
    <header class="page-header"><p class="page-eyebrow">BOOK OF SONGS</p><h1>篇章</h1><p>风出于土，雅成于朝，颂用于庙。由六卷入诗三百。</p></header>
    <div class="category-grid">
      ${categories.map((cat) => `
        <a href="#/browse/${cat.key}" class="card category-card" data-glyph="${glyphs[cat.key]}" data-nav="/browse/${cat.key}">
	          <span class="category-card-count">卷 · ${cat.poemCount} 篇</span>
	          <h3>${escapeHtml(cat.name)}</h3><p>${escapeHtml(cat.description)}</p>
	          <div class="section-tags">${cat.sections.slice(0, 4).map((sec) => `<span class="tag">${escapeHtml(sec.name)}</span>`).join("")}${cat.sections.length > 4 ? `<span class="tag">余 ${cat.sections.length - 4} 部</span>` : ""}</div>
	        </a>`).join("")}
    </div>`;
  setupShell(); renderShell(html); return () => {};
}

export async function renderCategory({ category }) {
  setupShell();
  renderShell(`<div class="loading page-loading">展卷中……</div>`);
  const poems = await getPoems();
  const data = categories.find((item) => item.key === category);
  if (!data) { setupShell(); renderShell(`<div class="empty-state">未找到此篇章</div>`); return () => {}; }
  const html = `
    <header class="page-header"><a href="#/browse" class="back-link" data-nav="/browse">← 返回篇章</a><p class="page-eyebrow">${glyphs[data.key]} · ${data.poemCount} 篇</p><h1>${escapeHtml(data.name)}</h1><p>${escapeHtml(data.description)}</p></header>
    <div class="section-list">
      ${data.sections.map((section) => `
        <details class="section-group" open>
          <summary class="section-summary"><h3>${escapeHtml(section.name)}</h3><span class="tag">${section.poemCount} 篇</span></summary>
          <div class="poem-list">${section.poemIds.map((id) => {
            const poem = poems.find((item) => item.id === id);
            return poem ? `<a href="#/poem/${poem.id}" class="poem-list-item" data-nav="/poem/${poem.id}"><span class="poem-index">${String(poem.id).padStart(3, "0")}</span><span class="poem-title">${escapeHtml(poem.title)}</span><span class="poem-preview">${escapeHtml(poem.content[0])}</span></a>` : "";
          }).join("")}</div>
        </details>`).join("")}
    </div>`;
  setupShell(); renderShell(html); return () => {};
}

export function setupBrowse() {}
