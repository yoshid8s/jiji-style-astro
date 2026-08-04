import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://style.yh-inc.jp',
  output: 'static',
  trailingSlash: 'always',

  build: {
    // WordPress APIから取得した記事ページを並列に生成し、公開時の待ち時間を短縮する。
    // CMSへの負荷を抑えるため、過度に大きな値にはしない。
    concurrency: 3,
  },

  image: {
    domains: ['style.yh-inc.jp'],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
