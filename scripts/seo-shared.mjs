/**
 * seo-shared.mjs : les donnees communes du referencement, lues par
 * scripts/prerender-seo.mjs (les pages statiques) et par
 * scripts/generate-sitemap.mjs (sitemap.xml), pour que les deux ne
 * divergent jamais : la discographie, les pochettes, les profils officiels.
 *
 * 2026-10-04 (referencement, Mika : "Je veux que tu augmentes le
 * referencement aussi, c'est important.") : rien n'est ecrit ici a la main,
 * tout vient des fichiers du depot (les memes que la machine affiche).
 * Les sources .ts sont lues comme du texte (le build tourne sur Node 20,
 * sans TypeScript) ; une forme inattendue rend une liste vide, jamais une
 * erreur de build.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://mauditemachine.com';

export function readText(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
}

export function readJson(rel, fallback) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

/** Fichier present dans public/ (chemin absolu du site : /images/...). */
export const inPublic = (p) => typeof p === 'string' && existsSync(join(ROOT, 'public', p.replace(/^\/+/, '')));

/** Titre compare sans accents, casse, parentheses ni mot EP final : "Back On Track (Luminarium Mix)" -> "backontrack". */
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\bep\s*$/, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * La discographie de Mika (37 morceaux, src/v2/data/discography.json, la
 * meme que la machine), du plus recent au plus ancien ; seuls les
 * identifiants propres font une adresse /tracks/<id>/.
 */
export function loadDisco() {
  const tracks = readJson('src/v2/data/discography.json', { tracks: [] }).tracks ?? [];
  return tracks
    .filter((t) => /^[a-z0-9-]+$/.test(t.id))
    .sort((x, y) => String(y.releaseDate || y.year).localeCompare(String(x.releaseDate || x.year)));
}

/** Les goodies (src/data/goodies.ts) : fonds d'ecran et pochettes, fichiers presents seulement. */
export function loadGoodies() {
  const src = readText('src/data/goodies.ts');
  const re = /\{\s*src:\s*'([^']+)',\s*downloadSrc:\s*'([^']+)',\s*title:\s*'([^']+)',\s*category:\s*'([a-z-]+)',\s*bytes:\s*(\d+)\s*\}/g;
  return [...src.matchAll(re)]
    .map(([, s, downloadSrc, title, category, bytes]) => ({ src: s, downloadSrc, title, category, bytes: Number(bytes) }))
    .filter((g) => inPublic(g.src) && inPublic(g.downloadSrc));
}

/**
 * La pochette d'un morceau, d'apres les goodies : meme titre, ou la
 * pochette de l'album Limbos pour ses 9 morceaux. Pas de correspondance
 * sure (Digital ep, remixes, vieux singles) : null, on n'en invente pas.
 */
export function coverOf(t, covers) {
  if (t.project === 'Limbos LP') return covers.find((c) => norm(c.title) === 'limbos') ?? null;
  const n = norm(t.title);
  return covers.find((c) => norm(c.title) === n) ?? null;
}

/** Les profils officiels (src/v4/data/socials.ts, verifies dans un vrai navigateur), dans leur ordre. */
export function loadSocials() {
  const src = readText('src/v4/data/socials.ts');
  const re = /\{\s*id:\s*'([a-z]+)',\s*label:\s*'([^']+)',\s*href:\s*'(https:\/\/[^']+)'/g;
  return [...src.matchAll(re)].map(([, id, label, href]) => ({ id, label, href }));
}
