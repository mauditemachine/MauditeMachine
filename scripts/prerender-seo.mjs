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
 *
 * 2026-10-04 (referencement, Mika : "Je veux que tu augmentes le
 * referencement aussi, c'est important.") :
 * - le texte propre a chaque page de la machine reste dans le DOM apres le
 *   montage (hors de #root) : Google indexe la page rendue, et sans lui les
 *   37 pages de morceaux avaient le meme contenu rendu (toutes les sections) ;
 * - /radar/ a sa page statique (elle repondait 404, servie par 404.html) ;
 *   404.html passe en noindex ;
 * - pages de morceaux : pochette en apercu (JPEG tire de la pochette des
 *   goodies), titre avec l'album ou le label, MusicAlbum Limbos complet,
 *   EPs en MusicAlbum, plus de texte (tracklist, date exacte) ;
 * - texte reel sur GOODIES, MERCH et STUDIO (les memes donnees que la
 *   machine), mixtapes de la machine, profils officiels, ContactPage ;
 * - titre et description de /shows/ avec les prochaines dates.
 * Les donnees communes avec sitemap.xml : scripts/seo-shared.mjs.
 *
 * 2026-10-10 (brief de Mika, mise a jour complete) : un seul titre et une
 * seule description par langue pour toutes les pages (sauf les pages de
 * morceaux, qui gardent les leurs), le jeu Open Graph complet du brief sur
 * chaque page, un seul MusicGroup par page (le bloc id="ld-artist" de
 * seo-shared.mjs, les autres noeuds le citent par son @id), nouveau
 * positionnement (indie dance et dark disco), base Montpellier, bios du
 * brief mot pour mot.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { C, URL as KIT_URL } from '../docs/presskit-2027/content.mjs';
import {
  ROOT,
  SITE,
  readJson,
  readText,
  inPublic,
  norm,
  loadDisco,
  loadGoodies,
  coverOf,
  loadSocials,
  SEO_TITLE,
  OG_IMAGE as OG_DEFAULT,
  OG_LOCALE,
  OG_LOCALE_ALTERNATES,
  POSITIONING,
  POSITIONING_SHORT,
  BIO_SHORT,
  BIO_LONG,
  ARTIST_ID,
  artistScript,
} from './seo-shared.mjs';

const DIST = join(ROOT, 'dist');
/** L'image d'apercu du site (1200 x 630, la photo booth-blue recadree, declaree dans index.html). */
const OG_IMAGE = OG_DEFAULT.url;

// Source unique partagee avec src/lib/seo.ts (pas de divergence possible)
const SEO_META = readJson('src/data/seo-meta.json', {});

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
// 2026-10-04 : /radar/ (la page Radar de la v2), meme principe que /techrider/.
const ROUTES = ['/techrider/', '/presskit/', '/tracks/', '/mixtapes/', '/shows/', '/contact/', '/goodies/', '/merch/', '/studio/', '/radar/'];

/**
 * Les pages React de la v2 (fiche technique, Radar) rendent leur propre
 * texte : leur contenu statique reste dans #root et React le remplace au
 * montage. Toutes les autres adresses sont la machine (v4), dont le DOM
 * rendu est le meme partout : leur texte reste a cote de #root.
 */
const REACT_PAGES = new Set(['/techrider/', '/radar/']);

const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) {
  console.error('ERREUR : dist/index.html introuvable, lancer vite build avant');
  process.exit(1);
}
/**
 * Le bloc JSON-LD de l'artiste (id="ld-artist") remplace par celui de
 * seo-shared.mjs : la copie d'index.html (ou de /press/) ne peut pas
 * diverger. Absent : il est ajoute, toujours un seul.
 */
const LD_ARTIST = /<script\s+type=["']application\/ld\+json["']\s+id=["']ld-artist["']\s*>[\s\S]*?<\/script>/i;
const withArtist = (html) => (LD_ARTIST.test(html) ? html.replace(LD_ARTIST, () => artistScript()) : html.replace('</head>', () => `    ${artistScript()}\n  </head>`));

const baseHtml = withArtist(readFileSync(indexPath, 'utf8'));

/** Echappe les caracteres qui casseraient un attribut HTML. */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Insere avant un repere (fonction de remplacement : un "$" du texte reste un "$"). */
const inject = (html, marker, text) => html.replace(marker, () => text);
const toHead = (html, snippet) => (snippet ? inject(html, '</head>', `    ${snippet}\n  </head>`) : html);

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
  if (re.test(html)) return html.replace(re, (_, p1, p2) => `${p1}${safe}${p2}`);

  // Variante ou content= precede attr= dans la balise
  const reAlt = new RegExp(
    `(<meta\\s+[^>]*content=["'])[^"']*(["'][^>]*${attr}=["']${key}["'][^>]*>)`,
    'i',
  );
  if (reAlt.test(html)) return html.replace(reAlt, (_, p1, p2) => `${p1}${safe}${p2}`);

  return toHead(html, `<meta ${attr}="${key}" content="${safe}" />`);
}

function setCanonical(html, href) {
  const re = /(<link\s+[^>]*rel=["']canonical["'][^>]*href=["'])[^"']*(["'][^>]*>)/i;
  if (re.test(html)) return html.replace(re, (_, p1, p2) => `${p1}${escapeAttr(href)}${p2}`);
  return toHead(html, `<link rel="canonical" href="${escapeAttr(href)}" />`);
}

/** L'image d'apercu d'une page : Open Graph et Twitter, dimensions et texte alternatif compris. */
function setImage(html, img) {
  let out = html;
  out = upsertMeta(out, 'property', 'og:image', img.url);
  out = upsertMeta(out, 'property', 'og:image:width', String(img.width));
  out = upsertMeta(out, 'property', 'og:image:height', String(img.height));
  out = upsertMeta(out, 'property', 'og:image:type', img.type);
  out = upsertMeta(out, 'property', 'og:image:alt', img.alt);
  out = upsertMeta(out, 'name', 'twitter:image', img.url);
  out = upsertMeta(out, 'name', 'twitter:image:alt', img.alt);
  return out;
}

/**
 * Titre, description, canonical, Open Graph et Twitter d'une page.
 * og:site_name, og:locale (fr_FR, en_GB et es_ES en alternatives) et
 * twitter:card viennent d'index.html, les memes sur chaque page.
 */
function pageHead(html, { title, description, url, ogType, image = OG_DEFAULT, extra = [] }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeAttr(title)}</title>`);
  out = upsertMeta(out, 'name', 'description', description);
  out = setCanonical(out, url);
  out = upsertMeta(out, 'property', 'og:type', ogType);
  out = upsertMeta(out, 'property', 'og:url', url);
  out = upsertMeta(out, 'property', 'og:title', title);
  out = upsertMeta(out, 'property', 'og:description', description);
  out = upsertMeta(out, 'name', 'twitter:title', title);
  out = upsertMeta(out, 'name', 'twitter:description', description);
  out = setImage(out, image);
  for (const [prop, content] of extra) out = toHead(out, `<meta property="${prop}" content="${escapeAttr(content)}" />`);
  return out;
}

/* ---------- donnees (les memes que la machine) ---------- */

const asArray = (v) => (Array.isArray(v) ? v : []);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const EVENTS = asArray(readJson('public/events.json', []));
// La discographie de Mika (37 morceaux), la meme que la machine (src/v3/data/beads.ts)
const DISCO = loadDisco();
const PAST = readJson('public/past-events.json', { events: [] }).events ?? [];
const MIXES = asArray(readJson('public/mixes.json', []));
/** Les 5 mixtapes de la machine (SoundCloud), la plus recente d'abord. */
const MIXTAPES = asArray(readJson('src/v2/data/mixtapes.json', { mixtapes: [] }).mixtapes).slice().sort((x, y) => y.number - x.number);
/** Le Radar : les sorties publiees, la plus recente d'abord (public/releases.json). */
const RELEASES = asArray(readJson('public/releases.json', []))
  .filter((r) => r && r.publishedRadar !== false && r.artist && r.title)
  .sort((x, y) => String(y.releaseDate).localeCompare(String(x.releaseDate)));
const FOLLOWING = readJson('public/following.json', {});
const STORE = asArray(readJson('public/store.json', []));
const GOODIES = loadGoodies();
const COVERS = GOODIES.filter((g) => g.category === 'cover');
const SOCIALS = loadSocials();
/** Les profils officiels (src/v4/data/socials.ts), sinon les liens du press kit. */
const PROFILES = SOCIALS.length ? SOCIALS.map((s) => [s.label, s.href]) : C.links.filter(([n]) => n !== 'mauditemachine.com');
const TODAY = new Date().toISOString().slice(0, 10);
const UPCOMING = EVENTS.filter((e) => e && ISO_DAY.test(e.date) && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date));

/** Les textes de la machine (src/v4/data.ts), lus tels quels ; absents : la page s'en passe. */
const V4_DATA = readText('src/v4/data.ts');
const tsString = (src, re) => src.match(re)?.[1] ?? null;
const MERCH_TEXT = tsString(V4_DATA, /export const MERCH_TEXT = '([^'\\]*)'/);
const MERCH_NOTE = tsString(V4_DATA, /export const MERCH_NOTE = '([^'\\]*)'/);
const MASSIVE_HREF = tsString(V4_DATA, /MASSIVE_LINK = \{\s*href:\s*'(https:\/\/[^']+)'/);
const STUDIO = (() => {
  const block = V4_DATA.match(/export const STUDIO = \{([\s\S]*?)\} as const;/)?.[1] ?? '';
  const lessons = [...(block.match(/lessons:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^'\\]*)'/g)].map((m) => m[1]);
  return { setup: tsString(block, /setup:\s*'([^'\\]*)'/), lessons, print: tsString(block, /print:\s*'([^'\\]*)'/) };
})();

/*
 * 2026-10-10 (brief de Mika, A1 a A3) : le positionnement et la base des
 * pages statiques viennent de seo-shared.mjs, pas du press kit
 * (docs/presskit-2027/content.mjs, qui a son propre calendrier) ; les faits
 * du press kit gardent leurs valeurs, sauf un genre ou une base de l'ancien
 * positionnement.
 */
const LEAD = `${POSITIONING.en} · DJ and hybrid live · Montpellier, south of France`;
const FACTS = { Genre: POSITIONING_SHORT, Base: 'Montpellier, south of France' };
const STALE_FACT = /psy ?-?prog|Canada · France · Spain/i;
const factOf = (k, v) => (STALE_FACT.test(v) ? FACTS[k] ?? v : v);
/** Les en-tetes de format de la fiche technique (brief A3). */
const RIDER_FORMATS = {
  'DJ set': 'Indie dance and dark disco. 90 minutes to 4 hours.',
  'Hybrid live': 'Indie dance and dark disco. 60 to 75 minutes.',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const a = (text, href) => `<a href="${escapeAttr(href)}">${esc(text)}</a>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const h1 = (t) => `<h1>${esc(t)}</h1>`;
const h2 = (t) => `<h2>${esc(t)}</h2>`;
const p = (t) => `<p>${esc(t)}</p>`;
const fmtDate = (iso) =>
  ISO_DAY.test(String(iso)) ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : String(iso ?? '');
/** "a, b and c" */
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const NAV_LINKS = [
  ['Home', '/'],
  ['Tracks', '/tracks/'],
  ['Mixtapes', '/mixtapes/'],
  ['Shows', '/shows/'],
  ['Press kit', '/presskit/'],
  ['Press assets', '/press/'],
  ['Tech rider', '/techrider/'],
  ['Contact and booking', '/contact/'],
  ['Goodies', '/goodies/'],
  ['Merch', '/merch/'],
  ['Studio', '/studio/'],
  ['Radar', '/radar/'],
  ['Français', '/fr/'],
  ['Español', '/es/'],
];
const NAV = `<nav aria-label="Site">${ul(NAV_LINKS.map(([t, path]) => a(t, `${SITE}${path}`)))}</nav>`;

const upcomingList = () =>
  UPCOMING.length
    ? ul(UPCOMING.map((e) => `${esc(fmtDate(e.date))} · ${e.url ? a(e.title, e.url) : esc(e.title)} · ${esc(e.location)}`))
    : '<p>New dates are announced here first.</p>';

const pastList = () =>
  PAST.map((y) => `<h3>${esc(y.year)}</h3>${ul((y.shows ?? []).map((s) => `${esc(s.name)}${s.venue ? ` · ${esc(s.venue)}` : ''}${s.city ? `, ${esc(s.city)}` : ''}`))}`).join('');

const platforms = () => ul(C.platforms.map(([n, url]) => a(n, url)));
const profiles = () => ul(PROFILES.map(([n, url]) => a(n, url)));
const contacts = () =>
  ul(C.contacts.map(([role, who, ways]) => `${esc(role)}: ${esc(who)} · ${ways.map(([t, href]) => a(t, href)).join(' · ')}`));

/* ---------- pages des morceaux (2026-10-03, referencement) ---------- */

const trackUrl = (t) => `${SITE}/tracks/${t.id}/`;
const isLimbos = (t) => t.project === 'Limbos LP';
const isRemix = (t) => t.category === 'remixes';
/** Un EP : sortie "Single / EP" dont le titre dit EP et dont la page Bandcamp est un album. */
const isEp = (t) => !isRemix(t) && /\bep$/i.test(String(t.title).trim()) && /\/album\//.test(String(t.link));
/** Les morceaux de l'album Limbos, dans l'ordre du disque. */
const LIMBOS_TRACKS = DISCO.filter(isLimbos).sort((x, y) => (x.trackNo ?? 0) - (y.trackNo ?? 0));

/**
 * Les sorties VRSTL Records connues (le catalogue du press kit), pour ne
 * rien inventer : meme titre (ou titre contenu : "Sync Button") ET meme
 * mois de sortie que la discographie.
 */
const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const CATALOGUE = C.catalogue.map(([t, format, d]) => {
  const [mon, year] = String(d).split(' ');
  return { key: norm(t), format, ym: `${year}-${MONTHS[mon] ?? '00'}` };
});
const vrstlEntry = (t) => {
  if (t.dateApprox || !t.releaseDate) return null;
  const n = norm(t.title);
  const ym = String(t.releaseDate).slice(0, 7);
  return CATALOGUE.find((c) => (n === c.key || (c.key.length >= 6 && n.includes(c.key))) && c.ym === ym) ?? null;
};
const onVrstl = (t) => isLimbos(t) || (!isRemix(t) && vrstlEntry(t) !== null);

/** Les edits officieux du press kit (telechargement libre) : les autres remixes restent des remixes. */
const EDIT_KEYS = ['dangerous drive', 'confused oi', 'robots', 'eye in the sky'];
const isEdit = (t) => isRemix(t) && EDIT_KEYS.some((k) => String(t.title).toLowerCase().includes(k));
const trackKind = (t) => (isEdit(t) ? 'Unofficial edit' : isRemix(t) ? 'Remix' : isLimbos(t) ? 'Album track, Limbos' : isEp(t) ? 'EP' : 'Single');
const fmtMonth = (iso, locale = 'en-GB') =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const exactDate = (t) => (t.releaseDate && !t.dateApprox && ISO_DAY.test(t.releaseDate) ? t.releaseDate : null);
const released = (t) => (exactDate(t) ? fmtMonth(t.releaseDate) : String(t.year));
const releasedFull = (t) => (exactDate(t) ? fmtDate(t.releaseDate) : String(t.year));

/** Titre : le morceau, l'artiste, puis l'album ou le label quand ils tiennent sous 60 signes. */
function trackTitle(t) {
  const base = /maudite machine/i.test(t.title) ? t.title : `${t.title} | Maudite Machine`;
  const extra = isLimbos(t) && norm(t.title) !== 'limbos' ? ' · Limbos LP' : onVrstl(t) ? ' · VRSTL Records' : '';
  return `${base}${extra}`.length <= 60 ? `${base}${extra}` : base;
}

const listenOn = (t) => {
  const where = [/bandcamp\.com/.test(String(t.link)) ? 'Bandcamp' : null, t.soundcloudUrl ? 'SoundCloud' : null].filter(Boolean);
  return where.length ? ` Listen on ${andList(where)}.` : '';
};

/** Sous 160 signes (ce que Google affiche) : on retire les dernieres phrases, jamais la premiere. */
function fit(desc, max = 160) {
  const parts = String(desc).split(/(?<=\.)\s+/);
  while (parts.length > 1 && parts.join(' ').length > max) parts.pop();
  return parts.join(' ');
}

// 2026-10-10 : le nouveau positionnement (brief A1), indie dance et dark disco
function trackDescription(t) {
  if (isEdit(t)) return fit(`${t.title}: an unofficial edit by Maudite Machine (${t.year}), free download on SoundCloud. Indie dance and dark disco DJ and producer.`);
  if (isRemix(t)) return fit(`${t.title}: a remix by Maudite Machine (${t.year}).${listenOn(t)} Indie dance and dark disco DJ and producer.`);
  if (isLimbos(t)) return fit(`${t.title}, track ${t.trackNo} of Limbos, the album by Maudite Machine on VRSTL Records (October 2025). Indie dance and dark disco.${listenOn(t)}`);
  const kind = isEp(t) ? 'an EP' : 'a single';
  if (onVrstl(t)) return fit(`${t.title}, ${kind} by Maudite Machine on VRSTL Records, ${released(t)}. Indie dance and dark disco.${listenOn(t)}`);
  return fit(`${t.title}, ${kind} by Maudite Machine, ${released(t)}. Indie dance and dark disco from the founder of VRSTL Records.${listenOn(t)}`);
}

/** Les morceaux voisins : meme projet d'abord, puis les plus proches dans le temps. */
function related(t, n = 6, skipProject = false) {
  const others = DISCO.filter((o) => o.id !== t.id);
  const same = skipProject ? [] : others.filter((o) => o.project === t.project);
  const rest = others.filter((o) => o.project !== t.project).sort((x, y) => Math.abs(x.year - t.year) - Math.abs(y.year - t.year));
  return [...same, ...rest].slice(0, n);
}

const byTitle = new Map(DISCO.map((t) => [norm(t.title), t]));
/** Les morceaux mis en avant par le press kit, lies a leur page puis a SoundCloud. */
const tracksList = () =>
  ul(
    C.tracks.map(([t, meta, url]) => {
      const d = byTitle.get(norm(t));
      return `${d ? a(t, trackUrl(d)) : esc(t)} · ${esc(meta)} · ${a('SoundCloud', url)}`;
    }),
  );
/**
 * Les dernieres sorties (hors remixes), liees a leur page ; l'album Limbos
 * compte pour une sortie (sa page : le morceau titre, avec la tracklist).
 */
function latestReleases(n = 6) {
  const out = [];
  for (const t of DISCO) {
    if (out.length >= n) break;
    if (isRemix(t)) continue;
    if (isLimbos(t)) {
      if (out.some((r) => r.album)) continue;
      const title = LIMBOS_TRACKS.find((x) => norm(x.title) === 'limbos') ?? t;
      out.push({ album: true, title: 'Limbos', url: trackUrl(title), kind: `Album, ${LIMBOS_TRACKS.length} tracks`, t });
    } else out.push({ album: false, title: t.title, url: trackUrl(t), kind: trackKind(t), t });
  }
  return out;
}
const latestList = (n = 6) => ul(latestReleases(n).map((r) => `${a(r.title, r.url)} · ${esc(r.kind)} · ${esc(released(r.t))}`));

function trackContent(t) {
  const album = isLimbos(t) ? LIMBOS_TRACKS : null;
  const facts = ul([
    `Artist: ${a('Maudite Machine', `${SITE}/`)}`,
    `Type: ${esc(trackKind(t))}`,
    `Released: ${esc(releasedFull(t))}`,
    ...(album ? [`Album: ${a('Limbos', KIT_URL.limbosAlbum)}, track ${esc(t.trackNo)} of ${album.length}`] : []),
    ...(onVrstl(t) ? [`Label: ${a('VRSTL Records', 'https://vrstlrecords.com/')}`] : []),
  ]);
  const listen = ul([...(t.link ? [a(/bandcamp/.test(t.link) ? 'Bandcamp' : 'Listen', t.link)] : []), ...(t.soundcloudUrl ? [a('SoundCloud', t.soundcloudUrl)] : [])]);
  return [
    h1(t.title),
    p(trackDescription(t)),
    facts,
    `<h2>Listen</h2>${listen}`,
    album
      ? `${h2(C.limbos.text)}${p(`${C.limbos.meta}. ${C.limbos.about}`)}<h3>Tracklist</h3><ol>${album.map((o) => `<li>${o.id === t.id ? esc(o.title) : a(o.title, trackUrl(o))}</li>`).join('')}</ol>`
      : '',
    `<h2>More tracks</h2>${ul(related(t, 6, Boolean(album)).map((o) => a(o.title, trackUrl(o))))}`,
    `${h2('About Maudite Machine')}<p>${esc(BIO_SHORT.en)} ${a('Biography and press kit', `${SITE}/presskit/`)}</p>`,
    `<p>${a('All tracks and releases', `${SITE}/tracks/`)}</p>`,
  ].join('');
}

const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
/** L'artiste cite par son @id (2026-10-10) : le seul MusicGroup complet de la page est le bloc ld-artist. */
const ARTIST_REF = { '@id': ARTIST_ID };
const LABEL_REF = { '@type': 'Organization', '@id': 'https://vrstlrecords.com/#organization', name: 'VRSTL Records', url: 'https://vrstlrecords.com/' };
const coverImage = (t) => {
  const c = coverOf(t, COVERS);
  return c ? `${SITE}${c.downloadSrc}` : null;
};

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
  };
}

/** L'album Limbos (meme @id que dans index.html) ; avec ses 9 morceaux sur /tracks/. */
function limbosAlbum(withTracks = false) {
  const first = LIMBOS_TRACKS[0];
  const date = first && exactDate(first) ? first.releaseDate : '2025-10';
  const image = first ? coverImage(first) : null;
  return {
    '@type': 'MusicAlbum',
    '@id': `${SITE}/tracks/#limbos-album`,
    name: 'Limbos',
    url: KIT_URL.limbosAlbum,
    byArtist: ARTIST_REF,
    datePublished: date,
    numTracks: LIMBOS_TRACKS.length || C.tracklist.length,
    albumReleaseType: 'https://schema.org/AlbumRelease',
    albumRelease: { '@type': 'MusicRelease', name: 'Limbos', datePublished: date, recordLabel: LABEL_REF },
    ...(image ? { image } : {}),
    ...(withTracks
      ? {
          track: {
            '@type': 'ItemList',
            numberOfItems: LIMBOS_TRACKS.length,
            itemListElement: LIMBOS_TRACKS.map((t) => ({
              '@type': 'ListItem',
              position: t.trackNo,
              item: { '@type': 'MusicRecording', '@id': `${trackUrl(t)}#recording`, name: t.title, url: trackUrl(t), byArtist: ARTIST_REF },
            })),
          },
        }
      : {}),
  };
}

function trackJsonLd(t) {
  const url = trackUrl(t);
  const image = coverImage(t);
  // Les morceaux de Limbos renvoient a la page Bandcamp de l'album : elle va dans inAlbum, pas dans sameAs
  const same = [isLimbos(t) ? null : t.link, t.soundcloudUrl].filter(Boolean);
  const common = {
    name: t.title,
    url,
    byArtist: ARTIST_REF,
    ...(exactDate(t) ? { datePublished: t.releaseDate } : {}),
    ...(image ? { image } : {}),
    ...(onVrstl(t) ? { publisher: LABEL_REF } : {}),
    ...(same.length ? { sameAs: same } : {}),
  };
  const node = isEp(t)
    ? { '@context': 'https://schema.org', '@type': 'MusicAlbum', '@id': `${url}#album`, albumReleaseType: 'https://schema.org/EPRelease', ...common }
    : {
        '@context': 'https://schema.org',
        '@type': 'MusicRecording',
        '@id': `${url}#recording`,
        ...common,
        ...(isLimbos(t) ? { inAlbum: limbosAlbum(), position: t.trackNo } : {}),
      };
  return ld([node, breadcrumb([['Maudite Machine', `${SITE}/`], ['Tracks', `${SITE}/tracks/`], [t.title, url]])]);
}

/** /tracks/ : la liste des pages de morceaux, et l'album Limbos avec ses morceaux. */
function tracksJsonLd() {
  return ld([
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Maudite Machine tracks and releases',
      numberOfItems: DISCO.length,
      itemListElement: DISCO.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: trackUrl(t), name: t.title })),
    },
    ...(LIMBOS_TRACKS.length ? [{ '@context': 'https://schema.org', ...limbosAlbum(true) }] : []),
  ]);
}

/* ---------- apercus des morceaux : la pochette (2026-10-04) ---------- */

// sharp convertit la pochette (WebP des goodies) en JPEG : certains apercus
// (LinkedIn notamment) lisent mal le WebP. Sans sharp, ou en cas d'echec :
// l'image du site, le build continue.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}
const OG_DIR = join(DIST, 'images', 'og');
const ogCache = new Map();

/** L'apercu d'un morceau : sa pochette en JPEG (1200 px au plus), sinon l'image du site. */
async function trackImage(t) {
  const cover = coverOf(t, COVERS);
  if (!cover || !sharp) return OG_DEFAULT;
  if (!ogCache.has(cover.downloadSrc)) {
    let img = null;
    try {
      const name = basename(cover.downloadSrc).replace(/\.[a-z0-9]+$/i, '.jpg');
      mkdirSync(OG_DIR, { recursive: true });
      const info = await sharp(join(ROOT, 'public', cover.downloadSrc))
        .resize(1200, 1200, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toFile(join(OG_DIR, name));
      img = { url: `${SITE}/images/og/${name}`, width: info.width, height: info.height, type: 'image/jpeg' };
    } catch {
      img = null;
    }
    ogCache.set(cover.downloadSrc, img);
  }
  const img = ogCache.get(cover.downloadSrc);
  if (!img) return OG_DEFAULT;
  const alt = isLimbos(t) ? 'Cover of Limbos, the album by Maudite Machine' : `Cover of ${t.title} by Maudite Machine`;
  return { ...img, alt };
}

/* ---------- mixtapes, contact, radar, merch : leurs donnees structurees ---------- */

/** "1:29:33" -> "PT1H29M33S" (duree schema.org). */
function isoDuration(s) {
  const parts = String(s ?? '').split(':').map(Number);
  if (!parts.length || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [h, m, sec] = parts.length === 3 ? parts : [0, ...(parts.length === 2 ? parts : [0, parts[0]])];
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${sec ? `${sec}S` : ''}`;
}

function mixtapesJsonLd() {
  if (!MIXTAPES.length) return '';
  return ld({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Maudite Machine mixtapes',
    numberOfItems: MIXTAPES.length,
    itemListElement: MIXTAPES.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'MusicRecording',
        name: m.title,
        url: m.soundcloudUrl,
        byArtist: ARTIST_REF,
        ...(isoDuration(m.duration) ? { duration: isoDuration(m.duration) } : {}),
        ...(inPublic(m.artwork) ? { image: `${SITE}${m.artwork}` } : {}),
      },
    })),
  });
}

const contactJsonLd = (url, title, description) =>
  ld({
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${url}#page`,
    url,
    name: title,
    description,
    about: { '@id': `${SITE}/#artist` },
    mainEntity: { '@id': `${SITE}/#artist` },
  });

function radarJsonLd(url, title, description) {
  if (!RELEASES.length) return '';
  const picks = RELEASES.slice(0, 30);
  return ld({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name: title,
    description,
    author: { '@id': `${SITE}/#artist` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: picks.length,
      itemListElement: picks.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `${r.artist}, ${r.title}`, ...(r.link ? { url: r.link } : {}) })),
    },
  });
}

/** Les produits du MERCH, regroupes comme la machine (src/v4/data.ts groupMerch) : vues actives par categorie. */
function merchProducts() {
  const byCat = new Map();
  for (const v of STORE) {
    if (!v || v.active === false || typeof v.caption !== 'string' || typeof v.category !== 'string' || typeof v.price !== 'string') continue;
    if (!byCat.has(v.category)) byCat.set(v.category, []);
    byCat.get(v.category).push(v);
  }
  const lastWord = (alt) => {
    const w = String(alt ?? '').trim().split(/\s+/);
    const l = w[w.length - 1] || '';
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  return [...byCat.values()].map((list) => {
    const first = list[0];
    const colours = !first.sizes;
    const options = colours
      ? list.map((v) => ({ name: lastWord(v.alt), inStock: !v.soldOut }))
      : ['S', 'M', 'L', 'XL'].filter((k) => k in first.sizes).map((k) => ({ name: k, inStock: !first.soldOut && first.sizes[k] === true }));
    return { name: first.caption, price: first.price, kind: colours ? 'Colours' : 'Sizes', options };
  });
}
const MERCH = merchProducts();

/* ---------- titre, description et noms des pages ---------- */

/*
 * 2026-10-10 (brief de Mika, B2 et B3) : le meme titre et la meme
 * description sur toutes les pages hors morceaux (src/data/seo-meta.json) ;
 * les titres et descriptions tires des donnees (/shows/ avec ses prochaines
 * dates, /merch/, /radar/, /goodies/) sont retires.
 */
const describe = (_route, meta) => meta.description;
const titleOf = () => SEO_TITLE;

/** Le nom de chaque page dans son fil d'Ariane (le titre ne le porte plus). */
const PAGE_NAMES = {
  '/techrider/': 'Tech rider',
  '/presskit/': 'Press kit',
  '/tracks/': 'Tracks',
  '/mixtapes/': 'Mixtapes',
  '/shows/': 'Shows',
  '/contact/': 'Contact and booking',
  '/goodies/': 'Goodies',
  '/merch/': 'Merch',
  '/studio/': 'Studio',
  '/radar/': 'Radar',
};

/** Le contenu lisible de chaque adresse : ce que la machine montre, en HTML simple. */
function contentFor(route) {
  switch (route) {
    case '/':
      return [
        h1('Maudite Machine'),
        p(LEAD),
        ...BIO_LONG.en.map(p),
        h2('Upcoming shows'),
        upcomingList(),
        `<p>${a('All shows and tour dates', `${SITE}/shows/`)}</p>`,
        h2('Latest releases'),
        latestList(),
        h2('Listen'),
        tracksList(),
        `<p>${esc(C.mix.meta)}: ${a(C.mix.text, C.mix.url)}</p>`,
        platforms(),
        h2('Booking'),
        contacts(),
        h2('Profiles'),
        profiles(),
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
        p(C.rooms),
        h2(C.sharedTitle),
        p(`${C.shared.join(', ')}.`),
        h2('Past shows'),
        pastList(),
        `<p>${a('Booking', `${SITE}/contact/`)}</p>`,
      ].join('');
    case '/tracks/':
      return [
        h1('Maudite Machine tracks and releases'),
        p(LEAD),
        h2('Tracks'),
        tracksList(),
        h2(C.limbos.text),
        p(`${C.limbos.meta}. ${C.limbos.about}`),
        `<ol>${LIMBOS_TRACKS.map((t) => `<li>${a(t.title, trackUrl(t))}</li>`).join('')}</ol>`,
        h2(C.catalogueTitle),
        ul(C.catalogue.map(([t, f, d]) => `${esc(t)} · ${esc(f)} · ${esc(d)}`)),
        p(C.also),
        h2(C.editsTitle),
        p(`${C.edits.join(' · ')}. ${C.editsNote}`),
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
        ul(MIXTAPES.map((m) => `${a(m.title, m.soundcloudUrl)} · Mixtape ${esc(m.number)} · ${esc(m.year)} · ${esc(m.duration)}`)),
        h2('Archive on Mixcloud'),
        ul(MIXES.slice(0, 40).map((m) => a(m.title, m.mixcloud_url))),
      ].join('');
    case '/contact/': {
      const formats = C.set.find(([t]) => /format/i.test(t))?.[1] ?? [];
      return [h1('Contact and booking'), p(BIO_SHORT.en), h2(C.contactTitle), contacts(), formats.length ? h2('Formats') + ul(formats.map(esc)) : '', h2('Profiles'), profiles()].join('');
    }
    case '/presskit/':
      return [
        h1('Maudite Machine press kit 2027'),
        p(LEAD),
        ...BIO_LONG.en.map(p),
        h2('Facts'),
        ul(C.facts.map(([k, v]) => `${esc(k)}: ${esc(factOf(k, v))}`)),
        h2(C.sharedTitle),
        p(`${C.shared.join(', ')}.`),
        `<p>${a('Download the press kit (PDF)', `${SITE}/Presskit_Maudite_Machine_2027_generic.pdf`)}</p>`,
        h2(C.contactTitle),
        contacts(),
      ].join('');
    case '/techrider/':
      return [
        h1('Maudite Machine tech rider'),
        p(C.techIntro),
        ...C.tech.map(([t, items]) => h2(t) + (RIDER_FORMATS[t] ? p(RIDER_FORMATS[t]) : '') + ul(items.filter((x) => x !== RIDER_FORMATS[t]).map(esc))),
      ].join('');
    case '/goodies/': {
      const groups = [
        ['wallpaper-desktop', 'Desktop wallpapers'],
        ['wallpaper-phone', 'Phone wallpapers'],
        ['cover', 'Release covers'],
      ];
      return [
        h1('Maudite Machine goodies: free wallpapers and release covers'),
        p('Free downloads, full resolution.'),
        ...groups.map(([cat, title]) => {
          const items = GOODIES.filter((g) => g.category === cat);
          return items.length ? h2(title) + ul(items.map((g) => a(g.title, `${SITE}${g.downloadSrc}`))) : '';
        }),
      ].join('');
    }
    case '/merch/':
      return [
        h1('Maudite Machine merch'),
        MERCH_TEXT ? p(MERCH_TEXT) : '',
        MERCH.length
          ? ul(
              MERCH.map((m) => {
                const inStock = m.options.filter((o) => o.inStock).map((o) => o.name);
                return `${esc(m.name)} · ${esc(m.price)} · ${esc(inStock.length ? `${m.kind}: ${inStock.join(', ')}` : 'Sold out')}`;
              }),
            )
          : '',
        MERCH_NOTE ? p(MERCH_NOTE) : '',
        `<p>${a('Order through the contact form', `${SITE}/contact/`)}</p>`,
      ].join('');
    case '/studio/': {
      return [
        h1('Maudite Machine studio, lessons and print'),
        STUDIO.setup ? h2('The setup') + p(STUDIO.setup) : '',
        STUDIO.lessons.length ? h2('Ableton Live lessons') + STUDIO.lessons.map(p).join('') : '',
        `<p>${a('Ask about a lesson', `${SITE}/contact/`)}</p>`,
        STUDIO.print ? h2('Print and merch production') + p(STUDIO.print) + (MASSIVE_HREF ? `<p>${a('massivemedias.com', MASSIVE_HREF)}</p>` : '') : '',
      ].join('');
    }
    case '/radar/': {
      const nA = asArray(FOLLOWING.artists).length;
      const nL = asArray(FOLLOWING.labels).length;
      const top = asArray(FOLLOWING.topLabels).filter((x) => typeof x === 'string');
      return [
        h1('Radar: new releases picked by Maudite Machine'),
        p('Curated releases and discoveries, with 30 second previews.'),
        h2('Latest picks'),
        ul(
          RELEASES.slice(0, 30).map((r) => {
            const name = `${r.artist}, ${r.title}`;
            const meta = [r.label, r.genre, r.format].filter(Boolean).join(' · ');
            return `${r.link ? a(name, r.link) : esc(name)}${meta ? ` · ${esc(meta)}` : ''}${r.releaseDate ? ` · ${esc(fmtDate(r.releaseDate))}` : ''}`;
          }),
        ),
        nA || nL ? p(`Following ${nA} artists and ${nL} labels.`) : '',
        top.length ? h2('Labels to watch') + ul(top.map(esc)) : '',
      ].join('');
    }
    default: {
      const meta = SEO_META[STATIC_LANG][route.replace(/\/$/, '')];
      return [h1(meta?.title ?? 'Maudite Machine'), p(meta?.description ?? LEAD)].join('');
    }
  }
}

/**
 * Pose le contenu, lisible sans JavaScript et visuellement cache (comme un
 * texte pour lecteur d'ecran) : le meme texte que la machine affiche.
 * - Pages React de la v2 : dans #root, React le remplace au montage.
 * - Pages de la machine (2026-10-04) : juste apres #root, il reste apres le
 *   montage. Google indexe la page rendue : sans lui, chaque adresse de la
 *   machine rendait le meme DOM. Ses liens sortent de la tabulation
 *   (tabindex -1, rien d'invisible ne prend le focus) mais restent suivis
 *   par les moteurs et lus par les lecteurs d'ecran. src/App.tsx le retire
 *   quand on navigue vers une autre page du routeur.
 */
const HIDDEN = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
function withContent(html, route, body = contentFor(route)) {
  const inner = `${body}${NAV}`;
  if (REACT_PAGES.has(route)) return inject(html, '<div id="root"></div>', `<div id="root"><main class="seo-static" style="${HIDDEN}">${inner}</main></div>`);
  const kept = inner.replace(/<a href=/g, '<a tabindex="-1" href=');
  return inject(html, '<div id="root"></div>', `<div id="root"></div>\n    <main id="seo-static" class="seo-static" style="${HIDDEN}">${kept}</main>`);
}

/** Codes pays des lieux ecrits en toutes lettres ("St Cristaud (France)"). */
const COUNTRY = { france: 'FR', spain: 'ES', espagne: 'ES', 'españa': 'ES', canada: 'CA', belgium: 'BE', belgique: 'BE', germany: 'DE', netherlands: 'NL', italy: 'IT', portugal: 'PT', usa: 'US' };

/** Lieu schema.org d'une date ("Theatre - Mtl", "Ville, QC", "Ville (Pays)"). */
function place(location) {
  const loc = String(location || '').trim();
  const dash = loc.match(/^(.*?)\s+-\s+(Mtl|Montr[eé]al)$/i);
  if (dash) return { '@type': 'Place', name: dash[1], address: { '@type': 'PostalAddress', addressLocality: 'Montréal', addressRegion: 'QC', addressCountry: 'CA' } };
  const paren = loc.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (paren) return { '@type': 'Place', name: paren[1], address: { '@type': 'PostalAddress', addressLocality: paren[1], addressCountry: COUNTRY[paren[2].trim().toLowerCase()] ?? paren[2] } };
  const comma = loc.split(',').map((x) => x.trim());
  if (comma.length >= 2) return { '@type': 'Place', name: loc, address: { '@type': 'PostalAddress', addressLocality: comma[0], addressRegion: comma[1], addressCountry: 'CA' } };
  return { '@type': 'Place', name: loc, address: { '@type': 'PostalAddress', addressCountry: 'CA' } };
}

/** Les dates a venir en MusicEvent (resultats enrichis Google Events). */
function eventsJsonLd() {
  if (!UPCOMING.length) return '';
  const items = UPCOMING.map((e) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: `${e.title} · Maudite Machine`,
    startDate: e.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place(e.location),
    performer: ARTIST_REF,
    image: [inPublic(e.image) ? `${SITE}/${String(e.image).replace(/^\/+/, '')}` : OG_IMAGE],
    url: e.url || `${SITE}/shows/`,
    description: `Maudite Machine plays ${e.title} (${e.location}). Indie dance and dark disco DJ set.`,
  }));
  return ld(items);
}

const withEvents = (html) => toHead(html, eventsJsonLd());

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

/**
 * L'accueil anglais : ses versions FR et ES. Les locales Open Graph
 * (fr_FR, en_GB et es_ES, brief B4) sont celles d'index.html, sur chaque page.
 */
const withAlternates = (html) => toHead(html, alternatesTags());

/** og:description de toutes les pages hors morceaux : la description EN (brief B4). */
const OG_DESCRIPTION = SEO_META.en['/'].description;

// Le nom avant le lieu ("Techno Parade, Paris, France" : "Techno Parade") ; la virgule d'un nombre (1,200) n'est pas un separateur
const FESTIVAL_NAMES = C.festivals.map(([n, y]) => `${n.split(', ')[0]} · ${y}`);

const T = {
  fr: {
    htmlLang: 'fr',
    dateLocale: 'fr-FR',
    lead: `${POSITIONING.fr} · DJ et live hybride · Montpellier, Sud de la France`,
    bio: BIO_LONG.fr,
    soundTitle: 'Le son',
    sound: [
      `${POSITIONING.fr} : basses qui roulent, synthés sombres, tension qui monte sur la longueur du set.`,
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
    dateLocale: 'es-ES',
    lead: `${POSITIONING.es} · DJ y live híbrido · Montpellier, sur de Francia`,
    bio: BIO_LONG.es,
    soundTitle: 'El sonido',
    sound: [
      `${POSITIONING.es}: bajos que ruedan, sintes oscuros y una tensión que crece a lo largo del set.`,
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
  const latest = latestReleases(6);
  const contactsHtml = ul(C.contacts.map(([role, who, ways]) => `<strong>${esc(L.roles[role] ?? role)}</strong> : ${esc(who)} · ${ways.map(([t, href]) => a(t, href)).join(' · ')}`));
  const ldPage = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#page`,
    url,
    name: L.title,
    description: L.description,
    inLanguage: L.htmlLang,
    mainEntity: ARTIST_REF,
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
    <meta property="og:type" content="music.musician" />
    <meta property="og:site_name" content="Maudite Machine" />
    <meta property="og:title" content="${escapeAttr(L.title)}" />
    <meta property="og:description" content="${escapeAttr(OG_DESCRIPTION)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="${OG_DEFAULT.width}" />
    <meta property="og:image:height" content="${OG_DEFAULT.height}" />
    <meta property="og:image:type" content="${OG_DEFAULT.type}" />
    <meta property="og:image:alt" content="${escapeAttr(OG_DEFAULT.alt)}" />
    <meta property="og:locale" content="${OG_LOCALE}" />
    ${OG_LOCALE_ALTERNATES.map((l) => `<meta property="og:locale:alternate" content="${l}" />`).join('\n    ')}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(L.title)}" />
    <meta name="twitter:description" content="${escapeAttr(OG_DESCRIPTION)}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:image:alt" content="${escapeAttr(OG_DEFAULT.alt)}" />
    <meta name="theme-color" content="#F6F1E7" />
    <link rel="icon" href="/logo/favicon.ico" type="image/x-icon" />
    <link rel="preload" href="/fonts/SF-Pro-Display-Black.woff2" as="font" type="font/woff2" crossorigin />
    <style>${css}</style>
    ${artistScript()}
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
      ${ul(latest.map((r) => `${a(r.title, r.url)} · ${esc(r.t.year)}`))}
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

/* ---------- ecriture ---------- */

let count = 0;
const writePage = (dirRel, html) => {
  const dir = join(DIST, dirRel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
};

for (const route of ROUTES) {
  const meta = SEO_META[STATIC_LANG][route] ?? SEO_META[STATIC_LANG][route.replace(/\/$/, '')];
  if (!meta) {
    console.warn(`ATTENTION : pas de meta pour ${route}, ignoré`);
    continue;
  }
  const url = `${SITE}${route}`;
  const title = titleOf(route, meta);
  const description = describe(route, meta);

  let html = pageHead(baseHtml, { title, description, url, ogType: 'music.musician' });
  html = withContent(html, route);
  if (route === '/shows/') html = withEvents(html);
  html = toHead(html, ld(breadcrumb([['Maudite Machine', `${SITE}/`], [PAGE_NAMES[route] ?? 'Maudite Machine', url]])));
  if (route === '/tracks/') html = toHead(html, tracksJsonLd());
  if (route === '/mixtapes/') html = toHead(html, mixtapesJsonLd());
  if (route === '/contact/') html = toHead(html, contactJsonLd(url, title, description));
  if (route === '/radar/') html = toHead(html, radarJsonLd(url, title, description));

  writePage(route.replace(/^\//, ''), html);
}

// Une page par morceau : /tracks/<morceau>/ (la machine ouvre TRACKS)
for (const t of DISCO) {
  const url = trackUrl(t);
  const image = await trackImage(t);
  const extra = [
    ['music:musician', `${SITE}/`],
    ...(exactDate(t) ? [['music:release_date', t.releaseDate]] : []),
    ...(isLimbos(t) ? [['music:album', KIT_URL.limbosAlbum], ['music:album:track', String(t.trackNo)]] : []),
  ];
  let html = pageHead(baseHtml, { title: trackTitle(t), description: trackDescription(t), url, ogType: isEp(t) ? 'music.album' : 'music.song', image, extra });
  html = withContent(html, `/tracks/${t.id}/`, trackContent(t));
  html = toHead(html, trackJsonLd(t));
  writePage(join('tracks', t.id), html);
}

// Les pages en francais et en espagnol (des pages simples, sans la machine)
for (const lang of ['fr', 'es']) writePage(lang, langPage(lang));

// L'accueil : son contenu, les dates a venir et ses versions FR / ES, dans dist/index.html meme
writeFileSync(indexPath, withAlternates(withEvents(withContent(baseHtml, '/'))), 'utf8');

// 404.html (copie d'index.html, servie avec le statut 404 pour toute adresse
// inconnue, et pour /v1, /v2, /v3, /mm-admin) : noindex, pas de canonical
// vers l'accueil (2026-10-04)
const notFoundPath = join(DIST, '404.html');
if (existsSync(notFoundPath)) {
  let nf = readFileSync(notFoundPath, 'utf8');
  nf = upsertMeta(nf, 'name', 'robots', 'noindex, follow');
  nf = upsertMeta(nf, 'name', 'googlebot', 'noindex, follow');
  nf = nf.replace(/\n?\s*<link\s+rel=["']canonical["'][^>]*>/i, '');
  writeFileSync(notFoundPath, withArtist(nf), 'utf8');
}

// /press/ (public/press/index.html, servie telle quelle) : son bloc de
// l'artiste remplace par celui de seo-shared.mjs, comme partout (2026-10-10)
const pressPath = join(DIST, 'press', 'index.html');
if (existsSync(pressPath)) writeFileSync(pressPath, withArtist(readFileSync(pressPath, 'utf8')), 'utf8');

const covers = [...ogCache.values()].filter(Boolean).length;
console.log(
  `prerender SEO : ${count} pages statiques (dont ${DISCO.length} morceaux, FR, ES) + accueil, ${UPCOMING.length} dates en MusicEvent, ${covers} pochettes en apercu${sharp ? '' : ' (sharp absent : image du site)'} (meta ${STATIC_LANG})`,
);
