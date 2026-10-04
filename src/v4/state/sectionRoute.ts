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
  const p = path.endsWith('/') ? path : `${path}/`;
  for (const [id, route] of Object.entries(SECTION_ROUTES)) if (route === p) return id as SectionId;
  if (/^\/tracks\/[a-z0-9-]+\/$/.test(p)) return 'tracks';
  return null;
}

/** Titre de l'onglet d'une section (celui de son HTML statique), ou null. */
export function sectionTitle(s: SectionId): string | null {
  const route = SECTION_ROUTES[s];
  return route ? META[route.replace(/\/$/, '')]?.title ?? null : null;
}
