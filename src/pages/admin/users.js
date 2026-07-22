import { deleteUserProfile, listUserProfiles } from "../../services/users.js";
import { adminError, escapeHtml, prepareAdminPage } from "./layout.js";

let state = { page: 1, search: "", status: null };

export async function renderAdminUsers() {
  const main = await prepareAdminPage("users");
  if (!main) return () => {};
  state = { page: 1, search: "", status: null };
  main.innerHTML = `<div class="admin-page">
    <div class="admin-page-heading"><div><p class="page-eyebrow">MEMBERS</p><h2>用户管理</h2><p class="page-desc">管理已有登录账号对应的公开资料，不操作账号密码或收藏数据</p></div><a class="btn-primary" href="#/admin/users/new">＋ 新增资料</a></div>
    <div class="admin-notice">新增资料前，请先在 Supabase Authentication → Users 中确认登录账号已存在，并复制 User UID。</div>
    <div class="toolbar"><input class="search-input" id="adminUserSearch" placeholder="搜索昵称、邮箱或用户 UUID"><select id="adminUserStatus"><option value="">全部状态</option><option value="1">正常</option><option value="0">停用</option></select><button class="btn-secondary" id="adminUserSearchButton">查询</button></div>
    <div class="admin-table-wrap"><table class="admin-table user-table"><thead><tr><th>用户</th><th>邮箱</th><th>状态</th><th>收藏</th><th>注册时间</th><th>更新时间</th><th>操作</th></tr></thead><tbody id="adminUserRows"></tbody></table></div>
    <div class="pagination" id="adminUserPagination"></div>
  </div>`;
  bindControls();
  await loadRows();
  return () => {};
}

function bindControls() {
  const search = document.getElementById("adminUserSearch");
  const status = document.getElementById("adminUserStatus");
  const apply = () => {
    state.page = 1; state.search = search.value.trim(); state.status = status.value === "" ? null : Number(status.value); loadRows();
  };
  document.getElementById("adminUserSearchButton")?.addEventListener("click", apply);
  search?.addEventListener("keydown", (event) => { if (event.key === "Enter") apply(); });
  status?.addEventListener("change", apply);
}

async function loadRows() {
  const target = document.getElementById("adminUserRows");
  target.innerHTML = `<tr><td colspan="7"><div class="loading">加载中……</div></td></tr>`;
  try {
    const result = await listUserProfiles({ page: state.page, pageSize: 20, search: state.search, status: state.status });
    target.innerHTML = result.items.length ? result.items.map(userRow).join("") : `<tr><td colspan="7"><div class="empty-state">未找到用户资料</div></td></tr>`;
    target.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", () => confirmDelete(button.dataset.deleteUser, button.dataset.nickname)));
    renderPagination(result.total, result.pageSize);
  } catch (error) {
    document.getElementById("adminMain").innerHTML = adminError(error.message);
  }
}

function userRow(user) {
  return `<tr><td><div class="user-cell"><span class="user-avatar">${escapeHtml((user.nickname || "用").slice(0, 1))}</span><div><strong>${escapeHtml(user.nickname)}</strong><small title="${escapeHtml(user.id)}">${escapeHtml(shortId(user.id))}</small></div></div></td><td>${escapeHtml(user.email || "—")}</td><td><span class="badge ${user.status === 1 ? "published" : "draft"}">${user.status === 1 ? "正常" : "停用"}</span></td><td>${Number(user.favorite_count || 0)} 篇</td><td>${formatDate(user.created_at)}</td><td>${formatDate(user.updated_at)}</td><td><div class="table-actions"><a href="#/admin/users/${user.id}">编辑</a><button type="button" class="link-danger" data-delete-user="${user.id}" data-nickname="${escapeHtml(user.nickname)}">删除资料</button></div></td></tr>`;
}

function renderPagination(total, pageSize) {
  const pages = Math.ceil(total / pageSize);
  const root = document.getElementById("adminUserPagination");
  root.innerHTML = pages > 1 ? `<button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${state.page} / ${pages} 页 · 共 ${total} 位</span><button data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一页</button>` : `<span>共 ${total} 位</span>`;
  root.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); loadRows(); }));
}

function confirmDelete(userId, nickname) {
  const dialog = document.createElement("div");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `<div class="confirm-dialog-box"><h3>删除用户资料？</h3><p>将删除“${escapeHtml(nickname)}”的公开资料，但不会删除登录账号、密码或收藏记录。用户下次登录时可能需要重新创建资料。</p><div class="btn-group"><button class="btn-cancel" type="button">取消</button><button class="btn-danger" type="button">确认删除</button></div></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector(".btn-cancel").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".btn-danger").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { await deleteUserProfile(userId); dialog.remove(); await loadRows(); }
    catch (error) { alert(error.message); event.currentTarget.disabled = false; }
  });
}

const shortId = (value) => value ? `${value.slice(0, 8)}…${value.slice(-4)}` : "—";
const formatDate = (value) => value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "—";
