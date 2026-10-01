/**
 * Boite a rythmes synthetisee (spec 8) : cinq voix Web Audio, aucun
 * fichier. Un seul AudioContext pour la page, cree au premier geste de
 * l'utilisateur (jamais au montage, jamais par un timer) et repris a
 * chaque interaction s'il est suspendu (regle iOS). Graphe (revision 2 :
 * DIST et REVERB, audio/fx.ts ; revision 5 : TONE et STRETCH, inserts a
 * bypass reel, audio/tone.ts et audio/stretch.ts) :
 *
 *   voix -> bus -> [sec + DIST] -> TONE -> STRETCH -> gain (LEVEL)
 *        -> compresseur leger -> analyseur -> master -> destination
 *   LEVEL -> envoi REVERB -> convolueur -> analyseur
 *
 * TONE transpose aussi : chaque coup est programme avec ses frequences
 * multipliees par 2^(demi-tons / 12), exactement 1 a TONE 0.
 *
 * L'analyseur est AVANT le master : avec ?mute=1 le master reste a 0 pour
 * toute la session (LEVEL ne pilote que son propre gain) et le signal
 * reste mesurable sans rien envoyer aux enceintes. SWING, DIST et REVERB
 * vivent dans le store du motif (pattern.fx, persistes avec lui) : ce
 * module les applique au graphe, l'horloge lit SWING a chaque pas.
 */

import { FLAGS } from '../state/flags';
import type { Inst } from '../theme';
import { buildFx, glide, type FxChain, type FxInfo } from './fx';
import { pattern, VEL_GAIN, INSTRUMENTS, STEP_COUNT, velocity } from './pattern';
import { buildStretch, clampStretch, type StretchInfo, type StretchStage } from './stretch';
import { buildTone, pitchFactor, snapTone, type ToneInfo, type ToneStage } from './tone';

type Ctor = typeof AudioContext;

interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  tone: ToneStage;
  stretch: StretchStage;
  level: GainNode;
  comp: DynamicsCompressorNode;
  analyser: AnalyserNode;
  master: GainNode;
  /** DIST et REVERB */
  fx: FxChain;
  /** une seconde de bruit blanc, generee une fois, partagee par SD et CH */
  noise: AudioBuffer;
  /** drive du BD : tanh(2.5 x) sur 1024 points */
  curve: Float32Array;
}

export interface TriggerInfo {
  inst: Inst;
  open: boolean;
  /** instant programme (temps du contexte) */
  when: number;
  /** performance.now() de l'appel (ordre son / animation) */
  at: number;
  state: AudioContextState;
}

/**
 * Une voix programmee : ses sources et tous ses noeuds. L'horloge garde
 * celles qui n'ont pas encore sonne pour les annuler au STOP.
 */
export interface Voice {
  when: number;
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

/** Enveloppes des voix, en secondes (spec 8.2). */
const TAIL = { BD: 0.42, SD: 0.18, SDbody: 0.12, TOM: 0.3, CH: 0.045, CHopen: 0.22, OH: 0.34 } as const;
/** Un charley (ferme ou ouvert) coupe le charley ouvert qui sonne encore, en 8 ms (choke 808). */
const CHOKE_S = 0.008;
/** Les sources s'arretent 50 ms apres la fin de leur enveloppe. */
const STOP_PAD = 0.05;

let ctx: AudioContext | undefined;
let graph: Graph | undefined;
let created = 0;
let triggers = 0;
let last: TriggerInfo | null = null;
/** TONE : -1 a 1, 0 = bypass (revision 5) */
let tone = 0;
/** STRETCH : 0 a 1, 0 = bypass (revision 5) */
let stretch = 0;
let level = 0.8;
/**
 * Etat voulu du contexte : la derniere demande gagne, quel que soit l'ordre
 * dans lequel les promesses de suspend() et resume() se resolvent.
 */
let want: 'running' | 'suspended' = 'running';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);

function getCtor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: Ctor }).webkitAudioContext;
}

/** Options du graphe hors ligne (tests) : valeurs imposees, master force, sans TONE ni STRETCH. */
interface BuildOpts {
  tone?: number;
  stretch?: number;
  drive?: number;
  reverb?: number;
  /** master a 1 quel que soit ?mute=1 (rendu hors ligne : rien ne sort des enceintes) */
  master?: number;
  /** reference : le bus rejoint LEVEL sans aucun stage TONE ni STRETCH */
  bare?: boolean;
}

function build(c: BaseAudioContext, o: BuildOpts = {}): Graph {
  const bus = c.createGain();
  bus.gain.value = 1;
  const lvl = c.createGain();
  lvl.gain.value = level * level;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.15;
  const analyser = c.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  const master = c.createGain();
  // Mute : 0 AVANT tout branchement, jamais d'automation sur ce gain
  master.gain.value = o.master ?? (FLAGS.mute ? 0 : 1);

  // Le bus rejoint TONE par DIST (sec, et mouille si DIST > 0), puis STRETCH
  lvl.connect(comp);
  comp.connect(analyser);
  analyser.connect(master);
  master.connect(c.destination);
  const f = pattern.fx.get();
  let toneSt: ToneStage;
  let stretchSt: StretchStage;
  if (o.bare) {
    toneSt = { input: lvl, set: () => undefined, reset: () => undefined, info: () => ({ value: 0, semitones: 0, hpHz: 0, lpHz: 0, insert: { direct: true, linked: false, dry: 1, wet: 0, unlinks: 0 } }) };
    stretchSt = { input: lvl, set: () => undefined, reset: () => undefined, info: () => ({ value: 0, ratio: 1, worklet: false, created: 0, module: null, insert: { direct: true, linked: false, dry: 1, wet: 0, unlinks: 0 } }), ready: async () => false, stats: async () => null };
  } else {
    stretchSt = buildStretch(c, lvl, o.stretch ?? stretch);
    toneSt = buildTone(c, stretchSt.input, o.tone ?? tone);
  }
  const fx = buildFx(c, { bus, tone: toneSt.input, level: lvl, out: analyser }, o.drive ?? f.drive, o.reverb ?? f.reverb);

  const noise = c.createBuffer(1, Math.round(c.sampleRate), c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;

  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(2.5 * ((i / (curve.length - 1)) * 2 - 1));

  return { ctx: c, bus, tone: toneSt, stretch: stretchSt, level: lvl, comp, analyser, master, fx, noise, curve };
}

/** ?mute=1 vu une fois = master a 0 pour toute la page, meme sur un contexte cree avant. */
function enforceMute(g: Graph): void {
  if (!FLAGS.mute) return;
  const p = g.master.gain;
  if (p.value !== 0) {
    p.cancelScheduledValues(0);
    p.value = 0;
  }
}

/* ---------------- cycle de vie (spec 8.3) ---------------- */

/**
 * Cree le contexte et le graphe. A appeler UNIQUEMENT depuis un
 * gestionnaire de geste (pointerdown, keydown...). Idempotent.
 */
export function ensure(): AudioContext | undefined {
  if (ctx && graph) {
    enforceMute(graph);
    // Apres quiet() (demontage) : la reverbe du store revient, convolueur neuf ;
    // STRETCH aussi (son worklet s'etait arrete)
    graph.fx.setReverb(pattern.fx.get().reverb);
    graph.stretch.set(stretch);
    return ctx;
  }
  const C = getCtor();
  if (!C) return undefined;
  try {
    ctx = new C({ latencyHint: 'interactive' });
  } catch {
    try {
      ctx = new C();
    } catch {
      return undefined;
    }
  }
  created += 1;
  graph = build(ctx);
  return ctx;
}

/**
 * Relance le contexte (iOS : il faut un geste ; sinon le prochain geste
 * reessaie). Appele meme s'il tourne deja : son etat ne change qu'une fois
 * la demande traitee, un suspend() encore en vol le rendormirait sinon
 * (onglet cache puis montre tres vite). Sur un contexte qui tourne, la
 * promesse se resout tout de suite.
 */
export function resume(): void {
  want = 'running';
  if (!ctx || (ctx.state as string) === 'closed') return;
  ctx.resume().catch(() => undefined);
}

/**
 * Demontage de /v4, avant suspend() : la queue de reverbe en cours est
 * jetee (un convolueur gele la rejouerait au retour). Les voix deja
 * parties gardent leur fin (0.47 s au plus), comme en revision 1.
 */
export function quiet(): void {
  graph?.fx.silence();
  // Le tampon de 2 s ne rejouera pas l'ancienne visite : worklet arrete
  graph?.stretch.reset();
}

/** Onglet cache, canvas hors ecran, demontage : le contexte dort, on le garde. */
export function suspend(): void {
  want = 'suspended';
  const c = ctx;
  if (!c || (c.state as string) === 'closed') return;
  c.suspend().then(
    () => {
      // Un resume() arrive pendant la suspension : il gagne
      if (want === 'running') c.resume().catch(() => undefined);
    },
    () => undefined
  );
}

/** Le contexte de la page, ou undefined avant le premier geste (ne le cree jamais). */
export function context(): AudioContext | undefined {
  return ctx;
}

/* ---------------- voix (spec 8.2) ---------------- */

/** Demarre, arrete a la fin de l'enveloppe + 50 ms, puis debranche tout (GC). */
function play(src: AudioScheduledSourceNode, when: number, tail: number, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
  src.start(when);
  src.stop(when + tail + STOP_PAD);
}

function noiseSource(g: Graph): AudioBufferSourceNode {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  return src;
}

/** Depart au hasard dans la seconde de bruit : deux coups ne sont jamais identiques. */
function startNoise(src: AudioBufferSourceNode, when: number, tail: number, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
  const span = (src.buffer?.duration ?? 1) - tail - STOP_PAD - 0.01;
  src.start(when, Math.random() * Math.max(0, span));
  src.stop(when + tail + STOP_PAD);
}

function voiceBD(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1): Voice {
  const c = g.ctx;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 * pf, when);
  osc.frequency.exponentialRampToValueAtTime(48 * pf, when + 0.06);
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, when + TAIL.BD);
  const drive = c.createGain();
  drive.gain.value = 1.4;
  const shaper = c.createWaveShaper();
  shaper.curve = g.curve;
  shaper.oversample = '2x';
  const post = c.createGain();
  post.gain.value = 0.8;
  osc.connect(env);
  env.connect(drive);
  drive.connect(shaper);
  shaper.connect(post);
  post.connect(dest);
  const nodes = [osc, env, drive, shaper, post];
  play(osc, when, TAIL.BD, nodes);
  return { when, srcs: [osc], nodes };
}

function voiceSD(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1): Voice {
  const c = g.ctx;
  const src = noiseSource(g);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 * pf;
  bp.Q.value = 1.2;
  const nEnv = c.createGain();
  nEnv.gain.setValueAtTime(1, when);
  nEnv.gain.exponentialRampToValueAtTime(0.001, when + TAIL.SD);
  const body = c.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(180 * pf, when);
  body.frequency.exponentialRampToValueAtTime(140 * pf, when + 0.06);
  const bEnv = c.createGain();
  bEnv.gain.setValueAtTime(0.6, when);
  bEnv.gain.exponentialRampToValueAtTime(0.001, when + TAIL.SDbody);
  const out = c.createGain();
  out.gain.value = 0.9;
  src.connect(bp);
  bp.connect(nEnv);
  nEnv.connect(out);
  body.connect(bEnv);
  bEnv.connect(out);
  out.connect(dest);
  body.start(when);
  body.stop(when + TAIL.SDbody + STOP_PAD);
  // Le bruit finit en dernier : c'est lui qui debranche toute la voix
  const nodes = [src, bp, nEnv, body, bEnv, out];
  startNoise(src, when, TAIL.SD, nodes);
  return { when, srcs: [src, body], nodes };
}

function voiceTOM(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1): Voice {
  const c = g.ctx;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220 * pf, when);
  osc.frequency.exponentialRampToValueAtTime(110 * pf, when + 0.12);
  const env = c.createGain();
  env.gain.setValueAtTime(1, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + TAIL.TOM);
  osc.connect(env);
  env.connect(dest);
  const nodes = [osc, env];
  play(osc, when, TAIL.TOM, nodes);
  return { when, srcs: [osc], nodes };
}

/** La porte du dernier charley ouvert et la fin de son enveloppe (choke). */
let ohGate: GainNode | null = null;
let ohEnd = 0;

/** Ferme le charley ouvert qui sonne encore a `when` (le suivant le coupe). */
function chokeOH(when: number): void {
  if (!ohGate || ohEnd <= when) return;
  ohGate.gain.setValueAtTime(1, when);
  ohGate.gain.linearRampToValueAtTime(0, when + CHOKE_S);
  ohGate = null;
}

/**
 * Charley ouvert (2026-10-01) : bruit filtre haut (6.8 kHz) et un peu de
 * brillance (crete a 10 kHz), 340 ms. Un charley ferme ou ouvert suivant le
 * coupe (chokeOH) : sur le motif d'arrivee, le "tss" court des contretemps.
 */
function voiceOH(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1): Voice {
  const c = g.ctx;
  chokeOH(when);
  const src = noiseSource(g);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6800 * pf;
  hp.Q.value = 0.7;
  const shine = c.createBiquadFilter();
  shine.type = 'peaking';
  shine.frequency.value = Math.min(10000 * pf, c.sampleRate * 0.45);
  shine.Q.value = 1.2;
  shine.gain.value = 4;
  const env = c.createGain();
  env.gain.setValueAtTime(0.55, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + TAIL.OH);
  const gate = c.createGain();
  gate.gain.value = 1;
  src.connect(hp);
  hp.connect(shine);
  shine.connect(env);
  env.connect(gate);
  gate.connect(dest);
  ohGate = gate;
  ohEnd = when + TAIL.OH;
  const nodes = [src, hp, shine, env, gate];
  startNoise(src, when, TAIL.OH, nodes);
  return { when, srcs: [src], nodes };
}

function voiceCH(g: Graph, when: number, open: boolean, dest: AudioNode = g.bus, pf = 1): Voice {
  const c = g.ctx;
  chokeOH(when);
  const tail = open ? TAIL.CHopen : TAIL.CH;
  const src = noiseSource(g);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000 * pf;
  hp.Q.value = 0.7;
  const env = c.createGain();
  env.gain.setValueAtTime(0.7, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  src.connect(hp);
  hp.connect(env);
  env.connect(dest);
  const nodes = [src, hp, env];
  startNoise(src, when, tail, nodes);
  return { when, srcs: [src], nodes };
}

/** Une voix, frequences multipliees par pf (TONE : exactement 1 a 0). */
function voice(g: Graph, inst: Inst, t: number, open: boolean, dest: AudioNode, pf: number): Voice {
  return inst === 'BD'
    ? voiceBD(g, t, dest, pf)
    : inst === 'SD'
      ? voiceSD(g, t, dest, pf)
      : inst === 'TOM'
        ? voiceTOM(g, t, dest, pf)
        : inst === 'OH'
          ? voiceOH(g, t, dest, pf)
          : voiceCH(g, t, open, dest, pf);
}

/**
 * Joue un coup a `when` (temps du contexte ; maintenant par defaut). Ne cree
 * jamais le contexte : sans geste prealable, rien ne sonne. `open` : charley
 * ouvert (pad CH tenu ; les coups du sequenceur sont toujours fermes).
 * `out` recoit la voix programmee (l'horloge, pour pouvoir l'annuler).
 * `vel` : la velocite du pas, en gain (1 fort, 0.6 moyen, 0.32 doux).
 */
export function trigger(inst: Inst, when?: number, open = false, out?: Voice[], vel = 1): boolean {
  const g = graph;
  if (!g) return false;
  enforceMute(g);
  const now = g.ctx.currentTime;
  const t = when === undefined || when < now ? now : when;
  // Velocite (2026-10-01) : un gain de plus entre la voix et le bus, sous 1
  let dest: AudioNode = g.bus;
  let vg: GainNode | null = null;
  if (vel < 1) {
    vg = g.ctx.createGain();
    vg.gain.value = Math.max(0, vel);
    vg.connect(g.bus);
    dest = vg;
  }
  const v = voice(g, inst, t, open, dest, pitchFactor(tone));
  // Le gain part avec la voix (meme liste de noeuds a debrancher)
  if (vg) v.nodes.push(vg);
  out?.push(v);
  triggers += 1;
  last = { inst, open: inst === 'CH' && open, when: t, at: performance.now(), state: g.ctx.state as AudioContextState };
  return true;
}

/**
 * Annule une voix programmee qui n'a pas encore sonne (STOP de l'horloge).
 * Un arret avant l'instant de depart : la source ne joue jamais. Les noeuds
 * sont debranches tout de suite, sans compter sur un onended (un navigateur
 * qui leverait au second stop() laisse ainsi une voix muette, pas un coup).
 */
export function cancelVoice(v: Voice): void {
  for (const s of v.srcs) {
    s.onended = null;
    try {
      s.stop(0);
    } catch {
      /* deja arretee */
    }
  }
  for (const n of v.nodes) n.disconnect();
}

/* ---------------- TONE, LEVEL (spec 7.2), SWING, DIST, REVERB (spec 20.8) ---------------- */

const mixListeners = new Set<() => void>();
const emitMix = (): void => mixListeners.forEach((fn) => fn());

/*
 * SWING, DIST, REVERB : le store du motif les garde (et les persiste) ;
 * tout changement, d'ou qu'il vienne (encodeur, jumeau, rechargement,
 * test), passe par ici : DIST et REVERB rejoignent le graphe s'il existe
 * (rampes de 20 ms), les encodeurs et leurs jumeaux se mettent a jour.
 * Sans contexte, les valeurs attendent le graphe (build() les lit).
 */
pattern.fx.subscribe(() => {
  if (graph) {
    const f = pattern.fx.get();
    graph.fx.setDrive(f.drive);
    graph.fx.setReverb(f.reverb);
  }
  emitMix();
});

/**
 * TONE : -1 a 1 (hauteur +/-7 demi-tons et filtre, audio/tone.ts), accroche
 * a 0 entre -0.04 et 0.04. Sans contexte, la valeur attend le graphe.
 */
export function setTone(v: number): void {
  const t = snapTone(v);
  if (t === tone) return;
  tone = t;
  graph?.tone.set(tone);
  emitMix();
}

/** STRETCH : 0 a 1 (etirement granulaire, audio/stretch.ts), 0 = bypass reel. */
export function setStretch(v: number): void {
  const t = clampStretch(v);
  if (t === stretch) return;
  stretch = t;
  graph?.stretch.set(stretch);
  emitMix();
}

/** Pilote le gain LEVEL (niveau au carre), jamais le master. */
export function setLevel(v: number): void {
  const l = clamp01(v);
  if (l === level) return;
  level = l;
  if (graph) glide(graph.level.gain, level * level, graph.ctx);
  emitMix();
}

/** SWING : 0 a 1, retard des pas pairs de 0 a un tiers de pas (l'horloge le lit a chaque pas). */
export function setSwing(v: number): void {
  pattern.fx.set({ swing: v });
}

/** DIST : 0 a 1 (saturation parallele du bus, 0 = le son d'origine). */
export function setDrive(v: number): void {
  pattern.fx.set({ drive: v });
}

/** REVERB : 0 a 1 (envoi vers la reverbe, 0 = rien d'envoye). */
export function setReverb(v: number): void {
  pattern.fx.set({ reverb: v });
}

/** Les potards du bus, lus par la scene (angles) et les commandes (glisser). */
export const mix = {
  get tone(): number {
    return tone;
  },
  get stretch(): number {
    return stretch;
  },
  get level(): number {
    return level;
  },
  get swing(): number {
    return pattern.fx.get().swing;
  },
  get drive(): number {
    return pattern.fx.get().drive;
  },
  get reverb(): number {
    return pattern.fx.get().reverb;
  },
  subscribe(fn: () => void): () => void {
    mixListeners.add(fn);
    return () => {
      mixListeners.delete(fn);
    };
  },
};

/* ---------------- rendu hors ligne (tests, revision 5) ---------------- */

/** Rendu hors ligne : rien ne sort des enceintes, deux rendus identiques donnent les memes echantillons. */
export interface OfflineOpts {
  seconds: number;
  sampleRate?: number;
  /** motif et tempo ; le motif courant par defaut */
  bpm?: number;
  steps?: Record<Inst, string>;
  /** un seul coup de cette voix a 50 ms, au lieu du motif */
  single?: Inst;
  /** sinus continus (Hz) dans le bus, au lieu de la batterie */
  sines?: number[];
  tone?: number;
  stretch?: number;
  /** reference : sans aucun stage TONE ni STRETCH */
  bare?: boolean;
  /** reglages pendant le rendu : [instant (s), valeur], 50 ms d'ecart au moins */
  toneAt?: [number, number][];
  stretchAt?: [number, number][];
  seed?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function renderOffline(o: OfflineOpts): Promise<Float32Array> {
  const sr = o.sampleRate ?? 48000;
  const oc = new OfflineAudioContext(1, Math.round(o.seconds * sr), sr);
  const tone0 = snapTone(o.tone ?? 0);
  const rnd = Math.random;
  const gate = ohGate;
  const end = ohEnd;
  Math.random = seeded(o.seed ?? 808);
  ohGate = null;
  ohEnd = 0;
  let g: Graph;
  // Les voix ne se debranchent pas pendant le rendu : leur onended tombe a
  // un instant quelconque du rendu et couperait la queue d'un filtre (deux
  // rendus identiques doivent donner les memes echantillons)
  const voices: Voice[] = [];
  try {
    g = build(oc, { tone: tone0, stretch: 0, drive: 0, reverb: 0, master: 1, bare: o.bare });
    if (o.sines) {
      for (const hz of o.sines) {
        const osc = oc.createOscillator();
        osc.frequency.value = hz;
        const a = oc.createGain();
        a.gain.value = 0.25;
        osc.connect(a);
        a.connect(g.bus);
        osc.start(0);
      }
    } else if (o.single) {
      voices.push(voice(g, o.single, 0.05, false, g.bus, pitchFactor(tone0)));
    } else {
      const steps = o.steps ?? pattern.get().steps;
      const step = 60 / (o.bpm ?? pattern.get().bpm) / 4;
      for (let n = 0, t = 0.02; t < o.seconds - 0.5; n += 1, t += step) {
        for (const inst of INSTRUMENTS) {
          const v = velocity(steps, inst, n % STEP_COUNT);
          if (v === 0) continue;
          let dest: AudioNode = g.bus;
          if (VEL_GAIN[v] < 1) {
            const vg = oc.createGain();
            vg.gain.value = VEL_GAIN[v];
            vg.connect(g.bus);
            dest = vg;
          }
          voices.push(voice(g, inst, t, false, dest, pitchFactor(tone0)));
        }
      }
    }
    for (const v of voices) for (const src of v.srcs) src.onended = null;
  } finally {
    Math.random = rnd;
    ohGate = gate;
    ohEnd = end;
  }
  const needsWorklet = (o.stretch ?? 0) > 0 || (o.stretchAt?.length ?? 0) > 0;
  if (needsWorklet && !(await g.stretch.ready())) throw new Error('AudioWorklet unavailable');
  if (o.stretch) g.stretch.set(o.stretch);
  // Chaque reglage : pose a son instant, puis une pause de 80 ms (temps reel)
  // 30 ms plus loin, rampe finie : le debranchement differe (setTimeout) y tombe
  const q = 128 / sr;
  const at = (t: number): number => Math.round(t / q) * q;
  const events = [
    ...(o.toneAt ?? []).map(([t, v]) => ({ t, run: () => g.tone.set(snapTone(v)) })),
    ...(o.stretchAt ?? []).map(([t, v]) => ({ t, run: () => g.stretch.set(v) })),
  ].sort((a, b) => a.t - b.t);
  const used = new Set<number>();
  for (const e of events) {
    const t0 = at(e.t);
    const t1 = at(e.t + 0.03);
    if (used.has(t0) || used.has(t1)) continue;
    used.add(t0);
    used.add(t1);
    void oc.suspend(t0).then(() => {
      e.run();
      void oc.resume();
    });
    void oc.suspend(t1).then(async () => {
      await sleep(80);
      void oc.resume();
    });
  }
  const buf = await oc.startRendering();
  return buf.getChannelData(0).slice();
}

/* ---------------- debug (window.__v4.audio) ---------------- */


const peakBuf = new Float32Array(1024);

export interface AudioDebug {
  /** undefined tant qu'aucun geste n'a eu lieu */
  readonly ctx: AudioContext | undefined;
  readonly analyser: AnalyserNode | undefined;
  readonly master: GainNode | undefined;
  readonly muted: boolean;
  /** TONE (-1 a 1) et STRETCH (0 a 1), revision 5 */
  readonly tone: number;
  readonly stretch: number;
  readonly level: number;
  /** SWING, DIST, REVERB (0 a 1), les valeurs du store du motif */
  readonly swing: number;
  readonly drive: number;
  readonly reverb: number;
  /** DIST et REVERB tels qu'appliques au graphe (null avant le premier geste) */
  readonly fx: FxInfo | null;
  /** TONE et STRETCH tels qu'appliques au graphe (insert direct ou engage, worklet) */
  readonly toneInfo: ToneInfo | null;
  readonly stretchInfo: StretchInfo | null;
  /** gain LEVEL du dernier bloc rendu (level au carre) */
  readonly levelGain: number | undefined;
  /** contextes crees depuis le chargement de la page (0 avant le premier geste, 1 ensuite) */
  readonly created: number;
  readonly triggers: number;
  readonly last: TriggerInfo | null;
  /** crete absolue des 1024 derniers echantillons de l'analyseur */
  peak(): number;
  setTone(v: number): void;
  setStretch(v: number): void;
  /** compteurs du processeur STRETCH (grains, sauts, retard en s) */
  stretchStats(): Promise<unknown>;
  /** rendu hors ligne du graphe reel (tests) */
  renderOffline(o: OfflineOpts): Promise<Float32Array>;
  setLevel(v: number): void;
  setSwing(v: number): void;
  setDrive(v: number): void;
  setReverb(v: number): void;
}

export const audioDebug: AudioDebug = {
  get ctx() {
    return ctx;
  },
  get analyser() {
    return graph?.analyser;
  },
  get master() {
    return graph?.master;
  },
  get muted() {
    return FLAGS.mute;
  },
  get tone() {
    return tone;
  },
  get stretch() {
    return stretch;
  },
  get level() {
    return level;
  },
  get swing() {
    return mix.swing;
  },
  get drive() {
    return mix.drive;
  },
  get reverb() {
    return mix.reverb;
  },
  get fx() {
    return graph ? graph.fx.info() : null;
  },
  get toneInfo() {
    return graph ? graph.tone.info() : null;
  },
  get stretchInfo() {
    return graph ? graph.stretch.info() : null;
  },
  get levelGain() {
    return graph?.level.gain.value;
  },
  get created() {
    return created;
  },
  get triggers() {
    return triggers;
  },
  get last() {
    return last;
  },
  peak() {
    if (!graph) return 0;
    graph.analyser.getFloatTimeDomainData(peakBuf);
    let m = 0;
    for (let i = 0; i < peakBuf.length; i += 1) {
      const a = Math.abs(peakBuf[i]);
      if (a > m) m = a;
    }
    return m;
  },
  setTone,
  setStretch,
  stretchStats: () => (graph ? graph.stretch.stats() : Promise.resolve(null)),
  renderOffline,
  setLevel,
  setSwing,
  setDrive,
  setReverb,
};
