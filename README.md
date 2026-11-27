# 诗三百

古风诗经阅读网站，收录《诗经》305 篇（笙诗六篇有目无辞，未收录），支持分类浏览、关键词搜索、拼音标注、收藏和分享。线上地址：<https://poetry.lightos.wiki>

## 功能

**阅读页**

- 工具栏：拼音 / 竖排 / 繁体 / 纠错 / 收藏 / 分享 / 字号。
- 标题带拼音；正文使用「远山」纸张背景，并修正了断行问题。
- 字号根据屏幕自动适配，也可手动调节。
- 手机端左右滑动可切换上一篇 / 下一篇。

**站点**

- 分类浏览、关键词搜索、收藏（登录后同步，使用 Supabase）。
- **纠错**：读者在诗篇页提交「原文片段 / 建议改为 / 理由」，自动建 GitHub Issue，再由自动审核流程核对来源、提 PR、通过检查后合并上线。详见 [`docs/corrections-setup.md`](docs/corrections-setup.md) 与 [`docs/corrections-review.md`](docs/corrections-review.md)。
- **提意见**：页脚入口，同一套后端，建带 `feedback` 标签的 Issue，不进入自动纠错流程，由站长人工查看。

## 本地开发

```bash
npm install
npm run dev
```

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint（`src`、`scripts`、`worker`） |
| `npm run test` | Vitest 单元测试 |
| `npm run test:e2e` | 浏览器冒烟测试（先 `npm run build`；用 wrangler dev 起本地环境） |
| `npm run check` | 依次运行 lint、测试、构建（提 PR 前建议跑一遍） |
| `npm run reading:generate` | 重新生成预计算的拼音与繁体数据 |
| `npm run pinyin:overrides` | 生成拼音覆盖规则 |

环境变量见 `.env.example`（Supabase、站点地址等）。Node 版本见 `.nvmrc`。

## 部署

站点只部署在 Cloudflare（poetry.lightos.wiki）。网址是真实路径（`/poem/1`、`/browse/国风`、`/search?q=…`），旧的 `#/poem/1` 链接会自动转成新地址。构建时为每首诗和各篇章生成预渲染页面（含 JSON-LD），未知地址返回 404。响应头（缓存、安全）在 `public/_headers`，旧地址跳转在 `public/_redirects`。

- `ci.yml`：PR 上运行 lint、测试、构建；`correction/*` 分支额外运行 `correction-guard`，限制只能改数据文件。
- `deploy-cloudflare.yml`：推送到 `main` 后部署到 Cloudflare Workers（含 `/api/correction`、`/api/feedback` 接口，代码在 `worker/`）。

## 诗文与注音数据

诗文正文以 `src/data/poems.json` 为唯一数据源（随站点打包发布），Supabase 不再存储或提供诗文。修改诗文请通过 GitHub 提交 PR。

编辑 `src/data/poems.json` 后，必须运行：

```bash
npm run reading:generate
```

以重新生成预计算的拼音与繁体数据，并一并提交。

### 数据来源

正文与注音来自国学梦《诗经》（<https://www.guoxuemeng.com/guoxue/shijing/>），导入过程与取舍见 [`docs/guoxuemeng-import.md`](docs/guoxuemeng-import.md)。原始数据在 `data-sources/guoxuemeng-shijing.json`，由 `scripts/scrape-guoxuemeng.py` 抓取、`scripts/import-guoxuemeng.mjs` 导入。

注音规则：

- 来源中明显的错字不照搬，保留原本的用字。
- 「不」「一」按本调标注，不标变调。
- 站长纸质书的读法优先，例如「施于」yì、「害」hé、「累」léi、语气词「只」zhǐ；这些校正在 `scripts/book-overrides.mjs`，生成时最后应用，优先于国学梦。
- 其他拼音修正通过 `src/data/pinyin-overrides.json` 提 PR。

## 读者反馈

- 发现错字或注音问题：在诗篇页点工具栏的「纠错」。
- 其他建议：页脚「提意见」。
