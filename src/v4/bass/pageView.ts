/**
 * Ce que montre l'ecran du MM-BASS, facon Elektron (2026-10-08, Mika : "on
 * voit a l'ecran que quand le sequenceur passe sur ce step alors le
 * changement est fait ; les valeurs des knobs sont a l'ecran de 0 a 127 ;
 * fais evoluer l'ecran parce que je pense que c'est la cle de ce que je
 * demande"). Des fonctions pures (les tests les lisent aussi, debug.ts) :
 * - la PAGE, toujours la, par defaut : l'en-tete (la page, LOCK 05 en
 *   negatif, le pattern, le tempo, la lecture), les huit blocs dans l'ordre
 *   des encodeurs (le nom, le nombre de 0 a 127, l'unite, un petit dessin),
 *   la bande des seize pas (la tete de lecture, les notes, un point sur
 *   chaque pas verrouille), la ligne du bas ;
 * - les etats d'un bloc : live (la valeur du son), lockOn (en LOCK, ce
 *   reglage est verrouille sur le pas : en negatif, sa valeur), lockOff (en
 *   LOCK, pas verrouille : la valeur du son, attenuee), global (en LOCK, un
 *   reglage qui ne se verrouille pas : GLOBAL), flash (en lecture, le pas
 *   qui joue a un verrou sur ce reglage : en negatif le temps du pas, avec
 *   la valeur verrouillee), empty (rien) ; echo : le bloc qu'on vient de
 *   tourner, cerne ;
 * - EDIT ("ne fais juste que voir les patterns et les changements") : le
 *   rouleau de la ligne (notes, accents, slides, liaisons), dessous les
 *   pistes des verrous de la page courante (une barre par pas verrouille,
 *   sur l'echelle 0 a 127 du reglage, le niveau du son en pointille), le
 *   compte des verrous des autres pages, et les seize patterns.
 */

import { BASS_PAGES, BASS_PAGE_SLOTS, ENC_LETTERS, bassPageDef, isBassGlobal, type BassPageId } from './pages';
import { BASS_ROOTS, BASS_SCALES, BASS_STYLES, bassBig, bassKnob, bassUnit, stepOf, type BassKnobId, type BassValues } from './params';
import { BASS_LOCKABLE, BASS_STEPS, chainLocks, isLockable, type BassLocks, type BassStep } from './state';

export type BlockState = 'empty' | 'live' | 'lockOn' | 'lockOff' | 'global' | 'flash';

/** Le petit dessin d'un bloc. */
export type BlockDraw = 'bar' | 'center' | 'notch' | 'wave' | 'pulse' | 'lp' | 'peak' | 'decay' | 'adsr' | 'glide' | 'gate' | 'tilt' | 'echo';

export interface BassBlock {
  k: number;
  letter: string;
  id: BassKnobId | null;
  label: string;
  /** le grand texte : 0 a 127 (TUNE -64 a +63), ou le nom du cran */
  big: string;
  unit: string;
  /** la valeur montree (0 a 1) */
  v: number;
  state: BlockState;
  echo: boolean;
  draw: BlockDraw;
  /** ses crans (0 : continu) et le cran courant */
  notches: number;
  notch: number;
  /** ADSR : le segment de ce bloc (0 ATTACK, 1 DECAY, 2 SUSTAIN, 3 RELEASE) */
  seg: number;
}

export interface BassStripCell {
  kind: BassStep['kind'];
  acc: boolean;
  slide: boolean;
  /** la hauteur relative de la note (0 la plus grave de la ligne, 1 la plus aigue) */
  h: number;
  /** 0 : aucun verrou, 1 : des verrous sur d'autres pages, 2 : un verrou sur cette page */
  lock: 0 | 1 | 2;
}

export interface BassPageModel {
  page: BassPageId;
  pages: readonly { id: BassPageId; label: string; locks: number }[];
  title: string;
  running: boolean;
  bpm: number;
  pattern: string;
  style: string;
  key: string;
  lock: { step: number; what: string; n: number } | null;
  infos: boolean;
  blocks: BassBlock[];
  /** les quatre temps de l'ampli montres (ATTACK, AMP DECAY, SUSTAIN, RELEASE, 0 a 1) : le dessin ADSR */
  env: readonly [number, number, number, number];
  strip: { cells: BassStripCell[]; play: number; sel: number; lock: number };
  line: string;
  lineHot: boolean;
  /** a droite de la ligne du bas, discret */
  aside: string;
}

const DRAW: Partial<Record<BassKnobId, BlockDraw>> = {
  wave: 'wave',
  pw: 'pulse',
  cutoff: 'lp',
  reso: 'peak',
  decay: 'decay',
  accdecay: 'decay',
  rsize: 'decay',
  attack: 'adsr',
  adecay: 'adsr',
  sustain: 'adsr',
  release: 'adsr',
  glide: 'glide',
  length: 'gate',
  tune: 'center',
  rtone: 'tilt',
  dtime: 'echo',
};
const SEG: Partial<Record<BassKnobId, number>> = { attack: 0, adecay: 1, sustain: 2, release: 3 };

export const blockDrawOf = (id: BassKnobId): BlockDraw => DRAW[id] ?? (bassKnob(id).steps ? 'notch' : 'bar');

const two = (i: number): string => String(i + 1).padStart(2, '0');

/** Les verrous qui sonnent au pas i : ceux que le sequenceur envoie au worklet (state.ts chainLocks, la boucle comprise). */
export const effectiveLocks = (steps: readonly BassStep[], i: number): BassLocks | null => chainLocks(steps, i);

/** Le nombre de pas verrouilles sur une page (au moins un reglage de la page). */
function pageLockCount(steps: readonly BassStep[], page: BassPageId): number {
  const ids = BASS_PAGE_SLOTS[page];
  return steps.filter((s) => s.locks && ids.some((id) => id !== null && isLockable(id) && s.locks?.[id] !== undefined)).length;
}

export interface PageInput {
  steps: readonly BassStep[];
  values: BassValues;
  page: BassPageId;
  sel: number;
  lock: number;
  running: boolean;
  /** le pas qui joue (-1 : rien) */
  playing: number;
  bpm: number;
  pattern: string;
  message: string | null;
  infos: boolean;
  /** le reglage qu'on vient de tourner (l'echo), null : aucun */
  echo: BassKnobId | null;
  /** la note d'un pas, lisible (F#2) */
  noteName: (s: BassStep) => string;
  /** la hauteur MIDI d'un pas (la bande dessine le contour de la ligne) */
  midiOf: (s: BassStep) => number;
}

function stepWhat(s: BassStep, name: (s: BassStep) => string): string {
  if (s.kind === 'off') return 'EMPTY';
  if (s.kind === 'tie') return 'TIE';
  return `${name(s)}${s.acc ? ' ACC' : ''}${s.slide ? ' SLD' : ''}`;
}

/** La bande des seize pas : la ligne en contour, les verrous de la page. */
function strip(inp: PageInput): BassPageModel['strip'] {
  const ids = BASS_PAGE_SLOTS[inp.page];
  const midis: (number | null)[] = [];
  let last: number | null = null;
  for (const s of inp.steps) {
    if (s.kind === 'note') last = inp.midiOf(s);
    midis.push(s.kind === 'off' ? null : last);
    if (s.kind === 'off') last = null;
  }
  const ns = midis.filter((m): m is number => m !== null);
  const lo = ns.length ? Math.min(...ns) : 36;
  const hi = ns.length ? Math.max(...ns) : 48;
  const cells = inp.steps.map((s, i): BassStripCell => {
    const here = !!s.locks && ids.some((id) => id !== null && isLockable(id) && s.locks?.[id] !== undefined);
    const m = midis[i];
    return { kind: s.kind, acc: s.kind === 'note' && s.acc, slide: s.kind !== 'off' && s.slide, h: m === null || hi === lo ? 0.5 : (m - lo) / (hi - lo), lock: here ? 2 : s.locks ? 1 : 0 };
  });
  return { cells, play: inp.running ? inp.playing : -1, sel: inp.sel, lock: inp.lock };
}

/** La PAGE : l'en-tete, les huit blocs, la bande, la ligne du bas. */
export function bassPageModel(inp: PageInput): BassPageModel {
  const v = inp.values;
  const locking = inp.lock >= 0 && inp.lock < BASS_STEPS;
  const lockStep = locking ? inp.steps[inp.lock] : null;
  const lockVals = lockStep?.locks ?? {};
  // En lecture (hors LOCK) : les valeurs du pas qui joue
  const playLocks = !locking && inp.running && inp.playing >= 0 ? effectiveLocks(inp.steps, inp.playing) : null;
  const shown = (id: BassKnobId): { v: number; state: BlockState } => {
    if (locking) {
      if (isBassGlobal(id)) return { v: v[id], state: 'global' };
      const lv = isLockable(id) ? lockVals[id] : undefined;
      return lv !== undefined ? { v: lv, state: 'lockOn' } : { v: v[id], state: 'lockOff' };
    }
    const pv = playLocks && isLockable(id) ? playLocks[id] : undefined;
    return pv !== undefined ? { v: pv, state: 'flash' } : { v: v[id], state: 'live' };
  };
  const blocks = BASS_PAGE_SLOTS[inp.page].map((id, k): BassBlock => {
    const letter = ENC_LETTERS[k];
    if (id === null) return { k, letter, id: null, label: '', big: '', unit: '', v: 0, state: 'empty', echo: false, draw: 'bar', notches: 0, notch: 0, seg: -1 };
    const def = bassKnob(id);
    const s = shown(id);
    const notches = def.steps ?? 0;
    return {
      k,
      letter,
      id,
      label: def.label,
      big: bassBig(id, s.v),
      unit: s.state === 'global' ? 'GLOBAL' : bassUnit(id, s.v, inp.bpm),
      v: s.v,
      state: s.state,
      echo: inp.echo === id,
      draw: blockDrawOf(id),
      notches,
      notch: notches ? stepOf(id, s.v) : 0,
      seg: SEG[id] ?? -1,
    };
  });
  // L'enveloppe dessinee : celle du pas en LOCK, ou du pas qui joue
  const envOf = (id: 'attack' | 'adecay' | 'sustain' | 'release'): number => (locking ? lockVals[id] ?? v[id] : playLocks?.[id] ?? v[id]);
  const lock = locking && lockStep ? { step: inp.lock, what: stepWhat(lockStep, inp.noteName), n: Object.keys(lockStep.locks ?? {}).length } : null;
  const sel = inp.steps[inp.sel];
  let line: string;
  let aside = '';
  if (inp.message) line = inp.message;
  else if (lock) line = `TURN A KNOB: STEP ${two(lock.step)} ONLY  2X: UNLOCK  CLEAR: ALL`;
  else line = sel ? `STEP ${two(inp.sel)}  ${stepWhat(sel, inp.noteName)}` : '';
  // Le geste du LOCK, a droite de la ligne tant qu'on n'est pas en LOCK (2026-10-08, la revue : au telephone, la
  // serigraphie sous les pas ne se lit pas, l'ecran oui ; l'ecran le dit aussi apres un pas touche)
  if (!lock) aside = 'HOLD A STEP + TURN: P-LOCK';
  return {
    page: inp.page,
    pages: BASS_PAGES.map((p) => ({ id: p.id, label: p.label, locks: pageLockCount(inp.steps, p.id) })),
    title: bassPageDef(inp.page).title,
    running: inp.running,
    bpm: inp.bpm,
    pattern: inp.pattern,
    style: BASS_STYLES[stepOf('style', v.style)],
    key: `${BASS_ROOTS[stepOf('root', v.root)]} ${BASS_SCALES[stepOf('scale', v.scale)]}`,
    lock,
    infos: inp.infos,
    blocks,
    env: [envOf('attack'), envOf('adecay'), envOf('sustain'), envOf('release')],
    strip: strip(inp),
    line,
    lineHot: !!inp.message || !!lock,
    aside,
  };
}

/* ---------------- EDIT ---------------- */

export interface BassLane {
  id: BassKnobId;
  label: string;
  /** la valeur du son (0 a 1), en pointille */
  base: number;
  /** la valeur verrouillee de chaque pas, null : pas de verrou */
  cells: (number | null)[];
}

export interface BassEditModel {
  running: boolean;
  bpm: number;
  page: BassPageId;
  pageLabel: string;
  pattern: string;
  chain: string;
  slots: { filled: boolean; cur: boolean; next: boolean; chain: number }[];
  /** le rouleau : la hauteur MIDI de chaque pas (une liaison : celle de sa note), null vide */
  midis: (number | null)[];
  steps: readonly BassStep[];
  lanes: BassLane[];
  /** les pistes de la page qui ne tiennent pas a l'ecran */
  more: number;
  /** les verrous des autres pages (pas verrouilles) */
  others: { label: string; n: number }[];
  play: number;
  sel: number;
  infos: boolean;
  line: string;
  lineHot: boolean;
}

export interface EditInput {
  steps: readonly BassStep[];
  values: BassValues;
  page: BassPageId;
  running: boolean;
  playing: number;
  sel: number;
  bpm: number;
  cur: number;
  next: number;
  chain: readonly number[];
  filled: readonly boolean[];
  message: string | null;
  infos: boolean;
  midiOf: (s: BassStep) => number;
  /** combien de pistes tiennent */
  maxLanes: number;
}

const slotName = (i: number): string => `A${String(i + 1).padStart(2, '0')}`;

export function bassEditModel(inp: EditInput): BassEditModel {
  const midis: (number | null)[] = [];
  let last: number | null = null;
  for (const s of inp.steps) {
    if (s.kind === 'note') last = inp.midiOf(s);
    midis.push(s.kind === 'off' ? null : last);
    if (s.kind === 'off') last = null;
  }
  const ids = BASS_PAGE_SLOTS[inp.page].filter((id): id is BassKnobId => id !== null && isLockable(id));
  const all = ids
    .map((id): BassLane => ({ id, label: bassKnob(id).label, base: inp.values[id], cells: inp.steps.map((s) => s.locks?.[id as (typeof BASS_LOCKABLE)[number]] ?? null) }))
    .filter((l) => l.cells.some((c) => c !== null));
  // Les plus remplies d'abord si elles ne tiennent pas toutes
  const lanes = all.length > inp.maxLanes ? [...all].sort((a, b) => b.cells.filter((c) => c !== null).length - a.cells.filter((c) => c !== null).length).slice(0, inp.maxLanes) : all;
  const order = new Map(ids.map((id, i) => [id, i]));
  lanes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const chainOn = inp.chain.length > 1;
  // PLAYING seulement en lecture (2026-10-08, la revue : il s'affichait a cote du carre de l'arret)
  const chain = chainOn ? inp.chain.map(slotName).join(' > ') : inp.next >= 0 ? `NEXT ${slotName(inp.next)}` : !inp.filled[inp.cur] ? 'EMPTY' : inp.running ? 'PLAYING' : 'READY';
  return {
    running: inp.running,
    bpm: inp.bpm,
    page: inp.page,
    pageLabel: bassPageDef(inp.page).label,
    pattern: slotName(inp.cur),
    chain,
    slots: inp.filled.map((filled, i) => ({ filled, cur: i === inp.cur, next: i === inp.next, chain: chainOn ? inp.chain.indexOf(i) : -1 })),
    midis,
    steps: inp.steps,
    lanes,
    more: all.length - lanes.length,
    others: BASS_PAGES.filter((p) => p.id !== inp.page).map((p) => ({ label: p.label, n: pageLockCount(inp.steps, p.id) })),
    play: inp.running ? inp.playing : -1,
    sel: inp.sel,
    infos: inp.infos,
    line: inp.message ?? 'TAP A STEP: PATTERN  TAP MORE: CHAIN  HOLD AN EMPTY ONE: COPY',
    lineHot: !!inp.message,
  };
}
