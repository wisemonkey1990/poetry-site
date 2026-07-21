import { adminListPoems } from "../../services/poems.js";
import { adminError, escapeHtml, prepareAdminPage } from "./layout.js";

let state = { page: 1, search: "", filter: "" };

export async function renderAdminPoems() {
  const main = await prepareAdminPage("poems"); if (!main) return () => {};
  state = { page: 1, search: "", filter: "" };
  main.innerHTML = `<div class="admin-page"><div class="admin-page-heading"><div><p class="page-eyebrow">CONTENT</p><h2>诗篇管理</h2><p class="page-desc">编辑、发布和检索诗篇数据</p></div><a class="btn-primary" href="#/admin/poems/new">＋ 新增诗篇</a></div>
  <div class="toolbar"><input class="search-input" id="adminPoemSearch" placeholder="搜索题目、章卷或小节"><select id="adminPoemFilter"><option value="">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select><button class="btn-secondary" id="adminPoemSearchButton">查询</button></div>
  <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ID</th><th>题目</th><th>章卷</th><th>小节</th><th>排序</th><th>状态</th><th>更新</th><th>操作</th></tr></thead><tbody id="adminPoemRows"></tbody></table></div><div class="pagination" id="adminPagination"></div></div>`;
  bindControls(); await loadRows(); return () => {};
}

function bindControls() {
  const search = document.getElementById("adminPoemSearch"); const filter = document.getElementById("adminPoemFilter");
  const apply = () => { state.page = 1; state.search = search.value.trim(); state.filter = filter.value; loadRows(); };
  document.getElementById("adminPoemSearchButton").addEventListener("click", apply);
  search.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });
  filter.addEventListener("change", apply);
}

async function loadRows() {
  const target = document.getElementById("adminPoemRows"); target.innerHTML = `<tr><td colspan="8"><div class="loading">加载中……</div></td></tr>`;
  try {
    const isPublished = state.filter === "published" ? true : state.filter === "draft" ? false : undefined;
    const result = await adminListPoems({ page: state.page, pageSize: 20, search: state.search, isPublished });
    target.innerHTML = result.data.length ? result.data.map((poem) => `<tr><td>${poem.id}</td><td><strong>${escapeHtml(poem.title)}</strong></td><td>${escapeHtml(poem.chapter)}</td><td>${escapeHtml(poem.section)}</td><td>${poem.sort_order}</td><td><span class="badge ${poem.is_published ? "published" : "draft"}">${poem.is_published ? "已发布" : "草稿"}</span></td><td>${poem.updated_at ? new Date(poem.updated_at).toLocaleDateString("zh-CN") : "—"}</td><td><a href="#/admin/poems/${poem.id}">编辑</a></td></tr>`).join("") : `<tr><td colspan="8"><div class="empty-state">未找到诗篇</div></td></tr>`;
    renderPagination(result.total, result.pageSize);
  } catch (error) { document.getElementById("adminMain").innerHTML = adminError(error.message); }
}

function renderPagination(total, pageSize) {
  const pages = Math.ceil(total / pageSize); const root = document.getElementById("adminPagination");
  root.innerHTML = pages > 1 ? `<button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${state.page} / ${pages} 页 · 共 ${total} 篇</span><button data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一页</button>` : `<span>共 ${total} 篇</span>`;
  root.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); loadRows(); }));
}