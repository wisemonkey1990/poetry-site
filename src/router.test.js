import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";

let triggerHashChange;
const handlerCalls = [];

beforeAll(async () => {
  const listeners = {};
  vi.stubGlobal("window", {
    location: { hash: "" },
    addEventListener: vi.fn((event, cb) => { listeners[event] = cb; }),
  });
  vi.stubGlobal("history", { back: vi.fn() });
  vi.stubGlobal("document", { getElementById: vi.fn(() => null) });
  vi.stubGlobal("console", { error: vi.fn(), warn: vi.fn(), ...console });

  const router = await import("./router.js");
  triggerHashChange = async () => { await listeners.hashchange?.(); };

  router.route("/poem/:id", (params, query) => { handlerCalls.push({ params, query }); return null; });
  router.route("/search", (params, query) => { handlerCalls.push({ params, query }); return null; });
  router.route("/browse/:category", (params, query) => { handlerCalls.push({ params, query }); return null; });
  router.route("/", (params, query) => { handlerCalls.push({ params, query }); return null; });

  router.initRouter();
});

beforeEach(() => { handlerCalls.length = 0; });

async function goTo(hash) {
  window.location.hash = hash;
  await triggerHashChange();
}

describe("router 路由匹配", () => {
  it("参数路由 /poem/:id 匹配并提取 id", async () => {
    await goTo("#/poem/123");
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0].params.id).toBe("123");
  });

  it("多参数路由 /browse/:category 匹配分类参数", async () => {
    await goTo("#/browse/国风");
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0].params.category).toBe("国风");
  });

  it("查询字符串被正确解析为 query 对象", async () => {
    await goTo("#/search?q=关雎&page=2");
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0].query.q).toBe("关雎");
    expect(handlerCalls[0].query.page).toBe("2");
  });

  it("无查询字符串时 query 为空对象", async () => {
    await goTo("#/search");
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0].query).toEqual({});
  });

  it("根路径 / 匹配", async () => {
    await goTo("#/");
    expect(handlerCalls).toHaveLength(1);
  });

  it("URL 编码的参数被解码", async () => {
    await goTo("#/browse/%E5%B0%8F%E9%9B%85");
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0].params.category).toBe("小雅");
  });
});
