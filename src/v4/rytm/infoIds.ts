/**
 * Les ids des INFOS du MM-RYTM (2026-10-08, l'etape R4, Mika : "excellent
 * pour le bouton INFO ! je veux un petit bouton i dans l'ecran a activer et
 * de ce fait on peut voir les infos au survol.. et je veux la meme chose pour
 * RYTM aussi !") : la partie legere des INFOS, comme voyager/infoIds.ts.
 * Sortie de rytm/diagrams.ts a l'etape R4 pour que la face (la couche de
 * saisie, le Stage, l'ecran) sache quelle commande a une carte sans emporter
 * les dessins ni les textes, qui arrivent avec la carte (rytm/InfosCard.tsx,
 * chargee a part). Rien que des tables et des types : aucun moteur.
 *
 * L'etape 2 (2026-10-09, Mika : "je veux merge SRC SMPL et TRIG ! ... AMP doit
 * s'appeler ENV et doit etre plus complet ; on doit ensuite avoir les FX du
 * Voice selectionne mais aussi les FX Globaux") : quatre pages, VOICE FLTR
 * ENV FX, et leurs ecrans (rytm/pages.ts) ; la table des blocs n'est plus
 * recopiee ici, elle se lit dans pages.ts (pageSlots) : la carte suit
 * toujours l'ecran.
 *
 * Les ids ne dependent pas de la disposition des zones de saisie :
 * - les pages : voice fltr env fx (leurs touches) ; les onglets synth (VOICE
 *   SYNTH), fxv (VOICE FX), fxg (GLOBAL FX) ; les anciens noms (trig src smpl
 *   amp) et les anciens reglages a venir devenus reels (soon:fatk...) se
 *   rendent sous leur nouveau nom (OLD_IDS) ;
 * - les reglages des ecrans : leur DialId (actions.ts : vdecay, vol, tone,
 *   vfcut, dtime...), step:vel, voice:sound (SOUND), voice:mix (MIX) et
 *   smpl:sample (l'ancien SAMPLE, le MIDI le connait encore) ; vsound, le
 *   raccourci SOUND du kit (le MIDI rytm:enc:vsound) ;
 * - les choix de son de la plaque TWEAKS : r:bd r:sd r:cp r:hh r:tom ;
 * - les reglages a venir de l'etude (soon:prob...) ;
 * - les couches de l'etape R3 (r3:machine...), sous leurs ids d'alors ;
 * - les commandes fixes : pad:BD a pad:CY, step, lock, run, clear, random,
 *   mute, solo, edit, open, close, level (MASTER), tempo, screen, presets,
 *   seek, ikey (la touche i), home, enc (une case vide).
 * Les encodeurs du desktop (penc-<k>) sont les FX globaux depuis l'etape 2
 * (theme.ts GLOBAL_ENCODERS) : leur carte est celle de leur FX.
 */

import { GLOBAL_ENCODERS, type Inst } from '../theme';
import { RYTM_PAGES, SCREEN_TITLE, allScreens, pageSlots, slotCells, type PageSlot, type RytmPageId, type RytmScreenId, type SlotTarget } from './pages';

/* ---------------- les ids ---------------- */

/** Les voix, dans l'ordre des pads (BD SD CH OH en haut, CP TOM HT CY dessous). */
export const RYTM_INFO_VOICES = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as const satisfies readonly Inst[];

/** Les quatre touches de page (2026-10-09, theme.ts RYTM_PAGE_KEYS). */
export const RYTM_INFO_PAGES = ['voice', 'fltr', 'env', 'fx'] as const satisfies readonly RytmPageId[];
export type RytmInfoPage = (typeof RYTM_INFO_PAGES)[number];
/** Les onglets qui ont leur carte (VOICE SYNTH, VOICE FX, GLOBAL FX) ; VOICE MAIN est la carte de VOICE. */
export const RYTM_INFO_TABS = ['synth', 'fxv', 'fxg'] as const satisfies readonly RytmScreenId[];
export type RytmInfoTab = (typeof RYTM_INFO_TABS)[number];
/** Le nom d'une page ou d'un onglet (la section d'une carte, son titre). */
export const RYTM_INFO_PAGE_LABEL: Readonly<Record<RytmInfoPage | RytmInfoTab | RytmScreenId, string>> = { ...SCREEN_TITLE, fx: 'FX' };

/** Les reglages des ecrans, par leur cible (le DialId de actions.ts, step:vel, voice:sound, voice:mix, smpl:sample). */
export const RYTM_PARAM_IDS = [
  'voice:sound',
  'vol',
  'step:vel',
  'vtune',
  'vfine',
  'voice:mix',
  'vsound',
  'smpl:sample',
  'r:tune',
  'r:attack',
  'r:decay',
  'r:drive',
  'r:snappy',
  'r:gate',
  'vfcut',
  'vfreso',
  'vftype',
  'tone',
  'vfatk',
  'vfdec',
  'vfenv',
  'vatk',
  'vhold',
  'vdecay',
  'vstart',
  'vpan',
  'vdist',
  'vchorus',
  'vdelay',
  'vreverb',
  'dist',
  'chorus',
  'delay',
  'reverb',
  'stretch',
  'swing',
  'dtime',
  'dfb',
] as const;
export type RytmParamId = (typeof RYTM_PARAM_IDS)[number];

/** Les choix de son de la plaque TWEAKS (OPEN) : KICK, SNARE, CLAP, HATS, TOMS. */
export const RYTM_PLATE_SOUND_IDS = ['r:bd', 'r:sd', 'r:cp', 'r:hh', 'r:tom'] as const;
export type RytmPlateSoundId = (typeof RYTM_PLATE_SOUND_IDS)[number];

/** Les potards de la plaque TWEAKS, dans l'ordre de scene/rytmTweaks.ts (KIT_IDS). */
export const RYTM_PLATE_IDS = ['r:bd', 'r:tune', 'r:attack', 'r:decay', 'r:drive', 'r:sd', 'r:snappy', 'r:cp', 'r:gate', 'r:hh', 'r:tom'] as const;

/**
 * Les reglages a venir de l'etude (inv/rytm-synthesis.md 2.2), sur aucun
 * ecran pour l'instant ; le filtre et l'enveloppe complete sont arrives a
 * l'etape 2 (2026-10-09 : leurs anciens ids se rendent sous leur nom, OLD_IDS).
 */
export const RYTM_SOON_IDS = ['soon:prob', 'soon:micro', 'soon:cond', 'soon:rtrg', 'soon:rtim', 'soon:br', 'soon:loop'] as const;
export type RytmSoonId = (typeof RYTM_SOON_IDS)[number];

/**
 * Les couches de l'etape R3 (Mika, 2026-10-08 : "comme la ANALOG Rytm ou on
 * peut mettre des samples mais le kick peut etre parametre comme une
 * machine") : MACHINE, SYNTH LEVEL, SWEEP, TUNE DECAY TONE de la caisse claire
 * de synthese, et la couche SAMPLE (TUNE, FINE, START, LEN, LEVEL, REV). Leurs
 * cibles dans actions.ts : l:mach, l:syn, r:sweep, r:sdtune, r:sddecay,
 * r:sdtone, l:tune, l:fine, l:start, l:len, l:lev, l:rev (TARGET_INFO). Depuis
 * l'etape 2, VOICE montre LEN et REV, VOICE SYNTH la machine ; TUNE, FINE et
 * START du sample seul n'ont plus de bloc (PITCH, FINE et START reglent toute
 * la voix), leurs cartes restent pour le MIDI et les verrous d'avant.
 */
export const RYTM_R3_IDS = ['r3:machine', 'r3:synlevel', 'r3:sweep', 'r3:sdtune', 'r3:sddecay', 'r3:sdtone', 'r3:stune', 'r3:sfine', 'r3:sstart', 'r3:send', 'r3:smplevel', 'r3:reverse'] as const;
export type RytmR3Id = (typeof RYTM_R3_IDS)[number];

/** Les commandes fixes de la face, de l'ecran et du capot. */
export const RYTM_CONTROL_IDS = [
  'pad:BD',
  'pad:SD',
  'pad:CH',
  'pad:OH',
  'pad:CP',
  'pad:TOM',
  'pad:HT',
  'pad:CY',
  'step',
  'lock',
  'run',
  'clear',
  'random',
  'mute',
  'solo',
  'edit',
  'open',
  'close',
  'level',
  'tempo',
  'screen',
  'presets',
  'seek',
  'ikey',
  'home',
  'enc',
] as const;
export type RytmControlId = (typeof RYTM_CONTROL_IDS)[number];

export type RytmInfoId = RytmInfoPage | RytmInfoTab | RytmParamId | RytmPlateSoundId | RytmSoonId | RytmR3Id | RytmControlId;

export const RYTM_INFO_IDS: readonly RytmInfoId[] = [
  ...RYTM_INFO_PAGES,
  ...RYTM_INFO_TABS,
  ...RYTM_PARAM_IDS,
  ...RYTM_PLATE_SOUND_IDS,
  ...RYTM_SOON_IDS,
  ...RYTM_R3_IDS,
  ...RYTM_CONTROL_IDS,
];
const ID_SET: ReadonlySet<string> = new Set(RYTM_INFO_IDS);
export const isRytmInfoId = (s: unknown): s is RytmInfoId => typeof s === 'string' && ID_SET.has(s);

/**
 * Les ids d'avant l'etape 2 (2026-10-09) : les pages TRIG, SRC et SMPL (dans
 * VOICE), AMP (ENV), et les reglages a venir devenus reels. Un test, un lien
 * ou un vieux store qui les nomme lit la carte d'aujourd'hui.
 */
const OLD_IDS: Readonly<Record<string, RytmInfoId>> = {
  trig: 'voice',
  src: 'voice',
  smpl: 'voice',
  amp: 'env',
  'soon:fatk': 'vfatk',
  'soon:fdec': 'vfdec',
  'soon:freq': 'vfcut',
  'soon:reso': 'vfreso',
  'soon:ftype': 'vftype',
  'soon:fenv': 'vfenv',
  'soon:attack': 'vatk',
  'soon:hold': 'vhold',
};
/** Un id de carte, d'aujourd'hui ou d'avant l'etape 2 ; null : inconnu. */
export const rytmInfoIdOf = (s: unknown): RytmInfoId | null => (isRytmInfoId(s) ? s : typeof s === 'string' && Object.prototype.hasOwnProperty.call(OLD_IDS, s) ? OLD_IDS[s] : null);

/**
 * Ce qui existe deja (live), ce qui viendra (soon : l'etude). Les couches de
 * R3 sont branchees (2026-10-08, revue de R3) : leurs cartes sont vivantes,
 * leurs ids r3:* restent (ils sont stables, le MIDI et les tests les lisent).
 */
export type RytmInfoAvail = 'live' | 'soon';
export const rytmAvail = (id: RytmInfoId): RytmInfoAvail => (id.startsWith('soon:') ? 'soon' : 'live');

/** Les familles de sons (audio/kit.ts familyOf) ; cy : la cymbale, un seul son. */
export type RytmVoiceGroup = 'bd' | 'sd' | 'hh' | 'cp' | 'tom' | 'cy';
export function voiceGroup(v: Inst): RytmVoiceGroup {
  if (v === 'BD') return 'bd';
  if (v === 'SD') return 'sd';
  if (v === 'CH' || v === 'OH') return 'hh';
  if (v === 'CP') return 'cp';
  if (v === 'TOM' || v === 'HT') return 'tom';
  return 'cy';
}

/* ---------------- les blocs de chaque ecran (rytm/pages.ts) ---------------- */

/** Les cibles de actions.ts (pageTarget) qui ont une carte d'un autre nom : les couches de R3. */
const TARGET_INFO: Readonly<Record<string, RytmInfoId>> = {
  'l:mach': 'r3:machine',
  'l:syn': 'r3:synlevel',
  'r:sweep': 'r3:sweep',
  'r:sdtune': 'r3:sdtune',
  'r:sddecay': 'r3:sddecay',
  'r:sdtone': 'r3:sdtone',
  'l:tune': 'r3:stune',
  'l:fine': 'r3:sfine',
  'l:start': 'r3:sstart',
  'l:len': 'r3:send',
  'l:lev': 'r3:smplevel',
  'l:rev': 'r3:reverse',
};

/** La carte d'une cible de bloc (pages.ts SlotTarget), 'enc' si elle n'en a pas. */
export const infoIdOfTarget = (t: SlotTarget | string): RytmInfoId => {
  const id = TARGET_INFO[t] ?? t;
  return isRytmInfoId(id) ? id : 'enc';
};

/** Un bloc d'un ecran, lu pour sa carte : son reglage, son nom, sa place dans la grille de 4 x 2 ; graph : un dessin. */
export interface RytmSlot {
  id: RytmInfoId;
  label: string;
  c: number;
  r: number;
  w: number;
  h: number;
  graph?: boolean;
}

/** La lettre d'un bloc : son rang sur l'ecran (A pour le premier, rytm:knob:1 au MIDI). */
export const RYTM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const SLOT_CACHE = new WeakMap<readonly PageSlot[], readonly RytmSlot[]>();

/** Les blocs d'un ecran pour la voix choisie, dans leur ordre (le bloc k est le potard k), les dessins compris. */
export function rytmSlots(screen: RytmScreenId, voice: Inst | null): readonly RytmSlot[] {
  const slots = pageSlots(screen, voice);
  let out = SLOT_CACHE.get(slots);
  if (out) return out;
  const cells = slotCells(slots);
  out = slots.map((s, k) => ({
    id: s.graph || !s.target ? ('enc' as const) : infoIdOfTarget(s.target),
    label: s.label,
    ...cells[k],
    ...(s.graph ? { graph: true } : {}),
  }));
  SLOT_CACHE.set(slots, out);
  return out;
}

/** L'ecran d'une page, ou l'onglet d'une carte (fx : VOICE FX, son premier onglet). */
export const screenOfInfo = (id: RytmInfoPage | RytmInfoTab): RytmScreenId => (id === 'fx' ? 'fxv' : id);

/** L'ecran et le bloc d'un reglage pour cette voix (l'ecran regarde d'abord), null s'il n'est sur aucun ecran. */
export function rytmSlotOf(id: RytmInfoId, voice: Inst | null, screen?: RytmScreenId): { page: RytmScreenId; k: number } | null {
  const all = allScreens(voice);
  const order = screen ? [screen, ...all.filter((x) => x !== screen)] : all;
  for (const p of order) {
    const k = rytmSlots(p, voice).findIndex((x) => !x.graph && x.id === id);
    if (k >= 0) return { page: p, k };
  }
  return null;
}

/** L'id d'un reglage a venir d'apres son nom (plus aucun ecran n'en montre depuis l'etape 2) ; null sinon. */
export function soonInfoId(_page: RytmScreenId, _label: string, _voice: Inst | null = null): RytmInfoId | null {
  return null;
}

/** Ce qu'il faut pour savoir ce que tient un bloc de l'ecran. */
export interface RytmResolveCtx {
  /** la voix choisie (pattern.instrument), null : aucune */
  voice?: Inst | null;
  /** l'ecran affiche (rytmPage.screen) ; VOICE par defaut (la page de depart) */
  page?: RytmScreenId;
  /**
   * la cible resolue par l'appelant (actions.ts pageTarget(k) : un DialId,
   * step:vel, voice:sound... ; null : vide ou un dessin) ; passe avant la table
   */
  target?: string | null;
  /** les reglages a venir ont leur carte ; sinon la case vide (enc), comme a l'ecran (pages.ts SHOW_SOON) */
  soon?: boolean;
}

/**
 * L'id de carte d'une commande : un bloc de l'ecran (p:0 a p:7) donne le
 * reglage qu'il tient sur l'ecran affiche pour la voix choisie, enc pour une
 * case vide ; un autre id connu (ou d'avant l'etape 2) se rend sous son nom
 * d'aujourd'hui ; null : inconnu.
 */
export function resolveRytmId(id: string, c: RytmResolveCtx = {}): RytmInfoId | null {
  const m = /^p:([0-7])$/.exec(id);
  if (!m) return rytmInfoIdOf(id);
  if (c.target !== undefined) return c.target === null ? 'enc' : infoIdOfTarget(c.target);
  const slot = rytmSlots(c.page ?? 'voice', c.voice ?? null)[Number(m[1])];
  if (!slot || slot.graph) return 'enc';
  if (rytmAvail(slot.id) !== 'live' && !c.soon) return 'enc';
  return slot.id;
}

/* ---------------- les zones de saisie (scene/*, etape R2) ---------------- */

/** Une zone de saisie du MM-RYTM lue : sa carte, et ce qu'elle dit de plus (la plaque, le pas, l'encodeur). */
export interface RytmInfoHit {
  /** l'id de carte ; p:0 a p:7 pour un bloc de l'ecran (resolveRytmId le resout) */
  id: string;
  /** un potard de la plaque TWEAKS (OPEN) : son nom et sa section y sont ceux de la plaque */
  plate?: boolean;
  /** un pas (0 a 15) */
  step?: number;
  /** un encodeur du desktop (0 a 7) : son FX global a poste fixe (2026-10-09) */
  encoder?: number;
}

const KIT_HOT = new Set(['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'cp', 'gate', 'hh', 'tom']);
const TRANSPORT = new Set(['run', 'clear', 'random', 'mute', 'solo']);
const PAGE_IDS: ReadonlySet<string> = new Set(RYTM_PAGES.map((p) => p.id));
const TAB_IDS: ReadonlySet<string> = new Set(RYTM_INFO_TABS);

/**
 * La carte d'une zone de saisie du MM-RYTM, telle que la face les nomme
 * (pads.ts pad-<voix|edit|open>, encoders.ts enc-level enc-tempo penc-<k>
 * (un FX global depuis le 2026-10-09), rytmPageKeys.ts pkey-<page>,
 * renderer.ts lcd-tab-<ecran> lcd-open lcd-prev... seek lcd-i lcd-blk-<k>
 * (un bloc de la vue PAGE), sequencer3d.ts step-<1-16> run clear random mute
 * solo, rytmTweaks.ts rk-<kit>). null : pas une commande du MM-RYTM.
 */
export function rytmInfoHit(hotspot: string): RytmInfoHit | null {
  if (hotspot.startsWith('pad-')) {
    const p = hotspot.slice(4);
    if ((RYTM_INFO_VOICES as readonly string[]).includes(p)) return { id: `pad:${p}` };
    return p === 'edit' || p === 'open' ? { id: p } : null;
  }
  if (hotspot === 'enc-level') return { id: 'level' };
  if (hotspot === 'enc-tempo') return { id: 'tempo' };
  // Un encodeur du desktop : son FX global (theme.ts GLOBAL_ENCODERS), jamais la page
  const pe = /^penc-([0-7])$/.exec(hotspot);
  if (pe) {
    const k = Number(pe[1]);
    const g = GLOBAL_ENCODERS[k];
    return g && isRytmInfoId(g) ? { id: g, encoder: k } : null;
  }
  // Un bloc de l'ecran (l'editeur, au desktop comme au telephone)
  const bk = /^lcd-blk-([0-7])$/.exec(hotspot);
  if (bk) return { id: `p:${bk[1]}` };
  const pk = /^pkey-([a-z]+)$/.exec(hotspot);
  if (pk) return PAGE_IDS.has(pk[1]) ? { id: pk[1] } : null;
  const tb = /^lcd-tab-([a-z]+)$/.exec(hotspot);
  if (tb) return tb[1] === 'voice' || PAGE_IDS.has(tb[1]) || TAB_IDS.has(tb[1]) ? { id: tb[1] } : null;
  const st = /^step-(\d+)$/.exec(hotspot);
  if (st) {
    const i = Number(st[1]) - 1;
    return i >= 0 && i < 16 ? { id: 'step', step: i } : null;
  }
  if (TRANSPORT.has(hotspot)) return { id: hotspot };
  if (hotspot === 'seek') return { id: 'seek' };
  if (hotspot === 'lcd-open') return { id: 'screen' };
  if (/^lcd-(prev|next|save|name|del|exit)$/.test(hotspot)) return { id: 'presets' };
  if (hotspot === 'lcd-i') return { id: 'ikey' };
  if (hotspot.startsWith('rk-')) {
    const k = hotspot.slice(3);
    return KIT_HOT.has(k) ? { id: `r:${k}`, plate: true } : null;
  }
  return null;
}

/** Une zone de saisie du MM-RYTM qui a sa carte (le store des INFOS et la couche de saisie trient avec). */
export const isRytmInfoHotspot = (hotspot: string | null | undefined): hotspot is string => !!hotspot && rytmInfoHit(hotspot) !== null;
