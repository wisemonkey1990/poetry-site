import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPoemPage, buildRobots, buildSitemap, absoluteUrl, normalizeSiteUrl, poemPath, categoryPath, renderRoutePage, OG_IMAGE_FILE,
} from './scripts/static-pages.mjs';
import { buildPoemFont, readReading } from './scripts/pdf-fonts.mjs';
import { poemDataPlugin } from './scripts/poem-data-plugin.mjs';
import { renderOgPng } from './scripts/og-images.mjs';

function staticPagesPlugin(siteUrl) {
  let outDir = 'dist';
  return {
    name: 'shijing-static-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      const image = absoluteUrl(siteUrl, OG_IMAGE_FILE);
      if (!image) return html;
      return html
        .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(")/g, `$1${image}$2`)
        .replace('</head>', `  <link rel="canonical" href="${siteUrl}" />\n  <meta property="og:url" content="${siteUrl}" />\n</head>`);
    },
    async closeBundle() {
      const poems = JSON.parse(fs.readFileSync(path.resolve('src/data/poems.json'), 'utf8'));
      const categories = JSON.parse(fs.readFileSync(path.resolve('src/data/categories.json'), 'utf8'));
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const write = (file, html) => {
        const target = path.join(outDir, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, html);
      };
      // 每首诗一个预渲染页面：/poem/1 -> poem/1.html
      for (const poem of poems) write(`${poemPath(poem.id)}.html`, buildPoemPage(template, poem, { siteUrl, image: absoluteUrl(siteUrl, `og/${poem.id}.png`) }));
      // 其他前台路由也各生成一个页面，保证返回 200；未知地址走 404.html（同一个 SPA，状态码 404）
      const page = (route, opts) => write(`${route}.html`, renderRoutePage(template, { url: absoluteUrl(siteUrl, route), ...opts }));
      page('browse', { title: '篇章 · 风雅颂 · 诗经', description: '按风、雅、颂分类浏览《诗经》三百零五篇。' });
      for (const cat of categories) {
        page(decodeURIComponent(categoryPath(cat.key)), {
          url: absoluteUrl(siteUrl, categoryPath(cat.key)),
          title: `${cat.name} · 诗经`,
          description: `《诗经》${cat.name}：${cat.description}。${cat.sections.map((sec) => sec.name).join('、')}。`,
        });
      }
      page('search', { title: '寻诗 · 诗经 · 诗三百', description: '按诗题、诗句与章卷检索《诗经》。' });
      for (const route of ['favorites', 'auth', 'profile', 'admin', 'admin/login', 'admin/dashboard', 'admin/users']) {
        page(route, { url: null, title: '诗经 · 诗三百', description: '《诗经》全文阅读与检索平台。', noindex: true });
      }
      write('404.html', renderRoutePage(template, { title: '未找到页面 · 诗三百', description: '该页面不存在。', noindex: true }));
      if (siteUrl) {
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemap(siteUrl, poems, new Date().toISOString().slice(0, 10), categories));
        fs.writeFileSync(path.join(outDir, 'robots.txt'), buildRobots(siteUrl));
      } else {
        console.log('[static-pages] VITE_SITE_URL not set: skipping sitemap.xml and canonical/absolute URLs');
      }
      // 下载 PDF 用的单篇小字体（只含本篇用字），顺便用它绘制每首诗的分享预览图 og/<id>.png
      const sharedFont = fs.readFileSync(path.resolve('src/assets/fonts/NotoSerifSC-poem-subset.ttf'));
      const fontDir = path.join(outDir, 'fonts', 'pdf');
      const ogDir = path.join(outDir, 'og');
      fs.mkdirSync(fontDir, { recursive: true });
      fs.mkdirSync(ogDir, { recursive: true });
      for (const poem of poems) {
        const font = await buildPoemFont(sharedFont, poem, readReading(path.resolve('.'), poem.id));
        fs.writeFileSync(path.join(fontDir, `${poem.id}.ttf`), font);
        fs.writeFileSync(path.join(ogDir, `${poem.id}.png`), renderOgPng(poem, font));
      }
      console.log(`[static-pages] emitted ${poems.length} poem pages`);
    },
  };
}

// fontsource 的每条 @font-face 都带 woff2 + woff 两个地址；现代浏览器都支持 woff2，
// 去掉 woff 后备可让首屏 CSS 小约四分之一，也不再打包 200 个用不到的 woff 文件。
export function stripWoffFallback(css) {
  return css.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
}

function woff2OnlyPlugin() {
  return {
    name: 'shijing-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/@fontsource[\\/].*\.css(\?|$)/.test(id)) return null;
      return { code: stripWoffFallback(code), map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL || env.VITE_SITE_URL);
  return {
    base: '/',
    plugins: [woff2OnlyPlugin(), poemDataPlugin(), staticPagesPlugin(siteUrl)],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      // 字体不内联成 base64：内联会塞进阻塞渲染的 CSS，且所有页面都要为之付费
      assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
