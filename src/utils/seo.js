const DEFAULT_TITLE = "诗经 · 诗三百";
const DEFAULT_DESCRIPTION = "《诗经》全文阅读与检索平台，收录风、雅、颂共305篇，支持分类浏览、拼音标注、注释与今译。";

function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

export function updateSeo({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  document.title = title;
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
}

export function resetSeo() { updateSeo(); }
