/**
 * Build-time content pipeline (phase 0 + phase 1 of the migration plan).
 *
 * Pulls real content from the live WordPress REST API, cleans anything that
 * cannot be reused in a static site, and writes src/data/*.json.
 *
 * Two deliberate decisions worth keeping:
 *  1. SEO titles/descriptions come from the copy pack, NOT from REST. The
 *     Yoast metadesc field is not registered in the REST API, so a naive
 *     pipeline silently drops every meta description on the site.
 *  2. Shortcode-expanded HTML (Fluent Forms) is stripped and replaced by a
 *     slot marker. The Astro page renders its own form component there.
 *
 * Run: npm run sync
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScope, classify, applyScopeCopy } from './catalog-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const PUBLIC = path.join(ROOT, 'public');
const WP = 'https://fantasticumbrella.com/wp-json/wp/v2';
const STORE = 'https://fantasticumbrella.com/wp-json/wc/store/v1';
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
};

async function getJSON(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const write = async (file, value) =>
  writeFile(path.join(DATA, file), JSON.stringify(value, null, 2) + '\n', 'utf8');

/** Remove plugin-generated markup that has no meaning outside WordPress. */
function stripPluginBlocks(html) {
  let out = html;
  const marker = /<div[^>]*class=['"][^'"]*fluentform/i.exec(out);
  if (marker) {
    const start = marker.index;
    const formEnd = out.indexOf('</form>', start);
    const divEnd = out.indexOf('</div>', formEnd >= 0 ? formEnd : start);
    const end = divEnd >= 0 ? divEnd + 6 : (formEnd >= 0 ? formEnd + 7 : out.length);
    out = out.slice(0, start) + '\n<!-- ASTRO_FORM_SLOT -->\n' + out.slice(end);
  }
  out = out.replace(/<script[^>]*>[\s\S]*?fluentform[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[^>]*>[\s\S]*?\.ff_[\s\S]*?<\/style>/gi, '');
  out = out.replace(/\[wpforms[^\]]*\]/g, '');
  return out;
}

const B2B_SLUGS = ['contact', 'services', 'faqs', 'shipping-delivery', 'quality-claims'];
const REDIRECT_TARGET = {
  payment: '/contact/',
  'my-account': '/contact/',
  'track-order': '/contact/',
  shop: '/products/',
};

async function main() {
  await mkdir(DATA, { recursive: true });
  await mkdir(PUBLIC, { recursive: true });
  const report = { synced_at: new Date().toISOString(), source: 'live wp-json', pages: [] };
  const scopeEdits = [];

  // --- pages -------------------------------------------------------------
  const all = await getJSON(
    `${WP}/pages?per_page=100&status=publish&_fields=id,slug,title,link,modified,content`
  );
  const b2b = [];
  const urlMap = [];
  for (const p of all) {
    const slug = p.slug;
    const pathname = new URL(p.link).pathname;
    const title = p.title.rendered.replace(/&#038;/g, '&');
    if (B2B_SLUGS.includes(slug)) {
      const raw = p.content.rendered || '';
      const cleaned = stripPluginBlocks(raw);
      const scoped = applyScopeCopy(cleaned, slug);
      const html = scoped.html;
      if (scoped.edits.length) scopeEdits.push({ slug, edits: scoped.edits });
      b2b.push({ id: p.id, slug, title, url: p.link, modified: p.modified, html });
      report.pages.push({
        slug,
        raw_chars: raw.length,
        clean_chars: html.length,
        plugin_blocks_removed: raw.length - html.length > 0,
        form_slot: html.includes('ASTRO_FORM_SLOT'),
      });
      urlMap.push({ path: pathname, decision: 'migrate', target: pathname, note: 'B2B page' });
    } else if (REDIRECT_TARGET[slug]) {
      urlMap.push({ path: pathname, decision: '301', target: REDIRECT_TARGET[slug], note: 'WooCommerce / account page' });
    } else if (/%[0-9a-f]{2}/i.test(pathname) && /%e6%88%91|cart|shopping/i.test(pathname)) {
      // Percent-encoded Chinese "my cart" slug - easy to miss in a 301 map.
      urlMap.push({ path: pathname, decision: '301', target: '/contact/', note: 'WooCommerce cart page (encoded slug)' });
    } else if (slug === '' || pathname === '/') {
      urlMap.push({ path: '/', decision: 'migrate', target: '/', note: 'new Astro homepage' });
    } else {
      urlMap.push({ path: pathname, decision: 'phase-2', target: null, note: 'content page, migrate in phase 2' });
    }
  }
  const order = B2B_SLUGS;
  b2b.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  await write('pages.json', b2b);
  await write('url_map.json', urlMap);

  // --- products: names + images only, never prices -----------------------
  // Catalogue scope is a hard business rule, not an editorial choice. Chairs,
  // cabanas, sun shelters and patio parasols belong to GreenMark, not here.
  const rawProducts = await getJSON(`${STORE}/products?per_page=100`);
  const allProducts = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: (p.permalink || '').replace(/\/$/, '').split('/').pop(),
    image: (p.images && p.images[0] && p.images[0].src) || null,
    short: String(p.short_description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 260),
  }));
  const scope = await loadScope();
  const { included, removed, needsReview } = classify(allProducts, scope);
  const products = included;
  await write('products_all.json', allProducts);
  await write('products.json', products);
  await write('excluded_products.json', removed);
  await write('needs_review_products.json', needsReview);

  // --- SEO: from the copy pack, because REST does not expose Yoast --------
  const md = await readFile(path.join(ROOT, '..', 'fantasticumbrella_B2B_文案包_EN.md'), 'utf8');
  const seoKeys = ['contact', 'services', 'shipping-delivery', 'quality-claims', 'faqs', 'product-template'];
  const seo = {
    home: {
      title: 'Custom Umbrella Manufacturer | Fantastic Umbrella',
      description:
        'B2B custom umbrella and outdoor product manufacturing from Guangzhou. OEM/ODM, digital printing, sampling and quality control in one supply chain.',
    },
  };
  let section = -1;
  for (const line of md.split(/\r?\n/)) {
    if (/^### \d+\.1 SEO/.test(line)) section += 1;
    const t = /^- \*\*Title:\*\* `(.+)`/.exec(line);
    const d = /^- \*\*Meta description:\*\* `(.+)`/.exec(line);
    if (section >= 0 && section < seoKeys.length && (t || d)) {
      const key = seoKeys[section];
      seo[key] = seo[key] || {};
      if (t) seo[key].title = t[1];
      if (d) seo[key].description = d[1];
    }
  }
  // Product-scope wording overrides (copy pack still describes the old range).
  Object.assign(seo, scope.seo_overrides || {});
  await write('seo.json', seo);

  // --- static SEO artefacts ----------------------------------------------
  const urls = [
    '/', '/products/',
    ...B2B_SLUGS.map((s) => `/${s}/`),
    ...products.map((p) => `/product/${p.slug}/`),
  ];
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url><loc>https://fantasticumbrella.com${u}</loc></url>`)
      .join('\n') +
    '\n</urlset>\n';
  await writeFile(path.join(PUBLIC, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(
    path.join(PUBLIC, 'robots.txt'),
    'User-agent: *\nAllow: /\nSitemap: https://fantasticumbrella.com/sitemap.xml\n',
    'utf8'
  );
  const redirects = [
    '# 301 map draft - verify every line before cutover (phase 0 exit condition)',
    ...urlMap
      .filter((u) => u.decision === '301')
      .map((u) => `${u.path}  ${u.target}  301`),
    '# Out-of-scope products (chairs, cabanas, patio parasols) - GreenMark takes these over',
    ...removed.map((p) => `/product/${p.slug}/  ${p.redirect_to}  301`),
    '',
  ].join('\n');
  await writeFile(path.join(PUBLIC, '_redirects'), redirects, 'utf8');

  report.counts = {
    published_pages: all.length,
    migrated_pages: b2b.length,
    products_in_scope: products.length,
    products_excluded: removed.length,
    products_needs_review: needsReview.length,
    scope_copy_edits: scopeEdits.length,
    seo_entries: Object.keys(seo).length,
    sitemap_urls: urls.length,
    redirects: urlMap.filter((u) => u.decision === '301').length + removed.length,
    phase_2_pages: urlMap.filter((u) => u.decision === 'phase-2').length,
  };
  report.scope_copy_edits = scopeEdits;
  await write('sync_report.json', report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('sync failed:', e.message);
  process.exit(1);
});
