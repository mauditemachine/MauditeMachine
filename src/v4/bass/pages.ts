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
 *   DLY FB, REV SIZE, REV TONE sont GLOBAL ;
 * - les huit encodeurs de la face (desktop) ne suivent plus la page : ils
 *   tiennent pour de bon les FX globaux de la machine (BASS_FX_KNOBS), et
 *   ne posent jamais de P-lock. La page se regle a l'ecran (ses blocs), au
 *   telephone comme au desktop ; le MIDI bass:knob:1 a 8 (et le Roto)
 *   reste "le bloc k de la page a l'ecran".
 * Les ids de page ne changent pas : une page retenue d'avant se relit ; une
 * page inconnue redevient FILTER.
 */

import type { BassKnobId } from './params';
import { isLockable } from './state';

export type BassPageId = 'voice' | 'filter' | 'env' | 'fx';

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

/** Les huit cases de chaque page, A a H. */
export const BASS_PAGE_SLOTS: Readonly<Record<BassPageId, readonly (BassKnobId | null)[]>> = {
  voice: ['wave', 'pw', 'sub', 'suboct', 'octave', 'tune', 'glide', 'volume'],
  filter: ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'accdecay', 'sweep', 'keytrack'],
  env: ['attack', 'adecay', 'sustain', 'release', 'length', null, null, null],
  fx: ['drive', 'delay', 'dtime', 'dfb', null, 'reverb', 'rsize', 'rtone'],
};

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

/** La page et la case d'un reglage (null : sur aucune page, STYLE, DENSITY, les regles du generateur). */
export function bassSlotOf(id: BassKnobId): { page: BassPageId; k: number } | null {
  for (const p of BASS_PAGES) {
    const k = BASS_PAGE_SLOTS[p.id].indexOf(id);
    if (k >= 0) return { page: p.id, k };
  }
  return null;
}

/** Un reglage d'une page qui ne se verrouille pas : l'ecran le marque GLOBAL. */
export const isBassGlobal = (id: BassKnobId): boolean => bassSlotOf(id) !== null && !isLockable(id);

/* ---------------- le store ---------------- */

const KEY = 'mm.v4.bass.page';
const listeners = new Set<() => void>();

function load(): BassPageId {
  try {
    const v = window.localStorage.getItem(KEY);
    return isBassPage(v) ? v : 'filter';
  } catch {
    return 'filter';
  }
}

/** La page de depart : FILTER, le coeur de la 303 (ce qu'on tourne d'abord). */
let page: BassPageId = typeof window === 'undefined' ? 'filter' : load();

export const bassPage = {
  get: (): BassPageId => page,
  set(p: BassPageId): void {
    if (p === page) return;
    page = p;
    try {
      window.localStorage.setItem(KEY, p);
    } catch {
      /* stockage indisponible : la page vit pour la visite */
    }
    listeners.forEach((fn) => fn());
  },
  /** La page d'a cote, en boucle (les touches [ et ]). */
  step(dir: -1 | 1): void {
    const n = BASS_PAGES.length;
    const i = BASS_PAGES.findIndex((x) => x.id === page);
    bassPage.set(BASS_PAGES[(((i < 0 ? 0 : i) + dir) % n + n) % n].id);
  },
  /** Le reglage de l'encodeur k (0 a 7) sur la page courante, null : case vide. */
  slot(k: number, p: BassPageId = page): BassKnobId | null {
    return BASS_PAGE_SLOTS[p][k] ?? null;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
