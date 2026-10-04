/**
 * generate-sitemap.mjs : genere public/sitemap.xml au build.
 *
 * Lance automatiquement via `npm run build` (prebuild). Garde le sitemap
 * synchronise avec les routes reelles + met a jour lastmod a chaque deploy,
 * ce qui signale a Google que le contenu bouge (bon pour le crawl budget).
 *
 * 2026-10-04 (referencement, Mika : "Je veux que tu augmentes le
 * referencement aussi, c'est important.") : lastmod n'est plus la date du
 * build pour toutes les adresses (Google ignore un lastmod qui change a
 * chaque fois) mais la date du dernier commit des fichiers qui font la page
 * (ses donnees, ses textes, le script qui l'ecrit), ou aujourd'hui s'ils
 * sont modifies sans commit. L'accueil et /shows/ bougent aussi quand une
 * date passe (elle quitte "Upcoming"). GitHub Actions clone tout
 * l'historique pour cela (pages.yml, fetch-depth 0, sans les fichiers).
 * Images : la pochette de chaque morceau, les photos de presse.
 * /radar/ prend sa barre finale (sa page statique existe, scripts/prerender-seo.mjs).
 */

import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, SITE, readJson, loadDisco, loadGoodies, coverOf } from './seo-shared.mjs';

const TODAY = new Date().toISOString().slice(0, 10);

/* ---------- les fichiers qui font chaque page (lastmod) ---------- */

const KIT = 'docs/presskit-2027/content.mjs';
const DISCO_JSON = 'src/v2/data/discography.json';
const EVENTS = 'public/events.json';
const GOODIES_TS = 'src/data/goodies.ts';
const SOCIALS_TS = 'src/v4/data/socials.ts';
/** Toutes les pages statiques : le script qui les ecrit, ses donnees communes, les titres. */
const GEN = ['scripts/prerender-seo.mjs', 'scripts/seo-shared.mjs', 'src/data/seo-meta.json'];

// Routes reelles du router (src/App.tsx). Les pages admin sont exclues
// volontairement (noindex, contenu prive).
const ROUTES = [
  // Bascule v2 (2026-08) : le site est la one-page + la page Radar.
  // /v1 (archive) et les admins restent hors sitemap.
  { path: '/', changefreq: 'weekly', priority: '1.0', sources: [...GEN, 'index.html', KIT, EVENTS, DISCO_JSON, SOCIALS_TS], dated: true },
  { path: '/radar/', changefreq: 'weekly', priority: '0.8', sources: [...GEN, 'public/releases.json', 'public/following.json'] },
  { path: '/techrider/', changefreq: 'yearly', priority: '0.7', sources: [...GEN, KIT, 'src/v2/pages/TechRiderPage.tsx', 'public/Tech_Rider_Maudite_Machine_2026-27.pdf'] },
  { path: '/presskit/', changefreq: 'yearly', priority: '0.8', sources: [...GEN, KIT, 'public/Presskit_Maudite_Machine_2027_generic.pdf'] },
  { path: '/press/', changefreq: 'yearly', priority: '0.6', sources: ['public/press/index.html'] },
  // 2026-10-02 : les sections de la machine ont leur adresse (src/v4/state/sectionRoute.ts)
  { path: '/shows/', changefreq: 'weekly', priority: '0.9', sources: [...GEN, KIT, EVENTS, 'public/past-events.json'], dated: true },
  { path: '/tracks/', changefreq: 'monthly', priority: '0.8', sources: [...GEN, KIT, DISCO_JSON, GOODIES_TS] },
  { path: '/mixtapes/', changefreq: 'monthly', priority: '0.7', sources: [...GEN, KIT, 'public/mixes.json', 'src/v2/data/mixtapes.json'] },
  { path: '/contact/', changefreq: 'yearly', priority: '0.7', sources: [...GEN, KIT, SOCIALS_TS] },
  { path: '/goodies/', changefreq: 'monthly', priority: '0.5', sources: [...GEN, GOODIES_TS] },
  { path: '/merch/', changefreq: 'monthly', priority: '0.5', sources: [...GEN, 'public/store.json', 'src/v4/data.ts'] },
  { path: '/studio/', changefreq: 'yearly', priority: '0.5', sources: [...GEN, KIT, 'src/v4/data.ts'] },
  // 2026-10-03 : l'accueil en francais et en espagnol (scripts/prerender-seo.mjs)
  { path: '/fr/', changefreq: 'weekly', priority: '0.9', sources: [...GEN, KIT, EVENTS, DISCO_JSON, SOCIALS_TS], dated: true },
  { path: '/es/', changefreq: 'weekly', priority: '0.8', sources: [...GEN, KIT, EVENTS, DISCO_JSON, SOCIALS_TS], dated: true },
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
    priority: t.category === 'remixes' ? '0.4' : '0.6',
    sources: [...GEN, KIT, DISCO_JSON, GOODIES_TS],
    images: cover ? [`${SITE}${cover.downloadSrc}`] : [],
  });
}

/* ---------- images ---------- */

const homeRoute = ROUTES.find((r) => r.path === '/');
homeRoute.images = [`${SITE}/images/og-image.jpg`];
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

/* ---------- lastmod ---------- */

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
let gitOk = true;
let shallow = false;
try {
  shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
} catch {
  gitOk = false;
}

const lastmodCache = new Map();
/** Date (UTC) du dernier commit de ces fichiers ; aujourd'hui s'ils sont modifies sans commit ou sans git. */
function filesLastmod(paths) {
  const existing = paths.filter((p) => existsSync(join(ROOT, p)));
  const key = existing.join('|');
  if (lastmodCache.has(key)) return lastmodCache.get(key);
  let out = TODAY;
  if (gitOk && existing.length) {
    try {
      const dirty = git(['status', '--porcelain', '--', ...existing]);
      if (!dirty) {
        const ts = Number(git(['log', '-1', '--format=%ct', '--', ...existing]));
        if (Number.isFinite(ts) && ts > 0) out = new Date(ts * 1000).toISOString().slice(0, 10);
      }
    } catch {
      out = TODAY;
    }
  }
  lastmodCache.set(key, out);
  return out;
}

/** Le lendemain de la derniere date passee : ce jour-la, elle a quitte "Upcoming". */
function lastShowChange() {
  const events = readJson(EVENTS, []);
  if (!Array.isArray(events)) return null;
  const past = events.map((e) => e?.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && d < TODAY).sort();
  if (!past.length) return null;
  const next = new Date(`${past[past.length - 1]}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
const SHOW_CHANGE = lastShowChange();

const maxDate = (...ds) => ds.filter(Boolean).sort().pop();
const lastmodOf = (r) => {
  const d = maxDate(filesLastmod(r.sources), r.dated ? SHOW_CHANGE : null);
  return d > TODAY ? TODAY : d;
};

/* ---------- ecriture ---------- */

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const urls = ROUTES.map((r) => {
  const loc = r.path === '/' ? `${SITE}/` : `${SITE}${r.path}`;
  const alt = ALT_PATHS.has(r.path) ? `\n${alternates()}` : '';
  const imgs = (r.images ?? []).map((u) => `\n    <image:image>\n      <image:loc>${xmlEsc(u)}</image:loc>\n    </image:image>`).join('');
  return `  <url>
    <loc>${xmlEsc(loc)}</loc>
    <lastmod>${lastmodOf(r)}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>${alt}${imgs}
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
const note = !gitOk ? ', sans git : lastmod du jour' : shallow ? ', historique git partiel : lastmod approche' : '';
console.log(`✅ sitemap.xml généré (${ROUTES.length} URLs, lastmod par page${note})`);
