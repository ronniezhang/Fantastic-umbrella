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

/**
 * Answer-engine / AI crawlers are named explicitly for auditability.
 * `User-agent: *` + `Allow: /` already permits every one of them, and no
 * Cloudflare "Block AI Scrapers and Crawlers" rule is enabled (verified
 * 2026-11-17: GPTBot, Google-Extended, PerplexityBot, ClaudeBot and CCBot
 * all return HTTP 200 on /). Listing them is policy documentation, not a
 * fix: it lets us tighten a single bot later without de-indexing the site.
 * Google-Extended is a Gemini grounding/training token, not a fetcher UA.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Google-Extended',
  'PerplexityBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
];

const ALLOW = [
  MARKER,
  AI_CRAWLERS.map((ua) => `User-agent: ${ua}`).join('\n'),
  'Allow: /',
  '',
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
