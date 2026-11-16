/**
 * Shared getStaticPaths payloads for the locale route shims.
 *
 * Plain JSON imports (not fs + import.meta.url): Vite inlines these during
 * the build, so no runtime file lookup leaks into dist/.
 */
import pages from '../data/pages.json';
import products from '../data/products.json';

export const staticPagePaths = () =>
  pages.map((page) => ({ params: { slug: page.slug }, props: { slug: page.slug } }));

export const productPaths = () =>
  products.map((product) => ({
    params: { slug: product.slug },
    props: { slug: product.slug },
  }));
