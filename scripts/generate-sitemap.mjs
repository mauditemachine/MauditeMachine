/**
 * generate-sitemap.mjs : genere public/sitemap.xml au build.
 *
 * Lance automatiquement via `npm run build` (prebuild). Garde le sitemap
 * synchronise avec les routes reelles, sans le maintenir a la main.
 *
 * 2026-10-04 (referencement) : images (la pochette de chaque morceau, les
 * photos de presse), /radar/ avec sa barre finale.
 *
 * 2026-10-10 (brief de Mika, B5) :
 * - lastmod = la date du build pour toutes les adresses (plus la date du
 *   dernier commit des fichiers de chaque page) ;
 * - priority : accueil 1.0, /press/ et /presskit/ 0.8, tout le reste 0.5 ;
 * - seulement des adresses qui repondent 200 : chacune a sa page statique
 *   dans dist/ (scripts/prerender-seo.mjs, ou public/press/index.html), avec
 *   la barre finale que GitHub Pages sert sans redirection (/techrider
 *   repond 301 vers /techrider/). Les routes du routeur (src/App.tsx) hors
 *   sitemap : /v1, /v2, /v3, les admins (noindex), /v4, /about, /archives
 *   et /v2/radar (redirections).
 */

import { writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE, OG_IMAGE, loadDisco, loadGoodies, coverOf } from './seo-shared.mjs';

const TODAY = new Date().toISOString().slice(0, 10);

/** Priorites du brief : accueil 1.0, press et presskit 0.8, le reste 0.5. */
const PRIORITY = { '/': '1.0', '/press/': '0.8', '/presskit/': '0.8' };
const priorityOf = (path) => PRIORITY[path] ?? '0.5';

// Les pages statiques de dist/ (une par route du routeur indexable), avec
// une frequence de changement a la mesure de leurs donnees.
const ROUTES = [
  { path: '/', changefreq: 'weekly' },
  // l'accueil en francais et en espagnol (scripts/prerender-seo.mjs)
  { path: '/fr/', changefreq: 'weekly' },
  { path: '/es/', changefreq: 'weekly' },
  { path: '/press/', changefreq: 'yearly' },
  { path: '/presskit/', changefreq: 'yearly' },
  { path: '/techrider/', changefreq: 'yearly' },
  // les sections de la machine (src/v4/state/sectionRoute.ts)
  { path: '/shows/', changefreq: 'weekly' },
  { path: '/tracks/', changefreq: 'monthly' },
  { path: '/mixtapes/', changefreq: 'monthly' },
  { path: '/contact/', changefreq: 'yearly' },
  { path: '/goodies/', changefreq: 'monthly' },
  { path: '/merch/', changefreq: 'monthly' },
  { path: '/studio/', changefreq: 'yearly' },
  // la page Radar de la v2
  { path: '/radar/', changefreq: 'weekly' },
];

/** L'accueil et ses deux versions : chacune annonce les trois (hreflang), x-default l'anglais. */
const HOME_ALTERNATES = { en: `${SITE}/`, fr: `${SITE}/fr/`, es: `${SITE}/es/` };
const ALT_PATHS = new Set(['/', '/fr/', '/es/']);
const alternates = () =>
  [
    ...Object.entries(HOME_ALTERNATES).map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${HOME_ALTERNATES.en}" />`,
  ].join('\n');

/** Une page par morceau (2026-10-03), la meme liste que le prerender ; sa pochette en image. */
const COVERS = loadGoodies().filter((g) => g.category === 'cover');
for (const t of loadDisco()) {
  const cover = coverOf(t, COVERS);
  ROUTES.push({
    path: `/tracks/${t.id}/`,
    changefreq: 'yearly',
    images: cover ? [`${SITE}${cover.downloadSrc}`] : [],
  });
}

/* ---------- images ---------- */

const homeRoute = ROUTES.find((r) => r.path === '/');
homeRoute.images = [OG_IMAGE.url];
const pressRoute = ROUTES.find((r) => r.path === '/press/');
try {
  pressRoute.images = readdirSync(join(ROOT, 'public', 'press'))
    .filter((f) => /^maudite-machine-.*\.(jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => `${SITE}/press/${f}`);
} catch {
  pressRoute.images = [];
}
const tracksRoute = ROUTES.find((r) => r.path === '/tracks/');
tracksRoute.images = [...new Set(ROUTES.flatMap((r) => (r.path.startsWith('/tracks/') && r !== tracksRoute ? r.images ?? [] : [])))];

/* ---------- ecriture ---------- */

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urls = ROUTES.map((r) => {
  const loc = `${SITE}${r.path}`;
  const alt = ALT_PATHS.has(r.path) ? `\n${alternates()}` : '';
  const imgs = (r.images ?? []).map((u) => `\n    <image:image>\n      <image:loc>${xmlEsc(u)}</image:loc>\n    </image:image>`).join('');
  return `  <url>
    <loc>${xmlEsc(loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${priorityOf(r.path)}</priority>${alt}${imgs}
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;

writeFileSync(join(ROOT, 'public', 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml généré (${ROUTES.length} URLs, lastmod ${TODAY})`);
