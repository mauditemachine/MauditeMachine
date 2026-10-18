#!/usr/bin/env node
/**
 * Les samples que Mika joue vraiment, dans le choix de son du MM-RYTM
 * (2026-10-18, Mika : "je voudrais que tu fasses un selecteur de samples
 * [User Library/Samples/shots] ; la-dedans il y a des dossiers de samples et
 * je voudrais que tu analyses les fichiers qui sont le plus utilises dans mes
 * projets Ableton Live et que tu mettes un selecteur de sample d'environ 20
 * samples dans chacune des voix, en rapport avec les dossiers bien entendu").
 *
 * Ca tourne sur le Mac de Mika (ses sets et ses samples n'ont rien a faire
 * dans le depot), sans dependance, Node 18 ou plus :
 *   1. lit tous les Live sets (*.als, hors dossiers Backup) des dossiers de
 *      projets : un .als est du XML gzippe ; chaque <SampleRef> dit quel
 *      fichier audio un clip, un Simpler ou un pad de Drum Rack joue ;
 *   2. retrouve chaque reference dans le dossier shots : par chemin exact
 *      quand il y pointe, sinon par nom de fichier (le dossier parent cite
 *      dans la reference, puis la taille, departagent les homonymes) ;
 *   3. classe le dossier shots par famille de voix (bd sd ch oh cp tom ht cy)
 *      d'apres les mots du sous-dossier le plus proche, sinon du nom de
 *      fichier (--map force un dossier ou un mot) ;
 *   4. par famille, garde les ~20 samples joues dans le plus de PROJETS
 *      distincts (le projet : le dossier du .als, ses versions comptent une
 *      fois), puis le plus de references, puis l'ordre naturel des noms ;
 *      une famille qui en manque est completee par les jamais utilises de
 *      ses dossiers (marques "unused" dans le plan) ;
 *   5. les copie dans un dossier de transit (os.tmpdir()/mm-rytm-top-<date>/
 *      <famille>/01 Nom.wav : le numero donne l'ordre des crans du potard,
 *      l'import le retire de la plaque) et, avec --import, lance
 *      scripts/import-rytm-samples.mjs dessus (--replace, seulement les
 *      familles dont le plan n'est pas vide).
 * Rien n'est ecrit dans shots ni dans les projets. Sans --import, le plan,
 * le dossier de transit et le rapport JSON suffisent a relire avant de se
 * decider ; --dry n'ecrit rien du tout (le rapport seulement si --report).
 *
 *   npm run samples:ableton -- --dry        le plan, rien d'ecrit
 *   npm run samples:ableton                 plan + dossier de transit + rapport
 *   npm run samples:ableton -- --import     ... et l'import dans public/samples/rytm
 *
 * Les familles (2026-10-18, une par voix) : bd sd ch oh cp tom ht cy. Le
 * vocabulaire qui range un dossier ou un nom : kick bassdrum bd ; snare sd ;
 * closed closedhat hat hats hihat hh ch (un simple hat est ch sauf si "open"
 * est la) ; open openhat oh ; clap handclap cp ; tom toms (sauf hi / high :
 * ht) ; hitom perc percussion conga bongo shaker rim rimshot cowbell ht ;
 * cymbal cym crash ride cy. Le dossier le plus proche decide, le nom affine
 * les deux cas ou une voix se cache dans l'autre (Hats/Open Hat.wav : oh ;
 * Toms/Hi Tom.wav : ht). Le reste est INCONNU : --map "Dossier=famille".
 *
 * Les formes d'une reference dans un .als :
 * - Live 11/12 : <FileRef><Path Value="/abs/x.wav"/><RelativePath
 *   Value="../x.wav"/>... ;
 * - Live 9/10 : <RelativePath><RelativePathElement Dir=".."/>...</RelativePath>
 *   (un Dir vide : remonter d'un cran), <Name Value="x.wav"/>, <Data> avec le
 *   chemin absolu en hexadecimal (UTF-16LE dans les vieux sets, UTF-8 dans
 *   l'alias Mac : on cherche le nom dans les deux) et <SearchHint><PathHint>
 *   avec les dossiers du chemin absolu.
 * Les entites XML des attributs (&amp; &apos; &quot;) sont decodees.
 *
 * Garde-fous : lecture seule sur shots et les projets ; le dossier de transit
 * est hors du depot ; le plan s'affiche avant tout import ; une famille au
 * plan vide n'est pas importee ; un fichier iCloud pas telecharge (.x.icloud
 * ou sans bloc sur le disque) est MISSING : a telecharger dans le Finder
 * avant (l'import le verifie aussi) ; --import s'arrete tant qu'il en manque.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_SCRIPT = path.join(ROOT, 'scripts/import-rytm-samples.mjs');
const HOME = os.homedir();
const ICLOUD = path.join(HOME, 'Library/Mobile Documents/com~apple~CloudDocs');
const DEFAULT_SHOTS = path.join(ICLOUD, 'User Library/Samples/shots');
const DEFAULT_PROJECTS = ['Music/Ableton', 'Music', 'Documents', 'Desktop'].map((d) => path.join(HOME, d)).concat(ICLOUD);
/** Les dossiers qu'on ne fouille pas pour les sets (sans tenir compte des majuscules), les caches non plus. */
const SKIP_DIRS = new Set(['backup', 'samples', 'ableton project info', 'node_modules', '.git', 'library', '.trash']);
const MAX_DEPTH = 8;
const AUDIO = /\.(wav|aiff?|mp3|flac|m4a)$/i;
/** Au-dela, un set decompresse ne tient plus dans une chaine : saute et signale. */
const MAX_XML = 480 * 1024 * 1024;
const MAX_STAGED_NAME = 60;
const PROGRESS_EVERY = 25;

const FAMILIES = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
const TITLE = {
  bd: 'BD (kicks)',
  sd: 'SD (snares)',
  ch: 'CH (charleys fermes)',
  oh: 'OH (charleys ouverts)',
  cp: 'CP (claps)',
  tom: 'TOM',
  ht: 'HT (toms aigus, percs)',
  cy: 'CY (cymbales)',
};

/** Le vocabulaire d'une famille (mots d'un dossier ou d'un nom, en minuscules, colles ou pas). */
const WORDS = {
  bd: ['kick', 'kicks', 'kickdrum', 'kickdrums', 'bassdrum', 'bassdrums', 'bd'],
  sd: ['snare', 'snares', 'snaredrum', 'snaredrums', 'sd'],
  ch: ['closed', 'closedhat', 'closedhats', 'chh', 'ch', 'hat', 'hats', 'hihat', 'hihats', 'hh'],
  oh: ['open', 'openhat', 'openhats', 'ohh', 'oh'],
  cp: ['clap', 'claps', 'handclap', 'handclaps', 'cp'],
  tom: ['tom', 'toms'],
  ht: [
    'hitom', 'hitoms', 'hightom', 'hightoms', 'perc', 'percs', 'percussion', 'percussions', 'conga', 'congas', 'bongo', 'bongos',
    'shaker', 'shakers', 'rim', 'rims', 'rimshot', 'rimshots', 'cowbell', 'cowbells', 'ht',
  ],
  cy: ['cymbal', 'cymbals', 'cym', 'crash', 'crashes', 'ride', 'rides', 'cy'],
};
const FAMILY_WORD = new RegExp(`\\b(${FAMILIES.flatMap((f) => WORDS[f]).join('|')})\\b`, 'gi');

/* ---------------- arguments ---------------- */

const USAGE = `Usage : npm run samples:ableton -- [options]

  --shots <dossier>        le dossier des samples (defaut : ${DEFAULT_SHOTS})
  --projects <dossier>     un dossier de projets Ableton, repetable (defaut : ~/Music/Ableton, ~/Music,
                           ~/Documents, ~/Desktop et iCloud Drive ; ${MAX_DEPTH} niveaux au plus, sans les dossiers
                           Backup, Samples, Ableton Project Info, node_modules, .git, Library, .Trash ni caches)
  --per <n>                samples par famille (defaut : 20)
  --min-projects <n>       un sample compte des n projets distincts (defaut : 1)
  --families bd,sd,...     seulement ces familles (bd sd ch oh cp tom ht cy ; defaut : toutes)
  --map "Dossier=famille"  force un sous-dossier de shots, ou un mot d'un nom de fichier, dans une famille
                           (repetable ; famille : bd sd ch oh cp tom ht cy, ou skip pour l'ecarter)
  --report <fichier.json>  le rapport (defaut : ./ableton-samples-report.json dans le dossier courant)
  --dry                    le plan seulement : rien d'ecrit (le rapport seulement si --report est donne)
  --import                 apres le plan et le dossier de transit, lance l'import dans public/samples/rytm
                           (node scripts/import-rytm-samples.mjs <transit> --replace --families <celles du plan>)
  --help                   cette aide

Sans --dry ni --import : le plan, le dossier de transit (${path.join(os.tmpdir(), 'mm-rytm-top-<date>')}) et le rapport.`;

function fail(msg, code = 1) {
  console.error(`${msg}\n\n${USAGE}`);
  process.exit(code);
}

const expand = (p) => path.resolve(p.trim().replace(/^~(?=$|\/)/, HOME));

/** Le code d'une famille depuis un nom (bd, Kicks, hat...), 'skip' pour ecarter, ou null. */
function familyCode(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (w === 'skip' || w === 'none' || w === 'ignore') return 'skip';
  if (FAMILIES.includes(w)) return w;
  for (const f of FAMILIES) if (WORDS[f].includes(w)) return f;
  return null;
}

function parseArgs(argv) {
  const o = { shots: DEFAULT_SHOTS, projects: [], per: 20, minProjects: 1, families: null, map: [], report: null, dry: false, import: false };
  const int = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) fail(`${name} attend un entier positif (recu : ${v})`);
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    let a = argv[i];
    let inline = null;
    const eq = a.startsWith('--') ? a.indexOf('=') : -1;
    if (eq > 0) {
      inline = a.slice(eq + 1);
      a = a.slice(0, eq);
    }
    const value = () => {
      if (inline !== null) return inline;
      i += 1;
      if (i >= argv.length) fail(`${a} attend une valeur`);
      return argv[i];
    };
    switch (a) {
      case '--shots':
        o.shots = expand(value());
        break;
      case '--projects':
      case '--project':
        o.projects.push(expand(value()));
        break;
      case '--per':
        o.per = int(value(), a);
        break;
      case '--min-projects':
      case '--min':
        o.minProjects = int(value(), a);
        break;
      case '--families':
      case '--family':
        o.families = value();
        break;
      case '--map':
        o.map.push(value());
        break;
      case '--report':
        o.report = expand(value());
        break;
      case '--dry':
      case '--dry-run':
      case '-n':
        o.dry = true;
        break;
      case '--import':
        o.import = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        fail(`Option inconnue : ${a}`);
    }
  }
  if (o.dry && o.import) fail('--dry et --import ensemble : choisis (le plan seul, ou le plan puis l\'import)');
  if (o.families !== null) {
    const list = o.families.split(/[\s,;+]+/).filter(Boolean);
    const codes = list.map((w) => [w, familyCode(w)]);
    const bad = codes.filter(([, c]) => !c || c === 'skip').map(([w]) => w);
    if (bad.length > 0 || list.length === 0) fail(`Famille inconnue : ${bad.join(', ') || '(vide)'} (familles : ${FAMILIES.join(' ')})`);
    o.families = [...new Set(codes.map(([, c]) => c))];
  }
  // --map "Hats fermes=ch" : le nom d'un dossier (entier) ou un mot d'un nom de fichier
  const map = new Map();
  for (const m of o.map) {
    const k = m.indexOf('=');
    if (k < 1) fail(`--map attend "Dossier=famille" (recu : ${m})`);
    const fam = familyCode(m.slice(k + 1));
    if (!fam) fail(`--map ${m} : famille inconnue (${FAMILIES.join(' ')}, ou skip)`);
    map.set(m.slice(0, k).trim().normalize('NFC').toLowerCase(), fam);
  }
  o.map = map;
  // Le dossier d'ou npm run a ete lance (INIT_CWD), sinon le courant
  o.reportGiven = o.report !== null;
  if (!o.report) o.report = path.resolve(process.env.INIT_CWD || process.cwd(), 'ableton-samples-report.json');
  return o;
}

/* ---------------- outils ---------------- */

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
const norm = (s) => s.normalize('NFC').toLowerCase();
const inside = (a, b) => a === b || a.startsWith(b + path.sep);
const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Les entites XML d'un attribut : &amp; &apos; &quot; &lt; &gt; et les numeriques. */
function unxml(s) {
  return s.replace(/&(amp|apos|quot|lt|gt|#[xX][0-9a-fA-F]+|#\d+);/g, (m, e) => {
    const named = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };
    if (named[e]) return named[e];
    const hex = e[1] === 'x' || e[1] === 'X';
    const code = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** Les mots d'un nom : sans accents, camelCase et chiffres decolles, en minuscules, plus les paires collees (hi hat : hihat). */
function tokens(s) {
  const t = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const pairs = t.slice(1).map((w, i) => t[i] + w);
  return [...t, ...pairs];
}

/**
 * Un fichier sans bloc sur le disque est-il un fichier iCloud pas encore
 * telecharge ? Sur le Mac le drapeau SF_DATALESS le dit (stat -f %Xf) ;
 * ailleurs, ou si stat ne repond pas, l'absence de bloc suffit.
 */
function dataless(full) {
  if (process.platform !== 'darwin') return true;
  try {
    const flags = parseInt(execFileSync('stat', ['-f', '%Xf', full], { encoding: 'utf8' }).trim(), 16);
    return Number.isFinite(flags) ? (flags & 0x40000000) !== 0 : true;
  } catch {
    return true;
  }
}

/* ---------------- la famille d'un fichier de shots ---------------- */

/**
 * La famille d'une liste de mots : --map d'abord, puis le vocabulaire. Un
 * hat avec "open" est oh ; un tom avec "hi" / "high" est ht. Deux familles
 * dans les mots : ambigu (null, avec la liste).
 */
function familyOfWords(words, map) {
  for (const w of words) if (map.has(w)) return { fam: map.get(w), via: 'map' };
  const hit = new Set(FAMILIES.filter((f) => WORDS[f].some((w) => words.includes(w))));
  if (hit.has('ch') && (hit.has('oh') || words.includes('open'))) {
    hit.delete('ch');
    hit.add('oh');
  }
  if (hit.has('tom') && (words.includes('hi') || words.includes('high') || hit.has('ht'))) {
    hit.delete('tom');
    hit.add('ht');
  }
  if (hit.size === 1) return { fam: [...hit][0] };
  if (hit.size > 1) return { fam: null, ambiguous: [...hit] };
  return null;
}

/**
 * La famille d'un fichier. Ce que --map force passe d'abord (un mot du nom
 * de fichier, puis le nom entier d'un dossier, du plus proche au plus
 * lointain) ; ensuite le vocabulaire : le dossier le plus proche qui dit
 * quelque chose, sinon le nom du fichier (le mot apres le tiret d'abord :
 * AT Tom Trago - Kick F est un kick). Un --map "...=skip" ecarte le fichier
 * (skip: true).
 */
function classify(file, map) {
  const pick = (r, via) => (r?.fam === 'skip' ? { fam: null, skip: true, via } : r?.fam ? { fam: r.fam, via } : null);
  const dirs = file.rel.split(path.sep).slice(0, -1);
  const base = file.name.replace(/\.[^.]+$/, '');
  const own = tokens(base);
  if (map.size > 0) {
    const word = own.find((w) => map.has(w));
    if (word) return pick({ fam: map.get(word) }, `map (mot ${word})`);
    for (const d of [...dirs].reverse()) {
      const forced = map.get(norm(d.trim()));
      if (forced) return pick({ fam: forced }, `map ${d}`);
    }
  }
  for (const d of [...dirs].reverse()) {
    const hit = pick(familyOfWords(tokens(d), map), `dossier ${d}`);
    if (!hit) continue;
    // Le dossier range les hats et les toms en gros, le nom affine : "Open Hat" dans Hats est oh, "Hi Tom" dans Toms est ht
    if (hit.fam === 'ch' && own.some((w) => WORDS.oh.includes(w))) return { fam: 'oh', via: `${hit.via} + nom (open)` };
    if (hit.fam === 'tom' && own.some((w) => w === 'hi' || w === 'high' || WORDS.ht.includes(w))) return { fam: 'ht', via: `${hit.via} + nom (hi)` };
    return hit;
  }
  const parts = base.split(/\s+-\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim();
    const hit = pick(familyOfWords(tokens(last), map), `nom (${last})`);
    if (hit) return hit;
  }
  const r = familyOfWords(tokens(base), map);
  const hit = pick(r, r?.via === 'map' ? 'map (mot du nom)' : 'nom');
  if (hit) return hit;
  if (r?.ambiguous) return { fam: null, why: `plusieurs familles dans le nom (${r.ambiguous.join(', ')})` };
  return { fam: null, why: 'aucun dossier ni mot de famille connu' };
}

/* ---------------- le dossier shots ---------------- */

/** Tous les fichiers audio sous shots, avec leur etat iCloud. */
async function walkShots(dir, rel, depth, acc) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    acc.unreadable.push(`${rel || '.'} (${e.code ?? e.message})`);
    return acc;
  }
  for (const e of entries) {
    const name = e.name.normalize('NFC');
    const full = path.join(dir, e.name);
    const r = rel ? path.join(rel, name) : name;
    // iCloud, ancien style : .Nom.wav.icloud a la place du fichier pas encore telecharge
    if (name.startsWith('.') && name.endsWith('.icloud')) {
      const real = name.slice(1, -'.icloud'.length);
      if (AUDIO.test(real)) acc.audio.push({ full: path.join(dir, real), rel: rel ? path.join(rel, real) : real, name: real, size: 0, placeholder: 'icloud' });
      continue;
    }
    if (name.startsWith('.') || name === '__MACOSX') continue;
    let isFile = e.isFile();
    let isDirectory = e.isDirectory();
    if (e.isSymbolicLink()) {
      const st = await stat(full).catch(() => null);
      isFile = Boolean(st?.isFile());
      isDirectory = false;
    }
    if (isDirectory) {
      if (depth < MAX_DEPTH) await walkShots(full, r, depth + 1, acc);
      else acc.tooDeep.push(r);
    } else if (isFile && AUDIO.test(name)) {
      const st = await stat(full).catch(() => null);
      if (!st) {
        acc.unreadable.push(r);
        continue;
      }
      // iCloud, nouveau style : la taille est la mais aucun bloc sur le disque
      const placeholder = st.size > 0 && st.blocks === 0 && dataless(full) ? 'icloud' : null;
      acc.audio.push({ full, rel: r, name, size: st.size, placeholder });
    }
  }
  return acc;
}

/** L'index de shots : par chemin relatif, par nom de fichier (homonymes groupes). */
function indexShots(files) {
  const byRel = new Map();
  const byBase = new Map();
  for (const f of files) {
    byRel.set(norm(f.rel), f);
    const k = norm(f.name);
    byBase.set(k, [...(byBase.get(k) ?? []), f]);
  }
  return { byRel, byBase };
}

/* ---------------- les Live sets ---------------- */

/** Tous les .als sous un dossier de projets, hors Backup et dossiers ecartes ; les .als iCloud pas telecharges comptes a part. */
async function walkSets(dir, depth, acc) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    acc.unreadable.push(`${dir} (${e.code ?? e.message})`);
    return acc;
  }
  for (const e of entries) {
    const name = e.name.normalize('NFC');
    const full = path.join(dir, e.name);
    if (name.startsWith('.') && name.endsWith('.icloud')) {
      if (/\.als\.icloud$/i.test(name)) acc.icloud.push(full);
      continue;
    }
    if (name.startsWith('.') || e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      const low = name.toLowerCase();
      if (SKIP_DIRS.has(low)) {
        if (low === 'backup') acc.backups += 1;
        continue;
      }
      if (depth >= MAX_DEPTH) {
        acc.tooDeep.push(full);
        continue;
      }
      await walkSets(full, depth + 1, acc);
    } else if (e.isFile() && /\.als$/i.test(name) && !acc.seen.has(full)) {
      acc.seen.add(full);
      acc.sets.push(full);
    }
  }
  return acc;
}

const attrOf = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*?\\sValue="([^"]*)"`));
  return m ? unxml(m[1]) : null;
};
const dirsOf = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? [...m[1].matchAll(/<RelativePathElement\b[^>]*?\sDir="([^"]*)"/g)].map((x) => unxml(x[1])) : null;
};
const baseOf = (p) => p.split(/[\\/]/).pop();
const printable = (c) => c >= 0x20 && c !== 0x7f && !(c >= 0x80 && c <= 0x9f) && c !== 0xfffd;

/**
 * Les chemins qui finissent par le nom du fichier dans le <Data> hexadecimal
 * d'un FileRef Live 9/10 : on lit les octets en UTF-8, Latin-1, UTF-16LE et
 * UTF-16BE (aux deux alignements) et on garde ce qui ressemble a un chemin.
 */
function blobPaths(hex, name) {
  if (!name) return [];
  const buf = Buffer.from(hex.replace(/[^0-9a-fA-F]/g, ''), 'hex');
  if (buf.length < 2) return [];
  const even = buf.subarray(0, buf.length - (buf.length % 2));
  const odd = buf.subarray(1, 1 + ((buf.length - 1) - ((buf.length - 1) % 2)));
  const texts = [
    buf.toString('utf8'),
    buf.toString('latin1'),
    even.toString('utf16le'),
    odd.toString('utf16le'),
    Buffer.from(even).swap16().toString('utf16le'),
    Buffer.from(odd).swap16().toString('utf16le'),
  ];
  const out = new Set();
  const target = name.normalize('NFC');
  for (const raw of texts) {
    const t = raw.normalize('NFC');
    for (let i = t.indexOf(target); i !== -1; i = t.indexOf(target, i + 1)) {
      let s = i;
      while (s > 0 && printable(t.charCodeAt(s - 1))) s -= 1;
      const chunk = t.slice(s, i + target.length);
      const k = chunk.search(/(?:[A-Za-z]:)?[\\/]/);
      if (k !== -1) out.add(chunk.slice(k));
    }
  }
  return [...out];
}

/** Une reference de sample d'un <FileRef> : ses chemins possibles, son nom, sa taille d'origine. */
function fileRef(block, setDir, shotsAncestors) {
  const absV = attrOf(block, 'Path');
  const relV = attrOf(block, 'RelativePath');
  const relEls = relV === null ? dirsOf(block, 'RelativePath') : null;
  const nameV = attrOf(block, 'Name');
  const hint = dirsOf(block, 'PathHint');
  const data = block.match(/<Data>([\s\S]*?)<\/Data>/);
  const sizeV = attrOf(block, 'OriginalFileSize') ?? attrOf(block, 'FileSize');
  const name = nameV || (absV && baseOf(absV)) || (relV && baseOf(relV)) || '';
  if (!name || !AUDIO.test(name)) return null;
  const rel = relV || (relEls ? [...relEls.map((d) => (d === '' ? '..' : d)), name].join('/') : null);
  const cands = [];
  if (absV && /^(?:[A-Za-z]:)?[\\/]/.test(absV)) cands.push(absV);
  if (rel) {
    cands.push(path.resolve(setDir, rel));
    for (const a of shotsAncestors) cands.push(path.resolve(a, rel));
  }
  if (hint && hint.length > 0) cands.push(`/${[...hint, name].join('/')}`);
  if (data) cands.push(...blobPaths(data[1], name));
  const size = sizeV !== null && /^\d+$/.test(sizeV) ? Number(sizeV) : null;
  return { name, cands: [...new Set(cands)], size, shape: absV !== null || relV !== null ? 'live11' : 'live10' };
}

/** Les references d'un set : chaque <SampleRef>, son premier <FileRef> (le fichier joue, pas l'original du pack). */
async function readSet(file, shotsAncestors) {
  const raw = await readFile(file);
  const xml = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw, { maxOutputLength: MAX_XML }) : raw;
  const text = xml.toString('utf8');
  const refs = [];
  let empty = 0;
  for (const m of text.matchAll(/<SampleRef(?:\s[^>]*)?>([\s\S]*?)<\/SampleRef>/g)) {
    const fr = m[1].match(/<FileRef(?:\s[^>]*)?>([\s\S]*?)<\/FileRef>/);
    const ref = fr ? fileRef(fr[1], path.dirname(file), shotsAncestors) : null;
    if (ref) refs.push(ref);
    else empty += 1;
  }
  return { refs, empty };
}

/**
 * Le fichier de shots qu'une reference designe : par chemin exact sous
 * shots, sinon par nom ; plusieurs homonymes : celui dont le dossier parent
 * est cite dans la reference, puis celui de la meme taille, sinon le premier
 * (marque ambigu).
 */
function resolveRef(ref, index, shotsBases) {
  for (const c of ref.cands) {
    const n = norm(path.normalize(c));
    for (const base of shotsBases) {
      if (!n.startsWith(base + path.sep)) continue;
      const hit = index.byRel.get(n.slice(base.length + 1));
      if (hit) return { file: hit, how: 'chemin' };
    }
  }
  const list = index.byBase.get(norm(ref.name));
  if (!list) return { file: null };
  if (list.length === 1) return { file: list[0], how: 'nom', sizeMismatch: ref.size !== null && ref.size !== list[0].size };
  const segs = new Set(ref.cands.flatMap((c) => c.split(/[\\/]/)).map(norm));
  const byParent = list.filter((f) => segs.has(norm(path.basename(path.dirname(f.rel)) || '')));
  if (byParent.length === 1) return { file: byParent[0], how: 'nom + dossier' };
  const pool = byParent.length > 0 ? byParent : list;
  if (ref.size !== null) {
    const bySize = pool.filter((f) => f.size === ref.size);
    if (bySize.length === 1) return { file: bySize[0], how: 'nom + taille' };
  }
  return { file: pool[0], how: 'nom (ambigu)', ambiguous: list.map((f) => f.rel) };
}

/* ---------------- le nom de transit ---------------- */

/**
 * Le nom du fichier dans le dossier de transit : sans son numero en tete ni
 * "AT ", l'extension gardee, 60 caracteres au plus (l'import en tire la
 * plaque). Si sans le numero il ne reste que le mot de la famille (707
 * Snare), le numero est le nom : il reste.
 */
function cleanName(name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length).normalize('NFC').replace(/_/g, ' ');
  let t = base.replace(/^\s*\d+\s*[-._]?\s+/, '').replace(/^AT\s+/i, '');
  if (!/\p{L}/u.test(t.replace(FAMILY_WORD, ' '))) t = base.replace(/^AT\s+/i, '');
  t = t.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sample';
  if (t.length > MAX_STAGED_NAME) t = t.slice(0, MAX_STAGED_NAME).trim();
  return { stem: t, ext: ext.toLowerCase() };
}

/* ---------------- le tout ---------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const started = Date.now();

  if (!(await isDir(opts.shots))) fail(`Dossier shots introuvable : ${opts.shots}\nDonne-le : npm run samples:ableton -- --shots "/chemin/vers/shots"`);
  const shotsReal = await realpath(opts.shots);
  const rootReal = await realpath(ROOT);
  if (inside(shotsReal, rootReal)) fail(`Refuse : ${opts.shots} est dans le depot. Donne le dossier de tes samples sur le Mac.`);
  if (inside(rootReal, shotsReal)) fail(`Refuse : ${opts.shots} contient le depot lui-meme.`);
  const shotsBases = [...new Set([shotsReal, opts.shots].map((p) => norm(p)))];
  // Un chemin relatif a la User Library (Samples/shots/Kicks/x.wav) se resout depuis les dossiers au-dessus de shots
  const shotsAncestors = [];
  for (let d = path.dirname(shotsReal), n = 0; n < 4 && d !== path.dirname(d); d = path.dirname(d), n += 1) shotsAncestors.push(d);

  const given = opts.projects.length > 0;
  const projectRoots = [];
  for (const d of given ? opts.projects : DEFAULT_PROJECTS) {
    if (!(await isDir(d))) {
      if (given) console.log(`Note : dossier de projets introuvable, saute : ${d}`);
      continue;
    }
    const r = await realpath(d);
    if (!projectRoots.includes(r)) projectRoots.push(r);
  }
  // Un dossier contenu dans un autre de la liste (Music/Ableton dans Music) se lit une fois
  const roots = projectRoots.filter((d) => !projectRoots.some((o) => o !== d && inside(d, o)));
  if (roots.length === 0) fail(`Aucun dossier de projets lisible (${(given ? opts.projects : DEFAULT_PROJECTS).join(', ')}). Donne-en un : --projects "/chemin"`);

  console.log(`Samples joues dans Ableton -> MM-RYTM`);
  console.log(`  shots    : ${opts.shots}`);
  console.log(`  projets  : ${roots.join('\n             ')}`);
  console.log(`  mode     : ${opts.dry ? "APERCU (--dry, rien n'est ecrit)" : opts.import ? 'plan, dossier de transit puis IMPORT' : 'plan et dossier de transit (sans import)'}; ${opts.per} par famille, des ${plural(opts.minProjects, 'projet')}${opts.families ? ` ; familles : ${opts.families.join(' ')}` : ''}${opts.map.size > 0 ? ` ; map : ${[...opts.map].map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}\n`);

  /* ----- shots ----- */
  const shots = await walkShots(opts.shots, '', 0, { audio: [], unreadable: [], tooDeep: [] });
  for (const f of shots.audio) {
    Object.assign(f, classify(f, opts.map), { projects: new Set(), refs: 0 });
  }
  shots.audio.sort((a, b) => natural(a.rel, b.rel));
  const index = indexShots(shots.audio);
  const placeholders = shots.audio.filter((f) => f.placeholder);
  console.log(`Shots : ${shots.audio.length} fichiers audio${placeholders.length > 0 ? `, ${placeholders.length} pas telecharge(s) d'iCloud` : ''}, ${FAMILIES.map((f) => `${shots.audio.filter((x) => x.fam === f).length} ${f}`).join(', ')}, ${shots.audio.filter((x) => !x.fam && !x.skip).length} inconnu(s)${shots.audio.filter((x) => x.skip).length > 0 ? `, ${shots.audio.filter((x) => x.skip).length} ecarte(s) (--map skip)` : ''}`);
  if (shots.audio.length === 0) fail(`Aucun fichier audio (wav aif aiff mp3 flac m4a) dans ${opts.shots}`);

  /* ----- les sets ----- */
  const sets = { sets: [], seen: new Set(), icloud: [], backups: 0, unreadable: [], tooDeep: [] };
  for (const r of roots) await walkSets(r, 0, sets);
  sets.sets.sort(natural);
  console.log(`Sets : ${plural(sets.sets.length, 'Live set')} (*.als)${sets.backups > 0 ? `, ${plural(sets.backups, 'dossier')} Backup ignore(s)` : ''}${sets.icloud.length > 0 ? `, ${sets.icloud.length} pas telecharge(s) d'iCloud (ignores)` : ''}`);
  if (sets.sets.length === 0) console.log('  Aucun set : les familles seront remplies avec les fichiers du dossier, dans leur ordre.');

  const totals = { refs: 0, matched: 0, unmatched: 0, ambiguous: 0, sizeMismatch: 0, empty: 0, byHow: {} };
  const unmatchedNames = new Map();
  const ambiguities = [];
  const failed = [];
  const projects = new Set();
  for (let i = 0; i < sets.sets.length; i += 1) {
    const set = sets.sets[i];
    const project = path.dirname(set);
    let parsed;
    try {
      parsed = await readSet(set, shotsAncestors);
    } catch (e) {
      failed.push(`${set} (${e.code ?? e.message})`);
      continue;
    }
    projects.add(project);
    totals.empty += parsed.empty;
    for (const ref of parsed.refs) {
      totals.refs += 1;
      const r = resolveRef(ref, index, shotsBases);
      if (!r.file) {
        totals.unmatched += 1;
        unmatchedNames.set(ref.name, (unmatchedNames.get(ref.name) ?? 0) + 1);
        continue;
      }
      totals.matched += 1;
      totals.byHow[r.how] = (totals.byHow[r.how] ?? 0) + 1;
      if (r.ambiguous) {
        totals.ambiguous += 1;
        ambiguities.push({ name: ref.name, set: path.relative(project, set), chosen: r.file.rel, among: r.ambiguous });
      }
      if (r.sizeMismatch) totals.sizeMismatch += 1;
      r.file.projects.add(project);
      r.file.refs += 1;
    }
    if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === sets.sets.length) console.log(`  ${i + 1}/${sets.sets.length} sets lus, ${totals.refs} references, ${totals.matched} dans shots`);
  }
  console.log(`Projets : ${projects.size} distinct(s). References : ${totals.refs}, dont ${totals.matched} vers shots (${Object.entries(totals.byHow).map(([k, v]) => `${v} par ${k}`).join(', ') || 'aucune'}) et ${totals.unmatched} hors de shots${totals.ambiguous > 0 ? ` ; ${totals.ambiguous} homonyme(s) tranche(s) au premier venu` : ''}${totals.sizeMismatch > 0 ? ` ; ${totals.sizeMismatch} meme nom mais autre taille (autre version ?)` : ''}.\n`);

  /* ----- le classement par famille ----- */
  const fams = opts.families ?? FAMILIES;
  const rank = (list) => list.slice().sort((a, b) => b.projects.size - a.projects.size || b.refs - a.refs || natural(a.rel, b.rel));
  const plan = [];
  for (const fam of fams) {
    const all = shots.audio.filter((f) => f.fam === fam);
    const isUsed = (f) => f.projects.size > 0 && f.projects.size >= opts.minProjects;
    const used = rank(all.filter(isUsed));
    const rest = rank(all.filter((f) => !isUsed(f)));
    const picks = [...used.slice(0, opts.per), ...rest.slice(0, Math.max(0, opts.per - used.length))];
    const taken = new Set();
    let n = 0;
    const items = picks.map((f, i) => {
      const status = f.placeholder ? 'missing' : f.projects.size === 0 ? 'unused' : f.projects.size < opts.minProjects ? 'under-min' : 'used';
      let staged = null;
      if (status !== 'missing') {
        const { stem, ext } = cleanName(f.name);
        let s = stem;
        for (let k = 2; taken.has(norm(s + ext)); k += 1) s = `${stem.slice(0, MAX_STAGED_NAME - String(k).length - 1).trim()} ${k}`;
        taken.add(norm(s + ext));
        n += 1;
        staged = `${String(n).padStart(2, '0')} ${s}${ext}`;
      }
      return { rank: i + 1, f, status, staged };
    });
    plan.push({ fam, all, used, items, staged: items.filter((x) => x.staged), missing: items.filter((x) => x.status === 'missing') });
  }

  /* ----- le plan ----- */
  const w = (xs, min) => Math.max(min, ...xs);
  for (const p of plan) {
    const fill = p.items.filter((x) => x.status === 'unused' || x.status === 'under-min').length;
    console.log(`${TITLE[p.fam]} -> ${p.fam}/ : ${plural(p.all.length, 'fichier')} dans shots, ${p.used.length} joue(s) dans des projets, ${p.items.length} retenu(s)${fill > 0 ? ` (dont ${fill} pour completer : jamais joues ou sous ${plural(opts.minProjects, 'projet')})` : ''}`);
    if (p.items.length === 0) {
      console.log(p.all.length === 0 ? '  (rien dans shots pour cette famille : range un dossier ou --map "Dossier=' + p.fam + '" ; pas importee)' : '  (rien retenu ; pas importee)');
      console.log('');
      continue;
    }
    const ws = w(p.items.map((x) => x.f.rel.length), 10);
    const wn = w(p.items.map((x) => (x.staged ?? 'MISSING').length), 8);
    console.log(`  ${'#'.padStart(3)} ${'proj'.padStart(4)} ${'refs'.padStart(4)}  ${'source (shots/...)'.padEnd(ws)}  ${'transit'.padEnd(wn)}  via`);
    for (const x of p.items) {
      const flag = x.status === 'missing' ? '!' : x.status === 'used' ? '+' : '.';
      const tail = x.status === 'missing' ? 'MISSING (iCloud, pas telecharge)' : x.status === 'unused' ? 'unused' : x.status === 'under-min' ? `sous ${opts.minProjects} projets` : '';
      console.log(`  ${flag}${String(x.rank).padStart(2)} ${String(x.f.projects.size).padStart(4)} ${String(x.f.refs).padStart(4)}  ${x.f.rel.padEnd(ws)}  ${(x.staged ?? 'MISSING').padEnd(wn)}  ${x.f.via}${tail ? `  [${tail}]` : ''}`);
    }
    const left = Math.max(0, p.used.length - opts.per);
    if (left > 0) console.log(`  ... et ${left} autre(s) joue(s) dans des projets, au-dela de --per ${opts.per}`);
    console.log('');
  }

  const unknown = shots.audio.filter((f) => !f.fam && !f.skip).sort((a, b) => b.projects.size - a.projects.size || natural(a.rel, b.rel));
  if (unknown.length > 0) {
    const show = unknown.slice(0, 40);
    console.log(`INCONNUS (${unknown.length}), laisses de cote : range-les dans un dossier Kicks / Snares / Hats / Claps / Toms / Percs / Cymbals, ou force-les : --map "Dossier=famille" (familles : ${FAMILIES.join(' ')})`);
    for (const f of show) console.log(`  ? ${f.rel}${f.projects.size > 0 ? `  (joue dans ${plural(f.projects.size, 'projet')})` : ''} : ${f.why}`);
    if (unknown.length > show.length) console.log(`  ... et ${unknown.length - show.length} autres (tous dans le rapport)`);
    console.log('');
  }
  if (ambiguities.length > 0) {
    console.log(`HOMONYMES (${ambiguities.length} reference(s)) : meme nom dans plusieurs dossiers de shots, ni le dossier ni la taille ne tranchent, le premier est compte (renomme-les pour etre sur) :`);
    for (const a of ambiguities.slice(0, 10)) console.log(`  ~ ${a.name} : ${a.among.join(' | ')}  (${a.set})`);
    if (ambiguities.length > 10) console.log(`  ... ${ambiguities.length - 10} de plus dans le rapport`);
    console.log('');
  }
  if (unmatchedNames.size > 0) {
    const top = [...unmatchedNames].sort((a, b) => b[1] - a[1] || natural(a[0], b[0])).slice(0, 10);
    console.log(`Hors de shots : ${totals.unmatched} reference(s) vers ${unmatchedNames.size} fichier(s) d'ailleurs (packs, autres dossiers), les plus frequents : ${top.map(([n, c]) => `${n} (${c})`).join(', ')}\n`);
  }
  const notes = [];
  if (failed.length > 0) notes.push(`${plural(failed.length, 'set')} illisible(s) : ${failed.slice(0, 5).join(' ; ')}${failed.length > 5 ? ' ...' : ''}`);
  if (sets.icloud.length > 0) notes.push(`${sets.icloud.length} set(s) iCloud pas telecharge(s), pas lus (Finder : Telecharger maintenant, puis relance)`);
  if (sets.tooDeep.length > 0) notes.push(`dossiers trop profonds (plus de ${MAX_DEPTH} niveaux), pas lus : ${sets.tooDeep.slice(0, 3).join(', ')}${sets.tooDeep.length > 3 ? ' ...' : ''}`);
  if (shots.tooDeep.length > 0) notes.push(`shots : dossiers trop profonds, pas lus : ${shots.tooDeep.join(', ')}`);
  for (const u of [...shots.unreadable, ...sets.unreadable]) notes.push(`illisible : ${u}`);
  if (opts.per > 8) notes.push(`${opts.per} samples par famille : au-dela de 8 la plaque du potard ecrit leur numero au lieu du nom (l'ecran garde les noms)`);
  const aiff = plan.flatMap((p) => p.staged).filter((x) => /\.aiff?$/i.test(x.staged));
  if (aiff.length > 0) notes.push(`${aiff.length} fichier(s) AIFF retenu(s) : Safari les lit, Chrome et Firefox non ; convertis-les en WAV (afconvert -f WAVE -d LEI16 "in.aif" "out.wav") puis relance`);
  for (const n of notes) console.log(`Note : ${n}`);
  if (notes.length > 0) console.log('');

  const missing = plan.flatMap((p) => p.missing);
  if (missing.length > 0) {
    console.log(`MISSING : ${missing.length} sample(s) retenu(s) pas encore telecharge(s) d'iCloud sur ce Mac :`);
    for (const x of missing) console.log(`  ! ${x.f.rel}`);
    console.log(`  Telecharge-les d'abord (Finder : clic droit sur le dossier shots, Telecharger maintenant ; ou : brctl download "${opts.shots}") puis relance : sinon ils manqueront au potard et les numeros changeraient au prochain import.\n`);
  }

  const importable = plan.filter((p) => p.staged.length > 0);
  const stamp = new Date(started).toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const staging = path.join(os.tmpdir(), `mm-rytm-top-${stamp}`);
  const importCmd = importable.length > 0 ? `node scripts/import-rytm-samples.mjs "${staging}" --replace --families ${importable.map((p) => p.fam).join(',')}` : null;

  /* ----- le rapport ----- */
  const report = {
    date: new Date(started).toISOString(),
    shots: opts.shots,
    projectRoots: roots,
    options: { per: opts.per, minProjects: opts.minProjects, families: fams, map: Object.fromEntries(opts.map), dry: opts.dry, import: opts.import },
    sets: { found: sets.sets.length, parsed: sets.sets.length - failed.length, failed, backupDirsSkipped: sets.backups, icloudNotDownloaded: sets.icloud.length, tooDeep: sets.tooDeep },
    projects: projects.size,
    refs: {
      total: totals.refs,
      matched: totals.matched,
      byHow: totals.byHow,
      unmatched: totals.unmatched,
      unmatchedDistinct: unmatchedNames.size,
      unmatchedTop: [...unmatchedNames].sort((a, b) => b[1] - a[1] || natural(a[0], b[0])).slice(0, 50).map(([name, refs]) => ({ name, refs })),
      ambiguous: ambiguities,
      sizeMismatch: totals.sizeMismatch,
      emptyFileRefs: totals.empty,
    },
    shotsFiles: {
      total: shots.audio.length,
      placeholders: placeholders.map((f) => f.rel),
      unknown: unknown.map((f) => ({ rel: f.rel, why: f.why, projects: f.projects.size, refs: f.refs })),
      skipped: shots.audio.filter((f) => f.skip).map((f) => f.rel),
    },
    families: Object.fromEntries(
      plan.map((p) => [
        p.fam,
        {
          title: TITLE[p.fam],
          files: p.all.length,
          used: p.used.length,
          plan: p.items.map((x) => ({ rank: x.rank, rel: x.f.rel, projects: x.f.projects.size, refs: x.f.refs, via: x.f.via, status: x.status, staged: x.staged })),
          ranked: p.used.map((f) => ({ rel: f.rel, projects: f.projects.size, refs: f.refs, projectDirs: [...f.projects].sort(natural) })),
        },
      ])
    ),
    staging: opts.dry ? null : staging,
    importCommand: importCmd,
    notes,
  };

  const total = plan.reduce((n, p) => n + p.staged.length, 0);
  const summary = `${total} sample(s) retenu(s) dans ${importable.length} famille(s) (${importable.map((p) => `${p.staged.length} ${p.fam}`).join(', ') || 'aucune'}), ${missing.length} MISSING, ${unknown.length} inconnu(s)`;

  if (opts.dry) {
    if (opts.reportGiven) {
      await mkdir(path.dirname(opts.report), { recursive: true });
      await writeFile(opts.report, JSON.stringify(report, null, 2));
      console.log(`Rapport : ${opts.report}`);
    }
    console.log(`APERCU : ${summary}. Rien n'est ecrit.`);
    console.log(`Pour preparer le dossier de transit : npm run samples:ableton${rerunArgs(opts)}`);
    console.log(`Pour importer dans la foulee     : npm run samples:ableton -- --import${rerunArgs(opts, true)}`);
    process.exit(missing.length > 0 ? 2 : 0);
  }

  /* ----- le dossier de transit ----- */
  if (total === 0) {
    await mkdir(path.dirname(opts.report), { recursive: true });
    await writeFile(opts.report, JSON.stringify(report, null, 2));
    console.log(`Rapport : ${opts.report}`);
    console.error(`RIEN A IMPORTER : ${summary}.`);
    process.exit(2);
  }
  await mkdir(staging, { recursive: true });
  for (const p of importable) {
    const dir = path.join(staging, p.fam);
    await mkdir(dir, { recursive: true });
    for (const x of p.staged) await copyFile(x.f.full, path.join(dir, x.staged));
  }
  await mkdir(path.dirname(opts.report), { recursive: true });
  await writeFile(opts.report, JSON.stringify(report, null, 2));
  console.log(`Dossier de transit : ${staging} (${importable.map((p) => `${p.fam}/ ${p.staged.length}`).join(', ')})`);
  console.log(`Rapport : ${opts.report}`);
  console.log(`PLAN : ${summary}.\n`);

  if (missing.length > 0) {
    console.error(`${opts.import ? "PAS D'IMPORT" : 'ATTENTION'} : ${missing.length} sample(s) retenu(s) manquent (iCloud). Telecharge-les et relance${opts.import ? '' : ', ou importe quand meme sans eux avec la commande ci-dessous'}.`);
    if (opts.import) process.exit(2);
  }
  if (!opts.import) {
    console.log(`Ensuite, pour les mettre dans public/samples/rytm (les anciens de ces familles sont remplaces) :\n  ${importCmd}\n  (apercu d'abord : ajoute --dry)`);
    afterwards(importable);
    process.exit(missing.length > 0 ? 2 : 0);
  }

  /* ----- l'import ----- */
  console.log(`Import : ${importCmd}\n`);
  const r = spawnSync(process.execPath, [IMPORT_SCRIPT, staging, '--replace', '--families', importable.map((p) => p.fam).join(',')], { stdio: 'inherit', cwd: ROOT });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    console.error(`\nL'import s'est arrete (code ${r.status}). Le dossier de transit reste la : ${staging}`);
    process.exit(r.status ?? 1);
  }
  afterwards(importable);
}

/** Les options a redonner pour relancer pareil (sans --dry / --import). */
function rerunArgs(opts, withImport = false) {
  const a = [];
  if (opts.shots !== DEFAULT_SHOTS) a.push(`--shots "${opts.shots}"`);
  for (const p of opts.projects) a.push(`--projects "${p}"`);
  if (opts.per !== 20) a.push(`--per ${opts.per}`);
  if (opts.minProjects !== 1) a.push(`--min-projects ${opts.minProjects}`);
  if (opts.families) a.push(`--families ${opts.families.join(',')}`);
  for (const [k, v] of opts.map) a.push(`--map "${k}=${v}"`);
  if (opts.reportGiven) a.push(`--report "${opts.report}"`);
  if (a.length === 0) return '';
  return `${withImport ? ' ' : ' -- '}${a.join(' ')}`;
}

/** Ce qui suit l'import : relire, verifier, committer ; en dev la liste se refait toute seule. */
function afterwards(importable) {
  const fams = importable.map((p) => p.fam);
  console.log(`
Apres l'import :
  1. En dev (npm run dev) la liste du potard se refait toute seule (vite, virtual:rytm-samples) : MM-RYTM, choix de son de ${fams.map((f) => f.toUpperCase()).join(' / ')}
  2. Relis ce qui a change :   git status public/samples/rytm   (git diff --stat public/samples/rytm)
  3. Mets-les en ligne :       git add public/samples/rytm && git commit -m "Samples joues dans Ableton dans MM-RYTM (${fams.join(', ')})" && git push
  Pour annuler avant le commit : git restore public/samples/rytm && git clean -f public/samples/rytm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
