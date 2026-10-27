#!/usr/bin/env node
/**
 * Les firmwares des machines (2026-10-27, Mika : "firmware c'est ecrit 3, ce n'est pas a jour ; il faut que ca change a
 * chaque fois qu'il y a une mise a jour : mineure 0.1, 0.2, grosse 1.0, 2.0 ; nous en sommes a 4.1"). src/v4/firmware.json
 * est la seule source des versions imprimees sur les faces et les capots (src/v4/firmware.ts fwText) ; ce script garde
 * chaque version liee a ses sources par une empreinte (sha256 des fichiers de la machine, chemins et contenus, tries) :
 *
 *   npm run firmware:check                                    une machine dont les sources ont change sans que sa
 *                                                             version bouge : un message, code 1 (la CI : un
 *                                                             avertissement, jamais bloquant)
 *   npm run firmware:bump -- mm808 minor "ce qui change"      4.1 -> 4.2 (4.9 -> 4.10) ; major : 4.2 -> 5.0 ; une ligne
 *                                                             d'historique (version, date, note, le sha court de HEAD)
 *                                                             et la nouvelle empreinte
 *   npm run firmware:stamp                                    les empreintes des versions actuelles, sans rien monter
 *                                                             (la premiere fois, ou une version deja montee pour cette
 *                                                             mise a jour quand les sources ont encore bouge)
 *
 * Les sources d'une machine (les fichiers suivis par git et les nouveaux, sans ceux que .gitignore ecarte) :
 * - mm808 (MM-RYTM) : src/v4 sans voyager/, bass/, dj/ ni firmware.json lui-meme ;
 * - voy (MM-ARP) : src/v4/voyager/ ;
 * - bass (MM-BASS) : src/v4/bass/.
 * Les fins de ligne CRLF comptent comme LF (une copie Windows ne change pas l'empreinte).
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V4 = 'src/v4/';
const FW_PATH = 'src/v4/firmware.json';
const IDS = ['mm808', 'voy', 'bass'];

/** Les sources de chaque machine, par chemin relatif a la racine (separateur /). */
const OWNS = {
  mm808: (f) => f.startsWith(V4) && !f.startsWith(`${V4}voyager/`) && !f.startsWith(`${V4}bass/`) && !f.startsWith(`${V4}dj/`) && f !== FW_PATH,
  voy: (f) => f.startsWith(`${V4}voyager/`),
  bass: (f) => f.startsWith(`${V4}bass/`),
};

const ci = process.env.GITHUB_ACTIONS === 'true';
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ---------- les fichiers ---------- */

function gitFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src/v4'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

/** Sans git : le dossier entier (les fichiers caches et les copies de iCloud, "x 2.ts", ecartes comme .gitignore le fait). */
function walk(dir, out = []) {
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.name.startsWith('.') || / [23]\./.test(e.name)) continue;
    if (e.isDirectory()) walk(rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function sourceFiles() {
  const listed = gitFiles() ?? walk('src/v4');
  // Un fichier suivi mais efface du disque n'est plus une source ; .DS_Store jamais
  return [...new Set(listed)].filter((f) => !f.endsWith('.DS_Store') && existsSync(path.join(ROOT, f)) && statSync(path.join(ROOT, f)).isFile()).sort(cmp);
}

/** L'empreinte d'une liste de fichiers : sha256 de chaque chemin et de son contenu (CRLF lu LF), dans l'ordre des chemins. */
function fingerprint(files) {
  const h = createHash('sha256');
  for (const f of files) {
    let buf = readFileSync(path.join(ROOT, f));
    if (buf.includes(13)) buf = Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    h.update(f);
    h.update('\0');
    h.update(String(buf.length));
    h.update('\0');
    h.update(buf);
  }
  return `sha256:${h.digest('hex')}`;
}

function fingerprints() {
  const all = sourceFiles();
  const out = {};
  for (const id of IDS) {
    const files = all.filter(OWNS[id]);
    out[id] = { fp: fingerprint(files), n: files.length };
  }
  return out;
}

/* ---------- firmware.json ---------- */

function readFw() {
  return JSON.parse(readFileSync(path.join(ROOT, FW_PATH), 'utf8'));
}

/** La forme du fichier : une machine par bloc, une ligne par version de l'historique (comme il est ecrit a la main). */
function formatFw(fw) {
  const machine = (m) => {
    const keys = Object.keys(m).filter((k) => k !== 'history');
    const head = keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(m[k])}`);
    const hist = Array.isArray(m.history) ? m.history : [];
    if (hist.length === 0) return `{ ${[...head, '"history": []'].join(', ')} }`;
    const rows = hist.map((e) => `      { ${Object.keys(e).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(e[k])}`).join(', ')} }`);
    return `{\n${head.map((l) => `    ${l},`).join('\n')}\n    "history": [\n${rows.join(',\n')}\n    ]\n  }`;
  };
  const ids = Object.keys(fw);
  return `{\n${ids.map((id, i) => `  ${JSON.stringify(id)}: ${machine(fw[id])}${i < ids.length - 1 ? ',' : ''}`).join('\n')}\n}\n`;
}

/** Une machine du fichier, ses champs dans l'ordre name, version, fingerprint, puis le reste (history a la fin). */
function withFingerprint(m, fp) {
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === 'fingerprint' || k === 'history') continue;
    out[k] = v;
    if (k === 'version') out.fingerprint = fp;
  }
  if (!('fingerprint' in out)) out.fingerprint = fp;
  out.history = Array.isArray(m.history) ? m.history : [];
  return out;
}

function writeFw(fw) {
  writeFileSync(path.join(ROOT, FW_PATH), formatFw(fw));
}

/* ---------- les versions ---------- */

function nextVersion(v, kind) {
  const m = /^(\d+)\.(\d+)$/.exec(String(v));
  if (!m) throw new Error(`version illisible : ${v} (attendu : 4.1)`);
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return kind === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

function today() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

function headSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const label = (fw, id) => `${fw[id]?.name ?? id} (${id})`;

/* ---------- les commandes ---------- */

function check() {
  const fw = readFw();
  const now = fingerprints();
  const problems = [];
  for (const id of IDS) {
    const m = fw[id];
    if (!m) {
      problems.push({ id, text: `${id} : absent de ${FW_PATH}.` });
      continue;
    }
    if (!m.fingerprint) {
      problems.push({ id, text: `${label(fw, id)} : pas d'empreinte pour la version ${m.version}. Lance : npm run firmware:stamp` });
      continue;
    }
    if (m.fingerprint !== now[id].fp) {
      problems.push({
        id,
        text: `${label(fw, id)} : les sources ont change depuis la version ${m.version}, mais la version n'a pas bouge. Lance : npm run firmware:bump -- ${id} minor "ce qui change" (une grosse mise a jour : major). Si la version est deja montee pour cette mise a jour : npm run firmware:stamp`,
      });
      continue;
    }
    console.log(`OK   ${label(fw, id)} : FIRMWARE V.${m.version}, ${now[id].n} fichiers, empreinte a jour`);
  }
  for (const p of problems) {
    console.error(`FIRMWARE ${p.text}`);
    if (ci) console.log(`::warning title=Firmware ${fw[p.id]?.name ?? p.id} pas a jour::${p.text}`);
  }
  if (problems.length) process.exit(1);
}

function stamp() {
  const fw = readFw();
  const now = fingerprints();
  for (const id of IDS) {
    if (!fw[id]) throw new Error(`${id} : absent de ${FW_PATH}`);
    fw[id] = withFingerprint(fw[id], now[id].fp);
    console.log(`${label(fw, id)} : FIRMWARE V.${fw[id].version}, empreinte posee (${now[id].n} fichiers)`);
  }
  writeFw(fw);
}

function bump(id, kind, note) {
  if (!IDS.includes(id)) throw new Error(`machine inconnue : ${id ?? '(aucune)'} (mm808, voy ou bass)`);
  if (kind !== 'minor' && kind !== 'major') throw new Error(`type de mise a jour inconnu : ${kind ?? '(aucun)'} (minor : +0.1, major : +1.0)`);
  if (!note || !note.trim()) throw new Error('une note est demandee : npm run firmware:bump -- mm808 minor "ce qui change"');
  const fw = readFw();
  const m = fw[id];
  if (!m) throw new Error(`${id} : absent de ${FW_PATH}`);
  const from = m.version;
  const to = nextVersion(from, kind);
  const now = fingerprints();
  const sha = headSha();
  const entry = { version: to, date: today(), note: note.trim(), ...(sha ? { sha } : {}) };
  const next = withFingerprint({ ...m, version: to }, now[id].fp);
  next.history = [...(Array.isArray(m.history) ? m.history : []), entry];
  fw[id] = next;
  writeFw(fw);
  console.log(`${label(fw, id)} : ${from} -> ${to} (la machine dira FIRMWARE V.${to} / 2026), note : ${entry.note}${sha ? `, apres ${sha}` : ''}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'check') check();
  else if (cmd === 'stamp') stamp();
  else if (cmd === 'bump') bump(args[0], args[1], args.slice(2).join(' '));
  else {
    console.error('Usage : node scripts/firmware.mjs check | stamp | bump <mm808|voy|bass> <minor|major> "note"');
    process.exit(2);
  }
} catch (e) {
  console.error(`FIRMWARE ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}
