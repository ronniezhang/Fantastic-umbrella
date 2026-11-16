/**
 * Guard for the two legacy content scripts.
 *
 * sync-content.mjs and rebuild-scope.mjs rewrite src/data/*.json,
 * public/sitemap.xml, public/_redirects and public/robots.txt from the old
 * WordPress source. After the i18n rollout that would:
 *   - erase es/fr/de sitemap URLs and hreflang,
 *   - restore English-only SEO strings,
 *   - rewrite product images back to wp-content absolute URLs (broken images
 *     once WordPress is gone).
 *
 * They are still available for a deliberate, reviewed regeneration:
 *   ALLOW_LEGACY_SYNC=1 npm run sync -- --force
 * After any forced run, re-run `npm run verify:i18n` and `npm run build`,
 * then re-localize product images before deploying.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = process.argv[2];
const allowed = ['sync-content.mjs', 'rebuild-scope.mjs'];
const override =
  process.env.ALLOW_LEGACY_SYNC === '1' && process.argv.includes('--force');

if (!allowed.includes(script)) {
  console.error(`Unknown legacy script: ${script}`);
  process.exit(1);
}

if (!override) {
  console.error(
    [
      `BLOCKED: scripts/${script} is frozen after the i18n rollout.`,
      '',
      'It overwrites src/data/*.json, public/sitemap.xml, public/_redirects and',
      'public/robots.txt with single-language content, and rewrites product',
      'images back to wp-content absolute URLs (broken once WP is retired).',
      '',
      'To run deliberately (then re-check translations, sitemap and images):',
      `  ALLOW_LEGACY_SYNC=1 npm run ${script === 'sync-content.mjs' ? 'sync' : 'rebuild-scope'} -- --force`,
      '',
      'For normal work use: npm run verify:i18n && npm run build',
    ].join('\n'),
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
