/**
 * prerender-seo.mjs : genere un index.html statique par route dans dist/.
 *
 * POURQUOI : le site est une SPA. Google execute le JS et voit les meta
 * injectees par useSEO(), mais PAS les crawlers sociaux :
 * Facebook, LinkedIn, WhatsApp, Slack, iMessage, Discord et Twitter lisent
 * le HTML brut sans executer une ligne de JavaScript.
 *
 * Sans ce script, partager https://mauditemachine.com/shows sur Facebook
 * affiche le titre et la description de la page d'accueil. Avec, chaque
 * URL partagee a son propre apercu.
 *
 * COMMENT : on clone dist/index.html vers dist/<route>/index.html en
 * remplacant title / description / canonical / OG / Twitter par les valeurs
 * de la route. Le bundle JS reste identique, donc React Router reprend la
 * main normalement cote client (aucun impact sur la navigation).
 *
 * GitHub Pages sert automatiquement dist/shows/index.html pour /shows.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { C } from '../docs/presskit-2027/content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://mauditemachine.com';
const OG_IMAGE = `${SITE}/images/og-image.jpg?v=2027`;

// Source unique partagee avec src/lib/seo.ts (pas de divergence possible)
const SEO_META = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'seo-meta.json'), 'utf8'),
);

// Le HTML statique est genere en anglais : c'est la langue de fallback du
// site et celle des crawlers sociaux (qui n'envoient pas de Accept-Language
// exploitable). Le client bascule ensuite en FR/ES via useSEO() au mount.
const STATIC_LANG = 'en';

// '/' est deja gere par dist/index.html, on prerender les 6 autres routes
// bascule v2 : les URLs v1 redirigent cote client, plus de prerender.
// 2026-09-30 : /techrider/ (route React) recoit sa vraie page statique :
// GitHub Pages la sert en 200 au lieu du repli 404.html. Avec la barre
// finale, comme /press/ : /techrider repond 301 vers elle.
// 2026-10-01 : /presskit/ aussi (la machine et la visionneuse du press kit),
// meme principe : 200 et indexable, /presskit repond 301 vers elle.
// 2026-10-02 (referencement) : chaque section de la machine a son adresse
// (src/v4/state/sectionRoute.ts) et sa page statique, avec son contenu en
// HTML lisible sans JavaScript (moteurs, reseaux sociaux, assistants IA).
const ROUTES = ['/techrider/', '/presskit/', '/tracks/', '/mixtapes/', '/shows/', '/contact/', '/goodies/', '/merch/', '/studio/'];

const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) {
  console.error('❌ dist/index.html introuvable, lancer vite build avant');
  process.exit(1);
}
const baseHtml = readFileSync(indexPath, 'utf8');

/** Echappe les caracteres qui casseraient un attribut HTML. */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Remplace le contenu d'une meta existante, ou l'ajoute avant </head>
 * si elle n'existe pas encore dans le HTML de base.
 */
function upsertMeta(html, attr, key, value) {
  const safe = escapeAttr(value);
  const re = new RegExp(
    `(<meta\\s+[^>]*${attr}=["']${key}["'][^>]*content=["'])[^"']*(["'][^>]*>)`,
    'i',
  );
  if (re.test(html)) return html.replace(re, `$1${safe}$2`);

  // Variante ou content= precede attr= dans la balise
  const reAlt = new RegExp(
    `(<meta\\s+[^>]*content=["'])[^"']*(["'][^>]*${attr}=["']${key}["'][^>]*>)`,
    'i',
  );
  if (reAlt.test(html)) return html.replace(reAlt, `$1${safe}$2`);

  return html.replace('</head>', `    <meta ${attr}="${key}" content="${safe}" />\n  </head>`);
}

function setCanonical(html, href) {
  const re = /(<link\s+[^>]*rel=["']canonical["'][^>]*href=["'])[^"']*(["'][^>]*>)/i;
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(href)}$2`);
  return html.replace('</head>', `    <link rel="canonical" href="${escapeAttr(href)}" />\n  </head>`);
}

/* ---------- contenu statique (2026-10-02, referencement) ---------- */

const readJson = (name, fallback) => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'public', name), 'utf8'));
  } catch {
    return fallback;
  }
};
const EVENTS = readJson('events.json', []);
// La discographie de Mika (37 morceaux), la meme que la machine (src/v3/data/beads.ts)
const DISCO = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'src', 'v2', 'data', 'discography.json'), 'utf8')).tracks ?? [];
  } catch {
    return [];
  }
})()
  .filter((t) => /^[a-z0-9-]+$/.test(t.id))
  .sort((x, y) => String(y.releaseDate || y.year).localeCompare(String(x.releaseDate || x.year)));
const PAST = readJson('past-events.json', { events: [] }).events ?? [];
const MIXES = readJson('mixes.json', []);
const TODAY = new Date().toISOString().slice(0, 10);
const UPCOMING = EVENTS.filter((e) => e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const a = (text, href) => `<a href="${escapeAttr(href)}">${esc(text)}</a>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const NAV = `<nav aria-label="Site">${ul([
  a('Home', `${SITE}/`),
  a('Tracks', `${SITE}/tracks/`),
  a('Mixtapes', `${SITE}/mixtapes/`),
  a('Shows', `${SITE}/shows/`),
  a('Press kit', `${SITE}/presskit/`),
  a('Press assets', `${SITE}/press/`),
  a('Tech rider', `${SITE}/techrider/`),
  a('Contact and booking', `${SITE}/contact/`),
  a('Goodies', `${SITE}/goodies/`),
  a('Merch', `${SITE}/merch/`),
  a('Studio', `${SITE}/studio/`),
  a('Français', `${SITE}/fr/`),
  a('Español', `${SITE}/es/`),
])}</nav>`;

const upcomingList = () =>
  UPCOMING.length
    ? ul(UPCOMING.map((e) => `${esc(fmtDate(e.date))} · ${e.url ? a(e.title, e.url) : esc(e.title)} · ${esc(e.location)}`))
    : '<p>New dates are announced here first.</p>';

const pastList = () =>
  PAST.map((y) => `<h3>${esc(y.year)}</h3>${ul((y.shows ?? []).map((s) => `${esc(s.name)}${s.venue ? ` · ${esc(s.venue)}` : ''}${s.city ? `, ${esc(s.city)}` : ''}`))}`).join('');

const tracksList = () => ul(C.tracks.map(([t, meta, url]) => `${a(t, url)} · ${esc(meta)}`));
const platforms = () => ul(C.platforms.map(([n, url]) => a(n, url)));
const contacts = () =>
  ul(C.contacts.map(([role, who, ways]) => `${esc(role)}: ${esc(who)} · ${ways.map(([t, href]) => a(t, href)).join(' · ')}`));

/* ---------- pages des morceaux (2026-10-03, referencement) ---------- */

const trackUrl = (t) => `${SITE}/tracks/${t.id}/`;
const LIMBOS = { name: 'Limbos', url: C.limbos ? 'https://mauditemachine.bandcamp.com/album/limbos' : null };
/** Les sorties VRSTL Records connues (le press kit), pour ne rien inventer. */
const VRSTL_TITLES = new Set(C.catalogue.map(([t]) => t.toLowerCase()));
const isLimbos = (t) => t.project === 'Limbos LP';
const isRemix = (t) => t.category === 'remixes';
const onVrstl = (t) => isLimbos(t) || VRSTL_TITLES.has(String(t.title).toLowerCase());
const trackKind = (t) => (isRemix(t) ? 'Remix' : isLimbos(t) ? 'Album track, Limbos' : 'Single / EP');
const fmtMonth = (iso, locale = 'en-GB') =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const released = (t) => (t.releaseDate && !t.dateApprox ? fmtMonth(t.releaseDate) : String(t.year));

function trackTitle(t) {
  return /maudite machine/i.test(t.title) ? t.title : `${t.title} | Maudite Machine`;
}

/** Les edits officieux du press kit (telechargement libre) : les autres remixes restent des remixes. */
const EDIT_KEYS = ['dangerous drive', 'confused oi', 'robots', 'eye in the sky'];
const isEdit = (t) => isRemix(t) && EDIT_KEYS.some((k) => String(t.title).toLowerCase().includes(k));

function trackDescription(t) {
  if (isEdit(t)) return `${t.title}: an unofficial edit by Maudite Machine (${t.year}), free download on SoundCloud. Indie dance and psy prog DJ and producer.`;
  if (isRemix(t)) return `${t.title}: a remix by Maudite Machine (${t.year}). Indie dance and psy prog DJ and producer. Listen on SoundCloud.`;
  if (isLimbos(t)) return `${t.title}, from Limbos, the album by Maudite Machine on VRSTL Records (October 2025). Indie dance and psy prog. Listen on Bandcamp and SoundCloud.`;
  if (onVrstl(t)) return `${t.title}, a release by Maudite Machine on VRSTL Records, ${released(t)}. Indie dance and psy prog. Listen on Bandcamp and SoundCloud.`;
  return `${t.title}, a release by Maudite Machine, ${released(t)}. Indie dance and psy prog from the founder of VRSTL Records. Listen on Bandcamp and SoundCloud.`;
}

/** Les morceaux voisins : meme projet d'abord, puis les plus proches dans le temps. */
function related(t, n = 6) {
  const others = DISCO.filter((o) => o.id !== t.id);
  const same = others.filter((o) => o.project === t.project);
  const rest = others.filter((o) => o.project !== t.project).sort((x, y) => Math.abs(x.year - t.year) - Math.abs(y.year - t.year));
  return [...same, ...rest].slice(0, n);
}

function trackContent(t) {
  const h1 = `<h1>${esc(t.title)}</h1>`;
  const facts = ul([
    `Artist: ${a('Maudite Machine', `${SITE}/`)}`,
    `Type: ${esc(trackKind(t))}`,
    `Released: ${esc(released(t))}`,
    ...(onVrstl(t) ? [`Label: ${a('VRSTL Records', 'https://vrstlrecords.com/')}`] : []),
  ]);
  const listen = ul([...(t.link ? [a(/bandcamp/.test(t.link) ? 'Bandcamp' : 'Listen', t.link)] : []), ...(t.soundcloudUrl ? [a('SoundCloud', t.soundcloudUrl)] : [])]);
  return [
    h1,
    `<p>${esc(trackDescription(t))}</p>`,
    facts,
    `<h2>Listen</h2>${listen}`,
    isLimbos(t) ? `<h2>${esc(C.limbos.text)}</h2><p>${esc(C.limbos.about)}</p>` : '',
    `<h2>More tracks</h2>${ul(related(t).map((o) => a(o.title, trackUrl(o))))}`,
    `<p>${a('All tracks and releases', `${SITE}/tracks/`)}</p>`,
  ].join('');
}

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const ARTIST_REF = { '@type': 'MusicGroup', '@id': `${SITE}/#artist`, name: 'Maudite Machine', url: `${SITE}/` };

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
  };
}

function trackJsonLd(t) {
  const rec = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${trackUrl(t)}#recording`,
    name: t.title,
    url: trackUrl(t),
    byArtist: ARTIST_REF,
    ...(t.releaseDate && !t.dateApprox ? { datePublished: t.releaseDate } : {}),
    ...(isLimbos(t) ? { inAlbum: { '@type': 'MusicAlbum', name: 'Limbos', url: LIMBOS.url, byArtist: ARTIST_REF, datePublished: '2025-10' } } : {}),
    sameAs: [t.link, t.soundcloudUrl].filter(Boolean),
  };
  return ld([rec, breadcrumb([['Maudite Machine', `${SITE}/`], ['Tracks', `${SITE}/tracks/`], [t.title, trackUrl(t)]])]);
}

/** /tracks/ : la liste des pages de morceaux. */
function tracksJsonLd() {
  return ld({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Maudite Machine tracks and releases',
    itemListElement: DISCO.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: trackUrl(t), name: t.title })),
  });
}

/** Le contenu lisible de chaque adresse : ce que la machine montre, en HTML simple. */
function contentFor(route) {
  const h1 = (t) => `<h1>${esc(t)}</h1>`;
  const p = (t) => `<p>${esc(t)}</p>`;
  const h2 = (t) => `<h2>${esc(t)}</h2>`;
  switch (route) {
    case '/':
      return [
        h1('Maudite Machine'),
        p(C.positioning),
        p(C.bio),
        h2('Upcoming shows'),
        upcomingList(),
        h2('Listen'),
        tracksList(),
        platforms(),
        h2('Booking'),
        contacts(),
      ].join('');
    case '/shows/':
      return [
        h1('Maudite Machine shows and tour dates'),
        h2('Upcoming shows'),
        upcomingList(),
        h2(C.festivalsTitle),
        ul(C.festivals.map(([n, y]) => `${esc(n)} · ${esc(y)}`)),
        h2(C.venuesTitle),
        ul(C.venues.map(([n, y]) => `${esc(n)} · ${esc(y)}`)),
        h2('Past shows'),
        pastList(),
      ].join('');
    case '/tracks/':
      return [
        h1('Maudite Machine tracks and releases'),
        p(C.positioning),
        h2('Tracks'),
        tracksList(),
        h2(C.limbos.text),
        p(`${C.limbos.meta}. ${C.limbos.about}`),
        ul(C.tracklist.map(esc)),
        h2(C.catalogueTitle),
        ul(C.catalogue.map(([t, f, d]) => `${esc(t)} · ${esc(f)} · ${esc(d)}`)),
        p(C.also),
        h2('All tracks'),
        ul(DISCO.map((t) => `${a(t.title, trackUrl(t))} · ${esc(trackKind(t))} · ${esc(t.year)}`)),
        h2('Stream'),
        platforms(),
      ].join('');
    case '/mixtapes/':
      return [
        h1('Maudite Machine mixtapes and DJ sets'),
        `<p>${esc(C.mix.meta)}: ${a(C.mix.text, C.mix.url)}</p>`,
        h2('Mixtapes'),
        ul(MIXES.slice(0, 40).map((m) => a(m.title, m.mixcloud_url))),
      ].join('');
    case '/contact/':
      return [h1('Contact and booking'), p(C.bio), h2(C.contactTitle), contacts()].join('');
    case '/presskit/':
      return [
        h1('Maudite Machine press kit 2027'),
        p(C.positioning),
        ...C.bioLong.map(p),
        `<p>${a('Download the press kit (PDF)', `${SITE}/Presskit_Maudite_Machine_2027_generic.pdf`)}</p>`,
        h2(C.contactTitle),
        contacts(),
      ].join('');
    case '/techrider/':
      return [
        h1('Maudite Machine tech rider'),
        p(C.techIntro),
        ...C.tech.map(([t, items]) => h2(t) + ul(items.map(esc))),
      ].join('');
    default: {
      const meta = SEO_META[STATIC_LANG][route.replace(/\/$/, '')];
      return [h1(meta?.title ?? 'Maudite Machine'), p(meta?.description ?? C.positioning)].join('');
    }
  }
}

/**
 * Pose le contenu dans #root : lisible sans JavaScript, visuellement cache
 * (comme un texte pour lecteur d'ecran) ; React le remplace au montage
 * (createRoot vide le conteneur). Le meme texte que la machine affiche.
 */
function withContent(html, route) {
  const style = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
  const block = `<main class="seo-static" style="${style}">${contentFor(route)}${NAV}</main>`;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${block}</div>`);
}

/** Lieu schema.org d'une date ("Theatre - Mtl", "Ville, QC", "Ville (Pays)"). */
function place(location) {
  const loc = String(location || '').trim();
  const dash = loc.match(/^(.*?)\s+-\s+(Mtl|Montr[eé]al)$/i);
  if (dash) return { '@type': 'Place', name: dash[1], address: { '@type': 'PostalAddress', addressLocality: 'Montréal', addressRegion: 'QC', addressCountry: 'CA' } };
  const paren = loc.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (paren) return { '@type': 'Place', name: paren[1], address: { '@type': 'PostalAddress', addressLocality: paren[1], addressCountry: paren[2] } };
  const comma = loc.split(',').map((x) => x.trim());
  if (comma.length >= 2) return { '@type': 'Place', name: loc, address: { '@type': 'PostalAddress', addressLocality: comma[0], addressRegion: comma[1], addressCountry: 'CA' } };
  return { '@type': 'Place', name: loc, address: { '@type': 'PostalAddress', addressCountry: 'CA' } };
}

/** Les dates a venir en MusicEvent (resultats enrichis Google Events). */
function eventsJsonLd() {
  if (!UPCOMING.length) return '';
  const performer = { '@type': 'MusicGroup', name: 'Maudite Machine', url: `${SITE}/` };
  const items = UPCOMING.map((e) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: `${e.title} · Maudite Machine`,
    startDate: e.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place(e.location),
    performer,
    image: [OG_IMAGE],
    url: e.url || `${SITE}/shows/`,
    description: `Maudite Machine plays ${e.title} (${e.location}). Indie dance and psy prog DJ set.`,
  }));
  return `<script type="application/ld+json">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>`;
}

const withEvents = (html) => {
  const ld = eventsJsonLd();
  return ld ? html.replace('</head>', `    ${ld}\n  </head>`) : html;
};

/* ---------- versions francaise et espagnole (2026-10-03, referencement) ---------- */

/**
 * Les marches vises (France, Espagne, Quebec) cherchent dans leur langue :
 * l'accueil a une version FR et une version ES, de vraies pages lisibles
 * (pas la machine 3D, qui est en anglais), traduites du press kit sans rien
 * ajouter. Liees entre elles par hreflang ; x-default : l'accueil anglais.
 */
const LANG_PAGES = {
  en: `${SITE}/`,
  fr: `${SITE}/fr/`,
  es: `${SITE}/es/`,
};

function alternatesTags() {
  return [
    ...Object.entries(LANG_PAGES).map(([l, href]) => `<link rel="alternate" hreflang="${l}" href="${href}" />`),
    `<link rel="alternate" hreflang="x-default" href="${LANG_PAGES.en}" />`,
  ].join('\n    ');
}

/** L'accueil anglais : ses versions FR et ES, et les locales Open Graph. */
function withAlternates(html) {
  let out = html.replace('</head>', `    ${alternatesTags()}\n  </head>`);
  out = upsertMeta(out, 'property', 'og:locale', 'en_US');
  return out.replace('</head>', `    <meta property="og:locale:alternate" content="fr_FR" />\n    <meta property="og:locale:alternate" content="es_ES" />\n  </head>`);
}

const FESTIVAL_NAMES = C.festivals.map(([n, y]) => `${n.split(',')[0]} · ${y}`);

const T = {
  fr: {
    htmlLang: 'fr',
    locale: 'fr_FR',
    dateLocale: 'fr-FR',
    lead: 'Indie dance et psy prog · DJ et live hybride · Canada · France · Espagne',
    bio: [
      "Maudite Machine est un DJ et producteur basé entre le Canada, la France et l'Espagne, après quinze ans dans l'underground montréalais. Il joue de l'indie dance et de la psy prog : profond, roulant, fait pour la deuxième moitié de la nuit.",
      "Il dirige VRSTL Records, un label indépendant de 21 EPs et 2 albums d'artistes du Québec, du Brésil, d'Argentine et d'Europe, et il fait partie du collectif 8day à Montréal. Il a joué à la Techno Parade de Paris, à la SAT, au Piknic Électronik et aux afters de l'Igloofest, à l'affiche avec Carl Craig, Popof, Christian Smith, Perc, Agoria, Nick Curly et Damon Jee.",
      "Il est disponible pour les clubs et les festivals en France, en Espagne et dans le reste de l'Europe, et joue toujours au Canada.",
    ],
    soundTitle: 'Le son',
    sound: [
      "Indie dance et psy prog : une basse qui roule, des changements lents sous la surface, aucun pic artificiel. Pensé pour durer, pas pour l'effet.",
      'DJ set sur CDJ, de 90 minutes à 4 heures, plus long sur demande.',
      'Live hybride avec synthés et grooveboxes, 60 à 75 minutes, séquences jouées en direct, suivi d\'un DJ set quand le créneau le permet.',
    ],
    showsTitle: 'Prochaines dates',
    noShows: 'Les nouvelles dates sont annoncées ici en premier.',
    stageTitle: 'Festivals et scènes',
    listenTitle: 'Écouter',
    latest: 'Dernières sorties',
    mix: 'Mixtape 39, en live à Groove & Bass 2026 (1 h 29)',
    bookingTitle: 'Booking',
    roles: { 'Booking · international': 'Booking · international', 'Booking · Canada and USA': 'Booking · Canada et États-Unis', Label: 'Label' },
    links: [['Press kit 2027 (PDF)', `${SITE}/Presskit_Maudite_Machine_2027_generic.pdf`], ['Fiche technique', `${SITE}/techrider/`], ['Éléments presse', `${SITE}/press/`]],
    cta: 'Entrer dans la machine',
    title: SEO_META.fr['/'].title,
    description: SEO_META.fr['/'].description,
  },
  es: {
    htmlLang: 'es',
    locale: 'es_ES',
    dateLocale: 'es-ES',
    lead: 'Indie dance y psy prog · DJ y live híbrido · Canadá · Francia · España',
    bio: [
      'Maudite Machine es un DJ y productor con base entre Canadá, Francia y España, después de quince años en el underground de Montreal. Toca indie dance y psy prog: profundo, envolvente, hecho para la segunda mitad de la noche.',
      'Dirige VRSTL Records, un sello independiente con 21 EPs y 2 álbumes de artistas de Québec, Brasil, Argentina y Europa, y forma parte del colectivo 8day en Montreal. Ha tocado en la Techno Parade de París, la SAT, Piknic Électronik y los afters de Igloofest, en carteles con Carl Craig, Popof, Christian Smith, Perc, Agoria, Nick Curly y Damon Jee.',
      'Está disponible para clubes y festivales en Francia, España y el resto de Europa, y sigue tocando en Canadá.',
    ],
    soundTitle: 'El sonido',
    sound: [
      'Indie dance y psy prog: un bajo que rueda, cambios lentos bajo la superficie, sin picos artificiales. Hecho para durar, no para el efecto.',
      'DJ set en CDJ, de 90 minutos a 4 horas, más largo a pedido.',
      'Live híbrido con sintetizadores y grooveboxes, 60 a 75 minutos, secuencias tocadas en directo, seguido de un DJ set cuando el horario lo permite.',
    ],
    showsTitle: 'Próximas fechas',
    noShows: 'Las nuevas fechas se anuncian aquí primero.',
    stageTitle: 'Festivales y escenarios',
    listenTitle: 'Escuchar',
    latest: 'Últimos lanzamientos',
    mix: 'Mixtape 39, en directo en Groove & Bass 2026 (1 h 29)',
    bookingTitle: 'Booking',
    roles: { 'Booking · international': 'Booking · internacional', 'Booking · Canada and USA': 'Booking · Canadá y Estados Unidos', Label: 'Sello' },
    links: [['Press kit 2027 (PDF)', `${SITE}/Presskit_Maudite_Machine_2027_generic.pdf`], ['Rider técnico', `${SITE}/techrider/`], ['Material de prensa', `${SITE}/press/`]],
    cta: 'Entrar en la máquina',
    title: SEO_META.es['/'].title,
    description: SEO_META.es['/'].description,
  },
};

/** Une page complete en francais ou en espagnol, visible, legere (aucun JS de la machine). */
function langPage(lang) {
  const L = T[lang];
  const url = LANG_PAGES[lang];
  const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(L.dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shows = UPCOMING.length
    ? ul(UPCOMING.map((e) => `${esc(date(e.date))} · ${e.url ? a(e.title, e.url) : esc(e.title)} · ${esc(e.location)}`))
    : `<p>${esc(L.noShows)}</p>`;
  const latest = DISCO.filter((t) => !isRemix(t)).slice(0, 6);
  const contactsHtml = ul(C.contacts.map(([role, who, ways]) => `<strong>${esc(L.roles[role] ?? role)}</strong> : ${esc(who)} · ${ways.map(([t, href]) => a(t, href)).join(' · ')}`));
  const ldPage = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#page`,
    url,
    name: L.title,
    description: L.description,
    inLanguage: L.htmlLang,
    mainEntity: { ...ARTIST_REF, description: L.bio[0], genre: ['Indie Dance', 'Psy Prog'], sameAs: C.platforms.map(([, u]) => u) },
  };
  // Orange du texte assombri (#B04508, contraste 5 sur creme), CTA a l'encre sur orange (6.1)
  const css = `@font-face{font-family:'SF Pro Display';src:url('/fonts/SF-Pro-Display-Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'SF Pro Display';src:url('/fonts/SF-Pro-Display-Semibold.woff2') format('woff2');font-weight:600;font-display:swap}
@font-face{font-family:'SF Pro Display';src:url('/fonts/SF-Pro-Display-Black.woff2') format('woff2');font-weight:900;font-display:swap}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#F6F1E7;color:#191919;font:400 17px/1.6 'SF Pro Display',system-ui,-apple-system,'Segoe UI',sans-serif}
.top{display:flex;justify-content:space-between;align-items:center;max-width:780px;margin:0 auto;padding:20px 20px 0}
.top img{display:block;height:24px;width:auto}
.langs{font-size:13px;font-weight:600;letter-spacing:.12em}.langs a{margin-left:12px}.langs [aria-current]{color:#B04508;text-decoration:none}
main{max-width:780px;margin:0 auto;padding:12px 20px 72px}
h1{font-weight:900;font-size:clamp(40px,9vw,72px);line-height:1;letter-spacing:.01em;text-transform:uppercase;margin:40px 0 14px}
.lead{color:#B04508;font-weight:600;font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 28px}
h2{font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;margin:44px 0 12px;padding-top:18px;border-top:1px solid #DDD5C6}
a{color:#191919;text-decoration-color:#FF6A13;text-underline-offset:3px}
ul{padding-left:20px;margin:0}li{margin:6px 0}
.cta{display:inline-block;margin-top:36px;background:#FF6A13;color:#191919;padding:15px 24px;border-radius:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
footer{max-width:780px;margin:0 auto;padding:0 20px 48px;font-size:13px;color:#6B655B}`;
  const langLinks = Object.entries(LANG_PAGES)
    .map(([l, href]) => `<a href="${href}" hreflang="${l}"${l === lang ? ' aria-current="page"' : ''}>${l.toUpperCase()}</a>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeAttr(L.title)}</title>
    <meta name="description" content="${escapeAttr(L.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${url}" />
    ${alternatesTags()}
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeAttr(L.title)}" />
    <meta property="og:description" content="${escapeAttr(L.description)}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:locale" content="${L.locale}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#F6F1E7" />
    <link rel="icon" href="/logo/favicon.ico" type="image/x-icon" />
    <link rel="preload" href="/fonts/SF-Pro-Display-Black.woff2" as="font" type="font/woff2" crossorigin />
    <style>${css}</style>
    ${ld(ldPage)}
    ${ld(breadcrumb([['Maudite Machine', `${SITE}/`], [lang.toUpperCase(), url]]))}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-HP92HGMNJT"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-HP92HGMNJT');</script>
  </head>
  <body>
    <div class="top"><a href="${SITE}/"><img src="/logo/mauditemachine-logo-ink.svg" alt="Maudite Machine" width="140" height="24" /></a><nav class="langs" aria-label="Langue">${langLinks}</nav></div>
    <main>
      <h1>Maudite Machine</h1>
      <p class="lead">${esc(L.lead)}</p>
      ${L.bio.map((x) => `<p>${esc(x)}</p>`).join('\n      ')}
      <h2>${esc(L.soundTitle)}</h2>
      ${ul(L.sound.map(esc))}
      <h2>${esc(L.showsTitle)}</h2>
      ${shows}
      <h2>${esc(L.stageTitle)}</h2>
      ${ul(FESTIVAL_NAMES.map(esc))}
      <h2>${esc(L.listenTitle)}</h2>
      <p><strong>${esc(L.latest)}</strong></p>
      ${ul(latest.map((t) => `${a(t.title, trackUrl(t))} · ${esc(t.year)}`))}
      <p>${a(L.mix, C.mix.url)}</p>
      ${platforms()}
      <h2>${esc(L.bookingTitle)}</h2>
      ${contactsHtml}
      <p>${L.links.map(([t, href]) => a(t, href)).join(' · ')}</p>
      <a class="cta" href="${SITE}/">${esc(L.cta)}</a>
    </main>
    <footer>Maudite Machine · VRSTL Records</footer>
  </body>
</html>
`;
}

let count = 0;
for (const route of ROUTES) {
  const meta = SEO_META[STATIC_LANG][route] ?? SEO_META[STATIC_LANG][route.replace(/\/$/, '')];
  if (!meta) {
    console.warn(`⚠️  pas de meta pour ${route}, ignoré`);
    continue;
  }
  const canonical = `${SITE}${route}`;

  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(meta.title)}</title>`);
  html = upsertMeta(html, 'name', 'description', meta.description);
  html = setCanonical(html, canonical);

  html = upsertMeta(html, 'property', 'og:type', 'article');
  html = upsertMeta(html, 'property', 'og:url', canonical);
  html = upsertMeta(html, 'property', 'og:title', meta.title);
  html = upsertMeta(html, 'property', 'og:description', meta.description);
  html = upsertMeta(html, 'property', 'og:image', OG_IMAGE);

  html = upsertMeta(html, 'property', 'twitter:title', meta.title);
  html = upsertMeta(html, 'property', 'twitter:description', meta.description);
  html = upsertMeta(html, 'property', 'twitter:image', OG_IMAGE);
  html = upsertMeta(html, 'property', 'twitter:url', canonical);

  html = withContent(html, route);
  if (route === '/shows/') html = withEvents(html);
  const crumbName = meta.title.split('|')[0].trim();
  html = html.replace('</head>', `    ${ld(breadcrumb([['Maudite Machine', `${SITE}/`], [crumbName, canonical]]))}\n  </head>`);
  if (route === '/tracks/') html = html.replace('</head>', `    ${tracksJsonLd()}\n  </head>`);

  const dir = join(DIST, route.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

// Une page par morceau : /tracks/<morceau>/ (la machine ouvre TRACKS)
for (const t of DISCO) {
  const url = trackUrl(t);
  const title = trackTitle(t);
  const desc = trackDescription(t);
  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  html = upsertMeta(html, 'name', 'description', desc);
  html = setCanonical(html, url);
  html = upsertMeta(html, 'property', 'og:type', 'music.song');
  html = upsertMeta(html, 'property', 'og:url', url);
  html = upsertMeta(html, 'property', 'og:title', title);
  html = upsertMeta(html, 'property', 'og:description', desc);
  html = upsertMeta(html, 'property', 'og:image', OG_IMAGE);
  html = upsertMeta(html, 'property', 'twitter:title', title);
  html = upsertMeta(html, 'property', 'twitter:description', desc);
  html = upsertMeta(html, 'property', 'twitter:url', url);
  const style = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
  html = html.replace(/<div id="root"><\/div>/, `<div id="root"><main class="seo-static" style="${style}">${trackContent(t)}${NAV}</main></div>`);
  html = html.replace('</head>', `    ${trackJsonLd(t)}\n  </head>`);
  const dir = join(DIST, 'tracks', t.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

// Les pages en francais et en espagnol (des pages simples, sans la machine)
for (const lang of ['fr', 'es']) {
  const dir = join(DIST, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), langPage(lang), 'utf8');
  count += 1;
}

// L'accueil : son contenu, les dates a venir et ses versions FR / ES, dans dist/index.html meme
writeFileSync(indexPath, withAlternates(withEvents(withContent(baseHtml, '/')), 'en'), 'utf8');

console.log(`✅ prerender SEO : ${count} pages statiques (dont ${DISCO.length} morceaux, FR, ES) + accueil, ${UPCOMING.length} dates en MusicEvent (meta ${STATIC_LANG})`);
