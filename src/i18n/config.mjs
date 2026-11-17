/**
 * Locale routing helpers.
 *
 * URL policy: English keeps the existing unprefixed URLs (/, /contact/,
 * /products/, /product/<slug>/). Other locales add a prefix only
 * (/es/, /es/contact/, /es/products/, ...). Path slugs are NOT translated,
 * which keeps the 19 legacy 301s, canonical rules and downstream scripts
 * stable while hreflang alternates stay one-to-one.
 */
export const LOCALES = ['en', 'es', 'fr', 'de', 'zh'];
export const DEFAULT_LOCALE = 'en';
export const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export const LOCALE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '简体中文',
};

export const LOCALE_MAIL_TAGS = {
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  zh: 'ZH',
};

/** Prefix for a locale, '' for the default locale. */
export function localePrefix(locale) {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

/** Turn a locale-neutral path into the real URL for a locale. */
export function localePath(locale, path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return `/${locale}${clean === '/' ? '/' : clean}`;
}

/** Built from LOCALES so adding a language never leaves a stale regex behind. */
const PREFIX_RE = new RegExp(`^\\/(${NON_DEFAULT_LOCALES.join('|')})(\\/|$)`);

/** Remove a leading /es|/fr|/de|/zh so nav active-state checks stay simple. */
export function stripLocale(pathname) {
  const match = pathname.match(PREFIX_RE);
  if (!match) return pathname;
  const rest = pathname.slice(match[1].length + 1);
  return rest || '/';
}

/** Resolve locale from a URL pathname. */
export function localeFromPath(pathname) {
  const match = pathname.match(PREFIX_RE);
  return match ? match[1] : DEFAULT_LOCALE;
}

/** Build the full set of hreflang alternates for one locale-neutral path. */
export function alternates(path) {
  return LOCALES.map((locale) => ({
    locale,
    href: new URL(localePath(locale, path), 'https://fantasticumbrella.com').href,
  }));
}
