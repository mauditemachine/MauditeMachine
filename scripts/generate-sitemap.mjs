/**
 * generate-sitemap.mjs : genere public/sitemap.xml au build.
 *
 * Lance automatiquement via `npm run build` (prebuild). Garde le sitemap
 * synchronise avec les routes reelles + met a jour lastmod a chaque deploy,
 * ce qui signale a Google que le contenu bouge (bon pour le crawl budget).
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://mauditemachine.com';

// Routes reelles du router (src/App.tsx). Les pages admin sont exclues
// volontairement (noindex, contenu prive).
const ROUTES = [
  // Bascule v2 (2026-08) : le site est la one-page + la page Radar.
  // /v1 (archive) et les admins restent hors sitemap.
  { path: '/',      changefreq: 'weekly', priority: '1.0' },
  { path: '/radar', changefreq: 'weekly', priority: '0.8' },
  { path: '/techrider/', changefreq: 'yearly', priority: '0.7' },
  { path: '/presskit/', changefreq: 'yearly', priority: '0.8' },
  { path: '/press/', changefreq: 'yearly', priority: '0.6' },
  // 2026-10-02 : les sections de la machine ont leur adresse (src/v4/state/sectionRoute.ts)
  { path: '/shows/', changefreq: 'weekly', priority: '0.9' },
  { path: '/tracks/', changefreq: 'monthly', priority: '0.8' },
  { path: '/mixtapes/', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact/', changefreq: 'yearly', priority: '0.7' },
  { path: '/goodies/', changefreq: 'monthly', priority: '0.5' },
  { path: '/merch/', changefreq: 'monthly', priority: '0.5' },
  { path: '/studio/', changefreq: 'yearly', priority: '0.5' },
  // 2026-10-03 : l'accueil en francais et en espagnol (scripts/prerender-seo.mjs)
  { path: '/fr/', changefreq: 'weekly', priority: '0.9' },
  { path: '/es/', changefreq: 'weekly', priority: '0.8' },
];

/** L'accueil et ses deux versions : chacune annonce les trois (hreflang), x-default l'anglais. */
const HOME_ALTERNATES = { en: `${SITE}/`, fr: `${SITE}/fr/`, es: `${SITE}/es/` };
const ALT_PATHS = new Set(['/', '/fr/', '/es/']);
const alternates = () =>
  [
    ...Object.entries(HOME_ALTERNATES).map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${HOME_ALTERNATES.en}" />`,
  ].join('\n');

/** Une page par morceau (2026-10-03), la meme liste que le prerender. */
function trackRoutes() {
  try {
    const tracks = JSON.parse(readFileSync(join(ROOT, 'src', 'v2', 'data', 'discography.json'), 'utf8')).tracks ?? [];
    return tracks
      .filter((t) => /^[a-z0-9-]+$/.test(t.id))
      .map((t) => ({ path: `/tracks/${t.id}/`, changefreq: 'yearly', priority: t.category === 'remixes' ? '0.4' : '0.6' }));
  } catch {
    return [];
  }
}
ROUTES.push(...trackRoutes());

const LANGS = ['en', 'fr', 'es'];
const today = new Date().toISOString().slice(0, 10);

/**
 * Si events.json contient une date future, la page /shows est "fraiche".
 * On remonte son lastmod pour inciter Google a la recrawler.
 */
function showsLastmod() {
  try {
    const p = join(ROOT, 'public', 'events.json');
    if (!existsSync(p)) return today;
    const events = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(events) || events.length === 0) return today;
    // lastmod = aujourd'hui (le fichier est regenere a chaque deploy)
    return today;
  } catch {
    return today;
  }
}

const urls = ROUTES.map((r) => {
  const loc = r.path === '/' ? `${SITE}/` : `${SITE}${r.path}`;
  const lastmod = r.path === '/shows/' ? showsLastmod() : today;

  const alt = ALT_PATHS.has(r.path) ? `\n${alternates()}` : '';
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>${alt}
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

writeFileSync(join(ROOT, 'public', 'sitemap.xml'), xml, 'utf8');
console.log(`✅ sitemap.xml généré (${ROUTES.length} URLs, lastmod ${today})`);
