import { escapeHtml } from "../utils/html.js";
import { renderPoemCard, cardFileName } from "../utils/poem-card.js";
import { FOCUSABLE } from "./correction-dialog.js";
import { showToast } from "../utils/toast.js";

/** 画布不会自己等网页字体：先把诗卡用到的字（篆体印章 + 宋体正文）加载好再绘制 */
async function ensureFonts(poem, display) {
  const text = [display?.title, ...(display?.content || poem?.content || []), "诗三百"].join("");
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "JF Zhongshan Seal"', "诗三百"), document.fonts.load('34px "Noto Serif SC"', text)]),
      new Promise((r) => setTimeout(r, 2500))
    ]);
  } catch { /* 字体失败则用备用字体 */ }
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** 生成诗卡并弹出预览：保存图片、系统分享（支持文件时）。 */
export async function openShareCardDialog({ poem, display, trigger = null }) {
  const url = window.location.href;
  showToast("正在生成诗卡…", 4000);
  let blob;
  try {
    await ensureFonts(poem, display);
    const canvas = renderPoemCard(poem, display, { url, scale: 1.5 });
    blob = await toBlob(canvas);
  } catch {
    showToast("诗卡生成失败，请稍后再试");
    return;
  }
  const fileName = cardFileName({ id: poem.id, title: display.title });
  const file = new File([blob], fileName, { type: "image/png" });
  const objectUrl = URL.createObjectURL(blob);
  const canShareFile = Boolean(navigator.canShare?.({ files: [file] }) && navigator.share);
  const previousOverflow = document.body.style.overflow;

  const overlay = document.createElement("div");
  overlay.className = "cx-overlay";
  overlay.innerHTML = `
    <div class="cx-dialog sc-dialog" role="dialog" aria-modal="true" aria-labelledby="scTitle" tabindex="-1">
      <button type="button" class="cx-close" aria-label="关闭">×</button>
      <h2 class="cx-title" id="scTitle">诗卡</h2>
      <div class="sc-preview"><img src="${objectUrl}" alt="《${escapeHtml(display.title)}》诗卡"></div>
      <p class="sc-hint">${canShareFile ? "可直接分享，或保存到相册。" : "点击保存，或长按图片保存。"}</p>
      <div class="cx-actions sc-actions">
        <button type="button" class="btn btn-outline" data-act="save">保存图片</button>
        ${canShareFile ? `<button type="button" class="btn btn-primary" data-act="share">分享</button>` : `<button type="button" class="btn btn-primary" data-act="copy">复制链接</button>`}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const dialog = overlay.querySelector(".cx-dialog");

  function close() {
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    URL.revokeObjectURL(objectUrl);
    if (trigger?.isConnected) trigger.focus();
  }
  function onKeydown(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = [...dialog.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", onKeydown, true);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector(".cx-close").addEventListener("click", close);

  overlay.querySelector('[data-act="save"]').addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = objectUrl; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    showToast("诗卡已保存");
  });
  overlay.querySelector('[data-act="share"]')?.addEventListener("click", async () => {
    try { await navigator.share({ files: [file], title: `《诗经·${display.title}》`, text: `《诗经·${display.title}》 ${url}` }); }
    catch (error) { if (error.name !== "AbortError") showToast("分享未完成，可先保存图片"); }
  });
  overlay.querySelector('[data-act="copy"]')?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); showToast("诗篇链接已复制"); }
    catch { showToast("复制失败，请手动复制地址栏链接"); }
  });
  dialog.focus();
}
