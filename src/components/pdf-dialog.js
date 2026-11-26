import { escapeHtml } from "../utils/html.js";
import { FOCUSABLE } from "./correction-dialog.js";
import { showToast } from "../utils/toast.js";
import { getPoemPinyin, getTitlePinyin, tokenizeLines } from "../utils/reading.js";
import sharedFontUrl from "../assets/fonts/NotoSerifSC-poem-subset.ttf?url";

const fontUrls = (poemId) => [`${import.meta.env.BASE_URL}fonts/pdf/${poemId}.ttf`, sharedFontUrl];

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function createPdf({ poem, display, withPinyin }) {
  const [{ buildPoemPdf, pdfFileName }, pinyinLines, titlePinyin] = await Promise.all([import("../utils/poem-pdf.js"), getPoemPinyin(poem), getTitlePinyin(poem)]);
  const stanzas = await tokenizeLines(display.content, pinyinLines);
  const [titleUnits] = await tokenizeLines([display.title], titlePinyin ? [titlePinyin] : null);
  const bytes = await buildPoemPdf({ poem, display, stanzas, titleUnits, withPinyin, fonts: fontUrls(poem.id) });
  return { blob: new Blob([bytes], { type: "application/pdf" }), fileName: pdfFileName(poem, display.title, withPinyin) };
}

/** 下载 PDF：先选「带注音 / 仅正文」，点选后立即生成并下载。 */
export function openPdfDialog({ poem, display, defaultPinyin = true, trigger = null }) {
  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement("div");
  overlay.className = "cx-overlay";
  overlay.innerHTML = `
    <div class="cx-dialog pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdfTitle" tabindex="-1">
      <button type="button" class="cx-close" aria-label="关闭">×</button>
      <h2 class="cx-title" id="pdfTitle">下载 PDF</h2>
      <p class="cx-poem">《${escapeHtml(display.title)}》 · A4 竖版，宣纸底色，字体已嵌入，手机、电脑、打印均可。</p>
      <div class="pdf-options">
        <button type="button" class="pdf-option${defaultPinyin ? " recommended" : ""}" data-pinyin="1"><strong>带注音</strong><span>汉字上方逐字标注拼音</span></button>
        <button type="button" class="pdf-option${defaultPinyin ? "" : " recommended"}" data-pinyin="0"><strong>仅正文</strong><span>不含拼音，字更大更疏朗</span></button>
      </div>
      <p class="form-message pdf-status" role="status" aria-live="polite"></p>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const dialog = overlay.querySelector(".cx-dialog");
  const status = overlay.querySelector(".pdf-status");
  const options = [...overlay.querySelectorAll(".pdf-option")];
  let busy = false;

  function close() {
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    if (trigger?.isConnected) trigger.focus();
  }
  function onKeydown(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = [...dialog.querySelectorAll(FOCUSABLE)];
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", onKeydown, true);
  overlay.addEventListener("click", (event) => { if (event.target === overlay && !busy) close(); });
  overlay.querySelector(".cx-close").addEventListener("click", close);

  options.forEach((button) => button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    const withPinyin = button.dataset.pinyin === "1";
    options.forEach((item) => { item.disabled = true; });
    button.classList.add("loading");
    status.textContent = "正在排版并生成 PDF…";
    try {
      const { blob, fileName } = await createPdf({ poem, display, withPinyin });
      saveBlob(blob, fileName);
      showToast("PDF 已生成，请查看下载");
      close();
    } catch (error) {
      console.error("PDF 生成失败", error);
      busy = false;
      options.forEach((item) => { item.disabled = false; });
      button.classList.remove("loading");
      status.textContent = "生成失败，请检查网络后重试。";
      status.dataset.kind = "error";
    }
  }));
  options.find((item) => item.classList.contains("recommended"))?.focus();
}
