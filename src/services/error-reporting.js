/**
 * 前端错误上报：把读者浏览器里的报错发到 /api/client-error（只进 Cloudflare Workers 日志）。
 * 每个页面最多报 5 条，同一条消息只报一次；本地开发、浏览器扩展和第三方脚本的报错不上报。
 */
const ENDPOINT = "/api/client-error";
const MAX_REPORTS = 5;
const sent = new Set();
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i, /Load failed/i, /NetworkError/i, /Failed to fetch/i];

export function shouldReport({ message, stack = "", origin = globalThis.location?.origin ?? "" }) {
  if (!message || IGNORED.some((re) => re.test(message) || re.test(stack))) return false;
  // 有调用栈但不含本站脚本：多半来自浏览器扩展或第三方脚本
  if (stack && origin && /https?:\/\//.test(stack) && !stack.includes(origin)) return false;
  return true;
}

export function reportError(error, kind = "error") {
  try {
    const message = String(error?.message ?? error ?? "").slice(0, 300);
    const stack = String(error?.stack ?? "").slice(0, 1500);
    if (sent.size >= MAX_REPORTS || sent.has(message) || !shouldReport({ message, stack })) return false;
    sent.add(message);
    const body = JSON.stringify({ message, stack, kind, path: location.pathname, release: import.meta.env.VITE_RELEASE || "" });
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return true;
    fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function initErrorReporting() {
  if (!import.meta.env.PROD || ["localhost", "127.0.0.1"].includes(location.hostname)) return;
  window.addEventListener("error", (event) => reportError(event.error ?? event.message, "error"));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "rejection"));
}
