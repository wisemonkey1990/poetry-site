/**
 * 轻量 History 路由器：真实路径 /poem/1、/search?q=…（旧的 #/poem/1 链接自动转成新地址）。
 */
const routes = [];
const listeners = [];
let notFoundHandler = null;
let currentCleanup = null;
let routeVersion = 0;

export function route(pattern, handler) {
  routes.push({ pattern: parsePattern(pattern), handler, raw: pattern });
}

/** 未匹配任何路由时的页面；未设置则回到首页 */
export function setNotFound(handler) {
  notFoundHandler = handler;
}

/** 每次路由切换（渲染之前）调用 fn(path) */
export function onRouteChange(fn) {
  listeners.push(fn);
}

/** 当前路径（含查询字符串），如 "/search?q=关雎" */
export function currentPath() {
  return `${window.location.pathname}${window.location.search}` || "/";
}

/** 把任意写法（"/x"、"#/x"、"x"）规整为以 "/" 开头的站内路径 */
export function normalizePath(path) {
  const value = String(path ?? "").replace(/^#/, "");
  return value.startsWith("/") ? value : `/${value}`;
}

export function navigate(path, { replace = false } = {}) {
  const target = normalizePath(path);
  if (target === currentPath() && !replace) return handleRoute();
  history[replace ? "replaceState" : "pushState"]({}, "", target);
  return handleRoute();
}

function parsePattern(pattern) {
  const parts = pattern.split("/").filter(Boolean);
  return parts.map((p) => p.startsWith(":") ? { name: p.slice(1), regex: null } : { name: null, regex: p });
}

export function matchRoute(path) {
  const [rawPath, queryString] = path.split("?");
  const parts = rawPath.split("/").filter(Boolean).map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
  const query = Object.fromEntries(new URLSearchParams(queryString || ""));
  for (const { pattern, handler } of routes) {
    if (parts.length !== pattern.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].name) params[pattern[i].name] = parts[i];
      else if (pattern[i].regex !== parts[i]) { matched = false; break; }
    }
    if (matched) return { handler, params, query };
  }
  return null;
}

async function runCleanup() {
  if (typeof currentCleanup === "function") await currentCleanup();
  currentCleanup = null;
}

async function handleRoute() {
  const path = currentPath();
  let match = matchRoute(path);
  const version = ++routeVersion;
  await runCleanup();
  if (!match && notFoundHandler) match = { handler: notFoundHandler, params: {}, query: {} };
  if (!match) { navigate("/", { replace: true }); return; }
  for (const fn of listeners) fn(path);
  try {
    const cleanup = await match.handler(match.params, match.query);
    if (version === routeVersion) currentCleanup = cleanup;
    else if (typeof cleanup === "function") await cleanup();
  } catch (error) {
    console.error("页面加载失败", error);
    window.dispatchEvent(new CustomEvent("shijing:route-error", { detail: error }));
    const app = document.getElementById("app");
    if (app) app.textContent = "页面暂时无法载入，请稍后重试。";
  }
}

/** 站内链接点击交给路由处理（新窗口、下载、外链、带修饰键的点击除外） */
function handleLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.("a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
  const href = link.getAttribute("href");
  if (!href || !(href.startsWith("/") || href.startsWith("#/")) || href.startsWith("//")) return;
  event.preventDefault();
  navigate(href);
}

export function initRouter() {
  window.addEventListener("popstate", () => handleRoute());
  document.addEventListener("click", handleLinkClick);
  // 兼容旧的 hash 地址：/#/poem/1 -> /poem/1
  const { hash } = window.location;
  if (hash.startsWith("#/")) history.replaceState({}, "", hash.slice(1));
  return handleRoute();
}
