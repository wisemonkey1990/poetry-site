import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";

const handlerCalls = [];
let router;
const listeners = {};

function setUrl(url) {
  const u = new URL(url, "https://poetry.lightos.wiki");
  window.location.pathname = u.pathname;
  window.location.search = u.search;
  window.location.hash = u.hash;
}

beforeAll(async () => {
  vi.stubGlobal("window", {
    location: { pathname: "/", search: "", hash: "" },
    addEventListener: vi.fn((event, cb) => { listeners[event] = cb; }),
  });
  vi.stubGlobal("history", {
    pushState: vi.fn((_s, _t, url) => setUrl(url)),
    replaceState: vi.fn((_s, _t, url) => setUrl(url)),
  });
  vi.stubGlobal("document", { getElementById: vi.fn(() => null), addEventListener: vi.fn() });

  router = await import("./router.js");
  for (const pattern of ["/poem/:id", "/search", "/browse/:category", "/"]) {
    router.route(pattern, (params, query) => { handlerCalls.push({ pattern, params, query }); return null; });
  }
});

beforeEach(() => { handlerCalls.length = 0; });

describe("router 路由匹配", () => {
  it("参数路由 /poem/:id 匹配并提取 id", async () => {
    await router.navigate("/poem/123");
    expect(handlerCalls).toEqual([{ pattern: "/poem/:id", params: { id: "123" }, query: {} }]);
    expect(window.location.pathname).toBe("/poem/123");
  });

  it("URL 编码的参数被解码", async () => {
    await router.navigate("/browse/%E5%B0%8F%E9%9B%85");
    expect(handlerCalls[0].params.category).toBe("小雅");
  });

  it("查询字符串被正确解析为 query 对象", async () => {
    await router.navigate(`/search?q=${encodeURIComponent("关雎")}&page=2`);
    expect(handlerCalls[0].query).toEqual({ q: "关雎", page: "2" });
  });

  it("兼容旧写法：#/poem/1 与不带斜杠的路径", async () => {
    await router.navigate("#/poem/1");
    await router.navigate("poem/2");
    expect(handlerCalls.map((c) => c.params.id)).toEqual(["1", "2"]);
  });

  it("未知路径回到首页（replace，不新增历史记录）", async () => {
    history.pushState.mockClear();
    await router.navigate("/nope/x/y");
    expect(handlerCalls.at(-1).pattern).toBe("/");
    expect(window.location.pathname).toBe("/");
    expect(history.replaceState).toHaveBeenCalled();
  });

  it("浏览器后退（popstate）重新渲染当前地址", async () => {
    setUrl("/poem/7");
    await listeners.popstate?.();
    // popstate 只在 initRouter 后注册
    if (!listeners.popstate) { await router.initRouter(); handlerCalls.length = 0; setUrl("/poem/7"); await listeners.popstate(); }
    expect(handlerCalls.at(-1).params.id).toBe("7");
  });

  it("initRouter 把旧的 hash 地址转成真实路径", async () => {
    setUrl("/#/poem/42");
    await router.initRouter();
    expect(window.location.pathname).toBe("/poem/42");
    expect(handlerCalls.at(-1).params.id).toBe("42");
  });

  it("onRouteChange 在渲染前收到路径", async () => {
    const seen = [];
    router.onRouteChange((p) => seen.push(p));
    await router.navigate("/search?q=x");
    expect(seen).toEqual(["/search?q=x"]);
  });
});
