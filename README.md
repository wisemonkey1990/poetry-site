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

## Supabase、后台与云端收藏

项目使用 Supabase Auth + PostgreSQL。用户可通过邮箱注册、验证并登录，登录后可使用云端收藏。

1. 在 Supabase 创建项目，复制 `.env.example` 为 `.env.local` 并填写 Project URL 和 anon/publishable key。
2. 在 SQL Editor 依次执行：
   - `supabase/migrations/003_admin_and_analytics.sql`
   - `supabase/migrations/004_seed_poems.sql`
3. 在 Authentication → Users 创建管理员登录账号，复制该用户 UUID。
4. 在 SQL Editor 授予首位管理员权限：

```sql
insert into public.admin_users (user_id, role)
values ('替换为管理员用户 UUID', 'super_admin');
```

5. 打开 `http://localhost:3000/#/admin/login` 登录后台。
6. 后台支持诗篇搜索、分页、新增、编辑、上下架，以及近 7/30 天匿名 PV、UV、热门诗篇、来源和设备统计。

访客统计只保存随机匿名会话 UUID、页面路径、关联诗篇、来源域名、设备类别和时间，不保存原始 IP、完整 User-Agent、姓名或邮箱。localhost 和后台页面不会计入统计；上报失败不影响阅读。

在 Supabase Authentication → URL Configuration 添加本地和线上回调地址。GitHub Pages 部署还需在仓库 Actions Secrets 配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。前端只能使用 anon/publishable key，禁止使用 service_role key。