/**
 * Single source of truth for what fantasticumbrella.com is allowed to show.
 *
 * Business rule decided 2026-11-13: this site promotes compact / folding rain
 * umbrellas, plus a small selection of beach umbrellas. Beach chairs, cabanas,
 * sun shelters, gazebos and patio / garden shade umbrellas belong to GreenMark.
 *
 * Unknown slugs (new WooCommerce products) are never published automatically;
 * they are reported for review. This prevents the old outdoor catalogue from
 * creeping back in on the next content sync.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE_FILE = path.join(ROOT, 'src', 'data', 'catalog-scope.json');

export async function loadScope() {
  return JSON.parse(await readFile(SCOPE_FILE, 'utf8'));
}

const GENERIC_SHORT =
  'Custom umbrella — frame, fabric, handle and printing specified for your market. MOQ and lead time are confirmed in writing with your quotation.';
const SHORT_OVERRIDES = {
  'patio-umbrella':
    'Custom straight umbrella — frame, shaft, fabric and printing specified for your market.',
};

/** Remove WooCommerce demo text / old patio wording from product summaries. */
function cleanShort(p) {
  if (SHORT_OVERRIDES[p.slug]) return SHORT_OVERRIDES[p.slug];
  if (/[\u4e00-\u9fff]/.test(p.short || '')) return GENERIC_SHORT;
  return p.short;
}

export function classify(products, scope) {
  const primary = new Set(scope.primary);
  const secondary = new Set(scope.secondary);
  const excluded = new Map(scope.exclude.map((e) => [e.slug, e]));

  const included = [];
  const removed = [];
  const needsReview = [];

  for (const p of products) {
    if (excluded.has(p.slug)) {
      const rule = excluded.get(p.slug);
      removed.push({ ...p, group: rule.group, reason: rule.reason, redirect_to: '/products/' });
    } else if (primary.has(p.slug)) {
      included.push({ ...p, short: cleanShort(p), scope: 'primary' });
    } else if (secondary.has(p.slug)) {
      included.push({ ...p, short: cleanShort(p), scope: 'secondary' });
    } else {
      needsReview.push({ ...p, reason: 'Not listed in catalog-scope.json - review before publishing' });
    }
  }

  const order = { primary: 0, secondary: 1 };
  included.sort((a, b) => order[a.scope] - order[b.scope]);
  return { included, removed, needsReview };
}

/**
 * Overrides for copy that is already published on WordPress but contradicts
 * the new product scope. Applied after every sync so the local build stays
 * consistent; the same edits still have to be made in the WP backend.
 */
export function applyScopeCopy(html, slug) {
  if (slug !== 'services' && slug !== 'contact') return { html, edits: [] };
  const edits = [];
  let out = html;

  const listRe = /<h2>What we make<\/h2>\s*<ul>[\s\S]*?<\/ul>/;
  const newList = `<h2>What we make</h2>
<ul>
<li>Compact and folding rain umbrellas, including three-fold, five-fold and ultra-compact styles.</li>
<li>Straight, golf, children's and promotional umbrellas, with custom handles, frames and fabrics.</li>
<li>All-over digital printing, Pantone matching and private-label packaging.</li>
<li>A small selection of beach umbrellas and parasols for resort and promotional programmes.</li>
</ul>
<p>Beach chairs, cabanas, sun shelters, gazebos and patio shade structures are handled by our GreenMark sister site.</p>`;

  const replacements = [
    ['custom umbrellas and outdoor gear, built on in-house digital printing', 'custom compact and folding umbrellas, built on in-house digital printing'],
    ['custom umbrellas and outdoor gear', 'custom compact and folding umbrellas'],
    ['Canopy cutting, stitching, binding and finishing', 'Panel cutting, stitching, binding and finishing'],
    ['Pole, ribs, tilt and height options to your specification', 'Shaft, ribs, handle and size options to your specification'],
  ];

  for (const [from, to] of replacements) {
    if (out.includes(from)) {
      out = out.replace(from, to);
      edits.push(from.slice(0, 60));
    }
  }
  const alreadyScoped = out.includes('Compact and folding rain umbrellas, including three-fold');
  if (!alreadyScoped && listRe.test(out)) {
    out = out.replace(listRe, newList);
    edits.push('What we make list');
  }
  return { html: out, edits };
}
