/**
 * Text-node translation for the HTML bodies imported from WordPress.
 *
 * Rather than re-writing (and risking breaking) 20k characters of tables,
 * lists and the <!-- ASTRO_FORM_SLOT --> marker, we extract the visible text
 * nodes in document order and replace them with translated strings. Tag
 * structure, attributes, classes and entity encoding stay byte-identical.
 */

/** Visible text nodes in document order (whitespace-only nodes skipped). */
export function extractTexts(html) {
  const out = [];
  const re = />([^<]+)</g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const text = match[1].trim();
    if (text) out.push(text);
  }
  return out;
}

/**
 * Replace visible text nodes with translations.
 * Returns { html, used, expected }. A short/missing translation leaves the
 * remaining nodes in English instead of corrupting the markup.
 */
export function localizeHtml(html, texts) {
  const expected = extractTexts(html).length;
  if (!Array.isArray(texts) || texts.length === 0) {
    return { html, used: 0, expected };
  }
  let i = 0;
  let used = 0;
  const result = html.replace(/>([^<]+)</g, (match, inner) => {
    if (!inner.trim()) return match;
    const translated = texts[i++];
    if (typeof translated !== 'string' || !translated.trim()) return match;
    used += 1;
    const lead = (inner.match(/^\s*/) || [''])[0];
    const trail = (inner.match(/\s*$/) || [''])[0];
    return `>${lead}${translated}${trail}<`;
  });
  return { html: result, used, expected };
}

/**
 * Prefix internal hrefs inside translated WordPress bodies with the locale.
 * Anchors, query strings, /api/ endpoints, mailto: and external URLs are left
 * untouched.
 */
export function localizeLinks(html, locale) {
  if (!locale || locale === 'en') return html;
  return html.replace(/href="(\/[^"#?]*)([^"]*)"/g, (match, pathname, suffix) => {
    if (pathname.startsWith('/api/')) return match;
    return `href="/${locale}${pathname}${suffix}"`;
  });
}

