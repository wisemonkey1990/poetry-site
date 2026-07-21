/**
 * 简易全文搜索（客户端）
 */

/**
 * @param {Array} poems - 诗歌数据数组
 * @param {string} query - 搜索关键词
 * @returns {Array} 匹配结果
 */
export function searchPoems(poems, query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();
  const results = [];

  for (const poem of poems) {
    let score = 0;

    // 标题匹配（权重高）
    if (poem.title.toLowerCase().includes(q)) score += 10;
    // 作者匹配
    if (poem.author && poem.author.toLowerCase().includes(q)) score += 5;
    // 内容匹配
    if (poem.content) {
      const fullText = Array.isArray(poem.content)
        ? poem.content.join("")
        : poem.content;
      const count = (fullText.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
      score += count * 2;
    }
    // 注释匹配
    if (poem.annotation && poem.annotation.toLowerCase().includes(q)) score += 1;
    // 译文匹配
    if (poem.translation && poem.translation.toLowerCase().includes(q)) score += 1;

    if (score > 0) {
      results.push({ ...poem, _score: score });
    }
  }

  return results.sort((a, b) => b._score - a._score);
}
