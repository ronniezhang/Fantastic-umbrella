/**
 * Offline recalculation of the catalogue scope.
 *
 * `npm run sync` re-pulls everything from the live WordPress REST API. This
 * script applies the same scope rules to the data already on disk, so the new
 * product policy can be rolled out and verified without touching the live site
 * or hitting wp-login rate limits.
 *
 * Run: node scripts/rebuild-scope.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScope, classify, applyScopeCopy } from './catalog-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://fantasticumbrella.com';

const read = async (f) => JSON.parse(await readFile(path.join(DATA, f), 'utf8'));
const write = async (f, v) => writeFile(path.join(DATA, f), JSON.stringify(v, null, 2) + '\n', 'utf8');

async function main() {
  const scope = await loadScope();

  // Keep a full snapshot of everything WooCommerce ever exposed.
  let all;
  try {
    all = await read('products_all.json');
  } catch {
    all = await read('products.json');
  }
  await write('products_all.json', all);

  const { included, removed, needsReview } = classify(all, scope);
  await write('products.json', included);
  await write('excluded_products.json', removed);
  await write('needs_review_products.json', needsReview);

  // Fix copy that was already published on WP but contradicts the new scope.
  const pages = await read('pages.json');
  const copyEdits = [];
  for (const p of pages) {
    const result = applyScopeCopy(p.html, p.slug);
    if (result.edits.length) {
      p.html = result.html;
      copyEdits.push({ slug: p.slug, edits: result.edits });
    }
  }
  await write('pages.json', pages);

  const seo = await read('seo.json');
  Object.assign(seo, scope.seo_overrides || {});
  await write('seo.json', seo);

  const urlMap = await read('url_map.json');
  const baseRedirects = urlMap
    .filter((u) => u.decision === '301')
    .map((u) => `${u.path}  ${u.target}  301`);
  const productRedirects = removed.map((p) => `/product/${p.slug}/  ${p.redirect_to}  301`);
  await writeFile(
    path.join(PUBLIC, '_redirects'),
    [
      '# 301 map draft - verify every line before cutover (phase 0 exit condition)',
      ...baseRedirects,
      '# Out-of-scope products (chairs, cabanas, patio parasols) - GreenMark takes these over',
      ...productRedirects,
      '',
    ].join('\n'),
    'utf8'
  );

  const urls = [
    '/', '/products/',
    ...pages.map((p) => `/${p.slug}/`),
    ...included.map((p) => `/product/${p.slug}/`),
  ];
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  await writeFile(path.join(PUBLIC, 'sitemap.xml'), sitemap, 'utf8');

  const report = {
    rebuilt_at: new Date().toISOString(),
    source: 'offline (local data only)',
    policy: scope.policy,
    counts: {
      catalogue_total: all.length,
      published: included.length,
      primary: included.filter((p) => p.scope === 'primary').length,
      secondary: included.filter((p) => p.scope === 'secondary').length,
      excluded: removed.length,
      needs_review: needsReview.length,
      sitemap_urls: urls.length,
      redirects: baseRedirects.length + productRedirects.length,
      copy_edits: copyEdits.length,
    },
    copy_edits: copyEdits,
    excluded_groups: removed.reduce((acc, p) => {
      acc[p.group] = (acc[p.group] || 0) + 1;
      return acc;
    }, {}),
  };
  await write('scope_rebuild_report.json', report);
  console.log(JSON.stringify(report.counts, null, 2));
  console.log('excluded groups:', JSON.stringify(report.excluded_groups));
  console.log('copy edits:', JSON.stringify(copyEdits));
}

main().catch((e) => {
  console.error('rebuild failed:', e.message);
  process.exit(1);
});
