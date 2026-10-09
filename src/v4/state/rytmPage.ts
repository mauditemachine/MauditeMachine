/**
 * La page du MM-RYTM a l'ecran (2026-10-08, la refonte facon Digitakt,
 * Mika : "8 encodeurs assignables a condition de presser les bonnes
 * touches ; l'ecran divise en 8 blocs"). Deux vues :
 * - PAGE, les huit blocs de la page (rytm/pages.ts), PAR DEFAUT et tout le
 *   temps depuis le 2026-10-08 (Mika : "RYTM : je ne vois AUCUN changement
 *   de ce que j'ai demande ! inadmissible !" : la vue PAGE n'etait qu'un coup
 *   d'oeil de 4 s apres un potard, on ne la voyait jamais) ;
 * - HOME, l'ecran d'avant (l'anneau, les trois cartes) : la touche de la
 *   page allumee pressee encore, ou H ; une touche de page (ou H encore)
 *   ramene PAGE.
 * Les touches de page (la face, le Dock, le MIDI) et [ et ] changent de
 * page. echo : le bloc qu'on vient de tourner, cerne POT_UI.readoutMs (sur
 * la page affichee seulement, rytm/pages.ts FOLLOW_TOUCH). sel : le dernier
 * pas touche (-1 aucun), dont TRIG montre la velocite. Retenus sous
 * mm.v4.rytm.page.2 : la page et la vue (la cle .1 de l'etape d'avant
 * retenait HOME par defaut : elle est ignoree, tout le monde arrive en PAGE).
 */

import { DEFAULT_PAGE, FOLLOW_TOUCH, isRytmPage, pageStep, slotOf, type RytmPageId, type SlotTarget } from '../rytm/pages';
import { POT_UI, type Inst } from '../theme';

export type RytmView = 'home' | 'page';

/** Le bloc tourne (l'echo) : sa page, son rang, la fin de son contour. */
export interface RytmEcho {
  page: RytmPageId;
  k: number;
  until: number;
}

export interface RytmPageState {
  readonly page: RytmPageId;
  readonly view: RytmView;
  readonly echo: RytmEcho | null;
  /** le dernier pas touche, -1 a 15 */
  readonly sel: number;
  /**
   * le bloc tenu au doigt (0 a 7, -1 aucun) : au telephone les blocs sont
   * les potards de page (2026-10-09), il reste cerne tant qu'on le tient,
   * meme immobile (l'echo s'eteint POT_UI.readoutMs apres le dernier cran)
   */
  readonly held: number;
}

const KEY = 'mm.v4.rytm.page.2';
const SAVE_MS = 300;

const DEFAULT: RytmPageState = { page: DEFAULT_PAGE, view: 'page', echo: null, sel: -1, held: -1 };

function load(): RytmPageState {
  const out = { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return out;
    const o = JSON.parse(raw) as { v?: unknown; page?: unknown; view?: unknown };
    if (o.v !== 2) return out;
    // Une page qui n'existe plus (LFO, avant SMPL) : la page de depart
    if (isRytmPage(o.page)) out.page = o.page;
    if (o.view === 'page' || o.view === 'home') out.view = o.view;
  } catch {
    /* rien de retenu, ou illisible : la page de depart, en PAGE */
  }
  return out;
}

let state: RytmPageState = typeof window === 'undefined' ? { ...DEFAULT } : load();
const listeners = new Set<() => void>();
let saveTimer = 0;

function write(): void {
  saveTimer = 0;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 2, page: state.page, view: state.view }));
  } catch {
    /* stockage plein ou refuse : la page vit pour la visite */
  }
}

function save(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(write, SAVE_MS);
}

// La page quittee avant la fin du delai (un rechargement juste apres une touche) : ecrite tout de suite
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    if (saveTimer === 0) return;
    window.clearTimeout(saveTimer);
    write();
  });

function set(next: Partial<RytmPageState>): void {
  const prev = state;
  state = { ...state, ...next };
  if (state.page !== prev.page || state.view !== prev.view) save();
  listeners.forEach((fn) => fn());
}

export const rytmPage = {
  get: (): RytmPageState => state,
  /** Une page (touche de page, Dock, MIDI) : elle s'affiche, en vue PAGE. */
  setPage(p: RytmPageId): void {
    if (p === state.page && state.view === 'page') return;
    set({ page: p, view: 'page', echo: null });
  },
  /**
   * Une touche de page pressee : une autre page s'affiche ; la page deja
   * allumee pressee encore bascule HOME (et HOME, PAGE). Rend la vue.
   */
  press(p: RytmPageId): RytmView {
    if (p === state.page) set({ view: state.view === 'page' ? 'home' : 'page' });
    else set({ page: p, view: 'page', echo: null });
    return state.view;
  },
  /** [ et ] : la page d'a cote, en vue PAGE. */
  step(dir: -1 | 1): void {
    set({ page: pageStep(state.page, dir), view: 'page', echo: null });
  },
  /** H : HOME, ou PAGE. */
  toggleView(): void {
    set({ view: state.view === 'page' ? 'home' : 'page' });
  },
  /** Une vue (rytm:home sous EDIT : HOME une fois EDIT referme). */
  setView(v: RytmView): void {
    if (v !== state.view) set({ view: v });
  },
  /**
   * Un reglage touche (un potard, un TWEAK, la velocite d'un pas) : son
   * bloc s'entoure un instant (l'echo) s'il est sur la page affichee ; la
   * page ne bouge pas (FOLLOW_TOUCH). Rien pour un reglage qui n'est sur
   * aucune page (MASTER, TEMPO).
   */
  touch(t: SlotTarget, inst: Inst | null, now: number = performance.now()): void {
    const at = slotOf(t, inst, state.page);
    if (!at) return;
    if (!FOLLOW_TOUCH && at.page !== state.page) return;
    set({ page: at.page, echo: { page: at.page, k: at.k, until: now + POT_UI.readoutMs } });
  },
  /** L'echo direct d'un potard de page (k, 0 a 7) sur la page affichee. */
  echo(k: number, now: number = performance.now()): void {
    set({ echo: { page: state.page, k, until: now + POT_UI.readoutMs } });
  },
  /** Un bloc pris au doigt (le telephone, 2026-10-09) : cerne jusqu'a release(). */
  hold(k: number): void {
    const held = Math.max(-1, Math.min(7, Math.round(k)));
    if (held !== state.held) set({ held });
  },
  /** Le bloc lache : plus cerne (sauf l'echo de son dernier cran, qui s'eteint a son heure). */
  release(): void {
    if (state.held !== -1) set({ held: -1 });
  },
  /** Le dernier pas touche (-1 : aucun). */
  select(i: number): void {
    const sel = Math.max(-1, Math.min(15, Math.round(i)));
    if (sel !== state.sel) set({ sel });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
