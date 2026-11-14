import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/_redirects');
const targets = [
  path.join(root, 'public/.htaccess'),
  path.join(root, 'dist/.htaccess'),
];

const raw = await readFile(source, 'utf8');
const rules = [];
const notes = [];

for (const line of raw.split(/\r?\n/)) {
  const text = line.trim();
  if (!text || text.startsWith('#')) continue;
  const [from, to, code] = text.split(/\s+/);
  if (!from || !to || code !== '301') {
    notes.push(`# SKIP (not a 301 rule): ${text}`);
    continue;
  }

  let urlPath = from.replace(/\/$/, '');
  const original = from;
  let nonAscii = false;
  if (/%[0-9a-f]{2}/i.test(urlPath)) {
    try {
      urlPath = decodeURIComponent(urlPath);
      nonAscii = true;
    } catch {
      notes.push(`# VERIFY: could not decode ${original}`);
    }
  }
  if (nonAscii) {
    notes.push(`# VERIFY non-ASCII rule on GoDaddy: ${original} -> ${urlPath}`);
  }

  const pattern = urlPath
    .replace(/^\//, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  rules.push(`RewriteRule ^${pattern}/?$ ${to} [R=301,L]`);
}

const header = [
  '# Generated from public/_redirects by scripts/make-htaccess.mjs',
  '# Target: GoDaddy shared hosting (Apache / cPanel). NOT for Cloudflare Pages.',
  '# Replace the WordPress .htaccess entirely - do NOT append after the WP rewrite block.',
  '# Every 301 still needs manual verification before cutover (phase 0 exit condition).',
  '',
  'Options -Indexes',
  'DirectoryIndex index.html',
  'RewriteEngine On',
  'RewriteBase /',
  '',
  '# Optional: force HTTPS once the GoDaddy SSL certificate is active',
  '# RewriteCond %{HTTPS} off',
  '# RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]',
  '',
  '# --- 301 map ---',
];

const body = [
  ...header,
  ...notes,
  ...rules,
  '',
  '# --- end of generated rules ---',
  '',
].join('\n');

for (const target of targets) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, 'utf8');
}

console.log(`htaccess generated: ${rules.length} rules, ${notes.length} notes`);
for (const target of targets) console.log(`  -> ${path.relative(root, target)}`);
