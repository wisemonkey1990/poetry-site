import { html, setHtml } from "../utils/html.js";
import { readSelectedText } from "../utils/selection.js";
import {
  QUOTE_MAX, SUGGESTION_MAX, REASON_MAX, validateCorrection, buildPayload, submitCorrection,
  throttleRemaining, markSubmitted, clampQuote,
} from "../services/corrections.js";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstilePromise = null;

export function getSiteKey() {
  try { return String(import.meta.env?.VITE_TURNSTILE_SITE_KEY || "").trim(); }
  catch { return ""; }
}

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstilePromise) {
    turnstilePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
      script.onerror = () => { script.remove(); reject(new Error("turnstile load failed")); };
      document.head.appendChild(script);
    }).catch((error) => { turnstilePromise = null; throw error; });
  }
  return turnstilePromise;
}

/** 读取读者在诗文/注释容器内的划选文字（忽略拼音）。 */
export function readSelectedQuote(root = document) {
  return clampQuote(readSelectedText(root));
}

export const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]):not([tabindex='-1']), textarea:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex='-1'])";

const counter = (id, max) => html`<span class="cx-count" id="${id}" aria-hidden="true">0/${max}</span>`;

export function openCorrectionDialog({ poem, trigger = null, initialQuote = "" }) {
  const siteKey = getSiteKey();
  const available = Boolean(siteKey);
  const previousOverflow = document.body.style.overflow;
  const id = String(poem.id).padStart(3, "0");
  const off = available ? "" : "disabled";

  const overlay = document.createElement("div");
  overlay.className = "cx-overlay";
  setHtml(overlay, html`
    <div class="cx-dialog" role="dialog" aria-modal="true" aria-labelledby="cxTitle" aria-describedby="cxIntro">
      <button type="button" class="cx-close" aria-label="关闭">×</button>
      <h2 class="cx-title" id="cxTitle">纠错</h2>
      <p class="cx-poem" id="cxIntro">《${poem.title}》· 诗序 ${id}</p>
      ${available ? "" : html`<p class="form-message cx-message" role="status">纠错功能暂未开放</p>`}
      <form class="cx-form" novalidate>
        <div class="cx-field"><label for="cxQuote">原文片段 <em>必填</em></label>
          <input id="cxQuote" name="quote" type="text" maxlength="${QUOTE_MAX}" autocomplete="off" aria-describedby="cxQuoteErr" required ${off}>
          <div class="cx-meta"><span class="cx-error" id="cxQuoteErr" role="alert"></span>${counter("cxQuoteCount", QUOTE_MAX)}</div></div>
        <div class="cx-field"><label for="cxSuggestion">建议改为 <em>必填</em></label>
          <input id="cxSuggestion" name="suggestion" type="text" maxlength="${SUGGESTION_MAX}" autocomplete="off" aria-describedby="cxSuggestionErr" required ${off}>
          <div class="cx-meta"><span class="cx-error" id="cxSuggestionErr" role="alert"></span>${counter("cxSuggestionCount", SUGGESTION_MAX)}</div></div>
        <div class="cx-field"><label for="cxReason">理由或出处（选填）</label>
          <textarea id="cxReason" name="reason" rows="3" maxlength="${REASON_MAX}" aria-describedby="cxReasonErr" ${off}></textarea>
          <div class="cx-meta"><span class="cx-error" id="cxReasonErr" role="alert"></span>${counter("cxReasonCount", REASON_MAX)}</div></div>
        <div class="cx-hp" aria-hidden="true"><label>网站<input type="text" name="website" tabindex="-1" autocomplete="off" value=""></label></div>
        <div class="cx-turnstile" id="cxTurnstile"></div>
        <p class="cx-note">提交后将公开记录在项目的 GitHub 中，请勿填写个人信息。</p>
        <p class="form-message cx-status" id="cxStatus" role="status" aria-live="polite"></p>
        <div class="cx-actions"><button type="button" class="btn btn-outline cx-cancel">取消</button><button type="submit" class="btn btn-primary cx-submit" ${off}>提交纠错</button></div>
      </form>
      <div class="cx-success" hidden><p class="cx-success-text" role="status"></p><div class="cx-actions"><button type="button" class="btn btn-primary cx-done">完成</button></div></div>
    </div>`);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const dialog = overlay.querySelector(".cx-dialog");
  const form = overlay.querySelector(".cx-form");
  const status = overlay.querySelector("#cxStatus");
  const submit = overlay.querySelector(".cx-submit");
  const fields = { quote: form.quote, suggestion: form.suggestion, reason: form.reason };
  const counts = { quote: ["#cxQuoteCount", QUOTE_MAX], suggestion: ["#cxSuggestionCount", SUGGESTION_MAX], reason: ["#cxReasonCount", REASON_MAX] };
  const errorIds = { quote: "#cxQuoteErr", suggestion: "#cxSuggestionErr", reason: "#cxReasonErr" };
  let token = "";
  let widgetId = null;
  let sending = false;
  let closed = false;

  fields.quote.value = clampQuote(initialQuote);

  const updateCount = (name) => {
    const [selector, max] = counts[name];
    overlay.querySelector(selector).textContent = `${fields[name].value.length}/${max}`;
  };
  Object.keys(fields).forEach((name) => { updateCount(name); fields[name].addEventListener("input", () => updateCount(name)); });

  const showErrors = (errors) => {
    for (const name of Object.keys(fields)) {
      const message = errors[name] || "";
      overlay.querySelector(errorIds[name]).textContent = message;
      if (message) fields[name].setAttribute("aria-invalid", "true"); else fields[name].removeAttribute("aria-invalid");
    }
  };
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

  const resetWidget = () => {
    token = "";
    if (widgetId !== null) { try { window.turnstile?.reset(widgetId); } catch { /* 忽略 */ } }
  };

  if (available) {
    setStatus("正在加载人机验证……");
    loadTurnstile().then((turnstile) => {
      if (closed) return;
      widgetId = turnstile.render(overlay.querySelector("#cxTurnstile"), {
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
    const result = validateCorrection({ quote: fields.quote.value, suggestion: fields.suggestion.value, reason: fields.reason.value });
    showErrors(result.errors);
    if (!result.ok) { form.querySelector("[aria-invalid]")?.focus(); return; }
    const wait = throttleRemaining();
    if (wait > 0) { setStatus(`提交过于频繁，请 ${Math.ceil(wait / 1000)} 秒后再试。`, "error"); return; }
    if (!token) { setStatus("请先完成人机验证。", "error"); return; }

    sending = true;
    submit.disabled = true;
    submit.textContent = "提交中……";
    setStatus("正在提交……");
    const response = await submitCorrection(buildPayload({ poemId: poem.id, ...result.values, token }));
    sending = false;
    if (closed) return;
    resetWidget();
    submit.disabled = false;
    submit.textContent = "提交纠错";
    if (response.ok) {
      markSubmitted();
      form.hidden = true;
      const box = overlay.querySelector(".cx-success");
      box.hidden = false;
      box.querySelector(".cx-success-text").textContent = response.duplicate
        ? "这处问题已有人反馈过了，感谢你的留意，我们会尽快核对。"
        : "感谢纠错，我们会核对后更新。";
      box.querySelector(".cx-done").focus();
    } else {
      setStatus(response.error, "error");
    }
  });

  (available ? (fields.quote.value ? fields.suggestion : fields.quote) : overlay.querySelector(".cx-close")).focus();
  return { close };
}
