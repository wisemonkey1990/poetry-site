/**
 * 轻量 Hash 路由器
 * 模式: #/path/:param?query
 */

const routes = [];
let currentCleanup = null;

export function route(pattern, handler) {
  routes.push({ pattern: parsePattern(pattern), handler, raw: pattern });
}

export function navigate(path) {
  window.location.hash = path.startsWith("#") ? path.slice(1) : path;
}

function parsePattern(pattern) {
  const parts = pattern.split("/").filter(Boolean);
  return parts.map((p) => {
    if (p.startsWith(":")) return { name: p.slice(1), regex: null };
    return { name: null, regex: p };
  });
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
      if (pattern[i].name) {
        params[pattern[i].name] = decodeURIComponent(parts[i]);
      } else if (pattern[i].regex !== parts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params, query };
  }
  return null;
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || "/";
  const match = matchRoute(hash);

  if (currentCleanup && typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }

  if (match) {
    currentCleanup = match.handler(match.params, match.query);
  } else {
    // 404 fallback
    navigate("/");
  }
}

export function initRouter() {
  window.addEventListener("hashchange", handleRoute);
  if (window.location.hash === "" || window.location.hash === "#") {
    window.location.hash = "#/";
  } else {
    // 延迟初始渲染，等待 DOM 就绪
    setTimeout(handleRoute, 0);
  }
}
