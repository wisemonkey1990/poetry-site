// 浏览器冒烟测试：先 npm run build，再 npm run test:e2e。
// 默认用 wrangler dev 起本地 Cloudflare 环境（与线上同样的 _headers、_redirects、404 处理）；
// 设置 E2E_BASE_URL 可直接测线上或预览地址。
import { defineConfig, devices } from "@playwright/test";

const PORT = 8799;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL, trace: "off" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1 --log-level warn`,
    url: `${baseURL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
