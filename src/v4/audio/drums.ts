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
 *
 * Les verrous (2026-10-08, l'etape R2 des parameter locks, audio/locks.ts) :
 * un coup du sequenceur recoit les verrous de son pas (trigger(..., lock)) ;
 * hitParams en tire ce qu'il joue (son son, sa hauteur avec TUNE, son DECAY,
 * son gain avec VOL, son PAN, son START), le meme calcul pour le direct et
 * le rendu hors ligne (renderOffline({ locks })). Sans verrou et aux
 * valeurs de depart de TUNE, PAN et START, chaque coup est exactement celui
 * d'avant (memes noeuds, memes valeurs).
 *
 * Les deux couches (2026-10-08, l'etape R3, audio/kit.ts) : le son d'un coup
 * est sa couche SYNTH et sa couche SAMPLE, calculees ensemble (shotsdsp.ts
 * renderLayers) ; le reste de la voix ne change pas (DECAY, VOL, PAN, la
 * tranche, le kick monophonique, son bus). Un verrou de MACHINE, d'un
 * potard, d'un echantillon ou d'une couche donne un ShotOverride (kitOverride).
 */

import limiterUrl from './limiter.worklet.js?url';
import glueUrl from './glue.worklet.js?url';
import { FLAGS } from '../state/flags';
import type { Inst } from '../theme';
import { CHORUS_DEPTH, buildChorus, loadChorus, type ChorusInfo, type ChorusStage } from './chorus';
import { DIST_OPEN_HZ, IR_DEFAULT, buildDrive, buildFx, glide, type DriveStage, type FxChain, type IrShape } from './fx';
import { DFB_DEFAULT, DTIME_DEFAULT, FX_SETTINGS, delayDiv, delayFb, fxLaw, pattern, type Fx, type FxSettingId, VEL_GAIN, INSTRUMENTS, STEP_COUNT, velocity } from './pattern';
import { kit, type KitKnob, type KitKnobs, type KitModel, type KitOverride, type Layer } from './kit';
import { sampleByKey } from './samples';
import { KIT_LOCK_IDS, LAYER_LOCK_IDS, lockOf, parseSnd, type KitLockId, type LayerLockId, type Locks, type StepLock } from './locks';
import { DELAY_TONE_HZ, buildDelayBus, buildReverbBus, type BusInfo, type DelayBus, type LockSend, type ReverbBus, type Send, type SendBus, type SendInfo } from './sends';
import { hitTime, snapTime } from './time';
import { buildTone, pitchFactor, snapTone, toneHpHz, toneLpHz, type ToneInfo, type ToneStage } from './tone';
import { shots, type ShotId, type ShotOverride } from './shots';
import { Ducker, duckCurve, kickEnvelope, type KickPlay } from './duck';
import {
  DECAY_HOLD_S,
  FENV_OCT,
  START_MAX,
  VOICE_FX_DEFAULT,
  atkS,
  cutHz,
  decayTau,
  fatkS,
  fdecTau,
  filterIndex,
  filterOpen,
  fineFactor,
  holdS,
  resoQ,
  tuneFactor,
  voiceFx,
  voiceGain,
  type VoiceFx,
  type VoiceParam,
} from './voicefx';
import { InsertLocks } from './lockfx';

type Ctor = typeof AudioContext;

/** La tranche d'une voix : son niveau, ses inserts, ses envois. */
interface Channel {
  input: GainNode;
  tone: ToneStage;
  drive: DriveStage;
  chorus: ChorusStage;
  out: GainNode;
  reverb: LockSend;
  delay: LockSend;
  /** les verrous DIST et CHORUS de la voix (2026-10-09, audio/lockfx.ts) */
  distLocks: InsertLocks;
  chorusLocks: InsertLocks;
}

interface Graph {
  ctx: BaseAudioContext;
  bus: GainNode;
  tone: ToneStage;
  /** le TONE du kick (2026-10-08) : le kick ne prend que lui des effets GLOBAL ; null sans tranches */
  kickTone: ToneStage | null;
  chorus: ChorusStage;
  level: GainNode;
  comp: DynamicsCompressorNode;
  analyser: AnalyserNode;
  master: GainNode;
  /** l'ecreteur doux de secours (avant que le limiteur soit charge, ou sans AudioWorklet) */
  clipPre: GainNode;
  /** le limiteur a anticipation (audio/limiter.worklet.js), une fois charge */
  limiter: AudioWorkletNode | null;
  /**
   * La sortie finale avant MASTER (2026-10-04) : apres le limiteur (ou
   * l'ecreteur de secours tant qu'il n'est pas charge), un point fixe ou le
   * vumetre master du MM-DECKS mesure ce qui sort vraiment (synthPort().out).
   */
  post: GainNode;
  /** DIST du bus */
  fx: FxChain;
  /** REVERB et DELAY partages, et les envois de tout le pattern (apres LEVEL) */
  reverb: ReverbBus;
  delay: DelayBus;
  reverbSend: Send;
  delaySend: Send;
  /** tranches des voix (null : reference sans effets, rendu hors ligne) */
  ch: Record<Inst, Channel> | null;
  /**
   * La sortie de chaque machine (2026-10-04), sec et effets compris : le
   * MM-RYTM (apres son compresseur, avec sa REVERB et son DELAY) et le
   * MM-ARP (son moteur, son delay, sa REVERB a lui). Branchees sur le master
   * par defaut ; le mixer du MM-DECKS les prend sur ses canaux 1 et 2
   * (routeMachines).
   */
  rytmOut: GainNode;
  /** BIT et COMP (2026-10-10, audio/glue.worklet.js) : tout le MM-RYTM y passe avant sa prise ; null tant qu'il charge */
  glueIn: GainNode;
  glue: AudioWorkletNode | null;
  arpOut: GainNode;
  /** la prise du MM-BASS (2026-10-07) : sa voie du mixer du MM-DECKS peut la prendre */
  bassOut: GainNode;
  /** SIDECHAIN du MM-BASS (2026-10-10) : son moteur entre ici, puis bassOut ; seul bassDuck automatise ce gain */
  bassIn: GainNode;
  arpReverb: SendBus;
  /** les envois REVERB et DELAY des voix partent apres MASTER (LEVEL) : MASTER baisse aussi leurs queues */
  taps: GainNode[];
  /** SIDECHAIN du MM-ARP (2026-10-04, audio/duck.ts) : le gain de arpOut baisse a chaque kick */
  duck: Ducker;
  /** SIDECHAIN du MM-BASS (2026-10-10) : le gain de bassIn baisse aux memes kicks */
  bassDuck: Ducker;
}

export interface TriggerInfo {
  inst: Inst;
  open: boolean;
  /** instant programme (temps du contexte) */
  when: number;
  /** performance.now() de l'appel (ordre son / animation) */
  at: number;
  state: AudioContextState;
  /** les verrous du pas joues par ce coup (2026-10-08), null sans verrou */
  lock: Readonly<StepLock> | null;
  /** le DECAY du coup (celui de la voix, ou son verrou) */
  decay: number;
  /** son gain en plus de la tranche : la velocite, fois le VOL verrouille rapporte a celui de la voix */
  gain: number;
  /** le son calcule (celui de la voix, ou d'une autre famille : un sample lock) */
  shot: ShotId;
  /** sa hauteur (TONE, TUNE) et son PAN, son START */
  pf: number;
  pan: number;
  start: number;
}

/**
 * Une voix programmee : ses sources et tous ses noeuds. L'horloge garde
 * celles qui n'ont pas encore sonne pour les annuler au STOP.
 */
export interface Voice {
  when: number;
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  /** un kick : ce qu'il joue (le SIDECHAIN du MM-ARP s'y cale) */
  kick?: KickPlay;
  /** un charley : le charley ouvert qu'il etouffe a `when` (une annulation le lui rend, 2026-10-05) */
  choked?: { gate: GainNode; end: number };
  /** un charley ouvert : sa porte */
  gate?: GainNode;
  /** un kick : le kick d'avant qu'il coupe (une annulation le lui rend), et sa porte a lui (2026-10-08) */
  bdChoked?: { gate: GainNode; end: number };
  bdGate?: GainNode;
  /** les envois de sa tranche ou ce coup a pose un point (les verrous DELAY et REVERB, revue de R2) : retires a l'annulation */
  sends?: LockSend[];
  /** les inserts de sa tranche ou ce coup a pose un point (les verrous DIST et CHORUS, 2026-10-09) */
  inserts?: InsertLocks[];
}

/**
 * L'ancien compresseur de la batterie (reglable par les tests, __v4.audio.comp). Hors du chemin depuis le
 * 2026-10-08 (Mika : "le kick est la reference, tout ce qu'il y a apres doit etre moins fort ; ensuite je
 * rattrape au master") : le DynamicsCompressorNode de Chrome ajoute d'office un gain de compensation (+3,7 dB
 * sous -14 dBFS) et comprimait le kick, les autres voix remontaient d'autant ; le noeud reste cree, debranche.
 */
const COMP = { threshold: -14, knee: 10, ratio: 3, attack: 0.004, release: 0.15 };
/** Un charley (ferme ou ouvert) coupe le charley ouvert qui sonne encore, en 8 ms (choke 808). */
const CHOKE_S = 0.008;
/**
 * Le kick monophonique (2026-10-08, Mika : "mon kick a l'air double") : un
 * kick coupe la queue du precedent en 3 ms, juste avant de frapper, comme une
 * 909 ou un sampler en mode mono. Avant, la queue du 909 (-13 dB au temps
 * suivant a 130 BPM) sonnait sous le nouveau coup : deux 52 Hz de phases
 * differentes qui battaient (12 Hz, puis 6, 2...) a chaque kick.
 */
const BD_CHOKE_S = 0.003;

let ctx: AudioContext | undefined;
let graph: Graph | undefined;
let created = 0;
let triggers = 0;
let last: TriggerInfo | null = null;
/** TONE : -1 a 1, 0 = bypass (revision 5) */
let tone = 0;
/** STRETCH : -1 a 1, 0 = duree d'origine (2026-10-01, audio/time.ts) */
/** STRETCH garde dans le navigateur (2026-10-11 : il repartait a 0 a chaque rechargement). */
const STRETCH_KEY = 'mm.v4.rytm.stretch.1';
let stretch = ((): number => {
  try {
    const v = Number(window.localStorage.getItem(STRETCH_KEY));
    return Number.isFinite(v) ? snapTime(v) : 0;
  } catch {
    return 0;
  }
})();
let stretchTimer = 0;
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
  /** DLY TIME et DLY FB (2026-10-09) ; absents : ceux du store */
  dtime?: number;
  dfb?: number;
  /** les reglages des FX (2026-10-10, 0 a 1, FX_SETTINGS) imposes, les autres a leur depart ; absent : ceux du store */
  fxs?: Partial<Record<FxSettingId, number>>;
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

/**
 * Les reglages des FX globaux en valeurs reelles (2026-10-10, pattern.ts
 * fxLaw : Hz, s, facteur, diviseur). A sa valeur de depart, chacun rend
 * EXACTEMENT la constante d'avant (la loi la donne a 0.1 % pres : 4502 Hz,
 * 2.4017 s, x0.9993, 2.994 ms...) : un motif qui n'y touche pas sonne au bit
 * pres comme avant ; un cran a cote, la loi.
 */
const FX_BEFORE: Readonly<Record<FxSettingId, number>> = {
  dtone: DELAY_TONE_HZ,
  rsize: IR_DEFAULT.seconds,
  rtone: IR_DEFAULT.hiEnd,
  rpre: IR_DEFAULT.preDelay,
  xtone: DIST_OPEN_HZ,
  crate: 1,
  cdepth: CHORUS_DEPTH,
  brate: 1,
  catk: 0.003,
  crel: 0.12,
};
const fxValue = (f: Readonly<Partial<Fx>>, k: FxSettingId): number => {
  const v = f[k] ?? FX_SETTINGS[k];
  return Math.abs(v - FX_SETTINGS[k]) < 1e-6 ? FX_BEFORE[k] : fxLaw[k](v);
};
/** REVERB SIZE, TONE et PRE : la forme de la reponse (fx.ts makeImpulse). */
const irShapeOf = (f: Readonly<Partial<Fx>>): IrShape => ({ seconds: fxValue(f, 'rsize'), hiEnd: fxValue(f, 'rtone'), preDelay: fxValue(f, 'rpre') });

/** Les reglages des FX de f poses sur le graphe (chaque setter ne fait rien si rien ne change). */
function applyFxSettings(g: Graph, f: Readonly<Fx>): void {
  g.delay.setTone(fxValue(f, 'dtone'));
  g.reverb.setShape(irShapeOf(f));
  g.fx.setTone(fxValue(f, 'xtone'));
  // Le chorus du bus seul (ceux des voix et du MM-ARP gardent leurs vitesses)
  g.chorus.setMod?.(fxValue(f, 'crate'), fxValue(f, 'cdepth'));
  if (g.glue) setGlue(g.glue, f);
}

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

/**
 * La sortie du MM-RYTM. -2 dB jusqu'au 2026-10-07, 0 dB le 2026-10-07 ;
 * depuis le 2026-10-08 (Mika : "je descends le tout de -12 dB, le kick est
 * la reference ; tout ce qu'il y a apres est plus bas ; ensuite je
 * rattrape dans ma tranche master"), mesure en sortie reelle (les trois
 * machines sommees, avant MASTER) : sans compresseur, les voix gardent leurs
 * ecarts au kick (shotsdsp.ts SHOT_BELOW : snare -1,5 dB, clap -3,5, toms,
 * charleys, cymbale -5,5 a -7), la basse et l'ARP sont 2 a 3 dB plus bas que
 * lui, et le tout est rattrape de -3 dB (ici, bass.worklet.js, synth.ts) :
 * le kick sort vers -9 dBFS, le mix le plus dense crete vers -1,7 dBFS, sous
 * le plafond du limiteur (-0,3 dBFS), qui ne touche plus au kick.
 */
/*
 * 2026-10-10 (Mika, le VU du MIXER : "le volume de RYTM et ARP sont pareils mais RYTM est bien plus fort ; je ne
 * veux pas que ca monte dans le rouge") : mesure sur la voie du MIXER (motif et patch de depart, sans son), le
 * MM-RYTM cretait a -2.7 dBFS, l'ARP a -13.4. Le MM-RYTM descend de 2.5 dB (0.71 avant), le kick de 1.5 dB de
 * plus (shotsdsp.ts SHOT_BELOW.BD), l'ARP monte de 5 dB (synth.ts VOLUME_K) : les deux se lisent pareil, loin du rouge.
 */
const RYTM_TRIM = 0.53;

function build(c: BaseAudioContext, o: BuildOpts = {}): Graph {
  const bus = c.createGain();
  bus.gain.value = 1;
  const lvl = c.createGain();
  lvl.gain.value = level * level;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = COMP.threshold;
  comp.knee.value = COMP.knee;
  comp.ratio.value = COMP.ratio;
  comp.attack.value = COMP.attack;
  comp.release.value = COMP.release;
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
  // Plus de compresseur (2026-10-08) : LEVEL va droit a la prise du MM-RYTM, les ecarts au kick restent ceux voulus
  // Chaque machine sort par sa propre prise (le mixer du MM-DECKS peut la prendre).
  // Le MM-RYTM y gardait 2 dB de marge (2026-10-04, la voie 1 du MM-DECKS s'allumait) ;
  // a 0 dB depuis le 2026-10-07 : ses voix sous le kick, il crete sous -1 dBFS
  const rytmOut = c.createGain();
  rytmOut.gain.value = RYTM_TRIM;
  const arpOut = c.createGain();
  const bassOut = c.createGain();
  rytmOut.connect(analyser);
  arpOut.connect(analyser);
  bassOut.connect(analyser);
  // SIDECHAIN du MM-BASS (2026-10-10) : le moteur entre par un gain a lui (le Ducker n'y croise aucune autre automation)
  const bassIn = c.createGain();
  bassIn.connect(bassOut);
  // BIT et COMP (2026-10-10) : le sec, la REVERB et le DELAY du MM-RYTM passent par glueIn, puis sa prise
  const glueIn = c.createGain();
  glueIn.connect(rytmOut);
  lvl.connect(glueIn);
  analyser.connect(clipPre);
  const post = c.createGain();
  clipper.connect(post);
  post.connect(master);
  master.connect(c.destination);
  const f = pattern.fx.get();
  // Les reglages des FX (2026-10-10) : ceux du store, ou hors ligne ceux imposes (les autres a leur depart)
  const fs: Readonly<Fx> = o.fxs ? { ...f, ...FX_SETTINGS, ...o.fxs } : f;
  const direct = { direct: true, linked: false, dry: 1, wet: 0, unlinks: 0 };
  let toneSt: ToneStage;
  let chorusSt: ChorusStage;
  /**
   * Le kick hors des effets GLOBAL (2026-10-08, Mika : "quand j'utilise juste
   * MM-RYTM, j'ai l'impression que mon kick a un chorus, qu'il est double ; je
   * veux un bon kick") : le CHORUS du bus (un insert) posait sur le kick une
   * copie retardee de 7 a 28 ms qui changeait a chaque coup, la REVERB et le
   * DELAY partaient de LEVEL kick compris, DIST le gonflait ; les presets
   * d'usine les allumaient. Le kick a sa voie : le TONE du pattern seulement,
   * puis LEVEL ; les autres voix (pads) gardent DIST, TONE, CHORUS et les
   * envois du pattern. Ses effets a lui restent possibles (la rangee VOICE sur
   * BD). Au repos (tout a 0), rien ne change : le meme chemin, le meme niveau.
   */
  const pads = c.createGain();
  const kickBus = c.createGain();
  let kickTone: ToneStage | null = null;
  if (o.bare) {
    toneSt = { input: lvl, set: () => undefined, reset: () => undefined, info: () => ({ value: 0, semitones: 0, hpHz: 0, lpHz: 0, insert: direct }) };
    chorusSt = { input: lvl, set: () => undefined, value: () => 0, reset: () => undefined, info: () => ({ value: 0, live: false, built: 0, insert: direct }) };
    pads.connect(lvl);
  } else {
    chorusSt = buildChorus(c, pads);
    // CHORUS RATE et DEPTH (2026-10-10) : poses avant sa premiere branche
    chorusSt.setMod?.(fxValue(fs, 'crate'), fxValue(fs, 'cdepth'));
    toneSt = buildTone(c, chorusSt.input, o.tone ?? tone);
    pads.connect(lvl);
    kickTone = buildTone(c, lvl, o.tone ?? tone);
    kickBus.connect(kickTone.input);
  }
  const fx = buildFx(c, { bus, tone: toneSt.input }, o.drive ?? f.drive, fxValue(fs, 'xtone'));

  // REVERB et DELAY de la boite ; les envois du pattern partent des pads (LEVEL applique : le gain level², comme les
  // envois des voix), plus du kick depuis le 2026-10-08. Le MM-ARP a sa REVERB a lui (sa forme d'avant, toujours)
  const reverb = buildReverbBus(c, glueIn, irShapeOf(fs));
  const delay = buildDelayBus(c, glueIn, stepOf(o.bpm ?? pattern.get().bpm), delayDiv(o.dtime ?? f.dtime).steps, delayFb(o.dfb ?? f.dfb), fxValue(fs, 'dtone'));
  const arpReverb = buildReverbBus(c, arpOut);
  const taps: GainNode[] = [];
  const padsSend = c.createGain();
  padsSend.gain.value = level * level;
  pads.connect(padsSend);
  taps.push(padsSend);
  const reverbSend = reverb.attach(padsSend);
  const delaySend = delay.attach(padsSend);

  // Tranches des voix : LEVEL -> TONE -> DIST -> CHORUS -> bus (le kick : sa voie), et leurs envois
  let ch: Record<Inst, Channel> | null = null;
  if (!o.bare) {
    const out = {} as Record<Inst, Channel>;
    for (const inst of INSTRUMENTS) {
      const chOut = c.createGain();
      chOut.connect(inst === 'BD' ? kickBus : bus);
      const chChorus = buildChorus(c, chOut);
      const chDrive = buildDrive(c, chChorus.input);
      const chTone = buildTone(c, chDrive.input, 0);
      const chIn = c.createGain();
      chIn.gain.value = 1;
      chIn.connect(chTone.input);
      // Ses envois apres MASTER (2026-10-04, Mika : "meme quand je baisse le master on entend le CP")
      const tap = c.createGain();
      tap.gain.value = level * level;
      chOut.connect(tap);
      taps.push(tap);
      out[inst] = {
        input: chIn,
        tone: chTone,
        drive: chDrive,
        chorus: chChorus,
        out: chOut,
        reverb: reverb.attach(tap),
        delay: delay.attach(tap),
        distLocks: new InsertLocks(c, chDrive),
        chorusLocks: new InsertLocks(c, chChorus),
      };
    }
    ch = out;
  }

  const duck = new Ducker(c, arpOut.gain);
  const bassDuck = new Ducker(c, bassIn.gain);
  const g: Graph = { ctx: c, bus, tone: toneSt, kickTone, chorus: chorusSt, level: lvl, comp, analyser, master, clipPre, limiter: null, post, fx, reverb, delay, reverbSend, delaySend, ch, rytmOut, glueIn, glue: null, arpOut, bassOut, bassIn, arpReverb, taps, duck, bassDuck };
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
  // Un reglage tourne efface ce qui etait programme sur l'insert : ses verrous a venir reviennent d'eux-memes (onRetime, audio/lockfx.ts)
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

/** Facteur d'etirement des coups : STRETCH du pattern (exactement 1 a 0) ; la voix a DECAY depuis le 2026-10-04. */
const voiceTime = (globalStretch: number): number => hitTime(globalStretch, 0);

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
    graph.arpReverb.revive();
    return ctx;
  }
  const C = getCtor();
  if (!C) return undefined;
  try {
    /*
     * 'balanced' et non plus 'interactive' (2026-10-04, Mika : "le son
     * gresille, comme Ableton quand le CPU sature") : 'interactive' prend le
     * plus petit tampon de la carte son (128 echantillons, 2.7 ms sur un
     * Mac), et le moindre pic de calcul (le synthe surechantillonne, les
     * reverbes, la 3D qui chauffe le processeur) craquait. 'balanced' :
     * environ 10 ms, quatre fois plus de marge, a peine plus de latence au
     * toucher.
     */
    ctx = new C({ latencyHint: 'balanced' });
  } catch {
    try {
      ctx = new C();
    } catch {
      return undefined;
    }
  }
  created += 1;
  graph = build(ctx);
  // Les verrous DIST et CHORUS du motif deja la (2026-10-09) : leurs inserts tenus engages des le premier coup
  holdInserts(graph, pattern.get().locks);
  // iPhone (Safari 17+) : une session de lecture, la musique ne s'efface pas pour un son du systeme (2026-10-05)
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    /* pas de session audio : rien */
  }
  // Les reverbes construites d'avance, en temps libre : leur premier tour ne gele plus la musique (2026-10-05)
  const g0 = graph;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const warmSends = (): void => {
    if (graph !== g0) return;
    g0.reverb.warm();
    g0.arpReverb.warm();
  };
  if (ric) ric(warmSends, { timeout: 3000 });
  else window.setTimeout(warmSends, 1500);
  // Les one-shots a STRETCH 0, un par tache (audio/shots.ts)
  shots.warm(ctx.sampleRate);
  // Les verrous deja la avant le contexte (revue de R2 : relus du stockage, d'un preset ou d'un pattern avant le
  // premier RUN) : prepares eux aussi, sinon leur premier passage jouait le son le plus proche (celui du kit)
  prepareLocks();
  // Le chorus sans interpolation lineaire (audio/chorus.worklet.js) : pret pour la premiere branche
  void loadChorus(ctx);
  attachLimiter(ctx, graph);
  attachGlue(ctx, graph);
  return ctx;
}

/** BIT et COMP (2026-10-10) : le worklet prend place entre glueIn et la prise du MM-RYTM des qu'il est pret. */
function attachGlue(c: BaseAudioContext, g: Graph): void {
  if (!c.audioWorklet) return;
  c.audioWorklet
    .addModule(glueUrl)
    .then(() => {
      const node = new AudioWorkletNode(c, 'mm-glue', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      setGlue(node, pattern.fx.get());
      node.connect(g.rytmOut);
      g.glueIn.connect(node);
      g.glueIn.disconnect(g.rytmOut);
      g.glue = node;
    })
    .catch(() => {
      /* sans worklet : le MM-RYTM sort sans BIT ni COMP */
    });
}

function setGlue(node: AudioWorkletNode, f: Readonly<Fx>): void {
  const t = node.context.currentTime;
  node.parameters.get('bits')?.setValueAtTime(Math.max(0, Math.min(1, f.bits ?? 0)), t);
  node.parameters.get('comp')?.setValueAtTime(Math.max(0, Math.min(1, f.comp ?? 0)), t);
  // BIT RATE (le diviseur), COMP ATTACK et RELEASE (s) (2026-10-10, leurs pages) : 1, 3 ms et 120 ms au depart
  node.parameters.get('rate')?.setValueAtTime(fxValue(f, 'brate'), t);
  node.parameters.get('atk')?.setValueAtTime(fxValue(f, 'catk'), t);
  node.parameters.get('rel')?.setValueAtTime(fxValue(f, 'crel'), t);
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
      node.connect(g.post);
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
  graph?.arpReverb.silence();
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
 * rejoint l'analyseur, APRES le compresseur de la batterie (2026-10-04 :
 * avant, chaque kick y faisait baisser l'arpege de plusieurs dB, un
 * pompage net dans des intra-auriculaires), puis le limiteur et le master
 * (?mute=1 tient). null avant le premier geste.
 * - input : l'entree du master (la sortie du mixer du MM-DECKS y va) ;
 * - out : la sortie apres le limiteur, avant MASTER (le vumetre master du
 *   MM-DECKS la mesure ; ?mute=1 n'y change rien, MASTER est apres) ;
 * - arp : la prise du MM-ARP (2026-10-04) ; le synthe y sort, et sa REVERB
 *   (reverb, a lui depuis le 2026-10-04 : le canal 2 du mixer la coupe
 *   avec lui) ; delay : celui de la boite (inutilise par le synthe).
 */
export interface SynthPort {
  ctx: AudioContext;
  input: AudioNode;
  arp: AudioNode;
  /** la prise du MM-BASS (2026-10-07) ; depuis le 2026-10-10 son entree bassIn (le gain du SIDECHAIN), puis bassOut */
  bass: AudioNode;
  /** la sortie apres le limiteur, avant MASTER (vumetre master du MM-DECKS) */
  out: AudioNode;
  reverb: SendBus;
  delay: DelayBus;
}

export function synthPort(): SynthPort | null {
  if (!ctx || !graph) return null;
  return { ctx, input: graph.analyser, arp: graph.arpOut, bass: graph.bassIn, out: graph.post, reverb: graph.arpReverb, delay: graph.delay };
}

/** Les prises des machines (un MM-RYTM, un MM-BASS, un MM-ARP). */
export interface MachineOuts {
  rytm: AudioNode;
  bass: AudioNode;
  arp: AudioNode;
}

/** La sortie complete de chaque machine (sec et effets) ; null avant le premier geste. */
export function machineOuts(): MachineOuts | null {
  return graph ? { rytm: graph.rytmOut, bass: graph.bassOut, arp: graph.arpOut } : null;
}

/** Ou vont les machines : le mixer du MM-DECKS, ou null (le master). */
let routed: MachineOuts | null = null;

/**
 * Le mixer du MM-DECKS prend les trois machines sur ses voies 1 (MM-RYTM),
 * 2 (MM-BASS, 2026-10-07) et 3 (MM-ARP) : leurs prises quittent le master
 * pour ses entrees ; null les rend au master.
 */
export function routeMachines(to: MachineOuts | null): void {
  if (!graph) return;
  const g = graph;
  // Seule l'ancienne destination est debranchee : les prises de l'oscilloscope (scopeTaps) restent
  const was = routed ?? { rytm: g.analyser, bass: g.analyser, arp: g.analyser };
  for (const [out, from, dest] of [
    [g.rytmOut, was.rytm, to?.rytm],
    [g.bassOut, was.bass, to?.bass],
    [g.arpOut, was.arp, to?.arp],
  ] as const) {
    // La nouvelle prise d'abord, l'ancienne ensuite : pas un instant sans son (2026-10-05)
    const next = dest ?? g.analyser;
    if (next === from) continue;
    out.connect(next);
    try {
      out.disconnect(from);
    } catch {
      /* deja debranchee */
    }
  }
  routed = to;
}

/**
 * Les points de mesure de l'oscilloscope (2026-10-04, ui/Scope.tsx) : la
 * sortie de chaque machine (seche et effets), le kick seul (la sortie de sa
 * tranche, avant le bus), et ce qui sort du site (apres le limiteur, avant
 * MASTER). null avant le premier geste.
 */
export function scopeTaps(): { ctx: AudioContext; rytm: AudioNode; arp: AudioNode; kick: AudioNode | null; master: AudioNode } | null {
  if (!ctx || !graph) return null;
  return { ctx, rytm: graph.rytmOut, arp: graph.arpOut, kick: graph.ch?.BD.out ?? null, master: graph.post };
}

/* ---------------- voix (spec 8.2) ---------------- */

/** La porte du dernier charley ouvert et la fin de son enveloppe (choke). */
let ohGate: GainNode | null = null;
let ohEnd = 0;
/** La porte du dernier kick et la fin de son echantillon (le kick monophonique). */
let bdGate: GainNode | null = null;
let bdEnd = 0;

/** Coupe le kick qui sonne encore : la porte tombe en 3 ms et finit a `when` (des que possible si c'est deja passe). */
function chokeBD(when: number, now: number): void {
  if (!bdGate || bdEnd <= when) return;
  const t0 = when - BD_CHOKE_S >= now ? when - BD_CHOKE_S : when;
  bdGate.gain.setValueAtTime(1, t0);
  bdGate.gain.linearRampToValueAtTime(0, t0 + BD_CHOKE_S);
  bdGate = null;
}

/** Ferme le charley ouvert qui sonne encore a `when` (le suivant le coupe). */
function chokeOH(when: number): void {
  if (!ohGate || ohEnd <= when) return;
  ohGate.gain.setValueAtTime(1, when);
  ohGate.gain.linearRampToValueAtTime(0, when + CHOKE_S);
  ohGate = null;
}

/* ---------------- un coup et ses verrous (2026-10-08) ---------------- */

/**
 * Ce que joue un coup (2026-10-08, l'etape R2 des parameter locks) : son
 * son calcule (id, et son ShotOverride s'il vient d'un verrou), sa hauteur
 * (TONE du pattern et de la voix, TUNE de la voix ou du pas), son STRETCH,
 * son DECAY, son gain en plus de la velocite (VOL du pas rapporte a celui de
 * la voix, au plus x4 ; une voix a VOL 0 reste muette, sa tranche est a 0),
 * son PAN, son START. Le meme calcul pour le direct (trigger) et le rendu
 * hors ligne (renderOffline) : ce que les tests mesurent est ce qu'on entend.
 */
export interface HitParams {
  id: ShotId;
  ov: ShotOverride | null;
  /** un coup de kick (la voie BD qui joue un kick : le SIDECHAIN du MM-ARP s'y cale) */
  kick: boolean;
  pf: number;
  ts: number;
  decay: number;
  gain: number;
  pan: number;
  start: number;
  /** l'attaque et la tenue de l'enveloppe du coup, en secondes (ENV ATK et HOLD, 2026-10-09 ; 0 et 4 ms : le coup d'avant) */
  atk: number;
  hold: number;
  /** le filtre du coup (FLTR, 2026-10-09) ; null : aucun (passe-bas ouvert sans enveloppe, le son d'avant) */
  filter: HitFilter | null;
  /**
   * le TONE verrouille du pas (2026-10-09) : le coup ne passe pas par le
   * TONE de la tranche (sa valeur de voix), il porte le sien ; null : la
   * tranche, comme avant
   */
  tone: number | null;
}

/** Le filtre d'un coup : son type, sa coupure (Hz), son Q, son enveloppe (octaves au sommet, attaque, constante de descente). */
export interface HitFilter {
  type: BiquadFilterType;
  hz: number;
  q: number;
  oct: number;
  atk: number;
  tau: number;
}

const FILTER_KIND: readonly BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass'];

/** Le filtre d'un coup d'apres les reglages de la voix et les verrous du pas (null : rien a filtrer). */
function hitFilter(fx: Readonly<VoiceFx>, lock: Readonly<StepLock> | null): HitFilter | null {
  const type = lock?.ftype ?? fx.ftype;
  const cut = lock?.fcut ?? fx.fcut;
  const env = lock?.fenv ?? fx.fenv;
  if (filterOpen(type, cut, env)) return null;
  return {
    type: FILTER_KIND[filterIndex(type)],
    hz: cutHz(cut),
    q: resoQ(lock?.freso ?? fx.freso),
    oct: env * FENV_OCT,
    atk: fatkS(lock?.fatk ?? fx.fatk),
    tau: fdecTau(lock?.fdec ?? fx.fdec),
  };
}

/** Le potard du kit de chaque verrou de la machine (revue de R2 ; SWEEP et la caisse claire depuis R3). */
const KNOB_OF: Readonly<Record<KitLockId, KitKnob>> = {
  ktune: 'tune',
  kattack: 'attack',
  kdecay: 'decay',
  kdrive: 'drive',
  snappy: 'snappy',
  gate: 'gate',
  ksweep: 'sweep',
  sdtune: 'sdtune',
  sddecay: 'sddecay',
  sdtone: 'sdtone',
};
/** Le reglage de couche de chaque verrou de couche (R3). */
const LAYER_OF: Readonly<Record<LayerLockId, keyof Layer>> = { syn: 'syn', slev: 'lev', stune: 'tune', sfine: 'fine', sstart: 'start', slen: 'len', srev: 'rev' };
const MACHINES: readonly string[] = ['909', '808', 'mm'];

/**
 * Ce qu'un pas change au kit de sa voix (R2, R3) : la MACHINE, des potards,
 * l'echantillon de la couche SAMPLE (un sample lock ; off : muette), des
 * reglages de couche ; null : rien (le coup du kit, ou seulement des verrous
 * joues par la voix : VOL, DEC, PAN...).
 */
export function kitOverride(lock: Readonly<StepLock>): KitOverride | null {
  let ov: KitOverride | null = null;
  if (lock.mach && MACHINES.includes(lock.mach)) ov = { model: lock.mach as KitModel };
  let kn: KitKnobs | null = null;
  for (const id of KIT_LOCK_IDS) {
    const v = lock[id];
    if (v === undefined) continue;
    kn = kn ?? {};
    kn[KNOB_OF[id]] = v;
  }
  if (kn) ov = { ...(ov ?? {}), knobs: kn };
  let ly: Partial<Layer> | null = null;
  for (const id of LAYER_LOCK_IDS) {
    const v = lock[id];
    if (v === undefined) continue;
    ly = ly ?? {};
    ly[LAYER_OF[id]] = v;
  }
  if (ly) ov = { ...(ov ?? {}), layer: ly };
  if (lock.snd) {
    const p = parseSnd(lock.snd);
    // Un echantillon parti du dossier : le pas joue celui de la voix (le verrou reste, il reviendra avec lui)
    if (p && p.sound === 'off') ov = { ...(ov ?? {}), sample: null };
    else if (p && sampleByKey(p.sound)) ov = { ...(ov ?? {}), sample: p.sound };
  }
  return ov;
}

export function hitParams(inst: Inst, open: boolean, lock: Readonly<StepLock> | null, globalTone: number, globalStretch: number, fx: Readonly<VoiceFx>): HitParams {
  const base: ShotId = inst === 'CH' && open ? 'CHopen' : inst;
  const tune = lock?.tune ?? fx.tune;
  // TONE et FINE du pas (2026-10-09) : sa hauteur ; TONE verrouille passe aussi son filtre au coup (tone)
  const toneV = lock?.tone ?? fx.tone;
  const pf = voicePitch(inst, globalTone, toneV) * tuneFactor(tune) * fineFactor(lock?.fine ?? fx.fine);
  const hp: HitParams = {
    id: base,
    ov: null,
    kick: inst === 'BD',
    pf,
    ts: voiceTime(globalStretch),
    decay: lock?.decay ?? fx.decay,
    gain: 1,
    pan: lock?.pan ?? fx.pan,
    start: lock?.start ?? fx.start,
    atk: atkS(lock?.atk ?? fx.atk),
    hold: holdS(lock?.hold ?? fx.hold),
    filter: hitFilter(fx, lock),
    tone: lock?.tone !== undefined ? lock.tone : null,
  };
  if (!lock) return withPanGain(hp);
  // Ce que le pas change au kit (R2, R3) : le coup se calcule avec (la variante 0, prepare a l'avance)
  const ko = kitOverride(lock);
  if (ko) {
    hp.ov = { tw: kit.tweakWith(base, ko), sig: kit.sigWith(base, ko) };
    // Un echantillon d'une autre famille, seul, sur la voie du kick n'est pas un kick (2026-10-08, R2)
    if (inst === 'BD') hp.kick = kit.kickWith(ko);
  } else if (lock.tune !== undefined || lock.fine !== undefined || lock.tone !== undefined) {
    // Une hauteur verrouillee (TUNE ; FINE et TONE depuis le 2026-10-09) : la variante 0 (le calcul prepare a l'avance est celui-la)
    hp.ov = { tw: kit.tweak(base), sig: kit.sig(base) };
  }
  if (lock.level !== undefined) {
    // Le gain du verrou rapporte a celui de la voix (sa tranche l'applique ensuite) : le niveau exact du VOL
    // verrouille (revue de R2 : le plafond de x4 jouait VOL 80 pour un verrou a 100 sur une voix a 40) ; une
    // voix a VOL 0 reste muette (sa tranche est a 0, le rapport n'y change rien)
    const was = voiceGain(fx.level);
    hp.gain = was > 1e-6 ? voiceGain(lock.level) / was : 1;
  }
  return withPanGain(hp);
}

/** Le PAN hors du centre : le coup passe en mono a puissance constante, x racine de 2 (le niveau du centre). */
const withPanGain = (hp: HitParams): HitParams => {
  if (hp.pan !== 0) hp.gain *= Math.SQRT2;
  return hp;
};

/**
 * Un coup (2026-10-03, les one-shots, audio/shots.ts) : l'echantillon de
 * la voix (sa variante, son STRETCH, sa hauteur TONE : calcule a la bonne
 * hauteur et lu a vitesse 1 depuis le 2026-10-04, comme un sampler sans
 * interpolation). Un charley, ferme ou ouvert, coupe le charley ouvert
 * qui sonne encore (choke) ; le charley ouvert passe par sa porte. `open` :
 * le pad CH tenu (CHopen).
 */
function voice(g: Graph, inst: Inst, when: number, dest: AudioNode, hp: HitParams, sync = false): Voice | null {
  const c = g.ctx;
  const { decay, ts, pf } = hp;
  // Rien de pret pour ce son (le tout premier coup, avant le prechauffage) : il ne joue pas, aucun calcul ici
  const shot = shots.get(hp.id, ts, pf, c.sampleRate, sync, hp.ov);
  if (!shot) return null;
  let choked: { gate: GainNode; end: number } | undefined;
  if (inst === 'CH' || inst === 'OH') {
    if (ohGate && ohEnd > when) choked = { gate: ohGate, end: ohEnd };
    chokeOH(when);
  }
  let bdChoked: { gate: GainNode; end: number } | undefined;
  if (inst === 'BD') {
    if (bdGate && bdEnd > when) bdChoked = { gate: bdGate, end: bdEnd };
    chokeBD(when, c.currentTime);
  }
  const src = c.createBufferSource();
  src.buffer = shot.buf;
  // 1 : l'echantillon est deja a sa hauteur (aucune interpolation) ; sinon, en attendant, le plus proche relu
  src.playbackRate.value = shot.rate;
  const nodes: AudioNode[] = [src];
  // PAN (2026-10-08) : un panoramique pour ce coup, seulement hors du centre (au centre, aucun noeud de plus).
  // Le coup y entre en mono (ses deux canaux sont le meme son) : loi a puissance constante, et x racine de 2
  // (hitParams) pour que pres du centre il sonne comme sans PAN ; tout a un bord, +3 dB de ce cote (le
  // StereoPannerNode en stereo doublait le canal du bord, +6 dB)
  if (hp.pan !== 0) {
    const pn = c.createStereoPanner();
    // Un echantillon vraiment stereo (revue de R2) : le panoramique stereo (identite au centre, sa largeur
    // gardee, PAN 0.02 sonne comme PAN 0), sans le x racine de 2 de la loi mono ; un son mono : la loi mono
    const stereo = shots.isStereo(shot.buf);
    if (!stereo) {
      pn.channelCount = 1;
      pn.channelCountMode = 'explicit';
    }
    pn.pan.value = Math.max(-1, Math.min(1, hp.pan));
    pn.connect(dest);
    nodes.push(pn);
    dest = pn;
    if (stereo) {
      const comp = c.createGain();
      comp.gain.value = Math.SQRT1_2;
      comp.connect(dest);
      nodes.push(comp);
      dest = comp;
    }
  }
  // START (2026-10-08) : le coup part plus loin dans son echantillon (secondes du tampon) ; sa fin avance d'autant
  const off = hp.start > 0 ? Math.min(hp.start, 1) * START_MAX * shot.buf.duration : 0;
  const len = (shot.buf.duration - off) / shot.rate;
  // DECAY (2026-10-04) : l'attaque garde, puis la queue s'eteint plus tot ; la source s'arrete quand il n'y a plus rien.
  // ATK et HOLD (2026-10-09, la page ENV, Mika : "AMP doit s'appeler ENV et doit etre plus complet") : une rampe
  // d'attaque depuis le silence, puis la tenue avant DEC ; a 0 et 0, les 4 ms d'avant (DECAY_HOLD_S), le meme coup
  const tau = decayTau(decay);
  const atk = hp.atk;
  const holdEnd = when + atk + hp.hold;
  let stopAt = 0;
  if (tau !== null || atk > 0) {
    const env = c.createGain();
    if (atk > 0) {
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(1, when + atk);
    } else env.gain.setValueAtTime(1, when);
    if (tau !== null) env.gain.setTargetAtTime(0, holdEnd, tau);
    env.connect(dest);
    nodes.push(env);
    dest = env;
    const end = holdEnd + 7 * (tau ?? 0);
    if (tau !== null && end < when + len) stopAt = end;
  }
  // Le filtre du coup (2026-10-09, la page FLTR) : passe-bas, passe-haut ou passe-bande, sa resonance, son enveloppe
  // (la coupure monte de oct octaves en atk, puis redescend avec la constante tau) ; aucun noeud au depart
  const fl = hp.filter;
  if (fl) {
    const top = Math.min(20000, c.sampleRate * 0.45);
    const hz = (f: number): number => Math.max(20, Math.min(top, f));
    const bq = c.createBiquadFilter();
    bq.type = fl.type;
    // Le Q de Web Audio est en dB pour le passe-bas et le passe-haut (lineaire pour le passe-bande) : RESO a 0 donne alors
    // le Butterworth (0.707, aucune bosse), a fond un Q de 12
    bq.Q.value = fl.type === 'bandpass' ? fl.q : 20 * Math.log10(fl.q);
    const f0 = hz(fl.hz);
    if (fl.oct !== 0) {
      const peak = hz(fl.hz * Math.pow(2, fl.oct));
      if (fl.atk > 0) {
        bq.frequency.setValueAtTime(f0, when);
        bq.frequency.exponentialRampToValueAtTime(peak, when + fl.atk);
      } else bq.frequency.setValueAtTime(peak, when);
      bq.frequency.setTargetAtTime(f0, when + fl.atk, fl.tau);
    } else bq.frequency.value = f0;
    bq.connect(dest);
    nodes.push(bq);
    dest = bq;
  }
  let ownGate: GainNode | undefined;
  let ownBd: GainNode | undefined;
  if (inst === 'OH' || inst === 'BD') {
    const gate = c.createGain();
    gate.gain.value = 1;
    src.connect(gate);
    gate.connect(dest);
    nodes.push(gate);
    if (inst === 'OH') {
      ohGate = gate;
      ohEnd = when + len;
      ownGate = gate;
    } else {
      bdGate = gate;
      bdEnd = when + len;
      ownBd = gate;
    }
  } else src.connect(dest);
  src.onended = () => {
    for (const n of nodes) n.disconnect();
  };
  if (off > 0) src.start(when, off);
  else src.start(when);
  if (stopAt > 0) src.stop(stopAt);
  // Un kick : son enveloppe, a sa vitesse, avec son DECAY (le SIDECHAIN du MM-ARP) ; un son verrouille d'une
  // autre famille sur la voie du kick n'en est pas un (2026-10-08 : le SIDECHAIN suit les kicks, pas la voie)
  const kick = inst === 'BD' && hp.kick ? { env: kickEnvelope(shot.buf), rate: shot.rate, hold: Math.max(DECAY_HOLD_S, atk + hp.hold), tau, vel: 1, ...(off > 0 ? { off } : {}) } : undefined;
  return { when, srcs: [src], nodes, kick, choked, gate: ownGate, bdChoked, bdGate: ownBd };
}

/**
 * Joue un coup a `when` (temps du contexte ; maintenant par defaut). Ne cree
 * jamais le contexte : sans geste prealable, rien ne sonne. `open` : charley
 * ouvert (pad CH tenu ; les coups du sequenceur sont toujours fermes).
 * `out` recoit la voix programmee (l'horloge, pour pouvoir l'annuler).
 * `vel` : la velocite du pas, en gain (1 fort, 0.6 moyen, 0.32 doux).
 */
export function trigger(inst: Inst, when?: number, open = false, out?: Voice[], vel = 1, lock: Readonly<StepLock> | null = null): boolean {
  const g = graph;
  if (!g) return false;
  enforceMute(g);
  const now = g.ctx.currentTime;
  const t = when === undefined || when < now ? now : when;
  const fx = voiceFx.of(inst);
  const hp = hitParams(inst, open, lock, tone, stretch, fx);
  // Velocite (2026-10-01) : un gain de plus entre la voix et sa tranche, sous 1 ; un VOL verrouille s'y ajoute (2026-10-08)
  const gain = Math.max(0, vel) * hp.gain;
  const entry = hitEntry(g, inst, hp, fx, gain);
  const v = voice(g, inst, t, entry.dest, hp, false);
  if (!v) {
    for (const n of entry.nodes) n.disconnect();
    return false;
  }
  // Le gain (et le TONE d'un pas verrouille) part avec la voix (meme liste de noeuds a debrancher)
  v.nodes.push(...entry.nodes);
  // Les envois verrouilles du pas (revue de R2) : sur sa tranche a l'instant du coup ; DIST et CHORUS aussi (2026-10-09)
  postSends(g, inst, t, lock, v);
  postInserts(g, inst, t, lock, v);
  // Un kick : le MM-ARP et le MM-BASS (2026-10-10) s'effacent avec lui (SIDECHAIN), a sa velocite et a son VOLUME
  if (v.kick && (arpDuck > 0 || bassDuckDepth > 0)) {
    v.kick.vel = Math.max(0, vel) * Math.min(1, voiceGain(lock?.level ?? fx.level));
    if (arpDuck > 0) g.duck.add(duckCurve(t, v.kick, arpDuck), v);
    if (bassDuckDepth > 0) g.bassDuck.add(duckCurve(t, v.kick, bassDuckDepth), v);
  }
  out?.push(v);
  triggers += 1;
  last = { inst, open: inst === 'CH' && open, when: t, at: performance.now(), state: g.ctx.state as AudioContextState, lock, decay: hp.decay, gain, shot: hp.id, pf: hp.pf, pan: hp.pan, start: hp.start };
  return true;
}

/**
 * Les verrous DELAY et REVERB d'un coup (2026-10-08, revue de R2, Mika :
 * "est-ce que le voice, est-ce que le FX, est-ce que l'enveloppe") : les
 * envois de la tranche de la voix prennent la valeur du pas a l'instant du
 * coup, et la reprennent au coup suivant de la voix (verrouille ou non) ; la
 * queue deja envoyee reste. Une voix qui n'a jamais eu de verrou d'envoi ne
 * recoit rien (audio/sends.ts hit) : le son de toujours.
 */
function postSends(g: Graph, inst: Inst, when: number, lock: Readonly<StepLock> | null, v: Voice): void {
  const ch = g.ch?.[inst];
  if (!ch) return;
  const r = ch.reverb.hit(when, lock?.reverb ?? null, v);
  const d = ch.delay.hit(when, lock?.delay ?? null, v);
  if (r || d) v.sends = [...(r ? [ch.reverb] : []), ...(d ? [ch.delay] : [])];
}

/**
 * Les verrous DIST et CHORUS d'un coup (2026-10-09, audio/lockfx.ts) : les
 * inserts de la tranche prennent la valeur du pas a l'instant du coup, et la
 * gardent jusqu'au coup suivant de la voix (qui remet la sienne). Une voix
 * sans ces verrous dans le motif ne recoit rien.
 */
function postInserts(g: Graph, inst: Inst, when: number, lock: Readonly<StepLock> | null, v: Voice): void {
  const ch = g.ch?.[inst];
  if (!ch) return;
  const d = ch.distLocks.hit(when, lock?.dist ?? null, v);
  const c = ch.chorusLocks.hit(when, lock?.chorus ?? null, v);
  if (d || c) v.inserts = [...(d ? [ch.distLocks] : []), ...(c ? [ch.chorusLocks] : [])];
}

/** Les inserts DIST et CHORUS tenus engages pour les voix qui en ont un verrou dans ces verrous (le motif, un rendu). */
function holdInserts(g: Graph, locks: Readonly<Locks> | null | undefined): void {
  if (!g.ch) return;
  for (const inst of INSTRUMENTS) {
    const row = locks?.[inst];
    let dist = false;
    let chorus = false;
    if (row) {
      for (const l of Object.values(row)) {
        if (l.dist !== undefined) dist = true;
        if (l.chorus !== undefined) chorus = true;
      }
    }
    g.ch[inst].distLocks.hold(dist);
    g.ch[inst].chorusLocks.hold(chorus);
  }
}

/**
 * L'entree d'un coup dans sa voix (2026-10-09) : sa tranche (son LEVEL puis
 * son TONE), avec le gain du coup (la velocite, le VOL du pas rapporte a la
 * voix) ; un TONE verrouille sur le pas : juste apres le TONE de la tranche
 * (son DIST, son CHORUS, ses envois restent ceux de la voix), son niveau de
 * voix dans son gain et le filtre de son TONE a lui (audio/tone.ts : les
 * memes passe-haut et passe-bas, poses pour ce coup ; aucun a TONE 0).
 */
function hitEntry(g: Graph, inst: Inst, hp: HitParams, fx: Readonly<VoiceFx>, gain: number): { dest: AudioNode; nodes: AudioNode[] } {
  const c = g.ctx;
  const ch = g.ch?.[inst];
  const nodes: AudioNode[] = [];
  let dest: AudioNode = voiceIn(g, inst);
  let gn = gain;
  if (ch && hp.tone !== null) {
    dest = ch.drive.input;
    gn *= voiceGain(fx.level);
    if (hp.tone !== 0) {
      const hpF = c.createBiquadFilter();
      hpF.type = 'highpass';
      hpF.Q.value = Math.SQRT1_2;
      hpF.frequency.value = toneHpHz(hp.tone);
      const lpF = c.createBiquadFilter();
      lpF.type = 'lowpass';
      lpF.Q.value = Math.SQRT1_2;
      lpF.frequency.value = toneLpHz(hp.tone, c.sampleRate / 2);
      hpF.connect(lpF);
      lpF.connect(dest);
      nodes.push(hpF, lpF);
      dest = hpF;
    }
  }
  if (gn !== 1) {
    const vg = c.createGain();
    vg.gain.value = gn;
    vg.connect(dest);
    nodes.push(vg);
    dest = vg;
  }
  return { dest, nodes };
}

/**
 * Les coups verrouilles prepares a l'avance (2026-10-08) : un son ou une
 * hauteur verrouilles (un sample lock, TUNE) se calculent en fond des qu'ils
 * sont poses, et quand le kit, TONE, STRETCH ou la voix changent (120 ms
 * apres le dernier changement) ; le coup arrive deja pret quand son pas joue.
 */
let prepTimer = 0;
function prepareLocks(): void {
  if (!ctx || !graph || typeof window === 'undefined') return;
  window.clearTimeout(prepTimer);
  prepTimer = window.setTimeout(() => {
    prepTimer = 0;
    const c = ctx;
    if (!c) return;
    const locks = pattern.get().locks;
    for (const inst of INSTRUMENTS) {
      const row = locks[inst];
      if (!row) continue;
      const fx = voiceFx.of(inst);
      for (const l of Object.values(row)) {
        if (l.tune === undefined && l.fine === undefined && l.tone === undefined && !kitOverride(l)) continue;
        const hp = hitParams(inst, false, l, tone, stretch, fx);
        shots.prepare(hp.id, hp.ts, hp.pf, c.sampleRate, hp.ov);
      }
    }
  }, 120);
}
let prepKey = '';
pattern.subscribe(() => {
  // Seulement quand les verrous changent (pas a chaque pas pose)
  const k = JSON.stringify(pattern.get().locks);
  if (k === prepKey) return;
  prepKey = k;
  prepareLocks();
  // Les inserts DIST et CHORUS des voix qui en ont un verrou : tenus engages tout de suite (le prochain coup les trouve)
  if (graph) holdInserts(graph, pattern.get().locks);
});
kit.subscribe(() => prepareLocks());
voiceFx.subscribe(() => prepareLocks());

/**
 * Annule une voix programmee qui n'a pas encore sonne (STOP de l'horloge).
 * Un arret avant l'instant de depart : la source ne joue jamais. Les noeuds
 * sont debranches tout de suite, sans compter sur un onended (un navigateur
 * qui leverait au second stop() laisse ainsi une voix muette, pas un coup).
 */
export function cancelVoice(v: Voice): void {
  if (v.kick) {
    graph?.duck.cancel(v);
    graph?.bassDuck.cancel(v);
  }
  // Ses points d'envoi (revue de R2, les verrous DELAY et REVERB) : retires, les autres coups gardent les leurs ; DIST et CHORUS de meme (2026-10-09)
  if (v.sends) for (const snd of v.sends) snd.cancel(v);
  if (v.inserts) for (const ins of v.inserts) ins.cancel(v);
  // Un charley annule (re-programmation, 2026-10-05) : le charley ouvert qu'il etouffait sonne de nouveau
  // (annulees du dernier au premier, les portes reviennent dans l'ordre)
  if (v.choked) {
    v.choked.gate.gain.cancelScheduledValues(v.when);
    if (ohGate === null || ohGate === v.gate) {
      ohGate = v.choked.gate;
      ohEnd = v.choked.end;
    }
  } else if (v.gate && ohGate === v.gate) {
    ohGate = null;
    ohEnd = 0;
  }
  // Un kick annule : le kick d'avant qu'il coupait sonne de nouveau
  if (v.bdChoked) {
    v.bdChoked.gate.gain.cancelScheduledValues(0);
    v.bdChoked.gate.gain.value = 1;
    if (bdGate === null || bdGate === v.bdGate) {
      bdGate = v.bdChoked.gate;
      bdEnd = v.bdChoked.end;
    }
  } else if (v.bdGate && bdGate === v.bdGate) {
    bdGate = null;
    bdEnd = 0;
  }
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

/* ---------------- SIDECHAIN du MM-ARP (2026-10-04, audio/duck.ts) ---------------- */

/** SIDECHAIN de 0 (OFF) a 1 (-24 dB au coup) ; pose par audio/synth.ts depuis le potard. */
let arpDuck = 0;

export function setArpDuck(depth: number): void {
  const d = Math.max(0, Math.min(1, depth));
  if (d === arpDuck) return;
  arpDuck = d;
  if (d === 0) graph?.duck.clear();
}

/** Revue (__v4.audio.duck) : la profondeur, les kicks suivis, le gain de la prise a cet instant. */
export function duckInfo(): { depth: number; kicks: number; added: number; gain: number; at: number } | null {
  if (!graph) return null;
  const now = graph.ctx.currentTime;
  return { depth: arpDuck, kicks: graph.duck.size, added: graph.duck.added, gain: graph.arpOut.gain.value, at: graph.duck.at(now) };
}

/* ---------------- SIDECHAIN du MM-BASS (2026-10-10) : les memes kicks, son entree bassIn ---------------- */

/** SIDECHAIN du MM-BASS de 0 (OFF) a 1 (-24 dB au coup) ; pose par bass/engine.ts depuis son reglage (bass/params.ts). */
let bassDuckDepth = 0;

export function setBassDuck(depth: number): void {
  const d = Number.isFinite(depth) ? Math.max(0, Math.min(1, depth)) : 0;
  if (d === bassDuckDepth) return;
  bassDuckDepth = d;
  if (d === 0) graph?.bassDuck.clear();
}

/** Revue (__v4.audio.bassDuck) : la profondeur, les kicks suivis, le gain de l'entree du MM-BASS a cet instant. */
export function bassDuckInfo(): { depth: number; kicks: number; added: number; gain: number; at: number } | null {
  if (!graph) return null;
  const now = graph.ctx.currentTime;
  return { depth: bassDuckDepth, kicks: graph.bassDuck.size, added: graph.bassDuck.added, gain: graph.bassIn.gain.value, at: graph.bassDuck.at(now) };
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
    // DLY TIME et DLY FB (2026-10-09, les encodeurs G et H)
    graph.delay.setDiv(delayDiv(f.dtime).steps);
    graph.delay.setFeedback(delayFb(f.dfb));
    // Les reglages de chaque FX (2026-10-10) : DELAY TONE, REVERB SIZE TONE PRE, DIST TONE, CHORUS RATE DEPTH, puis BIT et COMP
    applyFxSettings(graph, f);
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
  graph?.kickTone?.set(tone);
  emitMix();
  prepareLocks();
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
  prepareLocks();
  window.clearTimeout(stretchTimer);
  stretchTimer = window.setTimeout(() => {
    try {
      if (stretch === 0) window.localStorage.removeItem(STRETCH_KEY);
      else window.localStorage.setItem(STRETCH_KEY, String(stretch));
    } catch {
      /* il vit pour la visite */
    }
  }, 300);
}

/** Pilote le gain LEVEL (niveau au carre), jamais le master. */
export function setLevel(v: number): void {
  const l = clamp01(v);
  if (l === level) return;
  level = l;
  if (graph) {
    glide(graph.level.gain, level * level, graph.ctx);
    for (const t of graph.taps) glide(t.gain, level * level, graph.ctx);
  }
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
  /** DLY TIME et DLY FB (2026-10-09 ; leur depart hors ligne : la croche pointee, 0.58) */
  dtime?: number;
  dfb?: number;
  /** les reglages des FX (2026-10-10, 0 a 1 ; hors ligne, ceux absents a leur depart FX_SETTINGS : le son d'avant) */
  fxs?: Partial<Record<FxSettingId, number>>;
  /** effets par voix (neutres par defaut hors ligne) */
  voice?: Partial<Record<Inst, Partial<VoiceFx>>>;
  /** reference : sans aucun stage TONE ni CHORUS, voix sans tranche */
  bare?: boolean;
  /** reglages pendant le rendu : [instant (s), valeur], 50 ms d'ecart au moins */
  toneAt?: [number, number][];
  seed?: number;
  /** les verrous des pas (2026-10-08, audio/locks.ts) ; aucun par defaut hors ligne */
  locks?: Locks;
  /** les verrous du coup seul (single) */
  singleLock?: StepLock;
  /** deux canaux (le PAN se mesure) ; un par defaut */
  channels?: 1 | 2;
  /** le canal rendu (0 : gauche, 1 : droite, avec channels 2) */
  channel?: 0 | 1;
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
  const oc = new OfflineAudioContext(o.channels ?? 1, Math.round(o.seconds * sr), sr);
  // Le chorus a interpolation sinc, comme en direct
  await loadChorus(oc);
  const tone0 = snapTone(o.tone ?? 0);
  const stretch0 = snapTime(o.stretch ?? 0);
  const rnd = Math.random;
  const gate = ohGate;
  const end = ohEnd;
  const bGate = bdGate;
  const bEnd = bdEnd;
  bdGate = null;
  bdEnd = 0;
  Math.random = seeded(o.seed ?? 808);
  // Deux rendus identiques : la rotation des variantes repart du debut
  shots.resetRotation();
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
      dtime: o.dtime ?? DTIME_DEFAULT,
      dfb: o.dfb ?? DFB_DEFAULT,
      fxs: o.fxs ?? {},
      bpm: o.bpm,
      voice: o.voice ?? {},
      master: 1,
      bare: o.bare,
    });
    // Les reglages de chaque voix hors ligne : neutres, sauf ceux imposes ; le meme calcul de coup qu'en direct
    const vfx = (inst: Inst): VoiceFx => ({ ...VOICE_FX_DEFAULT, ...(o.voice?.[inst] ?? {}), tone: snapTone(o.voice?.[inst]?.tone ?? 0) });
    const hpOf = (inst: Inst, lock: Readonly<StepLock> | null): HitParams => hitParams(inst, false, lock, tone0, stretch0, vfx(inst));
    // Les inserts DIST et CHORUS des voix qui en ont un verrou dans le rendu (2026-10-09) : tenus engages, comme en direct
    holdInserts(g, o.single ? (o.singleLock ? ({ [o.single]: { 0: o.singleLock } } as Locks) : null) : o.locks);
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
      const hp = hpOf(o.single, o.singleLock ?? null);
      const entry = hitEntry(g, o.single, hp, vfx(o.single), hp.gain);
      const v = voice(g, o.single, 0.05, entry.dest, hp, true);
      if (v) {
        postSends(g, o.single, 0.05, o.singleLock ?? null, v);
        postInserts(g, o.single, 0.05, o.singleLock ?? null, v);
        voices.push(v);
      }
    } else {
      const steps = o.steps ?? pattern.get().steps;
      const step = 60 / (o.bpm ?? pattern.get().bpm) / 4;
      for (let n = 0, t = 0.02; t < o.seconds - 0.5; n += 1, t += step) {
        for (const inst of INSTRUMENTS) {
          const v = velocity(steps, inst, n % STEP_COUNT);
          if (v === 0) continue;
          const lk = lockOf(o.locks, inst, n % STEP_COUNT);
          const hp = hpOf(inst, lk);
          const gain = VEL_GAIN[v] * hp.gain;
          const entry = hitEntry(g, inst, hp, vfx(inst), gain);
          const vo = voice(g, inst, t, entry.dest, hp, true);
          if (vo) {
            postSends(g, inst, t, lk, vo);
            postInserts(g, inst, t, lk, vo);
            voices.push(vo);
          }
        }
      }
    }
    for (const v of voices) for (const src of v.srcs) src.onended = null;
  } finally {
    Math.random = rnd;
    ohGate = gate;
    ohEnd = end;
    bdGate = bGate;
    bdEnd = bEnd;
  }
  // La sortie comme en direct : le limiteur (rendu sans lui si l'AudioWorklet manque)
  if (!o.bare && o.limiter !== false) await attachLimiter(oc, g);
  // Chaque reglage : pose a son instant, puis une pause de 80 ms (temps reel)
  // 30 ms plus loin, rampe finie : le debranchement differe (setTimeout) y tombe
  const q = 128 / sr;
  const at = (t: number): number => Math.round(t / q) * q;
  const events = (o.toneAt ?? [])
    .map(([t, v]) => ({
      t,
      run: () => {
        g.tone.set(snapTone(v));
        g.kickTone?.set(snapTone(v));
      },
    }))
    .sort((a, b) => a.t - b.t);
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
  return buf.getChannelData(Math.min(buf.numberOfChannels - 1, o.channel ?? 0)).slice();
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
  /** les reglages du compresseur commun (mutables : tests de niveau, pris au prochain graphe) */
  readonly comp: typeof COMP;
  /** les one-shots : rendus, temps de calcul, cache */
  shots(): ReturnType<typeof shots.info>;
  /** le SIDECHAIN du MM-ARP (2026-10-04) */
  duck(): ReturnType<typeof duckInfo>;
  /** le SIDECHAIN du MM-BASS (2026-10-10) */
  bassDuck(): ReturnType<typeof bassDuckInfo>;
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
  /** ce que jouerait un coup de inst avec ces verrous (2026-10-08, tests) */
  hitParams(inst: Inst, lock: StepLock | null): HitParams;
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
  /** DIST TONE applique (Hz ; Nyquist : ouvert) ; DELAY TONE, la forme de la REVERB : delayBus, reverbBus (2026-10-10) */
  distToneHz: number;
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
  comp: COMP,
  shots: () => shots.info(),
  duck: () => duckInfo(),
  bassDuck: () => bassDuckInfo(),
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
      distToneHz: d.toneHz,
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
  timeOf: () => voiceTime(stretch),
  renderOffline,
  hitParams: (inst: Inst, lock: StepLock | null) => hitParams(inst, false, lock, tone, stretch, voiceFx.of(inst)),
  setLevel,
  setSwing,
  setDrive,
  setReverb,
  setDelay,
  setChorus,
  setVoiceFx,
};
