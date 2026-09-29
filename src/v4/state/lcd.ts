/**
 * L'etat de l'ecran (spec 5.5) : deux lignes de 20 colonnes, composees au
 * plus 4 fois par seconde et publiees seulement quand leur texte change.
 * Le maillage de l'ecran (CanvasTexture) et son jumeau accessible lisent
 * cet etat ; il ne dessine rien lui-meme.
 *
 * Ligne 1 : la section ouverte (ou MM-808) a gauche, le tempo a droite.
 * Ligne 2, la premiere regle qui s'applique :
 *   message passager (STEP 07 BD ON, CLEARED, TAP A PAD FIRST, NO SIGNAL)
 *   > piste sautee (SKIPPED titre) > chargement (LOADING)
 *   > piste en lecture (titre a gauche, m:ss a droite)
 *   > sequenceur en marche (RUN et l'instrument) > piste en pause (titre,
 *   PAUSED) > READY et l'instrument.
 * RUN passe avant une piste en pause (ecart a la spec, section 19) : la
 * machine qui joue est l'information du moment.
 * Le minuteur ne tourne que pendant la lecture d'une piste (timecode) ou
 * un message passager ; au repos, rien.
 */

import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import { fmtTime } from '../data';
import { LCD_TEXT, SECTION_TITLES } from '../theme';
import { lcdMessage } from './lcdMessage';
import { section } from './section';

export interface LcdState {
  /** ligne 1 : gauche, droite */
  l1: string;
  r1: string;
  /** ligne 2 : gauche, droite (droite vide sauf timecode ou PAUSED) */
  l2: string;
  r2: string;
  /** les deux lignes telles qu'affichees (gauche, espaces, droite) */
  text: [string, string];
  /** compositions publiees (revue) */
  updates: number;
}

const COLS = LCD_TEXT.cols;

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

function compose(now: number): Omit<LcdState, 'updates'> {
  const s = section.get();
  const p = pattern.get();
  const line1 = row(s ? SECTION_TITLES[s] : LCD_TEXT.idle, `${p.bpm} BPM`);
  const inst = p.instrument ? `  ${p.instrument}` : '';
  const st = sc.get();
  const msg = lcdMessage.get(now);
  let l2 = '';
  let r2 = '';
  if (msg) l2 = msg.text;
  else if (st.notice) l2 = `${LCD_TEXT.skipped} ${st.notice.toUpperCase()}`;
  else if (st.status === 'loading') l2 = LCD_TEXT.loading;
  else if (st.status === 'playing') {
    l2 = (st.title ?? '').toUpperCase();
    r2 = fmtTime(sc.position());
  } else if (clock.running) l2 = `${LCD_TEXT.run}${inst}`;
  else if (st.status === 'paused') {
    l2 = (st.title ?? '').toUpperCase();
    r2 = LCD_TEXT.paused;
  } else l2 = `${LCD_TEXT.ready}${inst}`;
  const line2 = row(l2, r2);
  return { l1: line1.l, r1: line1.r, l2: line2.l, r2: line2.r, text: [line1.t, line2.t] };
}

let current: LcdState = { l1: LCD_TEXT.idle, r1: '', l2: LCD_TEXT.ready, r2: '', text: [LCD_TEXT.idle, LCD_TEXT.ready], updates: 0 };
const listeners = new Set<() => void>();
let timer = 0;
let last = -Infinity;
let running = false;
let unsubs: (() => void)[] = [];

/** Encore quelque chose qui bouge sans evenement : un timecode, un message a eteindre. */
const live = (now: number): boolean => sc.get().status === 'playing' || lcdMessage.get(now) !== null;

function run(): void {
  timer = 0;
  if (!running) return;
  const now = performance.now();
  last = now;
  const next = compose(now);
  if (next.text[0] !== current.text[0] || next.text[1] !== current.text[1]) {
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
