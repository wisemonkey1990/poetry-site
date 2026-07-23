let converterCache = null;
let cachedMode = null;

/**
 * 初始化转换器（懒加载，仅首次调用时下载词典）
 * @param {'s2t'|'t2s'} mode 转换方向
 * @returns {Promise<(text: string) => string>}
 */
export async function getConverter(mode = "s2t") {
  if (!converterCache || cachedMode !== mode) {
    const openCC = await import("opencc-js");
    const config = mode === "t2s"
      ? { from: "tw", to: "cn" }
      : { from: "cn", to: "twp" };
    converterCache = openCC.Converter(config);
    cachedMode = mode;
  }
  return converterCache;
}

/**
 * 转换文本
 * @param {string} text
 * @param {'s2t'|'t2s'} mode
 * @returns {Promise<string>}
 */
async function convert(text, mode) {
  const converter = await getConverter(mode);
  return converter(text);
}

/**
 * 将诗句数组整体转换并缓存结果
 * @param {string[]} lines
 * @param {'s2t'|'t2s'} mode
 * @returns {Promise<{ lines: string[], mode: string }>}
 */
export async function convertLines(lines, mode) {
  const converted = await Promise.all(lines.map((line) => convert(line, mode)));
  return { lines: converted, mode };
}
