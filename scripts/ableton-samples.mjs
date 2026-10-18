#!/usr/bin/env node
/**
 * Les samples que Mika joue vraiment, dans le choix de son du MM-RYTM
 * (2026-10-18, Mika : "je voudrais que tu fasses un selecteur de samples
 * [User Library/Samples/shots] ; la-dedans il y a des dossiers de samples et
 * je voudrais que tu analyses les fichiers qui sont le plus utilises dans mes
 * projets Ableton Live et que tu mettes un selecteur de sample d'environ 20
 * samples dans chacune des voix, en rapport avec les dossiers bien entendu" ;
 * et : "rajouter 10 kicks differents parmi les meilleurs BD que j'ai dans le
 * dossier samples one shots ... je veux avoir la selection dans les Sounds").
 *
 * Chantier S2 (2026-10-18, Mika : "Les samples ont completement disparu...
 * fais ce que je t'ai dit deja deux fois pour les samples des voices !") :
 * tout en UNE commande, depuis le dossier du site, sur son Mac :
 *
 *   git pull --ff-only && npm run samples:mika
 *
 * (npm run samples:mika = ce script avec --publish ; guide :
 * docs/samples-mika.md). Ses sets et ses samples sont sur son Mac, pas dans
 * le depot ; sans dependance, Node 18 ou plus, d'ou que soit le depot
 * (iCloud Drive compris, chemins a espaces).
 *
 *   1. lit tous les Live sets (*.als, hors dossiers Backup et hors le depot
 *      lui-meme) des dossiers de projets : un .als est du XML gzippe ; chaque
 *      <SampleRef> dit quel fichier audio un clip, un Simpler ou un pad de
 *      Drum Rack joue ;
 *   2. retrouve chaque reference dans le dossier shots : par chemin exact
 *      quand il y pointe, sinon par nom de fichier (le dossier parent cite
 *      dans la reference, puis la taille, departagent les homonymes) ;
 *   3. classe le dossier shots par famille de voix (bd sd ch oh cp tom ht cy)
 *      d'apres les mots du sous-dossier le plus proche, sinon du nom de
 *      fichier (--map force un dossier ou un mot) ;
 *   4. AJOUTE, ne remplace jamais : ce qui est deja dans
 *      public/samples/rytm/<famille>/ reste, avec son numero (01 BluePrint est
 *      le kit par defaut, les presets d'usine visent bd/01 a 06 et sd/01 a 04
 *      par leur numero, oh/01 est le OH par defaut). Chaque famille est
 *      completee jusqu'a sa cible : --per (20) samples en tout ; pour bd, au
 *      moins 10 kicks de plus que ceux d'avant ce script (--bd-new, la demande
 *      de Mika : 12 la, cible 22). Les candidats, du plus joue au moins joue :
 *      le plus de PROJETS distincts (le projet : le dossier du .als, ses
 *      versions comptent une fois), puis le plus de references, puis l'ordre
 *      naturel des noms ; puis, seulement s'il en manque, les jamais joues des
 *      dossiers de la famille. Un candidat deja sur le site (meme contenu,
 *      quel que soit son nom) est saute et ne prend pas de place ; de meme ce
 *      que le site ne saurait pas lire (relecture S2) : un fichier vide, ou
 *      dont le debut n'est ni WAV, AIFF, MP3, FLAC ni M4A (audioKind), et un
 *      AIFF que rien ne convertit (Safari le lit, Chrome et Firefox non : sur
 *      le Mac, afconvert en fait un WAV, qui part sous un nom en .wav) ;
 *   5. les copie dans un dossier de transit (os.tmpdir()/mm-rytm-top-<date>/
 *      <famille>/01 Nom.wav : le numero donne l'ordre) et, avec --import ou
 *      --publish, lance scripts/import-rytm-samples.mjs --staged dessus : ils
 *      s'ajoutent apres les numeros deja la, sous un nom que git voit (jamais
 *      "OT 3.wav", que .gitignore cache : OT3), et l'import s'arrete si git
 *      en ignorerait un ;
 *   6. note ce qu'il a ajoute dans public/samples/rytm/ableton-picks.json
 *      (fichier, empreinte, projets, references) : relance, il ne rajoute
 *      rien (les 10 kicks de plus se comptent sur ceux d'avant lui) ;
 *   7. --publish (npm run samples:mika) : avant tout, refuse s'il y a des
 *      fichiers prepares pour un commit (git add), des changements dans
 *      public/samples/rytm, des commits pas pousses, ou si git pull --ff-only
 *      echoue (rien ne change, il dit quoi faire ; avec --reset-samples, les
 *      fichiers modifies et en trop de public/samples/rytm sont d'abord
 *      sauvegardes dans .admin-backups/rytm-<date>, et un refus qui suit le
 *      dit au lieu de "rien n'a change") ; puis git pull --ff-only,
 *      l'analyse, le plan ; un sample retenu pas telecharge d'iCloud : il le
 *      dit et n'ecrit rien ; puis l'import, et git add des SEULS nouveaux
 *      fichiers de public/samples/rytm (et ableton-picks.json), un commit en
 *      francais (le compte par famille), git push sur la branche suivie
 *      (main : GitHub Actions, pages.yml, met le site a jour). A la fin : par
 *      famille, avant -> apres et les noms ajoutes, et comment annuler.
 * Rien n'est ecrit dans shots ni dans les projets. Sans --import ni
 * --publish, le plan, le dossier de transit et le rapport JSON suffisent a
 * relire avant de se decider ; --dry n'ecrit rien du tout (le rapport
 * seulement si --report ; un AIFF est converti le temps du plan dans un
 * dossier temporaire, efface a la fin).
 *
 *   npm run samples:mika                    tout : analyse, ajout, commit, push
 *   npm run samples:ableton -- --dry        le plan, rien d'ecrit
 *   npm run samples:ableton                 plan + dossier de transit + rapport
 *   npm run samples:ableton -- --import     ... et l'ajout dans public/samples/rytm (sans git)
 *
 * Les familles (2026-10-18, une par voix) : bd sd ch oh cp tom ht cy. Le
 * vocabulaire qui range un dossier ou un nom (sans accents ni majuscules ;
 * deux mots se lisent aussi colles : caisse claire, caisseclaire) : kick
 * kickdrum bassdrum grosse caisse bd ; snare caisse claire snr sd ; closed
 * hat hats hihat charley charleston hh ch (un simple hat est ch sauf si
 * "open" ou "ouvert" est la) ; open openhat ouvert oh ; clap handclap cp ;
 * tom toms lowtom floortom (sauf hi / high / aigu : ht) ; hitom tom aigu perc
 * percu percussion conga bongo shaker rim rimshot sidestick cowbell
 * tambourin clave woodblock ht ; cymbal cymbale cym crash ride splash cy. Le
 * dossier le plus proche decide, le nom affine les deux cas ou une voix se
 * cache dans l'autre (Hats/Open Hat.wav : oh ; Charleys/Charley ouvert.wav :
 * oh ; Toms/Hi Tom.wav : ht). Le reste est INCONNU : --map "Dossier=famille".
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
 * est hors du depot ; le plan s'affiche avant tout import ; une famille deja
 * a sa cible n'est pas touchee ; un sample de shots iCloud pas telecharge
 * (.x.icloud ou sans bloc sur le disque) est MISSING : a telecharger dans le
 * Finder avant (l'import le verifie aussi) ; un .als iCloud pas telecharge
 * n'est jamais lu (le lire le telechargerait) ; --import et --publish
 * s'arretent tant qu'il en manque, sans rien ecrire ; apres l'import, chaque
 * fichier deja la
 * est verifie octet pour octet (sinon pas de commit) ; --publish n'ajoute a
 * git que les nouveaux fichiers et verifie qu'il n'y a rien d'autre dans le
 * commit.
 *
 * L'admin (2026-10-18, Mika : "c'est vraiment une bonne idee, je veux voir
 * les samples dans l'app") : la meme analyse et la meme publication, en
 * fonctions (scan, publish, siteView), pour la page /mm-admin/samples de
 * npm run admin (server.js, scripts/admin-samples-api.mjs). scan rend, voix
 * par voix, les samples du site et TOUS les candidats de shots dans l'ordre
 * du classement, chacun avec son identifiant (une empreinte de son chemin
 * dans shots : le navigateur ne donne jamais de chemin), le nom qu'il aurait
 * sur le site, et le choix automatique de la commande coche d'avance ;
 * publish ajoute les seuls samples choisis (des identifiants), avec les
 * memes refus et les memes garanties que --publish, et un commit qui dit
 * "choisis dans l'admin". Le CLI ne change pas : meme sortie, memes codes de
 * sortie (main ne tourne que lance comme script).
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { AFCONVERT, AUDIO, FAMILIES, HOME_DIR, MAX_BYTES, SITE_DIR, UNDO, aiffToWav, audioKind, git, gitIgnored, gitStatus, natural, sha1, siteFiles, suffixed } from './rytm-samples-lib.mjs';
import { assignNames, candidates as nameCandidates, leadNumber, sampleLabel } from './import-rytm-samples.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_SCRIPT = path.join(ROOT, 'scripts/import-rytm-samples.mjs');
/** ~ sur le Mac (MM_SAMPLES_HOME pour un faux Mac, rytm-samples-lib.mjs) */
const HOME = HOME_DIR;
const ICLOUD = path.join(HOME, 'Library/Mobile Documents/com~apple~CloudDocs');
const DEFAULT_SHOTS = path.join(ICLOUD, 'User Library/Samples/shots');
const DEFAULT_PROJECTS = ['Music/Ableton', 'Music', 'Documents', 'Desktop'].map((d) => path.join(HOME, d)).concat(ICLOUD);
/** Les dossiers qu'on ne fouille pas pour les sets (sans tenir compte des majuscules), les caches non plus. */
const SKIP_DIRS = new Set(['backup', 'samples', 'ableton project info', 'node_modules', '.git', 'library', '.trash']);
const MAX_DEPTH = 8;
/** Au-dela, un set decompresse ne tient plus dans une chaine : saute et signale. */
const MAX_XML = 480 * 1024 * 1024;
const MAX_STAGED_NAME = 60;
const PROGRESS_EVERY = 25;
/** Ce que ce script a ajoute au site (relance : rien de plus ; les 10 kicks de plus se comptent sans eux). */
const MANIFEST_REL = `${SITE_DIR}/ableton-picks.json`;
const MANIFEST = path.join(ROOT, MANIFEST_REL);
/** La cible d'une famille (--per) et, pour bd, les kicks de plus que ceux d'avant ce script (--bd-new). */
const PER = 20;
const BD_NEW = 10;

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

/**
 * Le vocabulaire d'une famille (mots d'un dossier ou d'un nom, en minuscules,
 * sans accents, colles ou pas : tokens() ajoute les paires collees). Les mots
 * francais et ceux des packs (2026-10-18) : grosse caisse, caisse claire,
 * snr, charley, charleston, ouvert, percu, tom aigu, tambourin, clave,
 * sidestick, woodblock, cymbale, splash. "caisse" seul, "claire" seul ne
 * disent rien (grosse caisse ou caisse claire ?).
 */
const WORDS = {
  bd: ['kick', 'kicks', 'kickdrum', 'kickdrums', 'bassdrum', 'bassdrums', 'grossecaisse', 'grossescaisses', 'bd'],
  sd: ['snare', 'snares', 'snaredrum', 'snaredrums', 'caisseclaire', 'caissesclaires', 'snr', 'sd'],
  ch: ['closed', 'closedhat', 'closedhats', 'chh', 'ch', 'hat', 'hats', 'hihat', 'hihats', 'hh', 'charley', 'charleys', 'charleston', 'charlestons'],
  oh: ['open', 'openhat', 'openhats', 'ohh', 'oh', 'ouvert', 'ouverts', 'ouverte', 'ouvertes'],
  cp: ['clap', 'claps', 'handclap', 'handclaps', 'cp'],
  tom: ['tom', 'toms', 'lowtom', 'lowtoms', 'lotom', 'lotoms', 'floortom', 'floortoms'],
  ht: [
    'hitom', 'hitoms', 'hightom', 'hightoms', 'tomaigu', 'tomaigus', 'tomsaigus', 'perc', 'percs', 'percu', 'percus', 'percussion', 'percussions',
    'conga', 'congas', 'bongo', 'bongos', 'shaker', 'shakers', 'rim', 'rims', 'rimshot', 'rimshots', 'sidestick', 'sidesticks', 'cowbell', 'cowbells',
    'tambourine', 'tambourines', 'tambourin', 'tambourins', 'clave', 'claves', 'woodblock', 'woodblocks', 'ht',
  ],
  cy: ['cymbal', 'cymbals', 'cymbale', 'cymbales', 'cym', 'cyms', 'crash', 'crashes', 'ride', 'rides', 'splash', 'splashes', 'cy'],
};
/** Les mots qui font d'un tom un tom aigu (ht). */
const HI = ['hi', 'high', 'aigu', 'aigus', 'aigue', 'aigues'];
const FAMILY_WORD = new RegExp(`\\b(${FAMILIES.flatMap((f) => WORDS[f]).join('|')})\\b`, 'gi');

/* ---------------- arguments ---------------- */

const USAGE = `Usage : npm run samples:mika                 (tout : analyse, ajout, commit, push)
        npm run samples:ableton -- [options]

  --shots <dossier>        le dossier des samples (defaut : ${DEFAULT_SHOTS})
  --projects <dossier>     un dossier de projets Ableton, repetable (defaut : ~/Music/Ableton, ~/Music,
                           ~/Documents, ~/Desktop et iCloud Drive ; ${MAX_DEPTH} niveaux au plus, sans les dossiers
                           Backup, Samples, Ableton Project Info, node_modules, .git, Library, .Trash, ni le depot)
  --per <n>                samples en tout par famille, ceux deja la compris (defaut : ${PER}) ; rien n'est retire
  --bd-new <n>             bd : au moins n kicks de plus que ceux d'avant ce script (defaut : ${BD_NEW} ; 0 : juste --per)
  --min-projects <n>       un sample compte des n projets distincts (defaut : 1)
  --families bd,sd,...     seulement ces familles (bd sd ch oh cp tom ht cy ; defaut : toutes)
  --map "Dossier=famille"  force un sous-dossier de shots, ou un mot d'un nom de fichier, dans une famille
                           (repetable ; famille : bd sd ch oh cp tom ht cy, ou skip pour l'ecarter)
  --report <fichier.json>  le rapport (defaut : a cote du dossier de transit, mm-rytm-top-<date>-report.json)
  --dry                    le plan seulement : rien d'ecrit (le rapport seulement si --report est donne)
  --import                 apres le plan et le dossier de transit, l'ajout dans public/samples/rytm (sans git)
  --publish                ce que fait npm run samples:mika : git pull --ff-only, le plan, l'ajout, puis
                           git add (les seuls nouveaux samples), git commit, git push
  --reset-samples          avec --publish : remet d'abord public/samples/rytm comme dans le dernier commit
                           (git restore ; avant, les fichiers modifies ici et ceux en trop sont sauvegardes dans
                           .admin-backups/rytm-<date> du dossier du site, que git ignore : rien n'est perdu)
  --help                   cette aide

Sans --dry, --import ni --publish : le plan, le dossier de transit (${path.join(os.tmpdir(), 'mm-rytm-top-<date>')}) et le rapport.`;

/**
 * Un arret voulu (refus, rien a faire, usage) : main le rend en code de
 * sortie, la sortie a le temps de s'ecrire. lines : ce qui a ete dit (le
 * texte du refus, pour l'admin) ; kind : le genre d'arret (shots, staged,
 * dirty, upstream, pull, ahead, missing, picks...), pour que l'admin propose
 * la bonne suite.
 */
export class Stop extends Error {
  constructor(code, lines = [], kind = null) {
    super(lines.length > 0 ? lines.join('\n') : `arret (${code})`);
    this.code = code;
    this.lines = lines;
    this.kind = kind;
  }
}

/**
 * La sortie : la console pour le CLI (git et l'import y ecrivent tout droit,
 * inherit) ; l'admin passe la sienne (log, error, progress), et git et
 * l'import lui sont alors racontes au lieu d'ecrire dans le terminal.
 */
const CONSOLE = { log: (...a) => console.log(...a), error: (...a) => console.error(...a), inherit: true };

function fail(msg, code = 1, io = CONSOLE, kind = 'usage') {
  io.error(`${msg}\n\n${USAGE}`);
  throw new Stop(code, [msg], kind);
}

/**
 * Un lancement : sa sortie, et apres --reset-samples le dossier de
 * sauvegarde (resetBackup : '' s'il n'y avait rien a garder, seulement des
 * fichiers retires, revenus ; null : pas de reset). origin : 'cli' ou
 * 'admin' (le message du commit).
 */
const newRun = (io = CONSOLE, origin = 'cli') => ({ io, inherit: Boolean(io.inherit), origin, resetBackup: null });

/** Ce qu'un refus dit de l'etat du depot : rien n'a change, ou seulement le --reset-samples demande. */
const unchanged = (run) =>
  run.resetBackup === null
    ? "Rien n'a change."
    : `Seul public/samples/rytm a ete remis comme en ligne (${run.resetBackup ? `sauvegarde : ${run.resetBackup}` : 'rien a sauvegarder : des fichiers retires, revenus'}).`;

/** Un refus de --publish : ce qui bloque, quoi faire ; rien n'a change (ou seulement le reset demande : unchanged). */
function refuse(run, lines, code = 2, kind = null) {
  const list = [].concat(lines);
  run.io.error(`\n${list.join('\n')}`);
  throw new Stop(code, list, kind);
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
  const o = {
    shots: DEFAULT_SHOTS,
    projects: [],
    per: PER,
    bdNew: BD_NEW,
    minProjects: 1,
    families: null,
    map: [],
    report: null,
    dry: false,
    import: false,
    publish: false,
    resetSamples: false,
  };
  const int = (v, name, min = 1) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min) fail(`${name} attend un entier ${min > 0 ? 'positif' : 'positif ou nul'} (recu : ${v})`);
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
      case '--bd-new':
        o.bdNew = int(value(), a, 0);
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
      case '--publish':
        o.publish = true;
        o.import = true;
        break;
      case '--reset-samples':
        o.resetSamples = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        throw new Stop(0);
      default:
        fail(`Option inconnue : ${a}`);
    }
  }
  if (o.dry && o.import) fail(`--dry et ${o.publish ? '--publish' : '--import'} ensemble : choisis (le plan seul, ou le plan puis l'ajout)`);
  if (o.resetSamples && !o.publish) fail('--reset-samples va avec --publish (npm run samples:mika -- --reset-samples)');
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
  o.reportGiven = o.report !== null;
  return o;
}

/* ---------------- outils ---------------- */

const norm = (s) => s.normalize('NFC').toLowerCase();
const inside = (a, b) => a === b || a.startsWith(b + path.sep);
const plural = (n, s) => `${n} ${s}${n > 1 ? 's' : ''}`;
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${n > 0 ? Math.max(1, Math.round(n / 1024)) : 0} Ko`);
const stemOf = (file) => file.replace(/\.[^.]+$/, '');

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
 * hat avec "open" ou "ouvert" est oh ; un tom avec "hi" / "high" / "aigu"
 * est ht. Deux familles dans les mots : ambigu (null, avec la liste).
 */
function familyOfWords(words, map) {
  for (const w of words) if (map.has(w)) return { fam: map.get(w), via: 'map' };
  const hit = new Set(FAMILIES.filter((f) => WORDS[f].some((w) => words.includes(w))));
  if (hit.has('ch') && (hit.has('oh') || words.includes('open'))) {
    hit.delete('ch');
    hit.add('oh');
  }
  if (hit.has('tom') && (HI.some((w) => words.includes(w)) || hit.has('ht'))) {
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
    if (hit.fam === 'ch' && own.some((w) => WORDS.oh.includes(w))) return { fam: 'oh', via: `${hit.via} + nom (ouvert)` };
    if (hit.fam === 'tom' && own.some((w) => HI.includes(w) || WORDS.ht.includes(w))) return { fam: 'ht', via: `${hit.via} + nom (aigu)` };
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

/**
 * Tous les .als sous un dossier de projets, hors Backup et dossiers ecartes
 * (le depot et shots compris : acc.skip, leurs chemins reels) ; les .als
 * iCloud pas telecharges comptes a part, jamais lus : l'ancien placeholder
 * .Nom.als.icloud, et depuis macOS Sonoma le fichier "dataless" sous son vrai
 * nom (une taille, aucun bloc sur le disque, drapeau SF_DATALESS). Le lire
 * forcerait son telechargement : avec "Optimiser le stockage", des annees de
 * sets et de versions dans iCloud Drive, ~/Desktop et ~/Documents.
 */
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
      if (acc.skip.has(norm(full))) continue;
      if (depth >= MAX_DEPTH) {
        acc.tooDeep.push(full);
        continue;
      }
      await walkSets(full, depth + 1, acc);
    } else if (e.isFile() && /\.als$/i.test(name) && !acc.seen.has(full)) {
      acc.seen.add(full);
      // iCloud, nouveau style : la taille est la mais aucun bloc sur le disque (comme walkShots pour l'audio)
      const st = await stat(full).catch(() => null);
      if (st && st.size > 0 && st.blocks === 0 && dataless(full)) {
        acc.icloud.push(full);
        continue;
      }
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
 * Le nom du fichier dans le dossier de transit : sans son numero d'ordre en
 * tete (1 ou 2 chiffres : 909 Long garde 909) ni "AT ", l'extension gardee,
 * 60 caracteres au plus (l'import en tire la
 * plaque). Si sans le numero il ne reste que des mots de famille et des
 * chiffres (Kick 01, 707 Snare), le dossier qui le range passe devant s'il
 * dit autre chose (Techno/Kick 01 : Techno Kick 01, que l'import ecrira
 * Techno 01), sinon le numero est le nom : il reste. Le transit est hors du
 * depot : c'est l'import qui rend le nom final sur pour git (OT 3 : OT3).
 */
function cleanName(file) {
  const ext = path.extname(file.name);
  const base = file.name.slice(0, file.name.length - ext.length).normalize('NFC').replace(/_/g, ' ');
  const lettered = (s) => /\p{L}/u.test(s.replace(FAMILY_WORD, ' '));
  // Un numero d'ordre (1, 01, 12) tombe ; 707, 808, 909 sont des noms : ils restent (909 Long)
  let t = base.replace(/^\s*\d{1,2}\s*[-._]?\s+/, '').replace(/^AT\s+/i, '');
  if (!lettered(t)) {
    const ctx = file.rel
      .split(path.sep)
      .slice(0, -1)
      .reverse()
      .find((d) => lettered(d));
    t = `${ctx ? `${ctx.replace(/_/g, ' ')} ` : ''}${base.replace(/^AT\s+/i, '')}`;
  }
  t = t.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sample';
  if (t.length > MAX_STAGED_NAME) t = t.slice(0, MAX_STAGED_NAME).trim();
  return { stem: t, ext: ext.toLowerCase() };
}

/* ---------------- ce que ce script a deja ajoute ---------------- */

/** public/samples/rytm/ableton-picks.json : { files: { "bd/13 Nom.wav": { sha1, added, projects, refs } } }. */
async function readManifest(io = CONSOLE) {
  let text;
  try {
    text = await readFile(MANIFEST, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { files: {} };
    throw e;
  }
  try {
    const j = JSON.parse(text);
    return { ...j, files: j && typeof j.files === 'object' && j.files ? j.files : {} };
  } catch {
    return fail(`${MANIFEST_REL} est illisible (JSON) : remets-le comme en ligne (git restore ${MANIFEST_REL}) puis relance.`, 2, io, 'manifest');
  }
}

async function writeManifest(m) {
  const files = Object.fromEntries(Object.keys(m.files).sort(natural).map((k) => [k, m.files[k]]));
  const out = {
    about:
      "Les samples ajoutes par npm run samples:mika (scripts/ableton-samples.mjs), tires des projets Ableton de Mika. Le script s'en sert pour ne pas les recompter : les kicks de plus (--bd-new) se comptent sur ceux d'avant lui. A garder avec les samples.",
    files,
  };
  await writeFile(MANIFEST, `${JSON.stringify(out, null, 2)}\n`);
}

/* ---------------- git : avant, et apres ---------------- */

/** Deplace un fichier (le dossier de sauvegarde peut etre sur un autre disque : copie puis retrait). */
async function move(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    await copyFile(from, to);
    await unlink(from);
  }
}

const listOf = (xs, n = 12) => [...xs.slice(0, n).map((x) => `    ${x}`), ...(xs.length > n ? [`    ... et ${xs.length - n} autre(s)`] : [])];

/**
 * Le dossier de sauvegarde de --reset-samples : .admin-backups/rytm-<date>
 * dans le dossier du site (git l'ignore, et macOS ne le vide pas comme le
 * dossier temporaire) ; si git ne l'ignore plus, le Bureau.
 */
function backupDir(stamp) {
  const rel = `.admin-backups/rytm-${stamp}`;
  const ig = gitIgnored(ROOT, [`${rel}/${SITE_DIR}/x.wav`]);
  return ig.ok && ig.ignored.size > 0 ? path.join(ROOT, rel) : path.join(HOME, 'Desktop', `mm-rytm-backup-${stamp}`);
}

/**
 * --publish, avant tout : le depot est-il pret ? Rien n'est change tant que
 * tout n'est pas bon (sauf --reset-samples, demande expres : il sauvegarde
 * d'abord ce qu'il ecrase ou deplace, et les refus qui suivent le disent).
 * Puis git pull --ff-only. Rend la branche, la branche suivie, le depot
 * distant.
 */
async function preflight(opts, stamp, run) {
  run.io.log(`Depot : ${ROOT}`);
  const top = git(ROOT, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) refuse(run, [`REFUS : ${ROOT} n'est pas un depot git (${(top.err || '').trim() || 'git rev-parse'}).`, 'Lance la commande depuis le dossier du site (celui de npm run admin). Rien n\'a change.'], 2, 'repo');
  const rootReal = (await realpath(ROOT)).normalize('NFC');
  const topReal = (await realpath(top.out.trim()).catch(() => top.out.trim())).normalize('NFC');
  if (topReal !== rootReal) refuse(run, [`REFUS : le depot git commence a ${topReal}, pas au dossier du site (${rootReal}). Rien n'a change.`], 2, 'repo');
  const br = git(ROOT, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (br.status !== 0) refuse(run, ["REFUS : git n'est sur aucune branche (HEAD detachee). Reviens sur main : git switch main, puis relance. Rien n'a change."], 2, 'repo');
  const branch = br.out.trim();

  // (a) des fichiers deja prepares pour un commit : ils partiraient avec les samples
  const staged = git(ROOT, ['diff', '--cached', '--name-only', '-z']);
  if (staged.status !== 0) refuse(run, [`REFUS : git diff --cached a echoue (${staged.err.trim()}). Rien n'a change.`], 2, 'repo');
  const stagedList = staged.out.split('\0').filter(Boolean);
  if (stagedList.length > 0) {
    refuse(run, [
      `REFUS : ${plural(stagedList.length, 'fichier')} deja prepare(s) pour un commit (git add) :`,
      ...listOf(stagedList),
      "Ce script ne committe que les samples. Committe-les d'abord (git commit), ou retire-les du commit sans les perdre :",
      '    git restore --staged .',
      "puis relance. Rien n'a change.",
    ], 2, 'staged');
  }

  // La branche suivie d'abord (rien que de la lecture) : un refus ici ne vient jamais apres un --reset-samples
  const up = git(ROOT, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remote = git(ROOT, ['config', `branch.${branch}.remote`]).out.trim();
  const merge = git(ROOT, ['config', `branch.${branch}.merge`]).out.trim();
  if (up.status !== 0 || !remote || remote === '.' || !merge.startsWith('refs/heads/')) {
    refuse(run, [`REFUS : la branche ${branch} ne suit aucune branche d'un depot distant (git pull ne saurait pas d'ou tirer).`, `Branche-la sur GitHub : git branch --set-upstream-to=origin/${branch}, puis relance. Rien n'a change.`], 2, 'upstream');
  }
  const upstream = up.out.trim();

  // Le dossier des samples doit etre celui du dernier commit (un ancien import pas committe fausserait les numeros)
  let st = gitStatus(ROOT, SITE_DIR);
  if (st === null) refuse(run, [`REFUS : git status a echoue. Rien n'a change.`], 2, 'repo');
  if (st.length > 0) {
    const shown = st.map((e) => `${e.xy === '??' ? 'en trop ' : e.xy.includes('D') ? 'retire  ' : 'modifie '} ${e.rel}`);
    if (!opts.resetSamples) {
      refuse(run, [
        `REFUS : public/samples/rytm n'est pas comme dans le dernier commit (${plural(st.length, 'changement')}, un ancien import ?) :`,
        ...listOf(shown),
        'Pour le remettre comme en ligne puis tout refaire, colle :',
        '    npm run samples:mika -- --reset-samples',
        "(les fichiers modifies ici et ceux en trop sont d'abord sauvegardes dans .admin-backups/ du dossier du site, rien n'est perdu.) Rien n'a change.",
      ], 2, 'dirty');
    }
    run.io.log(`--reset-samples : public/samples/rytm remis comme dans le dernier commit (${plural(st.length, 'changement')}) :`);
    for (const l of listOf(shown)) run.io.log(l);
    // D'abord la sauvegarde : un fichier modifie ici (git restore l'ecraserait) est copie, un fichier en trop sera deplace
    const kept = [];
    for (const e of st) {
      if (e.xy === '??' || (await lstat(path.join(ROOT, e.rel)).catch(() => null))?.isFile()) kept.push(e);
    }
    const backup = kept.length > 0 ? backupDir(stamp) : '';
    const modified = kept.filter((e) => e.xy !== '??');
    const extra = kept.filter((e) => e.xy === '??');
    for (const e of modified) {
      const to = path.join(backup, e.rel);
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(path.join(ROOT, e.rel), to);
    }
    if (st.some((e) => e.xy !== '??')) {
      const r = git(ROOT, ['--literal-pathspecs', 'restore', '--worktree', '--', SITE_DIR]);
      if (r.status !== 0) refuse(run, [`REFUS : git restore a echoue (${r.err.trim()}).${modified.length > 0 ? ` Les fichiers modifies sont copies dans ${path.join(backup, SITE_DIR)}.` : ''}`], 2, 'reset');
    }
    for (const e of extra) await move(path.join(ROOT, e.rel), path.join(backup, e.rel));
    run.resetBackup = backup ? path.join(backup, SITE_DIR) : '';
    if (backup) run.io.log(`  sauvegarde (${modified.length} modifie(s) ici, copie(s) avant le reset ; ${extra.length} en trop, deplace(s)) : ${run.resetBackup}`);
    st = gitStatus(ROOT, SITE_DIR);
    if (!st || st.length > 0) refuse(run, [`REFUS : public/samples/rytm reste modifie apres --reset-samples (${(st ?? []).map((e) => `${e.xy} ${e.rel}`).join(', ')}).${backup ? ` Sauvegarde : ${run.resetBackup}` : ''}`], 2, 'reset');
    run.io.log('');
  }

  // (b) git pull --ff-only : seulement une avance rapide, jamais de fusion ni de rebase
  run.io.log(`git pull --ff-only (${branch} <- ${upstream})`);
  const pull = git(ROOT, ['pull', '--ff-only', '--no-rebase'], { inherit: run.inherit });
  // L'admin n'a pas de terminal : ce que git a dit passe par sa sortie, et dans le refus
  const said = run.inherit ? '' : `${pull.out}${pull.err}`.trim();
  if (said) run.io.log(said);
  if (pull.status !== 0) {
    refuse(run, [
      `REFUS : git pull --ff-only n'a pas pu mettre ${branch} a jour depuis ${upstream} (code ${pull.status}). ${unchanged(run)}`,
      ...(said ? ['git a dit :', ...said.split('\n').slice(0, 8).map((l) => `    ${l}`)] : []),
      `Ce qu'il faut faire, selon le message de git juste ${said ? 'ci-dessus' : 'au-dessus'} :`,
      "  - \"Not possible to fast-forward\" / \"divergent\" : tu as des commits ici que GitHub n'a pas, et l'inverse :",
      '      git pull --rebase   puis relance npm run samples:mika',
      '  - "Your local changes ... would be overwritten" : des fichiers modifies ici bloquent la mise a jour :',
      "      git status   (committe-les ou mets-les de cote : git stash), puis relance",
      '  - pas de reseau, mot de passe refuse : regle la connexion a GitHub, puis relance',
    ], 2, 'pull');
  }
  const ahead = Number(git(ROOT, ['rev-list', '--count', '@{u}..HEAD']).out.trim() || 0);
  if (ahead > 0) {
    refuse(run, [
      `REFUS : ${plural(ahead, 'commit')} ici pas encore pousse(s) sur ${upstream} : ils partiraient avec les samples.`,
      `Regarde-les (git log @{u}..), pousse-les d'abord (git push), puis relance. ${unchanged(run)}`,
    ], 2, 'ahead');
  }
  run.io.log('');
  return { branch, upstream, remote, merge, onMain: merge === 'refs/heads/main' };
}

/* ---------------- l'analyse : shots, les sets, le site, le plan ---------------- */

/** Une sortie muette (l'admin qui ne veut que le resultat). */
const QUIET = { log() {}, error() {}, inherit: false };

/**
 * L'identifiant d'un fichier de shots pour l'admin : une empreinte de son
 * chemin relatif a shots (stable d'une analyse a l'autre). Le navigateur ne
 * donne que lui, jamais un chemin.
 */
export const sampleId = (rel) => sha1(rel.normalize('NFC').split(path.sep).join('/')).slice(0, 16);

/** Un chemin relatif ecrit avec des / (l'affichage de l'admin). */
const slash = (rel) => rel.split(path.sep).join('/');

/** Les options sans argument (celles de parseArgs), pour l'admin. */
export function defaults() {
  return {
    shots: DEFAULT_SHOTS,
    projects: [],
    per: PER,
    bdNew: BD_NEW,
    minProjects: 1,
    families: null,
    map: new Map(),
    report: null,
    reportGiven: false,
    dry: false,
    import: false,
    publish: false,
    resetSamples: false,
  };
}

/** Le dossier shots : la, hors du depot, et le depot hors de lui. Rend leurs chemins reels. */
async function locate(opts, run) {
  if (!(await isDir(opts.shots))) fail(`Dossier shots introuvable : ${opts.shots}\nDonne-le : npm run samples:ableton -- --shots "/chemin/vers/shots"`, 1, run.io, 'shots');
  const shotsReal = await realpath(opts.shots);
  const rootReal = await realpath(ROOT);
  if (inside(shotsReal, rootReal)) fail(`Refuse : ${opts.shots} est dans le depot. Donne le dossier de tes samples sur le Mac.`, 1, run.io, 'shots');
  if (inside(rootReal, shotsReal)) fail(`Refuse : ${opts.shots} contient le depot lui-meme.`, 1, run.io, 'shots');
  return { shotsReal, rootReal };
}

/**
 * Un candidat peut-il aller sur le site ? null : oui (f.hash, f.src, f.from
 * sont remplis, son empreinte notee dans cx.seen) ; sinon le saut et pourquoi
 * (relecture S2 : ce que le site ne saurait pas lire ne prend pas de place,
 * le suivant la prend) : vide, trop gros, illisible, pas de l'audio, un AIFF
 * que rien ne convertit, deja sur le site (twin : son nom la-bas), meme
 * contenu qu'un candidat deja retenu (dup). f.kind : son format d'apres son
 * contenu ; f.raw : l'empreinte du fichier tel quel.
 */
async function examine(f, fam, cx) {
  const { known, present, manifestAiff, seen } = cx;
  if (f.size === 0) return { f, why: 'vide (0 octet)' };
  if (f.size > MAX_BYTES) return { f, why: `trop gros (${kb(f.size)}, ${kb(MAX_BYTES)} au plus)` };
  let data;
  try {
    data = await readFile(f.full);
  } catch (e) {
    return { f, why: `illisible (${e.code ?? e.message})` };
  }
  // Le contenu decide, pas l'extension : un texte nomme .wav ou un fichier coupe serait un cran muet
  const kind = audioKind(data);
  f.kind = kind;
  if (!kind) return { f, why: data.length === 0 ? 'vide (0 octet)' : "pas un fichier audio lisible (son debut n'est ni WAV, AIFF, MP3, FLAC ni M4A)" };
  let src = f.full;
  let from = null;
  if (kind === 'aiff') {
    // Safari lit l'AIFF, Chrome et Firefox non : converti en WAV pour le site (afconvert, macOS), sinon ecarte
    from = sha1(data);
    f.raw = from;
    const already = known.get(from) ?? present.find((x) => manifestAiff.get(from) === `${fam}/${x.name}`);
    if (already) return { f, why: `deja sur le site : ${fam}/${already.name}`, twin: already.name };
    if (!AFCONVERT) return { f, why: "AIFF : Chrome et Firefox ne le lisent pas, et afconvert (macOS) n'est pas la pour le convertir en WAV", aiff: true };
    try {
      src = aiffToWav(f.full);
      data = await readFile(src);
    } catch (e) {
      return { f, why: `AIFF, la conversion en WAV a echoue (${e.message})`, aiff: true };
    }
    if (audioKind(data) !== 'wav') return { f, why: "AIFF, la conversion n'a pas donne de WAV", aiff: true };
    if (data.length > MAX_BYTES) return { f, why: `trop gros une fois en WAV (${kb(data.length)}, ${kb(MAX_BYTES)} au plus)` };
  }
  const h = sha1(data);
  if (!from) f.raw = h;
  const twin = known.get(h);
  if (twin) return { f, why: `deja sur le site : ${fam}/${twin.name}`, twin: twin.name };
  const dup = seen.get(h);
  if (dup) return { f, why: `meme contenu que ${dup.rel}`, dup };
  seen.set(h, f);
  f.hash = h;
  // Le fichier a copier en transit (le WAV converti pour un AIFF) et l'empreinte de l'AIFF d'origine
  f.src = src;
  f.from = from;
  return null;
}

/** Les noms de transit (01 Nom.wav : l'ordre), uniques dans la famille (un doublon : Nom2) ; un AIFF converti finit en .wav. */
function nameStaged(items) {
  const taken = new Set();
  let n = 0;
  for (const x of items) {
    if (x.status === 'missing') continue;
    const { stem, ext: own } = cleanName(x.f);
    const ext = x.f.from ? '.wav' : own;
    let s = stem;
    for (let k = 2; taken.has(norm(s + ext)); k += 1) s = suffixed(stem.slice(0, MAX_STAGED_NAME - String(k).length - 1).trim(), k);
    taken.add(norm(s + ext));
    n += 1;
    x.staged = `${String(n).padStart(2, '0')} ${s}${ext}`;
  }
}

/**
 * L'analyse : shots, les sets, ce qui est deja sur le site, et le plan de
 * chaque famille (ce que la commande ajouterait). Ecrit ce que le CLI a
 * toujours ecrit, par run.io ; run.io.progress (l'admin) suit les etapes.
 * Avec candidates, en plus, voix par voix, tous les candidats de shots pour
 * l'admin (listCandidates).
 */
async function analyze(opts, run, { shotsReal, rootReal }, { candidates = false } = {}) {
  const { io } = run;
  const shotsBases = [...new Set([shotsReal, opts.shots].map((p) => norm(p)))];
  // Un chemin relatif a la User Library (Samples/shots/Kicks/x.wav) se resout depuis les dossiers au-dessus de shots
  const shotsAncestors = [];
  for (let d = path.dirname(shotsReal), n = 0; n < 4 && d !== path.dirname(d); d = path.dirname(d), n += 1) shotsAncestors.push(d);

  const given = opts.projects.length > 0;
  const projectRoots = [];
  for (const d of given ? opts.projects : DEFAULT_PROJECTS) {
    if (!(await isDir(d))) {
      if (given) io.log(`Note : dossier de projets introuvable, saute : ${d}`);
      continue;
    }
    const r = await realpath(d);
    if (!projectRoots.includes(r)) projectRoots.push(r);
  }
  // Un dossier contenu dans un autre de la liste (Music/Ableton dans Music) se lit une fois
  const roots = projectRoots.filter((d) => !projectRoots.some((o) => o !== d && inside(d, o)));
  if (roots.length === 0) fail(`Aucun dossier de projets lisible (${(given ? opts.projects : DEFAULT_PROJECTS).join(', ')}). Donne-en un : --projects "/chemin"`, 1, io, 'projects');

  const mode = opts.dry
    ? "APERCU (--dry, rien n'est ecrit)"
    : opts.publish
      ? 'plan, ajout, commit et push (--publish)'
      : opts.import
        ? 'plan, dossier de transit puis AJOUT (sans git)'
        : "plan et dossier de transit (sans ajout)";
  io.log(`Samples joues dans Ableton -> MM-RYTM`);
  io.log(`  shots    : ${opts.shots}`);
  io.log(`  projets  : ${roots.join('\n             ')}`);
  io.log(
    `  mode     : ${mode} ; ${opts.per} par famille en tout${opts.bdNew > 0 ? `, bd : au moins ${opts.bdNew} kicks de plus` : ''}, des ${plural(opts.minProjects, 'projet')}${opts.families ? ` ; familles : ${opts.families.join(' ')}` : ''}${opts.map.size > 0 ? ` ; map : ${[...opts.map].map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`
  );
  io.log("  regle    : ajout apres les numeros deja la, rien n'est retire ni renumerote\n");

  /* ----- shots ----- */
  io.progress?.({ phase: 'shots' });
  const shots = await walkShots(opts.shots, '', 0, { audio: [], unreadable: [], tooDeep: [] });
  for (const f of shots.audio) {
    Object.assign(f, classify(f, opts.map), { projects: new Set(), refs: 0 });
  }
  shots.audio.sort((a, b) => natural(a.rel, b.rel));
  const index = indexShots(shots.audio);
  const placeholders = shots.audio.filter((f) => f.placeholder);
  io.log(`Shots : ${shots.audio.length} fichiers audio${placeholders.length > 0 ? `, ${placeholders.length} pas telecharge(s) d'iCloud` : ''}, ${FAMILIES.map((f) => `${shots.audio.filter((x) => x.fam === f).length} ${f}`).join(', ')}, ${shots.audio.filter((x) => !x.fam && !x.skip).length} inconnu(s)${shots.audio.filter((x) => x.skip).length > 0 ? `, ${shots.audio.filter((x) => x.skip).length} ecarte(s) (--map skip)` : ''}`);
  if (shots.audio.length === 0) fail(`Aucun fichier audio (wav aif aiff mp3 flac m4a) dans ${opts.shots}`, 1, io, 'shots');

  /* ----- les sets ----- */
  io.progress?.({ phase: 'find', files: shots.audio.length });
  const sets = { sets: [], seen: new Set(), icloud: [], backups: 0, unreadable: [], tooDeep: [], skip: new Set([norm(rootReal), norm(shotsReal)]) };
  for (const r of roots) await walkSets(r, 0, sets);
  sets.sets.sort(natural);
  io.log(`Sets : ${plural(sets.sets.length, 'Live set')} (*.als)${sets.backups > 0 ? `, ${plural(sets.backups, 'dossier')} Backup ignore(s)` : ''}${sets.icloud.length > 0 ? `, ${sets.icloud.length} pas telecharge(s) d'iCloud (ignores)` : ''}`);
  if (sets.sets.length === 0) io.log('  Aucun set : les familles seront remplies avec les fichiers du dossier, dans leur ordre.');

  const totals = { refs: 0, matched: 0, unmatched: 0, ambiguous: 0, sizeMismatch: 0, empty: 0, byHow: {} };
  const unmatchedNames = new Map();
  const ambiguities = [];
  const failed = [];
  const projects = new Set();
  for (let i = 0; i < sets.sets.length; i += 1) {
    const set = sets.sets[i];
    const project = path.dirname(set);
    io.progress?.({ phase: 'sets', done: i, total: sets.sets.length, files: shots.audio.length });
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
    if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === sets.sets.length) io.log(`  ${i + 1}/${sets.sets.length} sets lus, ${totals.refs} references, ${totals.matched} dans shots`);
  }
  io.log(`Projets : ${projects.size} distinct(s). References : ${totals.refs}, dont ${totals.matched} vers shots (${Object.entries(totals.byHow).map(([k, v]) => `${v} par ${k}`).join(', ') || 'aucune'}) et ${totals.unmatched} hors de shots${totals.ambiguous > 0 ? ` ; ${totals.ambiguous} homonyme(s) tranche(s) au premier venu` : ''}${totals.sizeMismatch > 0 ? ` ; ${totals.sizeMismatch} meme nom mais autre taille (autre version ?)` : ''}.\n`);

  /* ----- ce qui est deja sur le site ----- */
  const site = await siteFiles(ROOT);
  const manifest = await readManifest(io);
  const manifestHashes = new Set(Object.values(manifest.files).map((x) => x?.sha1).filter(Boolean));
  // Un AIFF deja ajoute (converti en WAV) : son empreinte d'origine -> le fichier du site
  const manifestAiff = new Map(Object.entries(manifest.files).filter(([, x]) => x?.aiffSha1).map(([k, x]) => [x.aiffSha1, k]));

  /* ----- le plan, famille par famille : completer jusqu'a la cible ----- */
  const fams = opts.families ?? FAMILIES;
  const rank = (list) => list.slice().sort((a, b) => b.projects.size - a.projects.size || b.refs - a.refs || natural(a.rel, b.rel));
  const plan = [];
  for (const fam of fams) {
    io.progress?.({ phase: 'plan', fam, files: shots.audio.length, total: sets.sets.length, done: sets.sets.length });
    const all = shots.audio.filter((f) => f.fam === fam);
    const isUsed = (f) => f.projects.size > 0 && f.projects.size >= opts.minProjects;
    const used = rank(all.filter(isUsed));
    const rest = rank(all.filter((f) => !isUsed(f)));
    const onSite = site.byFam.get(fam) ?? [];
    // Un fichier que git ignore est sur ce disque, pas en ligne : il ne compte pas
    const present = onSite.filter((x) => !x.ignored);
    const hidden = onSite.filter((x) => x.ignored);
    const ours = present.filter((x) => manifest.files[`${fam}/${x.name}`] || manifestHashes.has(x.hash));
    const base = present.length - ours.length;
    const target = fam === 'bd' && opts.bdNew > 0 ? Math.max(opts.per, base + opts.bdNew) : opts.per;
    const need = Math.max(0, target - present.length);
    const cx = { known: new Map(present.map((x) => [x.hash, x])), present, manifestAiff, seen: new Map() };
    const items = [];
    const skipped = [];
    for (const f of [...used, ...rest]) {
      if (items.length >= need) break;
      const status = f.placeholder ? 'missing' : f.projects.size === 0 ? 'unused' : f.projects.size < opts.minProjects ? 'under-min' : 'used';
      // Pas telecharge : on ne peut pas savoir s'il est deja la ; il prend sa place et bloque l'ajout
      if (status === 'missing') {
        items.push({ f, status });
        continue;
      }
      const skip = await examine(f, fam, cx);
      if (skip) {
        skipped.push(skip);
        continue;
      }
      items.push({ f, status });
    }
    nameStaged(items);
    plan.push({ fam, all, used, rest, present, hidden, ours, base, target, need, items, skipped, staged: items.filter((x) => x.staged), missing: items.filter((x) => x.status === 'missing'), cx });
  }

  const A = { opts, roots, shots, index, placeholders, sets, totals, unmatchedNames, ambiguities, failed, projects, site, manifest, manifestHashes, manifestAiff, fams, plan };
  if (candidates) {
    io.progress?.({ phase: 'candidates', files: shots.audio.length, total: sets.sets.length, done: sets.sets.length });
    A.families = await listCandidates(A);
  }
  return A;
}

/* ---------------- l'admin : tous les candidats, voix par voix ---------------- */

/**
 * Les noms que des fichiers de transit prendraient sur le site, comme
 * scripts/import-rytm-samples.mjs les donnerait (ses propres fonctions) :
 * le numero apres ceux deja la, le nom propre unique dans la famille.
 */
function siteNames(fam, staged, taken, start) {
  if (staged.length === 0) return [];
  const items = staged.map((name) => {
    const file = { name, rel: path.join(fam, name) };
    return { f: file, cands: nameCandidates(file, fam) };
  });
  const names = assignNames(items, taken, fam);
  const width = Math.max(2, String(start + items.length - 1).length);
  return items.map((it, i) => `${String(start + i).padStart(width, '0')} ${names[i]}${path.extname(it.f.name).toLowerCase()}`);
}

/** Les 12 premiers octets d'un fichier (son format, sans tout lire). */
async function head(full) {
  const fh = await open(full, 'r');
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fh.read(buf, 0, 12, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** L'empreinte d'un fichier tel quel (une fois). */
async function rawHash(f) {
  if (!f.raw) f.raw = sha1(await readFile(f.full));
  return f.raw;
}

/** Ce que l'admin montre des samples du site d'une famille (ceux que git ignore compris, marques). */
function siteList(fam, files, manifest, manifestHashes) {
  return files.map((x) => ({
    n: leadNumber(x.name),
    file: x.name,
    label: sampleLabel(x.name),
    size: x.size,
    ignored: x.ignored || null,
    ours: Boolean(manifest.files[`${fam}/${x.name}`] || manifestHashes.has(x.hash)),
  }));
}

/**
 * Voix par voix, pour l'admin : les samples du site, puis TOUS les fichiers
 * de shots de la famille dans l'ordre du classement (les plus joues, puis les
 * jamais joues), chacun avec ce qu'il faut pour choisir : projets et
 * utilisations, format, lisible ou pourquoi pas, deja sur le site, iCloud, le
 * nom qu'il aurait sur le site, et default (le choix automatique de la
 * commande, coche d'avance). Ceux que le plan a deja examines gardent son
 * verdict ; les autres sont juges sans tout lire (12 octets pour le format,
 * l'empreinte seulement quand une taille egale celle d'un sample du site ou
 * d'un autre candidat).
 */
async function listCandidates(A) {
  const out = {};
  for (const p of A.plan) {
    const ranked = [...p.used, ...p.rest];
    const inPlan = new Map(p.items.map((x) => [x.f, x]));
    const skipped = new Map(p.skipped.map((s) => [s.f, s]));
    const taken = new Set(p.present.map((x) => sampleLabel(x.name)));
    const start = Math.max(0, ...p.present.map((x) => leadNumber(x.name)), p.present.length) + 1;
    const groupFiles = siteNames(p.fam, p.staged.map((x) => x.staged), taken, start);
    const group = new Map(p.staged.map((x, i) => [x.f, groupFiles[i]]));
    const siteSizes = new Set(p.present.map((x) => x.size));
    const sameSize = new Map();
    for (const f of ranked) if (!f.placeholder && f.size > 0) sameSize.set(f.size, (sameSize.get(f.size) ?? 0) + 1);
    const firstByRaw = new Map();
    const list = [];
    for (let i = 0; i < ranked.length; i += 1) {
      const f = ranked[i];
      const folder = slash(path.dirname(f.rel));
      const c = {
        id: sampleId(f.rel),
        rank: i + 1,
        path: slash(f.rel),
        label: '',
        siteFile: '',
        folder: folder === '.' ? '' : folder,
        projects: f.projects.size,
        refs: f.refs,
        unused: f.projects.size === 0,
        bytes: f.size,
        kind: null,
        playable: false,
        alreadyOnSite: false,
        twin: null,
        icloud: Boolean(f.placeholder),
        default: false,
        autoMissing: false,
        aiff: false,
        reason: null,
        dupOf: null,
        via: f.via ?? null,
      };
      const x = inPlan.get(f);
      const s = skipped.get(f);
      if (f.placeholder) {
        c.reason = "pas encore telecharge d'iCloud";
        c.autoMissing = Boolean(x);
      } else if (x) {
        c.default = true;
        c.playable = true;
        c.kind = f.kind ?? null;
        c.aiff = Boolean(f.from);
      } else if (s) {
        c.reason = s.why;
        c.kind = f.kind ?? null;
        c.aiff = Boolean(s.aiff) || f.kind === 'aiff';
        if (s.twin) {
          c.alreadyOnSite = true;
          c.twin = s.twin;
        }
        if (s.dup) {
          // Le meme son qu'un candidat d'avant : lisible (et converti si AIFF), donc choisissable a sa place ; la
          // regle du groupe de la page (un seul du meme son) et pickPlan (deux copies refusees) n'en laissent qu'un
          c.dupOf = sampleId(s.dup.rel);
          c.playable = Boolean(f.kind);
        }
      } else if (f.size === 0) {
        c.reason = 'vide (0 octet)';
      } else if (f.size > MAX_BYTES) {
        c.reason = `trop gros (${kb(f.size)}, ${kb(MAX_BYTES)} au plus)`;
      } else {
        let kind = null;
        try {
          kind = audioKind(await head(f.full));
        } catch (e) {
          c.reason = `illisible (${e.code ?? e.message})`;
        }
        c.kind = kind;
        if (!c.reason && !kind) c.reason = "pas un fichier audio lisible (son debut n'est ni WAV, AIFF, MP3, FLAC ni M4A)";
        if (kind === 'aiff') {
          c.aiff = true;
          // Deja sur le site : le meme AIFF, ou un AIFF deja converti par cette commande (son empreinte d'origine)
          const raw = await rawHash(f);
          const already = p.cx.known.get(raw) ?? p.present.find((y) => A.manifestAiff.get(raw) === `${p.fam}/${y.name}`);
          if (already) {
            c.alreadyOnSite = true;
            c.twin = already.name;
            c.reason = `deja sur le site : ${p.fam}/${already.name}`;
          } else if (!AFCONVERT) c.reason = "AIFF : Chrome et Firefox ne le lisent pas, et afconvert (macOS) n'est pas la pour le convertir en WAV";
          else c.playable = true;
        } else if (kind) {
          const twin = siteSizes.has(f.size) ? p.cx.known.get(await rawHash(f)) : null;
          if (twin) {
            c.alreadyOnSite = true;
            c.twin = twin.name;
            c.reason = `deja sur le site : ${p.fam}/${twin.name}`;
          } else c.playable = true;
        }
      }
      // Le meme son sous un autre nom : le premier du classement le garde, les suivants le disent
      if (!f.placeholder && !c.dupOf && f.size > 0 && (sameSize.get(f.size) ?? 0) > 1 && f.size <= MAX_BYTES) {
        const raw = await rawHash(f).catch(() => null);
        if (raw) {
          const first = firstByRaw.get(raw);
          if (first) c.dupOf = sampleId(first.rel);
          else firstByRaw.set(raw, f);
        }
      }
      // Le nom sur le site : celui du groupe pour le choix automatique, celui de son jumeau s'il y est deja,
      // sinon comme s'il arrivait seul
      let file = group.get(f) ?? (c.alreadyOnSite ? c.twin : null);
      if (!file) {
        const { stem, ext } = cleanName(f);
        file = siteNames(p.fam, [`01 ${stem}${c.aiff || f.from ? '.wav' : ext}`], taken, start)[0];
      }
      c.siteFile = file;
      c.label = sampleLabel(file);
      list.push(c);
    }
    out[p.fam] = {
      title: TITLE[p.fam],
      target: p.target,
      need: p.need,
      present: p.present.length,
      base: p.base,
      ours: p.ours.length,
      files: p.all.length,
      used: p.used.length,
      site: siteList(p.fam, [...p.present, ...p.hidden].sort((a, b) => natural(a.name, b.name)), A.manifest, A.manifestHashes),
      // Le premier numero d'un ajout : la page renumerote les samples coches dans l'ordre du classement, comme la publication
      start,
      candidates: list,
    };
  }
  return out;
}

/**
 * L'analyse pour l'admin (/mm-admin/samples) : rien n'est ecrit (un AIFF du
 * choix automatique est converti le temps de l'analyse, dans le dossier
 * temporaire). Rend { shots, projects, icloud, families: { bd: { site,
 * candidates, target, ... } } } et, a part (files, a ne pas envoyer au
 * navigateur), l'identifiant de chaque fichier de shots -> son chemin, pour
 * l'ecoute. hooks.io : log, error, progress. Un dossier shots introuvable :
 * une erreur Stop (kind 'shots').
 */
export async function scan(options = {}, hooks = {}) {
  const opts = { ...defaults(), ...options, dry: true, import: false, publish: false };
  const run = newRun(hooks.io ?? QUIET, 'admin');
  const started = Date.now();
  const loc = await locate(opts, run);
  const A = await analyze(opts, run, loc, { candidates: true });
  const unknown = A.shots.audio.filter((f) => !f.fam && !f.skip).sort((a, b) => b.projects.size - a.projects.size || natural(a.rel, b.rel));
  const files = new Map(A.shots.audio.map((f) => [sampleId(f.rel), { full: f.full, rel: f.rel, fam: f.fam ?? null, size: f.size, placeholder: f.placeholder ?? null }]));
  return {
    date: new Date(started).toISOString(),
    ms: Date.now() - started,
    root: ROOT,
    shots: {
      path: opts.shots,
      found: true,
      files: A.shots.audio.length,
      placeholders: A.placeholders.length,
      unknown: unknown.length,
      unknownTop: unknown.slice(0, 12).map((f) => ({ path: slash(f.rel), projects: f.projects.size, why: f.why ?? null })),
      unreadable: A.shots.unreadable.length,
    },
    projects: {
      roots: A.roots,
      sets: A.sets.sets.length,
      parsed: A.sets.sets.length - A.failed.length,
      failed: A.failed.length,
      projects: A.projects.size,
      refs: A.totals.refs,
      matched: A.totals.matched,
      unmatched: A.totals.unmatched,
      backups: A.sets.backups,
    },
    icloud: { sets: A.sets.icloud.length, samples: A.placeholders.length },
    afconvert: Boolean(AFCONVERT),
    git: A.site.git,
    options: { per: opts.per, bdNew: opts.bdNew, maxPerVoice: MAX_PER_VOICE },
    families: A.families,
    files,
  };
}

/** Les samples du site seulement (sans shots ni projets) : ce que l'admin montre quand l'analyse ne peut pas se faire. */
export async function siteView() {
  const site = await siteFiles(ROOT);
  const manifest = await readManifest(QUIET);
  const manifestHashes = new Set(Object.values(manifest.files).map((x) => x?.sha1).filter(Boolean));
  const families = {};
  for (const fam of FAMILIES) families[fam] = { title: TITLE[fam], site: siteList(fam, site.byFam.get(fam) ?? [], manifest, manifestHashes) };
  return { root: ROOT, git: site.git, families };
}

/* ---------------- l'ajout, puis git ---------------- */

/** Au plus, par voix, apres une publication de l'admin (au-dela, la liste du potard n'en finit plus). */
export const MAX_PER_VOICE = 40;

/** Un arret apres ecriture : chaque message passe par la sortie (comme avant), le refus les garde. */
function halt(run, code, kind, ...msgs) {
  for (const m of msgs) run.io.error(m);
  throw new Stop(code, msgs.map((m) => m.replace(/^\n+/, '')), kind);
}

/** L'import (scripts/import-rytm-samples.mjs --staged) : dans le terminal pour le CLI, raconte a l'admin. */
async function runImport(args, run) {
  if (run.inherit) return spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const take = (d) => {
      buf += d;
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const l of parts) run.io.log(l);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => resolve({ error, status: null }));
    child.on('close', (status) => {
      if (buf) run.io.log(buf);
      resolve({ error: null, status });
    });
  });
}

/** Le dossier de transit : <famille>/01 Nom.wav, le numero donne l'ordre. */
async function stage(plan, run, staging) {
  const importable = plan.filter((p) => p.staged.length > 0);
  await mkdir(staging, { recursive: true });
  for (const p of importable) {
    const dir = path.join(staging, p.fam);
    await mkdir(dir, { recursive: true });
    for (const x of p.staged) await copyFile(x.f.src ?? x.f.full, path.join(dir, x.staged));
  }
  run.io.log(`Dossier de transit : ${staging} (${importable.map((p) => `${p.fam}/ ${p.staged.length}`).join(', ')})`);
}

/**
 * L'ajout (l'import du dossier de transit), la verification (les anciens
 * intacts octet pour octet, les nouveaux la et vus par git), la liste
 * ableton-picks.json, puis avec --publish (pub) git add des seuls nouveaux,
 * le commit et le push. Rend, par famille, avant -> apres et les noms ajoutes,
 * le commit et si le push est passe. Un arret : Stop (avec la ligne pour
 * revenir en arriere).
 */
async function importAndCommit(A, plan, opts, run, pub, { started, staging }) {
  const { io } = run;
  const { site, manifest } = A;
  const importable = plan.filter((p) => p.staged.length > 0);
  const importArgs = [IMPORT_SCRIPT, staging, '--staged', '--families', importable.map((p) => p.fam).join(',')];
  const importCmd = `node scripts/import-rytm-samples.mjs "${staging}" --staged --families ${importable.map((p) => p.fam).join(',')}`;

  /* ----- l'ajout ----- */
  io.log(`Ajout : ${importCmd}\n`);
  const r = await runImport(importArgs, run);
  if (r.error) throw r.error;
  if (r.status !== 0) {
    halt(
      run,
      r.status || 1,
      'import',
      `\nL'ajout s'est arrete (code ${r.status}) : pas de commit. Le dossier de transit reste la : ${staging}`,
      `Pour revenir a l'etat d'avant (si des fichiers ont ete ecrits) : ${UNDO}`,
      ...(run.resetBackup ? [`La sauvegarde de --reset-samples reste la : ${run.resetBackup}`] : [])
    );
  }

  /* ----- verifier : les anciens intacts, les nouveaux la ----- */
  const after = await siteFiles(ROOT);
  const changed = [];
  const added = new Map();
  for (const p of plan) {
    const now = after.byFam.get(p.fam) ?? [];
    const byName = new Map(now.map((x) => [x.name, x]));
    for (const x of site.byFam.get(p.fam) ?? []) {
      const y = byName.get(x.name);
      if (!y || y.hash !== x.hash) changed.push(`${p.fam}/${x.name}`);
    }
    const before = new Set((site.byFam.get(p.fam) ?? []).map((x) => x.name));
    const byHash = new Map(p.staged.map((x) => [x.f.hash, x]));
    added.set(
      p.fam,
      now.filter((y) => !before.has(y.name)).map((y) => ({ ...y, pick: byHash.get(y.hash) ?? null }))
    );
  }
  if (changed.length > 0) {
    halt(run, 1, 'verify', `\nARRETE : ${plural(changed.length, 'fichier')} deja la a change (${changed.join(', ')}) : ca ne devait pas arriver. Pas de commit.`, `Pour revenir a l'etat d'avant : ${UNDO}`);
  }
  const newFiles = [...added.values()].flat();
  const hiddenNew = newFiles.filter((y) => y.ignored);
  if (hiddenNew.length > 0) {
    halt(run, 1, 'verify', `\nARRETE : git ignore ${hiddenNew.map((y) => y.rel).join(', ')}. Pas de commit. Pour revenir a l'etat d'avant : ${UNDO}`);
  }

  /* ----- noter ce qui vient d'ici (la relance n'en rajoute pas) ----- */
  const day = new Date(started).toISOString().slice(0, 10);
  for (const [fam, list] of added) {
    for (const y of list) {
      manifest.files[`${fam}/${y.name}`] = {
        sha1: y.hash,
        added: day,
        projects: y.pick?.f.projects.size ?? 0,
        refs: y.pick?.f.refs ?? 0,
        ...(y.pick?.f.from ? { aiffSha1: y.pick.f.from } : {}),
        ...(run.origin === 'admin' ? { via: 'admin' } : {}),
      };
    }
  }
  if (newFiles.length > 0) await writeManifest(manifest);

  const lines = plan.map((p) => {
    const list = added.get(p.fam) ?? [];
    const before = p.present.length;
    return { fam: p.fam, before, after: before + list.length, names: list.map((y) => stemOf(y.name)), files: list.map((y) => y.name) };
  });

  /* ----- git : seulement les nouveaux samples ----- */
  let commit = null;
  let pushed = false;
  let subject = null;
  let pushError = null;
  if (pub && newFiles.length > 0) {
    const paths = [...newFiles.map((y) => y.rel), MANIFEST_REL];
    const add = git(ROOT, ['--literal-pathspecs', 'add', '--', ...paths]);
    if (add.status !== 0) {
      halt(run, 1, 'git', `\nARRETE : git add a echoue (${add.err.trim()}). Pas de commit. Pour revenir a l'etat d'avant : git restore --staged ${SITE_DIR} && ${UNDO}`);
    }
    const cached = git(ROOT, ['diff', '--cached', '--name-only', '-z']).out.split('\0').filter(Boolean).map((x) => x.normalize('NFC'));
    const want = new Set(paths.map((x) => x.normalize('NFC')));
    const extra = cached.filter((x) => !want.has(x));
    const lacking = [...want].filter((x) => !cached.includes(x));
    if (extra.length > 0 || lacking.length > 0) {
      git(ROOT, ['--literal-pathspecs', 'restore', '--staged', '--', ...paths]);
      halt(
        run,
        1,
        'git',
        `\nARRETE : le commit ne contiendrait pas exactement les nouveaux samples${extra.length > 0 ? ` (en trop : ${extra.join(', ')})` : ''}${lacking.length > 0 ? ` (manquent : ${lacking.join(', ')})` : ''}. Pas de commit.`,
        `Pour revenir a l'etat d'avant : ${UNDO}`
      );
    }
    const grown = lines.filter((l) => l.after > l.before);
    const counts = grown.map((l) => `${l.fam} +${l.after - l.before}`).join(', ');
    subject = run.origin === 'admin' ? `MM-RYTM : samples de Mika choisis dans l'admin (${counts})` : `MM-RYTM : samples de Mika tires de ses projets Ableton (${counts})`;
    const body = [
      ...grown.map((l) => `${l.fam} : ${l.before} -> ${l.after} (${l.names.join(', ')})`),
      '',
      ...(run.origin === 'admin'
        ? [
            "Choisis par Mika dans l'admin local (npm run admin, /mm-admin/samples) parmi les samples de",
            'ses projets Ableton (scripts/ableton-samples.mjs, publish) ; ajoutes apres les numeros deja',
            `la, rien de retire ni renumerote. Liste : ${MANIFEST_REL}.`,
          ]
        : [
            'npm run samples:mika (scripts/ableton-samples.mjs --publish) : les plus joues dans ses projets',
            'Ableton (projets distincts, puis references), ajoutes apres les numeros deja la ; rien de retire',
            `ni renumerote. Liste : ${MANIFEST_REL}.`,
          ]),
    ].join('\n');
    const c = git(ROOT, ['commit', '-m', subject, '-m', body]);
    if (c.status !== 0) {
      halt(
        run,
        1,
        'git',
        `\nARRETE : git commit a echoue :\n${(c.err || c.out).trim()}`,
        `Les samples sont prets et ajoutes (git add). Regle git (ex. git config user.name "Mika" ; git config user.email ...) puis : git commit -m "Samples MM-RYTM" && git push`,
        `Ou annule tout : git restore --staged ${SITE_DIR} && ${UNDO}`
      );
    }
    commit = git(ROOT, ['rev-parse', '--short', 'HEAD']).out.trim();
    io.log(`\nCommit ${commit} : ${subject}`);
    io.log(`git push ${pub.remote} HEAD:${pub.merge}`);
    const push = git(ROOT, ['push', pub.remote, `HEAD:${pub.merge}`], { inherit: run.inherit });
    if (!run.inherit && `${push.out}${push.err}`.trim()) io.log(`${push.out}${push.err}`.trim());
    pushed = push.status === 0;
    if (!pushed) {
      pushError = [
        `Le commit ${commit} est fait ici mais git push a refuse (code ${push.status}) : le site ne change pas encore.`,
        '  Pour reessayer : git pull --rebase --autostash && git push',
        '  Pour annuler le commit (les nouveaux samples repartent, le reste ne bouge pas) : git reset --keep HEAD~1',
      ];
      io.error(`\n${pushError[0]}`);
      io.error(pushError[1]);
      io.error(pushError[2]);
    }
  }
  return { lines, commit, pushed, subject, pushError, newFiles, importable };
}

/**
 * La publication de l'admin : les samples choisis (picks : { bd: [id...],
 * sd: [...] }, des identifiants de scan, jamais un chemin), ajoutes apres les
 * numeros deja la, commit et push. Les memes refus que --publish d'abord
 * (preflight : fichiers prepares, public/samples/rytm modifie, commits pas
 * pousses, git pull --ff-only qui echoue ; options.resetSamples : comme
 * --reset-samples), puis une nouvelle analyse (apres le pull) et chaque
 * choix revu : encore dans shots et dans sa voix, telecharge d'iCloud,
 * lisible, pas deja sur le site, pas deux fois le meme son, MAX_PER_VOICE au
 * plus. Le moindre souci : rien n'est ecrit. Rend { ok, lines (par voix :
 * avant, apres, noms), commit, pushed, undo } ou { ok: false, refusal: {
 * kind, text } }.
 */
export async function publish(picks, options = {}, hooks = {}) {
  const opts = { ...defaults(), dry: false, import: true, publish: true, resetSamples: Boolean(options.resetSamples) };
  const run = newRun(hooks.io ?? QUIET, 'admin');
  const started = Date.now();
  const stamp = new Date(started).toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const staging = path.join(os.tmpdir(), `mm-rytm-top-${stamp}`);
  try {
    const loc = await locate(opts, run);
    hooks.io?.progress?.({ phase: 'preflight' });
    const pub = await preflight(opts, stamp, run);
    const A = await analyze(opts, run, loc);
    hooks.io?.progress?.({ phase: 'import' });
    const plan = await pickPlan(A, picks, run);
    await stage(plan, run, staging);
    const done = await importAndCommit(A, plan, opts, run, pub, { started, staging });
    if (done.newFiles.length === 0) {
      return { ok: false, refusal: { code: 1, kind: 'nothing', text: `L'ajout n'a rien ecrit de nouveau : pas de commit. ${unchanged(run)}` }, reset: run.resetBackup !== null, resetBackup: run.resetBackup || null };
    }
    // Tout est sur le site (et dans le commit) : le dossier de transit ne sert plus (le CLI le garde, a relire)
    await rm(staging, { recursive: true, force: true });
    return {
      ok: done.pushed,
      lines: done.lines,
      commit: done.commit,
      subject: done.subject,
      pushed: done.pushed,
      pushError: done.pushError,
      branch: pub.branch,
      target: pub.merge.replace('refs/heads/', ''),
      onMain: pub.onMain,
      undo: done.pushed ? `git revert --no-edit ${done.commit} && git push` : 'git reset --keep HEAD~1',
      reset: run.resetBackup !== null,
      resetBackup: run.resetBackup || null,
      manifest: MANIFEST_REL,
    };
  } catch (e) {
    if (e instanceof Stop) return { ok: false, refusal: { code: e.code, kind: e.kind, text: e.lines.join('\n') || e.message }, reset: run.resetBackup !== null, resetBackup: run.resetBackup || null };
    throw e;
  }
}

/** Le plan d'une publication de l'admin : les choix, revus un par un (publish). */
async function pickPlan(A, picks, run) {
  const byId = new Map(A.shots.audio.map((f) => [sampleId(f.rel), f]));
  const bad = [];
  const missing = [];
  const plan = [];
  const done = new Set();
  const asked = picks && typeof picks === 'object' ? picks : {};
  for (const k of Object.keys(asked)) if (!FAMILIES.includes(k)) bad.push(`  ${k} : pas une voix du MM-RYTM (${FAMILIES.join(' ')})`);
  for (const p of A.plan) {
    const ids = Array.isArray(asked[p.fam]) ? asked[p.fam] : [];
    const order = new Map([...p.used, ...p.rest].map((f, i) => [f, i]));
    const chosen = [];
    for (const id of ids) {
      if (done.has(id)) continue;
      done.add(id);
      const f = byId.get(id);
      if (!f) {
        bad.push(`  ${p.fam} : un sample choisi n'est plus dans shots (deplace, renomme ou retire depuis l'analyse ?)`);
        continue;
      }
      if (f.fam !== p.fam) {
        bad.push(`  ${p.fam} : ${slash(f.rel)} est range dans ${f.fam ?? 'aucune voix'}, pas dans ${p.fam}`);
        continue;
      }
      chosen.push(f);
    }
    chosen.sort((a, b) => order.get(a) - order.get(b));
    // Comme le plan : le site d'abord (deja la : saute), puis le meme son deux fois
    const cx = { known: new Map(p.present.map((x) => [x.hash, x])), present: p.present, manifestAiff: A.manifestAiff, seen: new Map() };
    const items = [];
    for (const f of chosen) {
      if (f.placeholder) {
        missing.push(f);
        continue;
      }
      const skip = await examine(f, p.fam, cx);
      if (skip) {
        bad.push(`  ${p.fam} : ${slash(f.rel)} : ${skip.why}`);
        continue;
      }
      items.push({ f, status: f.projects.size > 0 ? 'used' : 'unused' });
    }
    if (p.present.length + items.length > MAX_PER_VOICE) bad.push(`  ${p.fam} : ${p.present.length} sur le site + ${items.length} choisi(s), ${MAX_PER_VOICE} au plus par voix`);
    nameStaged(items);
    plan.push({ ...p, items, skipped: [], staged: items, missing: [] });
  }
  if (missing.length > 0) {
    refuse(run, [
      `RIEN N'EST ECRIT : ${plural(missing.length, 'sample')} choisi(s) pas encore telecharge(s) d'iCloud sur ce Mac :`,
      ...missing.map((f) => `  ! ${slash(f.rel)}`),
      `Telecharge-les d'abord (Finder : clic droit sur le dossier shots, Telecharger maintenant), puis Re-analyser et publie. ${unchanged(run)}`,
    ], 2, 'missing');
  }
  if (bad.length > 0) {
    refuse(run, [`REFUS : la selection ne peut pas aller sur le site telle quelle (${plural(bad.length, 'souci')}) :`, ...bad, `Re-analyser, choisis de nouveau, puis publie. ${unchanged(run)}`], 2, 'picks');
  }
  if (plan.every((p) => p.staged.length === 0)) refuse(run, [`RIEN A PUBLIER : aucun sample choisi. ${unchanged(run)}`], 2, 'nothing');
  return plan;
}

/* ---------------- le tout (le CLI) ---------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const run = newRun(CONSOLE);
  const started = Date.now();
  const stamp = new Date(started).toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const staging = path.join(os.tmpdir(), `mm-rytm-top-${stamp}`);

  const loc = await locate(opts, run);

  /* ----- --publish : le depot pret, a jour ----- */
  const pub = opts.publish ? await preflight(opts, stamp, run) : null;

  const A = await analyze(opts, run, loc);
  const { roots, shots, placeholders, sets, totals, unmatchedNames, ambiguities, failed, projects, site, fams, plan } = A;

  /* ----- le plan ----- */
  const w = (xs, min) => Math.max(min, ...xs);
  for (const p of plan) {
    const why = p.fam === 'bd' && opts.bdNew > 0 && p.target > opts.per ? ` (${p.base} d'avant + ${opts.bdNew} kicks)` : '';
    console.log(
      `${TITLE[p.fam]} -> public/samples/rytm/${p.fam}/ : ${p.present.length} sur le site${p.ours.length > 0 ? ` (dont ${p.ours.length} de ce script)` : ''}, cible ${p.target}${why}, ${p.need > 0 ? `${p.need} a ajouter` : 'complet'}`
    );
    console.log(`  shots : ${plural(p.all.length, 'fichier')}, ${p.used.length} joue(s) dans des projets`);
    for (const x of p.hidden) console.log(`  ~ ${x.name} : git l'ignore (${x.ignored}), il n'est pas en ligne et ne compte pas`);
    if (p.need === 0) {
      console.log('  (rien a ajouter)\n');
      continue;
    }
    if (p.items.length === 0) {
      console.log(p.all.length === 0 ? `  (rien dans shots pour cette famille : range un dossier ou --map "Dossier=${p.fam}")` : '  (plus rien de nouveau dans shots pour cette famille)');
      for (const s of p.skipped) console.log(`  = ${s.f.rel} : ${s.why}`);
      console.log('');
      continue;
    }
    const ws = w(p.items.map((x) => x.f.rel.length), 18);
    const wn = w(p.items.map((x) => (x.staged ?? 'MISSING').length), 8);
    console.log(`  ${'#'.padStart(3)} ${'proj'.padStart(4)} ${'refs'.padStart(4)}  ${'source (shots/...)'.padEnd(ws)}  ${'transit'.padEnd(wn)}  via`);
    p.items.forEach((x, i) => {
      const flag = x.status === 'missing' ? '!' : x.status === 'used' ? '+' : '.';
      const tail = [
        x.status === 'missing' ? 'MISSING (iCloud, pas telecharge)' : x.status === 'unused' ? 'jamais joue' : x.status === 'under-min' ? `sous ${opts.minProjects} projets` : '',
        x.f.from ? 'AIFF -> WAV' : '',
      ].filter(Boolean).join(', ');
      console.log(`  ${flag}${String(i + 1).padStart(2)} ${String(x.f.projects.size).padStart(4)} ${String(x.f.refs).padStart(4)}  ${x.f.rel.padEnd(ws)}  ${(x.staged ?? 'MISSING').padEnd(wn)}  ${x.f.via}${tail ? `  [${tail}]` : ''}`);
    });
    for (const s of p.skipped) console.log(`  = ${s.f.rel} : ${s.why}`);
    if (p.items.length < p.need) console.log(`  (seulement ${p.items.length} de nouveau(x) dans shots pour ${p.need} places : la famille aura ${p.present.length + p.items.length})`);
    const consumed = new Set([...p.items, ...p.skipped].map((x) => x.f));
    const left = p.used.filter((f) => !consumed.has(f)).length;
    if (left > 0) console.log(`  ... et ${left} autre(s) joue(s) dans des projets, au-dela de la cible`);
    console.log('');
  }

  const unknown = shots.audio.filter((f) => !f.fam && !f.skip).sort((a, b) => b.projects.size - a.projects.size || natural(a.rel, b.rel));
  if (unknown.length > 0) {
    const show = unknown.slice(0, 40);
    console.log(`INCONNUS (${unknown.length}), laisses de cote : range-les dans un dossier Kicks / Snares / Hats / Open Hats / Claps / Toms / Percs / Cymbals, ou force-les : --map "Dossier=famille" (familles : ${FAMILIES.join(' ')})`);
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
    console.log(`Hors de shots : ${totals.unmatched} reference(s) vers ${unmatchedNames.size} fichier(s) d'ailleurs (packs, autres dossiers), les plus frequents : ${top.map(([nm, c]) => `${nm} (${c})`).join(', ')}\n`);
  }
  const notes = [];
  if (failed.length > 0) notes.push(`${plural(failed.length, 'set')} illisible(s) : ${failed.slice(0, 5).join(' ; ')}${failed.length > 5 ? ' ...' : ''}`);
  if (sets.icloud.length > 0) notes.push(`${sets.icloud.length} set(s) iCloud pas telecharge(s), pas lus (les lire les telechargerait ; pour qu'ils comptent : Finder, Telecharger maintenant, puis relance)`);
  if (sets.tooDeep.length > 0) notes.push(`dossiers trop profonds (plus de ${MAX_DEPTH} niveaux), pas lus : ${sets.tooDeep.slice(0, 3).join(', ')}${sets.tooDeep.length > 3 ? ' ...' : ''}`);
  if (shots.tooDeep.length > 0) notes.push(`shots : dossiers trop profonds, pas lus : ${shots.tooDeep.join(', ')}`);
  for (const u of [...shots.unreadable, ...sets.unreadable]) notes.push(`illisible : ${u}`);
  if (!site.git) notes.push(`git ne repond pas ici (${site.gitWhy}) : les fichiers que git ignorerait ne sont pas reperes`);
  const converted = plan.flatMap((p) => p.staged).filter((x) => x.f.from);
  if (converted.length > 0) notes.push(`${converted.length} AIFF converti(s) en WAV (afconvert) : Chrome et Firefox ne lisent pas l'AIFF`);
  const aiffOut = plan.flatMap((p) => p.skipped).filter((s) => s.aiff);
  if (aiffOut.length > 0) {
    notes.push(
      `${aiffOut.length} AIFF laisse(s) de cote (Chrome et Firefox ne les lisent pas, et ${AFCONVERT ? 'la conversion en WAV a echoue : voir plus haut' : 'rien ne les convertit ici'}) : le suivant a pris leur place${AFCONVERT ? '' : ' ; sur le Mac, afconvert les convertit tout seul'}`
    );
  }
  const dead = plan.flatMap((p) => p.skipped).filter((s) => /^vide|^pas un fichier audio/.test(s.why));
  if (dead.length > 0) notes.push(`${dead.length} fichier(s) vide(s) ou qui ne sont pas de l'audio, laisse(s) de cote : ${dead.slice(0, 5).map((s) => s.f.rel).join(', ')}${dead.length > 5 ? ' ...' : ''}`);
  for (const nt of notes) console.log(`Note : ${nt}`);
  if (notes.length > 0) console.log('');

  const missing = plan.flatMap((p) => p.missing);
  if (missing.length > 0) {
    console.log(`MISSING : ${missing.length} sample(s) retenu(s) pas encore telecharge(s) d'iCloud sur ce Mac :`);
    for (const x of missing) console.log(`  ! ${x.f.rel}`);
    console.log(`  Telecharge-les d'abord (Finder : clic droit sur le dossier shots, Telecharger maintenant ; ou : brctl download "${opts.shots}") puis relance : sinon ils manqueront au potard et les numeros changeraient au prochain ajout.\n`);
  }

  const importable = plan.filter((p) => p.staged.length > 0);
  const total = plan.reduce((n, p) => n + p.staged.length, 0);
  const importCmd = importable.length > 0 ? `node scripts/import-rytm-samples.mjs "${staging}" --staged --families ${importable.map((p) => p.fam).join(',')}` : null;

  /* ----- le rapport ----- */
  const report = {
    date: new Date(started).toISOString(),
    shots: opts.shots,
    projectRoots: roots,
    options: { per: opts.per, bdNew: opts.bdNew, minProjects: opts.minProjects, families: fams, map: Object.fromEntries(opts.map), dry: opts.dry, import: opts.import, publish: opts.publish },
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
          site: p.present.map((x) => x.name),
          siteIgnoredByGit: p.hidden.map((x) => x.name),
          addedByThisScript: p.ours.map((x) => x.name),
          target: p.target,
          need: p.need,
          plan: p.items.map((x, i) => ({ rank: i + 1, rel: x.f.rel, projects: x.f.projects.size, refs: x.f.refs, via: x.f.via, status: x.status, staged: x.staged ?? null, aiffToWav: Boolean(x.f.from) })),
          skipped: p.skipped.map((s) => ({ rel: s.f.rel, why: s.why })),
          ranked: p.used.map((f) => ({ rel: f.rel, projects: f.projects.size, refs: f.refs, projectDirs: [...f.projects].sort(natural) })),
        },
      ])
    ),
    staging: opts.dry || total === 0 ? null : staging,
    importCommand: importCmd,
    notes,
  };
  // A cote du dossier de transit, pas dedans (l'import n'y lit que l'audio)
  const reportPath = opts.reportGiven ? opts.report : `${staging}-report.json`;
  const saveReport = async () => {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`Rapport : ${reportPath}`);
  };

  const summary = `${total} sample(s) a ajouter dans ${importable.length} famille(s) (${importable.map((p) => `${p.staged.length} ${p.fam}`).join(', ') || 'aucune'}), ${missing.length} MISSING, ${unknown.length} inconnu(s)`;

  if (opts.dry) {
    if (opts.reportGiven) await saveReport();
    console.log(`APERCU : ${summary}. Rien n'est ecrit.`);
    console.log(`Pour tout faire d'un coup (ajout, commit, push) : npm run samples:mika${rerunArgs(opts)}`);
    throw new Stop(missing.length > 0 ? 2 : 0);
  }
  // Un sample retenu pas telecharge : rien n'est ecrit (ni transit, ni site)
  if (missing.length > 0 && opts.import) {
    console.error(`RIEN N'EST ECRIT : ${missing.length} sample(s) retenu(s) pas telecharge(s) d'iCloud (liste ci-dessus). Telecharge-les dans le Finder, puis relance la meme commande.${run.resetBackup !== null ? ` ${unchanged(run)}` : ''}`);
    throw new Stop(2);
  }
  if (total === 0) {
    if (opts.reportGiven) await saveReport();
    console.log(`RIEN A AJOUTER : ${summary}. Chaque famille est a sa cible (${plan.map((p) => `${p.fam} ${p.present.length}/${p.target}`).join(', ')}) ou n'a plus rien de nouveau dans shots.`);
    if (opts.publish) console.log(`Pas de commit. ${unchanged(run)}`);
    throw new Stop(0);
  }

  /* ----- le dossier de transit ----- */
  await stage(plan, run, staging);
  await saveReport();
  console.log(`PLAN : ${summary}.\n`);

  if (!opts.import) {
    if (missing.length > 0) console.error(`ATTENTION : ${missing.length} sample(s) retenu(s) manquent (iCloud). Telecharge-les et relance.`);
    console.log(`Pour tout faire d'un coup (ajout, commit, push) : npm run samples:mika${rerunArgs(opts)}`);
    console.log(`Ou l'ajout seul, sans git : ${importCmd}  (apercu d'abord : ajoute --dry)`);
    throw new Stop(missing.length > 0 ? 2 : 0);
  }

  /* ----- l'ajout, la verification, git ----- */
  const { lines, commit, pushed, newFiles } = await importAndCommit(A, plan, opts, run, pub, { started, staging });

  /* ----- le resume ----- */
  console.log('\nRESUME (avant -> apres, les noms ajoutes) :');
  for (const l of lines) console.log(`  ${l.fam.padEnd(3)} ${String(l.before).padStart(3)} -> ${String(l.after).padEnd(3)}${l.names.length > 0 ? ` +${l.names.length} : ${l.names.join(', ')}` : ' (rien de nouveau)'}`);
  console.log(`  Liste de ce que ce script a ajoute : ${MANIFEST_REL}`);
  // Le chemin de la sauvegarde, encore une fois a la fin (il ne s'affichait qu'au debut)
  if (run.resetBackup) console.log(`  Sauvegarde de --reset-samples (ce qui etait modifie ou en trop ici) : ${run.resetBackup}`);
  if (pub && newFiles.length === 0) {
    console.log(`\nL'ajout n'a rien ecrit de nouveau : pas de commit. ${unchanged(run)}`);
    return;
  }
  if (pub) {
    if (pushed) {
      console.log(`\nCommit ${commit} pousse sur ${pub.remote} (${pub.merge.replace('refs/heads/', '')}).`);
      if (pub.onMain) console.log('Le site se met a jour tout seul dans 1 a 2 minutes (GitHub Actions, pages.yml), puis MM-RYTM, choix de son de chaque voix.');
      else console.log(`Attention : ta branche est ${pub.branch}, pas main. Le commit est pousse sur ${pub.merge.replace('refs/heads/', '')} ; le site en ligne (main) ne change qu'une fois cette branche fusionnee dans main.`);
      console.log(`Pour annuler (les nouveaux samples repartent, rien d'autre ne bouge) : git revert --no-edit ${commit} && git push`);
    }
    if (!pushed) throw new Stop(1);
    return;
  }
  console.log(`
Apres l'ajout :
  1. En dev (npm run dev) la liste du potard se refait toute seule (vite, virtual:rytm-samples) : MM-RYTM, choix de son de ${importable.map((p) => p.fam.toUpperCase()).join(' / ')}
  2. Relis ce qui a change :   git status public/samples/rytm
  3. Mets-les en ligne :       git add public/samples/rytm && git commit -m "Samples joues dans Ableton dans MM-RYTM (${importable.map((p) => p.fam).join(', ')})" && git push
  Pour annuler avant le commit : ${UNDO}`);
}

/** Les options a redonner pour relancer pareil (sans --dry / --import / --publish). */
function rerunArgs(opts) {
  const a = [];
  if (opts.shots !== DEFAULT_SHOTS) a.push(`--shots "${opts.shots}"`);
  for (const p of opts.projects) a.push(`--projects "${p}"`);
  if (opts.per !== PER) a.push(`--per ${opts.per}`);
  if (opts.bdNew !== BD_NEW) a.push(`--bd-new ${opts.bdNew}`);
  if (opts.minProjects !== 1) a.push(`--min-projects ${opts.minProjects}`);
  if (opts.families) a.push(`--families ${opts.families.join(',')}`);
  for (const [k, v] of opts.map) a.push(`--map "${k}=${v}"`);
  if (opts.reportGiven) a.push(`--report "${opts.report}"`);
  return a.length === 0 ? '' : ` -- ${a.join(' ')}`;
}

/*
 * Lance comme script (npm run samples:mika, npm run samples:ableton), main
 * tourne ; importe (l'admin : scripts/admin-samples-api.mjs), rien ne tourne.
 * Les chemins reels se comparent (un dossier du site atteint par un lien).
 */
const isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e) => {
    if (e instanceof Stop) {
      process.exitCode = e.code;
      return;
    }
    console.error(e);
    process.exitCode = 1;
  });
}
