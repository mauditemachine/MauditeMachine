#!/usr/bin/env node
/**
 * Les echantillons de Mika dans le choix de son du MM-RYTM (2026-10-05,
 * Mika : "mets ces samples dans le selecteur, avec les noms : Engelhardt,
 * Carassi, Stein"). Les fichiers sont sur son Mac, pas dans le depot : ce
 * script les copie dans public/samples/rytm/<famille>/, sous un nom propre
 * et numerote (01 BluePrint.wav), le numero donnant l'ordre des crans du
 * potard. Le nom a la plaque est celui que src/v4/audio/samples.ts
 * (sampleLabel) tire du fichier : 01 BluePrint.wav s'ecrit BLUEPRINT.
 *
 * Generique depuis le 2026-10-08 (Mika : "Pour les samples les voici donc
 * change les tout de suite pour BD et SD : /Users/mauditemachine/Desktop/
 * Samples c'est ceux la que je veux") : plus de liste de noms figee, TOUS
 * les fichiers audio du dossier (wav, aif, aiff, mp3, flac, m4a) entrent,
 * a plat ou en sous-dossiers.
 *
 *   npm run samples:import -- "/Users/mauditemachine/Desktop/Samples" --replace
 *
 * La famille d'un fichier :
 * - son sous-dossier le plus proche, s'il porte le nom d'une famille (sans
 *   tenir compte des majuscules) : BD, Kick, Kicks, Bassdrum ; SD, Snare,
 *   Snares ; CP, Clap ; HH, Hat, Hats, CH, OH ; TOM ; RS, Rim (puis le nom du
 *   dossier donne lui-meme) ;
 * - sinon un mot de son nom (kick, snare, clap, hat, tom, rim, puis les
 *   abreviations BD, SD, CP, HH, CH, OH, RS), le mot apres le tiret d'abord
 *   (AT Tom Trago - Kick F : un kick) ;
 * - sinon il est liste INCONNU et laisse de cote (le ranger dans un dossier
 *   BD ou SD suffit).
 *
 * Le nom propre : les regles de sampleLabel (sans le numero, sans "AT", sans
 * le mot de la famille), plus :
 * - la tonalite en fin de nom (F, G#, Bb) tombe, sauf si deux noms de la
 *   famille deviendraient pareils (alors BluePrint F et BluePrint G) ;
 * - un artiste "Prenom Nom - Kick X" garde son nom (AT Tim Engelhardt -
 *   Kick G : Engelhardt), comme les noms choisis par Mika le 2026-10-05 ;
 * - 18 caracteres au plus (la plaque), un " 2" si deux noms restent pareils.
 * L'extension d'origine reste. L'ordre : le chemin dans le dossier, en ordre
 * naturel (01 avant 02, 2 avant 10), stable d'un lancement a l'autre.
 *
 * Options :
 *   --replace         retire d'abord les fichiers audio des familles qui
 *                     recoivent des nouveaux (et seulement celles-la) ; sans
 *                     lui, les nouveaux s'ajoutent apres les numeros deja la
 *                     (un fichier deja present, meme contenu, est saute)
 *   --dry             montre le plan sans rien ecrire
 *   --families bd,sd  seulement ces familles (par defaut : toutes celles
 *                     trouvees)
 *
 * Garde-fous : rien n'est retire hors de public/samples/rytm/<famille>/ (et
 * seulement des fichiers audio) ; un dossier source dans le depot (ou qui le
 * contient) est refuse ; un fichier iCloud pas encore telecharge (un
 * .nom.wav.icloud, ou un fichier sans aucun bloc sur le disque) est signale
 * et rien n'est ecrit tant qu'il manque dans les familles importees (sinon
 * les numeros changeraient au prochain import) ; tout est lu avant de
 * retirer quoi que ce soit ; les cles des presets d'usine (src/v4) qui ne
 * trouveraient plus leur fichier sont listees (--help : l'usage).
 *
 * Sans argument : ~/Library/Mobile Documents/com~apple~CloudDocs/User
 * Library/Samples/shots (l'ancien dossier de Mika).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots');
const OUT = path.join(ROOT, 'public/samples/rytm');
const AUDIO = /\.(wav|aiff?|mp3|flac|m4a)$/i;
/** Les sous-dossiers explores au plus (un dossier de samples, pas un disque entier). */
const MAX_DEPTH = 8;
/** Au-dela, ce n'est plus un coup de batterie (et chaque visiteur le telechargerait). */
const MAX_BYTES = 10 * 1024 * 1024;
/** Revenir a l'etat d'avant l'import (avant le commit) : git rend les anciens, retire les nouveaux. */
const UNDO = 'git restore public/samples/rytm && git clean -f public/samples/rytm';
/** Vrai des que l'import retire ou ecrit (une erreur ensuite donne UNDO). */
let writing = false;
/** La plaque coupe a 18 caracteres (sampleLabel). */
const MAX_NAME = 18;

/** Les familles qui jouent un echantillon (src/v4/audio/samples.ts, FAMILY_DIRS), dans l'ordre du resume. */
const FAMILIES = ['bd', 'sd', 'cp', 'hh', 'tom', 'rs'];
const TITLE = { bd: 'BD (kicks)', sd: 'SD (snares)', cp: 'CP (claps)', hh: 'HH (charleys)', tom: 'TOM', rs: 'RS (rims)' };

/**
 * Les mots d'une famille : forts (kick, snare...) puis abreviations. Les
 * mots colles (bass drum, hi hat) se lisent aussi en un seul.
 */
const WORDS = {
  bd: { strong: ['kick', 'kicks', 'kickdrum', 'kickdrums', 'bassdrum', 'bassdrums'], weak: ['bd'] },
  sd: { strong: ['snare', 'snares', 'snaredrum', 'snaredrums'], weak: ['sd'] },
  cp: { strong: ['clap', 'claps', 'handclap', 'handclaps'], weak: ['cp'] },
  hh: { strong: ['hat', 'hats', 'hihat', 'hihats', 'openhat', 'openhats', 'closedhat', 'closedhats'], weak: ['hh', 'ch', 'oh'] },
  tom: { strong: ['tom', 'toms'], weak: [] },
  rs: { strong: ['rim', 'rims', 'rimshot', 'rimshots', 'sidestick', 'sidesticks'], weak: ['rs'] },
};

/** Ce qu'on retire du nom propre, par famille (seulement les mots de sa famille : AT Tom Trago - Kick F garde Tom). */
const STRIP = {
  bd: { words: 'kick\\s?drums?|bass\\s?drums?|kicks?', glued: 'kicks?', camel: 'Kicks?|Kickdrums?|Bassdrums?', abbr: 'BD' },
  sd: { words: 'snare\\s?drums?|snares?', glued: 'snares?', camel: 'Snares?', abbr: 'SD' },
  cp: { words: 'hand\\s?claps?|claps?', glued: 'claps?', camel: 'Claps?', abbr: 'CP' },
  hh: { words: 'hi[\\s-]?hats?|hats?', glued: 'hats?', camel: 'Hats?|Hihats?', abbr: 'HH' },
  tom: { words: 'toms?', glued: 'toms?', camel: 'Toms?', abbr: 'TOM' },
  rs: { words: 'rim\\s?shots?|side\\s?sticks?|rims?', glued: 'rims?', camel: 'Rims?|Rimshots?', abbr: 'RS' },
};

/**
 * Copie conforme de sampleLabel (src/v4/audio/samples.ts) : le nom que la
 * plaque ecrira pour un fichier du site. A garder identique.
 */
function sampleLabel(file) {
  let t = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
  t = t.replace(/^AT\s+/i, '');
  t = t.replace(/\b(master\s+)?(kicks?|snares?|claps?|hats?|hihats?|toms?|rims?)\b/gi, ' ');
  t = t.replace(/(master\s+)?(kicks?|snares?)(?=\d)/gi, ' ');
  t = t.replace(/^\s*(BD|SD|CP|HH|RS)\s+/i, '');
  t = t.replace(/\s+-\s+/g, ' ').replace(/\s-\s*$/, '').replace(/\s+/g, ' ').trim();
  return (t || file).toUpperCase().slice(0, 18);
}

/* ---------------- arguments ---------------- */

const USAGE = `Usage : npm run samples:import -- "/chemin/vers/Samples" [--replace] [--dry] [--families bd,sd]

  --replace         retire d'abord les anciens fichiers des familles qui en recoivent des nouveaux
  --dry             montre le plan sans rien ecrire
  --families bd,sd  seulement ces familles (bd sd cp hh tom rs ; par defaut : toutes celles trouvees)

Sans dossier : ${DEFAULT_SRC}`;

function fail(msg, code = 1) {
  console.error(`${msg}\n\n${USAGE}`);
  process.exit(code);
}

/** Le code d'une famille depuis un nom (bd, Kicks, snare...), ou null. */
function familyCode(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (FAMILIES.includes(w)) return w;
  for (const f of FAMILIES) if (WORDS[f].strong.includes(w) || WORDS[f].weak.includes(w)) return f;
  return null;
}

function parseArgs(argv) {
  const o = { replace: false, dry: false, families: null, pos: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--replace') o.replace = true;
    else if (a === '--dry' || a === '--dry-run' || a === '-n') o.dry = true;
    else if (a === '--help' || a === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (a === '--families' || a === '--family') {
      if (i + 1 >= argv.length) fail('--families attend une liste (ex. --families bd,sd)');
      o.families = argv[(i += 1)];
    } else if (a.startsWith('--families=') || a.startsWith('--family=')) o.families = a.slice(a.indexOf('=') + 1);
    else if (a.startsWith('-')) fail(`Option inconnue : ${a}`);
    else o.pos.push(a);
  }
  if (o.families !== null) {
    const list = o.families.split(/[\s,;+]+/).filter(Boolean);
    const codes = list.map((w) => [w, familyCode(w)]);
    const bad = codes.filter(([, c]) => !c).map(([w]) => w);
    if (bad.length > 0 || list.length === 0) fail(`Famille inconnue : ${bad.join(', ') || '(vide)'} (familles : ${FAMILIES.join(' ')})`);
    o.families = [...new Set(codes.map(([, c]) => c))];
  }
  return o;
}

const expand = (p) => path.resolve(p.trim().replace(/^~(?=$|\/)/, os.homedir()));

async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Le dossier source : l'argument, ou l'ancien dossier par defaut. Un chemin a espaces sans guillemets est recolle. */
async function sourceDir(pos) {
  if (pos.length === 0) return { src: DEFAULT_SRC, note: '(aucun dossier donne : le dossier par defaut)' };
  if (pos.length === 1) return { src: expand(pos[0]), note: '' };
  const joined = expand(pos.join(' '));
  if (await isDir(joined)) return { src: joined, note: '(chemin recolle : mets-le entre guillemets la prochaine fois)' };
  return fail(`Plusieurs dossiers donnes (${pos.join(' | ')}) : un seul, entre guillemets s'il contient des espaces.`);
}

/* ---------------- lecture du dossier ---------------- */

/**
 * Un fichier sans bloc sur le disque est-il un fichier iCloud pas encore
 * telecharge ? Sur le Mac, le drapeau SF_DATALESS le dit (stat -f %Xf) ;
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

/**
 * Tous les fichiers sous le dossier : l'audio (avec son chemin relatif et
 * son etat iCloud), le reste compte par extension.
 */
async function walk(dir, rel, depth, acc) {
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
      if (AUDIO.test(real)) acc.audio.push({ full, rel: rel ? path.join(rel, real) : real, name: real, size: 0, placeholder: 'icloud' });
      continue;
    }
    if (name.startsWith('.') || name === '__MACOSX') continue;
    let isFile = e.isFile();
    let isDirectory = e.isDirectory();
    if (e.isSymbolicLink()) {
      // Un lien vers un fichier compte, un lien vers un dossier non (pas de boucle)
      const st = await stat(full).catch(() => null);
      isFile = Boolean(st?.isFile());
      isDirectory = false;
    }
    if (isDirectory) {
      if (depth < MAX_DEPTH) await walk(full, r, depth + 1, acc);
      else acc.tooDeep.push(r);
    } else if (isFile) {
      if (!AUDIO.test(name)) {
        const ext = path.extname(name).toLowerCase() || '(sans extension)';
        acc.other.set(ext, (acc.other.get(ext) ?? 0) + 1);
        continue;
      }
      const st = await stat(full).catch(() => null);
      if (!st) {
        acc.unreadable.push(r);
        continue;
      }
      // iCloud, nouveau style : le fichier a sa taille mais aucun bloc sur le disque (pas encore telecharge)
      const placeholder = st.size > 0 && st.blocks === 0 && dataless(full) ? 'icloud' : null;
      acc.audio.push({ full, rel: r, name, size: st.size, placeholder });
    }
  }
  return acc;
}

/* ---------------- la famille d'un fichier ---------------- */

/** Les mots d'un nom : sans accents, camelCase et chiffres decolles, en minuscules. */
function tokens(s) {
  const t = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // Les mots en deux morceaux (bass drum, hi hat, rim shot) se lisent aussi colles
  const pairs = t.slice(1).map((w, i) => t[i] + w);
  return [...t, ...pairs];
}

/** La famille d'une liste de mots : un mot fort l'emporte sur une abreviation ; deux familles = ambigu. */
function familyOfWords(words) {
  for (const kind of ['strong', 'weak']) {
    const hit = FAMILIES.filter((f) => WORDS[f][kind].some((w) => words.includes(w)));
    if (hit.length === 1) return { fam: hit[0] };
    if (hit.length > 1) return { ambiguous: hit };
  }
  return null;
}

/** La famille d'un fichier : son dossier le plus proche, puis son nom. */
function classify(file, srcBase) {
  const dirs = file.rel.split(path.sep).slice(0, -1);
  for (const d of [...dirs].reverse()) {
    const r = familyOfWords(tokens(d));
    if (r?.fam) return { fam: r.fam, via: `dossier ${d}` };
  }
  const own = familyOfWords(tokens(srcBase));
  if (own?.fam) return { fam: own.fam, via: `dossier ${srcBase}` };
  const base = file.name.replace(/\.[^.]+$/, '');
  const parts = base.split(/\s+-\s+/);
  // Le mot apres le tiret d'abord : "AT Tom Trago - Kick F" est un kick
  if (parts.length > 1) {
    const r = familyOfWords(tokens(parts[parts.length - 1]));
    if (r?.fam) return { fam: r.fam, via: `nom (${parts[parts.length - 1].trim()})` };
  }
  const r = familyOfWords(tokens(base));
  if (r?.fam) return { fam: r.fam, via: 'nom' };
  if (r?.ambiguous) return { fam: null, why: `plusieurs familles dans le nom (${r.ambiguous.join(', ')})` };
  return { fam: null, why: 'aucun dossier ni mot de famille' };
}

/* ---------------- le nom propre ---------------- */

const KEY = /\s+[([]?([A-G](?:#|b)?(?:m|min|maj)?)[)\]]?$/;
const hasLetter = (s) => /\p{L}/u.test(s);

function tidy(s) {
  return s
    .replace(/[^\p{L}\p{N} #&'+()-]/gu, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();
}

/** Coupe a n caracteres, au dernier espace si possible. */
function cut(s, n) {
  if (s.length <= n) return s;
  const head = s.slice(0, n + 1);
  const sp = head.lastIndexOf(' ');
  return (sp >= Math.floor(n / 2) ? head.slice(0, sp) : s.slice(0, n)).replace(/[\s-]+$/, '');
}

/**
 * Les noms possibles d'un fichier, du plus court au plus long : le nom de
 * l'artiste seul, puis avec la tonalite, puis le nom complet (et sa
 * tonalite). Le premier qui ne fait pas doublon dans la famille gagne.
 */
function candidates(file, fam) {
  const s = STRIP[fam];
  const base = file.name.replace(/\.[^.]+$/, '').normalize('NFC').replace(/_/g, ' ');
  const strip = (t0, dropNumber) => {
    let t = t0;
    if (dropNumber) t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
    t = t.replace(/^AT\s+/i, '');
    t = t.replace(new RegExp(`\\b(master\\s+)?(${s.words})\\b`, 'gi'), ' ');
    t = t.replace(new RegExp(`(master\\s+)?(${s.glued})(?=\\d)`, 'gi'), ' ');
    t = t.replace(new RegExp(`(?<=[\\p{L}\\p{N}])(${s.camel})(?=$|[^\\p{L}])`, 'gu'), ' ');
    t = t.replace(new RegExp(`\\b(${s.abbr})\\b`, 'gi'), ' ');
    return tidy(t);
  };
  let full = strip(base, true);
  // "707 Snare" : sans le numero il ne reste rien, le numero est le nom
  if (!full) full = strip(base, false);
  // Rien que des chiffres : le dossier qui les range, s'il dit quelque chose (Techno/Kick 01 : Techno 01)
  if (!hasLetter(full)) {
    const ctx = file.rel
      .split(path.sep)
      .slice(0, -1)
      .reverse()
      .find((d) => !familyOfWords(tokens(d))?.fam && hasLetter(tidy(d)));
    full = tidy(`${ctx ? tidy(ctx) : full ? '' : 'Sample'} ${full}`);
  }
  const m = full.match(KEY);
  const noKey = m && hasLetter(full.slice(0, m.index)) ? full.slice(0, m.index).trim() : full;
  const key = noKey !== full ? m[1] : '';
  // "AT Prenom Nom - Kick X" : le nom de l'artiste suffit (Engelhardt, Carassi, Stein)
  let short = noKey;
  const dash = base.split(/\s+-\s+/);
  if (dash.length > 1 && strip(dash[0], true) === noKey && /^\p{Lu}\p{Ll}+ \p{Lu}[\p{Ll}'-]+$/u.test(noKey)) short = noKey.split(' ')[1];
  const list = [short, key ? `${short} ${key}` : short, noKey, key ? `${noKey} ${key}` : noKey].map((x) => cut(x, MAX_NAME));
  return [...new Set(list)];
}

/** Le numero en tete d'un nom de fichier (03 Engelhardt.wav : 3), ou 0. */
const leadNumber = (f) => Number(f.match(/^\s*(\d+)/)?.[1] ?? 0);
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${n > 0 ? Math.max(1, Math.round(n / 1024)) : 0} Ko`);

/**
 * Donne a chaque nouveau fichier son nom : chacun commence par son nom le
 * plus court ; tant que deux noms (ou un nom deja dans la famille) donnent la
 * meme plaque, ceux-la passent au nom suivant ; au bout, " 2", " 3".
 */
function assignNames(items, taken) {
  const level = items.map(() => 0);
  const label = (i) => sampleLabel(`01 ${items[i].cands[level[i]]}.wav`);
  for (let guard = 0; guard < 16; guard += 1) {
    const groups = new Map();
    items.forEach((_, i) => {
      const l = label(i);
      groups.set(l, [...(groups.get(l) ?? []), i]);
    });
    let bumped = false;
    for (const [l, idx] of groups) {
      if (idx.length < 2 && !taken.has(l)) continue;
      for (const i of idx) {
        if (level[i] < items[i].cands.length - 1) {
          level[i] += 1;
          bumped = true;
        }
      }
    }
    if (!bumped) break;
  }
  const used = new Set(taken);
  return items.map((it, i) => {
    let name = it.cands[level[i]];
    for (let k = 2; used.has(sampleLabel(`01 ${name}.wav`)); k += 1) name = `${cut(it.cands[level[i]], MAX_NAME - String(k).length - 1)} ${k}`;
    used.add(sampleLabel(`01 ${name}.wav`));
    return name;
  });
}

/* ---------------- les presets d'usine ---------------- */

/** Les cles d'echantillon ecrites dans le code (src/v4 : 'bd/01 BluePrint.wav'), avec leur fichier. */
async function codeKeys(dir = path.join(ROOT, 'src/v4'), out = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await codeKeys(full, out);
    else if (/\.tsx?$/.test(e.name)) {
      const text = await readFile(full, 'utf8').catch(() => '');
      for (const m of text.matchAll(/['"`]((?:bd|sd|cp|hh|tom|rs)\/[^'"`\n]+\.(?:wav|aiff?|mp3|flac|m4a|ogg))['"`]/gi)) {
        out.push({ key: m[1], where: path.relative(ROOT, full) });
      }
    }
  }
  return out;
}

/* ---------------- le plan, puis la copie ---------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { src: SRC, note } = await sourceDir(opts.pos);
  if (!(await isDir(SRC))) {
    fail(`Dossier introuvable : ${SRC}\nDonne le dossier des samples : npm run samples:import -- "/chemin/vers/Samples"`);
  }
  const realSrc = await realpath(SRC);
  const realRoot = await realpath(ROOT);
  const inside = (a, b) => a === b || a.startsWith(b + path.sep);
  if (inside(realSrc, realRoot)) fail(`Refuse : ${SRC} est dans le depot. Donne le dossier de tes samples sur le Mac (ex. ~/Desktop/Samples).`);
  if (inside(realRoot, realSrc)) fail(`Refuse : ${SRC} contient le depot lui-meme. Donne seulement le dossier de tes samples.`);

  console.log(`Samples MM-RYTM : ${SRC} ${note}`.trim());
  console.log(`Mode : ${opts.dry ? "APERCU (--dry, rien n'est ecrit)" : 'copie'}${opts.replace ? ', --replace (les anciens des familles concernees sont retires)' : ', ajout apres les numeros deja la'}${opts.families ? `, familles : ${opts.families.join(' ')}` : ''}\n`);

  const acc = await walk(SRC, '', 0, { audio: [], other: new Map(), unreadable: [], tooDeep: [] });
  const srcBase = path.basename(SRC);
  for (const f of acc.audio) Object.assign(f, classify(f, srcBase));
  acc.audio.sort((a, b) => natural(a.rel, b.rel));

  const unknown = acc.audio.filter((f) => !f.fam);
  const filtered = acc.audio.filter((f) => f.fam && opts.families && !opts.families.includes(f.fam));
  const chosen = acc.audio.filter((f) => f.fam && (!opts.families || opts.families.includes(f.fam)));
  const placeholders = acc.audio.filter((f) => f.placeholder);
  const blocking = chosen.filter((f) => f.placeholder);
  const problems = [...acc.unreadable.map((r) => `illisible : ${r}`)];
  const notes = [];

  // Tout le contenu en memoire avant de retirer quoi que ce soit
  for (const f of chosen) {
    if (f.placeholder) continue;
    if (f.size > MAX_BYTES) {
      f.skip = `trop gros (${kb(f.size)}, ${kb(MAX_BYTES)} au plus)`;
      continue;
    }
    try {
      f.data = await readFile(f.full);
      f.hash = sha1(f.data);
    } catch (e) {
      problems.push(`illisible : ${f.rel} (${e.code ?? e.message})`);
    }
  }

  const plan = [];
  for (const fam of FAMILIES) {
    const incoming = chosen.filter((f) => f.fam === fam);
    if (incoming.length === 0) {
      if (opts.families?.includes(fam)) notes.push(`${fam} : rien trouve dans le dossier, on n'y touche pas`);
      continue;
    }
    const dir = path.join(OUT, fam);
    const existing = [];
    for (const name of (await readdir(dir).catch(() => [])).sort(natural)) {
      if (name.startsWith('.') || !AUDIO.test(name)) continue;
      const full = path.join(dir, name);
      const st = await lstat(full).catch(() => null);
      if (!st?.isFile()) continue;
      existing.push({ name, full, hash: sha1(await readFile(full)), label: sampleLabel(name) });
    }
    const seen = new Map();
    const items = [];
    for (const f of incoming) {
      if (f.placeholder || f.skip || !f.data) continue;
      const twin = seen.get(f.hash);
      if (twin) {
        f.skip = `meme contenu que ${twin.rel}`;
        continue;
      }
      seen.set(f.hash, f);
      const here = !opts.replace && existing.find((x) => x.hash === f.hash);
      if (here) {
        f.skip = `deja la : ${fam}/${here.name}`;
        continue;
      }
      items.push({ f, cands: candidates(f, fam) });
    }
    const keep = opts.replace ? [] : existing;
    const start = opts.replace ? 1 : Math.max(0, ...keep.map((x) => leadNumber(x.name)), keep.length) + 1;
    const names = assignNames(items, new Set(keep.map((x) => x.label)));
    const width = Math.max(2, String(start + items.length - 1).length);
    const adds = items.map((it, i) => {
      const file = `${String(start + i).padStart(width, '0')} ${names[i]}${path.extname(it.f.name).toLowerCase()}`;
      return { ...it, file, label: sampleLabel(file) };
    });
    const removes = opts.replace && adds.length > 0 ? existing : [];
    plan.push({ fam, dir, existing, keep, adds, removes, incoming });
  }

  /* ----- le plan ----- */
  for (const p of plan) {
    console.log(`${TITLE[p.fam]} -> public/samples/rytm/${p.fam}/`);
    for (const x of p.removes) console.log(`  - retire   ${x.name}`);
    if (!opts.replace) for (const x of p.keep) console.log(`  = garde    ${x.name}`);
    const w = Math.max(10, ...p.adds.map((a) => a.file.length));
    const wl = Math.max(8, ...p.adds.map((a) => a.label.length));
    for (const a of p.adds) console.log(`  + ${a.file.padEnd(w)}  ${a.label.padEnd(wl)}  <-  ${a.f.rel}  [${a.f.via}]`);
    for (const f of p.incoming.filter((x) => x.skip)) console.log(`  . saute    ${f.rel} : ${f.skip}`);
    for (const f of p.incoming.filter((x) => x.placeholder)) console.log(`  ! iCloud   ${f.rel} : pas encore telecharge`);
    if (p.adds.length === 0) console.log('  (rien de nouveau : la famille reste comme elle est)');
    console.log('');
  }
  if (plan.length === 0) console.log('Aucun sample de BD, SD, CP, HH, TOM ou RS trouve.\n');

  if (unknown.length > 0) {
    console.log(`INCONNUS, laisses de cote (${unknown.length}) : range-les dans un dossier BD, SD, CP, HH, TOM ou RS, ou mets kick / snare dans leur nom`);
    for (const f of unknown) console.log(`  ? ${f.rel} : ${f.why}`);
    console.log('');
  }
  if (filtered.length > 0) {
    const by = FAMILIES.map((fam) => [fam, filtered.filter((f) => f.fam === fam).length]).filter(([, n]) => n > 0);
    console.log(`Hors --families : ${by.map(([fam, n]) => `${n} ${fam}`).join(', ')} (laisses de cote)\n`);
  }
  if (acc.other.size > 0) {
    const list = [...acc.other].map(([ext, n]) => `${n} ${ext}`).join(', ');
    console.log(`Pas de l'audio pris en charge (wav aif aiff mp3 flac m4a), ignores : ${list}\n`);
  }
  if (acc.tooDeep.length > 0) notes.push(`dossiers trop profonds (plus de ${MAX_DEPTH} niveaux), pas lus : ${acc.tooDeep.join(', ')}`);
  const aiff = plan.flatMap((p) => p.adds).filter((a) => /\.aiff?$/i.test(a.file));
  if (aiff.length > 0) {
    notes.push(
      `${aiff.length} fichier(s) AIFF : Safari les lit, Chrome et Firefox non (la voix y garde son son calcule). ` +
        'Pour tous les navigateurs, convertis-les en WAV avant (afconvert -f WAVE -d LEI16 "in.aif" "out.wav") et relance.'
    );
  }
  for (const p of plan) {
    const n = p.keep.length + p.adds.length;
    if (n > 8) notes.push(`${p.fam} : ${n} samples, au-dela de 8 la plaque du potard ecrit leur numero au lieu du nom (l'ecran garde les noms)`);
  }

  // Les presets d'usine visent des cles : celles qui disparaitraient
  const after = new Set(plan.flatMap((p) => [...p.keep, ...p.adds].map((x) => `${p.fam}/${x.name ?? x.file}`)));
  const touched = new Set(plan.filter((p) => p.adds.length > 0).map((p) => p.fam));
  const lost = (await codeKeys()).filter((k) => touched.has(k.key.split('/')[0]) && !after.has(k.key));
  if (lost.length > 0 && opts.replace) {
    const byHash = new Map(plan.flatMap((p) => p.adds.map((a) => [a.f.hash, `${p.fam}/${a.file}`])));
    const old = new Map(plan.flatMap((p) => p.removes.map((x) => [`${p.fam}/${x.name}`, x.hash])));
    const uniq = [...new Map(lost.map((k) => [k.key, k])).values()];
    // Depuis R3 (2026-10-08, audio/kit.ts resolveSample) : une cle partie prend le sample du meme numero, sinon le premier de la famille
    console.log(`Presets d'usine : ${uniq.length} cle(s) du code ne trouveront plus leur fichier (ces presets prendront le sample du meme numero, sinon le premier de la famille) :`);
    for (const k of uniq) {
      const same = byHash.get(old.get(k.key));
      console.log(`  ${k.key}  (${k.where})${same ? `  ->  meme son : ${same}` : ''}`);
    }
    console.log('  Dis-le a Claude avec cette liste : il remet les presets sur les nouveaux noms.\n');
  }

  /* ----- les blocages ----- */
  if (placeholders.length > 0) {
    console.log(`iCloud : ${placeholders.length} fichier(s) pas encore telecharge(s) sur ce Mac :`);
    for (const f of placeholders) console.log(`  ! ${f.rel}`);
    if (blocking.length > 0) console.log(`  Telecharge-les (Finder : clic droit sur le dossier, Telecharger maintenant ; ou : brctl download "${SRC}") puis relance.\n`);
    else console.log('  Ils sont hors des familles importees : ils ne bloquent pas cet import.\n');
  }
  for (const n of notes) console.log(`Note : ${n}`);
  if (notes.length > 0) console.log('');
  if (problems.length > 0) console.error(`A regler (${problems.length}) :\n${problems.map((m) => `  ${m}`).join('\n')}\n`);

  const adds = plan.reduce((n, p) => n + p.adds.length, 0);
  const removes = plan.reduce((n, p) => n + p.removes.length, 0);
  const bytes = plan.reduce((n, p) => n + p.adds.reduce((m, a) => m + a.f.data.length, 0), 0);
  const blocked = blocking.length > 0 || problems.length > 0;
  const summary = `${adds} a copier (${kb(bytes)}), ${removes} a retirer, ${unknown.length} inconnu(s), ${placeholders.length} pas telecharge(s)`;

  if (opts.dry) {
    console.log(`APERCU : ${summary}. Rien n'est ecrit.${blocked ? " (Tel quel, l'import s'arreterait : voir plus haut.)" : ''}`);
    console.log(`Pour le faire : npm run samples:import -- "${SRC}"${opts.replace ? ' --replace' : ''}${opts.families ? ` --families ${opts.families.join(',')}` : ''}`);
    process.exit(blocked ? 2 : 0);
  }
  if (blocked) {
    console.error(`RIEN N'EST ECRIT : ${blocking.length > 0 ? `${blocking.length} fichier(s) iCloud pas telecharge(s)` : 'des fichiers illisibles'} (sinon les numeros changeraient au prochain import). Regle-le et relance.`);
    process.exit(2);
  }
  if (adds === 0) {
    console.log(`Rien a copier : ${summary}.`);
    process.exit(0);
  }

  /* ----- l'ecriture ----- */
  writing = true;
  const realOut = path.join(realRoot, 'public', 'samples', 'rytm');
  for (const p of plan) {
    if (p.adds.length === 0) continue;
    await mkdir(p.dir, { recursive: true });
    // Garde-fou : on n'ecrit et ne retire que dans public/samples/rytm/<famille>/ du depot
    const realDir = await realpath(p.dir);
    if (realDir !== path.join(realOut, p.fam)) throw new Error(`dossier inattendu : ${realDir}`);
    for (const x of p.removes) {
      if (path.dirname(x.full) !== p.dir || !AUDIO.test(x.name) || x.name.includes(path.sep)) throw new Error(`refuse de retirer ${x.full}`);
      await unlink(x.full);
    }
    for (const a of p.adds) await writeFile(path.join(p.dir, a.file), a.f.data, { flag: 'wx' });
  }

  const fams = plan.filter((p) => p.adds.length > 0).map((p) => p.fam);
  console.log(`FAIT : ${summary.replace('a copier', 'copie(s)').replace('a retirer', 'retire(s)')}.`);
  for (const p of plan.filter((x) => x.adds.length > 0)) {
    const first = p.keep[0]?.name ?? p.adds[0].file;
    console.log(`  ${p.fam} : ${p.keep.length + p.adds.length} sample(s), le premier (le son par defaut) : ${first}`);
  }
  console.log(`
Prochaines etapes :
  1. Ecoute-les : npm run dev, MM-RYTM, choix de son de ${fams.map((f) => f.toUpperCase()).join(' / ')}
  2. Mets-les en ligne :
     git add public/samples/rytm && git commit -m "Samples de Mika dans MM-RYTM (${fams.join(', ')})" && git push
     (si git push refuse : git pull --rebase puis git push)
  Pour annuler avant le commit : ${UNDO}`);
}

main().catch((e) => {
  console.error(e);
  // Une erreur en pleine copie : git rend les anciens fichiers et retire les nouveaux
  if (writing) console.error(`\nL'import s'est arrete en route. Pour revenir a l'etat d'avant : ${UNDO}`);
  process.exit(1);
});
