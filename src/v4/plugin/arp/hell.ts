/**
 * HELL (2026-11-13, Mika, facon Echobode de Sonic Charge : un delay avec un decaleur de frequence de Bode dans sa boucle,
 * chaque repetition monte ou descend d'un cran : spirales, escalier sans fin ; complete le 2026-11-17 : "HELL, c'est
 * l'effet Echobode a la sauce Maudite Machine, il manque beaucoup de choses, et mets aussi des presets la-dedans").
 * Le DSP : plugin/mm-arp/dsp/Hell.{h,cpp} ; les reglages : extra-params.json, section hell. Ici, cote face :
 * - les lois (les memes que Hell.cpp) et le texte du decalage selon RANGE ;
 * - la banque de presets (24, noms et valeurs a nous) : un preset regle tout HELL sauf MIX (la dose reste celle de Mika) ;
 *   si HELL est coupe (MIX a 0), il le met a 35 % pour qu'on l'entende tout de suite ;
 * - la migration d'un preset d'avant RANGE (comme le C++ pour un projet, PluginProcessor::migrateHell) ;
 * - deux reglages vus par la page (pcbui.tsx SRC.virtual) : DELAY (le temps libre, ou la note quand SYNC est leve) et
 *   SYNC (le levier : FREE ou la derniere note choisie).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';
import { arpExtra } from './extra';

const steps = (id: string): readonly string[] => (spec.params.find((p) => p.id === id)?.steps ?? []) as readonly string[];
export const HELL_SYNC = steps('xHellSync');
export const HELL_RANGES = steps('xHellRange');
const DEAD = 0.03;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const idx = (id: string, v: number): number => {
  const n = steps(id).length;
  return Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};

/* ---------------- les lois (Hell.cpp) ---------------- */

export const hellTimeMs = (v: number): number => 5 * Math.pow(400, clamp01(v));
export const hellOldShiftHz = (v: number): number => 5000 * Math.pow(2 * clamp01(v) - 1, 3);
export const SYNC_MULT = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16] as const;
export const LFO_BEATS = [32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125] as const;
export const LFO_BEAT_NAMES = ['8 BAR', '4 BAR', '2 BAR', '1 BAR', '1/2', '1/4', '1/8', '1/16', '1/32'] as const;

/** La part 0..1 de la demi-course hors du cran mort (0 : au centre). */
const tOf = (v: number): number => {
  const ax = Math.abs(2 * clamp01(v) - 1);
  return ax < DEAD ? -1 : Math.min(1, (ax - DEAD) / (1 - DEAD));
};

/** Le decalage en Hz (FINE, WIDE) ; SYNC, MIDI : null (il depend du tempo, de la note). */
export function hellShiftHz(v: number, range: number): number | null {
  const t = tOf(v);
  const s = v < 0.5 ? -1 : 1;
  if (t < 0) return 0;
  if (range === 0) return s * 3 * Math.pow(200 / 3, t);
  if (range === 1) return s * 10 * Math.pow(500, t);
  return null;
}

/** La valeur 0..1 d'un decalage (FINE, WIDE) : l'inverse de la loi. */
export function hellShiftV(hz: number, range: number): number {
  const a = Math.abs(hz);
  if (a < 0.5) return 0.5;
  const t = range === 0 ? Math.log(Math.min(200, Math.max(3, a)) / 3) / Math.log(200 / 3) : Math.log(Math.min(5000, Math.max(10, a)) / 10) / Math.log(500);
  const ax = DEAD + (1 - DEAD) * t;
  return 0.5 + (hz < 0 ? -ax : ax) / 2;
}

const fmtHz = (f: number): string => {
  const a = Math.abs(f);
  const sgn = f > 0 ? '+' : f < 0 ? '-' : '';
  return a < 0.05 ? '0 HZ' : `${sgn}${a >= 1000 ? `${(a / 1000).toFixed(2)} KHZ` : a >= 100 ? `${Math.round(a)} HZ` : `${a.toFixed(1)} HZ`}`;
};
const frac = (x: number): string => (x >= 1 ? `${x}` : `1/${Math.round(1 / x)}`);

/** Le texte du decalage selon RANGE (le tempo et la note ne sont connus que du C++ : SYNC et MIDI en rapport). */
export function hellShiftText(v: number, range: number = idx('xHellRange', arpExtra.of('xHellRange'))): string {
  const t = tOf(v);
  if (t < 0) return '0';
  const sgn = v < 0.5 ? '-' : '+';
  if (range === 2) return `${sgn}${frac(SYNC_MULT[Math.min(8, Math.floor(t * 9))])} / BEAT`;
  if (range === 3) return `${sgn}${Math.pow(2, -4 + 5 * t).toFixed(2)} x NOTE`;
  return fmtHz(hellShiftHz(v, range) ?? 0);
}

/* ---------------- la migration d'un preset d'avant RANGE (PluginProcessor::migrateHell) ---------------- */

/** Les reglages HELL d'un preset sans RANGE : le decalage, TONE et LFO DEPTH passes aux nouveaux reglages. */
export function hellMigrate(x: Record<string, unknown>): Record<string, unknown> {
  if (typeof x.xHellShift !== 'number' || typeof x.xHellRange === 'number') return x;
  const out = { ...x };
  const hz = hellOldShiftHz(x.xHellShift);
  const range = Math.abs(hz) <= 200 ? 0 : 1;
  out.xHellRange = range / 3;
  out.xHellShift = hellShiftV(hz, range);
  const t = typeof x.xHellTone === 'number' ? x.xHellTone : 0.5;
  if (t < 0.49) {
    out.xHellLp = Math.log((600 * Math.pow(30, t / 0.49)) / 300) / Math.log(20000 / 300);
    out.xHellTone = 0.5;
  } else if (t > 0.51) {
    out.xHellHp = Math.log((20 * Math.pow(150, (t - 0.51) / 0.49)) / 20) / Math.log(200);
    out.xHellTone = 0.5;
  }
  const d = typeof x.xHellLfoDepth === 'number' ? x.xHellLfoDepth : 0;
  if (d > 0) {
    out.xHellLfoAmt = 0.5 + 0.5 * d;
    out.xHellLfoTarget = 0;
    out.xHellLfoDepth = 0;
  }
  return out;
}

/* ---------------- les presets ---------------- */

export interface HellPreset {
  name: string;
  desc: string;
  v: Readonly<Record<string, number>>;
}

const sync = (name: string): number => {
  const i = HELL_SYNC.indexOf(name);
  if (i < 0) throw new Error(`HELL : temps inconnu ${name}`);
  return i / (HELL_SYNC.length - 1);
};
const pick = (id: string, name: string): number => {
  const s = steps(id);
  const i = s.indexOf(name);
  if (i < 0) throw new Error(`HELL : ${id} inconnu ${name}`);
  return i / (s.length - 1);
};
const msV = (t: number): number => Math.log(t / 5) / Math.log(400);
const lfoV = (hz: number): number => Math.log(hz / 0.02) / Math.log(500);
const hpV = (hz: number): number => (hz <= 0 ? 0 : Math.log(hz / 20) / Math.log(200));
const lpV = (hz: number): number => (hz <= 0 ? 1 : Math.log(hz / 300) / Math.log(20000 / 300));
/** SYNC : un multiple du tempo ; MIDI : une fraction de la note. */
const syncShiftV = (m: number): number => {
  const i = SYNC_MULT.findIndex((x) => Math.abs(x - Math.abs(m)) < 1e-9);
  const ax = DEAD + ((1 - DEAD) * (i + 0.5)) / 9;
  return 0.5 + (m < 0 ? -ax : ax) / 2;
};
const midiShiftV = (r: number): number => {
  const ax = DEAD + (1 - DEAD) * ((Math.log2(Math.abs(r)) + 4) / 5);
  return 0.5 + (r < 0 ? -ax : ax) / 2;
};

interface Units {
  /** une note ('1/8.') ou des ms */
  t: string | number;
  fb: number;
  cross?: boolean;
  range?: 'FINE' | 'WIDE' | 'SYNC' | 'MIDI';
  /** FINE, WIDE : Hz ; SYNC : cycles par temps ; MIDI : fraction de la note */
  sh: number;
  ud?: number;
  sp?: number;
  ph?: number;
  ar?: boolean;
  smear?: number;
  hp?: number;
  lp?: number;
  shape?: 'SINE' | 'SAW' | 'SQUARE' | 'RANDOM';
  /** Hz, ou une note de LFO_BEAT_NAMES */
  lr?: number | string;
  amt?: number;
  st?: boolean;
  tgt?: 'FREQ' | 'PHASE' | 'LOW-PASS' | 'DELAY';
}

const P = (name: string, desc: string, o: Units): HellPreset => {
  const range = o.range ?? (Math.abs(o.sh) > 200 ? 'WIDE' : 'FINE');
  const ri = HELL_RANGES.indexOf(range);
  const lsync = typeof o.lr === 'string';
  return {
    name,
    desc,
    v: {
      xHellSync: typeof o.t === 'string' ? sync(o.t) : 0,
      xHellTime: typeof o.t === 'number' ? msV(o.t) : 0.5,
      xHellFb: o.fb,
      xHellCross: o.cross ? 1 : 0,
      xHellRange: ri / 3,
      xHellShift: ri === 2 ? syncShiftV(o.sh) : ri === 3 ? midiShiftV(o.sh) : hellShiftV(o.sh, ri),
      xHellUpDown: o.ud ?? 1,
      xHellSpread: o.sp ?? 0,
      xHellPhase: (o.ph ?? 0) / 360,
      xHellAntiRefl: o.ar ? 1 : 0,
      xHellSmear: o.smear ?? 0,
      xHellHp: hpV(o.hp ?? 0),
      xHellLp: lpV(o.lp ?? 0),
      xHellLfoShape: pick('xHellLfoShape', o.shape ?? 'SINE'),
      xHellLfoSync: lsync ? 1 : 0,
      xHellLfoRate: lsync ? LFO_BEAT_NAMES.indexOf(o.lr as (typeof LFO_BEAT_NAMES)[number]) / (LFO_BEAT_NAMES.length - 1) : lfoV((o.lr as number | undefined) ?? 0.4),
      xHellLfoAmt: 0.5 + 0.5 * (o.amt ?? 0),
      xHellLfoStereo: o.st ? 1 : 0,
      xHellLfoTarget: pick('xHellLfoTarget', o.tgt ?? 'FREQ'),
      xHellLfoDepth: 0,
      xHellTone: 0.5,
    },
  };
};

export const HELL_PRESETS: readonly HellPreset[] = [
  // les douze d'avant (2026-11-13), passes aux nouveaux reglages (meme idee, meme son de depart)
  P('SLOW ASCENT', 'Each repeat climbs a little: a slow rising spiral', { t: '1/4', fb: 0.72, sh: 35, sp: 0.2 }),
  P('BARBER DOWN', 'Endless falling staircase on sixteenths', { t: '1/16', fb: 0.88, sh: -18, ud: 0, lp: 5800 }),
  P('TIN CAN', 'Short metallic box, both sidebands', { t: 18, fb: 0.82, sh: 7, ud: 0.5, sp: 0.5, hp: 120 }),
  P('HALO', 'Bright shimmer, a fifth-ish up each pass', { t: '1/8.', fb: 0.7, sh: 420, sp: 0.35, lr: 0.3, amt: 0.22, hp: 90, smear: 0.25 }),
  P('ABYSS', 'Falls deep and dark, repeat after repeat', { t: '1/4.', fb: 0.9, sh: -140, ud: 0, lp: 1500, ar: true }),
  P('CROOKED PONG', 'Left climbs, right falls: a bent ping-pong', { t: '1/8', fb: 0.6, sh: 12, sp: 1, cross: true }),
  P('INFERNAL DUB', 'Dub echo that drifts out of tune', { t: '1/4.', fb: 0.85, sh: -6, lp: 2400, hp: 140, lr: 0.25, amt: 0.27 }),
  P('SIREN', 'The shift swings with a slow LFO', { t: '1/8T', fb: 0.65, sh: 60, sp: 0.5, lr: 0.4, amt: 0.79 }),
  P('GHOST CHOIR', 'Barely shifted, both ways: a ghostly chorus', { t: 90, fb: 0.78, sh: 3, ud: 0.5, lr: 0.1, amt: 0.14, smear: 0.4 }),
  P('BROKEN RADIO', 'Far shift, thin and wide', { t: 45, fb: 0.7, sh: 900, ud: 0.5, sp: 0.7, hp: 700 }),
  P('DEEP STAIRS', 'Half notes stepping down', { t: '1/2', fb: 0.8, sh: -55, ud: 0, ar: true }),
  P('INIT', 'Plain delay, no shift', { t: '1/8.', fb: 0.5, sh: 0 }),
  // les nouveaux (2026-11-17) : SMEAR, CROSS, ANTI REFL, PHASE, RANGE SYNC et MIDI, le LFO et ses cibles
  P('SULFUR RAIN', 'Smeared falling drops, each one a little lower', { t: '1/16.', fb: 0.82, sh: -24, ud: 0, smear: 0.7, lp: 4200, ar: true }),
  P('CHAPEL OF RUST', 'A diffused halo whose phase turns slowly', { t: 140, fb: 0.86, sh: 0, smear: 0.85, lr: 0.08, amt: 1, tgt: 'PHASE', st: true, hp: 160 }),
  P('MOLTEN TAPE', 'A melting tape echo: the delay time wobbles', { t: '1/8', fb: 0.7, sh: 2, shape: 'SINE', lr: 0.7, amt: 0.35, tgt: 'DELAY', lp: 3800, hp: 90 }),
  P('CROSSFIRE', 'Crossed feedback, opposite shifts: the echo bounces and bends', { t: '1/8.', fb: 0.78, sh: 25, sp: 1, cross: true, st: true }),
  P('PURGATORY LOOP', 'The shift locked to the tempo: a rhythmic barber pole', { t: '1/4', fb: 0.9, range: 'SYNC', sh: 1, smear: 0.3, lp: 7000 }),
  P('DEVIL TRILL', 'A square LFO flips the shift on the beat', { t: '1/16', fb: 0.6, sh: 0, shape: 'SQUARE', lr: '1/8', amt: 0.55, tgt: 'FREQ', st: true }),
  P('BLACK MASS', 'Low ring modulation, a dark bell under every note', { t: 260, fb: 0.55, range: 'WIDE', sh: 110, ud: 0.5, lp: 2200 }),
  P('EMBER DRIFT', 'Random LFO on the low-pass: embers that flicker', { t: '1/8T', fb: 0.75, sh: 9, shape: 'RANDOM', lr: '1/8', amt: 0.8, tgt: 'LOW-PASS', lp: 2600, smear: 0.35 }),
  P('NOTE GHOST', 'The shift follows the played note: a harmonic shadow', { t: '1/8.', fb: 0.66, range: 'MIDI', sh: 0.5, ud: 1, hp: 100 }),
  P('PHASE MONK', 'No shift, only the phase swinging: a slow hollow sweep', { t: 30, fb: 0.62, sh: 0, shape: 'SAW', lr: 0.15, amt: 1, tgt: 'PHASE', st: true }),
  P('TEMPO SPIRAL', 'Upward spiral in tempo, crossed and smeared', { t: '1/8', fb: 0.85, range: 'SYNC', sh: 4, cross: true, smear: 0.5, ar: true }),
  P('HELLFIRE SWELL', 'A rising saw opens and closes the loop', { t: '1/4.', fb: 0.8, sh: -40, ud: 0, shape: 'SAW', lr: '1 BAR', amt: -0.9, tgt: 'LOW-PASS', lp: 1800, ar: true }),
];

const KEYS = Object.keys(HELL_PRESETS[0].v);

/** Le preset dont les reglages sont ceux du moment (a un millieme pres), sinon null. */
/**
 * v28 (Mika : "quand on fait random ou pour les presets ce serait bien d'utiliser une toute petite partie de Hell sinon ca
 * denature tous les sons") : un reglage HELL doux pour RANDOM (hypno.ts) : peu de reinjection, un decalage de quelques Hz,
 * filtre et flou ; MIX a part (0.03 a 0.10, tire par RANDOM).
 */
export function hellGentle(rnd: () => number = Math.random): Readonly<Record<string, number>> {
  const sgn = rnd() < 0.5 ? -1 : 1;
  const kinds: Units[] = [
    { t: 90 + Math.round(rnd() * 60), fb: 0.3 + rnd() * 0.12, sh: sgn * (2 + rnd() * 3), ud: 0.5, smear: 0.35, lp: 6000, hp: 150 },
    { t: '1/4.', fb: 0.38 + rnd() * 0.1, sh: sgn * (3 + rnd() * 4), smear: 0.2, lp: 2600, hp: 140 },
    { t: '1/4', fb: 0.35 + rnd() * 0.1, sh: 4 + rnd() * 6, sp: 0.3, smear: 0.15, lp: 5000 },
    { t: '1/8.', fb: 0.32 + rnd() * 0.1, sh: sgn * (1.5 + rnd() * 2), ud: 0.5, smear: 0.5, lp: 4500, hp: 180 },
  ];
  return P('GENTLE', 'RANDOM', kinds[Math.min(kinds.length - 1, Math.floor(rnd() * kinds.length))]).v;
}

export function hellCurrent(): HellPreset | null {
  const v = arpExtra.get();
  return HELL_PRESETS.find((p) => KEYS.every((k) => Math.abs((v[k] ?? 0) - Math.round((p.v[k] ?? 0) * 1000) / 1000) < 0.0015)) ?? null;
}

let lastIdx = -1;
export function hellLoad(p: HellPreset): void {
  for (const [k, x] of Object.entries(p.v)) arpExtra.set(k, x);
  if (arpExtra.of('xHellMix') <= 0) arpExtra.set('xHellMix', 0.35);
  lastIdx = HELL_PRESETS.indexOf(p);
}

/** Le precedent (-1) ou le suivant (+1), en boucle ; sans preset reconnu : depuis le dernier charge. */
export function hellStep(d: 1 | -1): void {
  const cur = hellCurrent();
  const i = cur ? HELL_PRESETS.indexOf(cur) : lastIdx;
  const n = HELL_PRESETS.length;
  hellLoad(HELL_PRESETS[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n]);
}

export function hellInit(): void {
  const p = HELL_PRESETS.find((x) => x.name === 'INIT');
  if (p) hellLoad(p);
}

/* ---------------- DELAY et SYNC, vus par la page (pcbui.tsx SRC.virtual) ---------------- */

/** La derniere note choisie (le levier SYNC la reprend) ; 1/8 au depart. */
let lastNote = HELL_SYNC.indexOf('1/8');
const syncIdx = (): number => idx('xHellSync', arpExtra.of('xHellSync'));
const NOTES = HELL_SYNC.length - 1; // sans FREE

export const HELL_DELAY = {
  of: (): number => (syncIdx() > 0 ? (syncIdx() - 1) / (NOTES - 1) : arpExtra.of('xHellTime')),
  def: (): number => (syncIdx() > 0 ? (lastNote - 1) / (NOTES - 1) : arpExtra.def('xHellTime')),
  set(v: number): void {
    if (syncIdx() > 0) {
      const i = 1 + Math.round(clamp01(v) * (NOTES - 1));
      lastNote = i;
      arpExtra.set('xHellSync', i / NOTES);
    } else arpExtra.set('xHellTime', clamp01(v));
  },
  text(v: number): string {
    if (syncIdx() > 0) return HELL_SYNC[1 + Math.round(clamp01(v) * (NOTES - 1))];
    const t = hellTimeMs(v);
    return t >= 1000 ? `${(t / 1000).toFixed(2)} S` : `${Math.round(t)} MS`;
  },
};

export const HELL_SYNC_LEVER = {
  steps: ['FREE', 'SYNC'] as const,
  of: (): number => (syncIdx() > 0 ? 1 : 0),
  set(v: number): void {
    if (v >= 0.5) {
      if (syncIdx() === 0) arpExtra.set('xHellSync', lastNote / NOTES);
    } else {
      if (syncIdx() > 0) lastNote = syncIdx();
      arpExtra.set('xHellSync', 0);
    }
  },
};
