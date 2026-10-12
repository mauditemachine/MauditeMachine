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
 *
 * 2026-10-11 (referencement) : les douze pages de MM-STUDIO (le hub et ses
 * trois machines, en EN, FR et ES), lues dans scripts/mm-studio-content.mjs
 * (la meme liste que le prerender), priority 0.5 comme le reste (B5), chacune
 * avec les hreflang de sa famille ; leurs captures en image si elles existent.
 */

import { writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE, OG_IMAGE, loadDisco, loadGoodies, coverOf, inPublic } from './seo-shared.mjs';
import { MM_STUDIO_PAGES, MM_STUDIO_SHOTS, clusterOf } from './mm-studio-content.mjs';

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

// MM-STUDIO (2026-10-11) : le hub et ses machines, apres les sections de la machine
const studioShot = (key) => (MM_STUDIO_SHOTS[key] && inPublic(MM_STUDIO_SHOTS[key].path) ? [`${SITE}${MM_STUDIO_SHOTS[key].path}`] : []);
for (const page of MM_STUDIO_PAGES) {
  ROUTES.push({ path: page.path, changefreq: 'monthly', images: studioShot(page.cluster), cluster: page.cluster });
}

/**
 * Les versions d'une page (hreflang), x-default l'anglais : l'accueil et ses
 * deux versions, et chaque famille de MM-STUDIO (2026-10-11).
 */
const HOME_ALTERNATES = { en: `${SITE}/`, fr: `${SITE}/fr/`, es: `${SITE}/es/` };
const ALT_GROUPS = new Map([['/', HOME_ALTERNATES], ['/fr/', HOME_ALTERNATES], ['/es/', HOME_ALTERNATES]]);
for (const page of MM_STUDIO_PAGES) {
  ALT_GROUPS.set(page.path, Object.fromEntries(clusterOf(page.cluster).map((p) => [p.lang, `${SITE}${p.path}`])));
}
const alternates = (path) => {
  const group = ALT_GROUPS.get(path);
  return [
    ...Object.entries(group).map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${group.en}" />`,
  ].join('\n');
};

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
  const alt = ALT_GROUPS.has(r.path) ? `\n${alternates(r.path)}` : '';
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
