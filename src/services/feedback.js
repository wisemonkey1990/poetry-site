/**
 * 读者意见：校验与提交。后端契约：POST /api/feedback（同源，JSON）。
 * 节流与纠错共用（见 corrections.js）。
 */
import { normalizeText, submitCorrection } from "./corrections.js";

export const CONTENT_MIN = 5;
export const CONTENT_MAX = 1000;
export const CATEGORIES = ["功能建议", "内容问题", "使用问题", "其他"];
export const FEEDBACK_ENDPOINT = "/api/feedback";

function hasControl(text) {
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 0x0a || code === 0x09) continue;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

export function validateFeedback(input = {}) {
  const errors = {};
  const category = CATEGORIES.includes(input.category) ? input.category : "其他";
  const content = normalizeText(input.content);
  if (!content) errors.content = "请填写意见内容";
  else if ([...content].length < CONTENT_MIN) errors.content = `意见内容至少 ${CONTENT_MIN} 个字`;
  else if ([...content].length > CONTENT_MAX) errors.content = `意见内容不超过 ${CONTENT_MAX} 字`;
  else if (hasControl(content)) errors.content = "意见内容含有不支持的字符";
  return { ok: Object.keys(errors).length === 0, errors, values: { category, content } };
}

export function buildFeedbackPayload({ category, content, token }) {
  return { category, content: normalizeText(content), token: String(token ?? ""), website: "" };
}

export function submitFeedback(payload, fetchImpl, timeoutMs) {
  return submitCorrection(payload, fetchImpl, timeoutMs, FEEDBACK_ENDPOINT);
}
