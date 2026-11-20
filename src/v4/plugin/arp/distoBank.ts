/**
 * DISTO, la banque de la page (v44 proposee, v46 publiee : disto.ts DISTO_PRESETS). Mika : "trouve moi des
 * presets recopie les settings de decapitator !" et, sur les touches STYLE : "tout ca devrait etre mieux place ou combine
 * par famille dans les presets de la disto !".
 *
 * - DISTO_FAMILIES : les douze courbes rangees en quatre familles, du plus doux au plus mechant (TAPE, TUBE, TRANSISTOR,
 *   DESTROY), trois styles chacune ; MM (l'OVERDRIVE du moteur, le depart) reste a part.
 * - DISTO_BANK : 18 presets rangés par famille. Ce sont les recettes connues des utilisateurs du Decapitator (styles A,
 *   E, N, T, P ; DRIVE, LOW CUT, TONE, HIGH CUT, THUMP, STEEP, PUNISH, MIX, AUTO), exprimees avec nos reglages ; aucun
 *   fichier de Soundtoys n'est repris. Les quatre presets DESTROY sont a nous (nos courbes etendues).
 *   Les filtres passent par les reglages d'aujourd'hui (xDLow, xDThump, xDTone, xDHigh, xDSteep, PRE et POST) : l'EQ de la
 *   nouvelle page n'est qu'une autre face de ces memes parametres. CLEAN : le grave propre (2 bandes, la basse contournee).
 *
 * Module pur (seulement extra-params.json) : il sert aussi au rendu hors ligne (aucun son).
 */
import spec from '../../../../plugin/mm-arp/extra-params.json';

type SpecParam = { id: string; def: number; section?: string; steps?: readonly string[] };
const PARAMS = spec.params as unknown as readonly SpecParam[];
const steps = (id: string): readonly string[] => PARAMS.find((p) => p.id === id)?.steps ?? [];
const DEF: Readonly<Record<string, number>> = Object.fromEntries(PARAMS.filter((p) => p.section === 'disto').map((p) => [p.id, p.def]));
const LFO_BEATS = ['8 BAR', '4 BAR', '2 BAR', '1 BAR', '1/2', '1/4', '1/8', '1/16', '1/32'] as const;

export type DistoStyle = 'MM' | 'A' | 'E' | 'N' | 'T' | 'P' | 'TAPE' | 'FUZZ' | 'DIODE' | 'AMP' | 'RECT' | 'FOLD' | 'CRUSH';
export type DistoFamilyId = 'TAPE' | 'TUBE' | 'TRANSISTOR' | 'DESTROY';

export interface DistoFamily {
  id: DistoFamilyId;
  /** ce que la famille fait a l'oreille */
  feel: string;
  /** cap : la lettre gravee sur la touche (celles du Decapitator), name : le nom sous la touche */
  styles: readonly { st: DistoStyle; cap: string; name: string; long: string }[];
}

export const DISTO_FAMILIES: readonly DistoFamily[] = [
  {
    id: 'TAPE',
    feel: 'SOFT · WARM',
    styles: [
      { st: 'A', cap: 'A', name: 'PREAMP', long: 'Tape machine tube preamp: soft, warm, even harmonics' },
      { st: 'N', cap: 'N', name: 'IRON', long: 'Class A input transformer: the lows saturate first, thick' },
      { st: 'TAPE', cap: '', name: 'TAPE', long: 'Tape: a soft arctangent, the highs pre-emphasised' },
    ],
  },
  {
    id: 'TUBE',
    feel: 'GRAIN · ROUND',
    styles: [
      { st: 'T', cap: 'T', name: 'TRIODE', long: 'Triode: very asymmetric, even harmonics, the grain' },
      { st: 'P', cap: 'P', name: 'PENTODE', long: 'Pentode: hard, buzzing, odd, the highs held' },
      { st: 'AMP', cap: '', name: 'AMP', long: 'Guitar amp: asymmetric, pushed mids, highs cut at 7 kHz' },
    ],
  },
  {
    id: 'TRANSISTOR',
    feel: 'BITE · HARD',
    styles: [
      { st: 'E', cap: 'E', name: 'CONSOLE', long: 'Transistor console: a harder knee, odd, crispy highs' },
      { st: 'DIODE', cap: '', name: 'DIODE', long: 'Diode clipping: straight up to the rail, symmetric' },
      { st: 'FUZZ', cap: '', name: 'FUZZ', long: 'Fuzz: a very hard, very offset knee' },
    ],
  },
  {
    id: 'DESTROY',
    feel: 'BROKEN · WEIRD',
    styles: [
      { st: 'RECT', cap: '', name: 'RECT', long: 'Rectifier: an octave up grows with the level' },
      { st: 'FOLD', cap: '', name: 'FOLD', long: 'Wavefolder: the peak folds back instead of flattening' },
      { st: 'CRUSH', cap: '', name: 'CRUSH', long: 'Bit crusher: twelve coarse steps, then a hard clip' },
    ],
  },
];

/** La famille d'un style (MM : aucune). */
export const familyOf = (st: string): DistoFamilyId | null => DISTO_FAMILIES.find((f) => f.styles.some((s) => s.st === st))?.id ?? null;

/* ---------------- les presets ---------------- */

type Filt = { mode: 'LP' | 'BP' | 'HP' | 'PEAK'; hz: number; reso?: number };
export interface DistoUnits {
  st: DistoStyle;
  /** 0..1 (le DRIVE du Decapitator / 10) */
  drive: number;
  punish?: boolean;
  /** Hz (0 : OFF) */
  low?: number;
  thump?: boolean;
  /** -1 (DARK) .. 1 (BRIGHT) : le TONE du Decapitator / 5 */
  tone?: number;
  /** Hz (0 : OFF) */
  high?: number;
  steep?: boolean;
  mix?: number;
  /** dB */
  out?: number;
  auto?: boolean;
  /** Hz : CLEAN LOW, le grave passe propre sous cette frequence (2 bandes, la basse contournee) ; 0 : OFF */
  clean?: number;
  pre?: Filt;
  post?: Filt;
  box?: { type: 'SMALL' | 'COMBO' | 'STACK' | 'RADIO'; size?: number; mix?: number };
  env?: number;
  lfo?: { shape?: 'SINE' | 'TRI' | 'SAW' | 'SQUARE' | 'RANDOM'; rate: (typeof LFO_BEATS)[number]; amt: number; tgt: 'DRIVE' | 'MORPH' | 'TONE' | 'PRE' | 'POST' | 'MIX' };
}

export interface DistoBankPreset {
  name: string;
  family: DistoFamilyId;
  desc: string;
  /** la recette telle qu'on la lit sur un Decapitator (pour le rapport et la liste) */
  recipe: string;
  u: DistoUnits;
  /** les reglages (0..1) de la DISTO et dist (DRIVE) */
  v: Readonly<Record<string, number>>;
}

const pick = (id: string, name: string): number => {
  const s = steps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`DISTO : ${id} inconnu ${name}`);
  return i / (s.length - 1);
};
const lowV = (hz: number): number => (hz <= 0 ? 0 : 0.02 + (0.98 * Math.log(hz / 20)) / Math.log(50));
const highV = (hz: number): number => (hz <= 0 ? 1 : (0.98 * Math.log(hz / 1000)) / Math.log(20));
const filtV = (hz: number): number => Math.log(hz / 20) / Math.log(1000);
const bip = (x: number): number => 0.5 + x / 2;

/** Les reglages 0..1 d'une recette (la loi de disto.ts P, plus CLEAN). */
export function distoValues(o: DistoUnits): Record<string, number> {
  const v: Record<string, number> = { ...DEF };
  v.dist = o.drive;
  v.xDStyle = pick('xDStyle', o.st);
  v.xDPunish = 0;
  v.xDPunish2 = o.punish ? 1 : 0;
  v.xDLow = lowV(o.low ?? 0);
  v.xDThump = o.thump ? 1 : 0;
  v.xDTone = bip(o.tone ?? 0);
  v.xDHigh = highV(o.high ?? 0);
  v.xDSteep = o.steep ? 1 : 0;
  v.xDMix = o.mix ?? 1;
  v.xDOut = ((o.out ?? 0) + 18) / 36;
  v.xDAuto = o.auto === false ? 0 : 1;
  if (o.clean) {
    v.xDBands = 0.5;
    v.xDXLo = Math.log(o.clean / 40) / Math.log(25);
    v.xDB1Byp = 1;
  }
  v.xDEnvAmt = bip(o.env ?? 0);
  if (o.lfo) {
    v.xDLfoShape = pick('xDLfoShape', o.lfo.shape ?? 'SINE');
    v.xDLfoSync = 1;
    v.xDLfoRate = LFO_BEATS.indexOf(o.lfo.rate) / (LFO_BEATS.length - 1);
    v.xDLfoAmt = bip(o.lfo.amt);
    v.xDLfoTarget = pick('xDLfoTarget', o.lfo.tgt);
  }
  if (o.pre) {
    v.xDPreMode = pick('xDPreMode', o.pre.mode);
    v.xDPreFreq = filtV(o.pre.hz);
    v.xDPreReso = o.pre.reso ?? 0;
  }
  if (o.post) {
    v.xDPostMode = pick('xDPostMode', o.post.mode);
    v.xDPostFreq = filtV(o.post.hz);
    v.xDPostReso = o.post.reso ?? 0;
  }
  if (o.box) {
    v.xDBox = pick('xDBox', o.box.type);
    v.xDBoxSize = o.box.size ?? 0.5;
    v.xDBoxMix = o.box.mix ?? 1;
  }
  for (const [k, x] of Object.entries(v)) if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error(`DISTO : ${k} hors de 0..1 (${x})`);
  return v;
}

const B = (name: string, family: DistoFamilyId, recipe: string, desc: string, u: DistoUnits): DistoBankPreset => ({ name, family, recipe, desc, u, v: distoValues(u) });

/**
 * La banque. La recette : les reglages lus comme sur un Decapitator (DRIVE et TONE a son echelle 0..10 et -5..+5).
 * OUTPUT : la correction mesuree hors ligne (MUNICH BASS et NEON ARP, moteur x8) pour qu'aucun preset ne saute de plus de
 * 1.5 dB en sonie face au son sec (AUTO fait le gros du travail). v46 : les trois presets PUNISH recales avec PUNISH v2
 * (MUNICH BASS, NEON ARP, PLUCK ARP, aucun son : PARALLEL SMASH -0.5, PUNISH BASS -0.5, PUNISH ME -1).
 */
export const DISTO_BANK: readonly DistoBankPreset[] = [
  // TAPE : doux, chaud
  B('BUS GLUE', 'TAPE', 'A · DRIVE 3 · HIGH CUT 12K · MIX 100', 'The drum bus glue, on the whole arp: a little tube, the level kept', { st: 'A', drive: 0.3, high: 12000, out: -0.5 }),
  B('BASS WARMTH', 'TAPE', 'N · DRIVE 4 · LOW CUT 35 + THUMP · TONE -1 · HIGH CUT 8K', 'Transformer warmth, the low end bumped by THUMP', { st: 'N', drive: 0.4, low: 35, thump: true, tone: -0.2, high: 8000, out: -1.5 }),
  B('CONSOLE PUSH', 'TAPE', 'N · DRIVE 5.5 · LOW CUT 60 · HIGH CUT 14K', 'The mix bus pushed into the iron', { st: 'N', drive: 0.55, low: 60, high: 14000, out: -2.5 }),
  B('TAPE KISS', 'TAPE', 'TAPE · DRIVE 3.5 · LOW CUT 30 · HIGH CUT 10K', 'Tape saturation, the highs rounded off', { st: 'TAPE', drive: 0.35, low: 30, high: 10000, out: -1 }),
  B('WORN TAPE', 'TAPE', 'TAPE · DRIVE 6 · LOW CUT 100 · TONE -1.5 · HIGH CUT 6K STEEP · LFO TONE', 'An old cassette: dark, narrow, the tone wobbling on the bar', {
    out: -3,
    st: 'TAPE',
    drive: 0.6,
    low: 100,
    tone: -0.3,
    high: 6000,
    steep: true,
    lfo: { shape: 'SINE', rate: '1 BAR', amt: 0.25, tgt: 'TONE' },
  }),
  // TUBE : le grain
  B('LEAD GRIT', 'TUBE', 'T · DRIVE 4 · LOW CUT 150 · TONE +2 · HIGH CUT 12K · MIX 50', 'The vocal grit recipe on a lead: forward, half dry', { st: 'T', drive: 0.4, low: 150, tone: 0.4, high: 12000, mix: 0.5, out: 1 }),
  B('PENTODE BITE', 'TUBE', 'P · DRIVE 5.5 · LOW CUT 90 · TONE +2 · HIGH CUT 9K · MIX 80', 'Bright and buzzing, the synth recipe', { st: 'P', drive: 0.55, low: 90, tone: 0.4, high: 9000, mix: 0.8 }),
  B('PARALLEL SMASH', 'TUBE', 'P · DRIVE 10 · PUNISH · HIGH CUT 7K STEEP · MIX 30', 'Everything smashed, mixed in under the dry', { st: 'P', drive: 1, punish: true, high: 7000, steep: true, mix: 0.3, out: -0.5 }),
  B('PUNISH BASS', 'TUBE', 'T · DRIVE 6 · PUNISH · LOW CUT 40 + THUMP · TONE -1 · HIGH CUT 4.5K STEEP · MIX 55', 'A bass that bites, the sub kept clean under 110 Hz', {
    out: -0.5,
    st: 'T',
    drive: 0.6,
    punish: true,
    low: 40,
    thump: true,
    tone: -0.2,
    high: 4500,
    steep: true,
    mix: 0.55,
    clean: 110,
  }),
  B('AMP CRUNCH', 'TUBE', 'AMP · DRIVE 6 · LOW CUT 90 · TONE -1 · HIGH CUT 6.5K · COMBO', 'A guitar amp into a combo cabinet', { st: 'AMP', drive: 0.6, low: 90, tone: -0.2, high: 6500, box: { type: 'COMBO', size: 0.5, mix: 1 } }),
  // TRANSISTOR : le mordant
  B('PLUCK CRACK', 'TRANSISTOR', 'E · DRIVE 6 · LOW CUT 150 · TONE +3 · HIGH CUT 14K · MIX 70', 'The snare crack recipe on a pluck: hard attack, crispy top', { st: 'E', drive: 0.6, low: 150, tone: 0.6, high: 14000, mix: 0.7, out: 0.5 }),
  B('LO-FI', 'TRANSISTOR', 'E · DRIVE 5 · LOW CUT 450 · TONE +2 · HIGH CUT 3.5K STEEP', 'The telephone: no lows, no highs, all grit', { st: 'E', drive: 0.5, low: 450, tone: 0.4, high: 3500, steep: true, out: 1 }),
  B('DIODE RAIL', 'TRANSISTOR', 'DIODE · DRIVE 6 · LOW CUT 150 · HIGH CUT 12K STEEP', 'Hard diode clipping, tight lows', { st: 'DIODE', drive: 0.6, low: 150, high: 12000, steep: true, out: -1.5 }),
  B('FUZZ BASS', 'TRANSISTOR', 'FUZZ · DRIVE 7 · TONE -1.5 · HIGH CUT 5K STEEP · MIX 60', 'Fuzz over the bass, the sub clean under 100 Hz', { st: 'FUZZ', drive: 0.7, tone: -0.3, high: 5000, steep: true, mix: 0.6, clean: 100, out: -1 }),
  // DESTROY : a nous
  B('OCTAVE GHOST', 'DESTROY', 'RECT · DRIVE 5.5 · PRE HP 300 · POST LP 9K · MIX 60', 'Rectifier: an octave up shimmering over the note', { st: 'RECT', drive: 0.55, mix: 0.6, pre: { mode: 'HP', hz: 300 }, post: { mode: 'LP', hz: 9000 }, out: 1.5 }),
  B('FOLD WOBBLE', 'DESTROY', 'FOLD · DRIVE 4.5 · HIGH CUT 9K · MIX 70 · LFO 1/8 DRIVE', 'The folder breathing in eighths', { st: 'FOLD', drive: 0.45, high: 9000, mix: 0.7, out: -1, lfo: { shape: 'SINE', rate: '1/8', amt: 0.5, tgt: 'DRIVE' } }),
  B('BIT CRUSH', 'DESTROY', 'CRUSH · DRIVE 4 · POST LP 4.5K · MIX 75', 'Bit crusher tamed by a resonant low-pass', { st: 'CRUSH', drive: 0.4, mix: 0.75, post: { mode: 'LP', hz: 4500, reso: 0.3 } }),
  B('PUNISH ME', 'DESTROY', 'RECT · DRIVE 9 · PUNISH · HIGH CUT 6K STEEP · MIX 50', 'Everything to the right, the sub kept clean under 90 Hz', { st: 'RECT', drive: 0.9, punish: true, high: 6000, steep: true, mix: 0.5, clean: 90, out: -1 }),
];
