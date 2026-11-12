/**
 * Les pistes du STEP SEQUENCER du module avant du plugin MM-ARP (2026-11-11, Mika : "sur le VST je voulais encore
 * d'autres fonctions sur le panneau AVANT" ; FrontModule.tsx). Seize pas, cinq pistes, un pas par position de la suite
 * de l'arpege (mm_transport pos, modulo 16) :
 * - acc   : ACCENT, 0 doux, 1 normal (defaut), 2 appuye ;
 * - slide : SLIDE, 0 non (defaut), 1 oui ;
 * - gate  : GATE, 0 court, 1 normal (defaut), 2 long, 3 lie ;
 * - rat   : RATCHET, 1 (defaut) a 4 coups ;
 * - prob  : PROB, 100 (defaut), 75, 50, 25 ou 0 %.
 *
 * Le VST3 seul : le site ne connait pas ce module. Garde dans le localStorage sous mm.v4.plugin.arp.steps (une cle
 * mm.v4.* : elle part dans l'etat du projet, bridge.ts snapshotLs), envoye au C++ dans mm_program sous
 * steps: { acc, slide, gate, rat, prob } (cinq tableaux de 16 entiers), garde dans les presets disque (champ steps).
 * Un preset sans steps les remet aux valeurs de depart. Sans dependance, comme extra.ts.
 */

export const STEPS_STORAGE_KEY = 'mm.v4.plugin.arp.steps';
/** Les pas d'une piste : une mesure de doubles croches, comme la suite EDIT (voyager/seq.ts SEQ_MAX). */
export const STEPS_N = 16;

export type StepTrack = 'acc' | 'slide' | 'gate' | 'rat' | 'prob';

export interface StepsState {
  readonly acc: readonly number[];
  readonly slide: readonly number[];
  readonly gate: readonly number[];
  readonly rat: readonly number[];
  readonly prob: readonly number[];
}

interface TrackSpec {
  id: StepTrack;
  label: string;
  /** les etats, dans l'ordre d'un clic (clic : le suivant ; clic droit ou Maj + clic : le precedent) */
  values: readonly number[];
  /** leur nom (l'info-bulle, le lecteur d'ecran, l'afficheur du capot) */
  names: readonly string[];
  def: number;
}

/** Les cinq pistes, dans l'ordre de l'ecran. */
export const STEP_TRACKS: readonly TrackSpec[] = [
  { id: 'acc', label: 'ACCENT', values: [0, 1, 2], names: ['SOFT', 'NORMAL', 'ACCENT'], def: 1 },
  { id: 'slide', label: 'SLIDE', values: [0, 1], names: ['OFF', 'ON'], def: 0 },
  { id: 'gate', label: 'GATE', values: [0, 1, 2, 3], names: ['SHORT', 'NORMAL', 'LONG', 'TIE'], def: 1 },
  { id: 'rat', label: 'RATCHET', values: [1, 2, 3, 4], names: ['x1', 'x2', 'x3', 'x4'], def: 1 },
  { id: 'prob', label: 'PROB', values: [100, 75, 50, 25, 0], names: ['100 %', '75 %', '50 %', '25 %', '0 %'], def: 100 },
];

const SPEC: Record<StepTrack, TrackSpec> = Object.fromEntries(STEP_TRACKS.map((t) => [t.id, t])) as Record<StepTrack, TrackSpec>;
const TRACK_IDS: readonly StepTrack[] = STEP_TRACKS.map((t) => t.id);

/** Le nom de l'etat d'un pas (NORMAL, TIE, x3, 75 %...). */
export const stepName = (track: StepTrack, v: number): string => {
  const t = SPEC[track];
  const i = t.values.indexOf(v);
  return i < 0 ? String(v) : t.names[i];
};

const row = (t: TrackSpec): number[] => Array.from({ length: STEPS_N }, () => t.def);

const defaults = (): StepsState => ({ acc: row(SPEC.acc), slide: row(SPEC.slide), gate: row(SPEC.gate), rat: row(SPEC.rat), prob: row(SPEC.prob) });

/** Une valeur posee : un etat de la piste (le plus proche pour PROB, borne sinon), la valeur de depart si illisible. */
function clean(t: TrackSpec, v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return t.def;
  let best = t.values[0];
  for (const x of t.values) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

/** Des pistes lues (le localStorage, un preset) : chaque piste absente ou illisible revient a ses valeurs de depart. */
function parse(raw: unknown): StepsState {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<StepTrack, number[]>;
  for (const id of TRACK_IDS) {
    const t = SPEC[id];
    const a = Array.isArray(o[id]) ? (o[id] as unknown[]) : [];
    out[id] = Array.from({ length: STEPS_N }, (_, i) => clean(t, a[i] ?? t.def));
  }
  return out;
}

function load(): StepsState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STEPS_STORAGE_KEY) ?? 'null') as { steps?: unknown } | null;
    if (raw && typeof raw === 'object' && raw.steps) return parse(raw.steps);
  } catch {
    /* illisible ou stockage refuse : les valeurs de depart */
  }
  return defaults();
}

let state: StepsState = typeof window === 'undefined' ? defaults() : load();
const listeners = new Set<() => void>();

function save(): void {
  try {
    window.localStorage.setItem(STEPS_STORAGE_KEY, JSON.stringify({ v: 1, steps: state }));
  } catch {
    /* stockage refuse : rien */
  }
}

const same = (a: StepsState, b: StepsState): boolean => TRACK_IDS.every((id) => a[id].every((v, i) => v === b[id][i]));

function setState(next: StepsState): boolean {
  if (same(state, next)) return false;
  state = next;
  save();
  listeners.forEach((fn) => fn());
  return true;
}

export const arpSteps = {
  get: (): StepsState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** L'etat d'un pas ; true s'il a change. */
  set(track: StepTrack, i: number, v: number): boolean {
    if (!Number.isInteger(i) || i < 0 || i >= STEPS_N) return false;
    const t = SPEC[track];
    const row = state[track].slice();
    row[i] = clean(t, v);
    return setState({ ...state, [track]: row });
  },
  /** L'etat suivant (dir 1) ou precedent (dir -1) de ce pas, en boucle. */
  next(track: StepTrack, i: number, dir: 1 | -1 = 1): number {
    const t = SPEC[track];
    const k = t.values.indexOf(state[track][i] ?? t.def);
    return t.values[(Math.max(0, k) + dir + t.values.length) % t.values.length];
  },
  /** Un preset, l'etat d'un projet : les pistes qu'il porte, les valeurs de depart pour le reste (ou sans rien). */
  load(raw: unknown): boolean {
    return setState(parse(raw));
  },
  /** Toutes les pistes (ou une seule) a leurs valeurs de depart. */
  reset(track?: StepTrack): boolean {
    return setState(track ? { ...state, [track]: row(SPEC[track]) } : defaults());
  },
  /** Une piste est-elle a ses valeurs de depart ? */
  isDefault: (track?: StepTrack): boolean => (track ? [track] : TRACK_IDS).every((id) => state[id].every((v) => v === SPEC[id].def)),
  /** Les pistes telles qu'elles partent au C++ et dans un preset : cinq tableaux de 16 entiers. */
  plain: (): { acc: number[]; slide: number[]; gate: number[]; rat: number[]; prob: number[] } => ({
    acc: [...state.acc],
    slide: [...state.slide],
    gate: [...state.gate],
    rat: [...state.rat],
    prob: [...state.prob],
  }),
  /** La cle ecrite meme si rien n'a bouge (l'etat du projet la porte toujours). */
  flush: save,
};
