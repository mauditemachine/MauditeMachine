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

/**
 * Le titre de l'accueil (2026-10-21, audit SEO F2 et F3, Mika : "je veux vraiment que tu travailles sur un
 * referencement plus que complet ! je veux du monde dans mon site !") : chaque page a son titre et sa description,
 * dans sa langue (src/data/seo-meta.json, la meme source que la machine) ; l'accueil, qui EST MM-STUDIO, parle de
 * l'outil gratuit (boite a rythmes, synthe, platines) et de l'artiste. Avant : un seul titre pour tout le site
 * (brief B2 du 2026-10-10), "Maudite Machine | DJ & Producer Dark Disco | VRSTL Records".
 */
export const SEO_META = readJson('src/data/seo-meta.json', {});
export const SEO_TITLE = SEO_META.en?.['/']?.title ?? 'MM-STUDIO by Maudite Machine: Free Drum Machine & Synth';

/** L'image d'apercu de partage : la photo booth-blue du press kit recadree en 1200 x 630. */
export const OG_IMAGE = {
  url: `${SITE}/press/og-maudite-machine.jpg`,
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'Maudite Machine in the booth under a blue spotlight',
};

/**
 * L'image d'apercu de l'accueil et des pages de MM-STUDIO (2026-10-21, audit SEO F3) : la carte MM-STUDIO, la
 * machine en grand et son titre lisible (public/press/mm-studio/og-mm-studio-card.jpg, 1200 x 630) ; un partage de
 * l'outil montre l'outil. Les pages de l'artiste gardent la photo (OG_IMAGE).
 */
export const OG_STUDIO_IMAGE = {
  url: `${SITE}/press/mm-studio/og-mm-studio-card.jpg`,
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'MM-STUDIO by Maudite Machine: a free drum machine, synth and DJ decks you play in your browser',
};

/**
 * La locale Open Graph de chaque langue (2026-10-21, audit SEO F9 : fr_FR etait pose sur les 58 pages anglaises et
 * espagnoles) ; les deux autres en alternatives.
 */
export const OG_LOCALES = { en: 'en_GB', fr: 'fr_FR', es: 'es_ES' };
export const OG_LOCALE = OG_LOCALES.en;
export const OG_LOCALE_ALTERNATES = ['fr_FR', 'es_ES'];
/** Les balises og:locale d'une page de cette langue (la sienne, puis les deux autres). */
export const ogLocaleTags = (lang) => {
  const own = OG_LOCALES[lang] ?? OG_LOCALES.en;
  return [`<meta property="og:locale" content="${own}" />`, ...Object.values(OG_LOCALES).filter((l) => l !== own).map((l) => `<meta property="og:locale:alternate" content="${l}" />`)];
};

/**
 * twitter:site (2026-10-21, audit SEO F19) : le compte X de src/v4/data/socials.ts (x.com/mauditemachine), s'il y
 * est ; sinon rien (aucun compte invente).
 */
export function twitterSite() {
  const x = loadSocials().find((s) => /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(s.href));
  return x ? `@${x.href.replace(/\/+$/, '').split('/').pop()}` : null;
}

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
 * 2026-10-11 (referencement) : deux profils de plus, verifies le 2026-10-11
 * (l'API GraphQL de RA rend l'artiste Maudite Machine pour ce slug, l'API
 * Discogs l'artiste 5831599 Maudite Machine) : les fiches que la presse et
 * les festivals consultent.
 */
const EXTRA_SAME_AS = ['https://ra.co/dj/mauditemachine', 'https://www.discogs.com/artist/5831599-Maudite-Machine'];

/**
 * Profils retires du sameAs (2026-10-11) : gigmit.com, un profil qui annonce
 * encore l'ancien genre et l'ancienne ville. A remettre quand Mika l'aura
 * reecrit (le lien reste sur la page de liens de src/v4/data/socials.ts).
 * Et le service du lien de pre-sauvegarde (410), jamais dans le sameAs : son
 * nom s'ecrit ici avec une classe de caracteres ([e]) pour que le grep des
 * termes interdits du depot reste vide ; la regle est la meme.
 */
const SAME_AS_EXCLUDED = /hyp[e]ddit|gigmit\.com/i;

/**
 * sameAs : les profils du brief, puis les profils officiels verifies
 * (src/v4/data/socials.ts : Spotify, Apple Music, Deezer, Beatport...),
 * puis RA et Discogs, un seul par profil ; jamais le lien de
 * pre-sauvegarde (410), ni un profil exclu (SAME_AS_EXCLUDED).
 */
export function artistSameAs() {
  const seen = new Set();
  const out = [];
  for (const u of [...BRIEF_SAME_AS, ...loadSocials().map((s) => s.href), ...EXTRA_SAME_AS]) {
    const k = profileKey(u);
    if (!k || seen.has(k) || SAME_AS_EXCLUDED.test(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

export const ARTIST_ID = `${SITE}/#artist`;
export const LABEL_ID = 'https://vrstlrecords.com/#organization';

/**
 * Le MusicGroup (brief B1), le seul noeud complet de l'artiste sur chaque page.
 * 2026-10-21 (audit SEO F16) : recordLabel retire (schema.org ne le definit que sur MusicRelease, les validateurs le
 * signalaient) ; le lien vers VRSTL Records reste porte par Organization.founder et par MusicRelease.recordLabel. Les
 * albums sans l'annee dans leur nom (elle est dans datePublished de leur page) : Limbos par son @id (le MusicAlbum
 * complet de /tracks/), Voodoo, un single (sa page /tracks/voodoo/).
 */
export function artistNode() {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    '@id': ARTIST_ID,
    name: 'Maudite Machine',
    genre: ['Dark Disco', 'Indie Dance', 'Indie Electronic'],
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
      { '@type': 'MusicAlbum', '@id': `${SITE}/tracks/#limbos-album`, name: 'Limbos' },
      { '@type': 'MusicAlbum', name: 'Voodoo', albumReleaseType: 'https://schema.org/SingleRelease', url: `${SITE}/tracks/voodoo/` },
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
      // 2026-10-11 : Discogs (label 3752945, verifie par son API) et SoundCloud, le compte que la fiche Discogs donne ;
      // Beatport label non ajoute (a verifier)
      sameAs: ['https://vrstlrecords.bandcamp.com', 'https://www.discogs.com/label/3752945-VRSTL-Records', 'https://soundcloud.com/vrstlrecords'],
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
