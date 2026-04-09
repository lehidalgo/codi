import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lehidalgo.github.io',
  base: '/codi/docs/',
  srcDir: './docs/src',
  outDir: './site/docs',
});
