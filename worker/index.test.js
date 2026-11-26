import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { resetRateLimiter } from "./index.js";

const ORIGIN = "https://poetry.lightos.wiki";
const env = (extra = {}) => ({
  CORRECTION_GITHUB_TOKEN: "ghp_secret_token",
  TURNSTILE_SECRET_KEY: "ts_secret",
  GITHUB_REPO: "wisemonkey1990/poetry-site",
  ASSETS: { fetch: vi.fn(async () => new Response("asset", { status: 200 })) },
  ...extra,
});
const good = { poemId: 1, quote: "关关雎鸠", suggestion: "关关睢鸠", reason: "某本", token: "tok", website: "" };
const req = (body, { method = "POST", headers = {}, path = "/api/correction" } = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": "1.2.3.4", ...headers },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
const j = (status, body) => new Response(JSON.stringify(body), { status });

let calls;
function mockFetch({ turnstile = { success: true }, search = { items: [] }, create = () => j(201, { number: 42 }), label = () => j(201, {}) } = {}) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes("turnstile")) return j(200, turnstile);
    if (u.includes("/search/issues")) return j(200, search);
    if (u.endsWith("/labels")) return label();
    if (u.endsWith("/issues")) return create();
    throw new Error("unexpected " + u);
  }));
}
const issueCall = () => calls.find((c) => c.url.endsWith("/issues"));

beforeEach(() => {
  resetRateLimiter();
  mockFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe("routing", () => {
  it("passes non-api paths to assets", async () => {
    const e = env();
    const res = await worker.fetch(new Request(`${ORIGIN}/poem/1`), e);
    expect(await res.text()).toBe("asset");
    expect(e.ASSETS.fetch).toHaveBeenCalled();
  });
  it("returns JSON 404 for unknown api paths", async () => {
    const res = await worker.fetch(req(null, { method: "GET", path: "/api/nope" }), env());
    expect(res.status).toBe(404);
    expect((await res.json()).ok).toBe(false);
  });
  it("405 for non-POST", async () => {
    const res = await worker.fetch(req(null, { method: "GET" }), env());
    expect(res.status).toBe(405);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("guards", () => {
  it("rejects foreign origin", async () => {
    const res = await worker.fetch(req(good, { headers: { Origin: "https://evil.example" } }), env());
    expect(res.status).toBe(403);
  });
  it("allows localhost origin", async () => {
    const res = await worker.fetch(req(good, { headers: { Origin: "http://localhost:5173" } }), env());
    expect(res.status).toBe(200);
  });
  it("503 when secrets absent", async () => {
    for (const k of ["CORRECTION_GITHUB_TOKEN", "TURNSTILE_SECRET_KEY"]) {
      const res = await worker.fetch(req(good), env({ [k]: undefined }));
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("纠错功能暂未启用");
    }
  });
  it("413 on large body", async () => {
    const res = await worker.fetch(req({ ...good, reason: "a".repeat(5000) }), env());
    expect(res.status).toBe(413);
  });
  it("400 on invalid JSON", async () => {
    expect((await worker.fetch(req("{nope"), env())).status).toBe(400);
  });
});

describe("validation", () => {
  const bad = [
    { poemId: 0 }, { poemId: 306 }, { poemId: "1" }, { poemId: 1.5 },
    { quote: "" }, { quote: "  " }, { quote: 5 }, { quote: "a".repeat(201) },
    { suggestion: "" }, { suggestion: "x\u0000y" }, { suggestion: "a".repeat(201) },
    { reason: "r".repeat(501) }, { reason: 3 }, { token: "" }, { token: undefined },
    { website: "http://spam" },
  ];
  it.each(bad)("rejects %j", async (patch) => {
    const res = await worker.fetch(req({ ...good, ...patch }), env());
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("accepts missing reason and collapses whitespace", async () => {
    const noReason = { ...good };
    delete noReason.reason;
    const res = await worker.fetch(req({ ...noReason, quote: "关关\n\t 雎鸠" }), env());
    expect(res.status).toBe(200);
    expect(JSON.parse(issueCall().init.body).body).toContain("关关 雎鸠");
  });
});

describe("turnstile and rate limit", () => {
  it("403 when turnstile fails", async () => {
    mockFetch({ turnstile: { success: false } });
    const res = await worker.fetch(req(good), env());
    expect(res.status).toBe(403);
    expect(issueCall()).toBeUndefined();
  });
  it("sends remoteip to turnstile", async () => {
    await worker.fetch(req(good), env());
    const t = calls.find((c) => c.url.includes("turnstile"));
    expect(t.init.body.get("remoteip")).toBe("1.2.3.4");
    expect(t.init.body.get("secret")).toBe("ts_secret");
  });
  it("429 after 5 requests from one IP", async () => {
    const e = env();
    for (let i = 0; i < 5; i++) expect((await worker.fetch(req(good), e)).status).toBe(200);
    expect((await worker.fetch(req(good), e)).status).toBe(429);
    const other = await worker.fetch(req(good, { headers: { "CF-Connecting-IP": "9.9.9.9" } }), e);
    expect(other.status).toBe(200);
  });
});

describe("github", () => {
  it("returns duplicate when identical open issue exists", async () => {
    let title;
    mockFetch();
    await worker.fetch(req(good), env());
    title = JSON.parse(issueCall().init.body).title;
    resetRateLimiter();
    mockFetch({ search: { items: [{ title }] } });
    const res = await worker.fetch(req(good), env());
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(issueCall()).toBeUndefined();
  });
  it("creates an issue (happy path)", async () => {
    const res = await worker.fetch(req({ ...good, reason: "见 ```x``` @bob [l](http://x) <b>" }), env());
    expect(await res.json()).toEqual({ ok: true, issueNumber: 42 });
    const c = issueCall();
    expect(c.init.headers.Authorization).toBe("Bearer ghp_secret_token");
    expect(c.init.headers["User-Agent"]).toBe("poetry-correction-worker");
    const issue = JSON.parse(c.init.body);
    expect(issue.title).toMatch(/^\[纠错\] 诗序 1 · [0-9a-f]{8}$/);
    expect(issue.labels).toEqual(["correction"]);
    const m = issue.body.match(/```json\n([\s\S]*?)\n```/);
    expect(m).toBeTruthy();
    const data = JSON.parse(m[1]);
    expect(data).toMatchObject({ poemId: 1, quote: "关关雎鸠", suggestion: "关关睢鸠" });
    expect(data.reason).toBe("见 ```x``` @bob [l](http://x) <b>");
    // exactly two fence lines: user backticks never appear raw
    expect(issue.body.match(/```/g)).toHaveLength(2);
    expect(issue.body).not.toContain("@bob");
    expect(issue.body).not.toContain("1.2.3.4");
  });
  it("creates the label and retries on 422", async () => {
    let n = 0;
    mockFetch({ create: () => (n++ === 0 ? j(422, { message: "label" }) : j(201, { number: 7 })) });
    const res = await worker.fetch(req(good), env());
    expect(await res.json()).toEqual({ ok: true, issueNumber: 7 });
    expect(calls.some((c) => c.url.endsWith("/labels"))).toBe(true);
  });
  it("502 generic on GitHub failure without leaking", async () => {
    mockFetch({ create: () => j(500, { message: "secret upstream detail" }) });
    const res = await worker.fetch(req(good), env());
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("upstream");
    expect(text).not.toContain("ghp_");
  });
  it("502 when search fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url) => (String(url).includes("turnstile") ? j(200, { success: true }) : j(403, {}))));
    expect((await worker.fetch(req(good), env())).status).toBe(502);
  });
});
