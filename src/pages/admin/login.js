import { isSupabaseConfigured } from "../../lib/supabase.js";
import { signIn, signOut } from "../../services/auth.js";
import { isCurrentUserAdmin } from "../../services/admin.js";

export async function renderAdminLogin() {
  if (isSupabaseConfigured && await isCurrentUserAdmin()) { window.location.hash = "#/admin/dashboard"; return () => {}; }
  const app = document.getElementById("app");
  app.innerHTML = `<main class="admin-login-page"><section class="admin-login-card">
    <div class="admin-login-seal">管</div><p class="page-eyebrow">SHIJING ADMIN</p><h1>诗三百管理后台</h1><p class="sub">仅限已加入管理员白名单的账号</p>
    ${!isSupabaseConfigured ? `<div class="form-error">Supabase 尚未配置，后台暂不可用。</div>` : ""}
    <form id="adminLoginForm"><div class="form-group"><label for="adminEmail">邮箱</label><input id="adminEmail" name="email" type="email" autocomplete="email" required></div>
    <div class="form-group"><label for="adminPassword">密码</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" minlength="8" required></div>
    <p class="form-error" id="adminLoginError" role="alert"></p><button class="btn-primary" type="submit" ${!isSupabaseConfigured ? "disabled" : ""}>登录后台</button></form>
    <a class="admin-back-link" href="#/">← 返回网站</a></section></main>`;
  const form = document.getElementById("adminLoginForm");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = form.querySelector("button"); const error = document.getElementById("adminLoginError");
    button.disabled = true; button.textContent = "校验身份中……"; error.textContent = "";
    try {
      await signIn(Object.fromEntries(new FormData(form)));
      if (!(await isCurrentUserAdmin())) { await signOut(); throw new Error("该账号没有后台管理权限"); }
      window.location.hash = "#/admin/dashboard";
    } catch (reason) { error.textContent = reason.message || "登录失败"; button.disabled = false; button.textContent = "登录后台"; }
  });
  return () => {};
}