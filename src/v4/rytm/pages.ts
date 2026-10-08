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
 * SMPL : SAMPLE, l'echantillon de la voix (OFF : le son de synthese de SRC
 * joue ; sinon l'un des echantillons de sa famille), le reste a venir.
 * Les reglages a venir ne se dessinent pas (SHOW_SOON, 2026-10-08) : une
 * grille de blocs SOON se lisait comme un travail pas fini ; la table les
 * garde pour les etapes suivantes (R2, R3), qui n'ont qu'a les brancher.
 * Une table pure : elle n'importe que des types, familyOf et la liste des
 * touches (theme.ts).
 *
 * Les verrous (2026-10-08, l'etape R2, audio/locks.ts) : lock dit ce qu'un
 * bloc verrouille sur le pas en LOCK (vel : la velocite du pas elle-meme ;
 * snd : le son, SOUND et SAMPLE ; level, decay, tune, pan, start). Un bloc
 * de toute la machine (ALL) n'est jamais verrouillable (GLOBAL a l'ecran) ;
 * un bloc de voix sans lock ne l'est pas encore (TONE, DIST et CHORUS de la
 * voix : des inserts de sa tranche, leur verrou viendra, l'ecran le dit).
 * TUNE (SRC), PAN (AMP) et START (SMPL) arrivent avec, pour toutes les voix ;
 * depuis la revue de R2, les potards de la machine (K.TUNE ATTACK DECAY
 * DRIVE, SNAPPY, GATE) et les envois DELAY et REVERB de la voix aussi.
 *
 * Les deux couches (2026-10-08, l'etape R3, Mika : "une machine pour la
 * configuration a la main du Voice pour avoir des samples et aussi une
 * configuration digitale du BD ou SD.. comme la ANALOG Rytm") : SRC est la
 * couche SYNTH de la voix, SMPL sa couche SAMPLE, chacune son LEVEL en H,
 * dans l'ordre de l'Analog Rytm :
 * - SRC : A MACHINE (909, 808, MM), puis ses potards (le KICK : TUNE ATTACK
 *   SWEEP / DECAY DRIVE ; la caisse claire : TUNE SNAPPY TONE / DECAY GATE ;
 *   le clap : GATE ; les autres : le TUNE de la voix en B), H LEVEL. ATTACK et
 *   DRIVE du kick, SNAPPY de la caisse claire reglent aussi la couche SAMPLE
 *   (both : BOTH a l'ecran) ;
 * - SMPL : A TUNE, B FINE, C REV / D SAMPLE (OFF ou un echantillon), E START,
 *   F LEN, H LEVEL ;
 * - STRETCH (toute la machine) passe sur TRIG, a cote de SWING.
 * Une couche muette (LEVEL 0, SAMPLE OFF) : ses blocs en retrait (layer).
 */

import type { DialId } from '../actions';
import type { LockKey } from '../audio/locks';
import { familyOf, type KitFamily } from '../audio/kit';
import type { ShotId } from '../audio/shotsdsp';
import { RYTM_PAGE_KEYS, type Inst } from '../theme';

export type RytmPageId = (typeof RYTM_PAGE_KEYS)[number]['id'];

/** L'ordre des pages (les touches de page, [ et ] en font le tour). */
export const RYTM_PAGES: readonly { id: RytmPageId; label: string }[] = RYTM_PAGE_KEYS;

/**
 * Les reglages a venir a l'ecran (2026-10-08, revue de l'etape R1) : non, ils
 * ne se dessinent pas, leur bloc est vide comme un emplacement libre (Mika :
 * "je ne vois AUCUN changement", une grille de SOON gris le confirmait).
 */
export const SHOW_SOON = false;

/** La page de depart : SRC, ou le KICK montre six blocs vivants. */
export const DEFAULT_PAGE: RytmPageId = 'src';

/**
 * La page ne suit plus le reglage touche (2026-10-08, les touches de page
 * existent) : un potard absolu (TWEAKS sous le capot, MIDI rytm:enc:...)
 * n'allume son bloc que sur la page affichee.
 */
export const FOLLOW_TOUCH = false;

/**
 * Ce que montre un bloc : un potard (DialId), la velocite du pas choisi
 * (step:vel), l'echantillon de la voix (smpl:sample : OFF, ou l'un des
 * echantillons de sa famille ; le meme choix de son du kit que SOUND, sans
 * les sons de synthese).
 */
export type SlotTarget = DialId | 'step:vel' | 'smpl:sample';

/** La couche d'un bloc (R3) : ses blocs se mettent en retrait quand elle ne joue pas. */
export type SlotLayer = 'synth' | 'sample';

/**
 * Le dessin d'un bloc : les images des cartes de l'ecran (level, tone,
 * decay, swing, stretch), des crans (notch), un petit potard (bar), un
 * petit potard depuis le centre (barc).
 */
export type SlotDraw = 'level' | 'tone' | 'decay' | 'swing' | 'stretch' | 'notch' | 'bar' | 'barc' | 'start';

export interface PageSlot {
  /** '' : bloc vide */
  label: string;
  /** null : a venir (avec un label) ou vide */
  target: SlotTarget | null;
  scope: 'track' | 'all';
  draw: SlotDraw;
  /** effet global que le kick ne recoit pas */
  noBd?: boolean;
  /** la voix choisie en etiquette (la rangee du haut de FX : les effets de CETTE voix, sous ceux de toute la machine) */
  voiceTag?: boolean;
  /** ce qu'il verrouille sur le pas en LOCK (2026-10-08) ; absent : pas verrouillable (encore) */
  lock?: LockKey | 'vel';
  /** la couche qu'il regle (R3) ; both : les deux (ATTACK et DRIVE du kick, SNAPPY de la caisse claire) */
  layer?: SlotLayer;
  both?: boolean;
  /** le LEVEL de sa couche (R3) : jamais en retrait, il la rallume */
  level?: boolean;
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
/** Un effet de la voix (la rangee du haut de FX) : la voix en etiquette ; DELAY et REVERB se verrouillent (revue de R2). */
const voiceFxSlot = (label: string, target: SlotTarget, lock?: LockKey): PageSlot => ({ ...live(label, target, 'bar'), voiceTag: true, ...(lock ? { lock } : {}) });
/** Un reglage de voix verrouillable pas par pas (2026-10-08). */
const lockable = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey | 'vel'): PageSlot => ({ ...live(label, target, draw), lock });

/** Un reglage d'une couche (R3), verrouillable. */
const layered = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey, layer: SlotLayer, extra: Partial<PageSlot> = {}): PageSlot => ({ ...lockable(label, target, draw, lock), layer, ...extra });

/** TRIG ; STRETCH (toute la machine) y vient de SRC en R3, a cote de SWING. */
const TRIG: readonly PageSlot[] = [
  lockable('VEL', 'step:vel', 'level', 'vel'),
  soon('PROB'),
  soon('MICRO'),
  soon('COND'),
  soon('RTRG'),
  soon('RTIM'),
  live('STRETCH', 'stretch', 'stretch', 'all'),
  live('SWING', 'swing', 'swing', 'all'),
];

/**
 * SMPL, la couche SAMPLE (R3), dans l'ordre de l'Analog Rytm : TUNE FINE REV
 * SAMPLE, START LEN (LOOP plus tard) LEVEL ; REV a la place de BR.
 */
const SMPL: readonly PageSlot[] = [
  layered('TUNE', 'l:tune', 'barc', 'stune', 'sample'),
  layered('FINE', 'l:fine', 'barc', 'sfine', 'sample'),
  layered('REV', 'l:rev', 'notch', 'srev', 'sample'),
  { ...lockable('SAMPLE', 'smpl:sample', 'notch', 'snd'), layer: 'sample', level: true },
  layered('START', 'l:start', 'start', 'sstart', 'sample'),
  layered('LEN', 'l:len', 'decay', 'slen', 'sample'),
  soon('LOOP'),
  layered('LEVEL', 'l:lev', 'level', 'slev', 'sample', { level: true }),
];

const FLTR: readonly PageSlot[] = [soon('ATK'), soon('DEC'), EMPTY, EMPTY, live('TONE', 'tone', 'tone'), soon('RESO'), soon('TYPE'), soon('ENV')];

const AMP: readonly PageSlot[] = [soon('ATK'), soon('HOLD'), lockable('DEC', 'vdecay', 'decay', 'decay'), EMPTY, EMPTY, EMPTY, lockable('PAN', 'vpan', 'barc', 'pan'), lockable('VOL', 'vol', 'level', 'level')];

/** En haut les effets de la voix, dessous ceux de toute la machine, colonne par colonne. */
const FX: readonly PageSlot[] = [
  voiceFxSlot('DIST', 'vdist'),
  voiceFxSlot('CHORUS', 'vchorus'),
  voiceFxSlot('DELAY', 'vdelay', 'delay'),
  voiceFxSlot('REVERB', 'vreverb', 'reverb'),
  live('DIST', 'dist', 'bar', 'all', true),
  live('CHORUS', 'chorus', 'bar', 'all', true),
  live('DELAY', 'delay', 'bar', 'all', true),
  live('REVERB', 'reverb', 'bar', 'all', true),
];

const synth = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey, both = false): PageSlot => layered(label, target, draw, lock, 'synth', both ? { both } : {});

/**
 * SRC, la couche SYNTH (R3) : B a G selon la famille de la voix, comme les
 * machines de l'Analog Rytm (le KICK, la caisse claire, le clap ; les autres
 * le TUNE de la voix en B). Les potards de la machine se verrouillent pas par
 * pas (revue de R2, Mika : "le kick peut etre parametre comme une machine").
 */
function srcMiddle(f: KitFamily | null): readonly PageSlot[] {
  if (f === 'bd')
    return [
      synth('TUNE', 'r:tune', 'barc', 'ktune'),
      synth('ATTACK', 'r:attack', 'bar', 'kattack', true),
      synth('SWEEP', 'r:sweep', 'bar', 'ksweep'),
      synth('DECAY', 'r:decay', 'decay', 'kdecay'),
      synth('DRIVE', 'r:drive', 'bar', 'kdrive', true),
      EMPTY,
    ];
  if (f === 'sd')
    return [
      synth('TUNE', 'r:sdtune', 'barc', 'sdtune'),
      synth('SNAPPY', 'r:snappy', 'bar', 'snappy', true),
      synth('TONE', 'r:sdtone', 'tone', 'sdtone'),
      synth('DECAY', 'r:sddecay', 'decay', 'sddecay'),
      synth('GATE', 'r:gate', 'notch', 'gate'),
      EMPTY,
    ];
  // Le TUNE de la voix (2026-10-08, R2) : toute la voix, au demi-ton ; le clap garde GATE
  const tune = lockable('TUNE', 'vtune', 'barc', 'tune');
  if (f === 'cp') return [tune, EMPTY, synth('GATE', 'r:gate', 'notch', 'gate'), EMPTY, EMPTY, EMPTY];
  return [tune, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
}

const SRC_CACHE = new Map<KitFamily | 'none', readonly PageSlot[]>();

function src(inst: Inst | null): readonly PageSlot[] {
  const f = inst ? familyOf(inst as ShotId) : null;
  const key = f ?? 'none';
  let slots = SRC_CACHE.get(key);
  if (!slots) {
    // A : la MACHINE de la couche SYNTH (909, 808, MM ; CY : sa synthese a elle, sans choix), H : son LEVEL
    const machine: PageSlot = { ...lockable('MACHINE', 'l:mach', 'notch', 'mach'), layer: 'synth', level: true };
    const level = f ? synth('LEVEL', 'l:syn', 'level', 'syn') : EMPTY;
    slots = [machine, ...srcMiddle(f), f ? { ...level, level: true } : EMPTY];
    SRC_CACHE.set(key, slots);
  }
  return slots;
}

/** Les huit blocs de la table d'une page (les reglages a venir compris). */
function tableOf(page: RytmPageId, inst: Inst | null): readonly PageSlot[] {
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

/** Un reglage a venir tant qu'il ne se montre pas (SHOW_SOON) : un emplacement vide. */
const SHOWN = new WeakMap<readonly PageSlot[], readonly PageSlot[]>();
function shown(slots: readonly PageSlot[]): readonly PageSlot[] {
  if (SHOW_SOON) return slots;
  let out = SHOWN.get(slots);
  if (!out) {
    out = slots.map((s) => (s.label && s.target === null ? EMPTY : s));
    SHOWN.set(slots, out);
  }
  return out;
}

/** Les huit blocs d'une page pour la voix choisie (null : aucune), tels que l'ecran, le Dock et le MIDI les voient. */
export function pageSlots(page: RytmPageId, inst: Inst | null): readonly PageSlot[] {
  return shown(tableOf(page, inst));
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
  // Le choix du son (SOUND, la plaque, R3) : MACHINE (SRC) et SAMPLE (SMPL) en sont les deux couches
  const same = (s: PageSlot): boolean =>
    s.target === target || (target === 'vsound' && (s.target === 'smpl:sample' || s.target === 'l:mach')) || (target === 'smpl:sample' && s.target === 'vsound');
  const order = page ? [page, ...RYTM_PAGES.map((p) => p.id).filter((id) => id !== page)] : RYTM_PAGES.map((p) => p.id);
  for (const id of order) {
    const k = pageSlots(id, inst).findIndex(same);
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
