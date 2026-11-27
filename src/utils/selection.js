/** 读取读者在诗文/注释容器内的划选文字（忽略拼音），不做长度截断。 */
export function readSelectedText(root = document) {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
  const containers = ["#poemBody", ".annotation-content"].map((s) => root.querySelector(s)).filter(Boolean);
  const range = selection.getRangeAt(0);
  if (!containers.some((el) => el.contains(range.commonAncestorContainer))) return "";
  const fragment = range.cloneContents();
  fragment.querySelectorAll("rt, rp").forEach((node) => node.remove());
  return fragment.textContent;
}
