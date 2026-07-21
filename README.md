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

## 用户注册与云端收藏

项目使用 Supabase Auth + PostgreSQL：

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，依次执行：
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_poems.sql`
3. 复制 `.env.example` 为 `.env.local`，填写项目 URL 和 anon key。
4. 在 Authentication → URL Configuration 中加入：
   - 本地：`http://localhost:3000/`
   - 生产：`https://wisemonkey1990.github.io/poetry-site/`
5. GitHub Pages 部署时，在仓库 Settings → Secrets and variables → Actions 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

已实现注册、登录、退出、个人资料、云端收藏、取消收藏，以及首次登录时迁移旧的 localStorage 收藏。
