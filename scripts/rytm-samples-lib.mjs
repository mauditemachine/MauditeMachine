/**
 * Ce que scripts/import-rytm-samples.mjs et scripts/ableton-samples.mjs
 * partagent (2026-10-18, chantier S2, Mika : "Les samples ont completement
 * disparu... fais ce que je t'ai dit deja deux fois pour les samples des
 * voices !") : la liste des samples deja sur le site, la question "git
 * verra-t-il ce fichier ?" et le nom de fichier sur.
 *
 * Le piege du jour : .gitignore ecarte '* 2.*' et '* 3.*' (les doubles que
 * le Finder et iCloud fabriquent : "Nom 2.wav"). Un sample nomme "09 OT 3.wav"
 * restait sur le disque, jouait en local, et n'allait jamais en ligne. Donc :
 * - safeStem colle un chiffre seul en fin de nom au mot d'avant (OT 3 : OT3) ;
 * - suffixed numerote un doublon sans espace (Stein2, OT3-2) ;
 * - gitIgnored demande a git lui-meme (git check-ignore) : l'import refuse
 *   d'ecrire un fichier que git ignorerait, quelle que soit la regle.
 *
 * Et ce que le site sait lire (relecture S2) : audioKind juge un fichier
 * par ses premiers octets (un WAV vide ou un texte nomme .wav n'est pas de
 * l'audio), aiffToWav convertit un AIFF (Safari le lit, Chrome et Firefox
 * non) en WAV avec afconvert, livre avec macOS.
 *
 * Sans dependance, Node 18 ou plus. Rien n'est ecrit ici, sauf les WAV
 * convertis, dans un dossier temporaire efface a la sortie du script.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { lstat, readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Le dossier personnel ou chercher shots et les projets Ableton : celui du
 * Mac (~), sauf MM_SAMPLES_HOME (les tests sur un faux Mac : le HOME de git,
 * et donc sa configuration, ne change pas).
 */
export const HOME_DIR = process.env.MM_SAMPLES_HOME ? path.resolve(process.env.MM_SAMPLES_HOME) : os.homedir();

/** Une famille par voix (src/v4/audio/samples.ts, FAMILY_DIRS), dans l'ordre des pads. */
export const FAMILIES = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
export const AUDIO = /\.(wav|aiff?|mp3|flac|m4a)$/i;
/** Le dossier des samples du site, relatif a la racine du depot (avec des /, comme git l'ecrit). */
export const SITE_DIR = 'public/samples/rytm';
/** Au-dela, ce n'est plus un coup de batterie (et chaque visiteur le telechargerait). */
export const MAX_BYTES = 10 * 1024 * 1024;
/** Revenir a l'etat d'avant l'import (avant le commit) : git rend les anciens, retire les nouveaux. */
export const UNDO = 'git restore public/samples/rytm && git clean -f public/samples/rytm';

export const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0);
export const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
/** Un chemin relatif du depot ecrit comme git l'ecrit (des /, NFC). */
export const gitPath = (rel) => rel.split(path.sep).join('/').normalize('NFC');

/**
 * Lance git dans le depot, sans shell (un chemin a espaces, iCloud Drive
 * compris, passe tel quel). status -1 : git introuvable.
 */
export function git(root, args, { input, inherit = false } = {}) {
  const r = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    stdio: inherit ? ['inherit', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) return { status: -1, out: '', err: r.error.code === 'ENOENT' ? 'git introuvable' : r.error.message };
  return { status: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

/**
 * Les chemins (relatifs au depot) que git ignorerait, avec la regle qui les
 * ecarte ("fichier:ligne motif"). ok false : pas de depot git ici (ou pas de
 * git), on ne peut pas savoir. Un fichier deja suivi n'est jamais ignore.
 */
export function gitIgnored(root, rels) {
  if (rels.length === 0) return { ok: true, ignored: new Map() };
  const r = git(root, ['check-ignore', '-v', '-z', '--stdin'], { input: `${rels.map(gitPath).join('\0')}\0` });
  if (r.status !== 0 && r.status !== 1) return { ok: false, ignored: new Map(), why: r.err.trim().split('\n')[0] || `git check-ignore (code ${r.status})` };
  const parts = r.out.split('\0');
  const ignored = new Map();
  // -v -z : source, ligne, motif, chemin ; un motif en ! (negatif) dit que le chemin n'est PAS ignore
  for (let i = 0; i + 3 < parts.length; i += 4) {
    if (parts[i + 2].startsWith('!')) continue;
    ignored.set(parts[i + 3].normalize('NFC'), `${parts[i]}:${parts[i + 1]} ${parts[i + 2]}`);
  }
  return { ok: true, ignored };
}

/**
 * Les entrees de git status --porcelain sous un chemin (XY et le chemin,
 * relatif a root, comme les autres chemins d'ici). Les fichiers ignores n'y
 * sont pas. null : pas de depot git.
 */
export function gitStatus(root, rel) {
  const r = git(root, ['status', '--porcelain=v1', '-z', '-uall', '--', rel]);
  if (r.status !== 0) return null;
  // git ecrit les chemins depuis le haut du depot ; root peut etre un sous-dossier
  const prefix = git(root, ['rev-parse', '--show-prefix']).out.trim().normalize('NFC');
  const out = [];
  const parts = r.out.split('\0');
  for (let i = 0; i < parts.length; i += 1) {
    const e = parts[i];
    if (e.length < 4) continue;
    const xy = e.slice(0, 2);
    const p = e.slice(3).normalize('NFC');
    out.push({ xy, rel: prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p });
    // Un renommage ou une copie : le chemin d'origine suit, a sauter
    if (xy[0] === 'R' || xy[0] === 'C') i += 1;
  }
  return out;
}

/**
 * Les samples deja dans public/samples/rytm/<famille>/ : nom, chemin,
 * taille, empreinte du contenu, et ignored (la regle de .gitignore qui le
 * cache, ou null) : un fichier ignore est sur ce disque mais pas en ligne.
 */
export async function siteFiles(root, fams = FAMILIES) {
  const byFam = new Map();
  const all = [];
  for (const fam of fams) {
    const dir = path.join(root, SITE_DIR, fam);
    const list = [];
    for (const name of (await readdir(dir).catch(() => [])).sort(natural)) {
      if (name.startsWith('.') || !AUDIO.test(name)) continue;
      const full = path.join(dir, name);
      const st = await lstat(full).catch(() => null);
      if (!st?.isFile()) continue;
      const f = { fam, name, full, rel: `${SITE_DIR}/${fam}/${name}`.normalize('NFC'), size: st.size, hash: sha1(await readFile(full)), ignored: null };
      list.push(f);
      all.push(f);
    }
    byFam.set(fam, list);
  }
  const ig = gitIgnored(root, all.map((f) => f.rel));
  for (const f of all) f.ignored = ig.ignored.get(f.rel) ?? null;
  return { byFam, git: ig.ok, gitWhy: ig.why ?? null };
}

/**
 * Un nom de fichier que .gitignore ne cache pas : un chiffre seul en fin de
 * nom, apres un espace, se colle au mot d'avant (OT 3 : OT3 ; Deep 2 :
 * Deep2). Apres un nombre, un tiret (909 3 : 909-3, pas 9093 ; X 3 3 :
 * X 3-3) : colle, il ferait un autre nombre a la plaque. "Psy 02" ou
 * "Kick 12" restent : ' 02.' et ' 12.' ne ressemblent pas a un double du
 * Finder.
 */
export const safeStem = (stem) => stem.replace(/(\S)\s+(\d)$/u, (_, a, d) => (/\d/.test(a) ? `${a}-${d}` : `${a}${d}`));

/** Le k-ieme doublon d'un nom, sans espace : Stein2 ; apres un chiffre, un tiret (OT3-2). */
export const suffixed = (stem, k) => (/\p{L}$/u.test(stem) ? `${stem}${k}` : `${stem}-${k}`);

/* ---------------- ce que le site sait lire ---------------- */

/**
 * Le format d'un fichier d'apres ses premiers octets, pas son extension :
 * wav (RIFF....WAVE), aiff (FORM....AIFF ou AIFC), flac (fLaC), m4a
 * (....ftyp), mp3 (ID3, ou une trame 0xFFEx), sinon null (vide, coupe, ou
 * pas de l'audio : le navigateur n'en tirerait rien, le cran du potard
 * resterait muet). Chrome, Firefox et Safari decodent wav, mp3, flac et m4a ;
 * l'aiff, Safari seulement.
 */
export function audioKind(buf) {
  if (!buf || buf.length < 12) return null;
  const at = (i, s) => buf.toString('latin1', i, i + s.length) === s;
  if (at(0, 'RIFF') && at(8, 'WAVE')) return 'wav';
  if (at(0, 'FORM') && (at(8, 'AIFF') || at(8, 'AIFC'))) return 'aiff';
  if (at(0, 'fLaC')) return 'flac';
  if (at(4, 'ftyp')) return 'm4a';
  if (at(0, 'ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}

/**
 * Le convertisseur AIFF -> WAV : afconvert, livre avec macOS ; MM_AFCONVERT
 * (un programme qui prend les memes arguments) pour un faux Mac. null : pas
 * de conversion possible ici, un AIFF est laisse de cote.
 */
export const AFCONVERT = (() => {
  const p = process.env.MM_AFCONVERT ? path.resolve(process.env.MM_AFCONVERT) : process.platform === 'darwin' ? '/usr/bin/afconvert' : null;
  return p && existsSync(p) ? p : null;
})();

let wavDir = null;
let wavCount = 0;

/**
 * Un AIFF converti en WAV 16 bits (afconvert -f WAVE -d LEI16 : la meme
 * frequence, les memes canaux) : rend le chemin du WAV, dans un dossier
 * temporaire efface a la sortie du script. Une erreur si la conversion
 * echoue (son message : la premiere ligne de ce qu'afconvert a dit).
 */
export function aiffToWav(src) {
  if (!AFCONVERT) throw new Error('afconvert introuvable');
  if (!wavDir) {
    wavDir = mkdtempSync(path.join(os.tmpdir(), 'mm-rytm-wav-'));
    const dir = wavDir;
    process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  }
  wavCount += 1;
  const out = path.join(wavDir, `${String(wavCount).padStart(4, '0')}.wav`);
  try {
    execFileSync(AFCONVERT, ['-f', 'WAVE', '-d', 'LEI16', src, out], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  } catch (e) {
    const said = String(e.stderr ?? '').trim().split('\n')[0];
    throw new Error(said || (e.status != null ? `code ${e.status}` : e.message));
  }
  return out;
}
