/**
 * JSON-LD helpers for GEO / answer-engine discoverability.
 *
 * Every value is derived from the site's own translated copy or from the
 * public URL structure. Nothing here invents prices, certifications,
 * headcounts or founding dates - those need customer-supplied facts.
 */
import { localePath } from './config.mjs';

export const SITE = 'https://fantasticumbrella.com';
export const ORG_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;

const ENTITY = {
  '&amp;': '&', '&#038;': '&', '&#38;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

/** Strip leftover HTML entities/tags so JSON-LD text matches readable copy. */
export function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|#0?38|lt|gt|quot|#39|nbsp);/gi, (m) => ENTITY[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Safe inline JSON-LD: never let a closing script sequence escape the tag. */
export function jsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const QUESTION_PREFIX = /^(?:Q|P)\s*\d+\s*[.):：]\s*|^问题\s*\d+\s*[：:]\s*/i;

/**
 * Build FAQPage from the same text nodes that render the visible FAQ page.
 * English is used only to locate question indices; verify:i18n guarantees
 * every locale keeps identical text-node counts and ordering.
 */
export function faqSchema(locale, sourceTexts, translatedTexts) {
  const indices = [];
  sourceTexts.forEach((text, i) => {
    if (/^Q\d+\s*[.):]/i.test(cleanText(text))) indices.push(i);
  });
  const mainEntity = indices
    .map((i) => {
      const name = cleanText(translatedTexts[i]).replace(QUESTION_PREFIX, '');
      const text = cleanText(translatedTexts[i + 1]);
      return name && text
        ? { '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }
        : null;
    })
    .filter(Boolean);
  if (!mainEntity.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': `${SITE}${localePath(locale, '/faqs/')}#faq`,
    inLanguage: locale,
    mainEntity,
  };
}

/** Product node for a detail page. No offers/price: B2B quotes are per project. */
export function productSchema(locale, product, name, description) {
  const url = `${SITE}${localePath(locale, `/product/${product.slug}/`)}`;
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name,
    description,
    image: product.image ? `${SITE}${product.image}` : undefined,
    url,
    inLanguage: locale,
    category: 'Umbrellas',
    brand: { '@type': 'Brand', name: 'Fantastic Umbrella' },
    manufacturer: { '@id': ORG_ID },
  };
}
