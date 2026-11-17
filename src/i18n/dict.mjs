/**
 * Central dictionary loader. Every component imports `ui(locale)` instead of
 * hard-coding English, so a locale is resolved once per page render.
 */
import { DEFAULT_LOCALE } from './config.mjs';
import en from './ui/en.json';
import es from './ui/es.json';
import fr from './ui/fr.json';
import de from './ui/de.json';
import zh from './ui/zh.json';
import enPages from './pages/en.json';
import esPages from './pages/es.json';
import frPages from './pages/fr.json';
import dePages from './pages/de.json';
import zhPages from './pages/zh.json';
import enProducts from './products/en.json';
import esProducts from './products/es.json';
import frProducts from './products/fr.json';
import deProducts from './products/de.json';
import zhProducts from './products/zh.json';

const UI = { en, es, fr, de, zh };
const PAGES = { en: enPages, es: esPages, fr: frPages, de: dePages, zh: zhPages };
const PRODUCTS = { en: enProducts, es: esProducts, fr: frProducts, de: deProducts, zh: zhProducts };

export function ui(locale = DEFAULT_LOCALE) {
  return UI[locale] || UI[DEFAULT_LOCALE];
}

export function pageTexts(locale, slug) {
  const file = PAGES[locale] || PAGES[DEFAULT_LOCALE];
  const entry = file?.pages?.[slug];
  return entry?.texts || [];
}

export function pageTitle(locale, slug) {
  const file = PAGES[locale] || PAGES[DEFAULT_LOCALE];
  return file?.pages?.[slug]?.title || null;
}

export function productCopy(locale, slug) {
  const file = PRODUCTS[locale] || PRODUCTS[DEFAULT_LOCALE];
  return file?.[slug] || null;
}

/** Replace {name}-style placeholders in a dictionary string. */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m,
  );
}
