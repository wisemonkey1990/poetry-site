export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/** 纯文本转为 HTML：先转义，再把换行变成 <br>。 */
export function textToHtml(value) {
  return raw(escapeHtml(value).replace(/\r?\n/g, "<br>"));
}

/**
 * 已确认安全的 HTML 片段。只能由 html`` 模板或 raw() 产生，
 * 插进别的 html`` 模板时原样输出，不再转义。
 */
export class SafeHtml {
  /** @param {string} value */
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/**
 * 把一段已知安全的 HTML（站内 SVG 图标、已转义过的拼音 ruby 等）标记为可信。
 * 不要把用户或接口返回的内容交给它。
 * @param {unknown} value
 */
export function raw(value) {
  return new SafeHtml(String(value ?? ""));
}

function renderValue(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  if (value == null || value === false) return "";
  return escapeAttribute(value);
}

/**
 * 默认转义的 HTML 模板：插值一律转义（含引号，可放在属性里），
 * 嵌套的 html`` 片段、raw() 和它们组成的数组原样拼接；null、undefined、false 输出为空。
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml}
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/**
 * 写入元素内容。传 html`` / raw() 时按 HTML 写入；传普通字符串时按纯文本转义后写入，
 * 所以忘了用模板也不会变成注入。站内只通过这里写 innerHTML（ESLint 会拦住直接赋值）。
 * @param {Element} element
 * @param {SafeHtml | string | Array<SafeHtml | string>} content
 */
export function setHtml(element, content) {
  element.innerHTML = renderValue(content);
}
