/* 诗三百 Service Worker：离线阅读。
 * - /assets/*（带哈希，永不变化）：缓存优先，读过的诗篇、字体、脚本离线可用
 * - 页面（HTML）：网络优先，断网时用缓存；没缓存过的页面退回首页外壳，由前端路由渲染
 * - 图片、预览图、PDF 字体：缓存优先并后台更新
 * - 接口（/api）、音频、跨站请求：不经过缓存
 * 更新本文件的 VERSION 会清掉旧缓存。
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const STATIC = `static-${VERSION}`;
const MAX_ASSETS = 600;
const MAX_PAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(new Request("/", { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, ASSETS, STATIC]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) { await cache.put(request, response.clone()); trim(cacheName, max); }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).then(() => trim(STATIC, 400));
    return response;
  }).catch(() => hit);
  return hit || refresh;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) { await cache.put(request, response.clone()); trim(PAGES, MAX_PAGES); }
    return response;
  } catch (error) {
    const hit = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/"));
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/audio/") || request.headers.has("range")) return;
  if (request.mode === "navigate") { event.respondWith(networkFirstPage(request)); return; }
  if (url.pathname.startsWith("/assets/")) { event.respondWith(cacheFirst(request, ASSETS, MAX_ASSETS)); return; }
  if (/^\/(images|icons|fonts|og)\//.test(url.pathname) || url.pathname === "/favicon.svg") event.respondWith(staleWhileRevalidate(request));
});
