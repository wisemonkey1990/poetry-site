import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPoemPage, buildRobots, buildSitemap, absoluteUrl, normalizeSiteUrl, poemPath, OG_IMAGE_FILE,
} from './scripts/static-pages.mjs';
import { buildPoemFont, readReading } from './scripts/pdf-fonts.mjs';
import { poemDataPlugin } from './scripts/poem-data-plugin.mjs';

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
      for (const poem of poems) {
        const dir = path.join(outDir, poemPath(poem.id));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), buildPoemPage(poem, { siteUrl }));
      }
      if (siteUrl) {
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemap(siteUrl, poems, new Date().toISOString().slice(0, 10)));
        fs.writeFileSync(path.join(outDir, 'robots.txt'), buildRobots(siteUrl));
      } else {
        console.log('[static-pages] VITE_SITE_URL not set: skipping sitemap.xml and canonical/absolute URLs');
      }
      // 下载 PDF 用的单篇小字体（只含本篇用字）
      const sharedFont = fs.readFileSync(path.resolve('src/assets/fonts/NotoSerifSC-poem-subset.ttf'));
      const fontDir = path.join(outDir, 'fonts', 'pdf');
      fs.mkdirSync(fontDir, { recursive: true });
      for (const poem of poems) {
        fs.writeFileSync(path.join(fontDir, `${poem.id}.ttf`), await buildPoemFont(sharedFont, poem, readReading(path.resolve('.'), poem.id)));
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
    base: './',
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
