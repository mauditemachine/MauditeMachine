/**
 * MAQUETTE v44 : HELL v2, "la botte secrete" (Mika, 2026-11-20 : "Ca doit etre intense comme effet et chaque preset doit
 * etre different des autres ! Ca doit pas etre trop complique [...] comme si la personne, quand elle tourne MIX, faisait
 * un malaise de LSD croise a trop d'alcool ! Le tout en sync tres souvent si possible !").
 *
 * L'idee : HELL devient une DESCENTE en six cercles, chacun un verbe qu'on entend tout de suite :
 *   I ECHO (la spirale de Bode d'aujourd'hui, Hell.cpp), II WARP (la hauteur qui plie : wobble, bend, chute, arret de
 *   bande), III SPIN (le panoramique qui tournoie, le chorus ivre, le filtre qui balaie), IV SHATTER (le son en eclats :
 *   granulaire), V CHOP (le stutter, les repetitions qui montent ou descendent), VI METAL (anneau et peignes qui changent
 *   a chaque noire).
 * MIX est la descente : en tournant le gros potard, les cercles entrent l'un apres l'autre (DESCENT) ou tous ensemble
 * (ALL), le sec s'efface ; a 0, HELL est contourne au bit pres (comme aujourd'hui). Presque tout est en notes, cale au
 * tempo de l'hote.
 *
 * Ce fichier ne depend d'aucune piece de la face (le prototype hors ligne le lit tel quel, scratchpad v44/hell-proto) :
 * - HELL2_PARAMS : les reglages NEUFS proposes (a ajouter EN FIN de liste de extra-params.json), leurs lois ;
 * - CIRCLES : les six cercles, leurs reglages, leur point d'entree sur la course de MIX ;
 * - circleDepth : la loi de la descente ;
 * - HELL2_PRESETS : la banque proposee (16), les valeurs des reglages d'aujourd'hui (xHell*) et des neufs.
 */

import { HELL_RANGES, HELL_SYNC, LFO_BEAT_NAMES, SYNC_MULT, hellShiftV } from './hell';

/* ---------------- les reglages neufs (proposes ; maquette sans son) ---------------- */

export const RATES = ['1/16', '1/8', '1/4', '1/2', '1 BAR', '2 BAR', '4 BAR'] as const;
/** temps par cycle */
export const RATE_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
export const WARP_SHAPES = ['WOBBLE', 'BEND', 'DROP', 'STOP', 'RANDOM'] as const;
export const CHOP_GRIDS = ['1/64', '1/32', '1/16T', '1/16', '1/8T', '1/8', '1/4'] as const;
export const CHOP_BEATS = [1 / 16, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1] as const;
export const GRAIN_SIZES = ['1/64', '1/32', '1/16', '1/8', '1/4'] as const;
export const GRAIN_BEATS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1] as const;
export const RING_TUNES = ['NOTE', 'NOTE x1.5', 'NOTE x2', 'NOTE /2', 'TEMPO x8', 'TEMPO x32'] as const;
export const COMB_SEQS = ['OCTAVES', 'FIFTHS', 'MINOR', 'CHROMATIC', 'RANDOM'] as const;
export const DESCENTS = ['DESCENT', 'ALL'] as const;

export interface Hell2Param {
  id: string;
  label: string;
  def: number;
  steps?: readonly string[];
  /** la loi (le texte de la valeur) */
  text: (v: number) => string;
  help: string;
}

const pct = (v: number): string => (v <= 0 ? 'OFF' : `${Math.round(v * 100)} %`);
const st = (x: number): string => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x) < 10 ? Math.abs(x).toFixed(1) : Math.round(Math.abs(x))} ST`;
const stepName = (steps: readonly string[]) => (v: number): string => steps[Math.max(0, Math.min(steps.length - 1, Math.round(v * (steps.length - 1))))];

export const warpSt = (v: number): number => 12 * v * v;
export const chopSt = (v: number): number => Math.round(24 * (v - 0.5));

export const HELL2_PARAMS: readonly Hell2Param[] = [
  { id: 'xHellWarp', label: 'HELL WARP', def: 0, text: (v) => (v <= 0 ? 'OFF' : st(warpSt(v))), help: 'II WARP : la profondeur, 0 a 12 demi-tons (12 v^2)' },
  { id: 'xHellWarpRate', label: 'HELL WARP RATE', def: 2 / 6, steps: RATES, text: stepName(RATES), help: 'II WARP : un cycle en notes (1/16 a 4 mesures), cale a la mesure' },
  { id: 'xHellWarpShape', label: 'HELL WARP SHAPE', def: 0, steps: WARP_SHAPES, text: stepName(WARP_SHAPES), help: 'WOBBLE sinus, BEND triangle, DROP la hauteur tombe puis revient, STOP arret de bande en fin de cycle, RANDOM' },
  { id: 'xHellSpin', label: 'HELL SPIN', def: 0, text: pct, help: 'III SPIN : le panoramique qui tournoie (puissance constante, un rien de Haas)' },
  { id: 'xHellSpinRate', label: 'HELL SPIN RATE', def: 4 / 6, steps: RATES, text: stepName(RATES), help: 'III SPIN : un tour en notes ; le balayage du filtre suit' },
  { id: 'xHellDrunk', label: 'HELL DRUNK', def: 0, text: pct, help: 'III SPIN : le chorus ivre, trois voix dont le retard titube (marche aleatoire lissee)' },
  { id: 'xHellSweep', label: 'HELL SWEEP', def: 0, text: pct, help: 'III SPIN : le filtre resonant qui balaie au rythme de SPIN RATE' },
  { id: 'xHellShatter', label: 'HELL SHATTER', def: 0, text: pct, help: 'IV SHATTER : le son en eclats (granulaire), la part des grains' },
  { id: 'xHellShatterSize', label: 'HELL SHATTER SIZE', def: 2 / 4, steps: GRAIN_SIZES, text: stepName(GRAIN_SIZES), help: 'IV SHATTER : la taille des grains en notes' },
  { id: 'xHellShatterSpray', label: 'HELL SHATTER SPRAY', def: 0.3, text: pct, help: 'IV SHATTER : la dispersion : hauteurs (octaves, quintes) et grains a l envers' },
  { id: 'xHellChop', label: 'HELL CHOP', def: 0, text: pct, help: 'V CHOP : la chance qu une case de la grille soit repetee (stutter)' },
  { id: 'xHellChopGrid', label: 'HELL CHOP GRID', def: 3 / 6, steps: CHOP_GRIDS, text: stepName(CHOP_GRIDS), help: 'V CHOP : la taille d une case, 1/64 a 1/4' },
  { id: 'xHellChopPitch', label: 'HELL CHOP PITCH', def: 0.5, text: (v) => (chopSt(v) === 0 ? '0' : st(chopSt(v))), help: 'V CHOP : chaque repetition monte ou descend de -12 a +12 demi-tons' },
  { id: 'xHellChopGate', label: 'HELL CHOP GATE', def: 1, text: (v) => `${Math.round(v * 100)} %`, help: 'V CHOP : la longueur de chaque repetition (1 : pleine)' },
  { id: 'xHellRing', label: 'HELL RING', def: 0, text: pct, help: 'VI METAL : la modulation en anneau' },
  { id: 'xHellRingTune', label: 'HELL RING TUNE', def: 0, steps: RING_TUNES, text: stepName(RING_TUNES), help: 'VI METAL : la frequence de l anneau : la note jouee (x1, x1.5, x2, /2) ou le tempo (x8, x32)' },
  { id: 'xHellComb', label: 'HELL COMB', def: 0, text: pct, help: 'VI METAL : les peignes resonants, accordes sur la note, qui changent a chaque noire' },
  { id: 'xHellCombSeq', label: 'HELL COMB SEQ', def: 0, steps: COMB_SEQS, text: stepName(COMB_SEQS), help: 'VI METAL : la suite des hauteurs du peigne, une par noire' },
  { id: 'xHellDescent', label: 'HELL DESCENT', def: 0, steps: DESCENTS, text: stepName(DESCENTS), help: 'MIX : DESCENT les cercles entrent un par un, ALL tous ensemble' },
];

/* ---------------- les six cercles ---------------- */

export interface Circle {
  n: string;
  id: 'echo' | 'warp' | 'spin' | 'shatter' | 'chop' | 'metal';
  name: string;
  /** ce qu'il fait, en une ligne */
  verb: string;
  /** ou il entre sur la course de MIX (DESCENT) */
  entry: number;
  /** le reglage qui dit combien (sa LED) */
  amount: string;
}

export const CIRCLES: readonly Circle[] = [
  { n: 'I', id: 'echo', name: 'ECHO', verb: 'EVERY REPEAT CLIMBS OR FALLS', entry: 0, amount: 'xHellFb' },
  { n: 'II', id: 'warp', name: 'WARP', verb: 'THE PITCH BENDS IN TIME', entry: 0.1, amount: 'xHellWarp' },
  { n: 'III', id: 'spin', name: 'SPIN', verb: 'THE ROOM TURNS, THE CHORUS STAGGERS', entry: 0.22, amount: 'xHellSpin' },
  { n: 'IV', id: 'shatter', name: 'SHATTER', verb: 'THE SOUND BREAKS INTO GRAINS', entry: 0.36, amount: 'xHellShatter' },
  { n: 'V', id: 'chop', name: 'CHOP', verb: 'THE GRID STUTTERS AND REPEATS', entry: 0.5, amount: 'xHellChop' },
  { n: 'VI', id: 'metal', name: 'METAL', verb: 'RINGS AND COMBS ON EVERY BEAT', entry: 0.64, amount: 'xHellRing' },
];

/**
 * La descente : la part (0..1) d'un cercle a la position m de MIX. DESCENT : rien avant son entree, puis une courbe en S
 * jusqu'a 1 a la fin de la course ; ALL : m pour tous. Le sec : 1 - m (le son direct garde son niveau tant que les cercles
 * sont doux) ; a m = 0 : contourne au bit pres.
 */
export function circleDepth(m: number, entry: number, mode: number): number {
  if (m <= 0) return 0;
  if (mode === 1) return Math.min(1, m);
  const x = Math.max(0, Math.min(1, (m - entry) / Math.max(1e-6, 1 - entry)));
  return x * x * (3 - 2 * x);
}

/* ---------------- la banque proposee ---------------- */

export interface Hell2Preset {
  name: string;
  desc: string;
  /** les cercles qui menent */
  lead: readonly Circle['id'][];
  v: Readonly<Record<string, number>>;
}

const idx = (list: readonly string[], name: string): number => {
  const i = list.indexOf(name);
  if (i < 0) throw new Error(`HELL v2 : ${name} inconnu`);
  return i / (list.length - 1);
};
const msV = (t: number): number => Math.log(t / 5) / Math.log(400);
const lfoV = (hz: number): number => Math.log(hz / 0.02) / Math.log(500);
const hpV = (hz: number): number => (hz <= 0 ? 0 : Math.log(hz / 20) / Math.log(200));
const lpV = (hz: number): number => (hz <= 0 ? 1 : Math.log(hz / 300) / Math.log(20000 / 300));
const DEAD = 0.03;
const syncShiftV = (m: number): number => {
  const i = SYNC_MULT.findIndex((x) => Math.abs(x - Math.abs(m)) < 1e-9);
  const ax = DEAD + ((1 - DEAD) * (i + 0.5)) / 9;
  return 0.5 + (m < 0 ? -ax : ax) / 2;
};
const midiShiftV = (r: number): number => {
  const ax = DEAD + (1 - DEAD) * ((Math.log2(Math.abs(r)) + 4) / 5);
  return 0.5 + (r < 0 ? -ax : ax) / 2;
};

interface Spec {
  echo: {
    t: string | number;
    fb: number;
    range?: 'FINE' | 'WIDE' | 'SYNC' | 'MIDI';
    sh?: number;
    ud?: number;
    sp?: number;
    cross?: boolean;
    ar?: boolean;
    smear?: number;
    hp?: number;
    lp?: number;
    shape?: 'SINE' | 'SAW' | 'SQUARE' | 'RANDOM';
    lr?: number | string;
    amt?: number;
    st?: boolean;
    tgt?: 'FREQ' | 'PHASE' | 'LOW-PASS' | 'DELAY';
  };
  warp?: { st: number; rate: (typeof RATES)[number]; shape: (typeof WARP_SHAPES)[number] };
  spin?: { a: number; rate: (typeof RATES)[number]; drunk?: number; sweep?: number };
  shatter?: { a: number; size: (typeof GRAIN_SIZES)[number]; spray: number };
  chop?: { p: number; grid: (typeof CHOP_GRIDS)[number]; st?: number; gate?: number };
  metal?: { ring?: number; tune?: (typeof RING_TUNES)[number]; comb?: number; seq?: (typeof COMB_SEQS)[number] };
  all?: boolean;
}

const P = (name: string, desc: string, lead: Circle['id'][], o: Spec): Hell2Preset => {
  const e = o.echo;
  const range = e.range ?? (Math.abs(e.sh ?? 0) > 200 ? 'WIDE' : 'FINE');
  const ri = HELL_RANGES.indexOf(range);
  const sh = e.sh ?? 0;
  const lsync = typeof e.lr === 'string';
  const v: Record<string, number> = {
    // I ECHO : les reglages d'aujourd'hui (hell.ts)
    xHellSync: typeof e.t === 'string' ? idx(HELL_SYNC, e.t) : 0,
    xHellTime: typeof e.t === 'number' ? msV(e.t) : 0.5,
    xHellFb: e.fb,
    xHellCross: e.cross ? 1 : 0,
    xHellRange: ri / 3,
    xHellShift: ri === 2 ? syncShiftV(sh) : ri === 3 ? midiShiftV(sh) : hellShiftV(sh, ri),
    xHellUpDown: e.ud ?? 1,
    xHellSpread: e.sp ?? 0,
    xHellPhase: 0,
    xHellAntiRefl: e.ar ? 1 : 0,
    xHellSmear: e.smear ?? 0,
    xHellHp: hpV(e.hp ?? 0),
    xHellLp: lpV(e.lp ?? 0),
    xHellLfoShape: idx(['SINE', 'SAW', 'SQUARE', 'RANDOM'], e.shape ?? 'SINE'),
    xHellLfoSync: lsync ? 1 : 0,
    xHellLfoRate: lsync ? idx(LFO_BEAT_NAMES, e.lr as string) : lfoV((e.lr as number | undefined) ?? 0.4),
    xHellLfoAmt: 0.5 + 0.5 * (e.amt ?? 0),
    xHellLfoStereo: e.st ? 1 : 0,
    xHellLfoTarget: idx(['FREQ', 'PHASE', 'LOW-PASS', 'DELAY'], e.tgt ?? 'FREQ'),
    xHellLfoDepth: 0,
    xHellTone: 0.5,
    // II a VI : les neufs
    xHellWarp: o.warp ? Math.sqrt(o.warp.st / 12) : 0,
    xHellWarpRate: idx(RATES, o.warp?.rate ?? '1/4'),
    xHellWarpShape: idx(WARP_SHAPES, o.warp?.shape ?? 'WOBBLE'),
    xHellSpin: o.spin?.a ?? 0,
    xHellSpinRate: idx(RATES, o.spin?.rate ?? '1 BAR'),
    xHellDrunk: o.spin?.drunk ?? 0,
    xHellSweep: o.spin?.sweep ?? 0,
    xHellShatter: o.shatter?.a ?? 0,
    xHellShatterSize: idx(GRAIN_SIZES, o.shatter?.size ?? '1/16'),
    xHellShatterSpray: o.shatter?.spray ?? 0.3,
    xHellChop: o.chop?.p ?? 0,
    xHellChopGrid: idx(CHOP_GRIDS, o.chop?.grid ?? '1/16'),
    xHellChopPitch: 0.5 + (o.chop?.st ?? 0) / 24,
    xHellChopGate: o.chop?.gate ?? 1,
    xHellRing: o.metal?.ring ?? 0,
    xHellRingTune: idx(RING_TUNES, o.metal?.tune ?? 'NOTE'),
    xHellComb: o.metal?.comb ?? 0,
    xHellCombSeq: idx(COMB_SEQS, o.metal?.seq ?? 'OCTAVES'),
    xHellDescent: o.all ? 1 : 0,
  };
  for (const [k, x] of Object.entries(v)) if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error(`HELL v2 ${name} : ${k} hors de 0..1 (${x})`);
  return { name, desc, lead, v };
};

/**
 * Seize presets, un caractere chacun, presque tous en notes. Le cercle qui mene est nomme ; les autres restent doux ou
 * coupes, pour que chaque preset soit reconnaissable des la premiere mesure.
 */
export const HELL2_PRESETS: readonly Hell2Preset[] = [
  P('THE DESCENT', 'Turn MIX and fall: the spiral, the bend, the spin, the grains, the stutter', ['echo', 'warp', 'spin', 'shatter', 'chop'], {
    echo: { t: '1/8.', fb: 0.62, sh: 9, lp: 7000, hp: 90 },
    warp: { st: 0.6, rate: '1 BAR', shape: 'WOBBLE' },
    spin: { a: 0.5, rate: '2 BAR', drunk: 0.3 },
    shatter: { a: 0.35, size: '1/16', spray: 0.35 },
    chop: { p: 0.3, grid: '1/16', st: -2, gate: 0.85 },
  }),
  P('TAPE DEATH', 'The tape stops at the end of every bar, dub echoes fall', ['warp', 'echo'], {
    echo: { t: '1/4.', fb: 0.72, sh: -7, ud: 1, lp: 2600, hp: 120, ar: true },
    warp: { st: 12, rate: '1 BAR', shape: 'STOP' },
  }),
  P('BARBER SPIRAL', 'An endless rising staircase locked to the tempo', ['echo', 'spin'], {
    echo: { t: '1/8', fb: 0.9, range: 'SYNC', sh: 1, smear: 0.25, lp: 9000, ar: true },
    spin: { a: 0.6, rate: '4 BAR' },
  }),
  P('STUTTER GOD', 'Sixteenths that repeat and fall a semitone each time', ['chop'], {
    echo: { t: '1/16', fb: 0.3, sh: 0 },
    chop: { p: 0.75, grid: '1/16', st: -1, gate: 0.7 },
    metal: { comb: 0.25, seq: 'OCTAVES' },
  }),
  P('GLASS RAIN', 'Tiny grains thrown an octave up, falling left and right', ['shatter'], {
    echo: { t: '1/8', fb: 0.55, sh: 12, cross: true, sp: 1, hp: 300 },
    shatter: { a: 0.85, size: '1/64', spray: 0.8 },
  }),
  P('SEASICK', 'The pitch rolls like a boat, the chorus staggers', ['warp', 'spin'], {
    echo: { t: '1/4', fb: 0.45, sh: 0, lp: 6000 },
    warp: { st: 0.75, rate: '2 BAR', shape: 'WOBBLE' },
    spin: { a: 0.45, rate: '4 BAR', drunk: 0.9 },
  }),
  P('ACID BATH', 'A ring a fifth above the note, a filter that bites on the eighths', ['metal', 'spin'], {
    echo: { t: '1/16.', fb: 0.5, sh: 0, hp: 150 },
    spin: { a: 0.25, rate: '1/8', sweep: 0.9 },
    metal: { ring: 0.7, tune: 'NOTE x1.5' },
  }),
  P('BLACK HOLE', 'Everything sinks: pitch drops, echoes fall, grains play backwards', ['warp', 'echo', 'shatter'], {
    echo: { t: '1/4', fb: 0.85, sh: -40, ud: 1, lp: 1800, ar: true },
    warp: { st: 5, rate: '2 BAR', shape: 'DROP' },
    shatter: { a: 0.4, size: '1/8', spray: 0.9 },
  }),
  P('CATHEDRAL OF RUST', 'Combs singing fifths, one chord per beat, in a smeared loop', ['metal', 'echo'], {
    echo: { t: '1/4', fb: 0.78, sh: 0, smear: 0.8, hp: 160 },
    metal: { comb: 0.85, seq: 'FIFTHS' },
  }),
  P('HELICOPTER', 'A rotor: the pan spins on sixteenths, thirty-second chops', ['spin', 'chop', 'metal'], {
    echo: { t: '1/32', fb: 0.25, sh: 0 },
    spin: { a: 1, rate: '1/16' },
    chop: { p: 0.5, grid: '1/32', gate: 0.45 },
    metal: { ring: 0.35, tune: 'TEMPO x32' },
  }),
  P('MELTDOWN', 'Random bends on every beat, the loop melts into grains', ['warp', 'shatter'], {
    echo: { t: '1/4.', fb: 0.75, sh: -5, lp: 3000, hp: 120 },
    warp: { st: 7, rate: '1/2', shape: 'RANDOM' },
    shatter: { a: 0.35, size: '1/16', spray: 0.3 },
  }),
  P('VERTIGO', 'Dotted ping-pong, a room that turns, a bend up and down', ['spin', 'echo', 'warp'], {
    echo: { t: '1/8.', fb: 0.68, sh: 4, cross: true, sp: 1, st: true },
    warp: { st: 1, rate: '1/2', shape: 'BEND' },
    spin: { a: 0.8, rate: '1 BAR', drunk: 0.35 },
  }),
  P('DEMON CHOIR', 'The shift follows your note an octave down, combs in minor', ['echo', 'metal', 'spin'], {
    echo: { t: '1/4', fb: 0.7, range: 'MIDI', sh: 0.5, ud: 0, smear: 0.5, ar: true },
    spin: { a: 0.3, rate: '2 BAR', drunk: 0.6 },
    metal: { comb: 0.55, seq: 'MINOR' },
  }),
  P('GLITCH PRIEST', 'Tiny chops thrown up a fifth, a ring an octave above the note', ['chop', 'metal'], {
    echo: { t: '1/16T', fb: 0.35, sh: 0 },
    chop: { p: 0.7, grid: '1/64', st: 7, gate: 0.55 },
    metal: { ring: 0.6, tune: 'NOTE x2' },
  }),
  P('LAST CALL', 'Too much to drink: a slow deep wobble, the room spins, the echo slurs', ['warp', 'spin', 'echo'], {
    echo: { t: '1/4', fb: 0.6, sh: -2, lp: 3500, hp: 100, tgt: 'DELAY', lr: '2 BAR', amt: 0.3 },
    warp: { st: 1.2, rate: '4 BAR', shape: 'WOBBLE' },
    spin: { a: 0.7, rate: '2 BAR', drunk: 0.7, sweep: 0.2 },
  }),
  P('LSD', 'All six circles at once, in eighth triplets: hold on', ['echo', 'warp', 'spin', 'shatter', 'chop', 'metal'], {
    echo: { t: '1/8T', fb: 0.82, range: 'SYNC', sh: -0.5, smear: 0.4, cross: true, sp: 1 },
    warp: { st: 2, rate: '1/2', shape: 'BEND' },
    spin: { a: 0.9, rate: '1/2', drunk: 0.5, sweep: 0.6 },
    shatter: { a: 0.5, size: '1/32', spray: 0.7 },
    chop: { p: 0.45, grid: '1/8T', st: 5, gate: 0.8 },
    metal: { ring: 0.3, tune: 'NOTE /2', comb: 0.3, seq: 'CHROMATIC' },
    all: true,
  }),
];
