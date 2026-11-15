/**
 * Host-aware robots.txt for Cloudflare Pages.
 *
 * The same dist/ is served on the *.pages.dev preview hostname AND on the
 * production domain. A single static robots.txt cannot be correct for both:
 * allowing indexing everywhere creates duplicate content from the preview
 * host, while disallowing everywhere would de-index the real site once the
 * main domain is pointed at this project.
 *
 * Production hosts get Allow + Sitemap; every other host (preview deployments,
 * the pages.dev alias) stays Disallow.
 */

const PRODUCTION_HOSTS = new Set([
  'fantasticumbrella.com',
  'www.fantasticumbrella.com',
]);

// Marker lets CI prove the Function (not the static fallback) is serving the
// file, so a broken routing configuration can never silently de-index us.
const MARKER = '# served-by: pages-function';

const ALLOW = [
  MARKER,
  'User-agent: *',
  'Allow: /',
  'Sitemap: https://fantasticumbrella.com/sitemap.xml',
  '',
].join('\n');

const DISALLOW = [MARKER, 'User-agent: *', 'Disallow: /', ''].join('\n');

export async function onRequestGet(context) {
  const host = new URL(context.request.url).hostname.toLowerCase();
  const body = PRODUCTION_HOSTS.has(host) ? ALLOW : DISALLOW;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
