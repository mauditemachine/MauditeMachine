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
 *
 * Version 2 (V.6.0, la relecture, docs/v4/dt2/dt2-master-spec.md 4.5) : un beat que la version 1 ne represente pas (un
 * BPM qui n'est pas un entier de 100 a 150, un SWING au-dela de 66,7 %, des pas sur les pistes 9 a 16, un kit de 16
 * pistes qui dit plus que les champs d'avant) part en version 2, sinon le lien changerait le tempo en silence ; un beat
 * que la version 1 represente part en version 1, octet pour octet comme avant (les liens des pages de motifs ne changent
 * pas). La version 2 : le premier octet vaut 2, puis le corps de la version 1 tel quel (son octet de tempo arrondi et
 * borne, son SWING borne), puis des SECTIONS (un octet de type, deux de longueur, la charge), puis le controle. Une
 * section de type inconnu est sautee a la lecture : les versions suivantes ajoutent des sections, jamais une v3.
 *   1  TEMPO  : le BPM au dixieme (x10, 2 octets, 30 a 300), le SWING (x10000, 2 octets, 0 a 1,8 : 80 %)
 *   2  PISTES 9 A 16 : un masque, puis les 16 pas de chaque piste du masque, deux par octet
 *   3  KIT 16 : les 16 pistes (audio/tracks.ts StoredKit16, des diffs contre la piste vide) : un masque de 2 octets, puis
 *      pour chaque piste un octet de drapeaux (MACHINE, modele, sample, machine de filtre, reglages, POLY, CHOKE, GATE) et
 *      ce qu'ils annoncent ; les reglages sur la liste FIGEE TRACK_P_V2 (le nombre d'octets du masque d'abord, puis une
 *      valeur x10000 en entier signe de longueur variable par reglage : une liste allongee a la fin se relit) ; puis le mix
 *      (TRK LEV, CONTROL ALL, routage du compresseur, source du sidechain, volume)
 */

export const BEAT_VERSION = 1;
/** La version 2 (V.6.0) : le corps de la version 1, puis des sections. */
export const BEAT_VERSION_2 = 2;
/** Le code le plus long accepte (caracteres) : bien au-dela d'un beat complet (environ 400 en v1, quelques milliers en v2). */
export const BEAT_MAX_CHARS = 8000;

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

/** Les listes de la version 2, figees (des ajouts a la fin seulement). Les pistes 9 a 16, puis les 16 (audio/tracks.ts TRACK_KEYS). */
export const HI_V2 = ['T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'] as const;
export type BeatHi = (typeof HI_V2)[number];
export const TRACKS_V2 = [...INSTS_V1, ...HI_V2] as const;
/** Les MACHINES SRC (audio/tracks.ts SRC_MACHINES), les machines de filtre (FltrMachine). */
export const MACHS_V2 = ['oneshot', 'bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'] as const;
export const FMACHS_V2 = ['legacy', 'multi', 'lp4', 'eq'] as const;
/**
 * Les reglages d'une piste (audio/tracks.ts TRACK_P_IDS sans TRK LEV, qui va au mix) dans l'ordre du 2026-11-01 : la voix,
 * ses deux LFO, les potards de la machine, la couche, puis ceux reserves a la V.6.1.
 */
export const TRACK_P_V2 = [
  'tone', 'decay', 'level', 'dist', 'reverb', 'delay', 'chorus', 'tune', 'pan', 'start', 'atk', 'hold', 'fine', 'ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec',
  'l1spd', 'l1mul', 'l1fad', 'l1dst', 'l1wav', 'l1phs', 'l1mod', 'l1dep', 'l2spd', 'l2mul', 'l2fad', 'l2dst', 'l2wav', 'l2phs', 'l2mod', 'l2dep',
  'ktune', 'kattack', 'kdecay', 'kdrive', 'snappy', 'gate', 'ksweep', 'sdtune', 'sddecay', 'sdtone',
  'syn', 'slev', 'stune', 'sfine', 'sstart', 'slen', 'srev',
  'sus', 'rel', 'amode', 'arst', 'fsus', 'frel', 'fdel', 'fkey', 'frst', 'fbase', 'fwid', 'bwrt', 'br', 'srr', 'srrt', 'odrt', 'chr', 'splay', 'sloop', 'l3spd', 'l3mul', 'l3fad', 'l3dst', 'l3wav', 'l3phs', 'l3mod', 'l3dep',
] as const;
export type BeatTrackParam = (typeof TRACK_P_V2)[number];

/** Une piste du kit de 16 pistes (v2), ce qui differe de la piste vide (ONESHOT, modele MM, sans sample, mono). */
export interface BeatTrack {
  /** la MACHINE SRC (MACHS_V2, 1 a 8 ; absente : ONESHOT) */
  mach?: number;
  /** le modele de synthese (MODELS_V1 ; absent : MM) */
  model?: number;
  /** un sample du site : sa famille (FAMS_V1), son rang dans la liste de la famille, l'empreinte de son nom */
  sample?: BeatSample & { fam: number };
  /** la machine de filtre (FMACHS_V2, 1 a 3 ; absente : celle d'avant) */
  fmach?: number;
  /** les reglages differents de leur depart */
  p?: Partial<Record<BeatTrackParam, number>>;
  poly?: boolean;
  /** le groupe de CHOKE (1 a 4) */
  choke?: number;
  gated?: boolean;
}

/** Le kit de 16 pistes d'un beat (v2) : les pistes (indice 0 a 15, absente : vide) et le mix differents du depart. */
export interface BeatTracks {
  t: (BeatTrack | null)[];
  mix?: { tlev?: (number | null)[]; ctlAll?: number; compRoute?: number; scSrc?: number; vol?: number };
}

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
/** v2 : le tempo au dixieme (audio/pattern.ts BPM_RANGE) et le SWING jusqu'a 80 % (SWING_MAX) */
const BPM_FINE_MIN = 30;
const BPM_FINE_MAX = 300;
const SWING_MAX_V2 = 1.8;
const SEC_TEMPO = 1;
const SEC_HI = 2;
const SEC_KIT16 = 3;
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
  /** v2 : les 16 pas des pistes 9 a 16 qui en ont (0 a 9) */
  hi?: Partial<Record<BeatHi, string>>;
  /** v2 : le kit de 16 pistes, quand il dit plus que les champs d'avant */
  tracks?: BeatTracks;
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

/** Une rangee de pas qui en a au moins un. */
const filled = (r: unknown): r is string => typeof r === 'string' && STEPS_RE.test(r) && /[1-9]/.test(r);

/** La version 1 represente-t-elle ce beat (BPM entier de 100 a 150, SWING jusqu'a 66,7 %, rien sur 9 a 16, pas de kit 16) ? */
export function fitsV1(beat: Beat): boolean {
  const bpm = Number.isFinite(beat.bpm) ? beat.bpm : 130;
  const sw = beat.fx?.swing ?? 0;
  return Number.isInteger(bpm) && bpm >= BPM_MIN && bpm <= BPM_MAX && !(sw > 1 + EPS) && !HI_V2.some((k) => filled(beat.hi?.[k])) && !beat.tracks;
}

/** Un entier signe de longueur variable (zigzag, 7 bits par octet). */
function putVarint(out: number[], n: number): void {
  let z = n >= 0 ? n * 2 : -n * 2 - 1;
  while (z >= 0x80) {
    out.push((z % 0x80) | 0x80);
    z = Math.floor(z / 0x80);
  }
  out.push(z);
}

const putU16 = (out: number[], n: number): void => {
  out.push((n >> 8) & 0xff, n & 0xff);
};

function putSection(out: number[], type: number, body: readonly number[]): void {
  out.push(type);
  putU16(out, body.length);
  for (const b of body) out.push(b);
}

/** La valeur d'un reglage de piste (x10000, entier signe ; une valeur illisible : 0). */
const scaled = (v: number): number => (Number.isFinite(v) ? Math.max(-(2 ** 30), Math.min(2 ** 30, Math.round(v * SCALE))) : 0);

function putKit16(out: number[], k: BeatTracks): void {
  const present = TRACKS_V2.map((_, i) => {
    const t = k.t[i];
    return !!t && (!!t.mach || t.model !== undefined || !!t.sample || !!t.fmach || (!!t.p && TRACK_P_V2.some((id) => t.p?.[id] !== undefined)) || !!t.poly || !!t.choke || !!t.gated);
  });
  putMask(out, present, 2);
  TRACKS_V2.forEach((_, i) => {
    const t = k.t[i];
    if (!present[i] || !t) return;
    const mach = t.mach && Number.isInteger(t.mach) && t.mach > 0 && t.mach < MACHS_V2.length ? t.mach : 0;
    const model = t.model !== undefined && Number.isInteger(t.model) && t.model >= 0 && t.model < MODELS_V1.length ? t.model : -1;
    const s = t.sample && Number.isInteger(t.sample.fam) && t.sample.fam >= 0 && t.sample.fam < FAMS_V1.length && Number.isInteger(t.sample.n) && t.sample.n >= 1 && t.sample.n <= 255 ? t.sample : null;
    const fm = t.fmach && Number.isInteger(t.fmach) && t.fmach > 0 && t.fmach < FMACHS_V2.length ? t.fmach : 0;
    const ps = TRACK_P_V2.filter((id) => typeof t.p?.[id] === 'number');
    const ch = t.choke && Number.isInteger(t.choke) && t.choke >= 1 && t.choke <= 4 ? t.choke : 0;
    out.push((mach ? 1 : 0) | (model >= 0 ? 2 : 0) | (s ? 4 : 0) | (fm ? 8 : 0) | (ps.length ? 16 : 0) | (t.poly ? 32 : 0) | (ch ? 64 : 0) | (t.gated ? 128 : 0));
    if (mach) out.push(mach);
    if (model >= 0) out.push(model);
    if (s) out.push(s.fam, s.n, s.hash & 0xff);
    if (fm) out.push(fm);
    if (ps.length) {
      const nb = Math.ceil(TRACK_P_V2.length / 8);
      out.push(nb);
      putMask(out, TRACK_P_V2.map((id) => ps.includes(id)), nb);
      for (const id of ps) putVarint(out, scaled(t.p?.[id] as number));
    }
    if (ch) out.push(ch);
  });
  const m = k.mix ?? {};
  const tl = TRACKS_V2.map((_, i) => typeof m.tlev?.[i] === 'number');
  const u16 = (v: number | undefined): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffff;
  const sc = typeof m.scSrc === 'number' && Number.isInteger(m.scSrc) && m.scSrc >= 0 && m.scSrc < TRACKS_V2.length;
  const vol = typeof m.vol === 'number' && Number.isFinite(m.vol);
  out.push((tl.some(Boolean) ? 1 : 0) | (u16(m.ctlAll) ? 2 : 0) | (u16(m.compRoute) ? 4 : 0) | (sc ? 8 : 0) | (vol ? 16 : 0));
  if (tl.some(Boolean)) {
    putMask(out, tl, 2);
    TRACKS_V2.forEach((_, i) => {
      if (tl[i]) putVal(out, m.tlev?.[i] as number, false);
    });
  }
  if (u16(m.ctlAll)) putU16(out, m.ctlAll);
  if (u16(m.compRoute)) putU16(out, m.compRoute);
  if (sc) out.push(m.scSrc as number);
  if (vol) putVal(out, m.vol as number, false);
}

/** Les sections de la version 2 (TEMPO toujours ; les pistes 9 a 16 et le kit 16 s'ils servent). */
function putSections(out: number[], beat: Beat): void {
  const bpm = Number.isFinite(beat.bpm) ? beat.bpm : 130;
  const t: number[] = [];
  putU16(t, Math.round(Math.min(BPM_FINE_MAX, Math.max(BPM_FINE_MIN, bpm)) * 10));
  const sw = beat.fx?.swing ?? 0;
  putU16(t, Math.round(Math.min(SWING_MAX_V2, Math.max(0, Number.isFinite(sw) ? sw : 0)) * SCALE));
  putSection(out, SEC_TEMPO, t);
  const hi = HI_V2.map((k) => (filled(beat.hi?.[k]) ? (beat.hi?.[k] as string) : null));
  if (hi.some((r) => r !== null)) {
    const h: number[] = [];
    putMask(h, hi.map((r) => r !== null), 1);
    for (const r of hi) {
      if (r === null) continue;
      for (let k = 0; k < STEPS; k += 2) h.push(((r.charCodeAt(k) - 48) << 4) | (r.charCodeAt(k + 1) - 48));
    }
    putSection(out, SEC_HI, h);
  }
  if (beat.tracks) {
    const k: number[] = [];
    putKit16(k, beat.tracks);
    putSection(out, SEC_KIT16, k);
  }
}

/**
 * Le code d'un beat (sans le prefixe ?b=). Une valeur hors plage est bornee, un pas illisible vaut 0. La version 1 si elle
 * represente le beat (fitsV1), octet pour octet comme avant ; sinon la version 2.
 */
export function encodeBeat(beat: Beat): string {
  const v2 = !fitsV1(beat);
  const out: number[] = [v2 ? BEAT_VERSION_2 : BEAT_VERSION];
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
  if (v2) putSections(out, beat);
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
  const ver = u8();
  if (ver !== BEAT_VERSION && ver !== BEAT_VERSION_2) return null;
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
  if (ver === BEAT_VERSION_2) {
    // Les sections (v2) : chacune lue en entier, une de type inconnu sautee ; TEMPO obligatoire, une seule de chaque type
    const seen = new Set<number>();
    while (at < end) {
      const type = u8();
      const len = (u8() << 8) | u8();
      if (at + len > end || seen.has(type)) return null;
      seen.add(type);
      const stop = at + len;
      if (type === SEC_TEMPO) readTempo(beat, u8);
      else if (type === SEC_HI) readHi(beat, u8);
      else if (type === SEC_KIT16) beat.tracks = readKit16(u8, mask, val);
      else at = stop;
      if (at !== stop) return null;
    }
    if (!seen.has(SEC_TEMPO)) return null;
  }
  // Tout doit avoir ete lu : ni octet de trop, ni de moins
  if (at !== end) return null;
  return beat;
}

/** TEMPO (v2) : le BPM au dixieme et le SWING (0 a 1,8) ; ils remplacent ceux du corps (bornes, arrondis). */
function readTempo(beat: Beat, u8: () => number): void {
  const b10 = (u8() << 8) | u8();
  const sw = (u8() << 8) | u8();
  if (b10 < BPM_FINE_MIN * 10 || b10 > BPM_FINE_MAX * 10 || sw > SWING_MAX_V2 * SCALE) throw new Bad();
  beat.bpm = b10 / 10;
  const fx = { ...(beat.fx ?? {}) } as Record<string, number>;
  if (sw > 0) fx.swing = sw / SCALE;
  else delete fx.swing;
  if (Object.keys(fx).length > 0) beat.fx = fx;
  else delete beat.fx;
}

/** Les pistes 9 a 16 (v2) : un masque, les pas de chaque piste marquee (au moins un pas). */
function readHi(beat: Beat, u8: () => number): void {
  const m = u8();
  if (m === 0) throw new Bad();
  const hi: Partial<Record<BeatHi, string>> = {};
  HI_V2.forEach((k, i) => {
    if (!((m >> i) & 1)) return;
    let row = '';
    for (let j = 0; j < STEPS / 2; j += 1) {
      const b = u8();
      if (b >> 4 > 9 || (b & 15) > 9) throw new Bad();
      row += String(b >> 4) + String(b & 15);
    }
    if (!/[1-9]/.test(row)) throw new Bad();
    hi[k] = row;
  });
  beat.hi = hi;
}

/** Le kit de 16 pistes (v2). */
function readKit16(u8: () => number, mask: (bytesN: number, bitsN: number) => boolean[], val: (signed: boolean) => number): BeatTracks {
  const varint = (): number => {
    let z = 0;
    let mul = 1;
    for (let i = 0; i < 5; i += 1) {
      const b = u8();
      // Un seul encodage : pas d'octet final nul apres le premier
      if (i > 0 && b === 0) throw new Bad();
      z += (b & 0x7f) * mul;
      if (!(b & 0x80)) return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      mul *= 0x80;
    }
    throw new Bad();
  };
  const u16 = (): number => (u8() << 8) | u8();
  const present = mask(2, TRACKS_V2.length);
  const t: (BeatTrack | null)[] = TRACKS_V2.map(() => null);
  present.forEach((on, i) => {
    if (!on) return;
    const f = u8();
    if (f === 0) throw new Bad();
    const tr: BeatTrack = {};
    if (f & 1) {
      tr.mach = u8();
      if (tr.mach < 1 || tr.mach >= MACHS_V2.length) throw new Bad();
    }
    if (f & 2) {
      tr.model = u8();
      if (tr.model >= MODELS_V1.length) throw new Bad();
    }
    if (f & 4) {
      const fam = u8();
      const n = u8();
      const hash = u8();
      if (fam >= FAMS_V1.length || n < 1) throw new Bad();
      tr.sample = { fam, n, hash };
    }
    if (f & 8) {
      tr.fmach = u8();
      if (tr.fmach < 1 || tr.fmach >= FMACHS_V2.length) throw new Bad();
    }
    if (f & 16) {
      const nb = u8();
      if (nb < 1) throw new Bad();
      const bits: boolean[] = [];
      for (let k = 0; k < nb; k += 1) {
        const b = u8();
        for (let j = 0; j < 8; j += 1) bits.push(((b >> j) & 1) === 1);
      }
      if (!bits.some(Boolean)) throw new Bad();
      const p: Partial<Record<BeatTrackParam, number>> = {};
      // Un reglage au-dela de la liste (une version d'apres) : sa valeur est lue et laissee
      bits.forEach((b, j) => {
        if (!b) return;
        const v = varint() / SCALE;
        if (j < TRACK_P_V2.length) p[TRACK_P_V2[j]] = v;
      });
      if (Object.keys(p).length > 0) tr.p = p;
    }
    if (f & 32) tr.poly = true;
    if (f & 64) {
      tr.choke = u8();
      if (tr.choke < 1 || tr.choke > 4) throw new Bad();
    }
    if (f & 128) tr.gated = true;
    t[i] = tr;
  });
  const mf = u8();
  if (mf & ~31) throw new Bad();
  const out: BeatTracks = { t };
  if (mf) {
    const mix: NonNullable<BeatTracks['mix']> = {};
    if (mf & 1) {
      const tl = mask(2, TRACKS_V2.length);
      if (!tl.some(Boolean)) throw new Bad();
      mix.tlev = tl.map((on) => (on ? val(false) : null));
    }
    if (mf & 2) mix.ctlAll = u16();
    if (mf & 4) mix.compRoute = u16();
    if (mf & 8) {
      mix.scSrc = u8();
      if (mix.scSrc >= TRACKS_V2.length) throw new Bad();
    }
    if (mf & 16) mix.vol = val(false);
    out.mix = mix;
  }
  return out;
}
