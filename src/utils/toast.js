/**
 * 全局 Toast 提示：复用 app-shell 中的 #toast 节点
 */
let timer = null;

export function showToast(message, duration = 1800) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove("show"), duration);
}
