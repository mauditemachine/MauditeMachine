/**
 * SEO — metadonnees par page + injection DOM dynamique.
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
export const OG_IMAGE = `${SITE_URL}/images/og-image.jpg`;

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

const OG_LOCALE: Record<Lang, string> = {
  fr: 'fr_CA',
  en: 'en_US',
  es: 'es_ES',
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
 * useSEO — synchronise <title>, meta description, canonical, OG, Twitter,
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

    // Open Graph
    setMeta('property', 'og:type', route === '/' ? 'website' : 'article');
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('property', 'og:site_name', 'Maudite Machine');
    setMeta('property', 'og:locale', OG_LOCALE[lang]);

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:url', canonical);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
    setMeta('name', 'twitter:image', OG_IMAGE);

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
        name: meta.title.split('|')[0].trim(),
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
