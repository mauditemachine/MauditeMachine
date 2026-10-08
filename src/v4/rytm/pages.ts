/**
 * Les pages du MM-RYTM facon Digitakt (2026-10-08, etape 1, Mika : "8
 * encodeurs assignables a condition de presser les bonnes touches ; l'ecran
 * divise en 8 blocs ; j'adore l'ecran, je veux le meme ecran mais plus
 * utilise ; allons-y petit a petit"). Six pages, TRIG SRC FLTR AMP FX LFO,
 * de huit blocs chacune (A B C D en haut, E F G H dessous, la place des
 * futurs potards sous l'ecran). Un bloc ne fait que montrer un reglage qui
 * existe deja (un DialId, ou la velocite du pas choisi) : aucun nouveau
 * parametre, aucun changement du son a cette etape.
 * - label vide : un bloc vide (rien de dessine) ;
 * - target null avec un label : un reglage a venir (soon : son nom a peine,
 *   et --) ;
 * - scope 'all' : toute la machine (SWING, STRETCH, les effets globaux),
 *   'track' : la voix choisie (pattern.instrument) ;
 * - noBd : la rangee du bas de FX (les effets globaux) ne touche pas le kick
 *   (depuis le 2026-10-08 il a son propre chemin, audio/drums.ts kickBus) :
 *   l'ecran le dit (NO BD) quand BD est la voix choisie.
 * SRC depend de la famille de la voix : le KICK a ses quatre potards, la
 * caisse claire SNAPPY et GATE, le clap GATE, les autres rien de plus.
 * Une table pure : elle n'importe que des types et familyOf.
 */

import type { DialId } from '../actions';
import { familyOf, type KitFamily } from '../audio/kit';
import type { ShotId } from '../audio/shotsdsp';
import type { Inst } from '../theme';

export type RytmPageId = 'trig' | 'src' | 'fltr' | 'amp' | 'fx' | 'lfo';

/** L'ordre des pages (les touches [ et ] en font le tour). */
export const RYTM_PAGES: readonly { id: RytmPageId; label: string }[] = [
  { id: 'trig', label: 'TRIG' },
  { id: 'src', label: 'SRC' },
  { id: 'fltr', label: 'FLTR' },
  { id: 'amp', label: 'AMP' },
  { id: 'fx', label: 'FX' },
  { id: 'lfo', label: 'LFO' },
];

/** La page de depart : SRC, ou le KICK montre six blocs vivants. */
export const DEFAULT_PAGE: RytmPageId = 'src';

/**
 * Etape 1 : la page suit le reglage touche (le seul moyen de la rendre utile
 * avant les touches de page) ; l'etape 2 la fixera (false).
 */
export const FOLLOW_TOUCH = true;

/** Ce que montre un bloc : un potard (DialId), ou la velocite du pas choisi. */
export type SlotTarget = DialId | 'step:vel';

/**
 * Le dessin d'un bloc : les images des cartes de l'ecran (level, tone,
 * decay, swing, stretch), des crans (notch), une barre (bar), une barre
 * depuis le centre (barc).
 */
export type SlotDraw = 'level' | 'tone' | 'decay' | 'swing' | 'stretch' | 'notch' | 'bar' | 'barc';

export interface PageSlot {
  /** '' : bloc vide */
  label: string;
  /** null : a venir (avec un label) ou vide */
  target: SlotTarget | null;
  scope: 'track' | 'all';
  draw: SlotDraw;
  /** effet global que le kick ne recoit pas */
  noBd?: boolean;
}

export const isRytmPage = (v: unknown): v is RytmPageId => RYTM_PAGES.some((p) => p.id === v);
export const pageLabel = (p: RytmPageId): string => RYTM_PAGES.find((x) => x.id === p)?.label ?? p.toUpperCase();

const EMPTY: PageSlot = { label: '', target: null, scope: 'track', draw: 'bar' };
const soon = (label: string, scope: PageSlot['scope'] = 'track'): PageSlot => ({ label, target: null, scope, draw: 'bar' });
const live = (label: string, target: SlotTarget, draw: SlotDraw, scope: PageSlot['scope'] = 'track', noBd = false): PageSlot => ({
  label,
  target,
  scope,
  draw,
  ...(noBd ? { noBd } : {}),
});

const TRIG: readonly PageSlot[] = [
  live('VEL', 'step:vel', 'level'),
  soon('PROB'),
  soon('MICRO'),
  soon('COND'),
  soon('RTRG'),
  soon('RTIM'),
  EMPTY,
  live('SWING', 'swing', 'swing', 'all'),
];

const FLTR: readonly PageSlot[] = [soon('F.ATK'), soon('F.DEC'), EMPTY, EMPTY, live('TONE', 'tone', 'tone'), soon('RESO'), soon('TYPE'), soon('ENV')];

const AMP: readonly PageSlot[] = [soon('ATK'), soon('HOLD'), live('DEC', 'vdecay', 'decay'), EMPTY, EMPTY, EMPTY, soon('PAN'), live('VOL', 'vol', 'level')];

/** En haut les effets de la voix, dessous ceux de toute la machine, colonne par colonne. */
const FX: readonly PageSlot[] = [
  live('DIST', 'vdist', 'bar'),
  live('CHORUS', 'vchorus', 'bar'),
  live('DELAY', 'vdelay', 'bar'),
  live('REVERB', 'vreverb', 'bar'),
  live('DIST', 'dist', 'bar', 'all', true),
  live('CHORUS', 'chorus', 'bar', 'all', true),
  live('DELAY', 'delay', 'bar', 'all', true),
  live('REVERB', 'reverb', 'bar', 'all', true),
];

const LFO: readonly PageSlot[] = ['SPEED', 'MULT', 'FADE', 'DEST', 'WAVE', 'PHASE', 'MODE', 'DEPTH'].map((l) => soon(l));

/** SRC : C a F selon la famille de la voix (le KICK, la caisse claire, le clap ; rien pour les autres). */
function srcMiddle(f: KitFamily | null): readonly PageSlot[] {
  if (f === 'bd') return [live('K.TUNE', 'r:tune', 'barc'), live('ATTACK', 'r:attack', 'bar'), live('DECAY', 'r:decay', 'decay'), live('DRIVE', 'r:drive', 'bar')];
  if (f === 'sd') return [live('SNAPPY', 'r:snappy', 'bar'), live('GATE', 'r:gate', 'notch'), EMPTY, EMPTY];
  if (f === 'cp') return [EMPTY, live('GATE', 'r:gate', 'notch'), EMPTY, EMPTY];
  return [EMPTY, EMPTY, EMPTY, EMPTY];
}

const SRC_CACHE = new Map<KitFamily | 'none', readonly PageSlot[]>();

function src(inst: Inst | null): readonly PageSlot[] {
  const f = inst ? familyOf(inst as ShotId) : null;
  const key = f ?? 'none';
  let slots = SRC_CACHE.get(key);
  if (!slots) {
    // A : le son de la famille (le choix de son du kit), B : TUNE a venir (toutes les voix), G : START a venir
    slots = [live('SOUND', 'vsound', 'notch'), soon('TUNE'), ...srcMiddle(f), soon('START'), live('STRETCH', 'stretch', 'stretch', 'all')];
    SRC_CACHE.set(key, slots);
  }
  return slots;
}

/** Les huit blocs d'une page pour la voix choisie (null : aucune). */
export function pageSlots(page: RytmPageId, inst: Inst | null): readonly PageSlot[] {
  switch (page) {
    case 'trig':
      return TRIG;
    case 'src':
      return src(inst);
    case 'fltr':
      return FLTR;
    case 'amp':
      return AMP;
    case 'fx':
      return FX;
    default:
      return LFO;
  }
}

/**
 * La page et le bloc d'un reglage pour cette voix, null s'il n'est sur
 * aucune page (MASTER, TEMPO, le MM-ARP) : un choix de son r:<famille> est
 * SOUND quand c'est la famille de la voix, un potard du kit seulement quand
 * la famille de la voix le porte (SNAPPY pour la caisse claire...).
 */
export function slotOf(t: SlotTarget, inst: Inst | null): { page: RytmPageId; k: number } | null {
  const f = inst ? familyOf(inst as ShotId) : null;
  if (t.startsWith('r:') && f !== null && t.slice(2) === f) return { page: 'src', k: 0 };
  for (const { id } of RYTM_PAGES) {
    const k = pageSlots(id, inst).findIndex((s) => s.target === t);
    if (k >= 0) return { page: id, k };
  }
  return null;
}

/** La page d'a cote (dir -1 : la precedente), en boucle. */
export function pageStep(p: RytmPageId, dir: -1 | 1): RytmPageId {
  const n = RYTM_PAGES.length;
  const i = RYTM_PAGES.findIndex((x) => x.id === p);
  return RYTM_PAGES[(((i < 0 ? 0 : i) + dir) % n + n) % n].id;
}
