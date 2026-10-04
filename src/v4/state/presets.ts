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
 *   et le kick, audio/kit.ts, 2026-10-04 ; un preset d'avant ne le touche pas).
 * Gardes dans ce navigateur (localStorage), 60 par machine au plus.
 */

import { pattern, type Fx, type Steps } from '../audio/pattern';
import { mix, setStretch } from '../audio/drums';
import { voiceFx, VOICE_PARAMS, type VoiceFx } from '../audio/voicefx';
import { KIT_IDS, kit, type KitId } from '../audio/kit';
import type { Inst } from '../theme';
import { arp } from '../voyager/arp';
import { VOY_KNOB_IDS, migrateKnobs, voyKnob, voyParams, type VoyValues } from '../voyager/params';
import { seq, type SeqState } from '../voyager/seq';

export type PresetMachine = 'voy' | 'mm808';

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
}

export interface Preset {
  id: string;
  name: string;
  /** Date.now() a l'enregistrement */
  at: number;
  data: VoyData | RytmData;
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
    return { voy: ok(raw?.voy), mm808: ok(raw?.mm808) };
  } catch {
    return { voy: [], mm808: [] };
  }
}

let all: All = typeof window === 'undefined' ? { voy: [], mm808: [] } : load();
const listeners = new Set<() => void>();

function commit(next: All): void {
  all = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* stockage plein ou bloque : la visite garde ses presets */
  }
  listeners.forEach((fn) => fn());
}

/** L'etat de la machine, tel qu'il est. */
function capture(m: PresetMachine): VoyData | RytmData {
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
  };
}

function apply(m: PresetMachine, d: VoyData | RytmData): void {
  if (m === 'voy') {
    const v = d as VoyData;
    // Un preset d'avant un potard (les TWEAKS, 2026-10-04) : ce potard a sa valeur de depart, le son d'alors ;
    // TUNE 2 et FINE d'avant les rangees d'oscillateurs : traduits
    const knobs: Record<string, unknown> = { ...v.knobs, ...migrateKnobs(v.knobs) };
    for (const id of VOY_KNOB_IDS) {
      const x = knobs[id];
      voyParams.set(id, typeof x === 'number' ? x : voyKnob(id).def);
    }
    seq.restore(v.seq);
    arp.load(v.prog);
    return;
  }
  const r = d as RytmData;
  pattern.replace(r.steps);
  pattern.setBpm(r.bpm);
  pattern.fx.set(r.fx);
  setStretch(r.stretch);
  for (const [inst, fx] of Object.entries(r.voices) as [Inst, VoiceFx][]) {
    for (const p of VOICE_PARAMS) if (typeof fx[p] === 'number') voiceFx.set(inst, p, fx[p]);
  }
  if (r.kit) for (const id of KIT_IDS) if (typeof r.kit[id] === 'number') kit.set(id, r.kit[id]);
}

export const presets = {
  get: (): All => all,
  of: (m: PresetMachine): readonly Preset[] => all[m],
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
    commit({ ...all, [m]: [p, ...all[m]].slice(0, MAX) });
    return p;
  },
  /** Recharge un preset ; false s'il n'existe plus. */
  load(m: PresetMachine, id: string): Preset | null {
    const p = all[m].find((x) => x.id === id);
    if (!p) return null;
    apply(m, p.data);
    return p;
  },
  remove(m: PresetMachine, id: string): void {
    commit({ ...all, [m]: all[m].filter((p) => p.id !== id) });
  },
  /** Un autre nom au hasard (le nom ne plait pas). */
  rename(m: PresetMachine, id: string): void {
    const taken = new Set(all[m].map((p) => p.name));
    commit({ ...all, [m]: all[m].map((p) => (p.id === id ? { ...p, name: funnyName(taken) } : p)) });
  },
};
