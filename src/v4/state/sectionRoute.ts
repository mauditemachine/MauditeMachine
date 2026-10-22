/**
 * Adresses des sections (2026-10-02, referencement) : chaque page du site a
 * son URL, /tracks/, /mixtapes/, /shows/, /contact/, et les puces du PCB
 * /goodies/, /merch/, /studio/. Arriver par l'une ouvre la machine sur sa
 * section ; ouvrir ou fermer une section met l'adresse a jour (pushState :
 * Google Analytics compte une page vue, le retour arriere ferme ou rouvre)
 * et le titre de l'onglet. PRESS garde l'accueil : /press/ est la page
 * statique des elements presse, /presskit/ la visionneuse.
 *
 * Le HTML de chaque adresse (titre, description, contenu lisible sans
 * JavaScript) est genere au build par scripts/prerender-seo.mjs, depuis les
 * memes titres (src/data/seo-meta.json).
 */

import seoMeta from '../../data/seo-meta.json';
import type { SectionId } from '../theme';

export const SECTION_ROUTES: Readonly<Partial<Record<SectionId, string>>> = {
  tracks: '/tracks/',
  mixtapes: '/mixtapes/',
  shows: '/shows/',
  contact: '/contact/',
  goodies: '/goodies/',
  merch: '/merch/',
  studio: '/studio/',
};

/** Les sections que l'on ouvre en ouvrant d'abord la machine (puces du PCB). */
export const HOOD_SECTIONS: readonly SectionId[] = ['goodies', 'merch', 'studio'];

const META = (seoMeta as Record<string, Record<string, { title: string }>>).en;

/**
 * La section d'une adresse (avec ou sans barre finale), ou null. Les pages
 * des morceaux (/tracks/<morceau>/, 2026-10-03) ouvrent TRACKS.
 */
export function sectionFromPath(path: string): SectionId | null {
  // En minuscules (2026-10-21, audit : /tracks/UPPER/ restait sur l'accueil, l'adresse telle quelle ; le routeur, lui,
  // ne fait pas la difference)
  const p = (path.endsWith('/') ? path : `${path}/`).toLowerCase();
  for (const [id, route] of Object.entries(SECTION_ROUTES)) if (route === p) return id as SectionId;
  if (/^\/tracks\/[a-z0-9-]+\/$/.test(p)) return 'tracks';
  return null;
}

/** Le morceau d'une adresse /tracks/<morceau>/ (en minuscules, avec ou sans barre finale), ou null. */
export function trackSlugOf(path: string): string | null {
  const m = /^\/tracks\/([a-z0-9-]+)\/?$/.exec(path.toLowerCase());
  return m ? m[1] : null;
}

/**
 * Une adresse de morceau inconnue (2026-10-21, audit : un lien faux ou perime ouvrait TRACKS sans rien dire) : le
 * morceau demande, que TRACKS dit introuvable au-dessus de la liste ; null sinon. L'adresse, elle, redevient /tracks/.
 */
let missing: string | null = null;
const missingListeners = new Set<() => void>();
export const missingTrack = {
  get: (): string | null => missing,
  set(slug: string | null): void {
    if (slug === missing) return;
    missing = slug;
    missingListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    missingListeners.add(fn);
    return () => {
      missingListeners.delete(fn);
    };
  },
};

/**
 * La page statique d'arrivee (2026-10-04, referencement, Mika : "Je veux que
 * tu augmentes le referencement aussi, c'est important.") : son titre peut
 * etre plus precis que celui de seo-meta.json (/shows/ porte l'annee des
 * prochaines dates, scripts/prerender-seo.mjs). Lu au chargement du module,
 * avant le montage de la machine ; son adresse est celle de son canonical
 * (en dev, sans pages statiques, le canonical est l'accueil : rien ne change).
 */
const LANDING = ((): { path: string; title: string } | null => {
  if (typeof document === 'undefined') return null;
  try {
    const href = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    return href ? { path: new URL(href).pathname, title: document.title } : null;
  } catch {
    return null;
  }
})();

/** Titre de l'onglet d'une section (celui de son HTML statique), ou null. */
export function sectionTitle(s: SectionId): string | null {
  const route = SECTION_ROUTES[s];
  if (!route) return null;
  // La section de la page d'arrivee garde le titre de cette page
  if (LANDING && LANDING.path === route && LANDING.title) return LANDING.title;
  return META[route.replace(/\/$/, '')]?.title ?? null;
}
