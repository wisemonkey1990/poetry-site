/**
 * 轻量 Hash 路由器
 * 模式: #/path/:param?query
 */
const routes = [];
let currentCleanup = null;
let navigationGuard = null;
let routeVersion = 0;
let revertingHash = false;

export function route(pattern, handler) {
  routes.push({ pattern: parsePattern(pattern), handler, raw: pattern });
}

export function navigate(path) {
  window.location.hash = path.startsWith("#") ? path.slice(1) : path;
}

export function setNavigationGuard(guard) {
  navigationGuard = typeof guard === "function" ? guard : null;
  return () => { if (navigationGuard === guard) navigationGuard = null; };
}

function parsePattern(pattern) {
  const parts = pattern.split("/").filter(Boolean);
  return parts.map((p) => p.startsWith(":") ? { name: p.slice(1), regex: null } : { name: null, regex: p });
}

function matchRoute(path) {
  const [hashPath, queryString] = path.split("?");
  const parts = hashPath.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryString || ""));
  for (const { pattern, handler } of routes) {
    if (parts.length !== pattern.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].name) params[pattern[i].name] = decodeURIComponent(parts[i]);
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
  if (revertingHash) { revertingHash = false; return; }
  const hash = window.location.hash.slice(1) || "/";
  if (navigationGuard && navigationGuard(hash) === false) {
    revertingHash = true;
    history.back();
    return;
  }
  const match = matchRoute(hash);
  const version = ++routeVersion;
  await runCleanup();
  if (!match) { navigate("/"); return; }
  try {
    const cleanup = await match.handler(match.params, match.query);
    if (version === routeVersion) currentCleanup = cleanup;
    else if (typeof cleanup === "function") await cleanup();
  } catch (error) {
    console.error("页面加载失败", error);
    const app = document.getElementById("app");
    if (app) app.textContent = "页面暂时无法载入，请稍后重试。";
  }
}

export function initRouter() {
  window.addEventListener("hashchange", handleRoute);
  if (window.location.hash === "" || window.location.hash === "#") window.location.hash = "#/";
  else setTimeout(handleRoute, 0);
}
