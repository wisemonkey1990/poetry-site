/* global document */
import { expect, test } from "@playwright/test";

/** 收集页面错误（忽略本地环境下没有 Supabase / Turnstile 的提示） */
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Supabase|status of 404|challenges\.cloudflare|cloudflareinsights/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

test("首页：篇目齐全，安全与缓存响应头生效", async ({ page }) => {
  const errors = watchErrors(page);
  const response = await page.goto("/");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.locator(".home-poem-link")).toHaveCount(305);
  const script = await page.locator('script[type="module"][src*="/assets/"]').first().getAttribute("src");
  const asset = await page.request.get(script);
  expect(asset.headers()["cache-control"]).toContain("immutable");
  expect(errors).toEqual([]);
});

test("诗篇页：预渲染内容、拼音/竖排/繁体切换", async ({ page, request }) => {
  const raw = await (await request.get("/poem/1")).text();
  expect(raw).toContain("关关雎鸠，在河之洲。");
  expect(raw).toContain('application/ld+json');

  const errors = watchErrors(page);
  await page.goto("/poem/1");
  await expect(page).toHaveTitle(/关雎/);
  const body = page.locator("#poemBody");
  await expect(body.locator("rt").first()).toHaveText("guān");

  await page.locator("#pinyinToggle").click();
  await expect(body).toHaveClass(/hide-pinyin/);
  await page.locator("#pinyinToggle").click();
  await expect(body).not.toHaveClass(/hide-pinyin/);

  await page.locator("#layoutToggle").click();
  await expect(page.locator("#poemPaper")).toHaveAttribute("data-layout", "vertical");
  await page.locator("#layoutToggle").click();
  await expect(page.locator("#poemPaper")).toHaveAttribute("data-layout", "horizontal");

  await page.locator("#scriptToggle").click();
  await expect(body).toContainText("關");
  await page.locator("#scriptToggle").click();
  await expect(body).toContainText("关");
  expect(errors).toEqual([]);
});

test("翻篇与浏览器前进后退", async ({ page }) => {
  await page.goto("/poem/1");
  await page.locator(".poem-nav a", { hasText: "下一篇" }).click();
  await expect(page).toHaveURL(/\/poem\/2$/);
  await expect(page).toHaveTitle(/葛覃/);
  await page.goBack();
  await expect(page).toHaveURL(/\/poem\/1$/);
  await expect(page).toHaveTitle(/关雎/);
  await page.goForward();
  await expect(page).toHaveTitle(/葛覃/);
});

test("电脑键盘左右键翻篇", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "只测电脑");
  await page.goto("/poem/2");
  await expect(page.locator("#poemBody")).toBeVisible();
  await expect(page.locator(".poem-title-row h1")).toContainText("葛");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#poemBody")).toBeVisible();
  await expect(page.locator(".poem-title-row h1")).toContainText("卷");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#poemBody")).toBeVisible();
  await expect(page.locator(".poem-title-row h1")).toContainText("葛");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveTitle(/关雎/);
  await expect(page).toHaveURL(/\/poem\/1$/);
});

test("旧地址兼容：#/ 链接与带斜杠的静态页", async ({ page, request }) => {
  await page.goto("/#/poem/12");
  await expect(page).toHaveURL(/\/poem\/12$/);
  await expect(page).toHaveTitle(/鹊巢/);
  const res = await request.get("/poem/1/", { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers().location).toMatch(/\/poem\/1$/);
});

test("搜索到诗篇并打开", async ({ page }) => {
  await page.goto("/search");
  await page.locator("input").first().fill("蒹葭");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=/);
  await page.locator('a[href="/poem/129"]').first().click();
  await expect(page).toHaveTitle(/蒹葭/);
});

test("页面里没有被转义成文字的标签", async ({ page }) => {
  for (const path of ["/", "/browse", "/browse/国风", "/poem/1", "/search?q=关关"]) {
    await page.goto(path);
    await page.locator(".site-main .container").first().waitFor();
    await expect(page.locator(".loading")).toHaveCount(0);
    const text = await page.locator("body").innerText();
    expect(text, path).not.toMatch(/<\/?[a-z]+[ >]|&lt;|&gt;|&amp;|&quot;/);
  }
  await expect(page.locator(".poem-excerpt mark").first()).toHaveText("关关");
});

test("篇章页列出全部诗篇", async ({ page }) => {
  await page.goto("/browse/小雅");
  await expect(page.locator(".poem-list-item")).toHaveCount(74);
});

test("不存在的地址返回 404 并显示提示", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res.status()).toBe(404);
  await expect(page.locator(".empty-state")).toContainText("未能寻得");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

test("分享卡与 PDF 下载", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/poem/1");
  await page.locator("#shareBtn").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveAttribute("src", /^blob:/, { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.locator("#pdfBtn").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const download = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("dialog").getByRole("button", { name: /带注音/ }).click();
  const file = await (await download).path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(file).subarray(0, 5).toString()).toBe("%PDF-");
  expect(errors).toEqual([]);
});

test("手机窄屏不出现横向滚动", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "只测手机");
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/", "/poem/300", "/browse/国风", "/search"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("离线阅读：读过的诗篇断网后仍能打开", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "只测电脑");
  await page.goto("/poem/1");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // 由 Service Worker 接管后再访问一次，让本页用到的资源进入缓存
  await page.reload();
  await expect(page.locator(".poem-title-row h1")).toContainText("关");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".poem-title-row h1")).toContainText("关");
  await expect(page.locator("#poemBody .poem-line").first()).toHaveAttribute("data-text", /在河之洲/);
  await context.setOffline(false);
});

test("网页应用清单与主屏图标", async ({ request }) => {
  const manifest = await (await request.get("/site.webmanifest")).json();
  const icons = manifest.icons.filter((icon) => icon.type === "image/png");
  expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect((await request.get("/icons/apple-touch-icon.png")).ok()).toBe(true);
});
