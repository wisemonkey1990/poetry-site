import { describe, expect, it } from "vitest";
import { escapeAttribute, escapeHtml, textToHtml } from "./html.js";

describe("HTML 输出安全", () => {
  it("转义标签、引号和事件属性载荷", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("转义属性中的单引号与反引号", () => {
    expect(escapeAttribute("'` onclick='x")).toBe("&#39;&#96; onclick=&#39;x");
  });

  it("只将安全转义后的换行转换为 br", () => {
    expect(textToHtml("甲<script>\n乙")).toBe("甲&lt;script&gt;<br>乙");
  });
});