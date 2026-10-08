/**
 * Les dessins des INFOS du MM-RYTM (2026-10-08, Mika : "excellent pour le
 * bouton INFO ! je veux un petit bouton i dans l'ecran a activer et de ce
 * fait on peut voir les infos au survol.. et je veux la meme chose pour RYTM
 * aussi !") : une petite image vectorielle par commande, calculee avec les
 * vraies lois du MM-RYTM (audio/voicefx.ts, tone.ts, time.ts, fx.ts,
 * sends.ts, chorus.ts, shotsdsp.ts, sampledsp.ts, pattern.ts), dans une
 * boite de 240 x 120 : le format des dessins du MM-BASS (bass/diagrams.ts
 * BassDiagram), que sa carte INFOS sait deja tracer en SVG (et un ecran avec
 * Path2D). Fonctions pures, sans DOM. Les roles des traits sont ceux du
 * MM-BASS :
 * - main : le trait principal ;
 * - hot : ce que la commande change (orange sur la carte) ;
 * - ghost : les reperes (la forme d'origine, la course entiere) ;
 * - grid : la grille ; dash : un repere en pointille.
 * Les textes : label (petit, gris), value (la valeur lue, en haut a droite).
 *
 * C'est aussi la partie legere des INFOS (comme voyager/infoIds.ts) : les
 * ids des cartes, la table des huit blocs de chaque page, la resolution d'un
 * potard de page (p:0 a p:7) vers le reglage qu'il tient pour la voix
 * choisie, et la correspondance des zones de saisie. Les textes en francais
 * sont a rytm/infos.ts (qui importe d'ici, jamais l'inverse : un ecran qui
 * trace un dessin n'emporte pas les textes).
 *
 * Les ids ne dependent pas de la disposition des zones de saisie :
 * - les pages : trig src smpl fltr amp fx (leurs touches) ;
 * - les reglages des pages : leur DialId (actions.ts : vdecay, vol, tone,
 *   vsound, r:tune...), step:vel et smpl:sample ;
 * - les choix de son de la plaque TWEAKS : r:bd r:sd r:cp r:hh r:tom (leurs
 *   potards r:tune... sont ceux des pages) ;
 * - les reglages a venir de l'etude (soon:prob...) et les couches SYNTH et
 *   SAMPLE de l'etape R3 (r3:machine...), marques pour etre branches ;
 * - les commandes fixes : pad:BD a pad:CY, step, lock, run, clear, random,
 *   mute, solo, edit, open, close, level (MASTER), tempo, screen, presets,
 *   seek, ikey (la touche i), home, enc (un encodeur sur une case vide).
 *
 * La table des blocs (rytmSlots) recopie rytm/pages.ts tel que l'etape R2
 * le laisse (worktree wf_b0d0237c, 2026-10-08), reglages a venir compris :
 * si pages.ts change (l'etape R3 et ses couches), la mettre a jour, ou passer
 * la cible resolue par actions.ts (pageTarget) dans le contexte (target).
 * Les constantes que les moteurs n'exportent pas (la DIST, le DELAY, la
 * REVERB, le CHORUS), ou pas encore sur cette branche (TUNE +/-24 et START
 * 90 %, exportees par voicefx.ts a l'etape R2), sont recopiees ici, avec
 * leur source.
 */

import type { BassDiagram } from '../bass/diagrams';
import { BPM, VEL_GAIN } from '../audio/pattern';
import { sampleLenPart } from '../audio/sampledsp';
import { KICK_SWEEP, SD_BODY_HZ, SD_DECAY_S, SD_TONE_HZ, SHOT_BELOW, kickDecayS, kickHz, sdDecayFactor, sdToneFactor, sdTuneFactor, sweepDepth, type KitModel } from '../audio/shotsdsp';
import { timeFactor } from '../audio/time';
import { toneHpHz, toneLpHz, toneSemitones } from '../audio/tone';
import { DECAY_HOLD_S, decayTau, voiceGain } from '../audio/voicefx';
import { swingRatio, type Inst } from '../theme';

/** Le format des dessins du MM-BASS : la meme carte les trace. */
export type RytmDiagram = BassDiagram;

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

/** Ce qui existe deja (live), ce qui viendra (soon : l'etude ; r3 : les couches SYNTH et SAMPLE). */
export type RytmInfoAvail = 'live' | 'soon' | 'r3';
// Les couches de R3 sont branchees (2026-10-08) : leurs cartes sont vivantes
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
 * La carte d'une zone de saisie du MM-RYTM, telle que l'etape R2 les nomme
 * (pads.ts pad-<voix|edit|open>, encoders.ts enc-level enc-tempo penc-<k>,
 * rytmPageKeys.ts pkey-<page>, renderer.ts lcd-tab-<page> lcd-open
 * lcd-prev... seek, sequencer3d.ts step-<1-16> run clear random mute solo,
 * rytmTweaks.ts rk-<kit>) ; lcd-i : le nom propose pour la zone de la touche
 * i de l'ecran (R4). null : pas une commande du MM-RYTM.
 */
export function rytmInfoHit(hotspot: string): RytmInfoHit | null {
  if (hotspot.startsWith('pad-')) {
    const p = hotspot.slice(4);
    if ((RYTM_INFO_VOICES as readonly string[]).includes(p)) return { id: `pad:${p}` };
    return p === 'edit' || p === 'open' ? { id: p } : null;
  }
  if (hotspot === 'enc-level') return { id: 'level' };
  if (hotspot === 'enc-tempo') return { id: 'tempo' };
  const pe = /^penc-([0-7])$/.exec(hotspot);
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

/* ---------------- le contexte d'un dessin ---------------- */

/**
 * Ce que lit un dessin (l'appelant le remplit depuis les stores ; tout est
 * facultatif sauf v) :
 * - v : la valeur de la commande dans son domaine (0 a 1 ; -1 a 1 pour TONE,
 *   STRETCH, TUNE, PAN ; VEL 0 a 9 ; SOUND et SAMPLE : le rang du son ;
 *   TEMPO : les BPM), celle du verrou du pas en LOCK ;
 * - voice : la voix choisie ; bpm : le tempo ;
 * - model : le son de synthese de la famille de la voix (kit.get().model) ;
 *   sample : la famille joue un echantillon (kit.get().sample[f]) ;
 * - kit : les potards du kit (pour le kick : TUNE et DECAY reglent aussi le
 *   dessin d'ATTACK) ;
 * - steps : les seize pas de la voix (la chaine 0 a 9 de pattern.steps) ;
 *   lockMask : les pas qui portent des verrous (bit i : le pas i) ; step : le
 *   pas montre (un pas, le LOCK), -1 aucun ;
 * - sounds : les noms des sons a choisir (SOUND : kitSoundNames ; SAMPLE :
 *   OFF puis les echantillons) ; synths : combien de ces noms sont des sons
 *   de synthese (3 pour SOUND, 1 pour SAMPLE, son OFF) ; index : le rang du
 *   son choisi dans sounds (kitSoundIndex ; sans lui, v est pris pour un
 *   rang : SOUND donne une course 0 a 1 dans actions.ts, la convertir).
 */
export interface RytmDiagramCtx extends RytmResolveCtx {
  v: number;
  bpm?: number;
  model?: KitModel;
  sample?: boolean;
  kit?: Partial<Record<'tune' | 'attack' | 'decay' | 'drive' | 'snappy' | 'gate', number>>;
  steps?: string;
  lockMask?: number;
  step?: number;
  sounds?: readonly string[];
  synths?: number;
  index?: number;
}

/* ---------------- la boite et les traits ---------------- */

type Role = RytmDiagram['paths'][number]['role'];
type Anchor = 'start' | 'middle' | 'end';
type Pt = readonly [number, number];

const W = 240;
const H = 120;
/** La zone du trace ; les etiquettes au-dessus (y 12) et dessous (y 114). */
const X0 = 12;
const X1 = 228;
const Y0 = 20;
const Y1 = 100;
const TOP = 12;
const BOT = 114;

const n1 = (x: number): string => String(Math.round(x * 10) / 10);
const clamp = (x: number, lo: number, hi: number): number => (Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : lo);

/** Le dessin en cours : des traits regroupes par role (un seul chemin par role et par remplissage), comme au MM-BASS. */
class Pic {
  private parts = new Map<string, string[]>();
  private order: string[] = [];
  readonly texts: RytmDiagram['texts'] = [];

  p(d: string, role: Role, fill = false): this {
    if (!d) return this;
    const k = `${role}${fill ? '+' : ''}`;
    let list = this.parts.get(k);
    if (!list) {
      list = [];
      this.parts.set(k, list);
      this.order.push(k);
    }
    list.push(d);
    return this;
  }

  label(text: string, x: number, y: number, anchor: Anchor = 'start'): this {
    this.texts.push({ text, x: Math.round(x), y: Math.round(y), role: 'label', anchor });
    return this;
  }

  value(text: string, x = X1, y = TOP, anchor: Anchor = 'end'): this {
    this.texts.push({ text, x, y, role: 'value', anchor });
    return this;
  }

  done(): RytmDiagram {
    const rank: Record<Role, number> = { grid: 0, ghost: 1, dash: 2, main: 3, hot: 4 };
    const keys = [...this.order].sort((a, b) => rank[a.replace('+', '') as Role] - rank[b.replace('+', '') as Role]);
    const paths = keys.map((k) => {
      const fill = k.endsWith('+');
      const role = k.replace('+', '') as Role;
      const d = (this.parts.get(k) ?? []).join('');
      return fill ? { d, role, fill } : { d, role };
    });
    return { w: W, h: H, paths, texts: this.texts };
  }
}

const poly = (pts: readonly Pt[]): string => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join('');
const seg = (x0: number, y0: number, x1: number, y1: number): string => `M${n1(x0)} ${n1(y0)}L${n1(x1)} ${n1(y1)}`;
function rbox(x: number, y: number, w: number, h: number, r = 0): string {
  if (w <= 0 || h <= 0) return '';
  const k = Math.min(r, w / 2, h / 2);
  if (k <= 0) return `M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}Z`;
  return `M${n1(x + k)} ${n1(y)}H${n1(x + w - k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + w)} ${n1(y + k)}V${n1(y + h - k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + w - k)} ${n1(y + h)}H${n1(x + k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x)} ${n1(y + h - k)}V${n1(y + k)}A${n1(k)} ${n1(k)} 0 0 1 ${n1(x + k)} ${n1(y)}Z`;
}
const dot = (cx: number, cy: number, r: number): string => `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0Z`;
function tip(x0: number, y0: number, x1: number, y1: number, size = 5): string {
  if (size <= 0) return '';
  const a = Math.atan2(y1 - y0, x1 - x0);
  const l = (sg: number): string => seg(x1, y1, x1 - size * Math.cos(a + sg), y1 - size * Math.sin(a + sg));
  return l(0.5) + l(-0.5);
}
const arrow = (x0: number, y0: number, x1: number, y1: number, size = 5): string => seg(x0, y0, x1, y1) + tip(x0, y0, x1, y1, size);

/* ---------------- les ecritures ---------------- */

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));
const hzText = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} KHZ` : `${Math.round(hz)} HZ`);
const durText = (sec: number): string => (sec < 1 ? `${Math.round(sec * 1000)} MS` : `${(Math.round(sec * 10) / 10).toFixed(1)} S`);
function dbText(gain: number): string {
  if (!(gain > 1e-5)) return '-INF DB';
  const r = Math.round(20 * Math.log10(gain) * 10) / 10;
  return `${r > 0 ? '+' : ''}${r === 0 ? '0.0' : r.toFixed(1)} DB`;
}
/** Le nombre 0 a 127 de l'ecran d'une course 0 a 1 (rytm/values.ts v127). */
const v127 = (course: number): number => Math.round(clamp(course, 0, 1) * 127);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
/** La note la plus proche d'une frequence (A4 = 440 Hz) : G#1, F#1. */
function noteOf(hz: number): string {
  const m = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
/** La duree d'une double croche au tempo (BPM borne a celui du MM-RYTM). */
const stepS = (bpm: number | undefined): number => 60 / clamp(bpm ?? BPM.initial, BPM.min, BPM.max) / 4;

/* ---------------- les lois recopiees (ces modules ne les exportent pas, ou pas encore sur cette branche) ---------------- */

/** audio/voicefx.ts (etape R2, qui les exporte : TUNE_ST, START_MAX ; a importer une fois R2 merge) : TUNE +/-24 demi-tons, START au plus 90 % de l'echantillon. */
const TUNE_ST = 24;
const START_MAX = 0.9;
/** audio/fx.ts DRIVE : la copie saturee tanh((1 + 12 d) x), melangee a 0.85 d. */
const DRIVE = { gain: 12, mix: 0.85 } as const;
/** audio/sends.ts DELAY : croche pointee (3 pas), envoi 0.9 a fond, retour 0.58, entre 180 Hz et 4.5 kHz. */
const DELAY = { steps: 3, send: 0.9, feedback: 0.58 } as const;
/** audio/fx.ts REVERB : une reponse de 2.4 s, -60 dB au bout. */
const REVERB_S = 2.4;
/** audio/chorus.ts : deux retards (14 et 21 ms) modules par deux LFO (0.53 et 0.71 Hz, +/-7 ms) ; sec 1 - 0.5 v, chorus v. */
const CHORUS = { l: 14, r: 21, depth: 7, fl: 0.53, fr: 0.71 } as const;
/** Les intervalles de TUNE (rytm/values.ts tuneUnit, etape R2). */
const INTERVALS = ['ROOT', 'MIN 2ND', '2ND', 'MIN 3RD', '3RD', '4TH', 'TRITONE', '5TH', 'MIN 6TH', '6TH', 'MIN 7TH', '7TH', 'OCTAVE'] as const;
function intervalOf(st: number): string {
  const a = Math.abs(st);
  if (a <= 12) return INTERVALS[a];
  if (a === 24) return '2 OCTAVES';
  return `OCT + ${INTERVALS[a - 12]}`;
}
const tuneStOf = (v: number): number => Math.round(clamp(v, -1, 1) * TUNE_ST);

/* ---------------- les morceaux communs ---------------- */

/** Une echelle de demi-tons (-n a +n) sur la largeur : un trait par demi-ton, un grand par octave, la valeur en fleche. */
function semitoneScale(p: Pic, st: number, n: number): void {
  const y = 72;
  const xOf = (k: number): number => X0 + ((k + n) / (2 * n)) * (X1 - X0);
  p.p(seg(X0, y, X1, y), 'grid');
  for (let k = -n; k <= n; k += 1) {
    const big = k % 12 === 0;
    p.p(seg(xOf(k), y, xOf(k), y - (big ? 10 : 4)), big ? 'main' : 'grid');
    if (big) p.label(k > 0 ? `+${k}` : String(k), xOf(k), y + 14, 'middle');
  }
  p.p(arrow(xOf(0), 44, xOf(st), 44, st === 0 ? 0 : 4), 'hot');
  p.p(seg(xOf(st), 34, xOf(st), y), 'hot');
  p.p(dot(xOf(st), 34, 2.6), 'hot', true);
  p.label('SEMITONES', X0, BOT);
}

/** La grille des doubles croches sur span secondes (seulement si elle reste lisible ; sinon les temps). */
function sixteenths(p: Pic, sd: number, span: number, y0 = Y0, y1 = Y1): void {
  const per = span / sd > 48 ? sd * 4 : sd;
  for (let t = per; t < span - 1e-6; t += per) {
    const x = X0 + ((X1 - X0) * t) / span;
    p.p(seg(x, y0, x, y1), 'grid');
  }
}

/** Une courbe de gain (dB) sur la course : la valeur en repere ; lo : le bas de l'echelle. */
function gainCurve(p: Pic, gainOf: (c: number) => number, v: number, hi: number, lo: number): void {
  const yOf = (db: number): number => Y0 + ((hi - clamp(db, lo, hi)) / (hi - lo)) * (Y1 - Y0);
  const xOf = (c: number): number => X0 + c * (X1 - X0);
  for (const db of [0, -12, -24]) if (db > lo && db <= hi) p.p(seg(X0, yOf(db), X1, yOf(db)), db === 0 ? 'dash' : 'grid');
  p.label('0 DB', X0, yOf(0) - 3);
  const pts: Pt[] = [];
  for (let k = 0; k <= 96; k += 1) {
    const c = k / 96;
    const g = gainOf(c);
    pts.push([xOf(c), yOf(g > 1e-6 ? 20 * Math.log10(g) : lo)]);
  }
  p.p(poly(pts), 'main');
  const g = gainOf(v);
  const yv = yOf(g > 1e-6 ? 20 * Math.log10(g) : lo);
  p.p(seg(xOf(v), Y1, xOf(v), yv), 'hot');
  p.p(dot(xOf(v), yv, 2.6), 'hot', true);
  for (const c of [0, 0.5, 0.8, 1]) p.label(String(v127(c)), xOf(c), BOT, c === 0 ? 'start' : c === 1 ? 'end' : 'middle');
}

/** Une onde de coup generique (un sinus qui s'eteint), de x0 a x1 : le dessin d'un echantillon. */
function hitWave(x0: number, x1: number, yc: number, amp: number, tau = 0.22, periods = 9): Pt[] {
  const pts: Pt[] = [];
  const n = 180;
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    const a = (1 - Math.exp(-t / 0.01)) * Math.exp(-t / tau);
    pts.push([x0 + (x1 - x0) * t, yc - amp * a * Math.sin(2 * Math.PI * periods * Math.pow(t, 0.8))]);
  }
  return pts;
}

/** Une sinusoide passee par une saturation f (deux periodes sur la largeur). */
function shaped(f: (x: number) => number, yc: number, amp: number): Pt[] {
  const pts: Pt[] = [];
  const n = 120;
  for (let k = 0; k <= n; k += 1) {
    const x = Math.sin((4 * Math.PI * k) / n);
    pts.push([X0 + ((X1 - X0) * k) / n, yc - amp * f(x)]);
  }
  return pts;
}

/** Seize cases : la velocite de chaque pas (hauteur), un point sous ceux qui ont des verrous, le cadre des temps. */
function strip(p: Pic, c: RytmDiagramCtx, y: number, h: number, hotStep: number, fillHot: boolean): void {
  const pitch = (X1 - X0) / 16;
  for (let i = 0; i < 16; i += 1) {
    const x = X0 + i * pitch + 1.5;
    const w = pitch - 3;
    const vel = c.steps ? clamp(c.steps.charCodeAt(i) - 48, 0, 9) : 0;
    p.p(rbox(x, y, w, h, 2), i % 4 === 0 ? 'ghost' : 'grid');
    if (vel > 0) {
      const vh = Math.max(3, (h - 4) * (vel / 9));
      p.p(rbox(x + 2, y + h - 2 - vh, w - 4, vh, 1.5), i === hotStep ? 'hot' : 'main', true);
    }
    if (i === hotStep) p.p(rbox(x - 1.5, y - 1.5, w + 3, h + 3, 3), 'hot', fillHot && vel === 0);
    if (c.lockMask !== undefined && (c.lockMask >> i) & 1) p.p(dot(x + w / 2, y + h + 6, 1.8), i === hotStep ? 'hot' : 'main', true);
    if (i % 4 === 0) p.label(String(i + 1), x + w / 2, y + h + 17, 'middle');
  }
}

/* ---------------- les dessins, un par commande ---------------- */

type Draw = (c: RytmDiagramCtx, v: number) => RytmDiagram;

/** VOL de la voix : le gain (v / 0.8)^2, 0 dB a 102, +3.9 dB a 127. */
const drawVol: Draw = (_c, v) => {
  const p = new Pic();
  gainCurve(p, voiceGain, v, 6, -30);
  p.label('VOICE LEVEL', X0 + 34, TOP);
  return p.value(dbText(voiceGain(v))).done();
};

/** MASTER : le gain v^2 de tout le MM-RYTM (-3.9 dB au depart). */
const drawMaster: Draw = (_c, v) => {
  const p = new Pic();
  gainCurve(p, (x) => x * x, v, 6, -30);
  p.label('MM-RYTM OUT', X0 + 34, TOP);
  return p.value(dbText(v * v)).done();
};

/** TRIG VEL : les neuf niveaux et leur gain (pattern.ts VEL_GAIN), le pas choisi en couleur. */
const drawVel: Draw = (_c, v) => {
  const p = new Pic();
  const n = Math.round(clamp(v, 0, 9));
  const pitch = (X1 - X0) / 10;
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  for (let i = 0; i <= 9; i += 1) {
    const x = X0 + i * pitch + 3;
    const h = (Y1 - Y0 - 6) * VEL_GAIN[i];
    if (h > 0) p.p(rbox(x, Y1 - h, pitch - 6, h, 1.5), i === n ? 'hot' : 'ghost', true);
    else p.p(seg(x, Y1 - 1, x + pitch - 6, Y1 - 1), i === n ? 'hot' : 'ghost');
    if (i % 3 === 0) p.label(i === 0 ? 'OFF' : String(Math.round((i / 9) * 127)), x + (pitch - 6) / 2, BOT, 'middle');
  }
  p.label('GAIN PER LEVEL', X0, TOP);
  return p.value(n === 0 ? 'OFF' : dbText(VEL_GAIN[n])).done();
};

/** SWING : huit doubles croches, les paires en retard d'au plus un tiers de pas (theme.ts SWING). */
const drawSwing: Draw = (_c, v) => {
  const p = new Pic();
  const pitch = (X1 - X0) / 8;
  const y = 60;
  p.p(seg(X0, Y0 + 6, X0, Y1 - 6), 'grid').p(seg(X0 + 4 * pitch, Y0 + 6, X0 + 4 * pitch, Y1 - 6), 'grid');
  p.p(seg(X0, y, X1, y), 'grid');
  for (let i = 0; i < 8; i += 1) {
    const x = X0 + (i + 0.5) * pitch;
    if (i % 2 === 0) {
      p.p(dot(x, y, 4), 'main', true);
      continue;
    }
    const dx = (clamp(v, 0, 1) / 3) * pitch;
    p.p(dot(x, y, 4), 'ghost', true);
    if (dx > 0.5) p.p(arrow(x, y - 12, x + dx, y - 12, 3), 'hot');
    p.p(dot(x + dx, y, 4), 'hot', true);
  }
  p.label('ONE BEAT', X0 + 2 * pitch, Y1 + 2, 'middle').label('ONE BEAT', X0 + 6 * pitch, Y1 + 2, 'middle');
  p.label('EVEN 16THS LATE', X0, TOP);
  return p.value(`${swingRatio(clamp(v, 0, 1))}%`).done();
};

/** Un choix de son (SOUND, SAMPLE, KICK...) : ses crans, le son choisi en couleur ; les sons de synthese a part. */
const drawSounds: Draw = (c, v) => {
  const p = new Pic();
  const given = !!c.sounds && c.sounds.length > 0;
  const names = given && c.sounds ? c.sounds : ['909', '808', 'MM', 'SAMPLES'];
  const synths = Math.round(clamp(c.synths ?? 3, 0, names.length));
  const cur = given ? Math.round(clamp(c.index ?? v, 0, names.length - 1)) : -1;
  const rows = names.length > 6 ? 2 : 1;
  const per = Math.ceil(names.length / rows);
  const gap = 4;
  const bw = (X1 - X0 - gap * (per - 1)) / per;
  const bh = rows === 2 ? 26 : 34;
  const y0 = rows === 2 ? 30 : 42;
  const chars = Math.max(2, Math.floor((bw - 6) / 6));
  names.forEach((name, i) => {
    const r = Math.floor(i / per);
    const x = X0 + (i % per) * (bw + gap);
    const y = y0 + r * (bh + 10);
    const on = i === cur;
    p.p(rbox(x, y, bw, bh, 3), on ? 'hot' : i < synths ? 'main' : 'ghost', on);
    p.label(name.slice(0, chars), x + bw / 2, y + bh / 2 + 3, 'middle');
  });
  // Les deux familles de sons : la synthese (909 808 MM, ou OFF pour SAMPLE) et les echantillons
  if (synths > 0) p.label(synths === 1 ? 'OFF: SYNTH' : 'SYNTH', X0, TOP);
  if (names.length > synths) {
    const r = Math.floor(synths / per);
    const x = X0 + (synths % per) * (bw + gap);
    p.label('SAMPLES', r === 0 && synths > 0 ? x : X0, r === 0 ? (synths > 0 ? TOP + 14 : TOP) : y0 + r * (bh + 10) - 3);
  }
  return cur >= 0 ? p.value(names[cur] ?? '').done() : p.done();
};

/** TUNE de la voix : +/-24 demi-tons, au demi-ton ; plus aigu, le coup est aussi plus court (rendu a sr / hauteur, comme un sampler). */
const drawTune: Draw = (_c, v) => {
  const p = new Pic();
  const st = tuneStOf(v);
  semitoneScale(p, st, TUNE_ST);
  p.label(intervalOf(st), X0, TOP);
  p.label(`X${Math.pow(2, st / 12).toFixed(2)} PITCH`, X1, BOT, 'end');
  return p.value(st > 0 ? `+${st}` : String(st)).done();
};

/** TUNE du kick de synthese (SRC B depuis R3) : sa note (une octave autour de 52 Hz, 49 en 808) ; le sample a son TUNE (SMPL A). */
const drawKickTune: Draw = (c, v) => {
  const p = new Pic();
  const m = c.model ?? '909';
  const lo = 30;
  const hi = 100;
  const xOf = (f: number): number => X0 + ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (X1 - X0);
  const y = 76;
  p.p(seg(X0, y, X1, y), 'grid');
  for (const f of [30, 40, 50, 60, 80, 100]) {
    p.p(seg(xOf(f), y, xOf(f), y + 4), 'grid');
    p.label(String(f), xOf(f), y + 15, f === 30 ? 'start' : f === 100 ? 'end' : 'middle');
  }
  const f0 = kickHz(m, 0);
  const f1 = kickHz(m, 1);
  p.p(rbox(xOf(f0), y - 22, xOf(f1) - xOf(f0), 14, 3), 'ghost', true);
  const f = kickHz(m, clamp(v, 0, 1));
  p.p(seg(xOf(f), 30, xOf(f), y), 'hot');
  p.p(dot(xOf(f), 30, 2.8), 'hot', true);
  p.label(`${m === 'mm' ? 'MM' : m}  ${noteOf(f)}`, X0, TOP);
  p.label('HZ', X1, BOT, 'end');
  return p.value(`${Math.round(f)} HZ`).done();
};

/** DECAY du kick de synthese : sa queue e^(-t/tau) (shotsdsp.ts kickDecayS) ; le sample a son LEN (SMPL F, drawSampleLen). */
const drawKickDecay: Draw = (c, v) => {
  const p = new Pic();
  const sd = stepS(c.bpm);
  const yOf = (a: number): number => Y1 - a * (Y1 - Y0 - 6);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  const m = c.model ?? '909';
  const tau = kickDecayS(m, clamp(v, 0, 1));
  const span = clamp(5 * tau, 0.3, 4);
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  sixteenths(p, sd, span);
  const curve = (tt: number): Pt[] => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 96; k += 1) {
      const t = (span * k) / 96;
      pts.push([tx(t), yOf(Math.exp(-t / tt))]);
    }
    return pts;
  };
  p.p(poly(curve(kickDecayS(m, 0.45))), 'ghost');
  p.p(poly(curve(tau)), 'hot');
  p.p(seg(tx(tau), Y0, tx(tau), Y1), 'dash');
  p.label(`${m === 'mm' ? 'MM' : m} KICK TAIL`, X0, TOP);
  p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
  return p.value(`TAU ${durText(tau)}`).done();
};

/** ATTACK du kick : les 30 premieres ms, le corps (son balayage) et la frappe (le clic, sa force) ; un echantillon, le gain ajoute. */
const drawKickAttack: Draw = (c, v) => {
  const p = new Pic();
  const a = clamp(v, 0, 1);
  if (c.sample) {
    // sampledsp.ts : au-dessus du milieu, x(1 + 2a e^(-t/4 ms)) ; dessous, une montee jusqu'a 6 ms
    const d = a - 0.5;
    const span = 0.016;
    const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
    const gy = (g: number): number => Y1 - (g / 2) * (Y1 - Y0);
    p.p(seg(X0, gy(1), X1, gy(1)), 'dash');
    p.label('X1 THE FILE', X1, gy(1) - 4, 'end');
    const pts: Pt[] = [];
    for (let k = 0; k <= 64; k += 1) {
      const t = (span * k) / 64;
      const g = d > 0 ? 1 + 2 * d * Math.exp(-t / 0.004) : d < 0 ? Math.min(1, t / (-d * 2 * 0.006)) : 1;
      pts.push([tx(t), gy(g)]);
    }
    p.p(poly(pts), 'hot');
    p.label('FIRST 16 MS OF THE SAMPLE', X0, BOT);
    return p.value(d > 0 ? `+${(20 * Math.log10(1 + 2 * d)).toFixed(1)} DB` : d < 0 ? `RISE ${(-d * 12).toFixed(1)} MS` : 'AS IS').done();
  }
  const m = c.model ?? '909';
  const f0 = kickHz(m, c.kit?.tune ?? 0.5);
  const tau = kickDecayS(m, c.kit?.decay ?? 0.45);
  const span = 0.03;
  const n = 300;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const yc = 62;
  const amp = 26;
  // La force du clic de chaque son (shotsdsp.ts bd909, bd808, bd) et sa duree
  const amt = m === '909' ? 2 * a : m === '808' ? 0.7 * a : 0.36 * a;
  const ct = m === 'mm' ? 0.002 : 0.0012;
  let ph = 0;
  const body: Pt[] = [];
  for (let k = 0; k <= n; k += 1) {
    const t = (span * k) / n;
    const f = m === '909' ? f0 * (1 + 3.4 * Math.exp(-t / 0.0045) + 0.45 * Math.exp(-t / 0.03)) : m === '808' ? f0 * (1 + 0.3 * Math.exp(-t / 0.01)) : (52 + 125 * Math.exp(-t / 0.009) + 22 * Math.exp(-t / 0.045)) * (f0 / 52);
    ph += f * (span / n);
    const env = (1 - Math.exp(-t / 0.0005)) * Math.exp(-t / tau);
    body.push([tx(t), yc - amp * env * Math.sin(2 * Math.PI * ph)]);
  }
  p.p(seg(X0, yc, X1, yc), 'grid');
  p.p(poly(body), 'main');
  // Le clic en enveloppe pleine, a l'echelle du corps
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let k = 0; k <= 40; k += 1) {
    const t = (4 * ct * k) / 40;
    const e = Math.min(1.6, amt) * Math.exp(-t / ct) * amp * 0.6;
    top.push([tx(t), yc - e]);
    bot.push([tx(t), yc + e]);
  }
  if (amt > 0.01) p.p(`${poly([...top, ...bot.reverse()])}Z`, 'hot', true);
  p.label(`${m === 'mm' ? 'MM' : m} CLICK`, X0 + 30, TOP);
  p.label('FIRST 30 MS', X0, BOT);
  return p.value(`${v127(a)}`).done();
};

/** DRIVE du kick : une sinusoide par sa saturation (tanh k x, recalee sur la crete) ; un echantillon, propre jusqu'au quart. */
const drawKickDrive: Draw = (c, v) => {
  const p = new Pic();
  const d = clamp(v, 0, 1);
  let k: number;
  let clean = false;
  if (c.sample) {
    const amt = Math.max(0, d - 0.25) / 0.75;
    clean = amt === 0;
    k = 1 + 8 * amt;
  } else {
    const m = c.model ?? '909';
    k = m === '909' ? 1.2 + 4 * d : m === '808' ? 0.6 + 3 * d : 1.5 * (0.4 + 2.4 * d);
  }
  const yc = 60;
  p.p(seg(X0, yc, X1, yc), 'grid');
  p.p(poly(shaped((x) => x, yc, 32)), 'ghost');
  p.p(poly(shaped((x) => (clean ? x : Math.tanh(k * x) / Math.tanh(k)), yc, 32)), 'hot');
  p.label('SAME PEAK, MORE BODY', X0, BOT);
  p.label(c.sample ? 'SAMPLE' : `${c.model === 'mm' ? 'MM' : (c.model ?? '909')} KICK`, X0, TOP);
  return p.value(clean ? 'CLEAN' : `TANH ${k.toFixed(1)}`).done();
};

/** SNAPPY : la peau et le timbre (le bruit) de la caisse claire de synthese ; un echantillon, le dessus au-dessus de 2 kHz. */
const drawSnappy: Draw = (c, v) => {
  const p = new Pic();
  const sn = clamp(v, 0, 1);
  if (c.sample) {
    // sampledsp.ts : v += tilt (v - passe-bas 2 kHz), tilt 2 (s - 0.5) au-dessus du milieu, 1.6 (s - 0.5) dessous
    const sd = sn - 0.5;
    const tilt = sd > 0 ? 2 * sd : 1.6 * sd;
    const lo = 100;
    const hi = 16000;
    const xOf = (f: number): number => X0 + ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (X1 - X0);
    const yOf = (db: number): number => 60 - clamp(db, -12, 12) * 3;
    p.p(seg(X0, yOf(0), X1, yOf(0)), 'dash');
    p.p(seg(xOf(2000), Y0, xOf(2000), Y1), 'grid');
    const pts: Pt[] = [];
    for (let k = 0; k <= 64; k += 1) {
      const f = lo * Math.pow(hi / lo, k / 64);
      const r = f / 2000;
      // |1 + tilt j r / (1 + j r)|
      const re = 1 + (tilt * r * r) / (1 + r * r);
      const im = (tilt * r) / (1 + r * r);
      pts.push([xOf(f), yOf(20 * Math.log10(Math.max(1e-4, Math.hypot(re, im))))]);
    }
    p.p(poly(pts), 'hot');
    p.label('2K', xOf(2000), BOT, 'middle').label('SAMPLE TOP END', X0, TOP);
    return p.value(sd === 0 ? 'AS IS' : `${v127(sn)}`).done();
  }
  const m = c.model ?? 'mm';
  const span = 0.25;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  // La part du bruit de chaque son (shotsdsp.ts sd909, sd808, sd) et celle de la peau
  const noise = m === '909' ? 0.3 + 1.8 * sn : m === '808' ? 0.2 + 1.4 * sn : 1.5 * 2 * sn;
  const skin = m === '909' ? 0.9 : m === '808' ? 0.85 : 0.8;
  const most = m === '909' ? 2.1 : m === '808' ? 1.6 : 3;
  const yOf = (a: number): number => Y1 - (a / most) * (Y1 - Y0 - 4);
  const env = (fn: (t: number) => number): Pt[] => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 72; k += 1) {
      const t = (span * k) / 72;
      pts.push([tx(t), yOf(fn(t))]);
    }
    return pts;
  };
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  const skinT = m === '909' ? 0.06 : m === '808' ? 0.05 : 0.045;
  p.p(poly(env((t) => skin * Math.exp(-t / skinT))), 'main');
  const noiseEnv = m === 'mm' ? (t: number) => noise * (0.85 * Math.exp(-t / 0.05) + 0.15 * Math.exp(-t / 0.13)) : (t: number) => noise * Math.exp(-t / (m === '909' ? 0.11 : 0.1));
  p.p(poly(env(noiseEnv)), 'hot');
  p.label('SKIN', X0 + 4, yOf(skin) - 4);
  p.label('WIRES', tx(0.05), Math.max(Y0 + 8, yOf(noiseEnv(0.05)) - 4));
  p.label(`${m === 'mm' ? 'MM' : m} SNARE, 250 MS`, X0, BOT);
  return p.value(`X${noise.toFixed(1)}`).done();
};

/** GATE : la reverbe a porte de la caisse claire MM (ouverte 130 ms, fermee en 40 ms), la petite piece du clap. */
const drawGate: Draw = (c, v) => {
  const p = new Pic();
  const on = v >= 0.5;
  const clap = c.voice === 'CP';
  const m = c.model ?? 'mm';
  const none = !!c.sample || (clap ? m === '808' : m !== 'mm');
  const span = 0.4;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const yOf = (a: number): number => Y1 - a * (Y1 - Y0 - 6);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  const dry: Pt[] = [];
  const wet: Pt[] = [];
  for (let k = 0; k <= 96; k += 1) {
    const t = (span * k) / 96;
    dry.push([tx(t), yOf(Math.exp(-t / (clap ? 0.075 : 0.05)))]);
    let w: number;
    if (clap) {
      // shotsdsp.ts cp, cpModel : une piece de 0.45 s (0.35 en 909), fondue dans ses 80 ms de fin
      const rt = m === '909' ? 0.35 : 0.45;
      const end = 0.2;
      const fade = t > end - 0.08 ? Math.max(0, 0.5 + 0.5 * Math.cos((Math.PI * (t - (end - 0.08))) / 0.08)) : 1;
      w = t > end ? 0 : (m === '909' ? 0.12 : 0.16) * 3 * Math.pow(10, (-3 * t) / rt) * fade;
    } else {
      // shotsdsp.ts sd : une piece de 1.1 s a 0.32, ouverte 130 ms puis fermee en 40 ms
      const g = t < 0.13 ? 1 : t < 0.17 ? 0.5 + 0.5 * Math.cos((Math.PI * (t - 0.13)) / 0.04) : 0;
      w = 0.32 * 2 * Math.pow(10, (-3 * t) / 1.1) * g;
    }
    wet.push([tx(t), yOf(Math.min(1, w))]);
  }
  p.p(poly(dry), 'main');
  p.p(poly(wet), on && !none ? 'hot' : 'dash');
  if (!clap) p.p(seg(tx(0.13), Y0, tx(0.13), Y1), 'grid').p(seg(tx(0.17), Y0, tx(0.17), Y1), 'grid');
  p.label(none ? 'NO GATE ON THIS SOUND' : clap ? 'CLAP ROOM' : 'OPEN 130 MS, SHUT IN 40 MS', X0, TOP);
  p.label('400 MS', X1, BOT, 'end');
  return p.value(on ? 'ON' : 'OFF').done();
};

/** STRETCH : le meme coup plus court ou plus long, a la meme hauteur (x0.25 a x4, time.ts timeFactor). */
const drawStretch: Draw = (_c, v) => {
  const p = new Pic();
  const f = timeFactor(clamp(v, -1, 1));
  const base = 0.25;
  const span = base * 4;
  const yc = 60;
  const x = (t: number): number => X0 + ((X1 - X0) * t) / span;
  p.p(seg(X0, yc, X1, yc), 'grid');
  p.p(poly(hitWave(x(0), x(base), yc, 30, 0.25, 7)), 'ghost');
  p.p(poly(hitWave(x(0), x(base * f), yc, 30, 0.25, 7 * f)), 'hot');
  p.p(seg(x(base), Y0, x(base), Y1), 'dash');
  p.label('X1', x(base) + 3, Y0 + 6);
  p.label('SAME PITCH', X0, BOT);
  return p.value(`X${f.toFixed(2)}`).done();
};

/* ---------------- les couches de R3 (2026-10-08) ---------------- */

/** LEVEL d'une couche (SRC H, SMPL H) : le gain v^2, 0 dB a 127 (la couche calee), OFF a 0. */
const drawLayerLevel: Draw = (c, v) => {
  const p = new Pic();
  gainCurve(p, (x) => x * x, v, 6, -30);
  p.label(c.page === 'smpl' ? 'SAMPLE LAYER' : 'SYNTH LAYER', X0 + 34, TOP);
  return p.value(v <= 0 ? 'OFF' : dbText(v * v)).done();
};

/** LEN de la couche SAMPLE : la part du fichier gardee, sa fin en fondu (sampledsp.ts sampleLenPart). */
const drawSampleLen: Draw = (_c, v) => {
  const p = new Pic();
  const yOf = (a: number): number => Y1 - a * (Y1 - Y0 - 6);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  const part = sampleLenPart(v);
  const tx = (t: number): number => X0 + (X1 - X0) * t;
  const file: Pt[] = [];
  const kept: Pt[] = [];
  const fade0 = part < 1 ? part * 0.5 : 1;
  for (let k = 0; k <= 96; k += 1) {
    const t = k / 96;
    const a = Math.exp(-t / 0.3);
    file.push([tx(t), yOf(a)]);
    let g = t > part ? 0 : 1;
    if (t >= fade0 && t <= part) g = 0.5 + 0.5 * Math.cos((Math.PI * (t - fade0)) / Math.max(1e-6, part - fade0));
    kept.push([tx(t), yOf(a * g)]);
  }
  p.p(poly(file), 'ghost');
  p.p(poly(kept), 'hot');
  if (part < 1) p.p(seg(tx(part), Y0, tx(part), Y1), 'dash');
  p.label(`KEEPS ${Math.round(part * 100)}% OF THE FILE`, X0, TOP);
  return p.value(part >= 1 ? 'FULL' : `${Math.round(part * 100)}%`).done();
};

/** FINE de la couche SAMPLE : +/-64 cents, entre deux demi-tons. */
const drawFine: Draw = (_c, v) => {
  const p = new Pic();
  const cents = Math.round(clamp(v, -1, 1) * 64);
  const y = 72;
  const xOf = (k: number): number => X0 + ((k + 64) / 128) * (X1 - X0);
  p.p(seg(X0, y, X1, y), 'grid');
  for (const k of [-64, -32, 0, 32, 64]) {
    p.p(seg(xOf(k), y, xOf(k), y - (k === 0 ? 10 : 5)), k === 0 ? 'main' : 'grid');
    p.label(k > 0 ? `+${k}` : String(k), xOf(k), y + 14, k === -64 ? 'start' : k === 64 ? 'end' : 'middle');
  }
  p.p(seg(xOf(cents), 34, xOf(cents), y), 'hot');
  p.p(dot(xOf(cents), 34, 2.6), 'hot', true);
  p.label('CENTS (100 = A SEMITONE)', X0, BOT);
  return p.value(cents > 0 ? `+${cents}` : String(cents)).done();
};

/** REV de la couche SAMPLE : le fichier a l'endroit ou a l'envers. */
const drawReverse: Draw = (_c, v) => {
  const p = new Pic();
  const on = v >= 0.5;
  const wave = hitWave(X0, X1, 60, 30);
  const shown = on ? wave.map(([x, y]) => [X0 + X1 - x, y] as Pt) : wave;
  p.p(seg(X0, 60, X1, 60), 'grid');
  p.p(poly(on ? wave : shown.map(([x, y]) => [X0 + X1 - x, y] as Pt)), 'ghost');
  p.p(poly(shown), 'hot');
  p.p(arrow(on ? X1 - 20 : X0 + 20, Y0, on ? X0 + 20 : X1 - 20, Y0, 4), 'main');
  p.label(on ? 'PLAYED BACKWARD' : 'PLAYED FORWARD', X0, BOT);
  return p.value(on ? 'ON' : 'OFF').done();
};

/** SWEEP du kick de synthese : sa hauteur dans les 60 premieres ms (la descente, x0 a x2 de celle d'origine). */
const drawSweep: Draw = (c, v) => {
  const p = new Pic();
  const m = c.model ?? '909';
  const f0 = kickHz(m, c.kit?.tune ?? 0.5);
  const sw = sweepDepth(clamp(v, 0, 1));
  const span = 0.06;
  const fOf = (t: number, k: number): number => {
    if (m === '909') return f0 * (1 + 3.4 * k * Math.exp(-t / 0.0045) + 0.45 * k * Math.exp(-t / 0.03));
    if (m === '808') return f0 * (1 + 0.3 * k * Math.exp(-t / 0.01));
    return (52 + 125 * k * Math.exp(-t / 0.009) + 22 * k * Math.exp(-t / 0.045)) * (f0 / 52);
  };
  const top = f0 * (1 + KICK_SWEEP[m] * 2);
  const yOf = (f: number): number => Y1 - ((Math.log(f) - Math.log(f0 * 0.9)) / (Math.log(top) - Math.log(f0 * 0.9))) * (Y1 - Y0);
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const curve = (k: number): Pt[] => Array.from({ length: 97 }, (_, i) => [tx((span * i) / 96), yOf(fOf((span * i) / 96, k))] as Pt);
  p.p(seg(X0, yOf(f0), X1, yOf(f0)), 'dash');
  p.p(poly(curve(1)), 'ghost');
  p.p(poly(curve(sw)), 'hot');
  p.label(`${Math.round(f0)} HZ`, X1, yOf(f0) - 4, 'end');
  p.label(`${m === 'mm' ? 'MM' : m} KICK PITCH, 60 MS`, X0, TOP);
  return p.value(`${Math.log2(1 + KICK_SWEEP[m] * sw).toFixed(1)} OCT`).done();
};

/** TUNE de la caisse claire de synthese : la note de sa peau, +/-12 demi-tons. */
const drawSdTune: Draw = (c, v) => {
  const p = new Pic();
  const m = c.model ?? 'mm';
  const st = Math.round((clamp(v, 0, 1) - 0.5) * 24);
  semitoneScale(p, st, 12);
  p.label(`${m === 'mm' ? 'MM' : m} SNARE HEAD`, X0, TOP);
  return p.value(hzText(SD_BODY_HZ[m] * sdTuneFactor(clamp(v, 0, 1)))).done();
};

/** DECAY de la caisse claire de synthese : la tenue de son timbre, x0.42 a x2.4. */
const drawSdDecay: Draw = (c, v) => {
  const p = new Pic();
  const m = c.model ?? 'mm';
  const tau = SD_DECAY_S[m] * sdDecayFactor(clamp(v, 0, 1));
  const span = 0.6;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const yOf = (a: number): number => Y1 - a * (Y1 - Y0 - 6);
  const curve = (tt: number): Pt[] => Array.from({ length: 97 }, (_, i) => [tx((span * i) / 96), yOf(Math.exp(-((span * i) / 96) / tt))] as Pt);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  sixteenths(p, stepS(c.bpm), span);
  p.p(poly(curve(SD_DECAY_S[m])), 'ghost');
  p.p(poly(curve(tau)), 'hot');
  p.label(`${m === 'mm' ? 'MM' : m} SNARE WIRES`, X0, TOP);
  return p.value(durText(3 * tau)).done();
};

/** TONE de la caisse claire de synthese : le passe-haut de son timbre, +/-1 octave. */
const drawSdTone: Draw = (c, v) => {
  const p = new Pic();
  const m = c.model ?? 'mm';
  const f = SD_TONE_HZ[m] * sdToneFactor(clamp(v, 0, 1));
  const lo = 200;
  const hi = 8000;
  const xOf = (x: number): number => X0 + ((Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (X1 - X0);
  const y = 76;
  p.p(seg(X0, y, X1, y), 'grid');
  for (const k of [250, 500, 1000, 2000, 4000]) {
    p.p(seg(xOf(k), y, xOf(k), y + 4), 'grid');
    p.label(hzText(k), xOf(k), y + 15, 'middle');
  }
  p.p(poly([[X0, y - 2], [xOf(f) - 16, y - 2], [xOf(f), 34], [X1, 34]]), 'hot');
  p.label('WIRES ABOVE', X0, TOP);
  return p.value(`HP ${hzText(f)}`).done();
};

/** START : ou le coup part dans son echantillon (au plus 90 %), la partie sautee en retrait. */
const drawStart: Draw = (_c, v) => {
  const p = new Pic();
  const st = clamp(v, 0, 1) * START_MAX;
  const yc = 60;
  const xs = X0 + st * (X1 - X0);
  const wave = hitWave(X0, X1, yc, 32);
  p.p(seg(X0, yc, X1, yc), 'grid');
  if (st > 0) p.p(rbox(X0, Y0, xs - X0, Y1 - Y0, 2), 'grid', true);
  p.p(poly(wave.filter(([x]) => x <= xs)), 'ghost');
  p.p(poly(wave.filter(([x]) => x >= xs)), 'main');
  p.p(seg(xs, Y0 - 4, xs, Y1), 'hot');
  p.p(tip(xs - 6, Y0 + 2, xs, Y0 + 2, 4), 'hot');
  p.label('THE SOUND, START TO END', X0, BOT);
  const n = Math.round(st * 100);
  return p.value(n === 0 ? 'FROM TOP' : `${n}% IN`).done();
};

/** TONE de la voix : son passe-bas (gauche) ou passe-haut (droite), Q 0.707 (tone.ts), et la hauteur qui suit (+/-7 demi-tons). */
const drawTone: Draw = (_c, v) => {
  const p = new Pic();
  const t = clamp(v, -1, 1);
  const lo = 20;
  const hi = 20000;
  const xOf = (f: number): number => X0 + ((Math.log(f) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (X1 - X0);
  const yOf = (db: number): number => Y0 + ((6 - clamp(db, -36, 6)) / 42) * (Y1 - Y0);
  for (const f of [100, 1000, 10000]) p.p(seg(xOf(f), Y0, xOf(f), Y1), 'grid');
  p.label('100', xOf(100), BOT, 'middle').label('1K', xOf(1000), BOT, 'middle').label('10K', xOf(10000), BOT, 'middle');
  p.p(seg(X0, yOf(0), X1, yOf(0)), 'dash');
  const fh = toneHpHz(t);
  const fl = toneLpHz(t, 24000);
  const pts: Pt[] = [];
  for (let k = 0; k <= 96; k += 1) {
    const f = lo * Math.pow(hi / lo, k / 96);
    // Deux biquads de Butterworth (Q 0.707) : |H|^2 = 1 / (1 + (f / fc)^4) pour le passe-bas, (f/fc)^4 / (1 + (f/fc)^4) pour le passe-haut
    const rl = Math.pow(f / fl, 4);
    const rh = Math.pow(fh / f, 4);
    const db = t === 0 ? 0 : -10 * Math.log10(1 + rl) - 10 * Math.log10(1 + rh);
    pts.push([xOf(f), yOf(db)]);
  }
  p.p(poly(pts), 'hot');
  const st = toneSemitones(t);
  p.label(t === 0 ? 'BYPASS' : `PITCH ${st > 0 ? '+' : ''}${st.toFixed(1)} ST`, X0, TOP);
  return p.value(t === 0 ? 'FLAT' : t < 0 ? `LP ${hzText(fl)}` : `HP ${hzText(fh)}`).done();
};

/** DEC (AMP) : le coup tenu 4 ms, puis sa queue e^(-t/tau) (voicefx.ts decayTau) ; tout en haut, le son entier. */
const drawAmpDecay: Draw = (c, v) => {
  const p = new Pic();
  const sd = stepS(c.bpm);
  const tau = decayTau(clamp(v, 0, 1));
  const yOf = (a: number): number => Y1 - a * (Y1 - Y0 - 6);
  p.p(seg(X0, Y1, X1, Y1), 'grid');
  if (tau === null) {
    p.p(seg(X0, yOf(1), X1, yOf(1)), 'hot');
    p.label('THE WHOLE SOUND, NO ENVELOPE', X0, BOT);
    return p.value('FULL').done();
  }
  const tail = DECAY_HOLD_S + tau * Math.log(1000);
  const span = clamp(tail * 1.15, 0.1, 3);
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  sixteenths(p, sd, span);
  const pts: Pt[] = [];
  for (let k = 0; k <= 120; k += 1) {
    const t = (span * k) / 120;
    pts.push([tx(t), yOf(t < DECAY_HOLD_S ? 1 : Math.exp(-(t - DECAY_HOLD_S) / tau))]);
  }
  p.p(poly(pts), 'hot');
  if (tail < span) p.p(seg(tx(tail), Y0, tx(tail), Y1), 'dash');
  p.label('HOLD 4 MS, THEN THE TAIL', X0, TOP);
  if (tail < span) p.label('-60 DB', Math.max(X0 + 30, tx(tail) - 3), Y0 + 8, 'end');
  p.label(`1/16 = ${Math.round(sd * 1000)} MS`, X0, BOT);
  // La valeur lue : celle de la ligne d'unite de l'ecran (rytm/values.ts encUnit, la queue sans les 4 ms tenues)
  return p.value(durText(tau * Math.log(1000))).done();
};

/** PAN : la place du coup, et ses deux cotes (mono a puissance constante, x racine de 2 : drums.ts). */
const drawPan: Draw = (_c, v) => {
  const p = new Pic();
  const pan = Math.abs(v) < 0.02 ? 0 : clamp(v, -1, 1);
  const y = 40;
  const xa = X0 + 24;
  const xb = X1 - 24;
  const xOf = (q: number): number => xa + ((q + 1) / 2) * (xb - xa);
  p.p(seg(xa, y, xb, y), 'main');
  p.p(seg(xOf(0), y - 6, xOf(0), y + 6), 'grid');
  p.label('L', X0, y + 3).label('R', X1, y + 3, 'end');
  p.p(dot(xOf(pan), y, 5), 'hot', true);
  const th = ((pan + 1) * Math.PI) / 4;
  const gl = pan === 0 ? 1 : Math.SQRT2 * Math.cos(th);
  const gr = pan === 0 ? 1 : Math.SQRT2 * Math.sin(th);
  const bar = (x: number, g: number, name: string): void => {
    const h = (g / Math.SQRT2) * 34;
    p.p(rbox(x, Y1 - 34, 40, 34, 3), 'grid');
    if (h > 0.5) p.p(rbox(x, Y1 - h, 40, h, 3), 'hot', true);
    p.label(`${name} ${dbText(g)}`, x + 20, BOT, 'middle');
  };
  bar(X0 + 40, gl, 'L');
  bar(X1 - 80, gr, 'R');
  const n = Math.round(Math.abs(pan) * 100);
  return p.value(n === 0 ? 'CENTER' : `${n}% ${pan < 0 ? 'LEFT' : 'RIGHT'}`).done();
};

/** DIST (de la voix ou du bus) : une sinusoide, sa copie saturee tanh((1 + 12 d) x) melangee a 0.85 d (fx.ts). */
const drawDist: Draw = (_c, v) => {
  const p = new Pic();
  const d = clamp(v, 0, 1);
  const D = 1 + DRIVE.gain * d;
  const m = DRIVE.mix * d;
  const yc = 60;
  p.p(seg(X0, yc, X1, yc), 'grid');
  p.p(poly(shaped((x) => x, yc, 30)), 'ghost');
  p.p(poly(shaped((x) => (1 - m) * x + m * Math.tanh(D * x), yc, 30)), 'hot');
  p.label(`DRIVE X${D.toFixed(1)}`, X0, TOP);
  // Le sec baisse d'autant que le sature monte (fx.ts : sec 1 - m, sature m)
  p.label(`WET ${Math.round(m * 100)}%  DRY ${Math.round((1 - m) * 100)}%`, X0, BOT);
  return p.value(`${Math.round(d * 100)}%`).done();
};

/** CHORUS : les deux retards (14 et 21 ms, +/-7 ms) sur quatre secondes, et le melange sec / chorus. */
const drawChorus: Draw = (_c, v) => {
  const p = new Pic();
  const x1 = 168;
  const span = 4;
  const tx = (t: number): number => X0 + ((x1 - X0) * t) / span;
  const yOf = (ms: number): number => Y1 - (ms / 30) * (Y1 - Y0);
  for (const ms of [10, 20]) p.p(seg(X0, yOf(ms), x1, yOf(ms)), 'grid');
  const line = (base: number, f: number): Pt[] => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 96; k += 1) {
      const t = (span * k) / 96;
      pts.push([tx(t), yOf(base + CHORUS.depth * Math.sin(2 * Math.PI * f * t))]);
    }
    return pts;
  };
  p.p(poly(line(CHORUS.l, CHORUS.fl)), 'main');
  p.p(poly(line(CHORUS.r, CHORUS.fr)), 'dash');
  p.label('L', X0 + 2, yOf(CHORUS.l + CHORUS.depth) - 3).label('R', X0 + 16, yOf(CHORUS.r + CHORUS.depth) - 3);
  const c0 = clamp(v, 0, 1);
  const bar = (x: number, g: number, name: string, hot: boolean): void => {
    const h = g * (Y1 - Y0 - 8);
    p.p(rbox(x, Y0 + 8, 18, Y1 - Y0 - 8, 3), 'grid');
    if (h > 0.5) p.p(rbox(x, Y1 - h, 18, h, 3), hot ? 'hot' : 'main', true);
    p.label(name, x + 9, BOT, 'middle');
  };
  bar(178, 1 - 0.5 * c0, 'DRY', false);
  bar(206, c0, 'WET', true);
  p.label('DELAY MS, 4 S', X0, BOT);
  return p.value(`${Math.round(c0 * 100)}%`).done();
};

/** DELAY : la frappe et ses echos a la croche pointee (3 pas au tempo), envoi 0.9 v, retour 0.58 (sends.ts). */
const drawDelay: Draw = (c, v) => {
  const p = new Pic();
  const sd = stepS(c.bpm);
  const send = clamp(v, 0, 1);
  const steps = 32;
  const tx = (i: number): number => X0 + ((X1 - X0) * i) / steps;
  const base = Y1;
  const hOf = (a: number): number => a * (Y1 - Y0 - 6);
  for (let i = 4; i < steps; i += 4) p.p(seg(tx(i), Y0, tx(i), Y1), i % 16 === 0 ? 'ghost' : 'grid');
  p.p(seg(X0, base, X1, base), 'grid');
  p.p(seg(tx(0) + 1, base, tx(0) + 1, base - hOf(1)), 'main');
  let a = DELAY.send * send;
  for (let i = DELAY.steps; i < steps && a > 0.01; i += DELAY.steps) {
    p.p(seg(tx(i), base, tx(i), base - hOf(a)), 'hot');
    a *= DELAY.feedback;
  }
  p.label(`3/16 = ${Math.round(DELAY.steps * sd * 1000)} MS  FEEDBACK 58 %`, X0, TOP);
  p.label('TWO BARS', X0, BOT);
  return p.done();
};

/** Un hasard fixe (le dessin ne tremble pas). */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** REVERB : la queue de 2.4 s (-60 dB au bout), des reflexions plus denses, a l'echelle de l'envoi. */
const drawReverb: Draw = (_c, v) => {
  const p = new Pic();
  const send = clamp(v, 0, 1);
  const span = REVERB_S * 1.1;
  const tx = (t: number): number => X0 + ((X1 - X0) * t) / span;
  const base = 96;
  const ay = (a: number): number => base - a * (base - 28);
  p.p(seg(X0, base, X1, base), 'grid');
  const env = (t: number): number => Math.pow(10, (-3 * t) / REVERB_S);
  const rnd = mulberry(909);
  let lines = '';
  for (let k = 0; k < 90; k += 1) {
    const t = 0.02 + (span - 0.02) * Math.pow(k / 90, 1.3);
    lines += seg(tx(t), base, tx(t), ay(env(t) * (0.35 + 0.65 * rnd()) * send));
  }
  p.p(lines, 'main');
  const pts: Pt[] = [];
  for (let k = 0; k <= 48; k += 1) {
    const t = (span * k) / 48;
    pts.push([tx(t), ay(env(t))]);
  }
  p.p(poly(pts), 'dash');
  p.p(seg(tx(REVERB_S), 24, tx(REVERB_S), base), 'dash');
  p.label('-60 DB AT 2.4 S', X0, TOP);
  p.label('HIGHS DIE FIRST', X0, BOT);
  return p.value(`${Math.round(send * 100)}%`).done();
};

/** TEMPO : 100 a 150 BPM, la double croche qui en sort. */
const drawTempo: Draw = (c, v) => {
  const p = new Pic();
  const bpm = Math.round(clamp(c.bpm ?? v, BPM.min, BPM.max));
  const xOf = (b: number): number => X0 + ((b - BPM.min) / (BPM.max - BPM.min)) * (X1 - X0);
  const y = 70;
  p.p(seg(X0, y, X1, y), 'grid');
  for (let b = BPM.min; b <= BPM.max; b += 5) {
    const big = b % 10 === 0;
    p.p(seg(xOf(b), y, xOf(b), y - (big ? 9 : 4)), big ? 'main' : 'grid');
    if (big) p.label(String(b), xOf(b), y + 15, b === BPM.min ? 'start' : b === BPM.max ? 'end' : 'middle');
  }
  p.p(seg(xOf(BPM.initial), y - 14, xOf(BPM.initial), y), 'dash');
  p.p(seg(xOf(bpm), 32, xOf(bpm), y), 'hot');
  p.p(dot(xOf(bpm), 32, 2.8), 'hot', true);
  p.label(`1/16 = ${Math.round(stepS(bpm) * 1000)} MS`, X0, TOP);
  p.label('BPM', X1, BOT, 'end');
  return p.value(`${bpm} BPM`).done();
};

/** Une touche de page : ses huit blocs a la place des encodeurs (les reglages a venir : une case vide, comme a l'ecran). */
function pageGrid(page: RytmInfoPage, voice: Inst | null): RytmDiagram {
  const p = new Pic();
  const slots = rytmSlots(page, voice);
  // Des blocs de 51 de large (4 entre eux) : STRETCH y tient
  const bw = (X1 - X0 - 12) / 4;
  const bh = 34;
  slots.forEach((sl, k) => {
    const x = X0 + (k % 4) * (bw + 4);
    const y = 24 + (k < 4 ? 0 : bh + 8);
    const live = !!sl && rytmAvail(sl.id) === 'live';
    p.p(rbox(x, y, bw, bh, 3), live ? 'main' : 'grid');
    p.label(RYTM_LETTERS[k], x + bw - 4, y + 11, 'end');
    // Le nom centre : STRETCH et SNAPPY tiennent dans le bloc (a gauche, ils debordaient)
    if (sl && live) p.label(sl.label, x + bw / 2, y + bh - 7, 'middle');
  });
  p.label(page === 'src' && voice ? `ENCODERS A TO H, ${voice}` : 'ENCODERS A TO H', X0, TOP);
  return p.done();
}

/** Un pas : les seize pas de la voix, leur velocite, un point sous ceux qui ont des verrous, le pas montre en couleur. */
const drawStep: Draw = (c) => {
  const p = new Pic();
  const at = c.step ?? -1;
  strip(p, c, 34, 40, at, false);
  p.label(c.voice ? `${c.voice}, 16 STEPS` : '16 STEPS', X0, TOP);
  if (at >= 0) p.value(`STEP ${two(at + 1)}`);
  return p.done();
};

/** LOCK : le pas en LOCK cerne et plein, les points des pas verrouilles. */
const drawLock: Draw = (c) => {
  const p = new Pic();
  const at = c.step ?? -1;
  strip(p, c, 34, 40, at, true);
  p.label('DOT: STEP WITH LOCKS', X0, TOP);
  if (at >= 0) p.value(`LOCK ${two(at + 1)}`);
  return p.done();
};

/** HOME : l'anneau des seize pas de la voix. */
const drawHome: Draw = (c) => {
  const p = new Pic();
  const cx = 120;
  const cy = 60;
  const r = 34;
  p.p(dot(cx, cy, r), 'grid');
  for (let i = 0; i < 16; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 16;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const vel = c.steps ? clamp(c.steps.charCodeAt(i) - 48, 0, 9) : 0;
    p.p(dot(x, y, vel > 0 ? 2 + (vel / 9) * 2.5 : 1.6), vel > 0 ? (i === c.step ? 'hot' : 'main') : 'ghost', true);
  }
  p.label('HOME RING', X0, TOP);
  return p.done();
};

/** Un pad : la crete de chaque voix sous celle du kick (shotsdsp.ts SHOT_BELOW), la voix du pad en couleur. */
function padLevels(voice: Inst): RytmDiagram {
  const p = new Pic();
  const pitch = (X1 - X0) / RYTM_INFO_VOICES.length;
  const yOf = (db: number): number => Y0 + 6 + (clamp(-db, 0, 8) / 8) * (Y1 - Y0 - 12);
  p.p(seg(X0, yOf(0), X1, yOf(0)), 'dash');
  RYTM_INFO_VOICES.forEach((v, i) => {
    const below = SHOT_BELOW[v];
    const x = X0 + i * pitch + 4;
    const y = yOf(-below);
    p.p(rbox(x, y, pitch - 8, Y1 - y, 2), v === voice ? 'hot' : 'ghost', true);
    p.label(v, x + (pitch - 8) / 2, BOT, 'middle');
  });
  p.label('PEAK CAP UNDER THE KICK', X0, TOP);
  const b = SHOT_BELOW[voice];
  return p.value(b === 0 ? '0 DB' : `-${b} DB`).done();
}

/** L'ecran en vue PAGE : l'en-tete, les huit blocs, le pied et ses seize pas. */
const drawScreen: Draw = () => {
  const p = new Pic();
  p.p(rbox(X0, 18, X1 - X0, 12, 2), 'ghost');
  p.label('HEADER: TAP FOR PRESETS', X0 + 4, 27);
  const bw = (X1 - X0 - 18) / 4;
  const bh = 26;
  for (let k = 0; k < 8; k += 1) {
    const x = X0 + (k % 4) * (bw + 6);
    const y = 34 + (k < 4 ? 0 : bh + 4);
    p.p(rbox(x, y, bw, bh, 3), 'main');
    p.label(RYTM_LETTERS[k], x + 4, y + 11);
  }
  const pitch = 108 / 16;
  for (let i = 0; i < 16; i += 1) p.p(rbox(X0 + i * pitch, 98, pitch - 1.5, 6, 1), i === 4 ? 'hot' : 'grid', true);
  p.label('16 STEPS', X0, BOT + 2);
  return p.done();
};

const DRAW: Partial<Record<RytmInfoId, Draw>> = {
  vol: drawVol,
  level: drawMaster,
  'step:vel': drawVel,
  swing: drawSwing,
  vsound: drawSounds,
  'smpl:sample': drawSounds,
  'r:bd': drawSounds,
  'r:sd': drawSounds,
  'r:cp': drawSounds,
  'r:hh': drawSounds,
  'r:tom': drawSounds,
  vtune: drawTune,
  'r3:machine': drawSounds,
  'r3:synlevel': drawLayerLevel,
  'r3:smplevel': drawLayerLevel,
  'r3:sweep': drawSweep,
  'r3:sdtune': drawSdTune,
  'r3:sddecay': drawSdDecay,
  'r3:sdtone': drawSdTone,
  'r3:stune': drawTune,
  'r3:sfine': drawFine,
  'r3:sstart': drawStart,
  'r3:send': drawSampleLen,
  'r3:reverse': drawReverse,
  'r:tune': drawKickTune,
  'r:decay': drawKickDecay,
  'r:attack': drawKickAttack,
  'r:drive': drawKickDrive,
  'r:snappy': drawSnappy,
  'r:gate': drawGate,
  stretch: drawStretch,
  vstart: drawStart,
  tone: drawTone,
  vdecay: drawAmpDecay,
  vpan: drawPan,
  vdist: drawDist,
  dist: drawDist,
  vchorus: drawChorus,
  chorus: drawChorus,
  vdelay: drawDelay,
  delay: drawDelay,
  vreverb: drawReverb,
  reverb: drawReverb,
  tempo: drawTempo,
  step: drawStep,
  lock: drawLock,
  home: drawHome,
  screen: drawScreen,
};

/** Les reglages a zero au centre (-1 a 1). */
const BIPOLAR: ReadonlySet<string> = new Set(['tone', 'stretch', 'vtune', 'vpan', 'r3:stune', 'r3:sfine']);

/**
 * Le dessin d'une commande (null : elle n'en a pas, ou pas encore : les
 * reglages a venir, les touches du transport, INFOS). Un potard de page
 * (p:0 a p:7) est d'abord resolu (resolveRytmId, avec voice, page, target).
 * c.v est borne au domaine du reglage. Un dessin ne casse jamais la carte.
 */
export function rytmDiagram(id: string, c: RytmDiagramCtx): RytmDiagram | null {
  const rid = resolveRytmId(id, c);
  if (!rid) return null;
  try {
    if (rid.startsWith('pad:')) return padLevels(rid.slice(4) as Inst);
    if ((RYTM_INFO_PAGES as readonly string[]).includes(rid)) return pageGrid(rid as RytmInfoPage, c.voice ?? null);
    const fn = DRAW[rid];
    if (!fn) return null;
    const raw = Number.isFinite(c.v) ? c.v : 0;
    const v = rid === 'step:vel' || rid === 'tempo' || DRAW[rid] === drawSounds ? raw : BIPOLAR.has(rid) ? clamp(raw, -1, 1) : clamp(raw, 0, 1);
    return fn(c, v);
  } catch {
    return null;
  }
}
