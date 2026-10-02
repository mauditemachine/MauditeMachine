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

  const dir = join(DIST, route.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

// L'accueil : son contenu et les dates a venir, dans dist/index.html meme
writeFileSync(indexPath, withEvents(withContent(baseHtml, '/')), 'utf8');

console.log(`✅ prerender SEO : ${count} pages statiques + accueil, ${UPCOMING.length} dates en MusicEvent (meta ${STATIC_LANG})`);
