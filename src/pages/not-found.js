import { html } from "../utils/html.js";
import { renderShell, setupShell } from "../components/app-shell.js";
import { updateSeo } from "../utils/seo.js";

export function renderNotFound() {
  updateSeo({ title: "未找到页面 · 诗三百", description: "该页面不存在。", noindex: true });
  setupShell();
  renderShell(html`<div class="empty-state"><div class="empty-icon">佚</div><p>此页已佚，未能寻得。</p><a href="/" class="btn btn-primary" data-nav="/">返回首页</a> <a href="/browse" class="btn btn-outline" data-nav="/browse">阅览篇章</a></div>`);
  return () => {};
}
