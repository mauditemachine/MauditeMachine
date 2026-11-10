#!/usr/bin/env node
/**
 * MM-ARP : validation de la banque d'usine du VST3 (plugin/mm-arp/presets/factory.json et presets/factory/*.mmarp),
 * sans son. Contre les vraies regles du site et du plugin :
 * - les 62 potards de src/v4/voyager/params.ts, tous presents, 0..1, chacun egal a son arrondi (clean de voyParams.set :
 *   un cran sur i / (n - 1), un continu au millieme) ;
 * - les 14 reglages de plugin/mm-arp/extra-params.json, tous presents, 0..1, les crans sur i / (n - 1) ;
 * - la suite : edit et has booleens, 16 pas (degres entiers -7..24 ou null), len 1..16 ; en EDIT, au moins une note ;
 * - la progression : 1 a 8 indices entiers 0..7 ;
 * - nom : 24 caracteres au plus, les caracteres des noms du site (A-Z 0-9 espace tiret), unique ; cat, desc, bpm ;
 * - chaque .mmarp : NN NOM.mmarp, format mm-arp-preset v1, le meme contenu que factory.json ;
 * - la repartition demandee : 10 DISCO, 10 HYPNOTIC, 6 DARK, 6 TEXTURE.
 *
 *   node plugin/mm-arp/tests/presets-check.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOY_KNOBS } from '../../../src/v4/voyager/params.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS = join(HERE, '..', 'presets');
const EXTRA = JSON.parse(readFileSync(join(HERE, '..', 'extra-params.json'), 'utf8')).params;
const bank = JSON.parse(readFileSync(join(PRESETS, 'factory.json'), 'utf8'));

const errors = [];
const err = (p, msg) => errors.push(`${p}: ${msg}`);
const stepped = (steps, v) => {
  const n = steps.length - 1;
  return Math.max(0, Math.min(n, Math.round(v * n))) / n;
};
const knobClean = (k, v) => (k.steps && !k.morph ? stepped(k.steps, v) : Math.round(v * 1000) / 1000);
const exClean = (e, v) => (e.steps ? stepped(e.steps, v) : Math.round(v * 1000) / 1000);
const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

if (bank.v !== 1 || !Array.isArray(bank.presets)) err('factory.json', 'pas de { v: 1, presets: [] }');
const names = new Set();
const cats = {};
for (const p of bank.presets ?? []) {
  const who = p.name ?? '?';
  if (typeof p.name !== 'string' || !/^[A-Z0-9-][A-Z0-9 -]{0,23}$/.test(p.name) || p.name.endsWith(' ') || p.name.includes('  ')) err(who, 'nom invalide');
  if (names.has(p.name)) err(who, 'nom en double');
  names.add(p.name);
  if (!['DISCO', 'HYPNOTIC', 'DARK', 'TEXTURE'].includes(p.cat)) err(who, `cat ${p.cat}`);
  cats[p.cat] = (cats[p.cat] ?? 0) + 1;
  if (typeof p.desc !== 'string' || p.desc.length < 20) err(who, 'desc manquante');
  if (/[—À-ſ]/.test(p.desc ?? '')) err(who, 'desc : accent ou tiret cadratin');
  if (!(p.bpm >= 60 && p.bpm <= 180)) err(who, `bpm ${p.bpm}`);
  const kn = p.knobs ?? {};
  for (const k of VOY_KNOBS) {
    const v = kn[k.id];
    if (!okNum(v)) err(who, `potard ${k.id} absent ou hors de 0..1 (${v})`);
    else if (knobClean(k, v) !== v) err(who, `potard ${k.id} = ${v} pas arrondi (${knobClean(k, v)})`);
  }
  for (const id of Object.keys(kn)) if (!VOY_KNOBS.some((k) => k.id === id)) err(who, `potard inconnu ${id}`);
  const ex = p.extra ?? {};
  for (const e of EXTRA) {
    const v = ex[e.id];
    if (!okNum(v)) err(who, `reglage ${e.id} absent ou hors de 0..1 (${v})`);
    else if (exClean(e, v) !== v) err(who, `reglage ${e.id} = ${v} pas sur son cran`);
  }
  for (const id of Object.keys(ex)) if (!EXTRA.some((e) => e.id === id)) err(who, `reglage inconnu ${id}`);
  const s = p.seq ?? {};
  if (typeof s.edit !== 'boolean' || typeof s.has !== 'boolean') err(who, 'seq.edit / seq.has');
  if (!Array.isArray(s.buf) || s.buf.length !== 16 || !s.buf.every((d) => d === null || (Number.isInteger(d) && d >= -7 && d <= 24))) err(who, 'seq.buf');
  if (!Number.isInteger(s.len) || s.len < 1 || s.len > 16) err(who, 'seq.len');
  if (s.edit && Array.isArray(s.buf) && s.buf.slice(0, s.len).every((d) => d === null)) err(who, 'suite EDIT muette');
  if (s.edit && !s.has) err(who, 'EDIT sans has');
  if (!Array.isArray(p.prog) || p.prog.length < 1 || p.prog.length > 8 || !p.prog.every((c) => Number.isInteger(c) && c >= 0 && c <= 7)) err(who, 'prog');
}
const want = { DISCO: 10, HYPNOTIC: 10, DARK: 6, TEXTURE: 6 };
for (const [c, n] of Object.entries(want)) if (cats[c] !== n) err('repartition', `${c} : ${cats[c] ?? 0} au lieu de ${n}`);

// Les fichiers du disque : le meme contenu
const files = readdirSync(join(PRESETS, 'factory')).filter((f) => f.endsWith('.mmarp')).sort();
if (files.length !== (bank.presets ?? []).length) err('factory/', `${files.length} fichiers pour ${bank.presets.length} presets`);
(bank.presets ?? []).forEach((p, i) => {
  const f = `${String(i + 1).padStart(2, '0')} ${p.name}.mmarp`;
  if (!files.includes(f)) return err(p.name, `fichier ${f} absent`);
  const d = JSON.parse(readFileSync(join(PRESETS, 'factory', f), 'utf8'));
  if (d.format !== 'mm-arp-preset' || d.v !== 1 || d.name !== p.name) err(f, 'en-tete du format disque');
  for (const key of ['knobs', 'seq', 'prog', 'extra', 'bpm', 'cat', 'desc'])
    if (JSON.stringify(d[key]) !== JSON.stringify(p[key])) err(f, `${key} differe de factory.json`);
});

if (errors.length) {
  for (const e of errors) console.error(`  ${e}`);
  console.error(`presets-check : ${errors.length} erreur(s)`);
  process.exit(1);
}
console.log(`presets-check : ${bank.presets.length} presets valides (${Object.entries(cats).map(([c, n]) => `${c} ${n}`).join(', ')}), ${files.length} fichiers .mmarp identiques`);
