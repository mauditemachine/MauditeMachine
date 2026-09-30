/**
 * Boite a rythmes synthetisee (spec 8) : quatre voix Web Audio, aucun
 * fichier. Un seul AudioContext pour la page, cree au premier geste de
 * l'utilisateur (jamais au montage, jamais par un timer) et repris a
 * chaque interaction s'il est suspendu (regle iOS). Graphe (revision 2 :
 * DIST et REVERB, audio/fx.ts) :
 *
 *   voix -> bus -> [sec + DIST] -> passe-bas (TONE) -> gain (LEVEL)
 *        -> compresseur leger -> analyseur -> master -> destination
 *   LEVEL -> envoi REVERB -> convolueur -> analyseur
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
import { pattern } from './pattern';

type Ctor = typeof AudioContext;

interface Graph {
  ctx: AudioContext;
  bus: GainNode;
  tone: BiquadFilterNode;
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
const TAIL = { BD: 0.42, SD: 0.18, SDbody: 0.12, TOM: 0.3, CH: 0.045, CHopen: 0.22 } as const;
/** Les sources s'arretent 50 ms apres la fin de leur enveloppe. */
const STOP_PAD = 0.05;

let ctx: AudioContext | undefined;
let graph: Graph | undefined;
let created = 0;
let triggers = 0;
let last: TriggerInfo | null = null;
let tone = 1;
let level = 0.8;
/**
 * Etat voulu du contexte : la derniere demande gagne, quel que soit l'ordre
 * dans lequel les promesses de suspend() et resume() se resolvent.
 */
let want: 'running' | 'suspended' = 'running';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);
/** 300 Hz a 0, 18 kHz a 1 (spec 8.1). */
const toneHz = (v: number): number => 300 * Math.pow(60, v);

function getCtor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: Ctor }).webkitAudioContext;
}

function build(c: AudioContext): Graph {
  const bus = c.createGain();
  bus.gain.value = 1;
  const toneF = c.createBiquadFilter();
  toneF.type = 'lowpass';
  toneF.Q.value = 0.8;
  toneF.frequency.value = toneHz(tone);
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
  master.gain.value = FLAGS.mute ? 0 : 1;

  // Le bus rejoint TONE par DIST (sec, et mouille si DIST > 0)
  toneF.connect(lvl);
  lvl.connect(comp);
  comp.connect(analyser);
  analyser.connect(master);
  master.connect(c.destination);
  const f = pattern.fx.get();
  const fx = buildFx(c, { bus, tone: toneF, level: lvl, out: analyser }, f.drive, f.reverb);

  const noise = c.createBuffer(1, Math.round(c.sampleRate), c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;

  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(2.5 * ((i / (curve.length - 1)) * 2 - 1));

  return { ctx: c, bus, tone: toneF, level: lvl, comp, analyser, master, fx, noise, curve };
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
    // Apres quiet() (demontage) : la reverbe du store revient, convolueur neuf
    graph.fx.setReverb(pattern.fx.get().reverb);
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

function voiceBD(g: Graph, when: number): Voice {
  const c = g.ctx;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(48, when + 0.06);
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
  post.connect(g.bus);
  const nodes = [osc, env, drive, shaper, post];
  play(osc, when, TAIL.BD, nodes);
  return { when, srcs: [osc], nodes };
}

function voiceSD(g: Graph, when: number): Voice {
  const c = g.ctx;
  const src = noiseSource(g);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 1.2;
  const nEnv = c.createGain();
  nEnv.gain.setValueAtTime(1, when);
  nEnv.gain.exponentialRampToValueAtTime(0.001, when + TAIL.SD);
  const body = c.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(180, when);
  body.frequency.exponentialRampToValueAtTime(140, when + 0.06);
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
  out.connect(g.bus);
  body.start(when);
  body.stop(when + TAIL.SDbody + STOP_PAD);
  // Le bruit finit en dernier : c'est lui qui debranche toute la voix
  const nodes = [src, bp, nEnv, body, bEnv, out];
  startNoise(src, when, TAIL.SD, nodes);
  return { when, srcs: [src, body], nodes };
}

function voiceTOM(g: Graph, when: number): Voice {
  const c = g.ctx;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, when);
  osc.frequency.exponentialRampToValueAtTime(110, when + 0.12);
  const env = c.createGain();
  env.gain.setValueAtTime(1, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + TAIL.TOM);
  osc.connect(env);
  env.connect(g.bus);
  const nodes = [osc, env];
  play(osc, when, TAIL.TOM, nodes);
  return { when, srcs: [osc], nodes };
}

function voiceCH(g: Graph, when: number, open: boolean): Voice {
  const c = g.ctx;
  const tail = open ? TAIL.CHopen : TAIL.CH;
  const src = noiseSource(g);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  hp.Q.value = 0.7;
  const env = c.createGain();
  env.gain.setValueAtTime(0.7, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  src.connect(hp);
  hp.connect(env);
  env.connect(g.bus);
  const nodes = [src, hp, env];
  startNoise(src, when, tail, nodes);
  return { when, srcs: [src], nodes };
}

/**
 * Joue un coup a `when` (temps du contexte ; maintenant par defaut). Ne cree
 * jamais le contexte : sans geste prealable, rien ne sonne. `open` : charley
 * ouvert (pad CH tenu ; les coups du sequenceur sont toujours fermes).
 * `out` recoit la voix programmee (l'horloge, pour pouvoir l'annuler).
 */
export function trigger(inst: Inst, when?: number, open = false, out?: Voice[]): boolean {
  const g = graph;
  if (!g) return false;
  enforceMute(g);
  const now = g.ctx.currentTime;
  const t = when === undefined || when < now ? now : when;
  const v = inst === 'BD' ? voiceBD(g, t) : inst === 'SD' ? voiceSD(g, t) : inst === 'TOM' ? voiceTOM(g, t) : voiceCH(g, t, open);
  out?.push(v);
  triggers += 1;
  last = { inst, open: inst === 'CH' && open, when: t, at: performance.now(), state: g.ctx.state };
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

/** Passe-bas du bus : 0 a 1 (300 Hz a 18 kHz). Sans contexte, la valeur attend le graphe. */
export function setTone(v: number): void {
  const t = clamp01(v);
  if (t === tone) return;
  tone = t;
  if (graph) glide(graph.tone.frequency, toneHz(tone), graph.ctx);
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

/* ---------------- debug (window.__v4.audio) ---------------- */

const peakBuf = new Float32Array(1024);

export interface AudioDebug {
  /** undefined tant qu'aucun geste n'a eu lieu */
  readonly ctx: AudioContext | undefined;
  readonly analyser: AnalyserNode | undefined;
  readonly master: GainNode | undefined;
  readonly muted: boolean;
  readonly tone: number;
  readonly level: number;
  /** SWING, DIST, REVERB (0 a 1), les valeurs du store du motif */
  readonly swing: number;
  readonly drive: number;
  readonly reverb: number;
  /** DIST et REVERB tels qu'appliques au graphe (null avant le premier geste) */
  readonly fx: FxInfo | null;
  /**
   * valeurs du dernier bloc rendu : coupure du passe-bas (Hz), gain LEVEL
   * (level au carre) ; en retard tant que le bus est muet (rien a rendre)
   */
  readonly toneHz: number | undefined;
  readonly levelGain: number | undefined;
  /** contextes crees depuis le chargement de la page (0 avant le premier geste, 1 ensuite) */
  readonly created: number;
  readonly triggers: number;
  readonly last: TriggerInfo | null;
  /** crete absolue des 1024 derniers echantillons de l'analyseur */
  peak(): number;
  setTone(v: number): void;
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
  get toneHz() {
    return graph?.tone.frequency.value;
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
  setLevel,
  setSwing,
  setDrive,
  setReverb,
};
