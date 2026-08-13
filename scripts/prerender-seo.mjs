/**
 * prerender-seo.mjs — genere un index.html statique par route dans dist/.
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const SITE = 'https://mauditemachine.com';
const OG_IMAGE = `${SITE}/images/og-image.jpg`;

// Source unique partagee avec src/lib/seo.ts (pas de divergence possible)
const SEO_META = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'seo-meta.json'), 'utf8'),
);

// Le HTML statique est genere en anglais : c'est la langue de fallback du
// site et celle des crawlers sociaux (qui n'envoient pas de Accept-Language
// exploitable). Le client bascule ensuite en FR/ES via useSEO() au mount.
const STATIC_LANG = 'en';

// '/' est deja gere par dist/index.html, on prerender les 6 autres routes
const ROUTES = []; // bascule v2 : les URLs v1 redirigent cote client, plus de prerender

const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) {
  console.error('❌ dist/index.html introuvable — lancer vite build avant');
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

let count = 0;
for (const route of ROUTES) {
  const meta = SEO_META[STATIC_LANG][route];
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

  const dir = join(DIST, route.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

console.log(`✅ prerender SEO : ${count} pages statiques générées (meta ${STATIC_LANG})`);
