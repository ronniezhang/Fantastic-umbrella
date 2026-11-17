/**
 * Generate public/sitemap.xml for all locales.
 *
 * Astro has no sitemap integration in this project, so the file is a static
 * asset. This script is wired to `prebuild` so every build (local and CI)
 * regenerates all 19 x 5 URLs with reciprocal hreflang annotations.
 *
 * legacy scripts (sync-content.mjs / rebuild-scope.mjs) must NOT overwrite
 * this file - they are guarded by scripts/guard-legacy-sync.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, localePath } from '../src/i18n/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const pages = readJson('src/data/pages.json');
const products = readJson('src/data/products.json');

const SITE = 'https://fantasticumbrella.com';
const paths = [
  '/',
  '/products/',
  ...pages.map((p) => `/${p.slug}/`),
  ...products.map((p) => `/product/${p.slug}/`),
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = (locale, p) => `${SITE}${localePath(locale, p)}`;

const entries = [];
for (const locale of LOCALES) {
  for (const p of paths) {
    const alternates = LOCALES.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(url(l, p))}" />`,
    );
    alternates.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(url('en', p))}" />`);
    entries.push(
      `  <url>\n    <loc>${esc(url(locale, p))}</loc>\n${alternates.join('\n')}\n  </url>`,
    );
  }
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '         xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...entries,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(path.join(root, 'public/sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml: ${entries.length} URLs (${paths.length} paths x ${LOCALES.length} locales) with reciprocal hreflang`);
