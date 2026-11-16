/**
 * Translation integrity check. Run in CI before build and locally with
 * `npm run verify:i18n`. Fails loudly on any structural drift so a missing
 * translation can never silently ship half-English pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from '../src/i18n/config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function keyPaths(value, prefix = '') {
  if (Array.isArray(value)) return [`${prefix}[]`];
  if (value && typeof value === 'object') {
    return Object.keys(value).flatMap((key) =>
      keyPaths(value[key], prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const errors = [];
const warnings = [];

// 1. UI dictionaries: identical key structure, correct lang tag, placeholders.
const uiFiles = Object.fromEntries(LOCALES.map((l) => [l, read(`src/i18n/ui/${l}.json`)]));
const uiKeys = keyPaths(uiFiles[DEFAULT_LOCALE]).sort();
for (const locale of NON_DEFAULT_LOCALES) {
  const keys = keyPaths(uiFiles[locale]).sort();
  for (const key of uiKeys) if (!keys.includes(key)) errors.push(`ui/${locale}.json missing key ${key}`);
  for (const key of keys) if (!uiKeys.includes(key)) errors.push(`ui/${locale}.json extra key ${key}`);
  if (uiFiles[locale].lang !== locale) errors.push(`ui/${locale}.json lang must be "${locale}"`);
}

const placeholders = ['{count}', '{primary}', '{secondary}', '{email}', '{name}', '{company}'];
for (const p of placeholders) {
  const english = JSON.stringify(uiFiles[DEFAULT_LOCALE]).includes(p);
  for (const locale of NON_DEFAULT_LOCALES) {
    if (english && !JSON.stringify(uiFiles[locale]).includes(p)) {
      errors.push(`ui/${locale}.json lost placeholder ${p}`);
    }
  }
}

// 2. Page bodies: same slugs, same text-node counts, no raw HTML in translations.
const pageFiles = Object.fromEntries(LOCALES.map((l) => [l, read(`src/i18n/pages/${l}.json`)]));
const slugs = Object.keys(pageFiles[DEFAULT_LOCALE].pages);
for (const slug of slugs) {
  const expected = pageFiles[DEFAULT_LOCALE].pages[slug].texts.length;
  for (const locale of NON_DEFAULT_LOCALES) {
    const entry = pageFiles[locale]?.pages?.[slug];
    if (!entry) { errors.push(`pages/${locale}.json missing slug ${slug}`); continue; }
    if (entry.texts.length !== expected) {
      errors.push(`pages/${locale}.json ${slug}: ${entry.texts.length} texts, expected ${expected}`);
    }
    entry.texts.forEach((text, i) => {
      if (/[<>]/.test(text)) errors.push(`pages/${locale}.json ${slug}[${i}] contains raw < or >`);
    });
    const translated = entry.texts.filter((t) => t && t.trim()).length;
    const coverage = Math.round((translated / expected) * 100);
    if (coverage < 60) warnings.push(`pages/${locale}.json ${slug}: only ${coverage}% translated`);
  }
}

// 3. Product copy: identical slug sets.
const productFiles = Object.fromEntries(LOCALES.map((l) => [l, read(`src/i18n/products/${l}.json`)]));
const productSlugs = Object.keys(productFiles[DEFAULT_LOCALE]).sort();
for (const locale of NON_DEFAULT_LOCALES) {
  const keys = Object.keys(productFiles[locale]).sort();
  if (keys.join('|') !== productSlugs.join('|')) {
    errors.push(`products/${locale}.json slug set differs from en.json`);
  }
  for (const slug of productSlugs) {
    const copy = productFiles[locale][slug];
    if (!copy?.name || typeof copy.short !== 'string') {
      errors.push(`products/${locale}.json ${slug} missing name/short`);
    }
  }
}

console.log(`UI keys: ${uiKeys.length} · page slugs: ${slugs.length} · text nodes: ${slugs.reduce((n, s) => n + pageFiles[DEFAULT_LOCALE].pages[s].texts.length, 0)} · products: ${productSlugs.length}`);
for (const locale of NON_DEFAULT_LOCALES) {
  const total = slugs.reduce((n, s) => n + pageFiles[DEFAULT_LOCALE].pages[s].texts.length, 0);
  const filled = slugs.reduce((n, s) => n + pageFiles[locale].pages[s].texts.filter((t) => t && t.trim()).length, 0);
  console.log(`  ${locale}: ${filled}/${total} body segments translated (${Math.round((filled / total) * 100)}%)`);
}
warnings.forEach((w) => console.log(`WARN  ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`ERROR ${e}`));
  process.exit(1);
}
console.log('i18n integrity: OK');
