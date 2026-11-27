import { describe, expect, it } from "vitest";
import poems from "../src/data/poems.json" with { type: "json" };
import { poemDataPlugin, toIndexEntry } from "./poem-data-plugin.mjs";

const plugin = poemDataPlugin();
const load = (id) => plugin.load.call({}, plugin.resolveId(id));
const evalDefault = (code) => JSON.parse(code.replace(/^export default /, "").replace(/;$/, ""));

describe("poem data plugin", () => {
  it("目录包含全部诗篇，每首只带首句，体积远小于全文", () => {
    const code = load("virtual:poem-index");
    const index = evalDefault(code);
    expect(index).toHaveLength(poems.length);
    expect(index[0]).toEqual(toIndexEntry(poems[0]));
    expect(index.every((p) => p.content.length <= 1)).toBe(true);
    expect(code.length).toBeLessThan(JSON.stringify(poems).length / 5);
  });

  it("每首都有对应的单篇模块，内容与 poems.json 一致", () => {
    const loaders = load("virtual:poem-loaders");
    for (const poem of poems) expect(loaders).toContain(`import("virtual:poem/${poem.id}")`);
    expect(evalDefault(load("virtual:poem/1"))).toEqual(poems.find((p) => p.id === 1));
    expect(evalDefault(load("virtual:poem/99999"))).toBeNull();
  });

  it("不处理其他模块", () => {
    expect(plugin.resolveId("./foo.js")).toBeNull();
    expect(plugin.load("/src/main.js")).toBeNull();
  });
});
