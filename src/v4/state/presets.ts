/**
 * Les presets du MM-ARP et du MM-RYTM (2026-10-04, Mika : "quand je trouve
 * un truc cool, je voudrais que ca sauvegarde un preset, avec un nom
 * aleatoire de un ou deux mots, style les noms de Reddit, droles des
 * fois"). SAVE garde l'etat entier de la machine sous un nom tire au
 * hasard (un adjectif et un nom, parfois un seul mot, jamais deux fois le
 * meme), le plus recent en tete ; toucher un preset le recharge.
 * - MM-ARP : tous les potards, la suite de l'arpege (AUTO ou EDIT) et la
 *   progression d'accords ; recharger ne lance ni n'arrete l'arpege.
 * - MM-RYTM : le motif et ses velocites, le tempo, SWING STRETCH DIST
 *   CHORUS DELAY REVERB, les effets de chaque voix (MASTER reste : un
 *   preset ne fait jamais sauter le niveau), et le kit des TWEAKS (les sons
 *   et le kick, audio/kit.ts, 2026-10-04 ; un preset d'avant ne le touche pas),
 *   et depuis le 2026-10-08 les verrous des pas (audio/locks.ts ; un preset
 *   d'avant n'en a pas : le motif recharge n'en garde aucun), et les deux
 *   couches de chaque voix (l'etape R3 : la MACHINE de la couche SYNTH,
 *   l'echantillon de la couche SAMPLE, leurs niveaux et reglages, audio/kit.ts) ;
 *   un preset d'avant R3 se traduit au meme son (un echantillon choisi : la
 *   couche SAMPLE seule, avec le TUNE et le DECAY du kick d'alors ; un modele :
 *   la couche SYNTH seule).
 * - MM-BASS (2026-10-07) : tous ses potards et sa ligne (les pas et leurs
 *   verrous) ; recharger ne lance ni n'arrete la basse ; tant que rien n'a
 *   bouge depuis, son ecran nomme le preset (current, 2026-10-09) ; la
 *   recette de la ligne aussi (2026-10-09, bass/state.ts BassRecipe : sa
 *   graine, STYLE et DENSITY la reecrivent ; un preset d'avant n'en a pas,
 *   ses notes sont a la main). Le moteur MONARK (2026-10-09) : un reglage
 *   absent d'un preset prend sa valeur d'heritage (legacy ?? def) ; un preset
 *   garde avant lui revient donc en MODE 303, a son son d'alors, et l'ecran le
 *   dit (SAVED IN 303 MODE : MODE se change sur FILTER CONTOUR). Au premier
 *   reveil apres la mise a jour, le son retenu d'avant (bass/params.ts
 *   legacy) passe une fois au moteur d'aujourd'hui (migrateBass : celui du
 *   preset d'usine qu'il etait, ou MM CLASSIC), sauf l'ACID et ce qui est
 *   encore 303.
 * Gardes dans ce navigateur (localStorage), 99 par machine au plus. Les
 * presets d'usine (state/factory.ts, des styles de musique electronique)
 * suivent ceux de Mika ; ils se chargent, ne se renomment ni ne s'effacent.
 *
 * Rien ne se perd sans le dire (2026-10-11, Mika : "je voulais enregistrer un
 * preset que j'avais fait mais ca ne fonctionne pas bien.. du coup j'ai tout
 * perdu.. parce que j'ai du passer un preset nouveau") :
 * - YOUR SOUND : le son du moment, s'il n'est garde nulle part (ni preset ni
 *   brouillon), est mis de cote avant qu'un preset ne le remplace (ouvrir le
 *   mode presets, PREV, NEXT), trois au plus par machine, gardes dans le
 *   navigateur ; le mode presets les montre avant les presets (drafts), y
 *   revenir les recharge, SAVE en fait un preset. Avant, PREV et NEXT
 *   ecrasaient le son du moment sans retour possible ;
 * - SAVE dit quand le navigateur n'a pas pris le preset (plein ou refuse :
 *   save() rend kept false, l'ecran dit NOT SAVED) ; avant, commit() avalait
 *   l'erreur et l'ecran disait SAVED, le preset disparaissait a la visite
 *   suivante. Plein : la copie de l'historique UNDO (state/undo.ts, qui la
 *   reecrit plus courte) cede d'abord sa place ;
 * - le 61e preset effacait le plus ancien sans rien dire : SAVE refuse
 *   maintenant au dela de 99 (l'ecran dit d'en effacer un) ;
 * - deux onglets ouverts : chacun ecrivait sa liste par-dessus celle de
 *   l'autre (un preset garde dans l'un disparaissait au SAVE suivant de
 *   l'autre) ; chaque ecriture relit le navigateur et l'evenement storage
 *   tient la liste a jour ;
 * - une liste illisible (JSON casse) est gardee a part (KEY.bad) avant d'etre
 *   remplacee.
 *
 * Les noms (2026-10-27, la V.4.2, Mika : "qu'on puisse nommer ses presets ! un nom d'utilisateur 4 lettres et le nom
 * du preset jusqu'a 10 lettres") : un preset a toi s'ecrit USER/NAME (state/presetName.ts, les regles) ; SAVE prend le
 * nom choisi (le dialogue ou les potards), OVERWRITE remplace le son d'un preset a toi sans changer sa place ni son
 * nom, RENAME change son nom et son utilisateur. L'utilisateur de ce navigateur est retenu (USER_KEY). Les presets
 * d'avant les noms gagnent un nom aux regles a la lecture (migrateNames : le leur s'il tient, abrege mot par mot sinon,
 * numerote s'il est pris ; l'ancien dans was), ecrit une fois, et le premier utilisateur choisi (setUser, adoptLegacy) ;
 * leurs donnees ne bougent pas. Le preset charge ou garde de
 * chaque machine est retenu (cur, avec les sons mis de cote) : l'ecran le nomme, une etoile s'il a bouge (loaded).
 */

import { INSTRUMENTS, NEUTRAL_FX, clampBpm, cleanPmutes, compLegacy, pattern, type Fx, type Steps } from '../audio/pattern';
import { mix, setStretch } from '../audio/drums';
import { anyLocks, cleanLocks, type Locks } from '../audio/locks';
import { NO_SCENES, anyScenes, cleanScenes, toStored, type StoredScenes } from '../rytm/sceneData';
import { VOICE_FX_DEFAULT, voiceFx, VOICE_PARAMS, type VoiceFx } from '../audio/voicefx';
import { KIT_FAMILIES, KIT_IDS, KIT_KNOBS, LAYER_DEFAULT, LAYER_TUNE_ST, cleanKnob, cleanLayer, foldFamilies, kit, kitDefaultCopy, modelAt, resolveSample, type KitFamily, type KitId, type KitModel, type Layer } from '../audio/kit';
import { lenOfDecay, sampleTuneSt } from '../audio/sampledsp';
import type { Inst } from '../theme';
import { arp } from '../voyager/arp';
import { VOY_KNOB_IDS, foldLegacyKnobs, migrateKnobs, voyKnob, voyParams, type VoyValues } from '../voyager/params';
import { SEQ_MAX, seq, type SeqState } from '../voyager/seq';
import { BASS_KNOBS, ENGINE_IDS, bassKnob, bassParams, legacyOf, type BassKnobId } from '../bass/params';
import { bassLoad } from './bassload';
import { focus } from './focus';
import { bassLine } from '../bass/line';
import { bassState, cleanLen, cleanSteps, type BassRecipe, type BassStep } from '../bass/state';
import { arpFactory, bassFactory, rytmFactory } from './factory';
import { patterns } from './patterns';
import { analytics, track } from './analytics';
import { cleanUser, migrateNames, presetLabel, userOk } from './presetName';
import { bpmForSig, bpmToKeep } from './presetBpm';
import { tempoSync } from './tempoSync';

export type PresetMachine = 'voy' | 'mm808' | 'bass';
const MACHINES: readonly PresetMachine[] = ['voy', 'mm808', 'bass'];

interface BassData {
  params: Record<string, number>;
  steps: readonly BassStep[];
  /** la recette de la ligne (2026-10-09), absente d'un preset d'avant */
  recipe?: BassRecipe;
  /** la longueur de la ligne (2026-10-10), absente : 16 */
  len?: number;
}

interface VoyData {
  knobs: Partial<VoyValues>;
  seq: SeqState;
  prog: number[];
}

interface RytmData {
  steps: Steps;
  bpm: number;
  fx: Fx;
  stretch: number;
  voices: Record<Inst, VoiceFx>;
  /** les TWEAKS du kit (absent d'un preset d'avant le 2026-10-04) */
  kit?: Record<KitId, number>;
  /**
   * le son de chaque famille, par son nom (909, 808, mm, ou la cle d'un
   * echantillon : 2026-10-05) ; absent d'un preset d'avant : sa valeur dans
   * kit se lit sur trois crans (909, 808, MM)
   */
  sounds?: Partial<Record<KitFamily, string>>;
  /** les verrous des pas (2026-10-08, audio/locks.ts) ; absent sans verrou */
  locks?: Locks;
  /**
   * les deux couches de chaque famille (2026-10-08, l'etape R3) : la MACHINE
   * de la couche SYNTH, l'echantillon de la couche SAMPLE ('' : OFF), leurs
   * reglages ; absentes d'un preset d'avant (sounds et kit se traduisent)
   */
  machines?: Partial<Record<KitFamily, string>>;
  samples?: Partial<Record<KitFamily, string>>;
  layers?: Partial<Record<KitFamily, Partial<Layer>>>;
  /** tous les potards de la machine (ceux de R3 compris : SWEEP, la caisse claire) */
  knobs?: Record<string, number>;
  /** les scenes A et B du motif (2026-10-27, la phase 2) ; absentes sans scene (toutes les empreintes d'avant inchangees) */
  scenes?: StoredScenes;
  /** le mute du pattern (V.5.0, 2026-10-29) : les voix qu'il coupe ; absent sans voix coupee (les empreintes d'avant inchangees) */
  pmutes?: Inst[];
}

export interface Preset {
  id: string;
  /** le nom : 1 a 10, aux regles de state/presetName.ts (2026-10-27) ; un preset d'usine : le sien, tel quel */
  name: string;
  /** l'utilisateur, 4 caracteres (2026-10-27) ; absent : un preset d'avant les noms, il s'affiche sous celui du navigateur */
  user?: string;
  /** le nom d'avant la migration des noms (2026-10-27), s'il a change */
  was?: string;
  /** Date.now() a l'enregistrement */
  at: number;
  data: VoyData | RytmData | BassData;
  /** un preset d'usine (state/factory.ts) : ni renomme ni efface */
  factory?: boolean;
}

/** Le nom et l'utilisateur d'un SAVE ou d'un RENAME (aux regles : le mode presets les verifie, presetName.ts). */
export interface PresetNaming {
  user: string;
  name: string;
}

const KEY = 'mm.v4.presets.1';
/** Les sons mis de cote (YOUR SOUND) et l'empreinte du dernier preset charge ou garde, par machine (2026-10-11). */
const DRAFT_KEY = 'mm.v4.presets.drafts.1';
/** La copie de l'historique UNDO (state/undo.ts) : elle cede sa place a un SAVE quand le navigateur est plein. */
const UNDO_KEY = 'mm.v4.undo.1';
/** L'utilisateur de ce navigateur (2026-10-27) : 4 caracteres, demandes au premier SAVE, changes dans le dialogue. */
const USER_KEY = 'mm.v4.presets.user.1';
/** Les presets de Mika par machine (60 jusqu'au 2026-10-11 : le 61e effacait le plus ancien sans le dire). */
export const PRESET_MAX = 99;
const MAX = PRESET_MAX;
/** Les sons mis de cote par machine (YOUR SOUND, YOUR SOUND 2, YOUR SOUND 3). */
const DRAFTS = 3;

/* ---------------- le store ---------------- */

type All = Record<PresetMachine, Preset[]>;
const none = (): All => ({ voy: [], mm808: [], bass: [] });

/** Pourquoi le navigateur n'a pas pris une ecriture : full, plein ; off, refuse (stockage bloque). */
export type StoreFail = 'full' | 'off';

const isQuota = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);

/**
 * Une ecriture dans le navigateur : 'ok', sinon pourquoi. Plein : la copie de l'historique UNDO (state/undo.ts la
 * reecrit plus courte a son prochain geste, l'historique de la visite reste en memoire) cede sa place, une fois.
 */
function put(key: string, value: string): 'ok' | StoreFail {
  try {
    window.localStorage.setItem(key, value);
    return 'ok';
  } catch (e) {
    if (!isQuota(e)) return 'off';
  }
  try {
    if (window.localStorage.getItem(UNDO_KEY) === null) return 'full';
    window.localStorage.removeItem(UNDO_KEY);
    window.localStorage.setItem(key, value);
    return 'ok';
  } catch {
    return 'full';
  }
}

/** Le texte illisible trouve sous KEY (JSON casse) : garde a part (KEY.bad) avant la premiere ecriture par-dessus. */
let corrupt: string | null = null;

/** La migration des noms a change la liste lue (2026-10-27) : elle s'ecrit une fois au chargement. */
let renamedOnRead = false;

/** Ce que le navigateur garde ; null s'il refuse de le lire. Les presets d'avant les noms en recoivent un (migrateNames). */
function readStored(): All | null {
  let text: string | null;
  try {
    text = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (text === null) return none();
  try {
    const raw = JSON.parse(text) as Partial<All> | null;
    const ok = (xs: unknown): Preset[] => {
      if (!Array.isArray(xs)) return [];
      const list = xs.filter((p) => p && typeof p.name === 'string' && typeof p.id === 'string' && p.data && typeof p.data === 'object').map((p) => ({ ...p, at: typeof p.at === 'number' ? p.at : 0 })).sort((a, b) => b.at - a.at) as Preset[];
      // Les noms (2026-10-27) : un preset d'avant en recoit un aux regles ; ses donnees ne bougent pas
      const mig = migrateNames(list);
      if (mig.changed) renamedOnRead = true;
      return mig.list;
    };
    return { voy: ok(raw?.voy), mm808: ok(raw?.mm808), bass: ok(raw?.bass) };
  } catch {
    corrupt = text;
    return none();
  }
}

let all: All = typeof window === 'undefined' ? none() : (readStored() ?? none());
// La migration des noms, ecrite une fois (2026-10-27) ; refusee (plein, bloque) : elle se refait a chaque lecture, la meme
if (typeof window !== 'undefined' && renamedOnRead && corrupt === null) {
  renamedOnRead = false;
  put(KEY, JSON.stringify(all));
}
/** Les presets que le navigateur n'a pas pris (plein ou refuse) : ils vivent pour la visite, l'ecran le dit. */
const unsaved = new Set<string>();

/** L'utilisateur de ce navigateur (2026-10-27) ; null tant qu'il n'est pas choisi. */
let userTag: string | null = null;
if (typeof window !== 'undefined') {
  try {
    const u = window.localStorage.getItem(USER_KEY);
    userTag = userOk(u) ? u : null;
  } catch {
    userTag = null;
  }
}
/** Ceux effaces ici quand le navigateur n'a pas pris l'ecriture : une relecture ne les fait pas revenir. */
const dropped = new Set<string>();

/**
 * La liste du navigateur (un autre onglet a pu y ecrire), avec ce que cette visite n'a pas pu y mettre : chaque
 * ecriture part d'elle (avant, chaque onglet ecrivait sa propre liste par-dessus celle de l'autre). Le plus recent
 * en tete.
 */
function merged(st: All): All {
  const out = none();
  for (const m of MACHINES) {
    const mine = new Map(all[m].filter((p) => unsaved.has(p.id)).map((p) => [p.id, p] as const));
    const list = st[m].filter((p) => !dropped.has(p.id)).map((p) => mine.get(p.id) ?? p);
    for (const p of mine.values()) if (!list.some((q) => q.id === p.id)) list.push(p);
    out[m] = list.sort((a, b) => b.at - a.at);
  }
  return out;
}

/** Relit le navigateur avant une ecriture (illisible ou casse : la liste en memoire fait foi). */
function refresh(): void {
  const st = readStored();
  if (st && corrupt === null) all = merged(st);
}

/** Les presets d'usine, faits a la premiere demande. */
let factory: All | null = null;
function factoryOf(m: PresetMachine): readonly Preset[] {
  if (!factory) {
    const mk = (prefix: string, list: { name: string; data: Preset['data'] }[]): Preset[] => list.map((x, i) => ({ id: `factory-${prefix}-${i}`, name: x.name, at: 0, data: x.data, factory: true }));
    factory = {
      mm808: mk('rytm', rytmFactory() as { name: string; data: Preset['data'] }[]),
      voy: mk('arp', arpFactory(SEQ_MAX) as { name: string; data: Preset['data'] }[]),
      bass: mk('bass', bassFactory()),
    };
  }
  return factory[m];
}
const listeners = new Set<() => void>();

/**
 * Ce que le dernier preset du MM-BASS a laisse, charge ou garde (2026-10-09, la revue : deux a six presets par
 * style, le premier au nom du style ; l'en-tete disait DARK DISCO quand NIGHT DRIVE jouait, et rien ne nommait le
 * preset une fois le mode presets ferme) : son nom, sa ligne et ses potards. Tant que rien n'a bouge, l'ecran le
 * nomme (presets.current).
 */
let bassMark: { id: string; name: string; steps: readonly BassStep[]; params: Record<string, number> } | null = null;

function markBass(p: Preset): void {
  bassMark = { id: p.id, name: labelOf(p), steps: bassState.get().steps, params: { ...bassParams.get() } };
}

/** Le libelle d'un preset (2026-10-27) : MIKA/DEEP KICK, USER/HNGRY PNCK (d'avant les noms, tant qu'aucun utilisateur n'est choisi), ACID (d'usine). */
function labelOf(p: Preset): string {
  return presetLabel(p, userTag);
}

/**
 * Les presets a toi sans utilisateur (d'avant les noms) prennent u (setUser) : leur libelle ne change plus avec celui du
 * navigateur ; leurs donnees ne bougent pas. Le navigateur refuse l'ecriture : ils l'ont pour la visite.
 */
function adoptLegacy(u: string): void {
  refresh();
  let changed = false;
  const next = none();
  for (const m of MACHINES) {
    next[m] = all[m].map((p) => {
      if (p.factory || userOk(p.user)) return p;
      changed = true;
      return { ...p, user: u };
    });
  }
  if (!changed) return;
  all = next;
  if (corrupt === null) put(KEY, JSON.stringify(all));
}

/* ---------------- le moteur MONARK : les sons d'avant (2026-10-09) ---------------- */

/** Le temps des messages de la migration et d'un preset en 303. */
const NOTICE_MS = 3000;
const SAVED_303 = 'SAVED IN 303 MODE';
/** Ce que dit l'ecran du preset charge (un preset en 303), jusqu'a quand. */
let bassNote: { text: string; until: number } | null = null;
/** Ce que l'ecran dira au premier coup d'oeil sur le MM-BASS (la migration faite avant qu'on le regarde). */
let bassNotice: string | null = null;
/** Ce que garde le son d'avant quand il passe a MM CLASSIC : le niveau, les envois et les reglages des effets. */
const KEEP_ON_CLASSIC: ReadonlySet<BassKnobId> = new Set<BassKnobId>(['volume', 'delay', 'reverb', 'dtime', 'dfb', 'rsize', 'rtone']);

/**
 * Le son retenu d'avant le moteur MONARK (bass/params.ts legacy : un enregistrement sans MODE), au premier reveil
 * (2026-10-09, Mika : "je veux vraiment un son a la MONARK" ; la consigne de Claude du meme jour) :
 * - il est celui d'un preset d'usine d'avant : le son d'aujourd'hui de ce preset (ses reglages du worklet, jamais sa
 *   ligne) s'il n'est plus en 303 ; s'il l'est encore (l'ACID, ou avant que ses presets soient reecrits), rien ne
 *   s'ecrit : l'enregistrement reste d'avant jusqu'au premier potard tourne, et la migration se refera ;
 * - il n'est celui d'aucun preset (un son retouche) : le moteur d'aujourd'hui, MM CLASSIC, en gardant VOLUME, les
 *   envois DELAY et REVERB et les reglages des effets ; la ligne, ses verrous et le generateur ne bougent pas.
 * L'ecran le dit trois secondes au premier coup d'oeil sur le MM-BASS (<NAME>: NEW ENGINE, NEW ENGINE · MM CLASSIC).
 */
export function migrateBass(): string | null {
  const rec = bassParams.legacy();
  if (!rec.legacy) return null;
  if (rec.match) {
    const fac = factoryOf('bass').find((x) => x.name === rec.match);
    const fp = (fac?.data as BassData | undefined)?.params;
    if (fp && fp.fmode === 1) return null;
    // Un preset retire le soir du 2026-10-09 (NIGHT DRIVE, VELVET DISCO...) : le chemin MM CLASSIC ci-dessous
    if (fp) {
      const next: Partial<Record<BassKnobId, number>> = {};
      for (const id of ENGINE_IDS) next[id] = fp[id];
      bassParams.setMany(next);
      bassParams.legacyDone();
      return `${rec.match}: NEW ENGINE`;
    }
  }
  const next: Partial<Record<BassKnobId, number>> = {};
  for (const id of ENGINE_IDS) if (!KEEP_ON_CLASSIC.has(id)) next[id] = bassKnob(id).def;
  bassParams.setMany(next);
  bassParams.legacyDone();
  return 'NEW ENGINE · MM CLASSIC';
}

/**
 * L'ecran du MM-BASS dit la migration au premier coup d'oeil, trois secondes : le MM-BASS regarde (focus), sa machine
 * arrivee (state/bassload.ts) et son ecran dessine pour de bon (bass/rig.ts, presets.bassScreenUp ; la revue du
 * 2026-10-09 : sans lui, le message passait pendant le chargement de la scene), un instant apres (l'arrivee de la
 * camera).
 */
let noticeTimer = 0;
let screenUp = false;
const NOTICE_DELAY_MS = 1200;
function showNotice(): void {
  if (!bassNotice || !screenUp || focus.machine() !== 'bass' || !bassLoad.get() || noticeTimer) return;
  noticeTimer = window.setTimeout(() => {
    noticeTimer = 0;
    if (!bassNotice || focus.machine() !== 'bass') return;
    const text = bassNotice;
    bassNotice = null;
    bassState.say(text, NOTICE_MS);
  }, NOTICE_DELAY_MS);
}

if (typeof window !== 'undefined') {
  bassNotice = migrateBass();
  if (bassNotice) {
    focus.subscribe(showNotice);
    bassLoad.subscribe(showNotice);
    showNotice();
  }
}

/**
 * Ecrit la liste ; 'ok', ou pourquoi le navigateur ne l'a pas prise (avant, l'erreur etait avalee et l'ecran disait
 * SAVED : le preset disparaissait a la visite suivante). Pas prise : la liste vit pour la visite, le preset touche
 * est marque (unsaved, dropped), une ecriture suivante reussie le rattrape.
 */
function commit(next: All, touched: { id: string; gone?: boolean }): 'ok' | StoreFail {
  all = next;
  // Une liste illisible n'est jamais ecrasee sans sa copie
  const bak = corrupt === null ? 'ok' : put(`${KEY}.bad`, corrupt);
  if (bak === 'ok') corrupt = null;
  const res = bak === 'ok' ? put(KEY, JSON.stringify(all)) : bak;
  if (res === 'ok') {
    unsaved.clear();
    dropped.clear();
  } else if (touched.gone) {
    unsaved.delete(touched.id);
    dropped.add(touched.id);
  } else unsaved.add(touched.id);
  listeners.forEach((fn) => fn());
  return res;
}

// Un autre onglet a ecrit la liste : celle-ci suit (sans perdre ce que cette visite n'a pas pu y mettre)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && e.key !== KEY) return;
    refresh();
    listeners.forEach((fn) => fn());
  });
}

/** L'etat de la machine, tel qu'il est (aussi l'instantane de UNDO, 2026-10-11 : state/undo.ts). */
export function capture(m: PresetMachine): VoyData | RytmData | BassData {
  if (m === 'bass') {
    const recipe = bassState.get().recipe;
    // La recette v2 (2026-10-09) : une copie entiere (son echelle et ses memoires de style)
    const len = bassState.get().len;
    return { params: { ...bassParams.get() }, steps: bassState.get().steps.map((x) => ({ ...x })), ...(recipe ? { recipe: JSON.parse(JSON.stringify(recipe)) as BassRecipe } : {}), ...(len !== 16 ? { len } : {}) };
  }
  if (m === 'voy') {
    return { knobs: { ...voyParams.get() }, seq: { ...seq.get(), buf: [...seq.get().buf] }, prog: [...arp.get().prog] };
  }
  const p = pattern.get();
  const v = voiceFx.get();
  return {
    steps: { ...p.steps },
    bpm: p.bpm,
    fx: { ...pattern.fx.get() },
    stretch: mix.stretch,
    voices: Object.fromEntries(Object.entries(v).map(([k, fx]) => [k, { ...fx }])) as Record<Inst, VoiceFx>,
    kit: Object.fromEntries(KIT_IDS.map((id) => [id, kit.value(id)])) as Record<KitId, number>,
    sounds: Object.fromEntries(KIT_FAMILIES.map((f) => [f, kit.sound(f)])) as Record<KitFamily, string>,
    ...(anyLocks(p.locks) ? { locks: p.locks as Locks } : {}),
    machines: { ...kit.get().model },
    samples: Object.fromEntries(KIT_FAMILIES.map((f) => [f, kit.get().sample[f] ?? ''])) as Record<KitFamily, string>,
    layers: Object.fromEntries(KIT_FAMILIES.map((f) => [f, { ...kit.get().layer[f] }])) as Record<KitFamily, Layer>,
    knobs: { ...kit.get().knob },
    // Les scenes (2026-10-27) seulement s'il y en a : un preset, un brouillon, une marque d'avant gardent leur empreinte
    ...(anyScenes(pattern.scenes.get()) ? { scenes: toStored(pattern.scenes.get()) } : {}),
    // Le mute du pattern (V.5.0) de meme : seulement s'il coupe une voix
    ...(p.pmutes.length > 0 ? { pmutes: [...p.pmutes] } : {}),
  };
}

/**
 * Les effets d'un etat du MM-RYTM, tels que la machine les prend : chaque reglage absent a sa valeur de depart (le son
 * d'alors), un COMP d'avant le 2026-10-18 traduit (pattern.ts compLegacy : son seuil, son rapport, MIX 100 %).
 */
function rytmFx(raw: unknown): Fx {
  const fx: Partial<Fx> = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (k in NEUTRAL_FX && typeof v === 'number' && Number.isFinite(v)) fx[k as keyof Fx] = v;
  return { ...NEUTRAL_FX, ...fx, ...compLegacy(raw) };
}

/** Un etat capture (un preset, ou un instantane de UNDO) remis sur la machine. */
export function apply(m: PresetMachine, d: VoyData | RytmData | BassData): void {
  // 2026-10-21 (state/analytics.ts) : un son remis sur la machine n'est pas un sample choisi a la main
  analytics.hush();
  if (m === 'bass') {
    const b = d as BassData;
    // Un reglage absent : sa valeur d'heritage (2026-10-09 ; avant, def : un preset d'avant le moteur MONARK revient en
    // 303 a son son d'alors) ; d'un bloc (un seul message au worklet)
    const next: Partial<Record<BassKnobId, number>> = {};
    for (const k of BASS_KNOBS) {
      const v = b.params?.[k.id];
      next[k.id] = typeof v === 'number' && Number.isFinite(v) ? v : legacyOf(k);
    }
    bassParams.setMany(next);
    const steps = cleanSteps(b.steps);
    // La recette decide STYLE et NOTES (2026-10-09 : params.style et params.density du preset ne comptent pas) ; une
    // recette d'avant (v1, aucune) est adoptee, les pas ne changent pas
    if (steps) bassLine.load(steps, b.recipe ?? null, { lock: -1 });
    // La longueur de la ligne (2026-10-10) : celle du preset, 16 s'il n'en dit rien
    bassState.set({ len: cleanLen(b.len) });
    return;
  }
  if (m === 'voy') {
    const v = d as VoyData;
    // Un preset d'avant un potard (les TWEAKS, 2026-10-04) : ce potard a sa valeur de depart, le son d'alors ;
    // TUNE 2 et FINE d'avant les rangees d'oscillateurs : traduits ; un preset d'avant CHORD (2026-10-05) : BASIC, ses arpeges d'alors ;
    // un oscillateur coupe d'avant le 2026-10-11 (on1, on2 a OFF) : son niveau a 0 (presets, sons mis de cote, UNDO) ;
    // le CHORUS continu d'avant le 2026-10-12 : son mode (OFF, I, II)
    const knobs: Record<string, unknown> = { ...v.knobs, ...migrateKnobs(v.knobs) };
    for (const id of VOY_KNOB_IDS) {
      const x = knobs[id];
      voyParams.set(id, typeof x === 'number' ? x : id === 'chord' ? 0 : voyKnob(id).def);
    }
    seq.restore(v.seq);
    arp.load(v.prog);
    return;
  }
  const r = d as RytmData;
  // Ses verrous, ou aucun (un preset d'avant le 2026-10-08)
  pattern.replace(r.steps, cleanLocks(r.locks) ?? {});
  // Ses scenes, ou aucune (un preset de la V.3, un brouillon d'avant : vides, sans erreur)
  pattern.scenes.replace(cleanScenes(r.scenes) ?? NO_SCENES);
  // Son mute du pattern, ou aucun (un preset d'avant la V.5.0)
  pattern.setPmutes(cleanPmutes(r.pmutes));
  pattern.setBpm(r.bpm);
  // Un reglage d'effet absent du preset (DLY TIME et FB du 2026-10-09, BIT, COMP et les reglages de chaque FX du
  // 2026-10-10) : sa valeur de depart, le son d'alors (2026-10-11 ; avant, il gardait celle du moment : un preset
  // garde avant eux sonnait selon ce qui jouait avant lui, comme les voix avant le 2026-10-08)
  // Un COMP d'avant le 2026-10-18 (un seul potard) : ses reglages d'aujourd'hui, le meme caractere (pattern.ts compLegacy)
  pattern.fx.set(rytmFx(r.fx));
  setStretch(typeof r.stretch === 'number' ? r.stretch : 0);
  for (const [inst, fx] of Object.entries(r.voices ?? {}) as [Inst, VoiceFx][]) {
    // Un preset d'avant les huit voix (2026-10-05) : RS et PC n'existent plus
    if (!INSTRUMENTS.includes(inst) || !fx) continue;
    // Un reglage absent du preset (TUNE, PAN, START sont du 2026-10-08) : sa valeur de depart, le son d'alors
    // (avant, il gardait la valeur du moment : un preset ne sonnait pas pareil selon ce qui jouait avant lui)
    for (const p of VOICE_PARAMS) voiceFx.set(inst, p, typeof fx[p] === 'number' ? fx[p] : VOICE_FX_DEFAULT[p]);
  }
  applyKit(r);
}

/**
 * Le kit d'un preset du MM-RYTM, d'un bloc (un seul recalcul des sons) :
 * - depuis R3 (layers) : les MACHINES, les echantillons, les couches et tous
 *   les potards tels qu'enregistres ;
 * - avant (kit, sounds) : les potards presents (les autres, et ceux de R3, a
 *   leur depart : le son d'alors), et le son de chaque famille comme une
 *   couche seule (un echantillon : la couche SAMPLE avec le TUNE et le DECAY
 *   du kick d'alors, la synthese a 0 ; un modele : la synthese seule) ;
 * - sans kit (avant le 2026-10-04) : rien ne change.
 * Un echantillon parti du dossier : celui du meme numero, sinon le premier
 * de la famille (resolveSample) ; aucun : la synthese joue.
 */
function applyKit(r: RytmData): void {
  if (!r.kit && !r.layers) return;
  const cur = kit.get();
  const next = kitDefaultCopy();
  next.model = { ...cur.model };
  const knobs = (r.knobs ?? r.kit ?? {}) as Record<string, unknown>;
  for (const n of KIT_KNOBS) {
    const v = knobs[n];
    next.knob[n] = typeof v === 'number' && Number.isFinite(v) ? cleanKnob(n, v) : next.knob[n];
  }
  // Un preset d'avant le 2026-10-18 (hh pour les deux charleys, tom pour les deux toms, rs) : ce qu'une ancienne
  // famille avait va a ses voix d'aujourd'hui (audio/kit.ts foldFamilies), le meme son
  const machines = foldFamilies<string>(r.machines);
  const samples = foldFamilies<string>(r.samples);
  const layers = foldFamilies<Partial<Layer>>(r.layers);
  const sounds = foldFamilies<string>(r.sounds);
  const kitFam = foldFamilies<number>(r.kit);
  for (const f of KIT_FAMILIES) {
    if (r.layers) {
      const m = machines[f];
      if (m === '909' || m === '808' || m === 'mm') next.model[f] = m as KitModel;
      const l = cleanLayer(layers[f]);
      const want = samples[f];
      const key = resolveSample(f, want);
      if (key) next.sample[f] = key;
      else delete next.sample[f];
      if (!key && want && l.syn <= 0) l.syn = 1;
      next.layer[f] = l;
      continue;
    }
    // Un preset d'avant R3 : le son de la famille, par son nom ou sur trois crans ; rien : celui du moment
    const snd = sounds[f];
    const v = kitFam[f];
    if (typeof snd !== 'string' && typeof v !== 'number') {
      next.model[f] = cur.model[f];
      if (cur.sample[f]) next.sample[f] = cur.sample[f];
      else delete next.sample[f];
      next.layer[f] = { ...cur.layer[f] };
      continue;
    }
    const sound = typeof snd === 'string' ? snd : modelAt(v as number);
    const key = sound === '909' || sound === '808' || sound === 'mm' ? undefined : resolveSample(f, sound);
    if (key) {
      next.sample[f] = key;
      next.layer[f] = {
        ...LAYER_DEFAULT,
        syn: 0,
        tune: f === 'bd' ? sampleTuneSt(next.knob.tune) / LAYER_TUNE_ST : 0,
        len: f === 'bd' ? lenOfDecay(next.knob.decay) : 1,
      };
    } else {
      if (sound === '909' || sound === '808' || sound === 'mm') next.model[f] = sound;
      delete next.sample[f];
      next.layer[f] = { ...LAYER_DEFAULT };
    }
  }
  kit.replace(next);
}

/* ---------------- YOUR SOUND : le son du moment, jamais ecrase sans copie (2026-10-11) ---------------- */

/** Un son mis de cote : l'etat entier de la machine (capture), quand. */
export interface Draft {
  id: string;
  at: number;
  data: Preset['data'];
}

/**
 * L'empreinte du dernier etat connu (un preset charge ou garde, un son mis de cote) : full pour cette visite, kept sans
 * ce qu'une visite ne retrouve pas (les reglages des voix du MM-RYTM, audio/voicefx.ts, son STRETCH, et la progression
 * du MM-ARP ne sont pas gardes par le navigateur : apres un rechargement, leur absence n'est pas un son nouveau).
 */
interface Mark {
  full: string;
  kept: string;
  visit: string;
}

/** Cette visite (une empreinte full d'une autre visite ne vaut plus). */
const VISIT = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
// Les voix et STRETCH du MM-RYTM sont gardes depuis le 2026-10-11 (audio/voicefx.ts, audio/drums.ts)
const LOST_ON_RELOAD: Readonly<Record<PresetMachine, readonly string[]>> = { mm808: [], voy: ['prog'], bass: [] };

/** Une valeur dans une forme stable : les nombres au millieme (les magasins arrondissent ce qu'ils gardent), les cles triees. */
function canon(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 1000) / 1000;
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) if (o[k] !== undefined) out[k] = canon(o[k]);
    return out;
  }
  return v;
}

/**
 * Les potards d'un etat du MM-ARP ramenes a aujourd'hui (params.ts foldLegacyKnobs : les ON d'avant le 2026-10-11
 * plies dans leur niveau, le CHORUS continu d'avant le 2026-10-12 a son mode) : un preset, un son mis de cote, une
 * empreinte garde avant eux est le meme son qu'apres sa migration.
 */
function voyNow(m: PresetMachine, o: Record<string, unknown>): Record<string, unknown> {
  if (m === 'mm808') return rytmNow(o);
  if (m !== 'voy' || !o.knobs || typeof o.knobs !== 'object') return o;
  return { ...o, knobs: foldLegacyKnobs(o.knobs as Record<string, unknown>) };
}

/** Les enregistrements par famille d'un etat du MM-RYTM, et ce qu'une famille absente vaut dans une capture d'aujourd'hui. */
const RYTM_FAMILY_RECORDS: readonly (readonly [string, unknown])[] = [
  ['sounds', 'mm'],
  ['machines', 'mm'],
  ['samples', ''],
  ['layers', LAYER_DEFAULT],
];

/**
 * Un etat du MM-RYTM d'avant le 2026-10-18 (hh pour les deux charleys, tom pour les deux toms, rs) ramene a
 * aujourd'hui (audio/kit.ts foldFamilies ; une famille que l'ancien etat n'avait pas, cy, a son depart) : un preset,
 * un son mis de cote, une empreinte garde avant est le meme son qu'apres sa traduction (sinon le premier chargement
 * mettait de cote un "nouveau" son qui n'etait que l'ancien). kit (les crans de la plaque) ne garde que ses onze
 * cases : hh y devient ch.
 */
function rytmNow(o: Record<string, unknown>): Record<string, unknown> {
  let out = o;
  // Les effets lus comme apply() les pose (2026-10-18) : les absents a leur depart, un COMP d'avant traduit ; sinon un
  // preset garde avant le COMP refait differait de sa propre capture au premier chargement
  if (o.fx && typeof o.fx === 'object') out = { ...out, fx: rytmFx(o.fx) };
  for (const [k, def] of RYTM_FAMILY_RECORDS) {
    const rec = o[k];
    if (!rec || typeof rec !== 'object') continue;
    const folded: Record<string, unknown> = foldFamilies<unknown>(rec);
    for (const f of KIT_FAMILIES) if (folded[f] === undefined) folded[f] = def;
    out = { ...out, [k]: folded };
  }
  const kitRec = o.kit;
  if (kitRec && typeof kitRec === 'object') {
    // Seulement les potards (revue du 2026-10-18) : le cran du son d'une famille (soundIndex / nombre de crans) bouge
    // des qu'un sample est ajoute ou retire, a son egal ; le son lui-meme est deja dans sounds, machines, samples, layers
    const x = kitRec as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const id of KIT_IDS) {
      if ((KIT_FAMILIES as readonly string[]).includes(id)) continue;
      if (x[id] !== undefined) next[id] = x[id];
    }
    out = { ...out, kit: next };
  }
  // Les verrous lus comme aujourd'hui (hh:off devient ch:off, comme les relit le motif) : sinon un preset d'avant
  // differait de sa propre capture au premier chargement
  if (o.locks !== undefined) {
    const l = cleanLocks(o.locks);
    const { locks: _old, ...rest } = out;
    out = l ? { ...rest, locks: l } : rest;
  }
  // Les scenes lues comme le motif les relit (2026-10-27) : vides, elles partent
  if (o.scenes !== undefined) {
    const sc = cleanScenes(o.scenes);
    const st = sc ? toStored(sc) : undefined;
    const { scenes: _old, ...rest } = out;
    out = st ? { ...rest, scenes: st } : rest;
  }
  // Le mute du pattern lu comme le motif le relit (V.5.0) : vide, il part
  if (o.pmutes !== undefined) {
    const pm = cleanPmutes(o.pmutes);
    const { pmutes: _old, ...rest } = out;
    out = pm.length > 0 ? { ...rest, pmutes: pm } : rest;
  }
  return out;
}

/**
 * L'empreinte d'un etat, sans skip au premier niveau : l'ordre des cles n'y compte pas (un magasin relu du navigateur
 * les range autrement : le meme son, une autre empreinte, un son mis de cote pour rien a chaque visite).
 */
function sig(m: PresetMachine, d: Preset['data'], skip: readonly string[] = []): string {
  const o: Record<string, unknown> = { ...(d as unknown as Record<string, unknown>) };
  for (const k of skip) delete o[k];
  // Le tempo (2026-10-27, revue SEAM-1 a SEAM-3) : aucun pendant le SYNC du MIXER, au BPM entier sinon (presetBpm.ts)
  return JSON.stringify(canon(voyNow(m, m === 'mm808' ? bpmForSig(o, tempoSync.get() !== null, clampBpm) : o)));
}

/** Une empreinte gardee (une marque, avant le 2026-10-11 : ses ON) ramenee a celle d'aujourd'hui ; illisible : telle quelle. */
function sigNow(m: PresetMachine, kept: string): string {
  if (m !== 'voy' && m !== 'mm808') return kept;
  try {
    const o = JSON.parse(kept) as unknown;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return kept;
    return JSON.stringify(canon(voyNow(m, o as Record<string, unknown>)));
  } catch {
    return kept;
  }
}

/** Une chaine de patterns en lecture (MM-RYTM) : les pas changent a chaque mesure, ce n'est pas un son nouveau. */
const chaining = (m: PresetMachine): boolean => m === 'mm808' && patterns.get().chain.length > 1;
const skipOf = (m: PresetMachine, kept: boolean): string[] => [...(kept ? LOST_ON_RELOAD[m] : []), ...(chaining(m) ? ['steps', 'locks', 'scenes', 'pmutes'] : [])];
const markOf = (m: PresetMachine, d: Preset['data']): Mark => ({ full: sig(m, d, skipOf(m, false)), kept: sig(m, d, skipOf(m, true)), visit: VISIT });

const okDraft = (m: PresetMachine, d: unknown): boolean => {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  if (m === 'mm808') return !!o.steps && typeof o.steps === 'object' && !!o.voices && typeof o.voices === 'object' && !!o.fx && typeof o.fx === 'object' && typeof o.bpm === 'number';
  if (m === 'voy') return !!o.knobs && typeof o.knobs === 'object' && !!o.seq && typeof o.seq === 'object' && Array.isArray(o.prog);
  return !!o.params && typeof o.params === 'object' && Array.isArray(o.steps);
};

let drafts: Record<PresetMachine, Draft[]> = { voy: [], mm808: [], bass: [] };
let marks: Partial<Record<PresetMachine, Mark>> = {};
/**
 * Le preset charge ou garde de chaque machine, par son id (2026-10-27) : l'ecran le nomme (loaded), une etoile s'il a
 * bouge ; SAVE propose de l'ecraser. Garde avec les sons mis de cote (une autre visite le retrouve) ; absent : aucun.
 */
let cur: Partial<Record<PresetMachine, string>> = {};

if (typeof window !== 'undefined') {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? 'null') as { drafts?: Partial<Record<PresetMachine, unknown>>; marks?: Partial<Record<PresetMachine, unknown>>; cur?: Partial<Record<PresetMachine, unknown>> } | null;
    for (const m of MACHINES) {
      const c = raw?.cur?.[m];
      if (typeof c === 'string' && c) cur[m] = c;
      const xs = raw?.drafts?.[m];
      if (Array.isArray(xs)) drafts[m] = (xs as Partial<Draft>[]).filter((x): x is Draft => !!x && typeof x.id === 'string' && typeof x.at === 'number' && okDraft(m, x.data)).slice(0, DRAFTS);
      const k = raw?.marks?.[m] as Partial<Mark> | undefined;
      // Une marque gardee avant le 2026-10-11 (les ON du MM-ARP) : ramenee a l'empreinte d'aujourd'hui
      if (k && typeof k.full === 'string' && typeof k.kept === 'string' && typeof k.visit === 'string') marks[m] = { full: sigNow(m, k.full), kept: sigNow(m, k.kept), visit: k.visit };
    }
  } catch {
    drafts = { voy: [], mm808: [], bass: [] };
    marks = {};
    cur = {};
  }
}

/** Garde les sons mis de cote (et le preset charge de chaque machine, 2026-10-27) ; plein ou refuse : ils vivent pour la visite. */
function keepDrafts(): void {
  put(DRAFT_KEY, JSON.stringify({ v: 1, drafts, marks, cur }));
  listeners.forEach((fn) => fn());
}

/** Le preset charge ou garde de la machine devient id (null : aucun, un son qui n'est pas un preset). */
function setCur(m: PresetMachine, id: string | null): void {
  const next = { ...cur };
  if (id) next[m] = id;
  else delete next[m];
  cur = next;
}

/** Un preset a toi ou d'usine, par son id. */
const findPreset = (m: PresetMachine, id: string | undefined): Preset | null => (id ? (all[m].find((x) => x.id === id) ?? factoryOf(m).find((x) => x.id === id) ?? null) : null);

/** Le preset charge et ce qu'on en voit : son id, son libelle (MIKA/DEEP KICK), a toi ou d'usine, retouche ou non. */
export interface Loaded {
  id: string;
  label: string;
  factory: boolean;
  edited: boolean;
}

/** Ce que SAVE, OVERWRITE et un son mis de cote gardent (2026-10-27, revue SEAM-4) : l'etat au BPM entier (presetBpm.ts). */
const captureKept = (m: PresetMachine): Preset['data'] => (m === 'mm808' ? bpmToKeep(capture(m) as RytmData, clampBpm) : capture(m));

/** Le son de la machine n'est-il garde nulle part (ni le dernier preset charge ou garde, ni un son mis de cote) ? */
function unsavedNow(m: PresetMachine, d: Preset['data'] = capture(m)): boolean {
  const k = marks[m];
  const moved = !k || (k.visit === VISIT ? sig(m, d, skipOf(m, false)) !== k.full : sig(m, d, skipOf(m, true)) !== k.kept);
  if (!moved) return false;
  // Revenu tel quel a un son deja garde (un UNDO, 2026-10-11) : un de tes presets, un d'usine ou un son mis de cote
  const skip = skipOf(m, false);
  const s = sig(m, d, skip);
  return ![...all[m], ...factoryOf(m), ...drafts[m]].some((x) => sig(m, x.data, skip) === s);
}

/**
 * Le son du moment, s'il n'est garde nulle part, passe en tete des sons mis de cote (le meme deja la : il remonte) ;
 * les trois plus recents restent, jamais pin (celui qu'on va recharger). Rend true s'il a ete mis de cote.
 */
function setAside(m: PresetMachine, pin: string | null = null): boolean {
  const data = captureKept(m);
  if (!unsavedNow(m, data)) return false;
  const s = sig(m, data);
  const same = drafts[m].find((x) => sig(m, x.data) === s);
  let list = [{ id: same?.id ?? `draft-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, at: Date.now(), data }, ...drafts[m].filter((x) => x !== same)];
  while (list.length > DRAFTS) {
    const i = list.map((x) => x.id !== pin).lastIndexOf(true);
    if (i < 0) break;
    list = list.filter((_, j) => j !== i);
  }
  drafts = { ...drafts, [m]: list };
  marks = { ...marks, [m]: markOf(m, data) };
  return true;
}

/** Ce qui joue est maintenant connu (un preset charge ou garde, un son recharge). */
function settle(m: PresetMachine, d: Preset['data'] = capture(m)): void {
  marks = { ...marks, [m]: markOf(m, d) };
}

/** Le resultat d'un SAVE : kept, le navigateur l'a pris ; sinon pourquoi (max : 99 presets, rien n'est garde). */
export type SaveResult = { preset: Preset; kept: true } | { preset: Preset; kept: false; why: StoreFail } | { preset: null; kept: false; why: 'max' };

export const presets = {
  get: (): All => all,
  of: (m: PresetMachine): readonly Preset[] => all[m],
  /** Ceux de Mika (les plus recents d'abord), puis ceux d'usine : la liste du mode presets. */
  list: (m: PresetMachine): readonly Preset[] => [...all[m], ...factoryOf(m)],
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /**
   * SAVE : l'etat de la machine, un nouveau preset sous ce nom (2026-10-27 : choisi, aux regles ; avant, un nom au
   * hasard), en tete de la liste ; il devient le preset charge. kept false : le navigateur ne l'a pas pris (plein ou
   * refuse : le preset vit pour la visite, l'ecran le dit) ; max : 99 presets deja, rien ne change (avant, le plus
   * ancien partait sans rien dire).
   */
  save(m: PresetMachine, named: PresetNaming): SaveResult {
    refresh();
    if (all[m].length >= MAX) return { preset: null, kept: false, why: 'max' };
    const data = captureKept(m);
    // Jamais deux fois le meme instant (deux SAVE dans la meme milliseconde : l'ordre reste celui des gestes)
    const at = Math.max(Date.now(), (all[m][0]?.at ?? 0) + 1);
    const p: Preset = { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, name: named.name, user: named.user, at, data };
    if (m === 'bass') markBass(p);
    const res = commit({ ...all, [m]: [p, ...all[m]] }, { id: p.id });
    setCur(m, p.id);
    // Ce son est garde : il n'est plus un son mis de cote. Le navigateur ne l'a pas pris : il reste un son a mettre de
    // cote (le preset de la visite partira au rechargement)
    if (res === 'ok') {
      settle(m, data);
      const s = sig(m, data);
      drafts = { ...drafts, [m]: drafts[m].filter((x) => sig(m, x.data) !== s) };
    }
    keepDrafts();
    return res === 'ok' ? { preset: p, kept: true } : { preset: p, kept: false, why: res };
  },
  /**
   * OVERWRITE (2026-10-27) : le son du moment remplace celui d'un preset a toi ; il garde son id, sa place, son nom et
   * son utilisateur, et devient le preset charge. null : il n'existe plus (un autre onglet l'a efface) ; sinon 'ok' ou
   * pourquoi le navigateur ne l'a pas pris (il vaut pour la visite).
   */
  overwrite(m: PresetMachine, id: string): { preset: Preset; res: 'ok' | StoreFail } | null {
    refresh();
    const old = all[m].find((p) => p.id === id);
    if (!old) return null;
    const data = captureKept(m);
    const p: Preset = { ...old, data };
    if (m === 'bass') markBass(p);
    const res = commit({ ...all, [m]: all[m].map((x) => (x.id === id ? p : x)) }, { id });
    setCur(m, id);
    if (res === 'ok') {
      settle(m, data);
      const s = sig(m, data);
      drafts = { ...drafts, [m]: drafts[m].filter((x) => sig(m, x.data) !== s) };
    }
    keepDrafts();
    return { preset: p, res };
  },
  /** Le preset vit-il seulement pour la visite (le navigateur ne l'a pas pris) ? */
  unsaved: (id: string): boolean => unsaved.has(id),
  /** Les sons mis de cote de la machine, le plus recent d'abord (YOUR SOUND). */
  drafts: (m: PresetMachine): readonly Draft[] => drafts[m],
  /**
   * Ce qui joue, s'il est tel quel un son mis de cote ou un de tes presets : son id, null sinon (apres un rechargement,
   * le mode presets rouvre sur lui, pas sur le premier preset de la liste qui ne joue pas).
   */
  playing(m: PresetMachine): string | null {
    const skip = LOST_ON_RELOAD[m];
    const s = sig(m, capture(m), skip);
    return drafts[m].find((x) => sig(m, x.data, skip) === s)?.id ?? all[m].find((p) => sig(m, p.data, skip) === s)?.id ?? null;
  },
  /** Le son du moment n'est garde nulle part : il est mis de cote (ouvrir le mode presets) ; true s'il l'a ete. */
  setAside(m: PresetMachine): boolean {
    const did = setAside(m);
    if (did) keepDrafts();
    return did;
  },
  /** Recharge un son mis de cote ; celui du moment, s'il n'est garde nulle part, est mis de cote d'abord. */
  restore(m: PresetMachine, id: string): Draft | null {
    const d = drafts[m].find((x) => x.id === id);
    if (!d) return null;
    setAside(m, id);
    apply(m, d.data);
    if (m === 'bass') {
      bassMark = null;
      bassNote = null;
    }
    settle(m);
    // Un son mis de cote n'est pas un preset : l'ecran ne nomme plus rien (2026-10-27)
    setCur(m, null);
    keepDrafts();
    return d;
  },
  /** Oublie un son mis de cote (DEL sur sa ligne, 2026-10-27) ; false s'il n'y est plus. */
  dropDraft(m: PresetMachine, id: string): boolean {
    if (!drafts[m].some((x) => x.id === id)) return false;
    drafts = { ...drafts, [m]: drafts[m].filter((x) => x.id !== id) };
    keepDrafts();
    return true;
  },
  /** Recharge un preset ; false s'il n'existe plus. Le son du moment, s'il n'est garde nulle part, est mis de cote. */
  load(m: PresetMachine, id: string): Preset | null {
    const p = all[m].find((x) => x.id === id) ?? factoryOf(m).find((x) => x.id === id);
    if (!p) return null;
    setAside(m);
    apply(m, p.data);
    settle(m);
    setCur(m, p.id);
    keepDrafts();
    // 2026-10-21 (audit SEO IMP4) : quel preset sert ; le nom des presets d'usine seulement (ceux de Mika ont un nom au hasard)
    track('preset_load', { machine: m === 'mm808' ? 'rytm' : m === 'voy' ? 'arp' : 'bass', factory: !!p.factory, preset: p.factory ? p.name : 'user' });
    // Une ligne illisible ne s'est pas chargee : la ligne d'avant joue, ce n'est pas ce preset
    if (m === 'bass') {
      if (cleanSteps((p.data as BassData).steps)) markBass(p);
      else bassMark = null;
      // Un preset garde avant le moteur MONARK (sans MODE) : il sonne en 303, l'ecran le dit (2026-10-09)
      const old = !p.factory && typeof (p.data as BassData).params?.fmode !== 'number';
      bassNote = old ? { text: SAVED_303, until: performance.now() + NOTICE_MS } : null;
      if (old) bassState.say(SAVED_303, NOTICE_MS);
    }
    return p;
  },
  /** L'ecran du MM-BASS est dessine (bass/rig.ts) : le message de la migration peut passer (2026-10-09). */
  bassScreenUp(): void {
    if (screenUp) return;
    screenUp = true;
    showNotice();
  },
  /** Ce que l'ecran du MM-BASS dit du preset charge (SAVED IN 303 MODE), le temps de le lire ; '' : rien. */
  bassNote(now: number = performance.now()): string {
    return bassNote && now < bassNote.until ? bassNote.text : '';
  },
  /** Efface un preset ; 'ok', ou pourquoi le navigateur ne l'a pas pris (il est efface pour la visite). */
  remove(m: PresetMachine, id: string): 'ok' | StoreFail {
    refresh();
    if (m === 'bass' && bassMark?.id === id) bassMark = null;
    // Le preset efface est ce qui joue : ce son n'est plus garde nulle part, le prochain preset charge le mettra de cote
    const gone = all[m].find((p) => p.id === id);
    if (gone && sig(m, gone.data) === sig(m, capture(m))) {
      const next = { ...marks };
      delete next[m];
      marks = next;
      keepDrafts();
    }
    // Le preset charge s'en va : l'ecran ne le nomme plus (2026-10-27)
    if (cur[m] === id) {
      setCur(m, null);
      keepDrafts();
    }
    return commit({ ...all, [m]: all[m].filter((p) => p.id !== id) }, { id, gone: true });
  },
  /**
   * RENAME (2026-10-27 : le nom et l'utilisateur choisis, aux regles ; avant, un autre nom au hasard) ; 'ok', ou
   * pourquoi le navigateur ne l'a pas pris. Un preset d'usine ne se renomme pas (rien ne change).
   */
  rename(m: PresetMachine, id: string, named: PresetNaming): 'ok' | StoreFail {
    refresh();
    const next = all[m].map((p) => (p.id === id ? { ...p, name: named.name, user: named.user } : p));
    const p = next.find((x) => x.id === id);
    if (m === 'bass' && p && bassMark?.id === id) bassMark = { ...bassMark, name: labelOf(p) };
    return commit({ ...all, [m]: next }, { id });
  },
  /** Le libelle d'un preset : MIKA/DEEP KICK, ACID (state/presetName.ts presetLabel). */
  label: (p: Preset): string => labelOf(p),
  /** L'utilisateur de ce navigateur (4 caracteres), null tant qu'il n'est pas choisi (2026-10-27). */
  user: (): string | null => userTag,
  /** Retient l'utilisateur de ce navigateur (le dialogue de SAVE et de RENAME) ; un utilisateur hors regles ne change rien. */
  setUser(u: string): void {
    const v = cleanUser(u);
    if (!userOk(v) || v === userTag) return;
    // Les presets d'avant les noms recoivent un utilisateur, une fois (2026-10-27, la revue : sans lui, ils suivaient celui
    // du navigateur et un SAVE sous un autre USER les renommait tous) : le premier choisi les adopte, un autre ensuite
    // laisse les autres sous l'ancien
    adoptLegacy(userTag ?? v);
    userTag = v;
    try {
      window.localStorage.setItem(USER_KEY, v);
    } catch {
      /* plein ou bloque : retenu pour la visite */
    }
    listeners.forEach((fn) => fn());
  },
  /** L'id du preset charge ou garde de la machine (2026-10-27), null : aucun (ou il n'existe plus). */
  loadedId: (m: PresetMachine): string | null => (findPreset(m, cur[m]) ? (cur[m] ?? null) : null),
  /**
   * Le preset charge ou garde et ce qu'on en voit (2026-10-27, l'ecran de la machine le nomme) : son libelle, a toi ou
   * d'usine, et edited si le son s'en est ecarte (un pas, un potard ; une chaine en lecture ne compte pas, ni ce qu'un
   * rechargement ne garde pas, ni le tempo pendant le SYNC du MIXER) ; null : aucun preset charge.
   */
  loaded(m: PresetMachine): Loaded | null {
    const p = findPreset(m, cur[m]);
    if (!p) return null;
    const skip = skipOf(m, true);
    const now = sig(m, capture(m), skip);
    const edited = now !== sig(m, p.data, skip);
    // UNDO d'un LOAD rend lui-meme le preset charge d'avant (recall, 2026-10-27, revue SEAM-1) : plus rien a deviner par
    // egalite avec un son mis de cote (le tempo suivi qui bougeait laissait le nom du preset defait, OVERWRITE l'ecrasait)
    return { id: p.id, label: labelOf(p), factory: !!p.factory, edited };
  },
  /** Le son n'est plus celui d'un preset (un beat partage pose par-dessus, 2026-10-27) : l'ecran ne nomme plus rien. */
  detach(m: PresetMachine): void {
    if (!cur[m]) return;
    setCur(m, null);
    keepDrafts();
  },
  /**
   * UNDO et REDO d'un LOAD (2026-10-27, revue SEAM-1) : le preset charge redevient celui que l'etape a retenu (null :
   * aucun), au lieu d'etre devine par egalite (le tempo suivi qui bouge entre-temps laissait le nom du preset defait, et
   * OVERWRITE l'ecrasait) ; un preset qui n'existe plus : aucun.
   */
  recall(m: PresetMachine, id: string | null): void {
    const next = id && findPreset(m, id) ? id : null;
    if ((cur[m] ?? null) === next) return;
    setCur(m, next);
    keepDrafts();
  },
  /**
   * Le nom du preset qui sonne tel quel : le dernier charge ou garde, rien n'a bouge depuis (ni un pas, ni un
   * potard) ; null sinon. Le MM-BASS seulement (2026-10-09, son en-tete).
   */
  current(m: PresetMachine): string | null {
    if (m !== 'bass' || !bassMark || bassState.get().steps !== bassMark.steps) return null;
    const v = bassParams.get() as Record<string, number>;
    for (const k of BASS_KNOBS) if (v[k.id] !== bassMark.params[k.id]) return null;
    return bassMark.name;
  },
};
