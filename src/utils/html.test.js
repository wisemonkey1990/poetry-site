import { describe, expect, it } from "vitest";
import { escapeAttribute, escapeHtml, html, raw, setHtml, textToHtml } from "./html.js";

describe("HTML 输出安全", () => {
  it("转义标签、引号和事件属性载荷", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("转义属性中的单引号与反引号", () => {
    expect(escapeAttribute("'` onclick='x")).toBe("&#39;&#96; onclick=&#39;x");
  });

  it("只将安全转义后的换行转换为 br", () => {
    expect(String(textToHtml("甲<script>\n乙"))).toBe("甲&lt;script&gt;<br>乙");
  });

  it("html`` 默认转义插值，含属性里的引号", () => {
    const name = '"><img src=x onerror=alert(1)>';
    expect(String(html`<a title="${name}">${name}</a>`)).toBe('<a title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</a>');
  });

  it("嵌套片段、数组和 raw() 原样拼接，null/undefined/false 为空", () => {
    const items = ["甲", "<乙>"].map((t) => html`<li>${t}</li>`);
    expect(String(html`<ul>${items}</ul>${null}${undefined}${false}${0}${raw("<b>粗</b>")}`)).toBe("<ul><li>甲</li><li>&lt;乙&gt;</li></ul>0<b>粗</b>");
  });

  it("setHtml 对普通字符串按纯文本写入", () => {
    const el = { innerHTML: "" };
    setHtml(/** @type {any} */ (el), "<script>x</script>");
    expect(el.innerHTML).toBe("&lt;script&gt;x&lt;/script&gt;");
    setHtml(/** @type {any} */ (el), html`<p>${"<i>"}</p>`);
    expect(el.innerHTML).toBe("<p>&lt;i&gt;</p>");
  });
});
