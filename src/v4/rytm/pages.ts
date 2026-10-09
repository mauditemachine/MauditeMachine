/**
 * Les pages du MM-RYTM facon Digitakt (2026-10-08, etape 1, Mika : "8
 * encodeurs assignables a condition de presser les bonnes touches ; l'ecran
 * divise en 8 blocs ; j'adore l'ecran, je veux le meme ecran mais plus
 * utilise ; allons-y petit a petit"). Un bloc ne fait que montrer un reglage
 * qui existe (un DialId, la velocite du pas, le son de la voix, son melange) :
 * - label vide : un bloc vide (rien de dessine) ;
 * - scope 'all' : toute la machine (les FX globaux, SWING, STRETCH), jamais
 *   verrouille ; 'track' : la voix choisie (pattern.instrument) ;
 * - noBd : un effet global que le kick ne recoit pas (il a son propre chemin
 *   depuis le 2026-10-08, audio/drums.ts kickBus) : l'ecran le dit (NO BD) ;
 * - lock : ce qu'il verrouille sur le pas en P-LOCK (vel : la velocite du pas
 *   elle-meme) ; locks : tous les verrous qu'il ecrit (le son et le melange en
 *   posent plusieurs) ;
 * - layer, both, level : la couche qu'il regle (SYNTH, SAMPLE, les deux) ; ses
 *   blocs en retrait quand elle ne joue pas, sauf ceux qui la rallument.
 *
 * L'etape 2 (2026-10-09, Mika : "Je ne comprends pas TRIG, ca doit etre le
 * parametre de la Voice ici.. donc on doit voir c'est quoi le sample.. je veux
 * merge SRC SMPL et TRIG ! ya la place pour mettre tous les parametres dans un
 * seul bouton donc dans l'ecran ! Ensuite on doit avoir un bouton ENV donc
 * AMP doit s'appeler ENV et doit etre plus complet ; on doit ensuite avoir les
 * FX du Voice selectionne mais aussi les FX Globaux, je sais pas comment tu
 * peux les separer") : quatre pages, VOICE FLTR ENV FX (theme.ts
 * RYTM_PAGE_KEYS), et leurs ecrans :
 * - VOICE : ce que joue la voix, en grand (SOUND : OFF, 909, 808, MM, les
 *   samples de sa famille, en une seule liste ; BLUEPRINT + 909 quand les deux
 *   couches jouent), son volume (VOL ; en P-LOCK celui du pas, Mika : "le
 *   volume du voice ou du step selectionne doit se retrouver dans Voice"), VEL
 *   (la velocite des nouveaux pas ; en P-LOCK celle du pas), PITCH et FINE (une
 *   seule hauteur, toute la voix), LEN et REV (le sample). Un second onglet,
 *   SYNTH (BD et SD : la machine de la couche SYNTH, MIX pour la poser sous le
 *   sample, ses potards ; ils ne tiennent pas dans les huit blocs d'un ecran
 *   lisible au telephone). Les voix sans sample (CH OH CP TOM HT CY) ne
 *   montrent pas de blocs de sample vides ;
 * - FLTR : un vrai filtre par coup (FREQ RESO TYPE, son enveloppe ATK DEC ENV,
 *   audio/voicefx.ts), TONE (la bascule de la voix), et sa courbe ;
 * - ENV (l'ancien AMP) : ATK HOLD DEC (l'enveloppe du coup), START, PAN, et son
 *   dessin AHD sur trois blocs ;
 * - FX : deux onglets, VOICE FX (DIST CHORUS DELAY REVERB de la voix, tous
 *   verrouillables, en quatre grands blocs) et GLOBAL FX (les huit FX de la
 *   machine, ceux des encodeurs du desktop, dans le meme ordre).
 * Un ecran (RytmScreenId) est une page ou l'un de ses onglets ; ses blocs se
 * posent dans la grille de 4 x 2, dans l'ordre, chacun sur w colonnes et h
 * rangees (SOUND : 2 x 1, le dessin de ENV : 3 x 1, les FX de la voix : 1 x
 * 2). Le bloc k d'un ecran est le potard k (rytm:knob:k+1, le MIDI et le
 * Roto ; lcd-blk-k au doigt et a la souris).
 * Une table pure : elle n'importe que des types, familyOf et la liste des
 * touches (theme.ts).
 */

import type { DialId } from '../actions';
import type { LockKey } from '../audio/locks';
import { familyOf, type KitFamily } from '../audio/kit';
import type { ShotId } from '../audio/shotsdsp';
import { RYTM_PAGE_KEYS, type Inst } from '../theme';

export type RytmPageId = (typeof RYTM_PAGE_KEYS)[number]['id'];

/** Les ecrans : une page, ou l'un de ses onglets (VOICE et SYNTH ; VOICE FX et GLOBAL FX). */
export type RytmScreenId = 'voice' | 'synth' | 'fltr' | 'env' | 'fxv' | 'fxg';
export const RYTM_SCREENS: readonly RytmScreenId[] = ['voice', 'synth', 'fltr', 'env', 'fxv', 'fxg'];
export const isRytmScreen = (v: unknown): v is RytmScreenId => typeof v === 'string' && (RYTM_SCREENS as readonly string[]).includes(v);

/** L'ordre des pages (les touches de page, [ et ] en font le tour). */
export const RYTM_PAGES: readonly { id: RytmPageId; label: string }[] = RYTM_PAGE_KEYS;

/** Les onglets de chaque page, dans l'ordre (la touche de la page allumee pressee encore passe au suivant). */
export const PAGE_TABS: Readonly<Record<RytmPageId, readonly RytmScreenId[]>> = { voice: ['voice', 'synth'], fltr: ['fltr'], env: ['env'], fx: ['fxv', 'fxg'] };
/** La page d'un ecran. */
export const SCREEN_PAGE: Readonly<Record<RytmScreenId, RytmPageId>> = { voice: 'voice', synth: 'voice', fltr: 'fltr', env: 'env', fxv: 'fx', fxg: 'fx' };
/** Le nom d'un onglet (l'en-tete, ses pastilles) ; celui d'une page sans onglet est le sien. */
export const SCREEN_LABEL: Readonly<Record<RytmScreenId, string>> = { voice: 'MAIN', synth: 'SYNTH', fltr: 'FLTR', env: 'ENV', fxv: 'VOICE', fxg: 'GLOBAL' };
/** Le titre d'un ecran, en toutes lettres (le pied, l'en-tete du P-LOCK, l'ecran du MIDI) : VOICE, VOICE SYNTH, GLOBAL FX. */
export const SCREEN_TITLE: Readonly<Record<RytmScreenId, string>> = { voice: 'VOICE', synth: 'VOICE SYNTH', fltr: 'FLTR', env: 'ENV', fxv: 'VOICE FX', fxg: 'GLOBAL FX' };

/**
 * Les anciens noms de page (TRIG SRC SMPL FLTR AMP FX jusqu'au 2026-10-09) :
 * une page retenue, le MIDI rytm:page:<ancien>, l'INFOS d'avant. TRIG, SRC et
 * SMPL ouvrent VOICE, AMP ouvre ENV.
 */
export const PAGE_ALIAS: Readonly<Record<string, RytmPageId>> = { trig: 'voice', src: 'voice', smpl: 'voice', amp: 'env', voice: 'voice', fltr: 'fltr', env: 'env', fx: 'fx' };
/** Une page, d'un nom d'aujourd'hui ou d'avant ; null : aucune. */
export const pageOfAlias = (v: unknown): RytmPageId | null => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(PAGE_ALIAS, v) ? PAGE_ALIAS[v] : null);

/**
 * Les reglages a venir a l'ecran (2026-10-08, revue de l'etape R1) : non, ils
 * ne se dessinent pas, leur bloc est vide comme un emplacement libre.
 */
export const SHOW_SOON = false;

/** La page de depart (2026-10-09) : VOICE, ce que la voix joue. */
export const DEFAULT_PAGE: RytmPageId = 'voice';

/**
 * La page ne suit plus le reglage touche (2026-10-08, les touches de page
 * existent) : un potard absolu (TWEAKS sous le capot, MIDI rytm:enc:...)
 * n'allume son bloc que sur l'ecran affiche.
 */
export const FOLLOW_TOUCH = false;

/**
 * Ce que montre un bloc : un potard (DialId), la velocite (step:vel : celle du
 * pas en P-LOCK, sinon celle des nouveaux pas de la voix), le son de la voix
 * (voice:sound, la liste unique de VOICE), le melange de ses deux couches
 * (voice:mix), l'echantillon de la couche SAMPLE (smpl:sample, l'ancien SMPL
 * SAMPLE : le MIDI et l'INFOS le connaissent encore).
 */
export type SlotTarget = DialId | 'step:vel' | 'smpl:sample' | 'voice:sound' | 'voice:mix';

/** La couche d'un bloc (R3) : ses blocs se mettent en retrait quand elle ne joue pas. */
export type SlotLayer = 'synth' | 'sample';

/**
 * Le dessin d'un bloc : les images des cartes de l'ecran (level, tone,
 * decay, swing, stretch), des crans (notch), un petit potard (bar), un
 * petit potard depuis le centre (barc) ; depuis le 2026-10-09 le son (sound,
 * le grand bloc de VOICE), le melange (mix), l'attaque et la tenue (atk,
 * hold), le filtre (cut, reso, ftype), le temps du delay (time).
 */
export type SlotDraw =
  | 'level'
  | 'tone'
  | 'decay'
  | 'swing'
  | 'stretch'
  | 'notch'
  | 'bar'
  | 'barc'
  | 'start'
  | 'sound'
  | 'mix'
  | 'atk'
  | 'hold'
  | 'cut'
  | 'reso'
  | 'ftype'
  | 'time';

/** Un dessin qui n'est pas un reglage (2026-10-09) : l'enveloppe AHD de ENV, la courbe du filtre de FLTR. */
export type SlotGraph = 'ahd' | 'filter';

export interface PageSlot {
  /** '' : bloc vide */
  label: string;
  /** null : vide, a venir, ou un dessin (graph) */
  target: SlotTarget | null;
  scope: 'track' | 'all';
  draw: SlotDraw;
  /** effet global que le kick ne recoit pas */
  noBd?: boolean;
  /** la voix choisie en etiquette (les FX de la voix, 2026-10-08) */
  voiceTag?: boolean;
  /** ce qu'il verrouille sur le pas en P-LOCK ; absent : pas verrouillable */
  lock?: LockKey | 'vel';
  /** tous les verrous qu'il ecrit (le son, le melange : plusieurs) ; absent : lock seul */
  locks?: readonly LockKey[];
  /** la couche qu'il regle (R3) ; both : les deux (ATTACK et DRIVE du kick, SNAPPY de la caisse claire) */
  layer?: SlotLayer;
  both?: boolean;
  /** le LEVEL de sa couche (R3) : jamais en retrait, il la rallume */
  level?: boolean;
  /** sa place dans la grille de 4 x 2 : w colonnes, h rangees (1 et 1 par defaut) */
  w?: number;
  h?: number;
  /** un dessin, pas un reglage : aucune zone, aucun potard */
  graph?: SlotGraph;
  /** un potard de la machine de synthese (VOICE SYNTH, le GATE du clap) : l'etiquette MACHINE */
  machine?: boolean;
  /** le nom court de son verrou dans les listes (F.ATK sur FLTR, S.LEN) ; absent : son nom */
  lockName?: string;
}

export const isRytmPage = (v: unknown): v is RytmPageId => RYTM_PAGES.some((p) => p.id === v);
export const pageLabel = (p: RytmPageId | RytmScreenId): string => (isRytmPage(p) ? (RYTM_PAGES.find((x) => x.id === p)?.label ?? p.toUpperCase()) : SCREEN_TITLE[p]);

const EMPTY: PageSlot = { label: '', target: null, scope: 'track', draw: 'bar' };
const live = (label: string, target: SlotTarget, draw: SlotDraw, scope: PageSlot['scope'] = 'track', noBd = false): PageSlot => ({
  label,
  target,
  scope,
  draw,
  ...(noBd ? { noBd } : {}),
});
/** Un reglage de voix verrouillable pas par pas. */
const lockable = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey | 'vel', extra: Partial<PageSlot> = {}): PageSlot => ({ ...live(label, target, draw), lock, ...extra });
/** Un reglage d'une couche (R3), verrouillable. */
const layered = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey, layer: SlotLayer, extra: Partial<PageSlot> = {}): PageSlot => ({ ...lockable(label, target, draw, lock), layer, ...extra });
/** Un potard de la machine de synthese (VOICE SYNTH). */
const synth = (label: string, target: SlotTarget, draw: SlotDraw, lock: LockKey, both = false): PageSlot => layered(label, target, draw, lock, 'synth', { machine: true, ...(both ? { both } : {}) });

/* ---------------- VOICE (2026-10-09) ---------------- */

/** SOUND : le grand bloc de VOICE, ce que la voix joue (une liste : OFF, 909, 808, MM, ses samples). */
const SOUND: PageSlot = { ...lockable('SOUND', 'voice:sound', 'sound', 'snd', { locks: ['snd', 'mach', 'syn', 'slev'], level: true }), w: 2 };
const VOL = lockable('VOL', 'vol', 'level', 'level');
const VEL = lockable('VEL', 'step:vel', 'level', 'vel');
// PITCH et FINE (et START de ENV) reglent toute la voix : sans l'etiquette BOTH (la revue du 2026-10-09 : au telephone
// elle coupait ROOT et FROM TOP), elle reste aux potards de machine qui touchent aussi le sample (ATTACK, DRIVE, SNAPPY)
const PITCH: PageSlot = lockable('PITCH', 'vtune', 'barc', 'tune');
const FINE: PageSlot = lockable('FINE', 'vfine', 'barc', 'fine');
const LEN = layered('LEN', 'l:len', 'decay', 'slen', 'sample', { lockName: 'S.LEN' });
const REV = layered('REV', 'l:rev', 'notch', 'srev', 'sample', { lockName: 'S.REV' });
const MIX: PageSlot = { ...lockable('MIX', 'voice:mix', 'mix', 'syn', { locks: ['syn', 'slev'], level: true }) };
// Sans l'etiquette MACHINE : le bloc est la machine elle-meme (la revue du 2026-10-09 : MACHINE et ses crans se chevauchaient)
const MACHINE: PageSlot = { ...lockable('MACHINE', 'l:mach', 'notch', 'mach'), layer: 'synth' };

/** Les familles qui ont des samples (audio/samples.ts : BD et SD) : LEN, REV et l'onglet SYNTH. */
const SAMPLE_FAMS: ReadonlySet<KitFamily> = new Set(['bd', 'sd']);

/** VOICE, l'onglet principal, selon la famille de la voix. */
function voiceMain(f: KitFamily | null): readonly PageSlot[] {
  if (f && SAMPLE_FAMS.has(f)) return [SOUND, VOL, VEL, PITCH, FINE, LEN, REV];
  // Le clap garde GATE (la piece de son 909 et de son MM), sa seule touche de machine
  if (f === 'cp') return [SOUND, VOL, VEL, PITCH, FINE, synth('GATE', 'r:gate', 'notch', 'gate')];
  return [SOUND, VOL, VEL, PITCH, FINE];
}

/** VOICE SYNTH (BD, SD) : la machine de la couche SYNTH, MIX (la synthese sous le sample), ses potards. */
function voiceSynth(f: KitFamily | null): readonly PageSlot[] {
  if (f === 'bd')
    return [
      MACHINE,
      MIX,
      synth('TUNE', 'r:tune', 'barc', 'ktune'),
      synth('ATTACK', 'r:attack', 'bar', 'kattack', true),
      synth('SWEEP', 'r:sweep', 'bar', 'ksweep'),
      synth('DECAY', 'r:decay', 'decay', 'kdecay'),
      synth('DRIVE', 'r:drive', 'bar', 'kdrive', true),
    ];
  if (f === 'sd')
    return [
      MACHINE,
      MIX,
      synth('TUNE', 'r:sdtune', 'barc', 'sdtune'),
      synth('SNAPPY', 'r:snappy', 'bar', 'snappy', true),
      synth('TONE', 'r:sdtone', 'barc', 'sdtone'),
      synth('DECAY', 'r:sddecay', 'decay', 'sddecay'),
      synth('GATE', 'r:gate', 'notch', 'gate', true),
    ];
  return [];
}

/* ---------------- FLTR, ENV, FX (2026-10-09) ---------------- */

const FLTR: readonly PageSlot[] = [
  lockable('FREQ', 'vfcut', 'cut', 'fcut'),
  lockable('RESO', 'vfreso', 'reso', 'freso'),
  lockable('TYPE', 'vftype', 'ftype', 'ftype'),
  lockable('TONE', 'tone', 'tone', 'tone'),
  lockable('ATK', 'vfatk', 'atk', 'fatk', { lockName: 'F.ATK' }),
  lockable('DEC', 'vfdec', 'decay', 'fdec', { lockName: 'F.DEC' }),
  lockable('ENV', 'vfenv', 'barc', 'fenv', { lockName: 'F.ENV' }),
  { label: 'FILTER', target: null, scope: 'track', draw: 'bar', graph: 'filter' },
];

/** ENV (l'ancien AMP) : l'enveloppe du coup, d'ou il part, sa place ; VOL est passe dans VOICE. */
const ENV: readonly PageSlot[] = [
  lockable('ATK', 'vatk', 'atk', 'atk'),
  lockable('HOLD', 'vhold', 'hold', 'hold'),
  lockable('DEC', 'vdecay', 'decay', 'decay'),
  lockable('START', 'vstart', 'start', 'start'),
  lockable('PAN', 'vpan', 'barc', 'pan'),
  { label: 'AMP ENV', target: null, scope: 'track', draw: 'bar', graph: 'ahd', w: 3 },
];

/** Un FX de la voix (VOICE FX) : un grand bloc sur deux rangees, la voix en etiquette, verrouillable. */
const voiceFx = (label: string, target: SlotTarget, lock: LockKey): PageSlot => ({ ...lockable(label, target, 'bar', lock), voiceTag: true, h: 2 });
const FXV: readonly PageSlot[] = [voiceFx('DIST', 'vdist', 'dist'), voiceFx('CHORUS', 'vchorus', 'chorus'), voiceFx('DELAY', 'vdelay', 'delay'), voiceFx('REVERB', 'vreverb', 'reverb')];

/** GLOBAL FX : les huit encodeurs du desktop, dans le meme ordre (theme.ts GLOBAL_ENCODERS) ; jamais verrouilles. */
const FXG: readonly PageSlot[] = [
  live('DIST', 'dist', 'bar', 'all', true),
  live('CHORUS', 'chorus', 'bar', 'all', true),
  live('DELAY', 'delay', 'bar', 'all', true),
  live('REVERB', 'reverb', 'bar', 'all', true),
  live('STRETCH', 'stretch', 'stretch', 'all'),
  live('SWING', 'swing', 'swing', 'all'),
  // Le temps et le retour du bus DELAY : le DELAY du kick (VOICE FX) y passe aussi, pas de NO BD
  live('DLY TIME', 'dtime', 'time', 'all'),
  live('DLY FB', 'dfb', 'bar', 'all'),
];

const CACHE = new Map<string, readonly PageSlot[]>();

/** Les blocs d'un ecran pour la voix choisie (null : aucune), tels que l'ecran, le Dock et le MIDI les voient. */
export function pageSlots(screen: RytmScreenId, inst: Inst | null): readonly PageSlot[] {
  const f = inst ? familyOf(inst as ShotId) : null;
  const key = `${screen}|${f ?? (inst ? 'own' : 'none')}`;
  let out = CACHE.get(key);
  if (out) return out;
  switch (screen) {
    case 'voice':
      out = voiceMain(f);
      break;
    case 'synth':
      out = voiceSynth(f);
      break;
    case 'fltr':
      out = FLTR;
      break;
    case 'env':
      out = ENV;
      break;
    case 'fxv':
      out = FXV;
      break;
    default:
      out = FXG;
  }
  CACHE.set(key, out);
  return out;
}

/** Les onglets d'une page pour cette voix (VOICE SYNTH : BD et SD seulement). */
export function screensOf(page: RytmPageId, inst: Inst | null): readonly RytmScreenId[] {
  if (page !== 'voice') return PAGE_TABS[page];
  const f = inst ? familyOf(inst as ShotId) : null;
  return f && SAMPLE_FAMS.has(f) ? PAGE_TABS.voice : ['voice'];
}

/** L'ecran d'une page a l'onglet tab (un onglet qui n'existe pas pour cette voix : le premier). */
export function screenOf(page: RytmPageId, tab: number, inst: Inst | null): RytmScreenId {
  const list = screensOf(page, inst);
  return list[Math.max(0, Math.min(list.length - 1, Math.round(tab)))] ?? list[0];
}

/** Les ecrans de toutes les pages pour cette voix, dans l'ordre (les listes des verrous). */
export function allScreens(inst: Inst | null): readonly RytmScreenId[] {
  return RYTM_PAGES.flatMap((p) => screensOf(p.id, inst));
}

/* ---------------- la grille (2026-10-09) ---------------- */

/** La place d'un bloc dans la grille de 4 x 2 : sa colonne, sa rangee, sa largeur et sa hauteur en cases. */
export interface SlotCell {
  c: number;
  r: number;
  w: number;
  h: number;
}

const GRID_COLS = 4;
const GRID_ROWS = 2;
const CELLS = new WeakMap<readonly PageSlot[], readonly SlotCell[]>();

/**
 * Les cases des blocs d'un ecran : chacun a la premiere place libre (de
 * gauche a droite, de haut en bas) ou il tient sur ses w x h cases. Le bloc
 * k garde son rang (le potard k, le MIDI rytm:knob:k+1).
 */
export function slotCells(slots: readonly PageSlot[]): readonly SlotCell[] {
  let out = CELLS.get(slots);
  if (out) return out;
  const used: boolean[] = new Array(GRID_COLS * GRID_ROWS).fill(false);
  const fits = (c: number, r: number, w: number, h: number): boolean => {
    if (c + w > GRID_COLS || r + h > GRID_ROWS) return false;
    for (let y = r; y < r + h; y += 1) for (let x = c; x < c + w; x += 1) if (used[y * GRID_COLS + x]) return false;
    return true;
  };
  out = slots.map((s) => {
    const w = s.w ?? 1;
    const h = s.h ?? 1;
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i += 1) {
      const c = i % GRID_COLS;
      const r = Math.floor(i / GRID_COLS);
      if (!fits(c, r, w, h)) continue;
      for (let y = r; y < r + h; y += 1) for (let x = c; x < c + w; x += 1) used[y * GRID_COLS + x] = true;
      return { c, r, w, h };
    }
    return { c: 0, r: 0, w: 0, h: 0 };
  });
  CELLS.set(slots, out);
  return out;
}

/** Les cases que l'ecran laisse libres (ni bloc ni dessin) : colonne, rangee. */
export function freeCells(slots: readonly PageSlot[]): { c: number; r: number }[] {
  const cells = slotCells(slots);
  const out: { c: number; r: number }[] = [];
  for (let r = 0; r < GRID_ROWS; r += 1)
    for (let c = 0; c < GRID_COLS; c += 1) if (!cells.some((x, k) => slots[k].label && c >= x.c && c < x.c + x.w && r >= x.r && r < x.r + x.h)) out.push({ c, r });
  return out;
}

/**
 * L'ecran et le bloc d'un reglage pour cette voix, null s'il n'est sur aucun
 * ecran (MASTER, TEMPO, le MM-ARP) : un choix de son r:<famille> est SOUND
 * quand c'est la famille de la voix ; SOUND, SAMPLE (l'ancien) et le raccourci
 * vsound sont le meme reglage. screen : celui qu'on regarde, d'abord.
 */
export function slotOf(t: SlotTarget, inst: Inst | null, screen?: RytmScreenId): { page: RytmScreenId; k: number } | null {
  const f = inst ? familyOf(inst as ShotId) : null;
  const sound = (x: SlotTarget): boolean => x === 'vsound' || x === 'smpl:sample' || x === 'voice:sound' || (x.startsWith('r:') && f !== null && x.slice(2) === f);
  const same = (s: PageSlot): boolean => s.target !== null && (s.target === t || (sound(t) && sound(s.target)) || ((t === 'l:syn' || t === 'l:lev') && s.target === 'voice:mix'));
  const all = allScreens(inst);
  const order = screen ? [screen, ...all.filter((id) => id !== screen)] : all;
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
