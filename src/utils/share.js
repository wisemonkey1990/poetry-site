/**
 * 分享工具
 */

export async function sharePoem(title, text, url) {
  const shareData = { title, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
      // 降级到复制
    }
  }

  // 降级：复制链接
  try {
    await navigator.clipboard.writeText(url || window.location.href);
    return "copied";
  } catch {
    // 手动选中复制
    return false;
  }
}
