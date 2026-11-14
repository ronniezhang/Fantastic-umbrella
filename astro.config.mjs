import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fantasticumbrella.com',
  output: 'static',
  build: {
    // "directory" keeps trailing slashes: /contact/ stays /contact/
    // This matches the live WordPress permalinks and avoids a mass 301.
    format: 'directory',
  },
});
