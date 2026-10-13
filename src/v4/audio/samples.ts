/**
 * Les echantillons de Mika dans le choix de son du MM-RYTM (2026-10-05,
 * Mika : "je voudrais que tu mettes ces samples dans le selecteur de
 * samples, pour BD et SD"). Un fichier audio pose dans
 * public/samples/rytm/<famille>/ (bd, sd, cp, hh, tom, rs) devient un cran
 * de plus du choix de son de sa famille, apres 909, 808 et MM, dans l'ordre
 * des noms de fichier (01, 02... d'abord). La liste vient du build
 * (vite.config.ts, virtual:rytm-samples) ; le fichier reste a part (rien
 * dans le code) et n'est telecharge qu'une fois choisi. Son nom a
 * l'ecran : celui du fichier sans son numero, sans "AT" ni le nom de la
 * famille (01 AT BluePrint - Kick F.wav : BLUEPRINT F ; Psy_Snares02.wav :
 * PSY 02). Ce qu'on publie se telecharge : un echantillon sous licence d'un
 * pack doit permettre d'etre diffuse ainsi.
 * Les noms (2026-10-05, Mika : "je les veux dans le knob avec les noms,
 * genre Engelhardt, Carassi, Stein ; enleve la fenetre Samples on this
 * device") : la plaque ecrit le nom de chaque echantillon a son cran. Plus
 * de fichiers de l'appareil : seul le dossier du site fait foi
 * (scripts/import-rytm-samples.mjs y range les fichiers de Mika).
 */

import FOUND from 'virtual:rytm-samples';
import type { SamplePcm } from './sampledsp';

/** Les familles de voix qui peuvent jouer un echantillon (celles de audio/kit.ts). */
const FAMILY_DIRS = ['bd', 'sd', 'hh', 'cp', 'tom', 'rs'] as const;
export type SampleFamily = (typeof FAMILY_DIRS)[number];

export interface KitSample {
  /** la cle retenue (kit, presets) : famille/fichier */
  key: string;
  family: SampleFamily;
  file: string;
  /** le nom court, en capitales (l'ecran, les jumeaux) */
  label: string;
  /** l'adresse du fichier du site */
  url: string;
}

/** Le nom court d'un fichier : sans extension, numero, "AT", ni le nom de la famille. */
export function sampleLabel(file: string): string {
  let t = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
  t = t.replace(/^AT\s+/i, '');
  t = t.replace(/\b(master\s+)?(kicks?|snares?|claps?|hats?|hihats?|toms?|rims?)\b/gi, ' ');
  t = t.replace(/(master\s+)?(kicks?|snares?)(?=\d)/gi, ' ');
  t = t.replace(/^\s*(BD|SD|CP|HH|RS)\s+/i, '');
  t = t.replace(/\s+-\s+/g, ' ').replace(/\s-\s*$/, '').replace(/\s+/g, ' ').trim();
  return (t || file).toUpperCase().slice(0, 18);
}

export const SAMPLES: readonly KitSample[] = FOUND.filter((x) => (FAMILY_DIRS as readonly string[]).includes(x.family))
  .map(
    (x): KitSample => ({
      key: `${x.family}/${x.file}`,
      family: x.family as SampleFamily,
      file: x.file,
      label: sampleLabel(x.file),
      url: `${import.meta.env.BASE_URL}samples/rytm/${x.family}/${encodeURIComponent(x.file)}`,
    })
  )
  .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));

const byFamily = new Map<string, KitSample[]>();
for (const s of SAMPLES) {
  const list = byFamily.get(s.family) ?? [];
  list.push(s);
  byFamily.set(s.family, list);
}

/** Les echantillons d'une famille, dans l'ordre des crans. */
export const samplesOf = (f: string): readonly KitSample[] => byFamily.get(f) ?? [];
export const sampleByKey = (key: string): KitSample | undefined => SAMPLES.find((s) => s.key === key);

/* ---------------- chargement ---------------- */

/** La frequence de decodage (le calcul relit ensuite a celle du contexte). */
const DECODE_SR = 48000;
const pcm = new Map<string, SamplePcm>();
const pending = new Map<string, Promise<SamplePcm | null>>();
const failed = new Set<string>();
const listeners = new Set<(key: string) => void>();

/** L'echantillon decode, s'il est la. */
export const samplePcm = (key: string): SamplePcm | undefined => pcm.get(key);

/** Telecharge et decode un echantillon (une fois) ; ses abonnes l'apprennent. */
export function loadSample(key: string): Promise<SamplePcm | null> {
  const hit = pcm.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  const s = sampleByKey(key);
  if (!s || failed.has(key) || typeof window === 'undefined') return Promise.resolve(null);
  const job = (async (): Promise<SamplePcm | null> => {
    try {
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, DECODE_SR);
      const buf = await ctx.decodeAudioData(data);
      const L = Float32Array.from(buf.getChannelData(0));
      const R = buf.numberOfChannels > 1 ? Float32Array.from(buf.getChannelData(1)) : null;
      const out: SamplePcm = { L, R, sr: buf.sampleRate };
      pcm.set(key, out);
      listeners.forEach((fn) => fn(key));
      return out;
    } catch {
      // Un fichier illisible : sa voix garde son son calcule
      failed.add(key);
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}

/** Un echantillon vient d'etre decode. */
export function onSampleLoaded(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// L'ancien panneau "samples de l'appareil" est retire (2026-10-05) : ce qu'il gardait dans ce navigateur part
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('mm.v4.usersamples.1');
    window.indexedDB?.deleteDatabase('mm-v4-rytm-samples');
  } catch {
    /* stockage refuse : rien a retirer */
  }
}
