import { signOut } from "../../services/auth.js";
import { requireAdmin } from "../../services/admin.js";
import { escapeHtml, escapeAttribute } from "../../utils/html.js";

// 复用统一的 HTML 转义实现（包含单引号转义，比本地原实现更安全）
export { escapeHtml, escapeAttribute };

export async function prepareAdminPage(active) {
  if (!(await requireAdmin())) return null;
  const app = document.getElementById("app");
  app.innerHTML = `<div class="admin-layout">
    <header class="admin-topbar"><button class="admin-menu-toggle" id="adminMenu" aria-label="展开后台菜单">☰</button><h1>诗三百 · 管理</h1><a href="#/" aria-label="返回网站">返回前台</a></header>
    <div class="admin-overlay" id="adminOverlay"></div>
    <aside class="admin-sidebar" id="adminSidebar">
      <div class="admin-sidebar-header"><h1>诗三百</h1><p class="sub">内容与访客管理</p></div>
      <nav class="admin-sidebar-nav">
        <a href="#/admin/dashboard" class="${active === "dashboard" ? "active" : ""}"><span class="nav-icon">◇</span>仪表盘</a>
        <a href="#/admin/poems" class="${active === "poems" ? "active" : ""}"><span class="nav-icon">◎</span>诗篇管理</a>
        <a href="#/admin/users" class="${active === "users" ? "active" : ""}"><span class="nav-icon">人</span>用户管理</a>
        <a href="#/"><span class="nav-icon">↗</span>返回前台</a>
      </nav>
      <div class="admin-sidebar-footer"><button id="adminLogout">退出登录</button></div>
    </aside>
    <main class="admin-main" id="adminMain"><div class="loading">正在载入……</div></main>
  </div>`;
  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("adminOverlay");
  const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("open"); };
  document.getElementById("adminMenu")?.addEventListener("click", () => { sidebar.classList.toggle("open"); overlay.classList.toggle("open"); });
  overlay?.addEventListener("click", close);
  document.getElementById("adminLogout")?.addEventListener("click", async () => { await signOut(); window.location.hash = "#/admin/login"; });
  return document.getElementById("adminMain");
}

export function adminError(message) {
  return `<div class="admin-page"><div class="empty-state"><h2>暂无法载入</h2><p>${escapeHtml(message)}</p></div></div>`;
}