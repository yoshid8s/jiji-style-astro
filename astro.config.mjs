import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://style.yh-inc.jp',
  output: 'static',
  trailingSlash: 'always',

  image: {
    domains: ['style.yh-inc.jp'],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
