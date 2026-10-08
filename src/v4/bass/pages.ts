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
  { id: 'env', label: 'ENV', title: 'AMP ENVELOPE' },
  { id: 'fx', label: 'FX', title: 'DRIVE DELAY REVERB' },
];

/** Les huit cases de chaque page, A a H. */
export const BASS_PAGE_SLOTS: Readonly<Record<BassPageId, readonly (BassKnobId | null)[]>> = {
  voice: ['wave', 'pw', 'sub', 'suboct', 'octave', 'tune', 'glide', null],
  filter: ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'accdecay', 'sweep', 'keytrack'],
  env: ['attack', 'adecay', 'sustain', 'release', 'length', null, null, 'volume'],
  fx: ['drive', 'delay', 'dtime', 'dfb', null, 'reverb', 'rsize', 'rtone'],
};

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
