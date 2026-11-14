/**
 * Build a self-contained static directory for preview hosting.
 *
 * Why not deploy dist/ directly: the deployer excludes build-output folders,
 * and a preview link must never be indexed as the real site. This script copies
 * dist/ into ../astro-preview/ and swaps in a Disallow-all robots.txt.
 *
 * Run: npm run preview:stage
 */
import { cp, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist');
const out = path.resolve(root, '..', 'astro-preview');

async function countHtml(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += await countHtml(p);
    else if (e.name.endsWith('.html')) n += 1;
  }
  return n;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });
await writeFile(
  path.join(out, 'robots.txt'),
  'User-agent: *\nDisallow: /\n',
  'utf-8',
);

console.log(`preview dir : ${out}`);
console.log(`html pages  : ${await countHtml(out)}`);
console.log('robots.txt  : Disallow / (preview only, do not use for production)');
