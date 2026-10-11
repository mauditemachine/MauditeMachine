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
 * Gardes dans ce navigateur (localStorage), 60 par machine au plus. Les
 * presets d'usine (state/factory.ts, des styles de musique electronique)
 * suivent ceux de Mika ; ils se chargent, ne se renomment ni ne s'effacent.
 */

import { INSTRUMENTS, pattern, type Fx, type Steps } from '../audio/pattern';
import { mix, setStretch } from '../audio/drums';
import { anyLocks, cleanLocks, type Locks } from '../audio/locks';
import { VOICE_FX_DEFAULT, voiceFx, VOICE_PARAMS, type VoiceFx } from '../audio/voicefx';
import { KIT_FAMILIES, KIT_IDS, KIT_KNOBS, LAYER_DEFAULT, LAYER_TUNE_ST, cleanKnob, cleanLayer, kit, kitDefaultCopy, modelAt, resolveSample, type KitFamily, type KitId, type KitModel, type Layer } from '../audio/kit';
import { lenOfDecay, sampleTuneSt } from '../audio/sampledsp';
import type { Inst } from '../theme';
import { arp } from '../voyager/arp';
import { VOY_KNOB_IDS, migrateKnobs, voyKnob, voyParams, type VoyValues } from '../voyager/params';
import { SEQ_MAX, seq, type SeqState } from '../voyager/seq';
import { BASS_KNOBS, ENGINE_IDS, bassKnob, bassParams, legacyOf, type BassKnobId } from '../bass/params';
import { bassLoad } from './bassload';
import { focus } from './focus';
import { bassLine } from '../bass/line';
import { bassState, cleanLen, cleanSteps, type BassRecipe, type BassStep } from '../bass/state';
import { arpFactory, bassFactory, rytmFactory } from './factory';

export type PresetMachine = 'voy' | 'mm808' | 'bass';

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
}

export interface Preset {
  id: string;
  name: string;
  /** Date.now() a l'enregistrement */
  at: number;
  data: VoyData | RytmData | BassData;
  /** un preset d'usine (state/factory.ts) : ni renomme ni efface */
  factory?: boolean;
}

const KEY = 'mm.v4.presets.1';
const MAX = 60;

/* ---------------- les noms ---------------- */

const ADJ = [
  'Sweaty', 'Grumpy', 'Velvet', 'Sneaky', 'Cosmic', 'Feral', 'Wobbly', 'Haunted', 'Greasy', 'Spicy',
  'Lazy', 'Funky', 'Chunky', 'Sleepy', 'Rusty', 'Fuzzy', 'Moody', 'Cursed', 'Glitchy', 'Shiny',
  'Rubber', 'Neon', 'Electric', 'Nervous', 'Polite', 'Angry', 'Frozen', 'Crispy', 'Soggy', 'Majestic',
  'Suspicious', 'Tiny', 'Enormous', 'Dizzy', 'Sticky', 'Lunar', 'Toxic', 'Holy', 'Wonky', 'Buttery',
  'Smug', 'Bouncy', 'Salty', 'Mystic', 'Analog', 'Dusty', 'Hungry', 'Rogue', 'Turbo', 'Gentle',
  'Wild', 'Maudite', 'Disco', 'Acid', 'Lucky', 'Jazzy', 'Clumsy', 'Fancy', 'Midnight', 'Stoned',
];
const NOUN = [
  'Goblin', 'Waffle', 'Pancake', 'Raccoon', 'Moose', 'Poutine', 'Lemur', 'Toaster', 'Wizard', 'Pickle',
  'Noodle', 'Badger', 'Disco', 'Llama', 'Gremlin', 'Potato', 'Walrus', 'Banana', 'Penguin', 'Robot',
  'Cactus', 'Dumpling', 'Hamster', 'Unicorn', 'Squid', 'Taco', 'Platypus', 'Ferret', 'Muffin', 'Beaver',
  'Pigeon', 'Lobster', 'Sloth', 'Oyster', 'Bagel', 'Narwhal', 'Kebab', 'Yeti', 'Mango', 'Otter',
  'Wombat', 'Croissant', 'Gecko', 'Tornado', 'Goose', 'Hippo', 'Meatball', 'Spaghetti', 'Weasel', 'Owl',
  'Machine', 'Bassline', 'Kick', 'Snare', 'Groove', 'Wobble', 'Laser', 'Spaceship', 'Volcano', 'Jellyfish',
];

const pick = (xs: readonly string[]): string => xs[Math.floor(Math.random() * xs.length)];

/** Un nom au hasard : deux mots le plus souvent, un seul une fois sur cinq ; jamais un nom deja pris. */
export function funnyName(taken: ReadonlySet<string> = new Set()): string {
  for (let i = 0; i < 40; i += 1) {
    const one = Math.random() < 0.2;
    // Un seul mot : deux noms soudes (Wafflegoblin, Moosetaco)
    const name = one ? `${pick(NOUN)}${pick(NOUN).toLowerCase()}` : `${pick(ADJ)} ${pick(NOUN)}`;
    if (!taken.has(name)) return name;
  }
  return `${pick(ADJ)} ${pick(NOUN)} ${Math.floor(Math.random() * 90 + 10)}`;
}

/* ---------------- le store ---------------- */

type All = Record<PresetMachine, Preset[]>;

function load(): All {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<All> | null;
    const ok = (xs: unknown): Preset[] => (Array.isArray(xs) ? xs.filter((p) => p && typeof p.name === 'string' && typeof p.id === 'string' && p.data).slice(0, MAX) : []);
    return { voy: ok(raw?.voy), mm808: ok(raw?.mm808), bass: ok(raw?.bass) };
  } catch {
    return { voy: [], mm808: [], bass: [] };
  }
}

let all: All = typeof window === 'undefined' ? { voy: [], mm808: [], bass: [] } : load();

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
  bassMark = { id: p.id, name: p.name, steps: bassState.get().steps, params: { ...bassParams.get() } };
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

function commit(next: All): void {
  all = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* stockage plein ou bloque : la visite garde ses presets */
  }
  listeners.forEach((fn) => fn());
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
  };
}

/** Un etat capture (un preset, ou un instantane de UNDO) remis sur la machine. */
export function apply(m: PresetMachine, d: VoyData | RytmData | BassData): void {
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
    // TUNE 2 et FINE d'avant les rangees d'oscillateurs : traduits ; un preset d'avant CHORD (2026-10-05) : BASIC, ses arpeges d'alors
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
  pattern.setBpm(r.bpm);
  pattern.fx.set(r.fx);
  setStretch(r.stretch);
  for (const [inst, fx] of Object.entries(r.voices) as [Inst, VoiceFx][]) {
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
  for (const f of KIT_FAMILIES) {
    if (r.layers) {
      const m = r.machines?.[f];
      if (m === '909' || m === '808' || m === 'mm') next.model[f] = m as KitModel;
      const l = cleanLayer(r.layers[f]);
      const want = r.samples?.[f];
      const key = resolveSample(f, want);
      if (key) next.sample[f] = key;
      else delete next.sample[f];
      if (!key && want && l.syn <= 0) l.syn = 1;
      next.layer[f] = l;
      continue;
    }
    // Un preset d'avant R3 : le son de la famille, par son nom ou sur trois crans ; rien : celui du moment
    const snd = r.sounds?.[f];
    const v = r.kit?.[f];
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
  /** SAVE : l'etat de la machine sous un nom au hasard ; renvoie le preset. */
  save(m: PresetMachine): Preset {
    const taken = new Set(all[m].map((p) => p.name));
    const p: Preset = { id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, name: funnyName(taken), at: Date.now(), data: capture(m) };
    if (m === 'bass') markBass(p);
    commit({ ...all, [m]: [p, ...all[m]].slice(0, MAX) });
    return p;
  },
  /** Recharge un preset ; false s'il n'existe plus. */
  load(m: PresetMachine, id: string): Preset | null {
    const p = all[m].find((x) => x.id === id) ?? factoryOf(m).find((x) => x.id === id);
    if (!p) return null;
    apply(m, p.data);
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
  remove(m: PresetMachine, id: string): void {
    if (m === 'bass' && bassMark?.id === id) bassMark = null;
    commit({ ...all, [m]: all[m].filter((p) => p.id !== id) });
  },
  /** Un autre nom au hasard (le nom ne plait pas). */
  rename(m: PresetMachine, id: string): void {
    const taken = new Set(all[m].map((p) => p.name));
    const next = all[m].map((p) => (p.id === id ? { ...p, name: funnyName(taken) } : p));
    if (m === 'bass' && bassMark?.id === id) bassMark = { ...bassMark, name: next.find((p) => p.id === id)?.name ?? bassMark.name };
    commit({ ...all, [m]: next });
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
