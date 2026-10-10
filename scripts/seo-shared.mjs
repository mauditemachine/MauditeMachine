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

/* ---------- l'identite de l'artiste (2026-10-10) ---------- */

/*
 * 2026-10-10 (brief de Mika, mise a jour complete : nouveau positionnement
 * indie dance et dark disco, base Montpellier, titre, description, Open
 * Graph et MusicGroup uniques) : la source de l'en-tete de toutes les pages
 * statiques. index.html et public/press/index.html en gardent une copie
 * identique (dev, et la page /press/ servie telle quelle) : le prerender
 * remplace leur bloc id="ld-artist" par celui d'ici au build.
 */

/** Le titre de toutes les pages (sauf les pages de morceaux), FR, EN et ES. */
export const SEO_TITLE = 'Maudite Machine | DJ & Producer Dark Disco | VRSTL Records';

/** L'image d'apercu de partage : la photo booth-blue du press kit recadree en 1200 x 630. */
export const OG_IMAGE = {
  url: `${SITE}/press/og-maudite-machine.jpg`,
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'Maudite Machine in the booth under a blue spotlight',
};

/** Locale Open Graph de toutes les pages, et ses deux alternatives. */
export const OG_LOCALE = 'fr_FR';
export const OG_LOCALE_ALTERNATES = ['en_GB', 'es_ES'];

/** Le positionnement (brief A1), et sa version courte (tags, champs genre). */
export const POSITIONING = {
  en: 'Indie dance and dark disco with a psychedelic edge',
  fr: 'Indie dance et dark disco, à tendance psychédélique',
  es: 'Indie dance y dark disco, con un toque psicodélico',
};
export const POSITIONING_SHORT = 'Indie Dance, Dark Disco';

/** Les bios du brief (A2), mot pour mot. */
export const BIO_SHORT = {
  en: 'Indie dance and dark disco with a psychedelic edge. DJ, producer, founder of VRSTL Records. Fifteen years in the Montréal underground, now based in the south of France.',
  fr: "Indie dance et dark disco, à tendance psychédélique. DJ, producteur, fondateur de VRSTL Records. Quinze ans dans l'underground montréalais, maintenant basé dans le Sud de la France.",
  es: 'Indie dance y dark disco con un toque psicodélico. DJ, productor, fundador de VRSTL Records. Quince años en el underground de Montreal, ahora con base en el sur de Francia.',
};
export const BIO_LONG = {
  en: [
    'Maudite Machine is a DJ and producer based in Montpellier, in the south of France, after fifteen years in the Montréal underground. He plays indie dance and dark disco with a psychedelic edge: rolling basslines, dark synths and long tension that builds over the set, as a DJ on CDJs or as a hybrid live with synths and grooveboxes.',
    'He has played Techno Parade Paris, Okami Festival in France and Groove and Bass in Québec, and Montréal rooms from the SAT to Piknic Électronik, on bills with Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox and Perfect Stranger.',
    'He runs VRSTL Records, an independent label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe. His own releases include Limbos (2025) and Voodoo (2026).',
  ],
  fr: [
    "Maudite Machine est DJ et producteur, installé à Montpellier dans le Sud de la France après quinze ans dans l'underground montréalais. Il joue de l'indie dance et de la dark disco à tendance psychédélique : basses qui roulent, synthés sombres, tension qui monte sur la longueur du set. Il joue en DJ set sur CDJ ou en live hybride avec synthés et grooveboxes.",
    'Il a joué à la Techno Parade de Paris, à Okami Festival en France, à Groove and Bass au Québec, et dans les salles de Montréal, de la SAT au Piknic Électronik, sur des plateaux avec Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox et Perfect Stranger.',
    "Il dirige VRSTL Records, label indépendant de 21 EPs et 2 albums d'artistes du Québec, du Brésil, d'Argentine et d'Europe. Ses propres sorties comptent Limbos (2025) et Voodoo (2026).",
  ],
  es: [
    'Maudite Machine es DJ y productor, con base en Montpellier, en el sur de Francia, tras quince años en el underground de Montreal. Pincha indie dance y dark disco con un toque psicodélico: bajos que ruedan, sintes oscuros y una tensión que crece a lo largo del set, en DJ set con CDJ o en live híbrido con sintes y grooveboxes.',
    'Ha tocado en la Techno Parade de París, en Okami Festival en Francia y en Groove and Bass en Quebec, y en las salas de Montreal, de la SAT al Piknic Électronik, junto a Popof, Christian Smith, Perc, Nick Curly, Damon Jee, John 00 Fleming, D-Nox y Perfect Stranger.',
    'Dirige VRSTL Records, sello independiente con 21 EPs y 2 álbumes de artistas de Quebec, Brasil, Argentina y Europa. Sus lanzamientos propios incluyen Limbos (2025) y Voodoo (2026).',
  ],
};

/** Les profils du brief, dans sa forme d'URL (prioritaire sur les autres formes du meme profil). */
const BRIEF_SAME_AS = [
  'https://soundcloud.com/mauditemachine',
  'https://mauditemachine.bandcamp.com',
  'https://instagram.com/mauditemachine',
  'https://facebook.com/MauditeMachine',
  'https://youtube.com/@mauditemachine-official',
];

/** Une adresse de profil comparee sans protocole, www., casse ni barre finale. */
const profileKey = (u) =>
  String(u)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');

/**
 * sameAs : les profils du brief, puis les profils officiels verifies
 * (src/v4/data/socials.ts : Spotify, Apple Music, Deezer, Beatport...),
 * un seul par profil ; jamais le lien de pre-sauvegarde (410).
 */
export function artistSameAs() {
  const seen = new Set();
  const out = [];
  for (const u of [...BRIEF_SAME_AS, ...loadSocials().map((s) => s.href)]) {
    const k = profileKey(u);
    if (!k || seen.has(k) || /hypeddit/i.test(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

export const ARTIST_ID = `${SITE}/#artist`;
export const LABEL_ID = 'https://vrstlrecords.com/#organization';

/** Le MusicGroup (brief B1, valeurs strictes), le seul noeud complet de l'artiste sur chaque page. */
export function artistNode() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    '@id': ARTIST_ID,
    name: 'Maudite Machine',
    genre: ['Dark Disco', 'Indie Dance', 'Indie Electronic'],
    recordLabel: {
      '@type': 'Organization',
      name: 'VRSTL Records',
      url: 'https://vrstlrecords.com',
    },
    location: {
      '@type': 'Place',
      name: 'Montpellier, France',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Montpellier',
        addressRegion: 'Occitanie',
        addressCountry: 'FR',
      },
    },
    foundingLocation: {
      '@type': 'Place',
      name: 'Montreal, Canada',
    },
    areaServed: ['France', 'Spain', 'Europe', 'Canada'],
    album: [
      { '@type': 'MusicAlbum', name: 'Limbos (2025)' },
      { '@type': 'MusicAlbum', name: 'Voodoo (2026)' },
    ],
    description: BIO_SHORT.en,
    url: 'https://mauditemachine.com',
    sameAs: artistSameAs(),
  };
}

/** Le bloc JSON-LD commun : l'artiste, son label (relie par @id) et le site. */
export function artistGraph() {
  return [
    artistNode(),
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': LABEL_ID,
      name: 'VRSTL Records',
      url: 'https://vrstlrecords.com',
      description: 'Independent electronic music label with 21 EPs and 2 albums from artists in Québec, Brazil, Argentina and Europe.',
      founder: { '@id': ARTIST_ID },
      sameAs: ['https://vrstlrecords.bandcamp.com'],
      email: 'vrstlrecords@gmail.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Montréal',
        addressRegion: 'QC',
        addressCountry: 'CA',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: 'Maudite Machine',
      alternateName: 'mauditemachine.com',
      url: `${SITE}/`,
      description: 'Official website of Maudite Machine, DJ and producer',
      inLanguage: ['en', 'fr', 'es'],
      about: { '@id': ARTIST_ID },
      publisher: { '@id': ARTIST_ID },
    },
  ];
}

/** Le bloc <script> de l'artiste (id="ld-artist" : le prerender le retrouve et le remplace). */
export const artistScript = () =>
  `<script type="application/ld+json" id="ld-artist">${JSON.stringify(artistGraph()).replace(/</g, '\\u003c')}</script>`;
