#!/usr/bin/env node
/**
 * seo-backlinks-footprints.js : genere des requetes de recherche
 * ("footprints") pour trouver les webzines, blogs, radios et labels
 * Dark Disco / Indie Dance qui acceptent les soumissions d'artistes
 * (brief de Mika du 2026-10-10, B6).
 *
 * REGLE : requetes a ouvrir a la main, pas de scraping automatise.
 * Le script ne contacte aucun site (aucun fetch, aucune requete reseau,
 * aucune dependance externe) : il ecrit les requetes et leurs URL de
 * recherche Google et DuckDuckGo dans un CSV, et Mika les ouvre une par
 * une dans son navigateur, en espacant les recherches.
 *
 * Usage :
 *   node scripts/seo-backlinks-footprints.js
 *   node scripts/seo-backlinks-footprints.js --lang fr --limit 20
 *   node scripts/seo-backlinks-footprints.js --help
 *
 *   --lang fr|en|es|all  langue des intentions (par defaut : all)
 *   --limit N            N requetes au plus, reparties entre les langues et
 *                        les categories (par defaut : toutes)
 *
 * Sortie : scripts/output/footprints.csv (UTF-8, colonnes requete,
 * url_google, url_duckduckgo, categorie ; dossier ignore par git) et un
 * resume dans la console (requetes par categorie et par langue).
 *
 * Les requetes croisent les genres, les intentions (FR, EN, ES), les types
 * de media et les operateurs : intitle:, inurl:submit, inurl:contact,
 * "powered by wordpress", site:soundcloud.com, site:mixcloud.com,
 * -site:facebook.com et l'annee en cours (calculee au lancement). La
 * colonne categorie vaut langue/categorie (ex. fr/intitle), pour filtrer
 * dans un tableur. Pas de doublons : une requete deja vue (casse et espaces
 * ignores) n'est pas reecrite.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'scripts', 'output');
const OUT_FILE = path.join(OUT_DIR, 'footprints.csv');

/** L'annee en cours, recalculee a chaque lancement. */
const YEAR = new Date().getFullYear();

/* ---------------- les listes de termes ---------------- */

/** Les genres, du plus proche du son de Maudite Machine au plus large. */
const GENRES = ['dark disco', 'indie dance', 'italo disco', 'new beat', 'cosmic disco'];

/**
 * Par langue : les intentions (ce qu'ecrit une page qui accepte la musique
 * des artistes) et les types de media. Les trois premieres intentions
 * forment aussi le groupe OR des requetes par type de media.
 */
const LANGS = {
  fr: {
    intents: [
      'envoyer sa musique',
      'envoyez-nous votre musique',
      'soumettre un morceau',
      'soumettre sa musique',
      'envoyer une démo',
      'proposer un mix',
    ],
    types: ['blog', 'webzine', 'magazine', 'radio', 'label'],
  },
  en: {
    intents: ['submit music', 'submissions', 'send us your music', 'demo', 'premiere', 'guest mix', 'podcast'],
    types: ['blog', 'webzine', 'magazine', 'radio', 'label'],
  },
  es: {
    intents: ['envíanos tu música', 'envía tu música', 'enviar demo', 'envío de demos', 'enviar música', 'estreno'],
    types: ['blog', 'webzine', 'revista', 'radio', 'sello'],
  },
};
const LANG_CODES = Object.keys(LANGS);

/* ---------------- les categories de requetes ---------------- */

const NO_FB = '-site:facebook.com';
const quote = (s) => `"${s}"`;
const orGroup = (terms) => `(${terms.map(quote).join(' OR ')})`;

/**
 * Croise une liste avec les genres : la liste en boucle externe, les genres
 * en boucle interne, pour que les premieres requetes de chaque categorie
 * couvrent deja dark disco et indie dance (utile avec --limit).
 */
function cross(outer, fn) {
  const out = [];
  for (const o of outer) for (const g of GENRES) out.push(fn(o, g));
  return out;
}

/** Les categories, dans l'ordre du CSV. `build` rend les requetes d'une langue. */
const CATEGORIES = [
  {
    id: 'intention',
    build: ({ intents }) => cross(intents, (i, g) => `${quote(g)} ${quote(i)} ${NO_FB}`),
  },
  {
    id: 'type-media',
    build: ({ intents, types }) =>
      cross(types, (t, g) => `${quote(g)} ${t} ${orGroup(intents.slice(0, 3))} ${NO_FB}`),
  },
  {
    id: 'intitle',
    build: ({ intents }) => cross(intents, (i, g) => `intitle:${quote(i)} ${quote(g)} ${NO_FB}`),
  },
  {
    id: 'inurl-submit',
    build: ({ intents, types }) =>
      cross(types, (t, g) => `inurl:submit ${quote(g)} ${t} ${orGroup(intents.slice(0, 3))} ${NO_FB}`),
  },
  {
    id: 'inurl-contact',
    build: ({ intents }) => cross(intents, (i, g) => `inurl:contact ${quote(g)} ${quote(i)} ${NO_FB}`),
  },
  {
    id: 'wordpress',
    build: ({ intents }) => cross(intents, (i, g) => `"powered by wordpress" ${quote(g)} ${quote(i)} ${NO_FB}`),
  },
  {
    id: 'soundcloud',
    build: ({ intents }) => cross(intents, (i, g) => `site:soundcloud.com ${quote(g)} ${quote(i)}`),
  },
  {
    id: 'mixcloud',
    build: ({ intents }) => cross(intents, (i, g) => `site:mixcloud.com ${quote(g)} ${quote(i)}`),
  },
  {
    id: 'annee',
    build: ({ intents }) => cross(intents, (i, g) => `${quote(g)} ${quote(i)} ${YEAR} ${NO_FB}`),
  },
];

/* ---------------- arguments ---------------- */

const USAGE = `Usage : node scripts/seo-backlinks-footprints.js [--lang fr|en|es|all] [--limit N]

  --lang fr|en|es|all  langue des intentions (par defaut : all)
  --limit N            N requetes au plus (entier positif), reparties entre
                       les langues et les categories (par defaut : toutes)
  --help, -h           cette aide

Sortie : scripts/output/footprints.csv
Regle : requetes a ouvrir a la main, pas de scraping automatise.`;

function fail(msg) {
  console.error(`${msg}\n\n${USAGE}`);
  process.exit(1);
}

function parseArgs(argv) {
  const o = { lang: 'all', limit: null };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    const eq = a.indexOf('=');
    const name = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a;
    let value = a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : undefined;
    if (name !== '--lang' && name !== '--limit') fail(`Option inconnue : ${a}`);
    if (seen.has(name)) fail(`${name} donne deux fois`);
    seen.add(name);
    if (value === undefined) {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) fail(`${name} attend une valeur`);
      value = argv[(i += 1)];
    }
    value = value.trim();
    if (name === '--lang') {
      const v = value.toLowerCase();
      if (v !== 'all' && !LANG_CODES.includes(v)) fail(`Langue inconnue : "${value}" (fr, en, es ou all)`);
      o.lang = v;
    } else {
      const n = /^\d+$/.test(value) ? Number(value) : NaN;
      if (!Number.isSafeInteger(n) || n < 1) fail(`--limit attend un entier positif, pas "${value}"`);
      o.limit = n;
    }
  }
  return o;
}

/* ---------------- generation ---------------- */

/** Entrelace des listes : un element de chaque, a tour de role. */
function roundRobin(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i += 1) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

/**
 * Toutes les requetes des langues demandees, rangees par langue puis par
 * categorie, sans doublons. `rank` garde l'ordre de generation (l'ordre du
 * CSV, meme apres la selection de --limit).
 */
function generate(langs) {
  const seen = new Set();
  let dupes = 0;
  let rank = 0;
  const perLang = langs.map((code) =>
    CATEGORIES.map((cat) => {
      const rows = [];
      for (const raw of cat.build(LANGS[code])) {
        const query = raw.replace(/\s+/g, ' ').trim();
        const key = query.normalize('NFC').toLowerCase();
        if (seen.has(key)) {
          dupes += 1;
          continue;
        }
        seen.add(key);
        rows.push({ rank: rank++, query, lang: code, cat: cat.id });
      }
      return rows;
    }),
  );
  return { perLang, dupes };
}

/* ---------------- CSV ---------------- */

const googleUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const duckUrl = (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

/** Une cellule CSV : entre guillemets (doubles) si elle contient " , ou un saut de ligne. */
function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const lines = [['requete', 'url_google', 'url_duckduckgo', 'categorie']];
  for (const r of rows) lines.push([r.query, googleUrl(r.query), duckUrl(r.query), `${r.lang}/${r.cat}`]);
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\n') + '\n';
}

/* ---------------- resume console ---------------- */

function summary(rows, langs) {
  const count = (cat, lang) => rows.filter((r) => (!cat || r.cat === cat) && (!lang || r.lang === lang)).length;
  const w = Math.max('categorie'.length, ...CATEGORIES.map((c) => c.id.length));
  const cols = [...langs, 'total'];
  const line = (label, values) => `  ${label.padEnd(w)}  ${values.map((v) => String(v).padStart(5)).join('  ')}`;
  const out = [line('categorie', cols)];
  for (const c of CATEGORIES) out.push(line(c.id, [...langs.map((l) => count(c.id, l)), count(c.id)]));
  out.push(line('total', [...langs.map((l) => count(null, l)), rows.length]));
  return out.join('\n');
}

/* ---------------- main ---------------- */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const langs = opts.lang === 'all' ? LANG_CODES : [opts.lang];

  const { perLang, dupes } = generate(langs);
  // --limit : un tour par langue, et dans chaque langue un tour par
  // categorie, pour que la selection reste variee ; puis l'ordre du CSV.
  const all = roundRobin(perLang.map(roundRobin));
  const rows = (opts.limit ? all.slice(0, opts.limit) : all).sort((a, b) => a.rank - b.rank);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, toCsv(rows), 'utf8');

  const limitNote = opts.limit
    ? `limite : ${opts.limit}${opts.limit < all.length ? `, sur ${all.length} generees` : ''}`
    : 'limite : aucune';
  console.log(`Footprints backlinks : ${rows.length} requetes (langue : ${opts.lang}, ${limitNote})`);
  console.log(`Doublons ecartes : ${dupes}\n`);
  console.log(summary(rows, langs));
  console.log(`\nCSV : ${path.relative(ROOT, OUT_FILE)}`);
  console.log('Regle : requetes a ouvrir a la main, pas de scraping automatise.');
  console.log('Ouvre-les une par une, en espacant les recherches (Google bloque les rafales).');
}

main();
