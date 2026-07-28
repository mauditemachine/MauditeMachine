/**
 * generate-sitemap.mjs — genere public/sitemap.xml au build.
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
  { path: '/',          changefreq: 'weekly',  priority: '1.0' },
  { path: '/shows',     changefreq: 'weekly',  priority: '0.9' },
  { path: '/radar',     changefreq: 'weekly',  priority: '0.9' },
  { path: '/about',     changefreq: 'monthly', priority: '0.8' },
  { path: '/merch',     changefreq: 'weekly',  priority: '0.8' },
  { path: '/techrider', changefreq: 'monthly', priority: '0.7' },
  { path: '/goodies',   changefreq: 'monthly', priority: '0.6' },
  { path: '/contact',   changefreq: 'monthly', priority: '0.6' },
];

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
  const lastmod = r.path === '/shows' ? showsLastmod() : today;

  // hreflang : le site detecte navigator.language, ?lang= est l'override
  const alternates = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`,
    ...LANGS.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${loc}?lang=${l}"/>`,
    ),
  ].join('\n');

  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
${alternates}
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
