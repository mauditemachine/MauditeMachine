/**
 * Boite a rythmes synthetisee (spec 8) : dix voix Web Audio (cinq
 * jusqu'au 2026-10-03 ; CP, RS, HT et CY facon Analog Rytm, PC une conga), aucun
 * fichier. Un seul AudioContext pour la page, cree au premier geste de
 * l'utilisateur (jamais au montage, jamais par un timer) et repris a
 * chaque interaction s'il est suspendu (regle iOS). Graphe (revision 2 :
 * DIST et REVERB, audio/fx.ts ; revision 5 : TONE, insert a bypass reel,
 * audio/tone.ts) :
 *
 *   voix -> tranche de la voix -> bus -> [sec + DIST] -> TONE -> CHORUS
 *        -> gain (LEVEL) -> compresseur leger -> analyseur
 *        -> master -> destination
 *   tranche (2026-10-01, effets par piste) : LEVEL de la voix -> TONE
 *        (filtre) -> DIST -> CHORUS, puis envois REVERB et DELAY
 *   LEVEL et chaque tranche -> envois REVERB, DELAY (audio/sends.ts)
 *        -> convolueur, ligne de retard -> analyseur
 *
 * Chaque insert est en bypass reel a son neutre, chaque envoi a 0 est
 * debranche : au depart, une voix traverse quatre gains a 1, rien d'autre.
 *
 * TONE transpose aussi : chaque coup est programme avec ses frequences
 * multipliees par 2^(demi-tons / 12), exactement 1 a TONE 0. STRETCH
 * (2026-10-01, le Time d'Impulse, audio/time.ts) agit pareil sur les
 * durees : balayages et enveloppes multiplies par 4^v, exactement 1 a 0.
 *
 * L'analyseur est AVANT le master : avec ?mute=1 le master reste a 0 pour
 * toute la session (LEVEL ne pilote que son propre gain) et le signal
 * reste mesurable sans rien envoyer aux enceintes. SWING, DIST et REVERB
 * vivent dans le store du motif (pattern.fx, persistes avec lui) : ce
 * module les applique au graphe, l'horloge lit SWING a chaque pas.
 */

import limiterUrl from './limiter.worklet.js?url';
import { FLAGS } from '../state/flags';
import type { Inst } from '../theme';
import { buildChorus, type ChorusInfo, type ChorusStage } from './chorus';
import { buildDrive, buildFx, glide, type DriveStage, type FxChain } from './fx';
import { pattern, VEL_GAIN, INSTRUMENTS, STEP_COUNT, velocity } from './pattern';
import { buildDelayBus, buildReverbBus, type BusInfo, type DelayBus, type Send, type SendBus, type SendInfo } from './sends';
import { hitTime, snapTime } from './time';
import { buildTone, pitchFactor, snapTone, type ToneInfo, type ToneStage } from './tone';
import { VOICE_FX_DEFAULT, voiceFx, voiceGain, type VoiceFx, type VoiceParam } from './voicefx';

type Ctor = typeof AudioContext;

/** La tranche d'une voix : son niveau, ses inserts, ses envois. */
interface Channel {
  input: GainNode;
  tone: ToneStage;
  drive: DriveStage;
  chorus: ChorusStage;
  out: GainNode;
  reverb: Send;
  delay: Send;
}

interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  tone: ToneStage;
  chorus: ChorusStage;
  level: GainNode;
  comp: DynamicsCompressorNode;
  analyser: AnalyserNode;
  master: GainNode;
  /** l'ecreteur doux de secours (avant que le limiteur soit charge, ou sans AudioWorklet) */
  clipPre: GainNode;
  /** le limiteur a anticipation (audio/limiter.worklet.js), une fois charge */
  limiter: AudioWorkletNode | null;
  /** DIST du bus */
  fx: FxChain;
  /** REVERB et DELAY partages, et les envois de tout le pattern (apres LEVEL) */
  reverb: SendBus;
  delay: DelayBus;
  reverbSend: Send;
  delaySend: Send;
  /** tranches des voix (null : reference sans effets, rendu hors ligne) */
  ch: Record<Inst, Channel> | null;
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
const TAIL = { BD: 0.42, SD: 0.18, SDbody: 0.12, TOM: 0.3, CH: 0.045, CHopen: 0.22, OH: 0.34, CP: 0.22, RS: 0.07, HT: 0.24, CY: 1.1, PC: 0.2 } as const;
/** Les six frequences metalliques de la 808 (cymbale, charleys d'origine), en Hz. */
const METAL_HZ = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;
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
/** STRETCH : -1 a 1, 0 = duree d'origine (2026-10-01, audio/time.ts) */
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

/** Options du graphe hors ligne (tests) : valeurs imposees, master force. */
interface BuildOpts {
  tone?: number;
  drive?: number;
  reverb?: number;
  delay?: number;
  chorus?: number;
  bpm?: number;
  /** effets par voix imposes (hors ligne) ; absent : ceux du store */
  voice?: Partial<Record<Inst, Partial<VoiceFx>>>;
  /** master a 1 quel que soit ?mute=1 (rendu hors ligne : rien ne sort des enceintes) */
  master?: number;
  /** reference : le bus rejoint LEVEL sans aucun stage TONE ni CHORUS, les voix sans tranche */
  bare?: boolean;
}

/** Duree d'un pas (s) : le DELAY reste une croche pointee. */
const stepOf = (bpm: number): number => 60 / bpm / 4;

/** Ecreteur doux de sortie : entrees jusqu'a +/-range, identite sous knee, arrondi tanh jusqu'a 1. */
const CLIP = { range: 4, knee: 0.9, points: 8193 } as const;

function softClipCurve(): Float32Array {
  const n = CLIP.points;
  const k = CLIP.knee;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = CLIP.range * ((i / (n - 1)) * 2 - 1);
    const a = Math.abs(x);
    const y = a < k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k));
    out[i] = Math.sign(x) * y;
  }
  return out;
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
  // Garde-fou (2026-10-02) : les effets plus marques (REVERB, DELAY, DIST)
  // et leurs retours, qui ne passent pas par le compresseur, depassaient
  // 0 dBFS (+8 dB tout a fond). Un ecreteur doux au bout de la chaine
  // (softClipCurve) : identite sous 0.9, arrondi jusqu'a 1 au-dessus ; le
  // motif sec culmine a -0.8 dBFS, il n'y touche pas. (Un compresseur en
  // limiteur laissait passer les attaques et relevait le sec de son gain
  // de compensation automatique.)
  const clipPre = c.createGain();
  clipPre.gain.value = 1 / CLIP.range;
  const clipper = c.createWaveShaper();
  clipper.curve = softClipCurve();
  // Secours seulement (le limiteur le remplace des qu'il est charge) : surechantillonne x4, sans repliement
  clipper.oversample = '4x';
  clipPre.connect(clipper);
  const master = c.createGain();
  // Mute : 0 AVANT tout branchement, jamais d'automation sur ce gain
  master.gain.value = o.master ?? (FLAGS.mute ? 0 : 1);

  // Le bus rejoint TONE par DIST (sec, et mouille si DIST > 0), puis CHORUS
  lvl.connect(comp);
  comp.connect(analyser);
  analyser.connect(clipPre);
  clipper.connect(master);
  master.connect(c.destination);
  const f = pattern.fx.get();
  const direct = { direct: true, linked: false, dry: 1, wet: 0, unlinks: 0 };
  let toneSt: ToneStage;
  let chorusSt: ChorusStage;
  if (o.bare) {
    toneSt = { input: lvl, set: () => undefined, reset: () => undefined, info: () => ({ value: 0, semitones: 0, hpHz: 0, lpHz: 0, insert: direct }) };
    chorusSt = { input: lvl, set: () => undefined, value: () => 0, reset: () => undefined, info: () => ({ value: 0, live: false, built: 0, insert: direct }) };
  } else {
    chorusSt = buildChorus(c, lvl);
    toneSt = buildTone(c, chorusSt.input, o.tone ?? tone);
  }
  const fx = buildFx(c, { bus, tone: toneSt.input }, o.drive ?? f.drive);

  // REVERB et DELAY partages ; les envois de tout le pattern partent de LEVEL
  const reverb = buildReverbBus(c, analyser);
  const delay = buildDelayBus(c, analyser, stepOf(o.bpm ?? pattern.get().bpm));
  const reverbSend = reverb.attach(lvl);
  const delaySend = delay.attach(lvl);

  // Tranches des voix : LEVEL -> TONE -> DIST -> CHORUS -> bus, et leurs envois
  let ch: Record<Inst, Channel> | null = null;
  if (!o.bare) {
    const out = {} as Record<Inst, Channel>;
    for (const inst of INSTRUMENTS) {
      const chOut = c.createGain();
      chOut.connect(bus);
      const chChorus = buildChorus(c, chOut);
      const chDrive = buildDrive(c, chChorus.input);
      const chTone = buildTone(c, chDrive.input, 0);
      const chIn = c.createGain();
      chIn.gain.value = 1;
      chIn.connect(chTone.input);
      out[inst] = { input: chIn, tone: chTone, drive: chDrive, chorus: chChorus, out: chOut, reverb: reverb.attach(chOut), delay: delay.attach(chOut) };
    }
    ch = out;
  }

  const noise = c.createBuffer(1, Math.round(c.sampleRate), c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;

  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(2.5 * ((i / (curve.length - 1)) * 2 - 1));

  const g: Graph = { ctx: c, bus, tone: toneSt, chorus: chorusSt, level: lvl, comp, analyser, master, clipPre, limiter: null, fx, reverb, delay, reverbSend, delaySend, ch, noise, curve };
  if (!o.bare) {
    reverbSend.set(o.reverb ?? f.reverb);
    delaySend.set(o.delay ?? f.delay);
    chorusSt.set(o.chorus ?? f.chorus);
    for (const inst of INSTRUMENTS) applyVoice(g, inst, o.voice ? { ...VOICE_FX_DEFAULT, ...(o.voice[inst] ?? {}) } : voiceFx.of(inst));
  }
  return g;
}

/** Les reglages d'une voix sur sa tranche (chaque setter ne fait rien si rien ne change). */
function applyVoice(g: Graph, inst: Inst, v: Readonly<VoiceFx>): void {
  const t = g.ch?.[inst];
  if (!t) return;
  const gain = voiceGain(v.level);
  if (t.input.gain.value !== gain) glide(t.input.gain, gain, g.ctx);
  t.tone.set(v.tone);
  t.drive.set(v.dist);
  t.chorus.set(v.chorus);
  t.reverb.set(v.reverb);
  t.delay.set(v.delay);
}

/** Entree d'une voix : sa tranche, ou le bus (reference hors ligne). */
const voiceIn = (g: Graph, inst: Inst): AudioNode => g.ch?.[inst].input ?? g.bus;

/** Facteur de hauteur d'une voix : TONE du pattern et TONE de la voix (exactement 1 a 0 et 0). */
const voicePitch = (inst: Inst, globalTone: number, voiceTone?: number): number =>
  pitchFactor(globalTone) * pitchFactor(voiceTone ?? voiceFx.of(inst).tone);

/** Facteur des durees d'une voix : STRETCH du pattern et STRETCH de la voix (exactement 1 a 0 et 0). */
const voiceTime = (inst: Inst, globalStretch: number, voiceStretch?: number): number =>
  hitTime(globalStretch, voiceStretch ?? voiceFx.of(inst).stretch);

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
    // Apres quiet() (demontage) : REVERB et DELAY reviennent sur des unites
    // neuves (envois gardes)
    graph.reverb.revive();
    graph.delay.revive();
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
  attachLimiter(ctx, graph);
  return ctx;
}

/**
 * Le limiteur de sortie (2026-10-03, qualite) : charge en fond, il prend la
 * place de l'ecreteur doux des qu'il est pret (analyseur -> limiteur ->
 * master). Sans AudioWorklet, l'ecreteur reste.
 */
function attachLimiter(c: BaseAudioContext, g: Graph): Promise<void> {
  if (!c.audioWorklet) return Promise.resolve();
  return c.audioWorklet
    .addModule(limiterUrl)
    .then(() => {
      const node = new AudioWorkletNode(c, 'mm-limiter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      g.analyser.disconnect(g.clipPre);
      g.analyser.connect(node);
      node.connect(g.master);
      g.limiter = node;
    })
    .catch(() => {
      /* l'ecreteur doux reste en service */
    });
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
  graph?.reverb.silence();
  graph?.delay.silence();
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

/**
 * Branchement du MM-VOYAGER (2026-10-03, audio/synth.ts) : son entree
 * rejoint le compresseur apres LEVEL (la boite a rythmes et le synthe se
 * collent, puis l'analyseur, l'ecreteur et le master : ?mute=1 tient), et
 * ses envois partagent la REVERB et le DELAY de la boite. null avant le
 * premier geste.
 */
export interface SynthPort {
  ctx: AudioContext;
  input: AudioNode;
  reverb: SendBus;
  delay: DelayBus;
}

export function synthPort(): SynthPort | null {
  if (!ctx || !graph) return null;
  return { ctx, input: graph.comp, reverb: graph.reverb, delay: graph.delay };
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

/**
 * Depart au hasard dans la seconde de bruit : deux coups ne sont jamais
 * identiques. En boucle : une queue etiree (STRETCH) peut durer plus d'une
 * seconde.
 */
function startNoise(src: AudioBufferSourceNode, when: number, tail: number, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
  src.loop = true;
  const span = (src.buffer?.duration ?? 1) - tail - STOP_PAD - 0.01;
  src.start(when, Math.random() * Math.max(0, span));
  src.stop(when + tail + STOP_PAD);
}

function voiceBD(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.BD * ts;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 * pf, when);
  osc.frequency.exponentialRampToValueAtTime(48 * pf, when + 0.06 * ts);
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  // L'attaque (2 ms) ne s'etire pas : le coup garde son claquement
  env.gain.linearRampToValueAtTime(1, when + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  const drive = c.createGain();
  drive.gain.value = 1.4;
  const shaper = c.createWaveShaper();
  shaper.curve = g.curve;
  shaper.oversample = '4x';
  const post = c.createGain();
  post.gain.value = 0.8;
  osc.connect(env);
  env.connect(drive);
  drive.connect(shaper);
  shaper.connect(post);
  post.connect(dest);
  const nodes = [osc, env, drive, shaper, post];
  play(osc, when, tail, nodes);
  return { when, srcs: [osc], nodes };
}

function voiceSD(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.SD * ts;
  const bodyTail = TAIL.SDbody * ts;
  const src = noiseSource(g);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 * pf;
  bp.Q.value = 1.2;
  const nEnv = c.createGain();
  nEnv.gain.setValueAtTime(1, when);
  nEnv.gain.exponentialRampToValueAtTime(0.001, when + tail);
  const body = c.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(180 * pf, when);
  body.frequency.exponentialRampToValueAtTime(140 * pf, when + 0.06 * ts);
  const bEnv = c.createGain();
  bEnv.gain.setValueAtTime(0.6, when);
  bEnv.gain.exponentialRampToValueAtTime(0.001, when + bodyTail);
  const out = c.createGain();
  out.gain.value = 0.9;
  src.connect(bp);
  bp.connect(nEnv);
  nEnv.connect(out);
  body.connect(bEnv);
  bEnv.connect(out);
  out.connect(dest);
  body.start(when);
  body.stop(when + bodyTail + STOP_PAD);
  // Le bruit finit en dernier : c'est lui qui debranche toute la voix
  const nodes = [src, bp, nEnv, body, bEnv, out];
  startNoise(src, when, tail, nodes);
  return { when, srcs: [src, body], nodes };
}

function voiceTOM(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.TOM * ts;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220 * pf, when);
  osc.frequency.exponentialRampToValueAtTime(110 * pf, when + 0.12 * ts);
  const env = c.createGain();
  env.gain.setValueAtTime(1, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  osc.connect(env);
  env.connect(dest);
  const nodes = [osc, env];
  play(osc, when, tail, nodes);
  return { when, srcs: [osc], nodes };
}

/**
 * Clap (2026-10-03) : bruit en bande (1.1 kHz) frappe quatre fois a 10 ms
 * d'intervalle (les mains qui ne tombent pas ensemble), la derniere tient
 * 220 ms.
 */
function voiceCP(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.CP * ts;
  const src = noiseSource(g);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100 * pf;
  bp.Q.value = 1.3;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 500 * pf;
  const env = c.createGain();
  // Trois claquements brefs (l'attaque ne s'etire pas), puis la queue
  for (let k = 0; k < 3; k += 1) {
    const t = when + 0.01 * k;
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.008);
  }
  env.gain.setValueAtTime(1, when + 0.03);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.03 + tail);
  const out = c.createGain();
  out.gain.value = 1.6;
  src.connect(bp);
  bp.connect(hp);
  hp.connect(env);
  env.connect(out);
  out.connect(dest);
  const nodes = [src, bp, hp, env, out];
  startNoise(src, when, 0.03 + tail, nodes);
  return { when, srcs: [src], nodes };
}

/**
 * Rimshot (2026-10-03) : deux triangles inharmoniques tres courts (980 Hz
 * et 290 Hz, plus bas que ceux de la 808 a la demande de Mika) ; 70 ms.
 */
function voiceRS(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.RS * ts;
  const a = c.createOscillator();
  a.type = 'triangle';
  // Plus bas (2026-10-03, Mika : 1.7 kHz et 455 Hz sonnaient trop aigus) : le bois du cercle
  a.frequency.value = 980 * pf;
  const b = c.createOscillator();
  b.type = 'triangle';
  b.frequency.value = 290 * pf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 180 * pf;
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + 0.001);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  const out = c.createGain();
  out.gain.value = 0.55;
  a.connect(hp);
  b.connect(hp);
  hp.connect(env);
  env.connect(out);
  out.connect(dest);
  const nodes: AudioNode[] = [a, b, hp, env, out];
  b.start(when);
  b.stop(when + tail + STOP_PAD);
  play(a, when, tail, nodes);
  return { when, srcs: [a, b], nodes };
}

/** Tom aigu (2026-10-03) : le TOM une quinte plus haut, plus court. */
function voiceHT(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.HT * ts;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(330 * pf, when);
  osc.frequency.exponentialRampToValueAtTime(175 * pf, when + 0.1 * ts);
  const env = c.createGain();
  env.gain.setValueAtTime(1, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  osc.connect(env);
  env.connect(dest);
  const nodes = [osc, env];
  play(osc, when, tail, nodes);
  return { when, srcs: [osc], nodes };
}

/**
 * Cymbale (2026-10-03) : les six carres metalliques de la 808 (METAL_HZ x
 * 2), filtres haut et en bande vers 8 kHz, et un voile de bruit ; 1.1 s.
 */
function voiceCY(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.CY * ts;
  const mix = c.createGain();
  mix.gain.value = 0.3;
  const srcs: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [mix];
  for (const hz of METAL_HZ) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = hz * 2 * pf;
    o.connect(mix);
    srcs.push(o);
    nodes.push(o);
  }
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(8000 * pf, c.sampleRate * 0.45);
  bp.Q.value = 0.7;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = Math.min(5200 * pf, c.sampleRate * 0.4);
  const noise = noiseSource(g);
  const nHp = c.createBiquadFilter();
  nHp.type = 'highpass';
  nHp.frequency.value = Math.min(7500 * pf, c.sampleRate * 0.45);
  const nGain = c.createGain();
  nGain.gain.value = 0.32;
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(0.9, when + 0.002);
  env.gain.exponentialRampToValueAtTime(0.25, when + 0.08 * ts);
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  mix.connect(bp);
  bp.connect(hp);
  hp.connect(env);
  noise.connect(nHp);
  nHp.connect(nGain);
  nGain.connect(env);
  env.connect(dest);
  nodes.push(bp, hp, nHp, nGain, env);
  for (const o of srcs) {
    o.start(when);
    o.stop(when + tail + STOP_PAD);
  }
  // Le bruit finit en dernier : c'est lui qui debranche toute la voix
  nodes.push(noise);
  startNoise(noise, when, tail, nodes);
  return { when, srcs: [...srcs, noise], nodes };
}

/**
 * Percussion (2026-10-03, a la place de la cloche) : une conga grave. Une
 * peau accordee a 200 Hz (sinus, la hauteur tombe d'un quart en 25 ms puis
 * tient), une pointe de deuxieme mode (x1.5, tres courte) et le claquement
 * de la main (bruit en bande vers 1.6 kHz, 12 ms) ; 200 ms.
 */
function voicePC(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.PC * ts;
  // 200 Hz (2026-10-03, Mika : 330 Hz trop aigu) : une tumba plutot qu'un quinto
  const f0 = 200 * pf;
  const skin = c.createOscillator();
  skin.type = 'sine';
  skin.frequency.setValueAtTime(f0 * 1.25, when);
  skin.frequency.exponentialRampToValueAtTime(f0, when + 0.025 * ts);
  const sEnv = c.createGain();
  sEnv.gain.setValueAtTime(0, when);
  sEnv.gain.linearRampToValueAtTime(0.9, when + 0.002);
  sEnv.gain.exponentialRampToValueAtTime(0.001, when + tail);
  const mode = c.createOscillator();
  mode.type = 'sine';
  mode.frequency.value = f0 * 1.5;
  const mEnv = c.createGain();
  mEnv.gain.setValueAtTime(0.3, when);
  mEnv.gain.exponentialRampToValueAtTime(0.001, when + 0.06 * ts);
  const slap = noiseSource(g);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(1600 * pf, c.sampleRate * 0.45);
  bp.Q.value = 1.1;
  const nEnv = c.createGain();
  nEnv.gain.setValueAtTime(0.5, when);
  nEnv.gain.exponentialRampToValueAtTime(0.001, when + 0.012 * ts);
  const out = c.createGain();
  out.gain.value = 0.83;
  skin.connect(sEnv);
  sEnv.connect(out);
  mode.connect(mEnv);
  mEnv.connect(out);
  slap.connect(bp);
  bp.connect(nEnv);
  nEnv.connect(out);
  out.connect(dest);
  mode.start(when);
  mode.stop(when + 0.06 * ts + STOP_PAD);
  const nodes: AudioNode[] = [skin, sEnv, mode, mEnv, slap, bp, nEnv, out];
  // Le bruit s'arrete tot : la peau, la plus longue, debranche la voix
  slap.loop = true;
  slap.start(when, Math.random() * 0.5);
  slap.stop(when + 0.012 * ts + STOP_PAD);
  play(skin, when, tail, nodes);
  return { when, srcs: [skin, mode, slap], nodes };
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
function voiceOH(g: Graph, when: number, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  const tail = TAIL.OH * ts;
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
  env.gain.exponentialRampToValueAtTime(0.001, when + tail);
  const gate = c.createGain();
  gate.gain.value = 1;
  src.connect(hp);
  hp.connect(shine);
  shine.connect(env);
  env.connect(gate);
  gate.connect(dest);
  ohGate = gate;
  ohEnd = when + tail;
  const nodes = [src, hp, shine, env, gate];
  startNoise(src, when, tail, nodes);
  return { when, srcs: [src], nodes };
}

function voiceCH(g: Graph, when: number, open: boolean, dest: AudioNode = g.bus, pf = 1, ts = 1): Voice {
  const c = g.ctx;
  chokeOH(when);
  const tail = (open ? TAIL.CHopen : TAIL.CH) * ts;
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

/** Une voix, frequences multipliees par pf (TONE), durees par ts (STRETCH) : exactement 1 a 0. */
function voice(g: Graph, inst: Inst, t: number, open: boolean, dest: AudioNode, pf: number, ts: number): Voice {
  switch (inst) {
    case 'BD':
      return voiceBD(g, t, dest, pf, ts);
    case 'SD':
      return voiceSD(g, t, dest, pf, ts);
    case 'TOM':
      return voiceTOM(g, t, dest, pf, ts);
    case 'OH':
      return voiceOH(g, t, dest, pf, ts);
    case 'CP':
      return voiceCP(g, t, dest, pf, ts);
    case 'RS':
      return voiceRS(g, t, dest, pf, ts);
    case 'HT':
      return voiceHT(g, t, dest, pf, ts);
    case 'CY':
      return voiceCY(g, t, dest, pf, ts);
    case 'PC':
      return voicePC(g, t, dest, pf, ts);
    default:
      return voiceCH(g, t, open, dest, pf, ts);
  }
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
  // Velocite (2026-10-01) : un gain de plus entre la voix et sa tranche, sous 1
  let dest: AudioNode = voiceIn(g, inst);
  let vg: GainNode | null = null;
  if (vel < 1) {
    vg = g.ctx.createGain();
    vg.gain.value = Math.max(0, vel);
    vg.connect(dest);
    dest = vg;
  }
  const v = voice(g, inst, t, open, dest, voicePitch(inst, tone), voiceTime(inst, stretch));
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
    graph.reverbSend.set(f.reverb);
    graph.delaySend.set(f.delay);
    graph.chorus.set(f.chorus);
  }
  emitMix();
});

/* Effets par piste : chaque changement du store rejoint les tranches. */
voiceFx.subscribe(() => {
  if (graph) for (const inst of INSTRUMENTS) applyVoice(graph, inst, voiceFx.of(inst));
  emitMix();
});

/* Tempo : le DELAY reste une croche pointee. */
pattern.subscribe(() => {
  graph?.delay.setStep(stepOf(pattern.get().bpm));
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

/**
 * STRETCH : -1 a 1 (audio/time.ts), accroche a 0 entre -0.04 et 0.04 ;
 * les coups programmes ensuite durent 4^v fois plus (ou moins) longtemps.
 */
export function setStretch(v: number): void {
  const t = snapTime(v);
  if (t === stretch) return;
  stretch = t;
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

/** DELAY : 0 a 1 (envoi vers le delay en croche pointee, 0 = rien d'envoye). */
export function setDelay(v: number): void {
  pattern.fx.set({ delay: v });
}

/** CHORUS : 0 a 1 (insert sur le bus, 0 = bypass reel). */
export function setChorus(v: number): void {
  pattern.fx.set({ chorus: v });
}

/** Un effet d'une voix (effets par piste). */
export function setVoiceFx(inst: Inst, p: VoiceParam, v: number): void {
  voiceFx.set(inst, p, v);
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
  get delay(): number {
    return pattern.fx.get().delay;
  },
  get chorus(): number {
    return pattern.fx.get().chorus;
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
  /** sans le limiteur de sortie (mesure du signal avant lui) */
  limiter?: boolean;
  /** sinus continus (Hz) dans le bus, au lieu de la batterie */
  sines?: number[];
  tone?: number;
  /** STRETCH du pattern, -1 a 1 (0 par defaut hors ligne) */
  stretch?: number;
  /** effets de tout le pattern (0 par defaut hors ligne) */
  drive?: number;
  reverb?: number;
  delay?: number;
  chorus?: number;
  /** effets par voix (neutres par defaut hors ligne) */
  voice?: Partial<Record<Inst, Partial<VoiceFx>>>;
  /** reference : sans aucun stage TONE ni CHORUS, voix sans tranche */
  bare?: boolean;
  /** reglages pendant le rendu : [instant (s), valeur], 50 ms d'ecart au moins */
  toneAt?: [number, number][];
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
  const stretch0 = snapTime(o.stretch ?? 0);
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
    g = build(oc, {
      tone: tone0,
      drive: o.drive ?? 0,
      reverb: o.reverb ?? 0,
      delay: o.delay ?? 0,
      chorus: o.chorus ?? 0,
      bpm: o.bpm,
      voice: o.voice ?? {},
      master: 1,
      bare: o.bare,
    });
    const vt = (inst: Inst): number => snapTone(o.voice?.[inst]?.tone ?? 0);
    const vs = (inst: Inst): number => voiceTime(inst, stretch0, snapTime(o.voice?.[inst]?.stretch ?? 0));
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
      voices.push(voice(g, o.single, 0.05, false, voiceIn(g, o.single), voicePitch(o.single, tone0, vt(o.single)), vs(o.single)));
    } else {
      const steps = o.steps ?? pattern.get().steps;
      const step = 60 / (o.bpm ?? pattern.get().bpm) / 4;
      for (let n = 0, t = 0.02; t < o.seconds - 0.5; n += 1, t += step) {
        for (const inst of INSTRUMENTS) {
          const v = velocity(steps, inst, n % STEP_COUNT);
          if (v === 0) continue;
          let dest: AudioNode = voiceIn(g, inst);
          if (VEL_GAIN[v] < 1) {
            const vg = oc.createGain();
            vg.gain.value = VEL_GAIN[v];
            vg.connect(dest);
            dest = vg;
          }
          voices.push(voice(g, inst, t, false, dest, voicePitch(inst, tone0, vt(inst)), vs(inst)));
        }
      }
    }
    for (const v of voices) for (const src of v.srcs) src.onended = null;
  } finally {
    Math.random = rnd;
    ohGate = gate;
    ohEnd = end;
  }
  // La sortie comme en direct : le limiteur (rendu sans lui si l'AudioWorklet manque)
  if (!o.bare && o.limiter !== false) await attachLimiter(oc, g);
  // Chaque reglage : pose a son instant, puis une pause de 80 ms (temps reel)
  // 30 ms plus loin, rampe finie : le debranchement differe (setTimeout) y tombe
  const q = 128 / sr;
  const at = (t: number): number => Math.round(t / q) * q;
  const events = (o.toneAt ?? []).map(([t, v]) => ({ t, run: () => g.tone.set(snapTone(v)) })).sort((a, b) => a.t - b.t);
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
  /** le limiteur de sortie est en service (sinon l'ecreteur doux de secours) */
  readonly limiterOn: boolean;
  /** TONE (-1 a 1, revision 5) et STRETCH (-1 a 1, 2026-10-01) */
  readonly tone: number;
  readonly stretch: number;
  readonly level: number;
  /** SWING, DIST, REVERB, DELAY, CHORUS (0 a 1), les valeurs du store du motif */
  readonly swing: number;
  readonly drive: number;
  readonly reverb: number;
  readonly delay: number;
  readonly chorus: number;
  /** DIST, REVERB, DELAY, CHORUS tels qu'appliques au graphe (null avant le premier geste) */
  readonly fx: FxDebug | null;
  /** effets par voix appliques aux tranches (null avant le premier geste) */
  readonly voices: Record<Inst, VoiceDebug> | null;
  /** TONE tel qu'applique au graphe (insert direct ou engage) */
  readonly toneInfo: ToneInfo | null;
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
  /** facteur des durees du prochain coup de inst (STRETCH du pattern et de la voix) */
  timeOf(inst: Inst): number;
  /** rendu hors ligne du graphe reel (tests) */
  renderOffline(o: OfflineOpts): Promise<Float32Array>;
  setLevel(v: number): void;
  setSwing(v: number): void;
  setDrive(v: number): void;
  setReverb(v: number): void;
  setDelay(v: number): void;
  setChorus(v: number): void;
  setVoiceFx(inst: Inst, p: VoiceParam, v: number): void;
}

/** DIST, envois et unites REVERB et DELAY, CHORUS du bus (debug). */
export interface FxDebug {
  drive: number;
  driveOn: boolean;
  reverb: SendInfo;
  delay: SendInfo;
  reverbBus: BusInfo;
  delayBus: BusInfo;
  chorus: ChorusInfo;
}

/** La tranche d'une voix (debug). */
export interface VoiceDebug {
  gain: number;
  tone: ToneInfo;
  drive: number;
  chorus: ChorusInfo;
  reverb: SendInfo;
  delay: SendInfo;
}

export const audioDebug: AudioDebug = {
  get limiterOn() {
    return graph?.limiter != null;
  },
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
  get delay() {
    return mix.delay;
  },
  get chorus() {
    return mix.chorus;
  },
  get fx() {
    if (!graph) return null;
    const d = graph.fx.info();
    return {
      drive: d.drive,
      driveOn: d.driveOn,
      reverb: graph.reverbSend.info(),
      delay: graph.delaySend.info(),
      reverbBus: graph.reverb.info(),
      delayBus: graph.delay.info(),
      chorus: graph.chorus.info(),
    };
  },
  get voices() {
    const g = graph;
    if (!g?.ch) return null;
    const ch = g.ch;
    return Object.fromEntries(
      INSTRUMENTS.map((i) => [
        i,
        { gain: ch[i].input.gain.value, tone: ch[i].tone.info(), drive: ch[i].drive.value(), chorus: ch[i].chorus.info(), reverb: ch[i].reverb.info(), delay: ch[i].delay.info() },
      ])
    ) as Record<Inst, VoiceDebug>;
  },
  get toneInfo() {
    return graph ? graph.tone.info() : null;
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
  timeOf: (inst: Inst) => voiceTime(inst, stretch),
  renderOffline,
  setLevel,
  setSwing,
  setDrive,
  setReverb,
  setDelay,
  setChorus,
  setVoiceFx,
};
