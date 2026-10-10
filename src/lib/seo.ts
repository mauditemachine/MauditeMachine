/**
 * SEO - metadonnees par page + injection DOM dynamique.
 *
 * Le site est une SPA client-side (GitHub Pages, pas de SSR). Googlebot
 * execute le JS et lit le DOM final, donc on injecte title / description /
 * canonical / OG / Twitter / hreflang / JSON-LD au changement de route.
 *
 * Zero dependance (pas de react-helmet) : manipulation DOM directe dans
 * un useEffect, avec cleanup des balises qu'on a creees nous-memes.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Lang } from '../translations';
import seoMeta from '../data/seo-meta.json';

export const SITE_URL = 'https://mauditemachine.com';
/**
 * 2026-10-10 (brief de Mika, B4) : l'image de partage de tout le site, la
 * photo booth-blue recadree en 1200 x 630 (la meme que scripts/seo-shared.mjs).
 */
export const OG_IMAGE = `${SITE_URL}/press/og-maudite-machine.jpg`;
const OG_IMAGE_ALT = 'Maudite Machine in the booth under a blue spotlight';

type SeoEntry = { title: string; description: string };
type RouteKey = '/' | '/about' | '/shows' | '/radar' | '/merch' | '/goodies' | '/techrider' | '/contact';

/**
 * Metadonnees par route et par langue.
 * Source unique : src/data/seo-meta.json, partagee avec le script de
 * prerender au build (scripts/prerender-seo.mjs) pour eviter toute
 * divergence entre le HTML statique et le rendu client.
 * Titres < 60 caracteres, descriptions 140-160 (limites SERP Google).
 */
export const SEO_META = seoMeta as Record<Lang, Record<RouteKey, SeoEntry>>;

/** Locale Open Graph de toutes les pages et ses alternatives (brief B4), quelle que soit la langue. */
const OG_LOCALE = 'fr_FR';
const OG_LOCALE_ALTERNATES = ['en_GB', 'es_ES'];

/** Le nom de chaque page dans son fil d'Ariane (le titre, le meme partout, ne le porte plus). */
const PAGE_NAMES: Record<RouteKey, string> = {
  '/': 'Maudite Machine',
  '/about': 'Biography',
  '/shows': 'Shows',
  '/radar': 'Radar',
  '/merch': 'Merch',
  '/goodies': 'Goodies',
  '/techrider': 'Tech rider',
  '/contact': 'Contact and booking',
};

/** Normalise un pathname vers une RouteKey connue (fallback '/'). */
function toRouteKey(pathname: string): RouteKey {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const known: RouteKey[] = ['/', '/about', '/shows', '/radar', '/merch', '/goodies', '/techrider', '/contact'];
  return (known.find((k) => k === clean) as RouteKey) || '/';
}

/** Cree ou met a jour une <meta> par name= ou property=. */
function setMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-seo-managed', 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Remplace les <meta property=...> repetees (og:locale:alternate) par cette liste. */
function setMetaList(property: string, contents: readonly string[]) {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll(`meta[property="${property}"]`).forEach((el) => el.remove());
  for (const content of contents) {
    const el = document.createElement('meta');
    el.setAttribute('property', property);
    el.setAttribute('content', content);
    el.setAttribute('data-seo-managed', 'true');
    document.head.appendChild(el);
  }
}

/** Cree ou met a jour un <link rel> (canonical, alternate hreflang...). */
function setLink(rel: string, href: string, hreflang?: string) {
  if (typeof document === 'undefined') return;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    el.setAttribute('data-seo-managed', 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Injecte (ou remplace) un bloc JSON-LD identifie par son id. */
export function setJsonLd(id: string, data: unknown) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  if (!data) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * useSEO - synchronise <title>, meta description, canonical, OG, Twitter,
 * hreflang et le JSON-LD BreadcrumbList avec la route + la langue courante.
 * Appele une seule fois dans Layout (englobe toutes les pages via Outlet).
 */
export function useSEO() {
  const location = useLocation();
  const { lang } = useApp();

  useEffect(() => {
    const route = toRouteKey(location.pathname);
    const meta = SEO_META[lang][route];
    const canonical = route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}`;

    // Title + description
    document.title = meta.title;
    setMeta('name', 'description', meta.description);

    // Canonical
    setLink('canonical', canonical);

    // Open Graph (2026-10-10, brief B4 : le meme jeu sur chaque page,
    // og:description en anglais quelle que soit la langue)
    const ogDescription = SEO_META.en[route].description;
    setMeta('property', 'og:type', 'music.musician');
    setMeta('property', 'og:site_name', 'Maudite Machine');
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', ogDescription);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:image:alt', OG_IMAGE_ALT);
    setMeta('property', 'og:locale', OG_LOCALE);
    setMetaList('og:locale:alternate', OG_LOCALE_ALTERNATES);

    // Twitter Card : les memes titre, description et image que l'Open Graph
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', ogDescription);
    setMeta('name', 'twitter:image', OG_IMAGE);
    setMeta('name', 'twitter:image:alt', OG_IMAGE_ALT);

    // hreflang : meme URL sert les 3 langues (detection navigator.language),
    // on declare les variantes via ?lang= qui est notre override supporte.
    setLink('alternate', canonical, 'x-default');
    setLink('alternate', `${canonical}?lang=en`, 'en');
    setLink('alternate', `${canonical}?lang=fr`, 'fr');
    setLink('alternate', `${canonical}?lang=es`, 'es');

    // Breadcrumb JSON-LD (aide Google a comprendre la hierarchie du site)
    const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Maudite Machine', item: `${SITE_URL}/` }];
    if (route !== '/') {
      crumbs.push({
        '@type': 'ListItem',
        position: 2,
        name: PAGE_NAMES[route],
        item: canonical,
      });
    }
    setJsonLd('ld-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs,
    });
  }, [location.pathname, lang]);
}
