const DEFAULT_TITLE = "诗经 · 诗三百";
const DEFAULT_DESCRIPTION = "《诗经》全文阅读与检索平台，收录风、雅、颂共305篇，支持分类浏览、拼音标注、注释与今译。";

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function ensureElement(selector, create) {
  let element = document.head.querySelector(selector);
  if (!element) { element = create(); document.head.appendChild(element); }
  return element;
}

/** 当前页面的规范地址（不含查询串和 hash） */
export function canonicalUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function updateSeo({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION, noindex = false } = {}) {
  document.title = title;
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  const url = canonicalUrl();
  ensureElement('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" })).setAttribute("href", url);
  setMeta('meta[property="og:url"]', "content", url);
  const robots = document.head.querySelector('meta[name="robots"]');
  if (noindex) ensureElement('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" })).setAttribute("content", "noindex");
  else robots?.remove();
}

export function resetSeo() { updateSeo(); }
