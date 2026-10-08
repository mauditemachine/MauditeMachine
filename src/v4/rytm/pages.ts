/**
 * Les pages du MM-RYTM facon Digitakt (2026-10-08, etape 1, Mika : "8
 * encodeurs assignables a condition de presser les bonnes touches ; l'ecran
 * divise en 8 blocs ; j'adore l'ecran, je veux le meme ecran mais plus
 * utilise ; allons-y petit a petit"). Six pages, TRIG SRC SMPL FLTR AMP FX
 * depuis le 2026-10-08 (l'ordre de l'Analog Rytm, Mika : "comme la ANALOG
 * Rytm ou on peut mettre des samples mais le kick peut etre parametre comme
 * une machine" : SMPL prend la place de LFO, qui viendra plus tard), de
 * huit blocs chacune (A B C D en haut, E F G H dessous, au-dessus des huit
 * potards de page de la face). Un bloc ne fait que montrer un reglage qui
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
 * SMPL : le choix du son (SAMPLE, le meme reglage que SOUND de SRC tant que
 * les couches SYNTH et SAMPLE de l'etape R3 n'existent pas), le reste a venir.
 * Une table pure : elle n'importe que des types, familyOf et la liste des
 * touches (theme.ts).
 */

import type { DialId } from '../actions';
import { familyOf, type KitFamily } from '../audio/kit';
import type { ShotId } from '../audio/shotsdsp';
import { RYTM_PAGE_KEYS, type Inst } from '../theme';

export type RytmPageId = (typeof RYTM_PAGE_KEYS)[number]['id'];

/** L'ordre des pages (les touches de page, [ et ] en font le tour). */
export const RYTM_PAGES: readonly { id: RytmPageId; label: string }[] = RYTM_PAGE_KEYS;

/** La page de depart : SRC, ou le KICK montre six blocs vivants. */
export const DEFAULT_PAGE: RytmPageId = 'src';

/**
 * La page ne suit plus le reglage touche (2026-10-08, les touches de page
 * existent) : un potard absolu (TWEAKS sous le capot, MIDI rytm:enc:...)
 * n'allume son bloc que sur la page affichee.
 */
export const FOLLOW_TOUCH = false;

/** Ce que montre un bloc : un potard (DialId), ou la velocite du pas choisi. */
export type SlotTarget = DialId | 'step:vel';

/**
 * Le dessin d'un bloc : les images des cartes de l'ecran (level, tone,
 * decay, swing, stretch), des crans (notch), un petit potard (bar), un
 * petit potard depuis le centre (barc).
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

/** SMPL, dans l'ordre de l'Analog Rytm : TUNE FINE BR SAMPLE, START END LOOP LEVEL. */
const SMPL: readonly PageSlot[] = [soon('TUNE'), soon('FINE'), soon('BR'), live('SAMPLE', 'vsound', 'notch'), soon('START'), soon('END'), soon('LOOP'), soon('LEVEL')];

const FLTR: readonly PageSlot[] = [soon('ATK'), soon('DEC'), EMPTY, EMPTY, live('TONE', 'tone', 'tone'), soon('RESO'), soon('TYPE'), soon('ENV')];

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
    // A : le son de la famille (le choix de son du kit), B : TUNE a venir (toutes les voix), G : vide (START est sur SMPL)
    slots = [live('SOUND', 'vsound', 'notch'), soon('TUNE'), ...srcMiddle(f), EMPTY, live('STRETCH', 'stretch', 'stretch', 'all')];
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
    case 'smpl':
      return SMPL;
    case 'fltr':
      return FLTR;
    case 'amp':
      return AMP;
    default:
      return FX;
  }
}

/**
 * La page et le bloc d'un reglage pour cette voix, null s'il n'est sur
 * aucune page (MASTER, TEMPO, le MM-ARP) : un choix de son r:<famille> est
 * SOUND quand c'est la famille de la voix, un potard du kit seulement quand
 * la famille de la voix le porte (SNAPPY pour la caisse claire...). page :
 * celle qu'on regarde, d'abord (SOUND et SAMPLE sont le meme reglage).
 */
export function slotOf(t: SlotTarget, inst: Inst | null, page?: RytmPageId): { page: RytmPageId; k: number } | null {
  const f = inst ? familyOf(inst as ShotId) : null;
  const target: SlotTarget = t.startsWith('r:') && f !== null && t.slice(2) === f ? 'vsound' : t;
  const order = page ? [page, ...RYTM_PAGES.map((p) => p.id).filter((id) => id !== page)] : RYTM_PAGES.map((p) => p.id);
  for (const id of order) {
    const k = pageSlots(id, inst).findIndex((s) => s.target === target);
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
