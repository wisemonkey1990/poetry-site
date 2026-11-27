import { html, setHtml } from "../utils/html.js";
import {
  CONTENT_MAX, CATEGORIES, validateFeedback, buildFeedbackPayload, submitFeedback,
} from "../services/feedback.js";
import { throttleRemaining, markSubmitted } from "../services/corrections.js";
import { getSiteKey, loadTurnstile, FOCUSABLE } from "./correction-dialog.js";

/** 站点级「提意见」弹窗，样式与纠错弹窗（cx-*）保持一致。 */
export function openFeedbackDialog({ trigger = null } = {}) {
  const siteKey = getSiteKey();
  const available = Boolean(siteKey);
  const previousOverflow = document.body.style.overflow;
  const off = available ? "" : "disabled";

  const overlay = document.createElement("div");
  overlay.className = "cx-overlay";
  setHtml(overlay, html`
    <div class="cx-dialog" role="dialog" aria-modal="true" aria-labelledby="fbTitle" aria-describedby="fbIntro">
      <button type="button" class="cx-close" aria-label="关闭">×</button>
      <h2 class="cx-title" id="fbTitle">提意见</h2>
      <p class="cx-poem" id="fbIntro">对网站有任何建议或想法，都欢迎告诉我们。</p>
      ${available ? "" : html`<p class="form-message cx-message" role="status">意见反馈功能暂未开放</p>`}
      <form class="cx-form" novalidate>
        <div class="cx-field"><label for="fbCategory">意见类型</label>
          <select id="fbCategory" name="category" ${off}>${CATEGORIES.map((c) => html`<option value="${c}">${c}</option>`)}</select></div>
        <div class="cx-field"><label for="fbContent">意见内容 <em>必填</em></label>
          <textarea id="fbContent" name="content" rows="6" maxlength="${CONTENT_MAX}" aria-describedby="fbContentErr" required ${off}></textarea>
          <div class="cx-meta"><span class="cx-error" id="fbContentErr" role="alert"></span><span class="cx-count" id="fbCount" aria-hidden="true">0/${CONTENT_MAX}</span></div></div>
        <div class="cx-hp" aria-hidden="true"><label>网站<input type="text" name="website" tabindex="-1" autocomplete="off" value=""></label></div>
        <div class="cx-turnstile" id="fbTurnstile"></div>
        <p class="cx-note">提交后将公开记录在项目的 GitHub 中，请勿填写个人信息或联系方式。</p>
        <p class="form-message cx-status" id="fbStatus" role="status" aria-live="polite"></p>
        <div class="cx-actions"><button type="button" class="btn btn-outline cx-cancel">取消</button><button type="submit" class="btn btn-primary cx-submit" ${off}>提交意见</button></div>
      </form>
      <div class="cx-success" hidden><p class="cx-success-text" role="status"></p><div class="cx-actions"><button type="button" class="btn btn-primary cx-done">完成</button></div></div>
    </div>`);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const dialog = overlay.querySelector(".cx-dialog");
  const form = overlay.querySelector(".cx-form");
  const status = overlay.querySelector("#fbStatus");
  const submit = overlay.querySelector(".cx-submit");
  const content = form.content;
  let token = "";
  let widgetId = null;
  let sending = false;
  let closed = false;

  const updateCount = () => { overlay.querySelector("#fbCount").textContent = `${content.value.length}/${CONTENT_MAX}`; };
  content.addEventListener("input", updateCount);
  const setStatus = (text, kind = "") => { status.textContent = text; status.dataset.kind = kind; };

  function close() {
    if (closed) return;
    closed = true;
    if (widgetId !== null) { try { window.turnstile?.remove(widgetId); } catch { /* 忽略 */ } }
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    if (trigger?.isConnected) trigger.focus();
  }

  function onKeydown(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== "Tab") return;
    const nodes = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest("[hidden]") && el.getClientRects().length);
    if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener("keydown", onKeydown, true);
  overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector(".cx-close").addEventListener("click", close);
  overlay.querySelector(".cx-cancel").addEventListener("click", close);
  overlay.querySelector(".cx-done").addEventListener("click", close);
  dialog.tabIndex = -1;

  if (available) {
    setStatus("正在加载人机验证……");
    loadTurnstile().then((turnstile) => {
      if (closed) return;
      widgetId = turnstile.render(overlay.querySelector("#fbTurnstile"), {
        sitekey: siteKey,
        theme: "light",
        language: "zh-cn",
        callback: (value) => { token = value; if (!sending) setStatus(""); },
        "expired-callback": () => { token = ""; },
        "error-callback": () => { token = ""; setStatus("人机验证出错，请刷新验证后重试。", "error"); },
      });
      setStatus("");
    }).catch(() => {
      if (!closed) setStatus("人机验证加载失败，请检查网络后重新打开此窗口。", "error");
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!available || sending) return;
    const result = validateFeedback({ category: form.category.value, content: content.value });
    const err = overlay.querySelector("#fbContentErr");
    err.textContent = result.errors.content || "";
    if (result.errors.content) content.setAttribute("aria-invalid", "true"); else content.removeAttribute("aria-invalid");
    if (!result.ok) { content.focus(); return; }
    const wait = throttleRemaining();
    if (wait > 0) { setStatus(`提交过于频繁，请 ${Math.ceil(wait / 1000)} 秒后再试。`, "error"); return; }
    if (!token) { setStatus("请先完成人机验证。", "error"); return; }

    sending = true;
    submit.disabled = true;
    submit.textContent = "提交中……";
    setStatus("正在提交……");
    const response = await submitFeedback(buildFeedbackPayload({ ...result.values, token }));
    sending = false;
    if (closed) return;
    token = "";
    if (widgetId !== null) { try { window.turnstile?.reset(widgetId); } catch { /* 忽略 */ } }
    submit.disabled = false;
    submit.textContent = "提交意见";
    if (response.ok) {
      markSubmitted();
      form.hidden = true;
      const box = overlay.querySelector(".cx-success");
      box.hidden = false;
      box.querySelector(".cx-success-text").textContent = response.duplicate
        ? "这条意见已有人提过了，感谢你的反馈。"
        : "感谢你的意见，我们会认真阅读。";
      box.querySelector(".cx-done").focus();
    } else {
      setStatus(response.error, "error");
    }
  });

  (available ? content : overlay.querySelector(".cx-close")).focus();
  return { close };
}
