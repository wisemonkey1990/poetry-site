import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { getSupabaseSetupMessage, isSupabaseConfigured } from "../lib/supabase.js";
import { getCurrentUser, signIn, signUp } from "../services/auth.js";
import { migrateLegacyFavorites } from "../services/favorites.js";

export function renderAuth(params, query) {
  if (getCurrentUser()) { window.location.hash = "#/profile"; return () => {}; }
  const mode = query.mode === "register" ? "register" : "login";
  const isRegister = mode === "register";
  const html = `<div class="auth-page"><header class="page-header"><p class="page-eyebrow">MEMBER OF SHIJING</p><h1>${isRegister ? "注册" : "登录"}</h1><p>${isRegister ? "注册后可跨设备收藏和管理诗篇。" : "登录后继续阅读你的藏诗。"}</p></header>
    ${!isSupabaseConfigured ? `<div class="setup-notice">${getSupabaseSetupMessage()}</div>` : ""}
    <form class="auth-form card" id="authForm">
      ${isRegister ? `<label><span>雅号</span><input name="nickname" maxlength="40" required placeholder="请输入昵称" /></label>` : ""}
      <label><span>邮箱</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com" /></label>
      <label><span>密码</span><input name="password" type="password" minlength="8" autocomplete="${isRegister ? "new-password" : "current-password"}" required placeholder="至少 8 位" /></label>
      ${isRegister ? `<label><span>确认密码</span><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="再次输入密码" /></label>` : ""}
      <p class="form-error" id="formError" role="alert"></p>
      <button class="btn btn-primary auth-submit" type="submit" ${!isSupabaseConfigured ? "disabled" : ""}>${isRegister ? "注册账号" : "登录"}</button>
      <p class="auth-switch">${isRegister ? "已有账号？" : "还没有账号？"}<a href="#/auth?mode=${isRegister ? "login" : "register"}" data-nav="/auth?mode=${isRegister ? "login" : "register"}">${isRegister ? "返回登录" : "立即注册"}</a></p>
    </form></div>`;
  setupShell(); renderShell(html); bindForm(isRegister); return () => {};
}

function bindForm(isRegister) {
  const form = document.getElementById("authForm"); if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]"); const errorElement = document.getElementById("formError");
    const data = Object.fromEntries(new FormData(form)); errorElement.textContent = "";
    if (isRegister && data.password !== data.confirmPassword) { errorElement.textContent = "两次输入的密码不一致"; return; }
    button.disabled = true; button.textContent = isRegister ? "注册中……" : "登录中……";
    try {
      const result = isRegister ? await signUp(data) : await signIn(data);
      if (isRegister && !result.session) { form.innerHTML = `<div class="auth-success"><strong>注册成功</strong><p>请前往邮箱完成验证，然后返回登录。</p><a class="btn btn-outline" href="#/auth?mode=login" data-nav="/auth?mode=login">返回登录</a></div>`; return; }
      await migrateLegacyFavorites();
      updateNav();
      const redirect = sessionStorage.getItem("shijing_auth_redirect");
      sessionStorage.removeItem("shijing_auth_redirect");
      window.location.hash = redirect || "#/profile";
    } catch (error) { errorElement.textContent = translateAuthError(error.message); button.disabled = false; button.textContent = isRegister ? "注册账号" : "登录"; }
  });
}

function translateAuthError(message) {
  const map = { "Invalid login credentials": "邮箱或密码错误", "User already registered": "该邮箱已经注册", "Email not confirmed": "请先完成邮箱验证", "Password should be at least 6 characters.": "密码长度不足" };
  return map[message] || message || "操作失败，请稍后重试";
}
