/**
 * 读者纠错：校验、提交与客户端节流。
 * 后端契约：POST /api/correction（同源，JSON）。
 */
export const QUOTE_MAX = 200;
export const SUGGESTION_MAX = 200;
export const REASON_MAX = 500;
export const ENDPOINT = "/api/correction";
export const TIMEOUT_MS = 15000;
export const THROTTLE_MS = 20000;
const THROTTLE_KEY = "shijing_correction_last";
const GENERIC_ERROR = "提交失败，请稍后再试。";
const NETWORK_ERROR = "网络异常，请检查网络后重试。";
const TIMEOUT_ERROR = "请求超时，请稍后再试。";

// 控制字符；“理由”字段允许换行与制表符
function hasControl(text, allowNewline = false) {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (allowNewline && (code === 0x0a || code === 0x09)) continue;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

export function normalizeText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

/** 把读者划选的文字规整为可预填的原文片段（单行，不超过 200 字）。 */
export function clampQuote(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, QUOTE_MAX).trim();
}

export function validateCorrection(input = {}) {
  const errors = {};
  const quote = normalizeText(input.quote);
  const suggestion = normalizeText(input.suggestion);
  const reason = normalizeText(input.reason);

  if (!quote) errors.quote = "请填写原文片段";
  else if (quote.length > QUOTE_MAX) errors.quote = `原文片段不超过 ${QUOTE_MAX} 字`;
  else if (hasControl(quote)) errors.quote = "原文片段含有不支持的字符";

  if (!suggestion) errors.suggestion = "请填写建议改为的内容";
  else if (suggestion.length > SUGGESTION_MAX) errors.suggestion = `建议内容不超过 ${SUGGESTION_MAX} 字`;
  else if (hasControl(suggestion)) errors.suggestion = "建议内容含有不支持的字符";
  else if (!errors.quote && suggestion === quote) errors.suggestion = "建议内容与原文相同，无需纠错";

  if (reason.length > REASON_MAX) errors.reason = `理由不超过 ${REASON_MAX} 字`;
  else if (hasControl(reason, true)) errors.reason = "理由含有不支持的字符";

  return { ok: Object.keys(errors).length === 0, errors, values: { quote, suggestion, reason } };
}

export function buildPayload({ poemId, quote, suggestion, reason, token }) {
  return {
    poemId: Number(poemId),
    quote: normalizeText(quote),
    suggestion: normalizeText(suggestion),
    reason: normalizeText(reason),
    token: String(token ?? ""),
    website: "",
  };
}

/**
 * 提交纠错。始终 resolve：{ ok:true, duplicate?, issueNumber? } 或 { ok:false, error, status? }。
 */
export async function submitCorrection(payload, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS) {
  if (typeof fetchImpl !== "function") return { ok: false, error: NETWORK_ERROR };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (data && typeof data === "object" && data.ok === true && response.ok !== false) {
      return data.duplicate
        ? { ok: true, duplicate: true }
        : { ok: true, issueNumber: data.issueNumber };
    }
    const message = data && typeof data.error === "string" && data.error.trim() ? data.error.trim() : GENERIC_ERROR;
    return { ok: false, error: message, status: response.status };
  } catch (error) {
    if (timedOut || error?.name === "AbortError") return { ok: false, error: TIMEOUT_ERROR };
    return { ok: false, error: NETWORK_ERROR };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 节流（模块变量 + sessionStorage）----
let lastSubmitAt = 0;

function readStored(storage) {
  try { return Number(storage?.getItem(THROTTLE_KEY)) || 0; } catch { return 0; }
}

function defaultStorage() {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}

export function throttleRemaining(now = Date.now(), storage = defaultStorage()) {
  const last = Math.max(lastSubmitAt, readStored(storage));
  if (!last) return 0;
  return Math.max(0, THROTTLE_MS - (now - last));
}

export function markSubmitted(now = Date.now(), storage = defaultStorage()) {
  lastSubmitAt = now;
  try { storage?.setItem(THROTTLE_KEY, String(now)); } catch { /* 存储不可用时仅使用内存节流 */ }
}

export function resetThrottleForTests() { lastSubmitAt = 0; }
