/**
 * L'etat de l'ecran OLED (spec 5.5 et 20.3.8) : trois lignes de 20
 * colonnes, composees au plus 4 fois par seconde et publiees seulement
 * quand leur texte change. Le maillage de l'ecran (CanvasTexture) et son
 * jumeau accessible lisent cet etat ; il ne dessine rien lui-meme.
 *
 * Ligne 1 : la section ouverte (ou MM-808) a gauche, le tempo a droite.
 * Ligne 2, la premiere regle qui s'applique :
 *   piste sautee (SKIPPED titre) > chargement (LOADING)
 *   > piste en lecture (le titre, qui defile d'une colonne par quart de
 *   seconde quand il ne tient pas dans les 20 colonnes, 2026-10-01)
 *   > sequenceur en marche (RUN et l'instrument) > piste en pause (titre,
 *   PAUSED) > READY et l'instrument.
 * Ligne 3 : le message passager (STEP 07 BD HIGH, CLEARED, TAP A PAD
 * FIRST, NO SIGNAL) ou la valeur de l'encodeur tourne dans les 1200 ms ;
 * sinon, une piste en lecture ou en pause : sa position, une barre de
 * progression (bar, 0 a 1 ; cliquable sur l'ecran) et sa duree.
 * Page MIX (2026-10-01, state/lcdMix.ts) : le VOLUME d'une voix qu'on
 * tourne affiche un instant les cinq volumes en potards dessines ; les
 * trois lignes de texte (le jumeau) les donnent en clair : VOLUME BD, puis
 * BD80 SD80 TOM80 et CH80 OH80.
 * RUN passe avant une piste en pause (section 19) : la machine qui joue
 * est l'information du moment. Le minuteur ne tourne que pendant la
 * lecture d'une piste (timecode) ou un message passager ; au repos, rien.
 */

import { clock } from '../audio/clock';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import { voiceFx } from '../audio/voicefx';
import { sc } from '../audio/soundcloud';
import { fmtTime } from '../data';
import { LCD_TEXT, SECTION_TITLES, type Inst } from '../theme';
import { lcdMessage } from './lcdMessage';
import { lcdMix } from './lcdMix';
import { section } from './section';

export interface LcdState {
  /** ligne 1 : gauche, droite */
  l1: string;
  r1: string;
  /** ligne 2 : gauche, droite (droite vide sauf timecode ou PAUSED) */
  l2: string;
  r2: string;
  /** ligne 3 : message passager ou valeur d'encodeur ; avec bar : la position (gauche) */
  l3: string;
  /** ligne 3 avec bar : la duree (droite) */
  r3: string;
  /** barre de progression de la piste courante (0 a 1), null sans piste ou sous un message */
  bar: number | null;
  /** la ligne 3 est une valeur d'encodeur (le jumeau ne l'annonce pas) */
  param: boolean;
  /** page MIX : la voix reglee et les cinq volumes (0 a 1, ordre BD SD TOM CH OH) ; null : le texte */
  mix: { sel: Inst; insts: Inst[]; levels: number[] } | null;
  /** les trois lignes telles qu'affichees (gauche, espaces, droite) */
  text: [string, string, string];
  /** compositions publiees (revue) */
  updates: number;
}

const COLS = LCD_TEXT.cols;
/** Ecart entre la fin du titre et sa reprise, dans le defilement. */
const MARQUEE_GAP = '   ';

/** Le titre qui ne tient pas defile d'une colonne par quart de seconde depuis t0 ; sinon tel quel. */
function marquee(text: string, now: number, t0: number): string {
  if (text.length <= COLS) return text;
  const loop = text + MARQUEE_GAP;
  const k = Math.floor((now - t0) / LCD_TEXT.tickMs) % loop.length;
  return (loop + loop).slice(k, k + COLS);
}

/** Debut du defilement : la piste courante (il repart de la premiere lettre a chaque piste). */
let marqueeId: string | null = null;
let marqueeT0 = 0;

/** Coupe a n colonnes, un point final quand ca deborde. */
function fit(s: string, n: number): string {
  if (n <= 0) return '';
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}.`;
}

/** Gauche et droite sur 20 colonnes ; la gauche cede la place a la droite. */
function row(left: string, right: string): { l: string; r: string; t: string } {
  const r = fit(right, COLS);
  const l = fit(left, r ? COLS - r.length - 1 : COLS);
  const gap = r ? Math.max(1, COLS - l.length - r.length) : 0;
  return { l, r, t: r ? `${l}${' '.repeat(gap)}${r}` : l };
}

const pct = (v: number): number => Math.round(v * 100);

/**
 * Page MIX : les cinq volumes de la rangee de la voix reglee (BD a OH, ou
 * CP a CB depuis le 2026-10-03), et leur texte pour le jumeau.
 */
function composeMix(sel: Inst): Omit<LcdState, 'updates'> {
  const bank = Math.floor(Math.max(0, INSTRUMENTS.indexOf(sel)) / 5);
  const insts = INSTRUMENTS.slice(bank * 5, bank * 5 + 5);
  const levels = insts.map((i) => voiceFx.of(i).level);
  const cell = (k: number): string => `${insts[k]}${pct(levels[k])}`;
  const line1 = row('VOLUME', sel);
  const t2 = [0, 1, 2].map(cell).join(' ');
  const t3 = [3, 4].map(cell).join(' ');
  return { l1: line1.l, r1: line1.r, l2: t2, r2: '', l3: t3, r3: '', bar: null, param: true, mix: { sel, insts, levels }, text: [line1.t, t2, t3] };
}

function compose(now: number): Omit<LcdState, 'updates'> {
  const mixPage = lcdMix.get(now);
  if (mixPage) return composeMix(mixPage.sel);
  const s = section.get();
  const p = pattern.get();
  const line1 = row(s ? SECTION_TITLES[s] : LCD_TEXT.idle, `${p.bpm} BPM`);
  const inst = p.instrument ? `  ${p.instrument}` : '';
  const st = sc.get();
  const msg = lcdMessage.get(now);
  let l2 = '';
  let r2 = '';
  if (st.notice) l2 = `${LCD_TEXT.skipped} ${st.notice.toUpperCase()}`;
  else if (st.status === 'loading') l2 = LCD_TEXT.loading;
  else if (st.status === 'playing') {
    if (st.id !== marqueeId) {
      marqueeId = st.id;
      marqueeT0 = now;
    }
    l2 = marquee((st.title ?? '').toUpperCase(), now, marqueeT0);
  } else if (clock.running) l2 = `${LCD_TEXT.run}${inst}`;
  else if (st.status === 'paused') {
    l2 = (st.title ?? '').toUpperCase();
    r2 = LCD_TEXT.paused;
  } else l2 = `${LCD_TEXT.ready}${inst}`;
  // Le titre qui defile occupe toute la ligne (row le couperait d'un point)
  const line2 = st.status === 'playing' && !st.notice ? { l: l2, r: '', t: l2 } : row(l2, r2);
  // Ligne 3 : le message, sinon la piste courante (position, barre, duree)
  let l3 = '';
  let r3 = '';
  let bar: number | null = null;
  if (msg) l3 = fit(msg.text, COLS);
  else if ((st.status === 'playing' || st.status === 'paused') && st.duration > 0) {
    l3 = fmtTime(sc.position());
    r3 = fmtTime(st.duration);
    bar = sc.progress();
  }
  const t3 = bar !== null ? `${l3} ${r3}` : l3;
  return { l1: line1.l, r1: line1.r, l2: line2.l, r2: line2.r, l3, r3, bar, param: !!msg && msg.param, mix: null, text: [line1.t, line2.t, t3] };
}

let current: LcdState = {
  l1: LCD_TEXT.idle,
  r1: '',
  l2: LCD_TEXT.ready,
  r2: '',
  l3: '',
  r3: '',
  bar: null,
  param: false,
  mix: null,
  text: [LCD_TEXT.idle, LCD_TEXT.ready, ''],
  updates: 0,
};
const listeners = new Set<() => void>();
let timer = 0;
let last = -Infinity;
let running = false;
let unsubs: (() => void)[] = [];

/** Encore quelque chose qui bouge sans evenement : un timecode, un message a eteindre. */
const live = (now: number): boolean => sc.get().status === 'playing' || lcdMessage.get(now) !== null || lcdMix.get(now) !== null;

function run(): void {
  timer = 0;
  if (!running) return;
  const now = performance.now();
  last = now;
  const next = compose(now);
  // La barre compte au 1/200 pres : elle avance meme quand le temps affiche ne change pas
  const barKey = (b: number | null): number => (b === null ? -1 : Math.round(b * 200));
  if (
    next.text[0] !== current.text[0] ||
    next.text[1] !== current.text[1] ||
    next.text[2] !== current.text[2] ||
    barKey(next.bar) !== barKey(current.bar)
  ) {
    current = { ...next, updates: current.updates + 1 };
    listeners.forEach((fn) => fn());
  }
  if (live(now)) timer = window.setTimeout(run, LCD_TEXT.tickMs);
}

/** Un changement : composition tout de suite, ou au prochain quart de seconde. */
function request(): void {
  if (!running) return;
  const wait = last + LCD_TEXT.tickMs - performance.now();
  if (wait <= 0) {
    if (timer !== 0) window.clearTimeout(timer);
    run();
  } else if (timer === 0) {
    timer = window.setTimeout(run, wait);
  }
}

export const lcd = {
  get: (): LcdState => current,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Montage de /v4 : ecoute les stores et compose. */
  start(): void {
    if (running) return;
    running = true;
    unsubs = [
      section.subscribe(request),
      pattern.subscribe(request),
      clock.subscribe(request),
      sc.subscribe(request),
      lcdMessage.subscribe(request),
      lcdMix.subscribe(request),
      voiceFx.subscribe(request),
    ];
    last = -Infinity;
    request();
  },
  stop(): void {
    running = false;
    unsubs.forEach((u) => u());
    unsubs = [];
    if (timer !== 0) window.clearTimeout(timer);
    timer = 0;
  },
};
