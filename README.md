# 诗三百

古风诗经阅读网站，收录《诗经》305篇，支持分类浏览、关键词搜索、拼音标注、收藏和分享。

## 本地开发

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
```

项目通过 GitHub Actions 自动部署到 GitHub Pages。

## 诗文数据来源

诗文正文以 `src/data/poems.json` 为唯一数据源（随站点打包发布），Supabase 不再存储或提供诗文。修改诗文请通过 GitHub 提交 PR。

编辑 `src/data/poems.json` 后，必须运行：

```bash
npm run reading:generate
```

以重新生成预计算的拼音与繁体数据，并一并提交。
