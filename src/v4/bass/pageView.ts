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
 * Au telephone, sans encodeurs (2026-10-09, Mika : "on change dans l'ecran
 * directement") : un bloc tenu par un doigt est cerne (held), et les gestes
 * que l'ecran rappelle parlent de glisser une valeur (DRAG A VALUE), plus de
 * potard a tourner. La revue du meme jour : tant qu'un doigt tient un bloc,
 * la ligne du bas repete son nom, son nombre et son unite (le doigt cache le
 * bloc), en LOCK avec son pas ; la ligne du LOCK dit aussi comment sortir.
 *
 * L'etape 2 (2026-10-09, Mika : "quand on selectionne un step on rentre en
 * parameters lock et la dans ce cas ca doit s'afficher dans ENV que nous
 * sommes en P-LOCKS ; j'aimerais autant en mobile qu'en desktop pouvoir
 * modifier les choses directement sur l'ecran") :
 * - le titre de la page s'ecrit (AMP ENV, FILTER 303...), en P-LOCK suivi de
 *   P-LOCKS, et l'en-tete entier passe en negatif (P-LOCK STEP 05) ; le
 *   compte des verrous du pas (3 P-LOCKS) sur chaque page ;
 * - un bloc verrouille sur le pas porte sa marque (P, mark) ; un reglage qui
 *   ne se verrouille pas dit GLOBAL (global) ; un verrou qui ne s'entendrait
 *   pas le dit, attenue (hint : SUSTAIN FULL, SAW: NO PW, ACCENT STEPS,
 *   SLIDE STEPS, ROOT NOTE) ;
 * - en lecture, le pas qui joue porte des verrous (n'importe quelle page) :
 *   la puce P-LOCK de l'en-tete et sa case de la bande clignotent avec lui ;
 * - desktop : le bloc sous la souris (hover) se cerne a peine ; un encodeur
 *   de la face (les FX globaux) montre son reglage dans une bulle (pop) ;
 * - ENV : l'enveloppe de l'ampli en grand sur les cases libres (envGate : la
 *   longueur de la note qui joue, en part du pas) ;
 * - EDIT : la note qu'on glisse au rouleau (drag), son nom.
 *
 * Le moteur MONARK (2026-10-09) : l'ecran montre un onglet (screen) de sa
 * page, ses puces (tabs : MAIN OSC MIX, MAIN CONTOUR, l'onglet allume, les
 * verrous de chacun) ; des dessins de plus (la forme d'un oscillateur, ses
 * pieds, un niveau du melangeur, le bruit, la boucle de FEEDBACK, DRIFT, la
 * reponse de MODE, POLARITY, le contour du filtre) ; le grand dessin du
 * contour sur CONTOUR G H (contour : F.ATTACK, DECAY, F.SUSTAIN, RELEASE,
 * son signe, son ampleur, la 303 ou l'echelle) ; un reglage muet le dit
 * (OSC 2 OFF : son niveau est a 0 ; LADDER ONLY : en MODE 303) ; les
 * verrous d'une page se comptent sur tous ses onglets.
 */

import { BASS_PAGES, BASS_SCREEN_SLOTS, ENC_LETTERS, PAGE_TABS, SCREEN_LABEL, SCREEN_PAGE, bassPageDef, isBassGlobal, pageIds, screenTitle, type BassPageId, type BassScreenId } from './pages';
import { BASS_ROOTS, BASS_SCALES, BASS_STYLES, bassBig, bassKnob, bassUnit, envOct, lengthPct, modeName, stepOf, type BassKnobId, type BassMode, type BassValues } from './params';
import { BASS_LOCKABLE, BASS_STEPS, chainLocks, isLockable, type BassLocks, type BassStep } from './state';

export type BlockState = 'empty' | 'live' | 'lockOn' | 'lockOff' | 'global' | 'flash';

/**
 * Le petit dessin d'un bloc ; le moteur MONARK (2026-10-09) : osc (un cycle de la forme), feet (les quatre pieds),
 * level (un fader et ses dB), noise, loop (FEEDBACK : la sortie renvoyee a l'entree), drift (un sinus qui vacille), mode
 * (la reponse du MODE), pol (le contour vers le haut ou le bas), fadsr (le contour du filtre).
 */
export type BlockDraw = 'bar' | 'center' | 'notch' | 'wave' | 'pulse' | 'lp' | 'peak' | 'decay' | 'adsr' | 'glide' | 'gate' | 'tilt' | 'echo' | 'osc' | 'feet' | 'level' | 'noise' | 'loop' | 'drift' | 'mode' | 'pol' | 'fadsr';

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
  /** un pointeur le tient (2026-10-09) : l'ecran le cerne */
  held: boolean;
  /** la souris le survole (desktop, 2026-10-09) : un cadre discret */
  hover: boolean;
  /** il porte un verrou sur le pas (en P-LOCK) ou sur le pas qui joue : la marque P (2026-10-09) */
  mark: boolean;
  /** un reglage qui ne se verrouille jamais (DLY TIME, OCTAVE...) : l'etiquette GLOBAL */
  global: boolean;
  /** ce verrou ne s'entendrait pas, et pourquoi (SUSTAIN FULL...) ; '' : rien a dire */
  hint: string;
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

/** La bulle d'un encodeur de la face (2026-10-09) : son reglage global, sans quitter la page. */
export interface BassPop {
  k: number;
  letter: string;
  id: BassKnobId;
  label: string;
  big: string;
  unit: string;
  v: number;
  draw: BlockDraw;
  notches: number;
  notch: number;
}

export interface BassPageModel {
  page: BassPageId;
  /** l'onglet affiche (2026-10-09) */
  screen: BassScreenId;
  pages: readonly { id: BassPageId; label: string; locks: number }[];
  /** les onglets de la page (MAIN OSC MIX...) : leur nom, leurs verrous dans la ligne ; un seul : pas de puces */
  tabs: readonly { id: BassScreenId; label: string; locks: number }[];
  /** le MODE du filtre (les dessins du filtre suivent sa reponse) */
  mode: BassMode;
  /**
   * le contour du filtre montre (CONTOUR G H) : F.ATTACK, DECAY, F.SUSTAIN, RELEASE (0 a 1), son signe (POLARITY), son
   * ampleur en octaves (ENV MOD), la 303 (attaque immediate, sans tenue) ou l'echelle
   */
  contour: { a: number; d: number; s: number; r: number; neg: boolean; oct: number; tb: boolean };
  /** le titre de la page (AMP ENV) ; en P-LOCK, plock dit d'ajouter P-LOCKS */
  title: string;
  running: boolean;
  bpm: number;
  pattern: string;
  /** l'en-tete : le preset charge tant que rien n'a bouge (2026-10-09, presets.current), sinon le style */
  style: string;
  key: string;
  /** le pas en P-LOCK : son rang, sa note, ses verrous (toutes pages) */
  lock: { step: number; what: string; n: number } | null;
  /** la ligne de titre, a droite : en P-LOCK le compte des verrous du pas, sinon les pas verrouilles de la ligne */
  count: string;
  /** en lecture, le pas qui joue porte des verrous (n'importe quelle page) : la puce P-LOCK clignote */
  chip: boolean;
  infos: boolean;
  blocks: BassBlock[];
  /** les quatre temps de l'ampli montres (ATTACK, AMP DECAY, SUSTAIN, RELEASE, 0 a 1) : le dessin ADSR */
  env: readonly [number, number, number, number];
  /** la longueur de la note montree, en part du pas (LENGTH ou le style) : le grand dessin d'ENV la marque */
  envGate: number;
  strip: { cells: BassStripCell[]; play: number; sel: number; lock: number; flash: boolean };
  line: string;
  lineHot: boolean;
  /** a droite de la ligne du bas, discret */
  aside: string;
  /** la bulle d'un encodeur de la face, null : aucune */
  pop: BassPop | null;
}

const DRAW: Partial<Record<BassKnobId, BlockDraw>> = {
  // Le moteur MONARK (2026-10-09)
  o2wave: 'osc',
  o3wave: 'osc',
  o2range: 'feet',
  o3range: 'feet',
  o2semi: 'center',
  o3semi: 'center',
  o2fine: 'center',
  o3fine: 'center',
  o1lvl: 'level',
  o2lvl: 'level',
  o3lvl: 'level',
  noise: 'noise',
  feedback: 'loop',
  drift: 'drift',
  fmode: 'mode',
  fpol: 'pol',
  fattack: 'fadsr',
  fsustain: 'fadsr',
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
const SEG: Partial<Record<BassKnobId, number>> = { attack: 0, adecay: 1, sustain: 2, release: 3, fattack: 0, fsustain: 2 };

/** Le dessin d'un reglage ; sur CONTOUR, DECAY est le segment du contour du filtre. */
export const blockDrawOf = (id: BassKnobId, screen?: BassScreenId): BlockDraw => (screen === 'contour' && id === 'decay' ? 'fadsr' : DRAW[id] ?? (bassKnob(id).steps ? 'notch' : 'bar'));
const segOf = (id: BassKnobId, screen?: BassScreenId): number => (screen === 'contour' && id === 'decay' ? 1 : SEG[id] ?? -1);

const two = (i: number): string => String(i + 1).padStart(2, '0');

/** Les verrous qui sonnent au pas i : ceux que le sequenceur envoie au worklet (state.ts chainLocks, la boucle comprise). */
export const effectiveLocks = (steps: readonly BassStep[], i: number): BassLocks | null => chainLocks(steps, i);

/** Le nombre de pas verrouilles sur des reglages (ceux d'une page : tous ses onglets, 2026-10-09 ; ou d'un onglet). */
function lockCount(steps: readonly BassStep[], ids: readonly (BassKnobId | null)[]): number {
  return steps.filter((s) => s.locks && ids.some((id) => id !== null && isLockable(id) && s.locks?.[id] !== undefined)).length;
}
const pageLockCount = (steps: readonly BassStep[], page: BassPageId): number => lockCount(steps, pageIds(page));

/** La note de reference de KEY TRK (bass.worklet.js KT_REF : fa diese 2) : une note qui la joue ne bouge pas avec lui. */
const KT_REF_MIDI = 42;

export interface PageInput {
  steps: readonly BassStep[];
  values: BassValues;
  page: BassPageId;
  /** l'onglet affiche (2026-10-09) ; absent : le premier de la page */
  screen?: BassScreenId;
  sel: number;
  lock: number;
  running: boolean;
  /** le pas qui joue (-1 : rien) */
  playing: number;
  bpm: number;
  pattern: string;
  /** le preset qui sonne tel quel (charge, rien n'a bouge depuis), null : aucun */
  preset?: string | null;
  /** la prise de la ligne (2026-10-09) : ACID 07, ACID 07* (mutee) ; absente : le style seul */
  take?: string;
  message: string | null;
  infos: boolean;
  /** le reglage qu'on vient de tourner (l'echo), null : aucun */
  echo: BassKnobId | null;
  /** la note d'un pas, lisible (F#2) */
  noteName: (s: BassStep) => string;
  /** la hauteur MIDI d'un pas (la bande dessine le contour de la ligne) */
  midiOf: (s: BassStep) => number;
  /** les blocs tenus par un pointeur, rang 0 a 7 (2026-10-09) */
  held?: readonly number[];
  /** le bloc sous la souris (desktop, 2026-10-09), -1 : aucun */
  hover?: number;
  /** l'encodeur de la face qu'on vient de tourner et son reglage (2026-10-09), null : aucun */
  pop?: { k: number; id: BassKnobId } | null;
  /** le telephone : pas d'encodeurs, les gestes rappeles parlent des blocs */
  phone?: boolean;
}

function stepWhat(s: BassStep, name: (s: BassStep) => string): string {
  if (s.kind === 'off') return 'EMPTY';
  if (s.kind === 'tie') return 'TIE';
  return `${name(s)}${s.acc ? ' ACC' : ''}${s.slide ? ' SLD' : ''}`;
}

/** La bande des seize pas : la ligne en contour, les verrous de l'onglet affiche. */
function strip(inp: PageInput, flash: boolean): BassPageModel['strip'] {
  const ids = BASS_SCREEN_SLOTS[inp.screen ?? inp.page];
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
  return { cells, play: inp.running ? inp.playing : -1, sel: inp.sel, lock: inp.lock, flash };
}

/**
 * Pourquoi un reglage ne s'entendrait pas (2026-10-09, l'enquete : des verrous exactement muets avec le patch de depart)
 * ; v : les valeurs montrees (en P-LOCK, celles du pas), step : le pas en P-LOCK (null : toute la ligne).
 */
function silentHint(id: BassKnobId, v: BassValues, inp: PageInput, step: number): string {
  const steps = inp.steps;
  // Le moteur MONARK (2026-10-09) : un oscillateur a 0 ne s'entend pas ; le contour du filtre de l'echelle ne joue pas
  // en MODE 303 (la 303 a son enveloppe, attaque immediate, sans tenue)
  if (/^o2(wave|range|semi|fine)$/.test(id) && v.o2lvl <= 0.001) return 'OSC 2 OFF';
  if (/^o3(wave|range|semi|fine)$/.test(id) && v.o3lvl <= 0.001) return 'OSC 3 OFF';
  if ((id === 'fattack' || id === 'fsustain' || id === 'fpol') && modeName(v.fmode) === '303') return 'LADDER ONLY';
  if (id === 'adecay' && v.sustain >= 0.999) return 'SUSTAIN FULL';
  if (id === 'pw' && v.wave < 0.03) return 'SAW: NO PW';
  if (id === 'accdecay' || id === 'sweep') {
    if (step >= 0) {
      const s = steps[step];
      return s.kind === 'note' && !s.acc ? 'ACCENT STEPS' : '';
    }
    return steps.some((s) => s.kind === 'note' && s.acc) ? '' : 'ACCENT STEPS';
  }
  if (id === 'glide') {
    if (step >= 0) {
      const prev = steps[(step + BASS_STEPS - 1) % BASS_STEPS];
      return steps[step].kind === 'note' && prev.kind !== 'off' && prev.slide ? '' : 'SLIDE STEPS';
    }
    return steps.some((s, i) => s.kind !== 'off' && s.slide && steps[(i + 1) % BASS_STEPS].kind === 'note') ? '' : 'SLIDE STEPS';
  }
  if (id === 'keytrack' && step >= 0) {
    const s = steps[step];
    return s.kind === 'note' && inp.midiOf(s) === KT_REF_MIDI ? 'ROOT NOTE' : '';
  }
  return '';
}

/** La PAGE : l'en-tete, les huit blocs, la bande, la ligne du bas. */
export function bassPageModel(inp: PageInput): BassPageModel {
  const v = inp.values;
  const locking = inp.lock >= 0 && inp.lock < BASS_STEPS;
  const lockStep = locking ? inp.steps[inp.lock] : null;
  const lockVals = lockStep?.locks ?? {};
  // En lecture : les valeurs du pas qui joue (hors P-LOCK, les blocs les montrent ; toujours, la puce P-LOCK)
  const nowLocks = inp.running && inp.playing >= 0 ? effectiveLocks(inp.steps, inp.playing) : null;
  const playLocks = !locking ? nowLocks : null;
  const shownVals: BassValues = locking ? { ...v, ...lockVals } : v;
  const shown = (id: BassKnobId): { v: number; state: BlockState } => {
    if (locking) {
      if (isBassGlobal(id)) return { v: v[id], state: 'global' };
      const lv = isLockable(id) ? lockVals[id] : undefined;
      return lv !== undefined ? { v: lv, state: 'lockOn' } : { v: v[id], state: 'lockOff' };
    }
    const pv = playLocks && isLockable(id) ? playLocks[id] : undefined;
    return pv !== undefined ? { v: pv, state: 'flash' } : { v: v[id], state: 'live' };
  };
  const screen: BassScreenId = inp.screen ?? PAGE_TABS[inp.page][0];
  const blocks = BASS_SCREEN_SLOTS[screen].map((id, k): BassBlock => {
    const letter = ENC_LETTERS[k];
    if (id === null) return { k, letter, id: null, label: '', big: '', unit: '', v: 0, state: 'empty', echo: false, held: false, hover: false, mark: false, global: false, hint: '', draw: 'bar', notches: 0, notch: 0, seg: -1 };
    const def = bassKnob(id);
    const s = shown(id);
    const notches = def.steps ?? 0;
    const global = isBassGlobal(id);
    return {
      k,
      letter,
      id,
      label: def.label,
      big: bassBig(id, s.v),
      // Un reglage GLOBAL garde sa vraie unite (la revue du 2026-10-09 : GLOBAL s'ecrivait deux fois, l'etiquette suffit)
      unit: bassUnit(id, s.v, inp.bpm),
      v: s.v,
      state: s.state,
      echo: inp.echo === id,
      held: !!inp.held?.includes(k),
      hover: inp.hover === k,
      mark: s.state === 'lockOn' || s.state === 'flash',
      global,
      hint: global ? '' : silentHint(id, shownVals, inp, locking ? inp.lock : -1),
      draw: blockDrawOf(id, screen),
      notches,
      notch: notches ? stepOf(id, s.v) : 0,
      seg: segOf(id, screen),
    };
  });
  // L'enveloppe dessinee : celle du pas en LOCK, ou du pas qui joue
  const envOf = (id: 'attack' | 'adecay' | 'sustain' | 'release'): number => (locking ? lockVals[id] ?? v[id] : playLocks?.[id] ?? v[id]);
  const lenOf = locking ? lockVals.length ?? v.length : playLocks?.length ?? v.length;
  const pct = lengthPct(lenOf);
  const envGate = pct === null ? STYLE_GATE[BASS_STYLES[stepOf('style', v.style)]] : pct / 100;
  const n = Object.keys(lockStep?.locks ?? {}).length;
  const lock = locking && lockStep ? { step: inp.lock, what: stepWhat(lockStep, inp.noteName), n } : null;
  const sel = inp.steps[inp.sel];
  const lockedSteps = inp.steps.filter((s) => s.locks).length;
  // Au telephone, un bloc tenu (2026-10-09, la revue : le doigt cache le nombre qu'il regle) : la ligne du bas le
  // repete tant que le doigt est la, en LOCK avec son pas
  const hb = inp.phone ? blocks.find((b) => b.held && b.id) : undefined;
  let line: string;
  let aside = '';
  if (hb) line = heldLine(hb, lock?.step ?? -1);
  else if (inp.message) line = inp.message;
  // La ligne du P-LOCK dit aussi comment sortir (2026-10-09, la revue : seule la carte INFOS du LOCK le disait)
  // (la revue : CLEAR: ALL se lisait "efface la ligne", ESC: EXIT "sors de la machine")
  else if (lock) line = inp.phone ? `DRAG A VALUE: STEP ${two(lock.step)} ONLY  2X: UNLOCK  TAP P-LOCK: EXIT` : `DRAG A VALUE: STEP ${two(lock.step)} ONLY  2X: UNLOCK  CLEAR: ITS P-LOCKS  ESC: P-LOCK OFF`;
  else line = sel ? `STEP ${two(inp.sel)}  ${stepWhat(sel, inp.noteName)}` : '';
  // Le geste, a droite de la ligne tant qu'on n'est pas en P-LOCK (2026-10-09, l'etape 2 : une tape sur un pas, puis
  // glisser une valeur de l'ecran ; au desktop, les encodeurs de la face sont les FX globaux)
  if (!lock) aside = inp.phone ? 'TAP A STEP: P-LOCK  DRAG A VALUE' : 'TAP A STEP: P-LOCK  DRAG A VALUE  KNOBS = GLOBAL FX';
  const pop = inp.pop ? popOf(inp.pop.k, inp.pop.id, v, inp.bpm) : null;
  // Le contour du filtre montre (2026-10-09) : celui du pas en P-LOCK, ou du pas qui joue
  const fOf = (id: 'fattack' | 'decay' | 'fsustain' | 'release' | 'envmod' | 'fpol'): number => (locking ? lockVals[id] ?? v[id] : playLocks?.[id] ?? v[id]);
  const mode = modeName(v.fmode);
  const tabIds = PAGE_TABS[inp.page];
  return {
    page: inp.page,
    screen,
    pages: BASS_PAGES.map((p) => ({ id: p.id, label: p.label, locks: pageLockCount(inp.steps, p.id) })),
    // Les puces : en P-LOCK, les verrous du pas sur chaque onglet (ou chercher ce qui est verrouille) ; sinon, comme les
    // touches de page, les pas qui ont des verrous sur cet onglet
    tabs:
      tabIds.length > 1
        ? tabIds.map((t) => ({
            id: t,
            label: SCREEN_LABEL[t],
            locks: locking ? new Set(BASS_SCREEN_SLOTS[t].filter((id): id is BassKnobId => id !== null && isLockable(id) && lockVals[id] !== undefined)).size : lockCount(inp.steps, BASS_SCREEN_SLOTS[t]),
          }))
        : [],
    mode,
    contour: { a: fOf('fattack'), d: fOf('decay'), s: fOf('fsustain'), r: fOf('release'), neg: mode !== '303' && fOf('fpol') >= 0.5, oct: envOct(fOf('envmod')), tb: mode === '303' },
    title: screenTitle(screen),
    running: inp.running,
    bpm: inp.bpm,
    pattern: inp.pattern,
    // La prise (2026-10-09) : ACID 07  A01 ; le preset charge le nomme tant que rien n'a bouge
    style: inp.preset ? inp.preset.toUpperCase() : inp.take ?? BASS_STYLES[stepOf('style', v.style)],
    key: `${BASS_ROOTS[stepOf('root', v.root)]} ${BASS_SCALES[stepOf('scale', v.scale)]}`,
    lock,
    count: lock ? (n ? `${n} P-LOCK${n > 1 ? 'S' : ''}` : 'NO P-LOCK YET') : lockedSteps ? `P-LOCKS ON ${lockedSteps} STEP${lockedSteps > 1 ? 'S' : ''}` : '',
    chip: !!nowLocks,
    infos: inp.infos,
    blocks,
    env: [envOf('attack'), envOf('adecay'), envOf('sustain'), envOf('release')],
    envGate,
    strip: strip(inp, !!nowLocks),
    line,
    lineHot: !!hb || !!inp.message || !!lock,
    aside,
    pop,
  };
}

/** La longueur d'une note en AUTO selon le style (seq.ts GATE, recopiee : pageView reste sans etat ni audio). */
const STYLE_GATE: Readonly<Record<(typeof BASS_STYLES)[number], number>> = {
  ACID: 0.52,
  'DARK DISCO': 0.45,
  'INDIE DANCE': 0.45,
  MINIMAL: 0.32,
  'PSY PROG': 0.38,
  TECHNO: 0.42,
  HOUSE: 0.62,
  ELECTRO: 0.42,
  EBM: 0.36,
  ITALO: 0.4,
  SUB: 0.92,
};

/** La bulle d'un encodeur : le reglage global (jamais un verrou). */
function popOf(k: number, id: BassKnobId, v: BassValues, bpm: number): BassPop {
  const def = bassKnob(id);
  const notches = def.steps ?? 0;
  return { k, letter: ENC_LETTERS[k] ?? '', id, label: def.label, big: bassBig(id, v[id]), unit: bassUnit(id, v[id], bpm), v: v[id], draw: blockDrawOf(id), notches, notch: notches ? stepOf(id, v[id]) : 0 };
}

/** La page et l'onglet d'un ecran (les puces du telephone). */
export const screenPageOf = (s: BassScreenId): BassPageId => SCREEN_PAGE[s];

/** La ligne d'un bloc tenu (2026-10-09) : son nom, son nombre et son unite ; en LOCK, le pas d'abord. */
function heldLine(b: BassBlock, lock: number): string {
  if (b.state === 'global') return `${b.label} IS GLOBAL  EXIT P-LOCK TO SET IT`;
  const unit = b.unit && b.unit !== b.big ? `  ${b.unit}` : '';
  return `${lock >= 0 ? `P-LOCK ${two(lock)}  ` : ''}${b.label} ${b.big}${unit}`;
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
  /** la note qu'on glisse au rouleau (2026-10-09) : son pas et son nom ; null : aucune */
  drag: { step: number; name: string; lo?: number; hi?: number } | null;
  /** le pas du rouleau sous la souris (desktop), -1 : aucun */
  hover: number;
}

export interface EditInput {
  steps: readonly BassStep[];
  values: BassValues;
  page: BassPageId;
  /** l'onglet affiche (2026-10-09) : ses verrous font les pistes */
  screen?: BassScreenId;
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
  /** la note glissee au rouleau, null : aucune */
  drag?: { step: number; name: string; lo?: number; hi?: number } | null;
  hover?: number;
  phone?: boolean;
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
  const screen = inp.screen ?? PAGE_TABS[inp.page][0];
  const ids = BASS_SCREEN_SLOTS[screen].filter((id): id is BassKnobId => id !== null && isLockable(id));
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
  const drag = inp.drag ?? null;
  // Le rouleau se glisse (2026-10-09) : la ligne du bas dit le geste, pendant le glisser la note qui sonne
  const how = inp.phone ? 'DRAG A NOTE: PITCH  TAP: ADD, TIE, OFF' : 'DRAG A NOTE UP OR DOWN: PITCH  CLICK: ADD, TIE, OFF  STEP KEYS: PATTERNS';
  return {
    running: inp.running,
    bpm: inp.bpm,
    page: inp.page,
    pageLabel: PAGE_TABS[inp.page].length > 1 ? `${bassPageDef(inp.page).label} ${SCREEN_LABEL[screen]}` : bassPageDef(inp.page).label,
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
    line: drag ? `STEP ${two(drag.step)}  ${drag.name}` : inp.message ?? how,
    lineHot: !!inp.message || !!drag,
    drag,
    hover: inp.hover ?? -1,
  };
}
