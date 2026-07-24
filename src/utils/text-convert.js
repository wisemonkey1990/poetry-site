const converterCache = new Map();

/**
 * 懒加载 OpenCC 转换器，并按转换方向复用实例。
 * @param {'s2t'|'t2s'} mode 转换方向
 * @returns {Promise<(text: string) => string>}
 */
export async function getConverter(mode = "s2t") {
  if (!converterCache.has(mode)) {
    const openCC = await import("opencc-js");
    const config = mode === "t2s"
      ? { from: "tw", to: "cn" }
      : { from: "cn", to: "twp" };
    converterCache.set(mode, openCC.Converter(config));
  }
  return converterCache.get(mode);
}

/**
 * 将诗句数组整体转换。
 * @param {string[]} lines
 * @param {'s2t'|'t2s'} mode
 * @returns {Promise<{ lines: string[], mode: string }>}
 */
export async function convertLines(lines, mode = "s2t") {
  const converter = await getConverter(mode);
  return {
    lines: lines.map((line) => converter(String(line ?? ""))),
    mode,
  };
}
