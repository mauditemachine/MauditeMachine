/**
 * La page du MM-RYTM a l'ecran (2026-10-08, la refonte facon Digitakt,
 * Mika : "8 encodeurs assignables a condition de presser les bonnes
 * touches ; l'ecran divise en 8 blocs"). Deux vues :
 * - PAGE, les blocs de la page (rytm/pages.ts), PAR DEFAUT et tout le
 *   temps depuis le 2026-10-08 (Mika : "RYTM : je ne vois AUCUN changement
 *   de ce que j'ai demande ! inadmissible !") ;
 * - HOME, l'ecran d'avant (l'anneau, les trois cartes) : H, ou la touche
 *   d'une page sans onglet (FLTR, ENV) pressee encore ; une touche de page
 *   (ou H encore) ramene PAGE.
 * Les touches de page (la face, le Dock, le MIDI) et [ et ] changent de
 * page. echo : le bloc qu'on vient de tourner, cerne POT_UI.readoutMs (sur
 * l'ecran affiche seulement, rytm/pages.ts FOLLOW_TOUCH). sel : le dernier
 * pas touche (-1 aucun).
 *
 * L'etape 2 (2026-10-09, quatre pages VOICE FLTR ENV FX, rytm/pages.ts) :
 * - tabs : l'onglet de chaque page (VOICE : MAIN ou SYNTH ; FX : VOICE ou
 *   GLOBAL), retenu ; la touche de la page allumee pressee encore passe a
 *   l'onglet suivant (comme les sous-pages d'une Digitakt II), une tape sur
 *   un onglet de l'en-tete de l'ecran aussi ;
 * - hover : le bloc sous la souris (desktop : un cadre a peine, l'ecran est
 *   l'editeur) ;
 * - popup : le FX global qu'un encodeur du desktop vient de tourner (son nom,
 *   sa valeur, un instant, sans changer de page) ;
 * - vel : la velocite des nouveaux pas de chaque voix (VEL de VOICE hors
 *   P-LOCK, la velocite par defaut d'une Elektron ; le pad la joue aussi).
 * Retenus sous mm.v4.rytm.page.3 : la page, ses onglets, la vue, les
 * velocites ; la cle .2 d'avant (TRIG SRC SMPL FLTR AMP FX) se lit encore : une
 * page qui n'existe plus ouvre la sienne d'aujourd'hui (TRIG, SRC, SMPL :
 * VOICE ; AMP : ENV, rytm/pages.ts PAGE_ALIAS), jamais un plantage.
 */

import { DEFAULT_PAGE, FOLLOW_TOUCH, PAGE_TABS, RYTM_PAGES, isRytmPage, pageOfAlias, pageStep, screenOf, screensOf, slotOf, type RytmPageId, type RytmScreenId, type SlotTarget } from '../rytm/pages';
import { POT_UI, type EncId, type Inst } from '../theme';

export type RytmView = 'home' | 'page';

/** Le bloc tourne (l'echo) : son ecran, son rang, la fin de son contour. */
export interface RytmEcho {
  page: RytmScreenId;
  k: number;
  until: number;
}

/** Le FX global qu'un encodeur du desktop vient de tourner (2026-10-09) : lequel, jusqu'a quand. */
export interface RytmPopup {
  id: EncId;
  until: number;
}

const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
/** La velocite d'un nouveau pas au depart : HIGH (9), celle d'avant. */
export const TAP_VEL_DEFAULT = 9;

export interface RytmPageState {
  readonly page: RytmPageId;
  /** l'onglet retenu de chaque page (0 : le premier) */
  readonly tabs: Readonly<Record<RytmPageId, number>>;
  readonly view: RytmView;
  readonly echo: RytmEcho | null;
  /** le dernier pas touche, -1 a 15 */
  readonly sel: number;
  /**
   * le bloc tenu au doigt ou a la souris (-1 aucun) : il reste cerne tant
   * qu'on le tient, meme immobile (l'echo s'eteint POT_UI.readoutMs apres le
   * dernier cran)
   */
  readonly held: number;
  /** le bloc sous la souris (desktop, 2026-10-09), -1 aucun */
  readonly hover: number;
  readonly popup: RytmPopup | null;
  /** la velocite des nouveaux pas de chaque voix (1 a 9) */
  readonly vel: Readonly<Record<Inst, number>>;
}

const KEY = 'mm.v4.rytm.page.3';
const OLD_KEY = 'mm.v4.rytm.page.2';
const SAVE_MS = 300;
/** Le popup d'un encodeur reste un peu plus que l'echo d'un bloc (Mika lit la valeur, puis regarde la page). */
export const POPUP_MS = 1100;

const zeroTabs = (): Record<RytmPageId, number> => Object.fromEntries(RYTM_PAGES.map((p) => [p.id, 0])) as Record<RytmPageId, number>;
const fullVel = (): Record<Inst, number> => Object.fromEntries(INSTS.map((i) => [i, TAP_VEL_DEFAULT])) as Record<Inst, number>;

const DEFAULT: RytmPageState = { page: DEFAULT_PAGE, tabs: zeroTabs(), view: 'page', echo: null, sel: -1, held: -1, hover: -1, popup: null, vel: fullVel() };

function load(): RytmPageState {
  const out = { ...DEFAULT, tabs: zeroTabs(), vel: fullVel() };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as { v?: unknown; page?: unknown; view?: unknown; tabs?: unknown; vel?: unknown };
      if (o.v !== 3) return out;
      const p = pageOfAlias(o.page);
      if (p) out.page = p;
      if (o.view === 'page' || o.view === 'home') out.view = o.view;
      if (o.tabs && typeof o.tabs === 'object') {
        for (const pg of RYTM_PAGES) {
          const t = (o.tabs as Record<string, unknown>)[pg.id];
          if (typeof t === 'number' && Number.isInteger(t) && t >= 0 && t < PAGE_TABS[pg.id].length) out.tabs[pg.id] = t;
        }
      }
      if (o.vel && typeof o.vel === 'object') {
        for (const i of INSTS) {
          const v = (o.vel as Record<string, unknown>)[i];
          if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 9) out.vel[i] = v;
        }
      }
      return out;
    }
    // La cle d'avant l'etape 2 (TRIG SRC SMPL FLTR AMP FX) : sa page d'aujourd'hui (TRIG, SRC, SMPL : VOICE ; AMP : ENV)
    const old = window.localStorage.getItem(OLD_KEY);
    if (!old) return out;
    const o = JSON.parse(old) as { v?: unknown; page?: unknown; view?: unknown };
    if (o.v !== 2) return out;
    const p = pageOfAlias(o.page);
    if (p) out.page = p;
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
    window.localStorage.setItem(KEY, JSON.stringify({ v: 3, page: state.page, view: state.view, tabs: state.tabs, vel: state.vel }));
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
  if (state.page !== prev.page || state.view !== prev.view || state.tabs !== prev.tabs || state.vel !== prev.vel) save();
  listeners.forEach((fn) => fn());
}

export const rytmPage = {
  get: (): RytmPageState => state,
  /** L'ecran affiche pour cette voix (la page et son onglet ; un onglet absent pour elle : le premier). */
  screen(inst: Inst | null): RytmScreenId {
    return screenOf(state.page, state.tabs[state.page] ?? 0, inst);
  },
  /** Une page (touche de page, Dock, MIDI) : elle s'affiche, en vue PAGE, sur son onglet retenu. */
  setPage(p: RytmPageId): void {
    if (p === state.page && state.view === 'page') return;
    set({ page: p, view: 'page', echo: null });
  },
  /** Un onglet d'une page (une tape sur l'en-tete de l'ecran, le MIDI) : la page s'affiche sur lui. */
  setTab(p: RytmPageId, tab: number, inst: Inst | null): void {
    const n = screensOf(p, inst).length;
    const t = Math.max(0, Math.min(n - 1, Math.round(tab)));
    if (p === state.page && state.view === 'page' && (state.tabs[p] ?? 0) === t) return;
    set({ page: p, view: 'page', echo: null, tabs: { ...state.tabs, [p]: t } });
  },
  /**
   * Une touche de page pressee : une autre page s'affiche ; la page deja
   * allumee pressee encore passe a son onglet suivant (VOICE : MAIN, SYNTH ;
   * FX : VOICE, GLOBAL) ; une page sans onglet pour cette voix bascule HOME (et
   * HOME, PAGE). Rend la vue et l'onglet.
   */
  press(p: RytmPageId, inst: Inst | null): { view: RytmView; tab: number; tabs: number } {
    const n = screensOf(p, inst).length;
    if (p !== state.page) set({ page: p, view: 'page', echo: null });
    else if (state.view === 'home') set({ view: 'page' });
    else if (n > 1) set({ echo: null, tabs: { ...state.tabs, [p]: ((Math.min(n - 1, state.tabs[p] ?? 0) + 1) % n) } });
    else set({ view: 'home' });
    return { view: state.view, tab: Math.min(n - 1, state.tabs[p] ?? 0), tabs: n };
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
   * bloc s'entoure un instant (l'echo) s'il est sur l'ecran affiche ; la
   * page ne bouge pas (FOLLOW_TOUCH). Rien pour un reglage qui n'est sur
   * aucun ecran (MASTER, TEMPO).
   */
  touch(t: SlotTarget, inst: Inst | null, now: number = performance.now()): void {
    const cur = rytmPage.screen(inst);
    const at = slotOf(t, inst, cur);
    if (!at) return;
    if (!FOLLOW_TOUCH && at.page !== cur) return;
    set({ echo: { page: at.page, k: at.k, until: now + POT_UI.readoutMs } });
  },
  /** L'echo direct d'un bloc (k) de l'ecran affiche. */
  echo(k: number, inst: Inst | null, now: number = performance.now()): void {
    set({ echo: { page: rytmPage.screen(inst), k, until: now + POT_UI.readoutMs } });
  },
  /** Un bloc pris au doigt ou a la souris : cerne jusqu'a release(). */
  hold(k: number): void {
    const held = Math.max(-1, Math.min(15, Math.round(k)));
    if (held !== state.held) set({ held });
  },
  /** Le bloc lache : plus cerne (sauf l'echo de son dernier cran, qui s'eteint a son heure). */
  release(): void {
    if (state.held !== -1) set({ held: -1 });
  },
  /** Le bloc sous la souris (desktop, 2026-10-09) ; -1 : aucun. */
  hover(k: number): void {
    const h = Math.max(-1, Math.min(15, Math.round(k)));
    if (h !== state.hover) set({ hover: h });
  },
  /** Un encodeur du desktop a tourne (2026-10-09) : son FX global a l'ecran un instant. */
  popup(id: EncId, now: number = performance.now()): void {
    set({ popup: { id, until: now + POPUP_MS } });
  },
  /** Le dernier pas touche (-1 : aucun). */
  select(i: number): void {
    const sel = Math.max(-1, Math.min(15, Math.round(i)));
    if (sel !== state.sel) set({ sel });
  },
  /** La velocite des nouveaux pas d'une voix (1 a 9). */
  tapVel(inst: Inst): number {
    return state.vel[inst] ?? TAP_VEL_DEFAULT;
  },
  setTapVel(inst: Inst, v: number): void {
    const n = Math.max(1, Math.min(9, Math.round(v)));
    if (n === (state.vel[inst] ?? TAP_VEL_DEFAULT)) return;
    set({ vel: { ...state.vel, [inst]: n } });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export { isRytmPage };
