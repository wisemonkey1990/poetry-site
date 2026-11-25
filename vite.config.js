import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPoemPage, buildRobots, buildSitemap, absoluteUrl, normalizeSiteUrl, poemPath, OG_IMAGE_FILE,
} from './scripts/static-pages.mjs';

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
    closeBundle() {
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
      console.log(`[static-pages] emitted ${poems.length} poem pages`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = normalizeSiteUrl(process.env.VITE_SITE_URL || env.VITE_SITE_URL);
  return {
    base: './',
    plugins: [staticPagesPlugin(siteUrl)],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
