/**
 * La page REVERB du MM-ARP (2026-11-16, Mika : "quand on clic sur le knob Reverb on tombe sur une page de
 * configuration pour la reverb avec tous les parametres AINSI QUE la qualite de Strymon BigSky mais au design de
 * MM-ARP"). Les douze machines du BigSky, dans l'ordre de son selecteur TYPE, chacune avec ses reglages tels que les
 * nomme le manuel (Strymon BigSky User Manual, "Reverb Machines") :
 * - les potards de la face : DECAY, PRE-DELAY, TONE, MOD (MIX est le potard REVERB du MM-ARP lui-meme : l'envoi) ;
 *   MAGNETO et NONLINEAR prennent PRE-DELAY pour FEEDBACK, NONLINEAR appelle DECAY "TIME", REFLECTIONS "SIZE",
 *   comme sur la pedale ;
 * - les reglages de la machine (ceux du menu VALUE du BigSky) : LOW END partout, puis SIZE, DIFFUSION, MID, DWELL,
 *   SPRINGS, RISE TIME, MODE, LENGTH, FEEDBACK, VOWEL, RESONANCE, SHIFT 1 et 2, AMOUNT, HEADS, SPACING, TIME, SHAPE,
 *   LATE DECAY, LATE LEVEL, MOD SPEED, LOCATION X et Y.
 * Chaque machine garde ses propres valeurs (passer de HALL a PLATE et revenir retrouve le HALL tel qu'on l'a laisse).
 * Toutes les valeurs sont de 0 a 1 ; un reglage a crans garde idx / (n - 1). Store observable, persiste sous
 * mm.v4.voyager.sky.1 (try/catch partout : navigation privee, stockage plein, JSON corrompu, rien ne leve).
 *
 * skyEngine() traduit l'etat en grandeurs physiques pour le moteur (audio/sky.worklet.js) ; skyText() les ecrit pour la
 * page (secondes, millisecondes, Hz, le nom d'un cran). Le DECAY affiche est le vrai Tr60 (le temps de descendre de
 * 60 dB), comme celui du BigSky.
 */

export type SkyMachineId = 'room' | 'hall' | 'plate' | 'spring' | 'swell' | 'bloom' | 'cloud' | 'chorale' | 'shimmer' | 'magneto' | 'nonlinear' | 'reflections';

export type SkyParamId =
  | 'decay'
  | 'pre'
  | 'tone'
  | 'mod'
  | 'lowEnd'
  | 'size'
  | 'diffusion'
  | 'mid'
  | 'dwell'
  | 'springs'
  | 'rise'
  | 'swellMode'
  | 'length'
  | 'feedback'
  | 'vowel'
  | 'resonance'
  | 'shift1'
  | 'shift2'
  | 'amount'
  | 'shimMode'
  | 'heads'
  | 'spacing'
  | 'time'
  | 'shape'
  | 'lateDecay'
  | 'lateLevel'
  | 'modSpeed'
  | 'locX'
  | 'locY';

export interface SkyParamDef {
  id: SkyParamId;
  label: string;
  /** les crans (un reglage a crans) */
  options?: readonly string[];
  /** ce qu'il fait, en une phrase (la ligne d'aide de la page) */
  help: string;
}

export interface SkyMachineDef {
  id: SkyMachineId;
  name: string;
  /** ce qu'est la machine, en une phrase */
  blurb: string;
  /** DECAY : son nom sur la face et sa course */
  decayLabel: string;
  /** PRE-DELAY : son nom (FEEDBACK sur MAGNETO et NONLINEAR) */
  preLabel: string;
  /** les reglages de la machine (LOW END en premier) */
  params: readonly SkyParamDef[];
  /** les valeurs de depart (0 a 1), potards de la face compris */
  def: Readonly<Partial<Record<SkyParamId, number>>>;
}

/** Les crans qui reviennent. */
const SHIFTS = ['-1 OCT', '-5TH', '-4TH', 'DETUNE', '+3RD', '+4TH', '+5TH', '+6TH', '+1 OCT', '+OCT +5TH', '+2 OCT'] as const;
/** Les demi-tons des crans de SHIFT. */
const SHIFT_SEMIS = [-12, -7, -5, 0.12, 4, 5, 7, 9, 12, 19, 24] as const;
/** RISE TIME de SWELL (s), ceux du BigSky. */
export const RISE_TIMES = [0.08, 0.1, 0.12, 0.14, 0.17, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4] as const;

const LOW_END: SkyParamDef = { id: 'lowEnd', label: 'LOW END', help: 'Les graves qui réverbèrent : plus haut, ils restent et durent plus longtemps.' };
const DIFFUSION: SkyParamDef = { id: 'diffusion', label: 'DIFFUSION', help: "Adoucit l'attaque : à 0 les premières réflexions se détachent, au max elles fondent en un voile." };
const idx = (i: number, n: number): number => (n <= 1 ? 0 : i / (n - 1));

export const SKY_MACHINES: readonly SkyMachineDef[] = [
  {
    id: 'room',
    name: 'ROOM',
    blurb: "Une vraie pièce : le studio intime ou le club vivant, ses premières réflexions puis la queue.",
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [LOW_END, { id: 'size', label: 'SIZE', options: ['STUDIO', 'CLUB'], help: 'STUDIO : une cabine bien réglée. CLUB : une salle de nuit plus grande et plus vivante.' }, DIFFUSION],
    def: { decay: 0.4, pre: 0.06, tone: 0.55, mod: 0.3, lowEnd: 0.5, size: 0, diffusion: 0.6 },
  },
  {
    id: 'hall',
    name: 'HALL',
    blurb: 'La salle de concert chaude et équilibrée, ou la plus grande arène couverte.',
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [LOW_END, { id: 'mid', label: 'MID', help: 'Les médiums de la queue : à midi la réponse est plate.' }, { id: 'size', label: 'SIZE', options: ['CONCERT', 'ARENA'], help: "CONCERT : l'auditorium chaud. ARENA : la plus grande salle, plus enveloppante." }],
    def: { decay: 0.43, pre: 0.14, tone: 0.5, mod: 0.35, lowEnd: 0.5, mid: 0.5, size: 0 },
  },
  {
    id: 'plate',
    name: 'PLATE',
    blurb: "La plaque d'acier des studios : dense dès la première milliseconde, brillante, sans pièce autour.",
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [LOW_END, { id: 'size', label: 'SIZE', options: ['SMALL', 'LARGE'], help: 'SMALL : la plaque « home studio » de 45 × 70 cm. LARGE : la plaque de studio de 1,2 × 1,8 m.' }],
    def: { decay: 0.45, pre: 0.08, tone: 0.65, mod: 0.3, lowEnd: 0.45, size: 1 },
  },
  {
    id: 'spring',
    name: 'SPRING',
    blurb: 'Le bac à ressorts des amplis : le « drip » qui descend, le préampli qui sature.',
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'dwell', label: 'DWELL', options: ['CLEAN', 'COMBO', 'TUBE', 'OVERDRIVE'], help: "Le gain du préampli du bac : CLEAN le plus propre, OVERDRIVE la saturation à fond." },
      { id: 'springs', label: 'SPRINGS', options: ['1', '2', '3'], help: 'Un, deux ou trois ressorts : chacun son retard, le son se complexifie.' },
    ],
    def: { decay: 0.45, pre: 0, tone: 0.5, mod: 0.15, lowEnd: 0.4, dwell: idx(1, 4), springs: idx(1, 3) },
  },
  {
    id: 'swell',
    name: 'SWELL',
    blurb: "Le volume qui monte tout seul : la réverbe (ou le son) arrive en douceur derrière chaque attaque.",
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'rise', label: 'RISE TIME', options: RISE_TIMES.map((t) => `${t < 1 ? Math.round(t * 1000) + ' MS' : t + ' S'}`), help: 'Le temps de montée : court pour une ligne jouée, long pour des nappes.' },
      { id: 'swellMode', label: 'MODE', options: ['SWLWET', 'SWLDRY'], help: 'SWLWET : la réverbe monte derrière le son. SWLDRY : le son lui-même monte devant la réverbe.' },
    ],
    def: { decay: 0.55, pre: 0.1, tone: 0.5, mod: 0.4, lowEnd: 0.5, rise: idx(10, RISE_TIMES.length), swellMode: 0 },
  },
  {
    id: 'bloom',
    name: 'BLOOM',
    blurb: "La réverbe qui fleurit : elle gonfle lentement après la note avant de s'éteindre.",
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'length', label: 'LENGTH', help: 'La durée de la floraison : plus haut, elle met plus longtemps à gonfler.' },
      { id: 'feedback', label: 'FEEDBACK', help: 'La réinjection autour de la floraison : plus haut, elle tient et s\'épaissit.' },
    ],
    def: { decay: 0.5, pre: 0.1, tone: 0.5, mod: 0.4, lowEnd: 0.5, length: 0.5, feedback: 0.5 },
  },
  {
    id: 'cloud',
    name: 'CLOUD',
    blurb: "Un nuage immense et ambiant, jusqu'à 50 secondes de queue.",
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [LOW_END, { id: 'diffusion', label: 'DIFFUSION', help: 'Des diffuseurs devant et dans la réverbe : à 0 le nuage est granuleux, au max il est lisse et doux.' }],
    def: { decay: 0.5, pre: 0.15, tone: 0.45, mod: 0.45, lowEnd: 0.5, diffusion: 0.7 },
  },
  {
    id: 'chorale',
    name: 'CHORALE',
    blurb: 'Un chœur qui accompagne : la queue chante des voyelles.',
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'vowel', label: 'VOWEL', options: ['AAHHOO', 'AAHH', 'AAHHOH', 'OH', 'OOOHOH', 'OOOO', 'RANDOM'], help: 'Les voyelles du chœur, AH, OH, OO et leurs mélanges ; RANDOM chante au hasard.' },
      { id: 'resonance', label: 'RESONANCE', options: ['MILD', 'MEDIUM', 'HIGH'], help: 'La force de la voyelle (la résonance des filtres vocaux).' },
    ],
    def: { decay: 0.5, pre: 0.1, tone: 0.5, mod: 0.4, lowEnd: 0.5, vowel: 0, resonance: idx(1, 3) },
  },
  {
    id: 'shimmer',
    name: 'SHIMMER',
    blurb: 'Deux voix transposées dans la réverbe : les octaves qui montent au ciel.',
    decayLabel: 'DECAY',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'shift1', label: 'SHIFT 1', options: SHIFTS, help: "L'intervalle de la première voix, d'une octave dessous à deux octaves dessus." },
      { id: 'shift2', label: 'SHIFT 2', options: ['OFF', ...SHIFTS], help: "L'intervalle de la deuxième voix ; OFF sans deuxième voix." },
      { id: 'amount', label: 'AMOUNT', help: 'Le niveau des voix transposées dans la réverbe.' },
      { id: 'shimMode', label: 'MODE', options: ['INPUT', 'REGEN', 'IN+REG'], help: 'INPUT : le son transposé une fois. REGEN : la queue se retranspose, octave après octave. IN+REG : les deux.' },
    ],
    def: { decay: 0.55, pre: 0.1, tone: 0.55, mod: 0.4, lowEnd: 0.4, shift1: idx(8, SHIFTS.length), shift2: 0, amount: 0.5, shimMode: idx(1, 3) },
  },
  {
    id: 'magneto',
    name: 'MAGNETO',
    blurb: "L'écho à bande multi-têtes qui devient réverbe : les têtes s'étalent et se diffusent.",
    decayLabel: 'DECAY',
    preLabel: 'FEEDBACK',
    params: [
      LOW_END,
      DIFFUSION,
      { id: 'heads', label: 'HEADS', options: ['3', '4', '6'], help: 'Le nombre de têtes de lecture.' },
      { id: 'spacing', label: 'SPACING', options: ['EVEN', 'UNEVEN'], help: 'EVEN : les têtes à égale distance, des répétitions en rythme. UNEVEN : éparpillées, moins rythmiques.' },
      { id: 'time', label: 'TIME', help: 'Le retard de la dernière tête.' },
    ],
    def: { decay: 0.4, pre: 0.35, tone: 0.45, mod: 0.35, lowEnd: 0.45, diffusion: 0.5, heads: idx(1, 3), spacing: 0, time: 0.45 },
  },
  {
    id: 'nonlinear',
    name: 'NONLINEAR',
    blurb: "Les réverbes à enveloppe des années 80 : la porte (GATE), l'envers (REVERSE), la cloche…",
    decayLabel: 'TIME',
    preLabel: 'FEEDBACK',
    params: [
      LOW_END,
      { id: 'shape', label: 'SHAPE', options: ['SWOOSH', 'REVERSE', 'RAMP', 'GATE', 'GAUSS', 'BOUNCE'], help: "La forme de l'enveloppe : en pente (SWOOSH, REVERSE, RAMP), plate et coupée net (GATE), en cloche (GAUSS) ou en creux (BOUNCE)." },
      DIFFUSION,
      { id: 'lateDecay', label: 'LATE DECAY', help: 'La durée de la réverbe tardive qui suit.' },
      { id: 'lateLevel', label: 'LATE LEVEL', help: 'Le niveau de la réverbe tardive ; à 0 elle est coupée.' },
      { id: 'modSpeed', label: 'MOD SPEED', help: 'La vitesse du LFO qui bouge les prises et la queue tardive.' },
    ],
    def: { decay: 0.45, pre: 0, tone: 0.55, mod: 0.2, lowEnd: 0.5, shape: idx(3, 6), diffusion: 0.6, lateDecay: 0.4, lateLevel: 0.3, modSpeed: 0.3 },
  },
  {
    id: 'reflections',
    name: 'REFLECTIONS',
    blurb: "La petite pièce psychoacoustique : l'ampli placé dans une pièce, ses réflexions calculées mur par mur.",
    decayLabel: 'SIZE',
    preLabel: 'PRE-DELAY',
    params: [
      LOW_END,
      { id: 'locX', label: 'LOCATION X', help: "L'ampli vers la gauche ou la droite de la pièce." },
      { id: 'locY', label: 'LOCATION Y', help: "L'ampli devant (le son direct domine) ou au fond (les réflexions arrivent presque avec lui)." },
      { id: 'shape', label: 'SHAPE', options: ['SQUARE', 'RECT', 'OBLONG'], help: "La forme de la pièce : carrée, large (nombre d'or 1,618:1) ou longue (1:1,618)." },
    ],
    def: { decay: 0.4, pre: 0, tone: 0.5, mod: 0.15, lowEnd: 0.5, locX: 0.5, locY: 0.5, shape: 0 },
  },
];

export const SKY_MACHINE_IDS: readonly SkyMachineId[] = SKY_MACHINES.map((m) => m.id);
export const skyMachine = (id: SkyMachineId): SkyMachineDef => SKY_MACHINES.find((m) => m.id === id) ?? SKY_MACHINES[1];

/** Les potards de la face (MIX est le potard REVERB du MM-ARP). */
export const SKY_FACE = ['decay', 'pre', 'tone', 'mod'] as const satisfies readonly SkyParamId[];

const FACE_HELP: Readonly<Record<(typeof SKY_FACE)[number], string>> = {
  decay: 'Le temps que met la réverbe pour descendre de 60 dB.',
  pre: "Le silence entre la note et la réverbe : elle se détache du son.",
  tone: 'Les aigus de la réverbe : au max pleine bande, à midi chaude, au min sombre et étouffée.',
  mod: 'La modulation des lignes : elle enlève la couleur métallique ; au-delà de midi, un chorus lent dans la queue.',
};

/** La definition d'un reglage d'une machine, potards de la face compris. */
export function skyParam(m: SkyMachineId, id: SkyParamId): SkyParamDef {
  const def = skyMachine(m);
  if (id === 'decay') {
    const help = m === 'nonlinear' ? 'Le temps de la partie non linéaire (la porte, la pente).' : m === 'reflections' ? 'La taille de la pièce, de 100 à 1000 pieds carrés ; la réverbe s\'allonge avec elle.' : m === 'magneto' ? 'La durée de la réverbe qui suit les têtes.' : FACE_HELP.decay;
    return { id, label: def.decayLabel, help };
  }
  if (id === 'pre') {
    const help = def.preLabel === 'FEEDBACK' ? (m === 'magneto' ? 'La dernière tête (UNEVEN : les deux dernières) renvoyée à l\'entrée.' : 'La partie non linéaire renvoyée à son entrée.') : m === 'reflections' ? 'Le retard avant les réflexions : à 0, une pièce naturelle.' : FACE_HELP.pre;
    return { id, label: def.preLabel, help };
  }
  if (id === 'tone' || id === 'mod') return { id, label: id === 'tone' ? 'TONE' : 'MOD', help: m === 'reflections' && id === 'mod' ? 'Fait bouger le pré-délai au hasard : un chorus dans les réflexions.' : FACE_HELP[id] };
  return def.params.find((p) => p.id === id) ?? { id, label: id.toUpperCase(), help: '' };
}

/* ---------------- etat ---------------- */

export interface SkyState {
  machine: SkyMachineId;
  vals: Readonly<Record<SkyMachineId, Readonly<Partial<Record<SkyParamId, number>>>>>;
}

/** HALL au depart : DECAY 0.43 vaut 2.4 s, la queue de la reverbe d'avant (audio/fx.ts). */
const DEFAULT_MACHINE: SkyMachineId = 'hall';

const defaults = (): SkyState => ({
  machine: DEFAULT_MACHINE,
  vals: Object.fromEntries(SKY_MACHINES.map((m) => [m.id, { ...m.def }])) as SkyState['vals'],
});

/** Un cran : la valeur ramenee sur le cran le plus proche. */
const snap = (v: number, n: number): number => (n > 1 ? Math.round(v * (n - 1)) / (n - 1) : 0);

/** La valeur bornee (crans ramenes) ; NaN : null. */
function clean(m: SkyMachineId, id: SkyParamId, v: number): number | null {
  if (!Number.isFinite(v)) return null;
  const t = Math.min(1, Math.max(0, v));
  const o = skyParam(m, id).options;
  return o ? snap(t, o.length) : Math.round(t * 1000) / 1000;
}

export const SKY_STORAGE_KEY = 'mm.v4.voyager.sky.1';

function load(): SkyState {
  const out = defaults();
  try {
    const text = window.localStorage.getItem(SKY_STORAGE_KEY);
    if (!text) return out;
    const raw = JSON.parse(text) as { v?: unknown; machine?: unknown; vals?: Record<string, Record<string, unknown>> };
    if (raw.v !== 1) return out;
    const machine = SKY_MACHINE_IDS.includes(raw.machine as SkyMachineId) ? (raw.machine as SkyMachineId) : DEFAULT_MACHINE;
    const vals = { ...out.vals } as Record<SkyMachineId, Partial<Record<SkyParamId, number>>>;
    for (const m of SKY_MACHINES) {
      const src = raw.vals?.[m.id];
      if (!src || typeof src !== 'object') continue;
      const next = { ...vals[m.id] };
      for (const k of Object.keys(m.def) as SkyParamId[]) {
        const v = src[k];
        if (typeof v === 'number') {
          const c = clean(m.id, k, v);
          if (c !== null) next[k] = c;
        }
      }
      vals[m.id] = next;
    }
    return { machine, vals };
  } catch {
    return out;
  }
}

let state: SkyState = typeof window === 'undefined' ? defaults() : load();
let saveTimer = 0;
const listeners = new Set<() => void>();

function commit(next: SkyState): void {
  state = next;
  if (typeof window !== 'undefined') {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      try {
        window.localStorage.setItem(SKY_STORAGE_KEY, JSON.stringify({ v: 1, machine: state.machine, vals: state.vals }));
      } catch {
        /* stockage plein ou bloque : la visite garde ses reglages */
      }
    }, 300);
  }
  listeners.forEach((fn) => fn());
}

export const skyState = {
  get: (): SkyState => state,
  /** La valeur d'un reglage de la machine (celle en cours par defaut). */
  of(id: SkyParamId, m: SkyMachineId = state.machine): number {
    return state.vals[m][id] ?? skyMachine(m).def[id] ?? 0;
  },
  def: (id: SkyParamId, m: SkyMachineId = state.machine): number => skyMachine(m).def[id] ?? 0,
  setMachine(m: SkyMachineId): void {
    if (m === state.machine || !SKY_MACHINE_IDS.includes(m)) return;
    commit({ ...state, machine: m });
  },
  /** true si la valeur a change. */
  set(id: SkyParamId, v: number, m: SkyMachineId = state.machine): boolean {
    if (skyMachine(m).def[id] === undefined) return false;
    const c = clean(m, id, v);
    if (c === null || c === skyState.of(id, m)) return false;
    commit({ ...state, vals: { ...state.vals, [m]: { ...state.vals[m], [id]: c } } });
    return true;
  },
  /** La machine en cours a ses valeurs de depart. */
  resetMachine(m: SkyMachineId = state.machine): void {
    commit({ ...state, vals: { ...state.vals, [m]: { ...skyMachine(m).def } } });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Tests : tout au depart. */
  reset(): void {
    commit(defaults());
  },
};

/** Les reglages de la machine en cours, dans l'ordre de la page : la face, puis la machine. */
export const skyParamIds = (m: SkyMachineId): SkyParamId[] => [...SKY_FACE, ...skyMachine(m).params.map((p) => p.id)];

/* ---------------- traduction ---------------- */

/** La course de DECAY (s) de chaque machine : de lo a hi, exponentielle (le BigSky : de 200 ms a 50 s selon la machine). */
const DECAY_RANGE: Readonly<Record<SkyMachineId, readonly [number, number]>> = {
  room: [0.2, 10],
  hall: [0.5, 20],
  plate: [0.5, 20],
  spring: [0.5, 8],
  swell: [0.5, 20],
  bloom: [1, 50],
  cloud: [1, 50],
  chorale: [0.5, 20],
  shimmer: [0.5, 20],
  magneto: [0.2, 8],
  nonlinear: [0.1, 1.5],
  reflections: [100, 1000],
};

const expo = (lo: number, hi: number, v: number): number => lo * Math.pow(hi / lo, v);
/** Un cran (0 a n - 1). */
export const stepOf = (v: number, n: number): number => Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));

/** DECAY en secondes (NONLINEAR : TIME ; REFLECTIONS : la surface en pieds carres). */
export const decayOf = (m: SkyMachineId, v: number): number => {
  const [lo, hi] = DECAY_RANGE[m];
  return expo(lo, hi, v);
};
/** PRE-DELAY (s) : de 0 a 1 s, en carre (fin pres de 0). */
export const preOf = (v: number): number => v * v;
/** TONE : la coupure du passe-bas de sortie (Hz), 900 Hz a pleine bande. */
export const toneHzOf = (v: number): number => (v >= 0.97 ? 22000 : expo(900, 20000, v));
/** LOW END : le coupe-bas de l'entree (Hz), 320 a 18 Hz. */
export const lowCutOf = (v: number): number => expo(320, 18, v);
/** TIME de MAGNETO (s) : de 50 ms a 1.4 s. */
export const tapeTimeOf = (v: number): number => 0.05 + 1.35 * Math.pow(v, 1.5);
/** LATE DECAY de NONLINEAR (s). */
export const lateDecayOf = (v: number): number => expo(0.3, 10, v);
/** MOD SPEED de NONLINEAR (Hz). */
export const modSpeedOf = (v: number): number => expo(0.1, 6, v);
/** LENGTH de BLOOM (s, la plus longue des quatre lignes). */
export const bloomLenOf = (v: number): number => 0.03 + 0.32 * v;

/** Le message du moteur (audio/sky.worklet.js) : les reglages de la machine en grandeurs physiques. */
export interface SkyEngineParams {
  algo: number;
  t60: number;
  pre: number;
  toneHz: number;
  hiMul: number;
  hiHz: number;
  lowCut: number;
  lowMul: number;
  midMul: number;
  mod: number;
  modRate: number;
  scale: number;
  apG: number;
  diffusion: number;
  erLevel: number;
  tankLevel: number;
  gain: number;
  roomW?: number;
  roomL?: number;
  roomH?: number;
  srcX?: number;
  srcY?: number;
  lstY?: number;
  beta?: number;
  springs?: number;
  drive?: number;
  rise?: number;
  swellDry?: boolean;
  bloomLen?: number;
  bloomFb?: number;
  vowel?: number;
  q?: number;
  shift1?: number;
  shift2?: number;
  shAmt?: number;
  shMode?: number;
  heads?: number;
  uneven?: boolean;
  dTime?: number;
  fb?: number;
  nlTime?: number;
  nlShape?: number;
  lateLevel?: number;
}

/**
 * Les gains de sortie de chaque machine (mesures hors ligne, scripts/sky-test.mjs) : chaque machine sort a peu pres la
 * meme energie que la reverbe d'avant (une reponse d'energie 1) a son reglage de depart, un changement de machine ne
 * saute pas de niveau.
 */
export const SKY_GAIN: Readonly<Record<SkyMachineId, number>> = {
  room: 1.73,
  hall: 1.91,
  plate: 0.73,
  spring: 2.59,
  swell: 1.29,
  bloom: 1.01,
  cloud: 1.31,
  chorale: 1.66,
  shimmer: 1.07,
  magneto: 2.83,
  nonlinear: 2.29,
  reflections: 2.41,
};

const ratioOf = (semis: number): number => Math.pow(2, semis / 12);

export function skyEngine(s: SkyState = state): SkyEngineParams {
  const m = s.machine;
  const v = (id: SkyParamId): number => s.vals[m][id] ?? skyMachine(m).def[id] ?? 0;
  const tone = v('tone');
  const low = v('lowEnd');
  const base: SkyEngineParams = {
    algo: SKY_MACHINE_IDS.indexOf(m),
    t60: decayOf(m, v('decay')),
    pre: preOf(v('pre')),
    toneHz: toneHzOf(tone),
    hiMul: 0.22 + 0.78 * Math.pow(tone, 0.8),
    hiHz: 2500 + 6000 * tone,
    lowCut: lowCutOf(low),
    lowMul: 0.55 + 0.8 * low,
    midMul: 1,
    mod: v('mod'),
    modRate: 0.5,
    scale: 1,
    apG: 0.4,
    diffusion: 0.75,
    erLevel: 0,
    tankLevel: 1,
    gain: SKY_GAIN[m],
  };
  switch (m) {
    case 'room': {
      const club = stepOf(v('size'), 2) === 1;
      return { ...base, scale: club ? 0.75 : 0.42, apG: 0.3, diffusion: v('diffusion'), modRate: 0.55, roomW: club ? 13 : 5.5, roomL: club ? 10 : 4.2, roomH: club ? 4.5 : 3, srcX: 0.5, srcY: 0.62, lstY: 0.2, beta: 0.82, erLevel: 0.8, tankLevel: 0.85 };
    }
    case 'hall': {
      const arena = stepOf(v('size'), 2) === 1;
      return { ...base, scale: arena ? 2.1 : 1.25, apG: 0.45, diffusion: 0.75, midMul: 0.55 + 0.9 * v('mid'), modRate: 0.45, roomW: arena ? 70 : 32, roomL: arena ? 55 : 24, roomH: arena ? 25 : 14, srcX: 0.5, srcY: 0.3, lstY: 0.6, beta: 0.85, erLevel: 0.45 };
    }
    case 'plate':
      return { ...base, scale: stepOf(v('size'), 2) === 1 ? 0.62 : 0.38, apG: 0.55, diffusion: 0.85, hiMul: 0.35 + 0.75 * Math.pow(tone, 0.8), modRate: 0.8 };
    case 'spring':
      return { ...base, springs: stepOf(v('springs'), 3) + 1, drive: [1, 2.5, 5, 11][stepOf(v('dwell'), 4)] };
    case 'swell':
      return { ...base, scale: 1.3, apG: 0.45, rise: RISE_TIMES[stepOf(v('rise'), RISE_TIMES.length)], swellDry: stepOf(v('swellMode'), 2) === 1 };
    case 'bloom':
      return { ...base, scale: 1.7, apG: 0.5, diffusion: 0.8, bloomLen: bloomLenOf(v('length')), bloomFb: 0.85 * v('feedback'), modRate: 0.35 };
    case 'cloud': {
      const d = v('diffusion');
      return { ...base, scale: 3, apG: 0.7 * d, diffusion: d, modRate: 0.25 };
    }
    case 'chorale':
      return { ...base, scale: 1.4, apG: 0.45, vowel: stepOf(v('vowel'), 7), q: [4, 8, 15][stepOf(v('resonance'), 3)] };
    case 'shimmer': {
      const s2 = stepOf(v('shift2'), SHIFTS.length + 1);
      return { ...base, scale: 1.45, apG: 0.5, diffusion: 0.8, shift1: ratioOf(SHIFT_SEMIS[stepOf(v('shift1'), SHIFTS.length)]), shift2: s2 === 0 ? 0 : ratioOf(SHIFT_SEMIS[s2 - 1]), shAmt: v('amount'), shMode: stepOf(v('shimMode'), 3) };
    }
    case 'magneto':
      return { ...base, scale: 0.75, apG: 0.4, diffusion: v('diffusion'), heads: [3, 4, 6][stepOf(v('heads'), 3)], uneven: stepOf(v('spacing'), 2) === 1, dTime: tapeTimeOf(v('time')), fb: 0.9 * v('pre'), pre: 0, tankLevel: 0.6 };
    case 'nonlinear':
      return { ...base, scale: 1.1, t60: lateDecayOf(v('lateDecay')), nlTime: decayOf(m, v('decay')), nlShape: stepOf(v('shape'), 6), diffusion: v('diffusion'), fb: 0.85 * v('pre'), pre: 0, lateLevel: v('lateLevel'), modRate: modSpeedOf(v('modSpeed')) };
    case 'reflections': {
      // la surface (pieds carres -> m2), la forme, la piece et la queue qui va avec
      const sq = decayOf(m, v('decay'));
      const area = sq * 0.0929;
      const sh = stepOf(v('shape'), 3);
      const w = sh === 1 ? Math.sqrt(area * 1.618) : sh === 2 ? Math.sqrt(area / 1.618) : Math.sqrt(area);
      const size = v('decay');
      return { ...base, t60: 0.25 + 0.6 * size, scale: 0.3 + 0.25 * size, apG: 0.5, diffusion: 0.8, roomW: w, roomL: area / w, roomH: 2.8, srcX: 0.1 + 0.8 * v('locX'), srcY: 0.3 + 0.62 * v('locY'), lstY: 0.12, beta: 0.6 + 0.3 * tone, erLevel: 1, tankLevel: 0.3 };
    }
  }
  return base;
}

/* ---------------- texte ---------------- */

const fmtS = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : s < 10 ? `${s.toFixed(2)} S` : `${s.toFixed(1)} S`);
const n127 = (v: number): string => `${Math.round(v * 127)}`;

/** La valeur d'un reglage telle que la page l'ecrit (le nom d'un cran, une duree, 0 a 127). */
export function skyText(m: SkyMachineId, id: SkyParamId, v: number): string {
  const p = skyParam(m, id);
  if (p.options) return p.options[stepOf(v, p.options.length)];
  switch (id) {
    case 'decay':
      if (m === 'reflections') return `${Math.round(decayOf(m, v) / 10) * 10} SQ FT`;
      return fmtS(decayOf(m, v));
    case 'pre':
      return p.label === 'FEEDBACK' ? `${Math.round(v * 100)} %` : `${Math.round(preOf(v) * 1000)} MS`;
    case 'time':
      return fmtS(tapeTimeOf(v));
    case 'lateDecay':
      return fmtS(lateDecayOf(v));
    case 'modSpeed':
      return `${modSpeedOf(v).toFixed(2)} HZ`;
    case 'length':
      return fmtS(bloomLenOf(v));
    case 'locX':
      return v < 0.02 ? 'L' : v > 0.98 ? 'R' : `${v < 0.5 ? 'L' : 'R'} ${Math.round(Math.abs(v - 0.5) * 200)}`.replace(/^[LR] 0$/, 'C');
    case 'locY':
      return v < 0.02 ? 'F' : v > 0.98 ? 'B' : `${v < 0.5 ? 'F' : 'B'} ${Math.round(Math.abs(v - 0.5) * 200)}`.replace(/^[FB] 0$/, 'MID');
    case 'tone':
      return v >= 0.97 ? 'FULL' : `${(toneHzOf(v) / 1000).toFixed(1)} KHZ`;
    case 'lowEnd':
      return n127(v);
    default:
      return n127(v);
  }
}
