/**
 * Les pages du MM-BASS, facon Elektron (2026-10-08, Mika : "il faudrait
 * vraiment faire comme un principe de machine elektron : quand on clique sur
 * un step on selectionne la partie qu'on veut modifier, est-ce que le voice,
 * est-ce que le FX, est-ce que l'enveloppe, et ensuite on tourne un encodeur
 * sur ce step ; les valeurs des knobs sont a l'ecran, pas sur les
 * encodeurs"). Quatre touches de page (VOICE, FILTER, ENV, FX, leur LED
 * allumee sur la page courante) et huit encodeurs sans fin, A a H : A B C D
 * en haut, E F G H dessous, comme les huit blocs de l'ecran. Une case vide
 * (null) : rien de dessine, l'encodeur ne fait rien.
 * - VOICE : l'oscillateur et la hauteur (WAVE, PW, SUB, SUB OCT, OCTAVE,
 *   TUNE, GLIDE) ;
 * - FILTER : le coeur de la 303 (CUTOFF, RESO, ENV MOD, DECAY, ACCENT, ACC
 *   DECAY, SWEEP, KEY TRK) ;
 * - ENV : l'enveloppe de l'ampli (ATTACK, AMP DECAY, SUSTAIN, RELEASE), la
 *   longueur des notes (LENGTH) et VOLUME, comme la page AMP d'une Elektron ;
 * - FX : DRIVE et le DELAY en haut (envoi, temps, retour), la REVERB
 *   dessous (envoi, taille, couleur), colonne par colonne.
 * La page est retenue sous mm.v4.bass.page.
 *
 * L'etape 2 (2026-10-09, Mika : "le VOLUME du voice ou du step selectionne
 * doit se retrouver dans Voice ; quand on appuie sur ENV on voit AMP ENV,
 * c'est parfait ; les encoders ne servent qu'a faire les modifs des FX
 * globaux de la machine") :
 * - VOICE recoit VOLUME (H) : le niveau de la voix, ou celui du pas en
 *   P-LOCK ;
 * - ENV garde l'ampli entier (ATTACK, AMP DECAY, SUSTAIN, RELEASE) et
 *   LENGTH ; ses trois cases libres (F G H) portent le grand dessin de
 *   l'enveloppe, en direct (bass/screen.ts) ; son titre : AMP ENV ;
 * - FX : DRIVE, l'envoi DELAY et l'envoi REVERB se verrouillent, DLY TIME,
 *   DLY FB, REV SIZE, REV TONE sont GLOBAL ; E, VOLUME (la revue du meme
 *   jour), comme l'encodeur E de la face : la page FX est la rangee des
 *   encodeurs ;
 * - les huit encodeurs de la face (desktop) ne suivent plus la page : ils
 *   tiennent pour de bon les FX globaux de la machine (BASS_FX_KNOBS), et
 *   ne posent jamais de P-lock. La page se regle a l'ecran (ses blocs), au
 *   telephone comme au desktop ; le MIDI bass:knob:1 a 8 (et le Roto)
 *   reste "le bloc k de la page a l'ecran".
 * Les ids de page ne changent pas : une page retenue d'avant se relit ; une
 * page inconnue redevient FILTER.
 *
 * Les onglets (2026-10-09, le moteur MONARK : trois oscillateurs, un
 * melangeur et un contour de filtre de plus, le modele du MM-RYTM, comme les
 * sous-pages d'une Digitakt II) : sept ecrans sous les quatre pages, VOICE
 * (MAIN, OSC, MIX), FILTER (MAIN, CONTOUR), ENV, FX. La touche de la page
 * allumee pressee encore passe a l'onglet suivant (en boucle) ; une puce de
 * l'en-tete de l'ecran va a son onglet ; le MIDI bass:page (un flot de CC)
 * ne change jamais d'onglet. Les quatre ids de page, leurs touches et
 * bass:page (quatre crans) ne changent pas. Retenus sous mm.v4.bass.page.2
 * ({v: 2, page, tabs}) ; la cle d'avant (une page seule) se lit encore, sur
 * son premier onglet ; une page ou un onglet inconnus : FILTER MAIN.
 */

import { bassMode, type BassKnobId } from './params';
import { isLockable } from './state';

export type BassPageId = 'voice' | 'filter' | 'env' | 'fx';
/** Les ecrans (2026-10-09) : les onglets des pages. */
export type BassScreenId = 'voice' | 'osc' | 'mix' | 'filter' | 'contour' | 'env' | 'fx';

export interface BassPageDef {
  id: BassPageId;
  /** le nom de la touche et de l'onglet de l'ecran */
  label: string;
  /** le titre long (l'en-tete de l'ecran) */
  title: string;
}

export const BASS_PAGES: readonly BassPageDef[] = [
  { id: 'voice', label: 'VOICE', title: 'VOICE' },
  { id: 'filter', label: 'FILTER', title: 'FILTER 303' },
  { id: 'env', label: 'ENV', title: 'AMP ENV' },
  { id: 'fx', label: 'FX', title: 'FX' },
];

export const BASS_SCREENS: readonly BassScreenId[] = ['voice', 'osc', 'mix', 'filter', 'contour', 'env', 'fx'];
export const isBassScreen = (v: unknown): v is BassScreenId => typeof v === 'string' && (BASS_SCREENS as readonly string[]).includes(v);
/** Les onglets de chaque page, dans l'ordre de la touche pressee encore. */
export const PAGE_TABS: Readonly<Record<BassPageId, readonly BassScreenId[]>> = { voice: ['voice', 'osc', 'mix'], filter: ['filter', 'contour'], env: ['env'], fx: ['fx'] };
/** La page d'un ecran. */
export const SCREEN_PAGE: Readonly<Record<BassScreenId, BassPageId>> = { voice: 'voice', osc: 'voice', mix: 'voice', filter: 'filter', contour: 'filter', env: 'env', fx: 'fx' };
/** Le nom d'un onglet (sa puce dans l'en-tete). */
export const SCREEN_LABEL: Readonly<Record<BassScreenId, string>> = { voice: 'MAIN', osc: 'OSC', mix: 'MIX', filter: 'MAIN', contour: 'CONTOUR', env: 'ENV', fx: 'FX' };
/** Le titre d'un ecran (la ligne du titre) ; FILTER : le MODE du moment, screenTitle. */
export const SCREEN_TITLE: Readonly<Record<BassScreenId, string>> = { voice: 'VOICE', osc: 'OSC 2 · OSC 3', mix: 'MIXER', filter: 'FILTER LP24', contour: 'FILTER CONTOUR', env: 'AMP ENV', fx: 'FX' };
/** Le titre d'un ecran tel qu'il s'affiche : FILTER LP24, FILTER 303... (le MODE global). */
export const screenTitle = (s: BassScreenId): string => (s === 'filter' ? `FILTER ${bassMode()}` : SCREEN_TITLE[s]);

/**
 * Les huit cases de chaque ecran, A a H (2026-10-09) : VOICE MAIN, FILTER MAIN, ENV et FX telles qu'avant ; OSC, les
 * deux oscillateurs du Model D (OSC 2 en haut, OSC 3 dessous) ; MIX, le melangeur dans l'ordre du signal (les trois
 * niveaux, NOISE, puis SUB, DRIVE qui est LOAD, FEEDBACK, DRIFT) ; CONTOUR, le contour du filtre (MODE, F.ATTACK,
 * DECAY, F.SUSTAIN, ENV MOD, POLARITY) et son grand dessin sur G H. DECAY, ENV MOD, SUB, DRIVE et VOLUME sont sur deux
 * ecrans expres : le meme reglage, la ou on le cherche.
 */
export const BASS_SCREEN_SLOTS: Readonly<Record<BassScreenId, readonly (BassKnobId | null)[]>> = {
  voice: ['wave', 'pw', 'sub', 'suboct', 'octave', 'tune', 'glide', 'volume'],
  osc: ['o2wave', 'o2range', 'o2semi', 'o2fine', 'o3wave', 'o3range', 'o3semi', 'o3fine'],
  mix: ['o1lvl', 'o2lvl', 'o3lvl', 'noise', 'sub', 'drive', 'feedback', 'drift'],
  filter: ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'accdecay', 'sweep', 'keytrack'],
  contour: ['fmode', 'fattack', 'decay', 'fsustain', 'envmod', 'fpol', null, null],
  env: ['attack', 'adecay', 'sustain', 'release', 'length', null, null, null],
  // E : VOLUME, comme l'encodeur E de la face (la revue du 2026-10-09 : la case vide faisait la page inachevee) ; le
  // meme reglage que VOICE H, verrouillable de meme
  fx: ['drive', 'delay', 'dtime', 'dfb', 'volume', 'reverb', 'rsize', 'rtone'],
};
/** Les huit cases de la premiere page de chaque touche (l'alias d'avant les onglets). */
export const BASS_PAGE_SLOTS: Readonly<Record<BassPageId, readonly (BassKnobId | null)[]>> = {
  voice: BASS_SCREEN_SLOTS.voice,
  filter: BASS_SCREEN_SLOTS.filter,
  env: BASS_SCREEN_SLOTS.env,
  fx: BASS_SCREEN_SLOTS.fx,
};
/** Les reglages de tous les onglets d'une page (une fois chacun) : ses verrous se comptent sur eux. */
export const pageIds = (p: BassPageId): readonly BassKnobId[] => [...new Set(PAGE_TABS[p].flatMap((s) => BASS_SCREEN_SLOTS[s]).filter((id): id is BassKnobId => id !== null))];

/**
 * Les encodeurs A a H de la face, desktop (2026-10-09, Mika : "en desktop tu les laisses, mais ils ne servent qu'a
 * faire les modifs des FX globaux de la machine") : une fois pour toutes, dans l'ordre de la page FX (A DRIVE, B DELAY,
 * C DLY TIME, D DLY FB ; F REVERB, G REV SIZE, H REV TONE), E le niveau de la machine (VOLUME, la ou FX n'a rien). Ils
 * reglent toujours le son global, jamais un P-lock, meme en P-LOCK.
 */
export const BASS_FX_KNOBS: readonly BassKnobId[] = ['drive', 'delay', 'dtime', 'dfb', 'volume', 'reverb', 'rsize', 'rtone'];
/** L'encodeur de la face qui tient ce reglage (0 a 7), -1 s'il n'est pas sur un encodeur. */
export const bassFxEncOf = (id: BassKnobId): number => BASS_FX_KNOBS.indexOf(id);

export const ENC_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const isBassPage = (v: unknown): v is BassPageId => BASS_PAGES.some((p) => p.id === v);
export const bassPageDef = (p: BassPageId): BassPageDef => BASS_PAGES.find((x) => x.id === p) ?? BASS_PAGES[0];

/**
 * La page, l'ecran et la case d'un reglage (null : sur aucun ecran, STYLE, DENSITY, les regles du generateur) :
 * l'ecran affiche d'abord, puis les onglets de sa page, puis les autres (un reglage sur deux ecrans : celui qu'on voit).
 */
export function bassSlotOf(id: BassKnobId, from: BassScreenId = screen()): { page: BassPageId; screen: BassScreenId; k: number } | null {
  const order = [from, ...PAGE_TABS[SCREEN_PAGE[from]], ...BASS_SCREENS];
  for (const s of order) {
    const k = BASS_SCREEN_SLOTS[s].indexOf(id);
    if (k >= 0) return { page: SCREEN_PAGE[s], screen: s, k };
  }
  return null;
}

/** Un reglage d'un ecran qui ne se verrouille pas : l'ecran le marque GLOBAL (OCTAVE, les reglages des effets, MODE, DRIFT). */
export const isBassGlobal = (id: BassKnobId): boolean => BASS_SCREENS.some((s) => BASS_SCREEN_SLOTS[s].includes(id)) && !isLockable(id);

/* ---------------- le store ---------------- */

const KEY = 'mm.v4.bass.page.2';
const OLD_KEY = 'mm.v4.bass.page';
const listeners = new Set<() => void>();
type Tabs = Record<BassPageId, number>;
const zeroTabs = (): Tabs => ({ voice: 0, filter: 0, env: 0, fx: 0 });

/** La page et ses onglets retenus ; la cle d'avant (une page seule) : son premier onglet ; inconnu : FILTER MAIN. */
function load(): { page: BassPageId; tabs: Tabs } {
  const out = { page: 'filter' as BassPageId, tabs: zeroTabs() };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as { v?: unknown; page?: unknown; tabs?: unknown } | null;
      if (!o || o.v !== 2 || !isBassPage(o.page)) return out;
      out.page = o.page;
      if (o.tabs && typeof o.tabs === 'object') {
        for (const p of BASS_PAGES) {
          const t = (o.tabs as Record<string, unknown>)[p.id];
          if (typeof t === 'number' && Number.isInteger(t) && t >= 0 && t < PAGE_TABS[p.id].length) out.tabs[p.id] = t;
          else if (t !== undefined) return { page: 'filter', tabs: zeroTabs() };
        }
      }
      return out;
    }
    const old = window.localStorage.getItem(OLD_KEY);
    if (isBassPage(old)) out.page = old;
  } catch {
    /* rien de retenu : FILTER MAIN */
  }
  return out;
}

/** La page de depart : FILTER, le coeur du son (ce qu'on tourne d'abord). */
const first = typeof window === 'undefined' ? { page: 'filter' as BassPageId, tabs: zeroTabs() } : load();
let page: BassPageId = first.page;
let tabs: Tabs = first.tabs;

/** L'ecran affiche : la page et son onglet. */
function screen(): BassScreenId {
  const t = PAGE_TABS[page];
  return t[Math.max(0, Math.min(t.length - 1, tabs[page] ?? 0))];
}

function commit(p: BassPageId, t: Tabs): void {
  if (p === page && t[p] === tabs[p] && t === tabs) return;
  page = p;
  tabs = t;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 2, page, tabs }));
  } catch {
    /* stockage indisponible : la page vit pour la visite */
  }
  listeners.forEach((fn) => fn());
}

export const bassPage = {
  get: (): BassPageId => page,
  /** L'ecran affiche (la page et son onglet). */
  screen,
  /** L'onglet retenu d'une page (0 : le premier). */
  tab: (p: BassPageId = page): number => tabs[p] ?? 0,
  /** Une page, sur son onglet retenu (la valeur MIDI bass:page, [ et ]) ; la page deja la : rien. */
  set(p: BassPageId): void {
    if (p === page) return;
    commit(p, tabs);
  },
  /** Un ecran (une puce de l'en-tete, le MIDI bass:screen:<id>) : sa page, sur lui. */
  setScreen(s: BassScreenId): void {
    const p = SCREEN_PAGE[s];
    const t = PAGE_TABS[p].indexOf(s);
    if (p === page && tabs[p] === t) return;
    commit(p, { ...tabs, [p]: t });
  },
  /**
   * Une touche de page pressee (la touche, sa jumelle sous l'ecran, bass:page:<id>, le Roto) : une autre page s'affiche
   * sur son onglet retenu ; la page allumee pressee encore passe a son onglet suivant, en boucle. Rend l'ecran.
   */
  press(p: BassPageId): BassScreenId {
    if (p !== page) commit(p, tabs);
    else {
      const n = PAGE_TABS[p].length;
      if (n > 1) commit(p, { ...tabs, [p]: ((tabs[p] ?? 0) + 1) % n });
    }
    return screen();
  },
  /** La page d'a cote, en boucle (les touches [ et ]). */
  step(dir: -1 | 1): void {
    const n = BASS_PAGES.length;
    const i = BASS_PAGES.findIndex((x) => x.id === page);
    bassPage.set(BASS_PAGES[(((i < 0 ? 0 : i) + dir) % n + n) % n].id);
  },
  /** L'onglet d'a cote dans la page, en boucle (Maj + [ et ]) ; une page sans onglet : rien. */
  tabStep(dir: -1 | 1): void {
    const n = PAGE_TABS[page].length;
    if (n < 2) return;
    commit(page, { ...tabs, [page]: ((((tabs[page] ?? 0) + dir) % n) + n) % n });
  },
  /** Le reglage du bloc k (0 a 7) d'un ecran (l'ecran affiche par defaut ; une page : son premier onglet), null : case vide. */
  slot(k: number, s: BassScreenId = screen()): BassKnobId | null {
    return BASS_SCREEN_SLOTS[s][k] ?? null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
