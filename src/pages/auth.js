import { renderShell, setupShell, updateNav } from "../components/app-shell.js";
import { getSupabaseSetupMessage, isSupabaseConfigured } from "../lib/supabase.js";
import { getCurrentUser, initializeAuth, signIn, signUp } from "../services/auth.js";
import { migrateLegacyFavorites } from "../services/favorites.js";

export async function renderAuth(params, query) {
  await initializeAuth();
  if (getCurrentUser()) { window.location.hash = "#/profile"; return () => {}; }
  const isRegister = query.mode === "register";
  const html = `<div class="auth-page"><header class="page-header"><p class="page-eyebrow">MEMBER OF SHIJING</p><h1>${isRegister ? "注册" : "登录"}</h1><p>${isRegister ? "注册账号，收藏并管理喜欢的诗篇。" : "登录后继续阅读你的藏诗。"}</p></header>
    ${!isSupabaseConfigured ? `<div class="setup-notice">${getSupabaseSetupMessage()}</div>` : ""}
    ${isRegister ? registerForm() : loginForm()}
  </div>`;
  setupShell(); renderShell(html); bindAuthForm(isRegister); return () => {};
}

function registerForm() {
  return `<form class="auth-form card" id="authForm">
    <label><span>雅号</span><input name="nickname" maxlength="40" autocomplete="nickname" required placeholder="请输入昵称" /></label>
    <label><span>邮箱</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com" /></label>
    <label><span>密码</span><input name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="至少 8 位" /></label>
    <label><span>确认密码</span><input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="再次输入密码" /></label>
    <p class="form-error" id="formError" role="alert"></p><p class="form-message" id="formMessage" role="status"></p>
    <button class="btn btn-primary auth-submit" type="submit" ${!isSupabaseConfigured ? "disabled" : ""}>注册账号</button>
    <p class="auth-switch">已有账号？<a href="#/auth?mode=login" data-nav="/auth?mode=login">返回登录</a></p>
  </form>`;
}

function loginForm() {
  return `<form class="auth-form card" id="authForm">
    <label><span>邮箱</span><input name="email" type="email" autocomplete="email" required placeholder="name@example.com" /></label>
    <label><span>密码</span><input name="password" type="password" minlength="8" autocomplete="current-password" required placeholder="至少 8 位" /></label>
    <p class="form-error" id="formError" role="alert"></p>
    <button class="btn btn-primary auth-submit" type="submit" ${!isSupabaseConfigured ? "disabled" : ""}>登录</button>
    <p class="auth-switch">还没有账号？<a href="#/auth?mode=register" data-nav="/auth?mode=register">立即注册</a></p>
  </form>`;
}

function bindAuthForm(isRegister) {
  const form = document.getElementById("authForm"); if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const button = form.querySelector("button[type=submit]");
    const errorElement = document.getElementById("formError"); const messageElement = document.getElementById("formMessage");
    const data = Object.fromEntries(new FormData(form)); errorElement.textContent = ""; if (messageElement) messageElement.textContent = "";
    if (isRegister && data.password !== data.confirmPassword) { errorElement.textContent = "两次输入的密码不一致"; return; }
    button.disabled = true; button.textContent = isRegister ? "注册中……" : "登录中……";
    try {
      if (isRegister) {
        const result = await signUp(data);
        if (result.session) { updateNav(); window.location.hash = "#/profile"; return; }
        form.reset(); messageElement.textContent = "注册成功，请前往邮箱完成验证后再登录。"; button.textContent = "验证邮件已发送";
      } else {
        await signIn(data); await migrateLegacyFavorites(); updateNav();
        const redirect = sessionStorage.getItem("shijing_auth_redirect"); sessionStorage.removeItem("shijing_auth_redirect");
        window.location.hash = redirect || "#/profile";
      }
    } catch (error) { errorElement.textContent = translateAuthError(error.message); button.disabled = false; button.textContent = isRegister ? "注册账号" : "登录"; }
  });
}

function translateAuthError(message) {
  const map = {
    "Invalid login credentials": "邮箱或密码错误", "Email not confirmed": "请先完成邮箱验证",
    "User already registered": "该邮箱已注册", "Password should be at least 6 characters": "密码长度不足",
    "Unable to validate email address: invalid format": "邮箱格式不正确",
  };
  return map[message] || message || "操作失败，请稍后重试";
}