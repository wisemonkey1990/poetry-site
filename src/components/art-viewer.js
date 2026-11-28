import { html, setHtml } from "../utils/html.js";

/**
 * 细看真迹：全屏展开一幅画，可拖动、滚轮或双指缩放、双击放大；Esc 或点空白处收起。
 * @param {{ items: { src: string, alt: string, label: string }[], index?: number, caption: string, note?: string, trigger?: HTMLElement|null }} options
 */
export function openArtViewer({ items, index = 0, caption, note = "", trigger = null }) {
  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement("div");
  overlay.className = "art-viewer";
  setHtml(overlay, html`
    <div class="av-dialog" role="dialog" aria-modal="true" aria-label="${caption}">
      <div class="av-stage" tabindex="-1"><img class="av-img" alt="" draggable="false"></div>
      <div class="av-bar">
        <div class="av-caption"><b>${caption}</b>${note ? html`<span>${note}</span>` : ""}</div>
        ${items.length > 1 ? html`<div class="av-tabs" role="group" aria-label="切换">${items.map((item, i) => html`<button type="button" class="av-tab" data-index="${i}" aria-pressed="${i === index}">${item.label}</button>`)}</div>` : ""}
        <div class="av-tools">
          <button type="button" class="av-btn" data-zoom="-1" aria-label="缩小">−</button>
          <button type="button" class="av-btn" data-zoom="1" aria-label="放大">+</button>
          <button type="button" class="av-btn av-close" aria-label="关闭">×</button>
        </div>
      </div>
    </div>`);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const stage = /** @type {HTMLElement} */ (overlay.querySelector(".av-stage"));
  const img = /** @type {HTMLImageElement} */ (overlay.querySelector(".av-img"));
  let scale = 1; let x = 0; let y = 0; let base = 1;
  const pointers = new Map();
  let pinch = 0;

  const apply = () => { img.style.transform = `translate(${x}px, ${y}px) scale(${base * scale})`; };
  const clamp = () => {
    const w = img.naturalWidth * base * scale; const h = img.naturalHeight * base * scale;
    const maxX = Math.max(0, (w - stage.clientWidth) / 2); const maxY = Math.max(0, (h - stage.clientHeight) / 2);
    x = Math.min(maxX, Math.max(-maxX, x)); y = Math.min(maxY, Math.max(-maxY, y));
  };
  const fit = () => {
    if (!img.naturalWidth) return;
    base = Math.min(stage.clientWidth / img.naturalWidth, stage.clientHeight / img.naturalHeight);
    scale = 1; x = 0; y = 0; apply();
  };
  const zoomBy = (factor, cx = 0, cy = 0) => {
    const next = Math.min(6, Math.max(1, scale * factor));
    const k = next / scale;
    x = cx - (cx - x) * k; y = cy - (cy - y) * k; scale = next;
    clamp(); apply();
  };
  const show = (i) => {
    index = i;
    overlay.querySelectorAll(".av-tab").forEach((tab) => tab.setAttribute("aria-pressed", String(Number(/** @type {HTMLElement} */ (tab).dataset.index) === i)));
    img.classList.add("loading");
    img.onload = () => { img.classList.remove("loading"); fit(); };
    img.alt = items[i].alt;
    img.src = items[i].src;
  };

  const centerOf = (event) => { const r = stage.getBoundingClientRect(); return [event.clientX - r.left - r.width / 2, event.clientY - r.top - r.height / 2]; };
  stage.addEventListener("wheel", (event) => { event.preventDefault(); const [cx, cy] = centerOf(event); zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18, cx, cy); }, { passive: false });
  stage.addEventListener("dblclick", (event) => { const [cx, cy] = centerOf(event); if (scale > 1.05) { scale = 1; x = 0; y = 0; apply(); } else zoomBy(2.5, cx, cy); });
  stage.addEventListener("pointerdown", (event) => { stage.setPointerCapture(event.pointerId); pointers.set(event.pointerId, [event.clientX, event.clientY]); });
  stage.addEventListener("pointermove", (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoomBy(dist / pinch);
      pinch = dist;
      return;
    }
    x += event.clientX - prev[0]; y += event.clientY - prev[1];
    clamp(); apply();
  });
  const release = (event) => { pointers.delete(event.pointerId); if (pointers.size < 2) pinch = 0; };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  // 点画外的空白处收起（拖动过不算）
  let downAt = null;
  stage.addEventListener("mousedown", (event) => { downAt = [event.clientX, event.clientY]; });
  stage.addEventListener("click", (event) => {
    const moved = downAt && Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 4;
    if (!moved && event.target === stage) close();
  });

  overlay.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const zoom = target?.closest("[data-zoom]");
    if (zoom instanceof HTMLElement) zoomBy(zoom.dataset.zoom === "1" ? 1.6 : 1 / 1.6);
    const tab = target?.closest(".av-tab");
    if (tab instanceof HTMLElement) show(Number(tab.dataset.index));
    if (target?.closest(".av-close")) close();
  });
  const onKeydown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "+" || event.key === "=") zoomBy(1.4);
    else if (event.key === "-") zoomBy(1 / 1.4);
    else if (event.key === "Tab") {
      const focusable = [...overlay.querySelectorAll("button")];
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", onKeydown, true);
  window.addEventListener("resize", fit);
  function close() {
    document.removeEventListener("keydown", onKeydown, true);
    window.removeEventListener("resize", fit);
    overlay.classList.add("closing");
    setTimeout(() => overlay.remove(), 220);
    document.body.style.overflow = previousOverflow;
    trigger?.focus();
  }
  requestAnimationFrame(() => overlay.classList.add("open"));
  show(index);
  /** @type {HTMLElement|null} */ (overlay.querySelector(".av-close"))?.focus();
  return close;
}
