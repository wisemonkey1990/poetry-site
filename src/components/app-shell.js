import { navigate } from "../router.js";
import { getCurrentUser } from "../services/auth.js";
let shellInitialized = false;

export function renderShell(content) {
  if (!shellInitialized) initializeShell();
  updateNav();
  updateMobileNav();
  const main = document.getElementById("mainContent");
  if (main) main.innerHTML = `<div class="container fade-in">${content}</div>`;
  window.scrollTo({ top: 0, behavior: "instant" });
  return content;
}

function initializeShell() {
  const app = document.getElementById("app");
  if (!app) return;
  shellInitialized = true;
  app.innerHTML = `
    <div class="app-shell">
      <header class="site-header">
        <div class="container header-inner">
          <a href="#/" class="logo" data-nav="/" aria-label="诗三百首页">
            <span class="logo-seal" aria-hidden="true">诗</span>
            <span class="logo-copy"><span class="logo-text">诗三百</span><span class="logo-note">THE BOOK OF SONGS</span></span>
          </a>
          <nav class="site-nav" id="siteNav" aria-label="主导航"></nav>
          <button class="menu-toggle" aria-label="展开菜单" aria-expanded="false" id="menuToggle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
        <nav class="mobile-nav" id="mobileNav" aria-label="移动端导航"></nav>
      </header>
      <main class="site-main" id="mainContent"></main>
      <footer class="site-footer"><div class="container footer-inner"><p>诗三百，一言以蔽之，曰思无邪。</p><span class="footer-dot">·</span><p>西周初年至春秋中叶</p></div></footer>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </div>`;
  document.addEventListener("click", handleNavigation);
  document.getElementById("menuToggle")?.addEventListener("click", toggleMobileMenu);
  window.addEventListener("hashchange", updateNav);
}

function handleNavigation(event) {
  const link = event.target.closest("[data-nav]");
  if (!link) return;
  event.preventDefault();
  navigate(link.dataset.nav);
  closeMobileMenu();
}

function toggleMobileMenu() {
  const nav = document.getElementById("mobileNav");
  const button = document.getElementById("menuToggle");
  const isOpen = nav?.classList.toggle("open") ?? false;
  button?.setAttribute("aria-expanded", String(isOpen));
}

function closeMobileMenu() {
  document.getElementById("mobileNav")?.classList.remove("open");
  document.getElementById("menuToggle")?.setAttribute("aria-expanded", "false");
}

export function updateNav() {
  const nav = document.getElementById("siteNav");
  if (nav) nav.innerHTML = navMarkup();
  updateMobileNav();
  highlightNav();
}

function updateMobileNav() {
  const nav = document.getElementById("mobileNav");
  if (nav) nav.innerHTML = navMarkup(true);
}

function navMarkup(mobile = false) {
  const user = getCurrentUser();
  const accountLink = user
    ? `<a href="#/profile" data-nav="/profile" class="nav-link">个人中心</a>`
    : `<a href="#/auth?mode=login" data-nav="/auth?mode=login" class="nav-link">登录</a><span class="nav-link nav-disabled" aria-disabled="true" title="注册功能灰度中">注册<small>灰度</small></span>`;
  return `<a href="#/browse" data-nav="/browse" class="nav-link">篇章</a><a href="#/search" data-nav="/search" class="nav-link">寻诗</a>${user ? `<a href="#/favorites" data-nav="/favorites" class="nav-link nav-fav">藏诗</a>` : ""}${accountLink}`;
}

function highlightNav() {
  const hash = window.location.hash.slice(1) || "/";
  document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("active", hash === link.dataset.nav || (link.dataset.nav !== "/" && hash.startsWith(link.dataset.nav))));
}

export function setupShell() { if (!shellInitialized) initializeShell(); }
