import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { REGISTRATION_ENABLED } from "../config/features.js";
import { getSupabaseSetupMessage, isSupabaseConfigured } from "../lib/supabase.js";
import { getCurrentUser, signIn } from "../services/auth.js";
import { migrateLegacyFavorites } from "../services/favorites.js";

export function renderAuth(params, query) {
  if (getCurrentUser()) { window.location.hash = "#/profile"; return () => {}; }
  const requestedRegister = query.mode === "register";
  const registrationUnavailable = requestedRegister && !REGISTRATION_ENABLED;
  const html = `<div class="auth-page"><header class="page-header"><p class="page-eyebrow">MEMBER OF SHIJING</p><h1>${registrationUnavailable ? "注册" : "登录"}</h1><p>${registrationUnavailable ? "用户注册正在灰度测试中，暂未开放。" : "登录后继续阅读你的藏诗。"}</p></header>
    ${!isSupabaseConfigured && !registrationUnavailable ? `<div class="setup-notice">${getSupabaseSetupMessage()}</div>` : ""}
    ${registrationUnavailable ? registrationPreview() : loginForm()}
  </div>`;
  setupShell(); renderShell(html);
  if (!registrationUnavailable) bindLoginForm();
  return () => {};
}

function registrationPreview() {
  return `<form class="auth-form card auth-form-disabled" aria-disabled="true">
    <div class="gray-release-badge">灰度中 · 暂未开放</div>
    <fieldset disabled>
      <label><span>雅号</span><input name="nickname" placeholder="请输入昵称" /></label>
      <label><span>邮箱</span><input name="email" type="email" placeholder="name@example.com" /></label>
      <label><span>密码</span><input name="password" type="password" placeholder="至少 8 位" /></label>
      <label><span>确认密码</span><input name="confirmPassword" type="password" placeholder="再次输入密码" /></label>
      <button class="btn btn-primary auth-submit" type="button">注册账号</button>
    </fieldset>
    <p class="gray-release-note">注册入口已保留，待灰度测试结束后开放。</p>
    <p class="auth-switch">已有账号？<a href="#/auth?mode=login" data-nav="/auth?mode=login">返回登录</a></p>
  </form>`;
}

function loginForm() {
  return `<form class="auth-form card" id="authForm">
    <label><span>邮箱</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com" /></label>
    <label><span>密码</span><input name="password" type="password" minlength="8" autocomplete="current-password" required placeholder="至少 8 位" /></label>
    <p class="form-error" id="formError" role="alert"></p>
    <button class="btn btn-primary auth-submit" type="submit" ${!isSupabaseConfigured ? "disabled" : ""}>登录</button>
    <p class="auth-switch">还没有账号？<span class="auth-register-disabled" aria-disabled="true" title="注册功能灰度中">立即注册<span class="gray-release-dot">灰度中</span></span></p>
  </form>`;
}

function bindLoginForm() {
  const form = document.getElementById("authForm"); if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]"); const errorElement = document.getElementById("formError");
    const data = Object.fromEntries(new FormData(form)); errorElement.textContent = "";
    button.disabled = true; button.textContent = "登录中……";
    try {
      await signIn(data);
      await migrateLegacyFavorites();
      updateNav();
      const redirect = sessionStorage.getItem("shijing_auth_redirect");
      sessionStorage.removeItem("shijing_auth_redirect");
      window.location.hash = redirect || "#/profile";
    } catch (error) { errorElement.textContent = translateAuthError(error.message); button.disabled = false; button.textContent = "登录"; }
  });
}

function translateAuthError(message) {
  const map = { "Invalid login credentials": "邮箱或密码错误", "Email not confirmed": "请先完成邮箱验证" };
  return map[message] || message || "操作失败，请稍后重试";
}
