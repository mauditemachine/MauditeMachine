/**
 * Le code d'un beat du MM-RYTM dans une adresse (2026-10-21, audit SEO IMP2, Mika : "je veux du monde dans mon site !
 * ... qu'on parle de ce site partout") : https://mauditemachine.com/?m=rytm&b=<code>. Un beat partage s'ouvre tel quel
 * chez celui qui recoit le lien : c'est la boucle qui fait circuler l'outil (les boites a rythmes en ligne qui percent
 * l'ont toutes).
 *
 * Pur (aucun store, aucun navigateur) : la machine l'utilise (state/share.ts), le build aussi (les pages de motifs,
 * scripts/mm-studio-patterns.mjs, via esbuild). Le code : des octets en base64url (sans =), le premier dit la
 * version. Version 1 :
 *   0      version (1)
 *   1      drapeaux : 1 base (un preset d'usine), 2 kit, 4 potards du kit, 8 effets des voix, 16 STRETCH, 32 le mute du
 *          pattern (V.5.0, 2026-10-29 : un lien sans mute de pattern est le meme qu'avant, octet pour octet)
 *   [1]    base : le rang du preset d'usine du MM-RYTM (1 a 255, state/factory.ts) ; le reste du son est le sien
 *   1      tempo - 100 (0 a 50)
 *   1      masque des voix qui ont des pas (BD SD CH OH CP TOM HT CY)
 *   8 x n  les 16 pas de chaque voix du masque, deux par octet (0 vide a 9 le plus fort)
 *   3      masque des FX globaux differents de leur depart (FX_V1), puis 2 octets par FX
 *   [2]    STRETCH (-1 a 1)
 *   [kit]  les huit familles : un octet (bits 0-1 la MACHINE 909 808 MM, bit 2 un sample, bit 3 des reglages de
 *          couche), [sample : son rang dans la liste du site (1 a 255) et l'empreinte de son nom], [couche : un masque
 *          (LAYER_V1) puis 2 octets par reglage]
 *   [pots] masque de 2 octets (KNOBS_V1), puis 2 octets par potard
 *   [voix] masque des voix, puis pour chacune un masque de 3 octets (VOICE_V1) et 2 octets par reglage
 *   [mute] le masque des voix que le pattern coupe (au moins une)
 *   1      controle (CRC-8 de tout ce qui precede)
 * Une valeur : (v - min) x 10000 sur 16 bits (le dix-millieme : les reglages, gardes au millieme, reviennent
 * exacts). Les valeurs de depart de la version 1 sont figees ici : un lien garde son son meme si la machine change
 * ses departs plus tard ; une version 2 ajoutera ce qui manque (les P-LOCKS, les samples de ce navigateur) sans
 * toucher aux liens deja partages.
 * Lecture stricte : un caractere hors base64url, une version inconnue, un controle faux, un octet de trop ou de
 * moins, une valeur hors de sa plage ou un bit de reserve allume, et le code entier est refuse (null) ; jamais une
 * exception, jamais un beat a moitie lu.
 */

export const BEAT_VERSION = 1;
/** Le code le plus long accepte (caracteres) : bien au-dela d'un beat complet (environ 400). */
export const BEAT_MAX_CHARS = 1200;

/** Les listes de la version 1, dans leur ordre, figees (ne jamais reordonner : une version 2 ajoute a la fin). */
export const INSTS_V1 = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as const;
export const FX_V1 = ['swing', 'drive', 'reverb', 'delay', 'chorus', 'dtime', 'dfb', 'bits', 'comp', 'dtone', 'rsize', 'rtone', 'rpre', 'xtone', 'crate', 'cdepth', 'brate', 'catk', 'crel', 'cthr', 'cratio', 'cknee', 'cmake', 'chpf'] as const;
export const FAMS_V1 = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'] as const;
export const MODELS_V1 = ['909', '808', 'mm'] as const;
export const LAYER_V1 = ['syn', 'lev', 'tune', 'fine', 'start', 'len', 'rev'] as const;
export const KNOBS_V1 = ['tune', 'attack', 'decay', 'drive', 'snappy', 'gate', 'sweep', 'sdtune', 'sddecay', 'sdtone'] as const;
export const VOICE_V1 = ['tone', 'decay', 'level', 'dist', 'reverb', 'delay', 'chorus', 'tune', 'pan', 'start', 'atk', 'hold', 'fine', 'ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec'] as const;

export type BeatInst = (typeof INSTS_V1)[number];
export type BeatFam = (typeof FAMS_V1)[number];

/** Les departs de la version 1 (ceux de la machine le 2026-10-21 : audio/pattern.ts, audio/kit.ts, audio/voicefx.ts). */
export const FX_DEF_V1: Readonly<Record<(typeof FX_V1)[number], number>> = {
  swing: 0, drive: 0, reverb: 0, delay: 0, chorus: 0, dtime: 0.4, dfb: 2 / 3, bits: 0, comp: 0,
  dtone: 0.638, rsize: 0.566, rtone: 0.442, rpre: 0.167, xtone: 1, crate: 0.624, cdepth: 0.5, brate: 0, catk: 0.742, crel: 1, cthr: 0.45, cratio: 0.571, cknee: 0.5, cmake: 0, chpf: 0.5,
};
export const LAYER_DEF_V1: Readonly<Record<(typeof LAYER_V1)[number], number>> = { syn: 1, lev: 1, tune: 0, fine: 0, start: 0, len: 1, rev: 0 };
export const KNOB_DEF_V1: Readonly<Record<(typeof KNOBS_V1)[number], number>> = { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0, sweep: 0.5, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 };
export const VOICE_DEF_V1: Readonly<Record<(typeof VOICE_V1)[number], number>> = { tone: 0, decay: 1, level: 0.8, dist: 0, reverb: 0, delay: 0, chorus: 0, tune: 0, pan: 0, start: 0, atk: 0, hold: 0, fine: 0, ftype: 0, fcut: 1, freso: 0, fenv: 0, fatk: 0, fdec: 0.5 };

/** Les plages : tout de 0 a 1, sauf ce qui va de -1 a 1. */
const SIGNED_LAYER = new Set<string>(['tune', 'fine']);
const SIGNED_VOICE = new Set<string>(['tone', 'tune', 'pan', 'fine', 'fenv']);

const BPM_MIN = 100;
const BPM_MAX = 150;
const STEPS = 16;
const STEPS_RE = /^[0-9]{16}$/;
const SCALE = 10000;
const EPS = 1e-9;

export interface BeatSample {
  /** son rang dans la liste des samples du site de sa famille (1 a 255) */
  n: number;
  /** l'empreinte de son nom de fichier (sampleHash) : un sample deplace dans la liste se retrouve */
  hash: number;
}

export interface BeatFamily {
  /** la MACHINE de la couche SYNTH : 0 909, 1 808, 2 MM */
  model: number;
  /** le sample de la couche SAMPLE ; absent : OFF */
  sample?: BeatSample;
  /** les reglages de couche differents de leur depart (LAYER_DEF_V1) */
  layer?: Partial<Record<(typeof LAYER_V1)[number], number>>;
}

export interface Beat {
  bpm: number;
  /** les 16 pas de chaque voix (0 a 9) */
  steps: Record<BeatInst, string>;
  /** un preset d'usine (son rang, 1 a 255) : son kit, ses effets et ses voix ; les pas et le tempo sont ceux du code */
  base?: number;
  /** les FX globaux differents de leur depart */
  fx?: Partial<Record<(typeof FX_V1)[number], number>>;
  /** STRETCH, -1 a 1 */
  stretch?: number;
  /** les huit familles (toutes ou aucune) */
  kit?: Record<BeatFam, BeatFamily>;
  knobs?: Partial<Record<(typeof KNOBS_V1)[number], number>>;
  voices?: Partial<Record<BeatInst, Partial<Record<(typeof VOICE_V1)[number], number>>>>;
  /** le mute du pattern (V.5.0) : les voix qu'il coupe ; absent sans voix coupee */
  pmutes?: BeatInst[];
}

/* ---------------- outils ---------------- */

/** L'empreinte d'un nom de fichier (FNV-1a, 8 bits). */
export function sampleHash(file: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < file.length; i += 1) {
    h ^= file.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 8) ^ (h >>> 16) ^ (h >>> 24)) & 0xff;
}

function crc8(bytes: readonly number[], end: number): number {
  let c = 0;
  for (let i = 0; i < end; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_RE = /^[A-Za-z0-9_-]+$/;

function toB64(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromB64(s: string): number[] | null {
  if (!B64_RE.test(s) || s.length % 4 === 1) return null;
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i += 1) {
    buf = (buf << 6) | B64.indexOf(s[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  // Les bits de reste doivent etre a 0 (un seul encodage par beat)
  if (bits > 0 && (buf & ((1 << bits) - 1)) !== 0) return null;
  return out;
}

const range = (signed: boolean): [number, number] => (signed ? [-1, 1] : [0, 1]);

function putVal(out: number[], v: number, signed: boolean): void {
  const [lo, hi] = range(signed);
  const c = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  const n = Math.round((c - lo) * SCALE);
  out.push((n >> 8) & 0xff, n & 0xff);
}

const same = (a: number, b: number): boolean => Math.abs(a - b) < 0.5 / SCALE;

function putMask(out: number[], bits: readonly boolean[], bytes: number): void {
  for (let k = 0; k < bytes; k += 1) {
    let m = 0;
    for (let j = 0; j < 8; j += 1) if (bits[k * 8 + j]) m |= 1 << j;
    out.push(m);
  }
}

/* ---------------- ecriture ---------------- */

/** Le code d'un beat (sans le prefixe ?b=). Une valeur hors plage est bornee, un pas illisible vaut 0. */
export function encodeBeat(beat: Beat): string {
  const out: number[] = [BEAT_VERSION];
  const base = beat.base !== undefined && Number.isInteger(beat.base) && beat.base >= 1 && beat.base <= 255 ? beat.base : 0;
  const fxKeys = FX_V1.filter((k) => beat.fx?.[k] !== undefined && !same(beat.fx[k] as number, FX_DEF_V1[k]));
  const stretch = beat.stretch !== undefined && !same(beat.stretch, 0) ? beat.stretch : null;
  const knobKeys = KNOBS_V1.filter((k) => beat.knobs?.[k] !== undefined && !same(beat.knobs[k] as number, KNOB_DEF_V1[k]));
  const voiceInsts = INSTS_V1.filter((i) => VOICE_V1.some((p) => beat.voices?.[i]?.[p] !== undefined && !same(beat.voices[i]?.[p] as number, VOICE_DEF_V1[p])));
  const pm = INSTS_V1.map((i) => !!beat.pmutes?.includes(i));
  const flags = (base ? 1 : 0) | (beat.kit ? 2 : 0) | (knobKeys.length ? 4 : 0) | (voiceInsts.length ? 8 : 0) | (stretch !== null ? 16 : 0) | (pm.some(Boolean) ? 32 : 0);
  out.push(flags);
  if (base) out.push(base);
  const bpm = Math.round(Number.isFinite(beat.bpm) ? beat.bpm : 130);
  out.push(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm)) - BPM_MIN);
  const rows = INSTS_V1.map((i) => (STEPS_RE.test(beat.steps?.[i] ?? '') ? beat.steps[i] : '0'.repeat(STEPS)));
  const has = rows.map((r) => /[1-9]/.test(r));
  putMask(out, has, 1);
  rows.forEach((r, i) => {
    if (!has[i]) return;
    for (let k = 0; k < STEPS; k += 2) out.push(((r.charCodeAt(k) - 48) << 4) | (r.charCodeAt(k + 1) - 48));
  });
  putMask(out, FX_V1.map((k) => fxKeys.includes(k)), 3);
  for (const k of fxKeys) putVal(out, beat.fx?.[k] as number, false);
  if (stretch !== null) putVal(out, stretch, true);
  if (beat.kit) {
    for (const f of FAMS_V1) {
      const fam = beat.kit[f] ?? { model: 0 };
      const model = Number.isInteger(fam.model) && fam.model >= 0 && fam.model < MODELS_V1.length ? fam.model : 0;
      const sample = fam.sample && Number.isInteger(fam.sample.n) && fam.sample.n >= 1 && fam.sample.n <= 255 ? fam.sample : null;
      const lk = LAYER_V1.filter((p) => fam.layer?.[p] !== undefined && !same(fam.layer[p] as number, LAYER_DEF_V1[p]));
      out.push(model | (sample ? 4 : 0) | (lk.length ? 8 : 0));
      if (sample) out.push(sample.n, sample.hash & 0xff);
      if (lk.length) {
        putMask(out, LAYER_V1.map((p) => lk.includes(p)), 1);
        for (const p of lk) putVal(out, fam.layer?.[p] as number, SIGNED_LAYER.has(p));
      }
    }
  }
  if (knobKeys.length) {
    putMask(out, KNOBS_V1.map((k) => knobKeys.includes(k)), 2);
    for (const k of knobKeys) putVal(out, beat.knobs?.[k] as number, false);
  }
  if (voiceInsts.length) {
    putMask(out, INSTS_V1.map((i) => voiceInsts.includes(i)), 1);
    for (const i of voiceInsts) {
      const ps = VOICE_V1.filter((p) => beat.voices?.[i]?.[p] !== undefined && !same(beat.voices[i]?.[p] as number, VOICE_DEF_V1[p]));
      putMask(out, VOICE_V1.map((p) => ps.includes(p)), 3);
      for (const p of ps) putVal(out, beat.voices?.[i]?.[p] as number, SIGNED_VOICE.has(p));
    }
  }
  if (pm.some(Boolean)) putMask(out, pm, 1);
  out.push(crc8(out, out.length));
  return toB64(out);
}

/* ---------------- lecture ---------------- */

class Bad extends Error {}

/** Le beat d'un code, ou null s'il n'est pas lisible en entier (jamais d'exception). */
export function decodeBeat(code: unknown): Beat | null {
  try {
    return read(code);
  } catch {
    return null;
  }
}

function read(code: unknown): Beat | null {
  if (typeof code !== 'string' || code.length < 4 || code.length > BEAT_MAX_CHARS) return null;
  const bytes = fromB64(code);
  if (!bytes || bytes.length < 6) return null;
  if (crc8(bytes, bytes.length - 1) !== bytes[bytes.length - 1]) return null;
  const end = bytes.length - 1;
  let at = 0;
  const u8 = (): number => {
    if (at >= end) throw new Bad();
    const v = bytes[at];
    at += 1;
    return v;
  };
  const val = (signed: boolean): number => {
    const n = (u8() << 8) | u8();
    const [lo, hi] = range(signed);
    const v = lo + n / SCALE;
    if (v > hi + EPS) throw new Bad();
    return Math.round(v * SCALE) / SCALE;
  };
  const mask = (bytesN: number, bitsN: number): boolean[] => {
    const bits: boolean[] = [];
    for (let k = 0; k < bytesN; k += 1) {
      const m = u8();
      for (let j = 0; j < 8; j += 1) bits.push(((m >> j) & 1) === 1);
    }
    // Un bit au-dela de la liste : reserve, refuse
    if (bits.slice(bitsN).some(Boolean)) throw new Bad();
    return bits.slice(0, bitsN);
  };
  if (u8() !== BEAT_VERSION) return null;
  const flags = u8();
  if (flags & ~63) return null;
  const beat: Beat = { bpm: 0, steps: {} as Record<BeatInst, string> };
  if (flags & 1) {
    const b = u8();
    if (b < 1) return null;
    beat.base = b;
  }
  const t = u8();
  if (t > BPM_MAX - BPM_MIN) return null;
  beat.bpm = BPM_MIN + t;
  const has = mask(1, INSTS_V1.length);
  INSTS_V1.forEach((inst, i) => {
    if (!has[i]) {
      beat.steps[inst] = '0'.repeat(STEPS);
      return;
    }
    let row = '';
    for (let k = 0; k < STEPS / 2; k += 1) {
      const b = u8();
      const hi = b >> 4;
      const lo = b & 15;
      if (hi > 9 || lo > 9) throw new Bad();
      row += String(hi) + String(lo);
    }
    // Une voix marquee doit avoir au moins un pas (un seul encodage par beat)
    if (!/[1-9]/.test(row)) throw new Bad();
    beat.steps[inst] = row;
  });
  const fxm = mask(3, FX_V1.length);
  if (fxm.some(Boolean)) {
    beat.fx = {};
    FX_V1.forEach((k, i) => {
      if (fxm[i]) (beat.fx as Record<string, number>)[k] = val(false);
    });
  }
  if (flags & 16) beat.stretch = val(true);
  if (flags & 2) {
    const kit = {} as Record<BeatFam, BeatFamily>;
    for (const f of FAMS_V1) {
      const d = u8();
      if (d & ~15) throw new Bad();
      const model = d & 3;
      if (model >= MODELS_V1.length) throw new Bad();
      const fam: BeatFamily = { model };
      if (d & 4) {
        const n = u8();
        const hash = u8();
        if (n < 1) throw new Bad();
        fam.sample = { n, hash };
      }
      if (d & 8) {
        const lm = mask(1, LAYER_V1.length);
        if (!lm.some(Boolean)) throw new Bad();
        fam.layer = {};
        LAYER_V1.forEach((p, i) => {
          if (lm[i]) (fam.layer as Record<string, number>)[p] = val(SIGNED_LAYER.has(p));
        });
      }
      kit[f] = fam;
    }
    beat.kit = kit;
  }
  if (flags & 4) {
    const km = mask(2, KNOBS_V1.length);
    if (!km.some(Boolean)) throw new Bad();
    beat.knobs = {};
    KNOBS_V1.forEach((k, i) => {
      if (km[i]) (beat.knobs as Record<string, number>)[k] = val(false);
    });
  }
  if (flags & 8) {
    const vm = mask(1, INSTS_V1.length);
    if (!vm.some(Boolean)) throw new Bad();
    beat.voices = {};
    INSTS_V1.forEach((inst, i) => {
      if (!vm[i]) return;
      const pm = mask(3, VOICE_V1.length);
      if (!pm.some(Boolean)) throw new Bad();
      const o: Record<string, number> = {};
      VOICE_V1.forEach((p, j) => {
        if (pm[j]) o[p] = val(SIGNED_VOICE.has(p));
      });
      (beat.voices as Record<string, Record<string, number>>)[inst] = o;
    });
  }
  if (flags & 32) {
    const mm = mask(1, INSTS_V1.length);
    if (!mm.some(Boolean)) throw new Bad();
    beat.pmutes = INSTS_V1.filter((_, i) => mm[i]);
  }
  // Tout doit avoir ete lu : ni octet de trop, ni de moins
  if (at !== end) return null;
  return beat;
}
