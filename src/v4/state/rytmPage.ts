/**
 * La page du MM-RYTM a l'ecran (2026-10-08, etape 1 de la refonte facon
 * Digitakt, Mika : "8 encodeurs assignables a condition de presser les
 * bonnes touches ; l'ecran divise en 8 blocs ; j'adore l'ecran, je veux le
 * meme ecran mais plus utilise ; allons-y petit a petit"). Deux vues :
 * - HOME, l'ecran d'aujourd'hui (l'anneau, les trois cartes), par defaut ;
 * - PAGE, les huit blocs de la page (rytm/pages.ts). Elle vient en coup
 *   d'oeil quand on touche un potard, un TWEAK ou la velocite d'un pas : la
 *   page du reglage touche, son bloc cerne (l'echo, POT_UI.readoutMs), puis
 *   HOME revient PAGE_PEEK_MS apres le dernier geste. Le clavier l'epingle :
 *   H la garde (H encore : HOME), [ et ] changent de page et l'epinglent.
 * view est un accesseur : 'page' tant qu'elle est epinglee ou pendant le
 * coup d'oeil. sel : le dernier pas touche (-1 aucun), dont TRIG montre la
 * velocite. Retenus sous mm.v4.rytm.page.1 : la page et la vue epinglee
 * seulement (ni le coup d'oeil, ni l'echo, ni le pas).
 */

import { DEFAULT_PAGE, FOLLOW_TOUCH, isRytmPage, pageStep, slotOf, type RytmPageId, type SlotTarget } from '../rytm/pages';
import { POT_UI, type Inst } from '../theme';

export type RytmView = 'home' | 'page';

/** Le coup d'oeil sur la page : il dure ce temps apres le dernier geste. */
export const PAGE_PEEK_MS = 4000;

/** Le bloc tourne (l'echo) : sa page, son rang, la fin de son contour. */
export interface RytmEcho {
  page: RytmPageId;
  k: number;
  until: number;
}

interface Fields {
  page: RytmPageId;
  /** la vue epinglee (H, [ et ]) ; 'home' : seulement le coup d'oeil */
  pin: RytmView;
  /** performance.now() de la fin du coup d'oeil ; 0 : aucun */
  peekUntil: number;
  echo: RytmEcho | null;
  /** le dernier pas touche, -1 a 15 */
  sel: number;
}

export interface RytmPageState extends Readonly<Fields> {
  /** la vue a l'ecran : 'page' epinglee ou pendant le coup d'oeil, sinon 'home' */
  readonly view: RytmView;
}

const KEY = 'mm.v4.rytm.page.1';
const SAVE_MS = 300;

/** Un etat fige ; view se lit a chaque fois (le coup d'oeil s'eteint tout seul). */
function make(f: Fields): RytmPageState {
  return {
    ...f,
    get view(): RytmView {
      return f.pin === 'page' || performance.now() < f.peekUntil ? 'page' : 'home';
    },
  };
}

function load(): Fields {
  const out: Fields = { page: DEFAULT_PAGE, pin: 'home', peekUntil: 0, echo: null, sel: -1 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return out;
    const o = JSON.parse(raw) as { v?: unknown; page?: unknown; view?: unknown };
    if (o.v !== 1) return out;
    if (isRytmPage(o.page)) out.page = o.page;
    if (o.view === 'page' || o.view === 'home') out.pin = o.view;
  } catch {
    /* rien de retenu, ou illisible : la page de depart, HOME */
  }
  return out;
}

let fields: Fields = typeof window === 'undefined' ? { page: DEFAULT_PAGE, pin: 'home', peekUntil: 0, echo: null, sel: -1 } : load();
let state: RytmPageState = make(fields);
const listeners = new Set<() => void>();
let saveTimer = 0;
let peekTimer = 0;

function write(): void {
  saveTimer = 0;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, page: fields.page, view: fields.pin }));
  } catch {
    /* stockage plein ou refuse : la page vit pour la visite */
  }
}

function save(): void {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(write, SAVE_MS);
}

// La page quittee avant la fin du delai (un rechargement juste apres H) : ecrite tout de suite, comme le motif
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    if (saveTimer === 0) return;
    window.clearTimeout(saveTimer);
    write();
  });

function emit(): void {
  state = make(fields);
  listeners.forEach((fn) => fn());
}

function set(next: Partial<Fields>): void {
  const prev = fields;
  fields = { ...fields, ...next };
  if (fields.page !== prev.page || fields.pin !== prev.pin) save();
  emit();
}

/** La fin du coup d'oeil : les abonnes (l'ecran, la bande de la barre, le jumeau) repassent en HOME. */
function armPeek(): void {
  window.clearTimeout(peekTimer);
  const left = fields.peekUntil - performance.now();
  if (left <= 0) return;
  peekTimer = window.setTimeout(() => {
    peekTimer = 0;
    if (performance.now() < fields.peekUntil) armPeek();
    else emit();
  }, left + 5);
}

export const rytmPage = {
  get: (): RytmPageState => state,
  /** La page, epinglee. */
  setPage(p: RytmPageId): void {
    set({ page: p, pin: 'page' });
  },
  /** [ et ] : la page d'a cote, epinglee. */
  step(dir: -1 | 1): void {
    set({ page: pageStep(fields.page, dir), pin: 'page' });
  },
  /** H : la vue PAGE epinglee, ou HOME (tout de suite, coup d'oeil compris). */
  toggleView(): void {
    if (fields.pin === 'page') set({ pin: 'home', peekUntil: 0 });
    else set({ pin: 'page' });
  },
  /**
   * Un reglage touche (un potard, un TWEAK, la velocite d'un pas) : la page
   * le suit (FOLLOW_TOUCH), son bloc s'entoure un instant (l'echo) et la
   * vue PAGE vient en coup d'oeil, sauf peek false. Rien pour un reglage qui
   * n'est sur aucune page (MASTER, TEMPO).
   */
  touch(t: SlotTarget, inst: Inst | null, opts: { peek?: boolean } = {}, now: number = performance.now()): void {
    const at = slotOf(t, inst);
    if (!at) return;
    if (!FOLLOW_TOUCH && at.page !== fields.page) return;
    const peek = opts.peek !== false;
    set({
      page: FOLLOW_TOUCH ? at.page : fields.page,
      echo: { page: at.page, k: at.k, until: now + POT_UI.readoutMs },
      ...(peek ? { peekUntil: now + PAGE_PEEK_MS } : {}),
    });
    if (peek) armPeek();
  },
  /** Le dernier pas touche (-1 : aucun). */
  select(i: number): void {
    const sel = Math.max(-1, Math.min(15, Math.round(i)));
    if (sel !== fields.sel) set({ sel });
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
