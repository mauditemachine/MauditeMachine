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
 * Les ids ne dependent pas de la disposition des zones de saisie :
 * - les pages : trig src smpl fltr amp fx (leurs touches) ;
 * - les reglages des pages : leur DialId (actions.ts : vdecay, vol, tone,
 *   r:tune...), step:vel et smpl:sample ; vsound, le raccourci SOUND du kit
 *   (le MIDI rytm:enc:vsound) ;
 * - les choix de son de la plaque TWEAKS : r:bd r:sd r:cp r:hh r:tom (leurs
 *   potards r:tune... sont ceux des pages) ;
 * - les reglages a venir de l'etude (soon:prob...), leur bloc vide tant
 *   qu'ils n'existent pas, et les couches SYNTH et SAMPLE de l'etape R3
 *   (r3:machine...), branchees ;
 * - les commandes fixes : pad:BD a pad:CY, step, lock, run, clear, random,
 *   mute, solo, edit, open, close, level (MASTER), tempo, screen, presets,
 *   seek, ikey (la touche i), home, enc (un encodeur sur une case vide).
 *
 * La table des blocs (rytmSlots) recopie rytm/pages.ts tel que l'etape R3
 * le laisse, reglages a venir compris ; la carte d'un potard de page passe
 * la cible resolue par actions.ts (pageTarget) dans le contexte (target) :
 * elle suit pages.ts meme si la table d'ici prend du retard.
 */

import type { Inst } from '../theme';

/* ---------------- les ids ---------------- */

/** Les voix, dans l'ordre des pads (BD SD CH OH en haut, CP TOM HT CY dessous). */
export const RYTM_INFO_VOICES = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as const satisfies readonly Inst[];

/** Les six pages, dans l'ordre de l'Analog Rytm (theme.ts RYTM_PAGE_KEYS a l'etape R2). */
export const RYTM_INFO_PAGES = ['trig', 'src', 'smpl', 'fltr', 'amp', 'fx'] as const;
export type RytmInfoPage = (typeof RYTM_INFO_PAGES)[number];
export const RYTM_INFO_PAGE_LABEL: Readonly<Record<RytmInfoPage, string>> = { trig: 'TRIG', src: 'SRC', smpl: 'SMPL', fltr: 'FLTR', amp: 'AMP', fx: 'FX' };

/** Les reglages des pages, par leur cible (le DialId de actions.ts, step:vel, smpl:sample). */
export const RYTM_PARAM_IDS = [
  'step:vel',
  'swing',
  'vsound',
  'vtune',
  'r:tune',
  'r:attack',
  'r:decay',
  'r:drive',
  'r:snappy',
  'r:gate',
  'stretch',
  'smpl:sample',
  'vstart',
  'tone',
  'vdecay',
  'vpan',
  'vol',
  'vdist',
  'vchorus',
  'vdelay',
  'vreverb',
  'dist',
  'chorus',
  'delay',
  'reverb',
] as const;
export type RytmParamId = (typeof RYTM_PARAM_IDS)[number];

/** Les choix de son de la plaque TWEAKS (OPEN) : KICK, SNARE, CLAP, HATS, TOMS. */
export const RYTM_PLATE_SOUND_IDS = ['r:bd', 'r:sd', 'r:cp', 'r:hh', 'r:tom'] as const;
export type RytmPlateSoundId = (typeof RYTM_PLATE_SOUND_IDS)[number];

/** Les potards de la plaque TWEAKS, dans l'ordre de scene/rytmTweaks.ts (KIT_IDS). */
export const RYTM_PLATE_IDS = ['r:bd', 'r:tune', 'r:attack', 'r:decay', 'r:drive', 'r:sd', 'r:snappy', 'r:cp', 'r:gate', 'r:hh', 'r:tom'] as const;

/** Les reglages a venir de l'etude (inv/rytm-synthesis.md 2.2) : leur bloc reste vide tant qu'ils n'existent pas. */
export const RYTM_SOON_IDS = [
  'soon:prob',
  'soon:micro',
  'soon:cond',
  'soon:rtrg',
  'soon:rtim',
  'soon:fatk',
  'soon:fdec',
  'soon:freq',
  'soon:reso',
  'soon:ftype',
  'soon:fenv',
  'soon:attack',
  'soon:hold',
  'soon:br',
  'soon:loop',
] as const;
export type RytmSoonId = (typeof RYTM_SOON_IDS)[number];

/**
 * Les couches de l'etape R3 (Mika, 2026-10-08 : "comme la ANALOG Rytm ou on
 * peut mettre des samples mais le kick peut etre parametre comme une
 * machine") : la couche SYNTH (MACHINE, SYNTH LEVEL, SWEEP, et ce que la
 * caisse claire de synthese gagne : TUNE, DECAY, TONE) et la couche SAMPLE
 * (TUNE, FINE, START (r3:sstart), LEN (r3:send), LEVEL, REV). Branches
 * depuis R3 (avail live) ; leurs cibles dans actions.ts : l:mach, l:syn,
 * r:sweep, r:sdtune, r:sddecay, r:sdtone, l:tune, l:fine, l:start, l:len,
 * l:lev, l:rev (TARGET_INFO). Depuis la revue de R3 (2026-10-08), vstart est
 * le START de toute la voix (AMP D) et vtune la hauteur de toute la voix
 * (SRC B des voix de synthese, PITCH en G pour BD et SD).
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

export type RytmInfoId = RytmInfoPage | RytmParamId | RytmPlateSoundId | RytmSoonId | RytmR3Id | RytmControlId;

export const RYTM_INFO_IDS: readonly RytmInfoId[] = [...RYTM_INFO_PAGES, ...RYTM_PARAM_IDS, ...RYTM_PLATE_SOUND_IDS, ...RYTM_SOON_IDS, ...RYTM_R3_IDS, ...RYTM_CONTROL_IDS];
const ID_SET: ReadonlySet<string> = new Set(RYTM_INFO_IDS);
export const isRytmInfoId = (s: unknown): s is RytmInfoId => typeof s === 'string' && ID_SET.has(s);

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

/* ---------------- les huit blocs de chaque page (rytm/pages.ts, etape R2) ---------------- */

/** Un bloc : son reglage et son nom a l'ecran ; null : un emplacement vide. */
export interface RytmSlot {
  id: RytmInfoId;
  label: string;
}

const s = (id: RytmInfoId, label: string): RytmSlot => ({ id, label });

/** TRIG ; STRETCH (toute la machine) y est depuis R3, a cote de SWING. */
const TRIG: readonly (RytmSlot | null)[] = [s('step:vel', 'VEL'), s('soon:prob', 'PROB'), s('soon:micro', 'MICRO'), s('soon:cond', 'COND'), s('soon:rtrg', 'RTRG'), s('soon:rtim', 'RTIM'), s('stretch', 'STRETCH'), s('swing', 'SWING')];
/** SMPL, la couche SAMPLE (R3, rytm/pages.ts) : TUNE FINE REV SAMPLE, START LEN (LOOP) LEVEL. */
const SMPL: readonly (RytmSlot | null)[] = [s('r3:stune', 'TUNE'), s('r3:sfine', 'FINE'), s('r3:reverse', 'REV'), s('smpl:sample', 'SAMPLE'), s('r3:sstart', 'START'), s('r3:send', 'LEN'), s('soon:loop', 'LOOP'), s('r3:smplevel', 'LEVEL')];
const FLTR: readonly (RytmSlot | null)[] = [s('soon:fatk', 'ATK'), s('soon:fdec', 'DEC'), null, null, s('tone', 'TONE'), s('soon:reso', 'RESO'), s('soon:ftype', 'TYPE'), s('soon:fenv', 'ENV')];
/** AMP ; D : START, le debut de tout le coup (revue de R3). */
const AMP: readonly (RytmSlot | null)[] = [s('soon:attack', 'ATK'), s('soon:hold', 'HOLD'), s('vdecay', 'DEC'), s('vstart', 'START'), null, null, s('vpan', 'PAN'), s('vol', 'VOL')];
/** En haut les effets de la voix, dessous ceux de tout le MM-RYTM (sauf le kick), colonne par colonne. */
const FX: readonly (RytmSlot | null)[] = [s('vdist', 'DIST'), s('vchorus', 'CHORUS'), s('vdelay', 'DELAY'), s('vreverb', 'REVERB'), s('dist', 'DIST'), s('chorus', 'CHORUS'), s('delay', 'DELAY'), s('reverb', 'REVERB')];

/** SRC, la couche SYNTH (R3, rytm/pages.ts) : B a G selon la famille de la voix (le kick, la caisse claire, le clap ; les autres le TUNE de la voix). */
function srcMiddle(g: RytmVoiceGroup | null): readonly (RytmSlot | null)[] {
  // G : PITCH, la hauteur de toute la voix (revue de R3)
  if (g === 'bd') return [s('r:tune', 'TUNE'), s('r:attack', 'ATTACK'), s('r3:sweep', 'SWEEP'), s('r:decay', 'DECAY'), s('r:drive', 'DRIVE'), s('vtune', 'PITCH')];
  if (g === 'sd') return [s('r3:sdtune', 'TUNE'), s('r:snappy', 'SNAPPY'), s('r3:sdtone', 'TONE'), s('r3:sddecay', 'DECAY'), s('r:gate', 'GATE'), s('vtune', 'PITCH')];
  if (g === 'cp') return [s('vtune', 'TUNE'), null, s('r:gate', 'GATE'), null, null, null];
  return [s('vtune', 'TUNE'), null, null, null, null, null];
}
const SRC_CACHE = new Map<string, readonly (RytmSlot | null)[]>();
function src(v: Inst | null): readonly (RytmSlot | null)[] {
  const g = v ? voiceGroup(v) : null;
  const key = g ?? 'none';
  let out = SRC_CACHE.get(key);
  if (!out) {
    out = [s('r3:machine', 'MACHINE'), ...srcMiddle(g), g && g !== 'cy' ? s('r3:synlevel', 'LEVEL') : null];
    SRC_CACHE.set(key, out);
  }
  return out;
}

/** Les huit blocs d'une page pour la voix choisie (A B C D en haut, E F G H dessous), reglages a venir compris. */
export function rytmSlots(page: RytmInfoPage, voice: Inst | null): readonly (RytmSlot | null)[] {
  switch (page) {
    case 'trig':
      return TRIG;
    case 'src':
      return src(voice);
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

/** La lettre d'un bloc (et de son potard). */
export const RYTM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** La page et le bloc d'un reglage pour cette voix (la page regardee d'abord), null s'il n'est sur aucune page. */
export function rytmSlotOf(id: RytmInfoId, voice: Inst | null, page?: RytmInfoPage): { page: RytmInfoPage; k: number } | null {
  const order: readonly RytmInfoPage[] = page ? [page, ...RYTM_INFO_PAGES.filter((p) => p !== page)] : RYTM_INFO_PAGES;
  // SOUND (SRC) et SAMPLE (SMPL) sont deux vues du meme choix ; chacun garde sa place
  for (const p of order) {
    const k = rytmSlots(p, voice).findIndex((x) => x?.id === id);
    if (k >= 0) return { page: p, k };
  }
  return null;
}

/** L'id d'un reglage a venir d'apres son nom sur une page (un bloc de pages.ts sans cible : PROB, ATK...), null sinon. */
export function soonInfoId(page: RytmInfoPage, label: string, voice: Inst | null = null): RytmInfoId | null {
  const hit = rytmSlots(page, voice).find((x) => x && x.label === label && rytmAvail(x.id) !== 'live');
  return hit ? hit.id : null;
}

/** Ce qu'il faut pour savoir ce que tient un potard de page. */
export interface RytmResolveCtx {
  /** la voix choisie (pattern.instrument), null : aucune */
  voice?: Inst | null;
  /** la page affichee ; SRC par defaut (la page de depart) */
  page?: RytmInfoPage;
  /**
   * la cible resolue par l'appelant (actions.ts pageTarget(k) : un DialId,
   * step:vel, smpl:sample ; null : vide ou a venir) ; passe avant la table
   */
  target?: string | null;
  /** les reglages a venir ont leur carte ; sinon la case vide (enc), comme a l'ecran (pages.ts SHOW_SOON) */
  soon?: boolean;
}

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

/**
 * L'id de carte d'une commande : un potard de page (p:0 a p:7) donne le
 * reglage qu'il tient sur la page affichee pour la voix choisie (K.TUNE sur
 * BD, SNAPPY sur SD au bloc C de SRC), enc pour une case vide ; un autre id
 * connu se rend tel quel ; null : inconnu.
 */
export function resolveRytmId(id: string, c: RytmResolveCtx = {}): RytmInfoId | null {
  const m = /^p:([0-7])$/.exec(id);
  if (!m) return isRytmInfoId(id) ? id : null;
  if (c.target !== undefined) {
    if (c.target === null) return 'enc';
    const t = TARGET_INFO[c.target] ?? c.target;
    return isRytmInfoId(t) ? t : 'enc';
  }
  const slot = rytmSlots(c.page ?? 'src', c.voice ?? null)[Number(m[1])];
  if (!slot) return 'enc';
  if (rytmAvail(slot.id) !== 'live' && !c.soon) return 'enc';
  return slot.id;
}

/* ---------------- les zones de saisie (scene/*, etape R2) ---------------- */

/** Une zone de saisie du MM-RYTM lue : sa carte, et ce qu'elle dit de plus (la plaque, le pas, le potard). */
export interface RytmInfoHit {
  /** l'id de carte ; p:0 a p:7 pour un potard de page (resolveRytmId le resout) */
  id: string;
  /** un potard de la plaque TWEAKS (OPEN) : son nom et sa section y sont ceux de la plaque */
  plate?: boolean;
  /** un pas (0 a 15) */
  step?: number;
}

const KIT_HOT = new Set(['bd', 'tune', 'attack', 'decay', 'drive', 'sd', 'snappy', 'cp', 'gate', 'hh', 'tom']);
const TRANSPORT = new Set(['run', 'clear', 'random', 'mute', 'solo']);

/**
 * La carte d'une zone de saisie du MM-RYTM, telle que la face les nomme
 * (pads.ts pad-<voix|edit|open>, encoders.ts enc-level enc-tempo penc-<k>,
 * rytmPageKeys.ts pkey-<page>, renderer.ts lcd-tab-<page> lcd-open
 * lcd-prev... seek lcd-i (la touche i de l'ecran, R4) lcd-blk-<k> (un bloc
 * de la vue PAGE, INFOS allume, R4), sequencer3d.ts
 * step-<1-16> run clear random mute solo, rytmTweaks.ts rk-<kit>). null :
 * pas une commande du MM-RYTM (le MM-ARP, le MM-BASS, le fond).
 */
export function rytmInfoHit(hotspot: string): RytmInfoHit | null {
  if (hotspot.startsWith('pad-')) {
    const p = hotspot.slice(4);
    if ((RYTM_INFO_VOICES as readonly string[]).includes(p)) return { id: `pad:${p}` };
    return p === 'edit' || p === 'open' ? { id: p } : null;
  }
  if (hotspot === 'enc-level') return { id: 'level' };
  if (hotspot === 'enc-tempo') return { id: 'tempo' };
  // Un potard de page, ou son bloc a l'ecran (R4 : INFOS allume, les blocs ont leur zone)
  const pe = /^(?:penc|lcd-blk)-([0-7])$/.exec(hotspot);
  if (pe) return { id: `p:${pe[1]}` };
  const pk = /^(?:pkey|lcd-tab)-([a-z]+)$/.exec(hotspot);
  if (pk) return (RYTM_INFO_PAGES as readonly string[]).includes(pk[1]) ? { id: pk[1] } : null;
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
