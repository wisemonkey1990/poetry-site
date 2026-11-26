# 读者纠错（纠错功能）部署说明

## 设计概览

1. 读者在诗篇页填写「原文片段 / 建议改为 / 理由」，并通过 Cloudflare Turnstile 人机验证。
2. 浏览器向同源的 `POST /api/correction` 发送 JSON（不含任何密钥）。
3. Cloudflare Worker（`worker/index.js`）校验来源、长度、控制字符、蜜罐字段，并做尽力而为的按 IP 限流（5 次 / 10 分钟，进程内计数）。
4. Worker 服务端调用 Turnstile `siteverify` 验证 token。
5. Worker 用 GitHub 搜索接口按「诗序 + 内容哈希」查重，已有相同的开放纠错则直接返回 `duplicate`。
6. 否则在 `wisemonkey1990/poetry-site` 创建 Issue，标题 `[纠错] 诗序 <id> · <hash8>`，标签 `correction`。
7. 用户文本只出现在 Issue 正文的 ```json 代码块内（反引号、`<`、`>`、`&`、`@` 已转义），不记录 IP / UA / 联系方式。
8. 后续的自动修复流程读取该 JSON，创建 `correction/*` 分支 PR；`ci.yml` 的 `correction-guard` 限制其只能改数据文件且 `poems.json` 改动不超过 10 行。
9. GitHub Token 只存在于 Worker 的 secret 中，不会进入浏览器或仓库。
10. 未配置密钥时站点正常部署，接口返回 503「纠错功能暂未启用」。

## 站长需要做的步骤

### 1. 创建 GitHub 细粒度令牌

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token：

- Repository access：Only select repositories，仅选 `wisemonkey1990/poetry-site`
- Permissions：Repository permissions → **Issues: Read and write**（其余全部保持 No access）

将令牌添加为仓库 secret：Settings → Secrets and variables → Actions → Secrets → New repository secret，名称 `CORRECTION_GITHUB_TOKEN`。

### 2. 创建 Cloudflare Turnstile 小组件

Cloudflare 控制台 → Turnstile → Add widget，Hostname 填 `poetry.lightos.wiki`（本地调试可另加 `localhost`）。

- Secret key → 仓库 secret `TURNSTILE_SECRET_KEY`
- Site key（公开）→ 仓库 variable `VITE_TURNSTILE_SITE_KEY`（Settings → Secrets and variables → Actions → Variables；注意是 Variables 而不是 Secrets）。`deploy-cloudflare.yml` 里已写入默认的 Site Key，变量存在时优先使用变量。GitHub Pages 的部署没有 Worker，不传这个值，那里的纠错入口会显示「暂未开放」。

### 3. 创建标签

在仓库 Issues → Labels 中创建：`correction`、`needs-human`、`auto-fixed`、`rejected`。
（`correction` 缺失时 Worker 会尝试自动创建一次，但建议手动创建。）

### 4. 重新部署

Actions → Deploy to Cloudflare → Run workflow（或推送到 main）。只有两个 secret 都存在时，部署才会把它们上传给 Worker；否则会跳过上传且不会失败。前端需重新构建才能读取 `VITE_TURNSTILE_SITE_KEY`。

### 5. 用 curl 测试

Turnstile 需要真实 token，可用 Cloudflare 官方测试密钥临时验证流程（仅限测试环境，勿用于生产）。

```bash
# 未配置 / 参数错误时的响应（不会创建 Issue）
curl -i -X POST https://poetry.lightos.wiki/api/correction \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://poetry.lightos.wiki' \
  -d '{"poemId":1,"quote":"","suggestion":"x","token":"x","website":""}'
# 预期 400 {"ok":false,"error":"请填写原文片段"}

curl -i https://poetry.lightos.wiki/api/correction        # 预期 405
curl -i https://poetry.lightos.wiki/api/unknown           # 预期 404 JSON

# 完整提交（token 为浏览器中 Turnstile 小组件产生的真实值）
curl -i -X POST https://poetry.lightos.wiki/api/correction \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://poetry.lightos.wiki' \
  -d '{"poemId":1,"quote":"关关雎鸠","suggestion":"测试","reason":"测试","token":"<TURNSTILE_TOKEN>","website":""}'
# 预期 200 {"ok":true,"issueNumber":N}；测试后请关闭该 Issue
```

本地调试 Worker：`npx wrangler dev`，密钥写入未提交的 `.dev.vars` 文件（`CORRECTION_GITHUB_TOKEN=...`、`TURNSTILE_SECRET_KEY=...`）。
