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
 * La famille d'un fichier (une par voix depuis le 2026-10-18 : bd, sd, ch,
 * oh, cp, tom, ht, cy ; les huit dossiers de public/samples/rytm/) :
 * - son sous-dossier le plus proche, s'il porte le nom d'une famille (sans
 *   tenir compte des majuscules) : BD, Kick, Kicks, Bassdrum ; SD, Snare,
 *   Snares ; CH, Hat, Hats, Hihat, Closed Hat, CHH ; OH, Open Hat, Open, OHH ;
 *   CP, Clap ; TOM, Low Tom, Floor Tom ; HT, Hi Tom, High Tom, Perc,
 *   Percussion, Conga, Bongo, Shaker, Rim, Rimshot, Cowbell ; CY, Cymbal,
 *   Cym, Crash, Ride (puis le nom du dossier donne lui-meme) ;
 * - sinon un mot de son nom (les memes mots, puis les abreviations BD, SD,
 *   CH, HH, OH, CP, LT, HT, RS, CY), le mot apres le tiret d'abord
 *   (AT Tom Trago - Kick F : un kick) ; "open hat" est un oh (pas un ch),
 *   "hi tom" un ht (pas un tom) ;
 * - sinon il est liste INCONNU et laisse de cote (le ranger dans un dossier
 *   BD ou SD suffit).
 *
 * Le nom propre : les regles de sampleLabel (sans le numero, sans "AT", sans
 * le mot de la famille), plus :
 * - la tonalite en fin de nom (F, G#, Bb) tombe, sauf si deux noms de la
 *   famille deviendraient pareils (alors BluePrint F et BluePrint G) ;
 * - un artiste "Prenom Nom - Kick X" garde son nom (AT Tim Engelhardt -
 *   Kick G : Engelhardt), comme les noms choisis par Mika le 2026-10-05 ;
 * - 18 caracteres au plus (la plaque) ;
 * - un nom que git voit (2026-10-18, chantier S2) : .gitignore ecarte
 *   '* 2.*' et '* 3.*' (les doubles du Finder), et "OT_Kick3" etait devenu
 *   "09 OT 3.wav", present sur le disque, jamais en ligne. Un chiffre seul en
 *   fin de nom se colle au mot d'avant (OT3, Deep2) ; deux noms qui restent
 *   pareils prennent un numero colle (Stein2 ; OT3-2 apres un chiffre) ; et
 *   avant d'ecrire, git check-ignore juge chaque nouveau fichier : un seul
 *   ignore, rien n'est ecrit. Apres l'ecriture, git status doit les voir
 *   tous (sinon les nouveaux sont retires et l'import s'arrete).
 * L'extension d'origine reste. L'ordre : le chemin dans le dossier, en ordre
 * naturel (01 avant 02, 2 avant 10), stable d'un lancement a l'autre.
 *
 * Le vocabulaire (2026-10-18) comprend aussi les noms francais et ceux des
 * packs : Grosse caisse ; Caisse claire, SNR ; Charley, Charleston ; Ouvert
 * (Charley ouvert : oh) ; Percu, Percus, Tom aigu, Tambourin, Clave,
 * Sidestick, Woodblock ; Cymbale, Splash.
 *
 * Options :
 *   --replace         retire d'abord les fichiers audio des familles qui
 *                     recoivent des nouveaux (et seulement celles-la) ; sans
 *                     lui (le defaut, et ce que fait npm run samples:mika),
 *                     les nouveaux s'ajoutent apres les numeros deja la, rien
 *                     n'est retire ni renumerote (un fichier deja present,
 *                     meme contenu, est saute)
 *   --dry             montre le plan sans rien ecrire
 *   --families bd,sd  seulement ces familles (par defaut : toutes celles
 *                     trouvees)
 *   --staged          le dossier de transit de scripts/ableton-samples.mjs :
 *                     la famille est le dossier de premier niveau (bd/ sd/
 *                     ...), le nom ne la change pas, et l'appelant donne les
 *                     etapes suivantes
 *
 * Garde-fous : rien n'est retire hors de public/samples/rytm/<famille>/ (et
 * seulement des fichiers audio) ; un dossier source dans le depot (ou qui le
 * contient) est refuse ; un fichier iCloud pas encore telecharge (un
 * .nom.wav.icloud, ou un fichier sans aucun bloc sur le disque) est signale
 * et rien n'est ecrit tant qu'il manque dans les familles importees (sinon
 * les numeros changeraient au prochain import) ; tout est lu avant de
 * retirer quoi que ce soit ; les cles des presets d'usine (src/v4) qui ne
 * trouveraient plus leur fichier sont listees ; un sample du dossier que git
 * ignore deja (donc pas en ligne) ne compte pas comme present (--help :
 * l'usage).
 *
 * Sans argument : ~/Library/Mobile Documents/com~apple~CloudDocs/User
 * Library/Samples/shots (l'ancien dossier de Mika).
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO, FAMILIES, HOME_DIR, MAX_BYTES, SITE_DIR, UNDO, gitIgnored, gitStatus, natural, safeStem, sha1, siteFiles, suffixed } from './rytm-samples-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SRC = path.join(HOME_DIR, 'Library/Mobile Documents/com~apple~CloudDocs/User Library/Samples/shots');
const OUT = path.join(ROOT, 'public/samples/rytm');
/** Les sous-dossiers explores au plus (un dossier de samples, pas un disque entier). */
const MAX_DEPTH = 8;
/** Vrai des que l'import retire ou ecrit (une erreur ensuite donne UNDO). */
let writing = false;
/** La plaque coupe a 18 caracteres (sampleLabel). */
const MAX_NAME = 18;

/*
 * Les familles qui jouent un echantillon (rytm-samples-lib.mjs, FAMILIES,
 * comme src/v4/audio/samples.ts FAMILY_DIRS) : une par voix depuis le
 * 2026-10-18 (Mika : "un selecteur de sample environ 20 samples dans chacun
 * des voices qui sont en rapport avec les dossiers"), dans l'ordre des pads.
 * hh (les deux charleys) et rs (les rims) n'existent plus : les rims vont
 * dans ht (percussions).
 */
/** Le prefixe d'un nom sans lettre (Kick 3 : BD3, comme BD88 ou BD2550). */
const FAM_TAG = { bd: 'BD', sd: 'SD', ch: 'CH', oh: 'OH', cp: 'CP', tom: 'TOM', ht: 'HT', cy: 'CY' };
const TITLE = {
  bd: 'BD (kicks)',
  sd: 'SD (snares)',
  ch: 'CH (closed hats)',
  oh: 'OH (open hats)',
  cp: 'CP (claps)',
  tom: 'TOM (low toms)',
  ht: 'HT (hi toms, percs, rims)',
  cy: 'CY (cymbals, crashes, rides)',
};

/**
 * Les mots d'une famille : forts (kick, snare...) puis abreviations. Les
 * mots colles (bass drum, hi hat, open hat, hi tom) se lisent aussi en un
 * seul. over : les familles que celle-ci l'emporte sur quand les deux ont un
 * mot fort (open hat : oh, pas ch ; hi tom : ht, pas tom). Un "hat" ou un
 * "hihat" seul est un charley ferme ; "open" seul, un ouvert.
 */
const WORDS = {
  bd: { strong: ['kick', 'kicks', 'kickdrum', 'kickdrums', 'bassdrum', 'bassdrums', 'grossecaisse', 'grossescaisses'], weak: ['bd'] },
  sd: { strong: ['snare', 'snares', 'snaredrum', 'snaredrums', 'caisseclaire', 'caissesclaires'], weak: ['sd', 'snr'] },
  ch: {
    strong: ['hat', 'hats', 'hihat', 'hihats', 'closedhat', 'closedhats', 'closedhihat', 'closedhihats', 'closed', 'chh', 'charley', 'charleys', 'charleston', 'charlestons'],
    weak: ['hh', 'ch'],
  },
  oh: { strong: ['openhat', 'openhats', 'openhihat', 'openhihats', 'open', 'ohh', 'ouvert', 'ouverts', 'ouverte', 'ouvertes'], weak: ['oh'], over: ['ch'] },
  cp: { strong: ['clap', 'claps', 'handclap', 'handclaps'], weak: ['cp'] },
  tom: { strong: ['tom', 'toms', 'lowtom', 'lowtoms', 'lotom', 'lotoms', 'floortom', 'floortoms'], weak: ['lt'] },
  ht: {
    strong: [
      'hitom', 'hitoms', 'hightom', 'hightoms', 'tomaigu', 'tomaigus', 'tomsaigus', 'perc', 'percs', 'percu', 'percus', 'percussion', 'percussions',
      'conga', 'congas', 'bongo', 'bongos', 'shaker', 'shakers', 'rim', 'rims', 'rimshot', 'rimshots', 'sidestick', 'sidesticks', 'cowbell', 'cowbells',
      'tambourine', 'tambourines', 'tambourin', 'tambourins', 'clave', 'claves', 'woodblock', 'woodblocks',
    ],
    weak: ['ht', 'rs'],
    over: ['tom'],
  },
  cy: { strong: ['cymbal', 'cymbals', 'cymbale', 'cymbales', 'cym', 'cyms', 'crash', 'crashes', 'ride', 'rides', 'splash', 'splashes'], weak: ['cy'] },
};

/** Ce qu'on retire du nom propre, par famille (seulement les mots de sa famille : AT Tom Trago - Kick F garde Tom). */
const STRIP = {
  bd: { words: 'grosses?\\s?caisses?|kick\\s?drums?|bass\\s?drums?|kicks?', glued: 'kicks?', camel: 'Kicks?|Kickdrums?|Bassdrums?', abbr: 'BD' },
  sd: { words: 'caisses?\\s?claires?|snare\\s?drums?|snares?', glued: 'snares?', camel: 'Snares?', abbr: 'SD|SNR' },
  ch: {
    words: 'closed\\s?hi[\\s-]?hats?|closed\\s?hats?|hi[\\s-]?hats?|hats?|closed|charleys?|charlestons?',
    glued: 'hats?',
    camel: 'Hats?|Hihats?|Closed|Charleys?',
    abbr: 'CH|HH|CHH',
  },
  oh: {
    words: 'open\\s?hi[\\s-]?hats?|open\\s?hats?|hi[\\s-]?hats?|hats?|open|charleys?|charlestons?|ouverte?s?',
    glued: 'hats?',
    camel: 'Hats?|Hihats?|Open|Charleys?',
    abbr: 'OH|OHH',
  },
  cp: { words: 'hand\\s?claps?|claps?', glued: 'claps?', camel: 'Claps?', abbr: 'CP' },
  tom: { words: 'low\\s?toms?|lo\\s?toms?|floor\\s?toms?|toms?', glued: 'toms?', camel: 'Toms?', abbr: 'TOM|LT' },
  ht: {
    words: 'hi(?:gh)?\\s?toms?|toms?|percussions?|percus?|percs?|congas?|bongos?|shakers?|rim\\s?shots?|rims?|cowbells?|tambourin(?:e)?s?',
    glued: 'toms?|percs?',
    camel: 'Toms?|Percs?|Percussions?|Congas?|Bongos?|Shakers?|Rims?|Rimshots?|Cowbells?',
    abbr: 'HT|RS|PERC',
  },
  cy: { words: 'cymbales?|cymbals?|cyms?|crash(?:es)?|rides?|splash(?:es)?', glued: 'cymbals?|crash', camel: 'Cymbals?|Crash(?:es)?|Rides?', abbr: 'CY|CYM' },
};

/**
 * Copie conforme de sampleLabel (src/v4/audio/samples.ts) : le nom que la
 * plaque ecrira pour un fichier du site. A garder identique.
 */
function sampleLabel(file) {
  let t = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
  t = t.replace(/^AT\s+/i, '');
  t = t.replace(/\b(master\s+)?(kicks?|snares?|claps?|hats?|hihats?|toms?|rims?|cymbals?|cyms?)\b/gi, ' ');
  t = t.replace(/(master\s+)?(kicks?|snares?)(?=\d)/gi, ' ');
  t = t.replace(/^\s*(BD|SD|CP|HH|CH|OH|HT|CY|RS)\s+/i, '');
  t = t.replace(/\s+-\s+/g, ' ').replace(/\s-\s*$/, '').replace(/\s+/g, ' ').trim();
  return (t || file).toUpperCase().slice(0, 18);
}

/* ---------------- arguments ---------------- */

const USAGE = `Usage : npm run samples:import -- "/chemin/vers/Samples" [--dry] [--families bd,sd] [--replace]

  (par defaut)      les nouveaux s'ajoutent apres les numeros deja la ; rien n'est retire ni renumerote
  --dry             montre le plan sans rien ecrire
  --families bd,sd  seulement ces familles (bd sd ch oh cp tom ht cy, une par voix ; par defaut : toutes celles trouvees)
  --staged          dossier de transit de scripts/ableton-samples.mjs (la famille est le dossier bd/ sd/ ...)
  --replace         ATTENTION : retire d'abord les anciens fichiers des familles qui en recoivent des nouveaux
                    (les presets d'usine visent bd/01 a 06 et sd/01 a 04 par leur numero)

Sans dossier : ${DEFAULT_SRC}
Tout en une commande, depuis les projets Ableton : npm run samples:mika`;

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
  const o = { replace: false, dry: false, staged: false, families: null, pos: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--replace') o.replace = true;
    else if (a === '--staged') o.staged = true;
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

const expand = (p) => path.resolve(p.trim().replace(/^~(?=$|\/)/, HOME_DIR));

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

/**
 * La famille d'une liste de mots : un mot fort l'emporte sur une abreviation ;
 * une famille qui l'emporte sur une autre (over : open hat est oh, pas ch ;
 * hi tom est ht, pas tom) la fait sortir ; deux familles qui restent = ambigu.
 */
function familyOfWords(words) {
  for (const kind of ['strong', 'weak']) {
    let hit = FAMILIES.filter((f) => WORDS[f][kind].some((w) => words.includes(w)));
    if (hit.length > 1) hit = hit.filter((f) => !hit.some((g) => WORDS[g].over?.includes(f)));
    if (hit.length === 1) return { fam: hit[0] };
    if (hit.length > 1) return { ambiguous: hit };
  }
  return null;
}

/** Les familles jumelles (2026-10-18) : un dossier Hats range les deux charleys et le nom dit lequel ; de meme un dossier Toms. */
const SIBLING = { ch: 'oh', oh: 'ch', tom: 'ht', ht: 'tom' };

/** La famille que dit le nom du fichier : le mot apres le tiret d'abord ("AT Tom Trago - Kick F" est un kick), puis tout le nom. */
function familyOfName(file) {
  const base = file.name.replace(/\.[^.]+$/, '');
  const parts = base.split(/\s+-\s+/);
  if (parts.length > 1) {
    const r = familyOfWords(tokens(parts[parts.length - 1]));
    if (r?.fam) return { fam: r.fam, via: `nom (${parts[parts.length - 1].trim()})` };
  }
  const r = familyOfWords(tokens(base));
  if (r?.fam) return { fam: r.fam, via: 'nom' };
  if (r?.ambiguous) return { fam: null, why: `plusieurs familles dans le nom (${r.ambiguous.join(', ')})` };
  return { fam: null, why: 'aucun dossier ni mot de famille' };
}

/**
 * La famille d'un fichier : son dossier le plus proche, puis son nom. Dans un
 * dossier de charleys ou de toms, le nom choisit la jumelle (Hats/Open Hat
 * 01.wav : oh ; Toms/Hi Tom.wav : ht), sinon le dossier fait foi.
 */
function classify(file, srcBase, staged = false) {
  const dirs = file.rel.split(path.sep).slice(0, -1);
  // Le dossier de transit de scripts/ableton-samples.mjs : la famille est decidee, le dossier la dit
  if (staged) {
    return dirs.length === 1 && FAMILIES.includes(dirs[0]) ? { fam: dirs[0], via: `transit ${dirs[0]}/` } : { fam: null, why: 'hors des dossiers de transit (bd/ sd/ ch/ ...)' };
  }
  const byName = familyOfName(file);
  const refine = (fam, via) => (byName.fam && SIBLING[fam] === byName.fam ? { fam: byName.fam, via: `${via}, ${byName.via}` } : { fam, via });
  for (const d of [...dirs].reverse()) {
    const r = familyOfWords(tokens(d));
    if (r?.fam) return refine(r.fam, `dossier ${d}`);
  }
  const own = familyOfWords(tokens(srcBase));
  if (own?.fam) return refine(own.fam, `dossier ${srcBase}`);
  return byName;
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
  // Le numero d'ordre en tete (1, 01, 12) ; 707, 808, 909 sont des noms (909 Long garde 909)
  const strip = (t0, dropNumber) => {
    let t = t0;
    if (dropNumber) t = t.replace(/^\s*\d{1,2}\s*[-.]?\s+/, '');
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
  // Plus rien du tout (Low Tom, Rimshot, Ride Cymbal : que des mots de la famille) : le nom du fichier tel quel,
  // plutot que SAMPLE (2026-10-18, les familles ht et cy strippent beaucoup de mots)
  if (!full) full = tidy(base.replace(/^\s*\d{1,2}\s*[-.]?\s+/, '').replace(/^AT\s+/i, ''));
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
  const list = [short, key ? `${short} ${key}` : short, noKey, key ? `${noKey} ${key}` : noKey].map((x) => gitSafe(cut(x, MAX_NAME), fam));
  return [...new Set(list)];
}

/**
 * Un nom que git voit (2026-10-18) : "13 OT 3.wav" tomberait sous la regle
 * '* 3.*' de .gitignore. Un chiffre seul en fin de nom se colle au mot
 * d'avant (OT3) ; un nom fait d'un numero d'un ou deux chiffres prend le
 * sigle de la famille, comme BD88 (Kick 3 : BD3 ; Closed Hat 01 : CH01 ;
 * "13 3.wav" serait ignore, "13 01.wav" ne dirait rien). Un nombre de trois
 * chiffres et plus est un nom (707), et Psy 02 reste Psy 02.
 */
function gitSafe(stem, fam) {
  const s = safeStem(stem);
  return /^\d{0,2}$/.test(s) ? `${FAM_TAG[fam]}${s}` : s;
}

/** Le numero en tete d'un nom de fichier (03 Engelhardt.wav : 3), ou 0. */
const leadNumber = (f) => Number(f.match(/^\s*(\d+)/)?.[1] ?? 0);
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${n > 0 ? Math.max(1, Math.round(n / 1024)) : 0} Ko`);

/**
 * Donne a chaque nouveau fichier son nom : chacun commence par son nom le
 * plus court ; tant que deux noms (ou un nom deja dans la famille) donnent la
 * meme plaque, ceux-la passent au nom suivant ; au bout, un numero colle
 * (Stein2, OT3-2 : jamais " 2" ni " 3", que .gitignore cacherait).
 */
function assignNames(items, taken, fam) {
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
    for (let k = 2; used.has(sampleLabel(`01 ${name}.wav`)); k += 1) name = suffixed(gitSafe(cut(it.cands[level[i]], MAX_NAME - String(k).length - 1), fam), k);
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
      for (const m of text.matchAll(/['"`]((?:bd|sd|ch|oh|cp|tom|ht|cy)\/[^'"`\n]+\.(?:wav|aiff?|mp3|flac|m4a|ogg))['"`]/gi)) {
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
  console.log(`Mode : ${opts.dry ? "APERCU (--dry, rien n'est ecrit)" : 'copie'}${opts.replace ? ', --replace (les anciens des familles concernees sont retires)' : ', ajout apres les numeros deja la (rien n\'est retire ni renumerote)'}${opts.staged ? ', dossier de transit' : ''}${opts.families ? `, familles : ${opts.families.join(' ')}` : ''}\n`);

  const acc = await walk(SRC, '', 0, { audio: [], other: new Map(), unreadable: [], tooDeep: [] });
  const srcBase = path.basename(SRC);
  for (const f of acc.audio) Object.assign(f, classify(f, srcBase, opts.staged));
  acc.audio.sort((a, b) => natural(a.rel, b.rel));
  // Ce qui est deja sur le site, et ce que git ignore (sur ce disque, jamais en ligne)
  const site = await siteFiles(ROOT);

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
    const here = site.byFam.get(fam) ?? [];
    const existing = here.filter((x) => !x.ignored).map((x) => ({ name: x.name, full: x.full, hash: x.hash, label: sampleLabel(x.name) }));
    const hidden = here.filter((x) => x.ignored);
    if (hidden.length > 0) {
      notes.push(`${fam} : ${hidden.length} fichier(s) que git ignore, donc jamais en ligne, pas comptes : ${hidden.map((x) => `${x.name} (${x.ignored})`).join(', ')} ; renomme-les sans " 2" ni " 3" a la fin, ou retire-les`);
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
      const twinHere = !opts.replace && existing.find((x) => x.hash === f.hash);
      if (twinHere) {
        f.skip = `deja la : ${fam}/${twinHere.name}`;
        continue;
      }
      items.push({ f, cands: candidates(f, fam) });
    }
    const keep = opts.replace ? [] : existing;
    const start = opts.replace ? 1 : Math.max(0, ...keep.map((x) => leadNumber(x.name)), keep.length) + 1;
    const names = assignNames(items, new Set(keep.map((x) => x.label)), fam);
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
  if (plan.length === 0) console.log('Aucun sample de BD, SD, CH, OH, CP, TOM, HT ou CY trouve.\n');

  if (unknown.length > 0) {
    console.log(`INCONNUS, laisses de cote (${unknown.length}) : range-les dans un dossier BD, SD, CH, OH, CP, TOM, HT ou CY, ou mets kick / snare / hat / open / clap / tom / perc / cymbal dans leur nom`);
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
  const crowded = plan.filter((p) => p.keep.length + p.adds.length > 8).map((p) => `${p.fam} ${p.keep.length + p.adds.length}`);
  if (crowded.length > 0) notes.push(`plus de 8 samples (${crowded.join(', ')}) : la plaque du potard ecrit leur numero au lieu du nom (l'ecran garde les noms)`);

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

  /* ----- git verra-t-il les nouveaux ? ----- */
  // .gitignore ecarte '* 2.*' et '* 3.*' : un nouveau fichier ignore jouerait ici et manquerait en ligne
  const newRels = plan.flatMap((p) => p.adds.map((a) => `${SITE_DIR}/${p.fam}/${a.file}`.normalize('NFC')));
  const ig = gitIgnored(ROOT, newRels);
  const hiddenNew = newRels.filter((r) => ig.ignored.has(r));
  if (!ig.ok && newRels.length > 0) notes.push(`pas de verification git (${ig.why}) : verifie a la main que git status voit les nouveaux fichiers`);
  if (hiddenNew.length > 0) {
    console.error(`GIT LES IGNORERAIT (${hiddenNew.length}) : ces nouveaux fichiers resteraient sur ce disque et n'iraient jamais en ligne :`);
    for (const r of hiddenNew) console.error(`  x ${r}  (${ig.ignored.get(r)})`);
    console.error('');
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
  const blocked = blocking.length > 0 || problems.length > 0 || hiddenNew.length > 0;
  const summary = `${adds} a copier (${kb(bytes)}), ${removes} a retirer, ${unknown.length} inconnu(s), ${placeholders.length} pas telecharge(s)`;

  if (opts.dry) {
    console.log(`APERCU : ${summary}. Rien n'est ecrit.${blocked ? " (Tel quel, l'import s'arreterait : voir plus haut.)" : ''}`);
    console.log(`Pour le faire : npm run samples:import -- "${SRC}"${opts.replace ? ' --replace' : ''}${opts.staged ? ' --staged' : ''}${opts.families ? ` --families ${opts.families.join(',')}` : ''}`);
    process.exit(blocked ? 2 : 0);
  }
  if (blocked) {
    const why =
      blocking.length > 0
        ? `${blocking.length} fichier(s) iCloud pas telecharge(s) (sinon les numeros changeraient au prochain import)`
        : problems.length > 0
          ? 'des fichiers illisibles'
          : `${hiddenNew.length} nouveau(x) nom(s) que git ignorerait (dis-le a Claude avec la liste ci-dessus)`;
    console.error(`RIEN N'EST ECRIT : ${why}. Regle-le et relance.`);
    process.exit(2);
  }
  if (adds === 0) {
    console.log(`Rien a copier : ${summary}.`);
    process.exit(0);
  }

  /* ----- l'ecriture ----- */
  writing = true;
  const written = [];
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
    for (const a of p.adds) {
      await writeFile(path.join(p.dir, a.file), a.f.data, { flag: 'wx' });
      written.push(path.join(p.dir, a.file));
    }
  }

  // Git doit voir chaque nouveau fichier (non suivi, pas ignore) : sinon ils repartent tous et l'import s'arrete
  const st = ig.ok ? gitStatus(ROOT, SITE_DIR) : null;
  if (st) {
    const visible = new Set(st.filter((e) => e.xy === '??').map((e) => e.rel));
    const unseen = newRels.filter((r) => !visible.has(r));
    if (unseen.length > 0) {
      for (const f of written) await unlink(f).catch(() => {});
      console.error(`ARRETE : git ne voit pas ${unseen.length} nouveau(x) fichier(s) (${unseen.join(', ')}) : les ${written.length} nouveaux sont retires.`);
      if (removes > 0) console.error(`Les anciens retires par --replace reviennent avec : ${UNDO}`);
      process.exit(2);
    }
  }

  const fams = plan.filter((p) => p.adds.length > 0).map((p) => p.fam);
  console.log(`FAIT : ${summary.replace('a copier', 'copie(s)').replace('a retirer', 'retire(s)')}.`);
  for (const p of plan.filter((x) => x.adds.length > 0)) {
    const first = p.keep[0]?.name ?? p.adds[0].file;
    console.log(`  ${p.fam} : ${p.keep.length + p.adds.length} sample(s), le premier (le son par defaut) : ${first}`);
  }
  if (st) console.log(`  git voit les ${newRels.length} nouveaux fichiers (git status public/samples/rytm).`);
  // Appele par scripts/ableton-samples.mjs : c'est lui qui verifie, committe et pousse
  if (opts.staged) return;
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
