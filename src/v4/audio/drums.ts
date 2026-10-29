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
import { SWING, XFADE_UI, type Inst } from '../theme';
import { CHORUS_DEPTH, buildChorus, loadChorus, type ChorusInfo, type ChorusStage } from './chorus';
import { DIST_OPEN_HZ, IR_DEFAULT, buildDrive, buildFx, glide, type DriveStage, type FxChain, type IrShape } from './fx';
import { DFB_DEFAULT, DTIME_DEFAULT, FX_SETTINGS, FX_SETTING_IDS, compMakeup, compRelAuto, delayDiv, delayFb, fxLaw, pattern, type Fx, type FxSettingId, VEL_GAIN, INSTRUMENTS, STEP_COUNT, velocity } from './pattern';
import { kit, type KitKnob, type KitKnobs, type KitModel, type KitOverride, type Layer } from './kit';
import { loadSample, sampleByKey, samplePcm, sampleStats, sampleStatus, samplesOf, samplesVersion } from './samples';
import { userSamples } from './usersamples';
import { KIT_LOCK_IDS, KNOB_OF, LAYER_LOCK_IDS, LAYER_OF, lockOf, parseSnd, type Locks, type StepLock } from './locks';
import { DELAY_TONE_HZ, buildDelayBus, buildReverbBus, type BusInfo, type DelayBus, type LockSend, type ReverbBus, type Send, type SendBus, type SendInfo } from './sends';
import { hitTime, snapTime } from './time';
import { TONE_Q_DB, buildTone, pitchFactor, snapTone, toneHpHz, toneLpHz, type ToneInfo, type ToneStage } from './tone';
import { shots, type ShotId, type ShotOverride } from './shots';
import { Ducker, duckCurve, kickEnvelope, type KickPlay } from './duck';
import {
  DECAY_HOLD_S,
  FENV_OCT,
  START_MAX,
  VOICE_FX_DEFAULT,
  atkS,
  bandGain,
  cutHz,
  decayTau,
  fatkS,
  fdecTau,
  filterIndex,
  filterOpen,
  fineFactor,
  holdS,
  resoQ,
  snapPan,
  tuneFactor,
  voiceFx,
  voiceGain,
  type VoiceFx,
  type VoiceParam,
} from './voicefx';
import { seqLast, seqState, seqStep, type HitLfo } from './seq';
import { LEN_REL_S, LFO_FREQ_CENTS, LFO_PITCH_CENTS, LFO_SPAN_S, lfoDistOf, lfoHitLock, lfoPoints, lfoSum, liveDests, liveNeeds, type LiveNeeds } from './seqhit';
import { NO_TRIGS, type TrigSet } from './trig';
import type { LfoDest } from './lfo';
import { InsertLocks } from './lockfx';
import { NO_NEEDS, insertNeedsOf, morph, morphFxPure, morphHitPure, morphVoicePure, type InsertNeeds } from './morph';
import { glideMode } from './glide';
import { makeApplier, morphGapOf, type Applier, type ApplierClock } from './morphApplier';
import { NO_SCENES, cleanScenes, type SceneSet } from '../rytm/sceneData';
import { sceneCtl } from '../state/sceneCtl';

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
  /** DIST du kick (2026-10-18, Mika : "le dist global doit fonctionner aussi pour le kick") : le meme reglage, sur sa voie */
  kickFx: FxChain | null;
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
  /** V.5.1 : ce qu'un lock trig ou un LFO peut changer de ce coup pendant qu'il sonne (absent : rien, le coup d'avant) */
  live?: LiveHit;
  /** un lock trig (V.5.1) : ce qu'il a change du coup qui sonnait (une annulation le lui rend) */
  undo?: LiveUndo;
  /** une repetition d'un retrig (V.5.1) : la coupe du coup d'avant de la voix (une annulation la retire) */
  rollCut?: { param: AudioParam; t: number; lv: LiveHit; end: number; stop: number };
}

/**
 * Le coup qui sonne, tel qu'un lock trig ou un LFO le touche (V.5.1) : ses noeuds en direct (le VOL des lock trigs, le
 * VOL des LFO, la coupe des retrigs, le PAN, le filtre), ses valeurs de base, ses LFO continus.
 */
interface LiveHit {
  when: number;
  /** la fin du coup (sa source s'arrete, LEN compris) */
  end: number;
  src: AudioBufferSourceNode;
  /** le VOL des lock trigs (1 au coup) */
  lvl: GainNode | null;
  /** le VOL des LFO */
  lfoG: GainNode | null;
  /** la coupe d'un coup de retrig par le suivant */
  roll: GainNode | null;
  pn: StereoPannerNode | null;
  bq: BiquadFilterNode | null;
  /** le VOL du coup (celui de la voix ou de son verrou) et celui que les LFO prennent pour base */
  vol: number;
  level: number;
  pan: number;
  reso: number;
  lfo: HitLfo | null;
  anchor: number;
}
interface LiveUndo {
  lv: LiveHit;
  t: number;
  level: number;
  pan: number;
  reso: number;
  anchor: number;
  params: AudioParam[];
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
/** les lock trigs appliques (V.5.1, tests) */
let lockTrigs = 0;
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
// Le STRETCH de base pour le morphing des scenes (2026-10-27, audio/morph.ts n'importe pas drums.ts)
morph.bindStretch(() => stretch);
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
 * 2.4017 s, x0.9993...) : un motif qui n'y touche pas sonne au bit pres comme
 * avant ; un cran a cote, la loi. Les reglages du COMP n'y sont plus (2026-10-18) :
 * catk et crel y rendaient 3 ms et 120 ms quand l'ecran disait 30 et 150 (leur
 * depart avait change le 2026-10-11, pas leur constante), une des causes du son
 * etouffe ; chacun suit sa loi, ce que l'ecran dit.
 */
const FX_BEFORE: Readonly<Partial<Record<FxSettingId, number>>> = {
  dtone: DELAY_TONE_HZ,
  rsize: IR_DEFAULT.seconds,
  rtone: IR_DEFAULT.hiEnd,
  rpre: IR_DEFAULT.preDelay,
  xtone: DIST_OPEN_HZ,
  crate: 1,
  cdepth: CHORUS_DEPTH,
  brate: 1,
};
const fxValue = (f: Readonly<Partial<Fx>>, k: FxSettingId): number => {
  const v = f[k] ?? FX_SETTINGS[k];
  const before = FX_BEFORE[k];
  return before !== undefined && Math.abs(v - FX_SETTINGS[k]) < 1e-6 ? before : fxLaw[k](v);
};
/** REVERB SIZE, TONE et PRE : la forme de la reponse (fx.ts makeImpulse). */
const irShapeOf = (f: Readonly<Partial<Fx>>): IrShape => ({ seconds: fxValue(f, 'rsize'), hiEnd: fxValue(f, 'rtone'), preDelay: fxValue(f, 'rpre') });

/**
 * Les reglages des FX de f poses sur le graphe (chaque setter ne fait rien si rien ne change). shape false (2026-10-27,
 * les scenes) : la forme de la REVERB attend le repos du crossfader (une reponse recalculee a chaque mouvement gelerait
 * la musique), elle part une fois au lacher.
 */
function applyFxSettings(g: Graph, f: Readonly<Fx>, shape = true): void {
  g.delay.setTone(fxValue(f, 'dtone'));
  if (shape) g.reverb.setShape(irShapeOf(f));
  g.fx.setTone(fxValue(f, 'xtone'));
  g.kickFx?.setTone(fxValue(f, 'xtone'));
  g.chorus.setMod?.(fxValue(f, 'crate'), fxValue(f, 'cdepth'));
  // Les chorus et les DIST des voix aussi (2026-10-21, audit F3 : RATE, DEPTH et TONE de leur page ne faisaient rien
  // sur la voix) ; le CHORUS du MM-ARP garde les siens
  if (g.ch) {
    for (const inst of INSTRUMENTS) {
      g.ch[inst].chorus.setMod?.(fxValue(f, 'crate'), fxValue(f, 'cdepth'));
      g.ch[inst].drive.setTone(fxValue(f, 'xtone'));
    }
  }
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
/*
 * 2026-10-18 (Mika, le VU du MIXER : "le RYTM est vraiment pas fort par rapport [a l'ARP]") : mesure hors ligne (motif et
 * kit de depart, sans son), le MM-RYTM cretait a -6.2 dBFS (-18.7 LUFS), un kick seul a -13.4 dBFS, l'ARP de depart a
 * -8.7 dBFS (-20.1 LUFS) ; le VU est un crete-metre, un kick seul n'y allumait que six segments face a un ARP tenu vers
 * -4 dBFS. Le MM-RYTM remonte de 4 dB (0.53 avant) : le kick vers -9.4 dBFS, les coups qui se superposent vers -2.2
 * dBFS (l'orange, jamais le rouge avec le motif de depart), environ 5 LU au-dessus de l'ARP de depart.
 */
const RYTM_TRIM = 0.84;

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
  // Ce qui joue (2026-10-27) : un contexte cree apres le chargement d'une scene part morphe ; sans scene, le store lui-meme
  const f = morph.fx();
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
  }
  const fx = buildFx(c, { bus, tone: toneSt.input }, o.drive ?? f.drive, fxValue(fs, 'xtone'));
  // Le DIST global passe aussi sur le kick depuis le 2026-10-18 (Mika : "le dist global doit fonctionner aussi pour le
  // kick") : le meme etage parallele sur sa voie, avant son TONE ; CHORUS, DELAY et REVERB globaux restent hors du kick
  // (le kick double du 2026-10-08). A DIST 0 l'etage est en bypass reel : le chemin et le niveau d'avant.
  const kickFx = kickTone ? buildFx(c, { bus: kickBus, tone: kickTone.input }, o.drive ?? f.drive, fxValue(fs, 'xtone')) : null;

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
      // RATE, DEPTH et DIST TONE de la machine (2026-10-21) : poses avant leur premiere branche
      chChorus.setMod?.(fxValue(fs, 'crate'), fxValue(fs, 'cdepth'));
      const chDrive = buildDrive(c, chChorus.input, fxValue(fs, 'xtone'));
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
  const g: Graph = { ctx: c, bus, tone: toneSt, kickTone, chorus: chorusSt, level: lvl, comp, analyser, master, clipPre, limiter: null, post, fx, kickFx, reverb, delay, reverbSend, delaySend, ch, rytmOut, glueIn, glue: null, arpOut, bassOut, bassIn, arpReverb, taps, duck, bassDuck };
  if (!o.bare) {
    reverbSend.set(o.reverb ?? f.reverb);
    delaySend.set(o.delay ?? f.delay);
    chorusSt.set(o.chorus ?? f.chorus);
    for (const inst of INSTRUMENTS) applyVoice(g, inst, o.voice ? { ...VOICE_FX_DEFAULT, ...(o.voice[inst] ?? {}) } : morph.voice(inst));
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
  // Le chorus sans interpolation lineaire (audio/chorus.worklet.js) : son module part avant le graphe (2026-10-22,
  // revue R1 : le CHORUS du motif et les verrous deja la batissent leurs branches tout de suite, en DelayNode, puis
  // passent au worklet a son arrivee)
  void loadChorus(ctx);
  graph = build(ctx);
  // Les verrous DIST et CHORUS du motif deja la (2026-10-09) : leurs inserts tenus engages des le premier coup ; ceux
  // que ses scenes menent aussi (2026-10-27)
  holdScenes(graph, pattern.get().locks, morph.inserts());
  applier = makeApplier(liveClock(ctx), morphGapOf(ctx.sampleRate), applyMorph);
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
  attachLimiter(ctx, graph);
  void attachGlue(ctx, graph, () => morph.fx(), true);
  return ctx;
}

/**
 * BIT et COMP (2026-10-10) : le worklet prend place entre glueIn et la prise du MM-RYTM des qu'il est pret ; hors
 * ligne (2026-10-18) aussi, avant le rendu (les tests mesurent le COMP sur le graphe reel). fx : les reglages lus au
 * moment ou il arrive (en direct ceux du store, ses changements suivent par applyFxSettings) ; live : l'aiguille de
 * la page COMP lit sa reduction.
 */
function attachGlue(c: BaseAudioContext, g: Graph, fx: () => Readonly<Fx>, live: boolean): Promise<void> {
  if (!c.audioWorklet) return Promise.resolve();
  return c.audioWorklet
    .addModule(glueUrl)
    .then(() => {
      const node = new AudioWorkletNode(c, 'mm-glue', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
      // Le noeud d'abord (2026-10-21, audit F15) : setGlue ne retient ses valeurs (debug glue.set) que pour le noeud du graphe
      g.glue = node;
      setGlue(node, fx());
      node.connect(g.rytmOut);
      g.glueIn.connect(node);
      g.glueIn.disconnect(g.rytmOut);
      if (live) {
        node.port.onmessage = (e: MessageEvent<{ gr?: unknown }>) => {
          const gr = e.data?.gr;
          if (typeof gr === 'number' && Number.isFinite(gr)) {
            compMeter.gr = gr;
            compMeter.at = performance.now();
          }
        };
      }
    })
    .catch(() => {
      /* sans worklet : le MM-RYTM sort sans BIT ni COMP */
    });
}

/** Ce que le COMP a recu en dernier (2026-10-18, debug : window.__v4.audio.glue) : les valeurs reelles. */
export interface GlueSet {
  bits: number;
  rate: number;
  /** le MIX (COMP), 0 a 1 */
  comp: number;
  thr: number;
  ratio: number;
  knee: number;
  atk: number;
  rel: number;
  rauto: boolean;
  makeup: number;
  hpf: number;
}
let glueSet: GlueSet | null = null;

/** Les reglages du COMP en valeurs reelles (pattern.ts fxLaw, compMakeup) : ceux que le worklet recoit, ceux de l'ecran. */
export function glueValues(f: Readonly<Fx>): GlueSet {
  const g = (k: FxSettingId): number => f[k] ?? FX_SETTINGS[k];
  return {
    bits: clamp01(f.bits ?? 0),
    rate: fxValue(f, 'brate'),
    comp: clamp01(f.comp ?? 0),
    thr: fxValue(f, 'cthr'),
    ratio: fxValue(f, 'cratio'),
    knee: fxValue(f, 'cknee'),
    atk: fxValue(f, 'catk'),
    rel: fxValue(f, 'crel'),
    rauto: compRelAuto(g('crel')),
    makeup: compMakeup({ cthr: g('cthr'), cratio: g('cratio'), cmake: g('cmake') }),
    hpf: fxValue(f, 'chpf'),
  };
}

/**
 * Ce que chaque worklet a recu (2026-10-27, les scenes) : une valeur inchangee n'est pas reposee, l'applicateur du
 * crossfader ne pose que ce qui bouge (le meme son : la valeur d'avant tenait deja).
 */
const glueSent = new WeakMap<AudioWorkletNode, Map<string, number>>();

function setGlue(node: AudioWorkletNode, f: Readonly<Fx>): void {
  const t = node.context.currentTime;
  const v = glueValues(f);
  let sent = glueSent.get(node);
  if (!sent) {
    sent = new Map();
    glueSent.set(node, sent);
  }
  const was = sent;
  const set = (name: string, x: number): void => {
    if (was.get(name) === x) return;
    was.set(name, x);
    node.parameters.get(name)?.setValueAtTime(x, t);
  };
  set('bits', v.bits);
  set('comp', v.comp);
  // BIT RATE (le diviseur) ; le COMP (2026-10-18) : seuil, rapport, genou, attaque et retour (s, AUTO), rattrapage, HPF
  set('rate', v.rate);
  set('thr', v.thr);
  set('ratio', v.ratio);
  set('knee', v.knee);
  set('atk', v.atk);
  set('rel', v.rel);
  set('rauto', v.rauto ? 1 : 0);
  set('makeup', v.makeup);
  set('hpf', v.hpf);
  if (node === graph?.glue) glueSet = v;
}

/**
 * L'aiguille du COMP (2026-10-18) : la plus forte reduction (dB) que le worklet a vue depuis la lecture d'avant,
 * demandee par le port au plus toutes les 40 ms (seulement quand l'ecran la montre : rien ne circule sinon). Sans
 * reponse depuis 250 ms (contexte endormi, COMP a 0) : 0.
 */
const compMeter = { gr: 0, at: 0, asked: 0 };
export function compGr(): number {
  const node = graph?.glue;
  if (!node) return 0;
  const now = performance.now();
  if (now - compMeter.asked >= 40) {
    compMeter.asked = now;
    node.port.postMessage('gr');
  }
  return now - compMeter.at < 250 ? compMeter.gr : 0;
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

/**
 * STOP deux fois (V.5.0, 2026-10-29, la face facon Digitakt) : les queues de la REVERB et du DELAY du MM-RYTM s'effacent en
 * un fondu court ; les envois restent (la lecture suivante a ses FX). Le MM-ARP garde la sienne.
 */
export function cutTails(): void {
  graph?.reverb.cut();
  graph?.delay.cut();
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
  /** une hauteur menee par le crossfader (2026-10-27) : le calcul le plus proche joue plutot que d'attendre (P2-18) */
  lazy?: boolean;
  /** V.5.1 : le panoramique meme au centre (un lock trig PAN ou un LFO PAN le menent pendant le coup) */
  forcePan?: boolean;
}

/** Ce que le sequenceur des trigs ajoute a un coup (V.5.1, audio/seq.ts) : absent, le coup d'avant. */
export interface HitSeq {
  /** LEN en secondes ; null : INF */
  len: number | null;
  lfo: HitLfo | null;
  /** un coup de retrig : le suivant le coupe ; rep : une repetition (elle coupe le coup d'avant de la voix) */
  roll: boolean;
  rep: boolean;
  prev: Voice | null;
  /** les noeuds que demandent les lock trigs de la voix */
  live: LiveNeeds | null;
}

/** Ce que voice() pose de plus (V.5.1). */
interface HitExtra {
  cut: number | null;
  roll: boolean;
  lfo: HitLfo | null;
  dests: Set<LfoDest>;
  gain: boolean;
  vol: number;
  pan: number;
  reso: number;
}

/**
 * Un coup du sequenceur des trigs (V.5.1) : le filtre et le panoramique qu'il faut en direct (un filtre ouvert reste
 * ouvert, a sa coupure du depart ; un PAN au centre passe par la loi du panoramique, au meme niveau) ; null : rien de plus.
 */
function seqExtra(hp: HitParams, fx: Readonly<VoiceFx>, lock: Readonly<StepLock> | null, sq: HitSeq | undefined): HitExtra | null {
  if (!sq) return null;
  const dests = liveDests(sq.lfo);
  const needPan = !!sq.live?.pan || dests.has('PAN');
  const needFilter = !!sq.live?.filter || dests.has('FREQ') || dests.has('RESO');
  const gain = !!sq.live?.gain;
  if (sq.len === null && !sq.roll && dests.size === 0 && !sq.live) return null;
  if (needPan && hp.pan === 0 && !hp.forcePan) {
    hp.forcePan = true;
    hp.gain *= Math.SQRT2;
  }
  if (needFilter && !hp.filter) {
    const type = lock?.ftype ?? fx.ftype;
    hp.filter = { type: FILTER_KIND[filterIndex(type)], hz: cutHz(lock?.fcut ?? fx.fcut), q: resoQ(lock?.freso ?? fx.freso), oct: 0, atk: 0, tau: fdecTau(lock?.fdec ?? fx.fdec) };
  }
  return { cut: sq.len, roll: sq.roll, lfo: dests.size > 0 ? sq.lfo : null, dests, gain, vol: lock?.level ?? fx.level, pan: hp.pan, reso: lock?.freso ?? fx.freso };
}

/** La loi d'une destination continue : la valeur de l'AudioParam pour une valeur v du LFO. */
function lfoLaw(lv: LiveHit, d: LfoDest): ((v: number) => number) | null {
  switch (d) {
    case 'PITCH':
      return (v) => v * LFO_PITCH_CENTS;
    case 'FREQ':
      return (v) => v * LFO_FREQ_CENTS;
    case 'RESO': {
      const bp = lv.bq?.type === 'bandpass';
      return (v) => {
        const q = resoQ(Math.max(0, Math.min(1, lv.reso + v)));
        return bp ? q : 20 * Math.log10(q);
      };
    }
    case 'VOL': {
      const b = voiceGain(lv.level);
      return (v) => (b > 1e-6 ? voiceGain(Math.max(0, Math.min(1, lv.level + v))) / b : 1);
    }
    case 'PAN':
      return (v) => Math.max(-1, Math.min(1, lv.pan + v));
    default:
      return null;
  }
}
function lfoParam(lv: LiveHit, d: LfoDest): AudioParam | null {
  if (d === 'PITCH') return lv.src.detune;
  if (d === 'FREQ') return lv.bq?.detune ?? null;
  if (d === 'RESO') return lv.bq?.Q ?? null;
  if (d === 'VOL') return lv.lfoG?.gain ?? null;
  if (d === 'PAN') return lv.pn?.pan ?? null;
  return null;
}
/** Le temps d'un glissement (la relance d'un LFO) : 3 ms, pas de marche ; celui d'un lock trig, la constante de temps (1 ms). */
const LIVE_GLIDE_S = 0.003;
const LIVE_TAU_S = 0.001;

/**
 * Tient un parametre a t (V.5.1, la revue de D2, E1) : cancelAndHoldAtTime la ou il existe ; sinon (Firefox ne l'a pas,
 * dj/engine.ts le disait deja) l'annulation simple, puis la valeur v posee a t si on la connait (sans elle, un
 * setTargetAtTime qui suit part de ce que valent les evenements d'avant t, ce qui revient au meme).
 */
function holdAt(p: AudioParam, t: number, v?: number): void {
  if (typeof p.cancelAndHoldAtTime === 'function') p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    if (v !== undefined) p.setValueAtTime(v, t);
  }
}

/** La valeur des LFO continus d'un coup a t, par destination, telle que ses courbes la donnent maintenant (avant une relance). */
function lfoHeld(lv: LiveHit, t: number): Map<LfoDest, number> {
  const out = new Map<LfoDest, number>();
  const L = lv.lfo;
  if (!L) return out;
  for (const d of liveDests(L)) {
    const law = lfoLaw(lv, d);
    if (law) out.set(d, law(lfoPoints(L, d, lv.when, t, t, lv.anchor)[0].v));
  }
  return out;
}

/**
 * Les LFO continus d'un coup (V.5.1) : des rampes sur sa duree (au plus LFO_SPAN_S), depuis from ; un from apres le debut
 * (un lock trig qui relance, une annulation) tient la valeur du moment (held : celle des courbes d'avant, a from) puis
 * rejoint la nouvelle courbe en 3 ms.
 */
function lfoCurves(lv: LiveHit, from: number, held: Map<LfoDest, number> = lfoHeld(lv, from)): void {
  const L = lv.lfo;
  if (!L) return;
  const t1 = Math.min(lv.end, lv.when + LFO_SPAN_S);
  for (const d of liveDests(L)) {
    const param = lfoParam(lv, d);
    const law = lfoLaw(lv, d);
    if (!param || !law) continue;
    let t0 = Math.max(from, lv.when);
    if (t0 >= t1) continue;
    if (from > lv.when) {
      // La valeur tenue posee a t0 : sans evenement apres lui, cancelAndHoldAtTime ne pose rien et la rampe partirait du
      // debut du coup
      const h = held.get(d);
      holdAt(param, t0, h);
      if (h !== undefined) param.setValueAtTime(h, t0);
      t0 += LIVE_GLIDE_S;
      if (t0 >= t1) continue;
      const pts = lfoPoints(L, d, lv.when, t0, t1, lv.anchor);
      for (const pt of pts) param.linearRampToValueAtTime(law(pt.v), pt.t);
    } else {
      const pts = lfoPoints(L, d, lv.when, t0, t1, lv.anchor);
      param.setValueAtTime(law(pts[0].v), pts[0].t);
      for (let i = 1; i < pts.length; i += 1) param.linearRampToValueAtTime(law(pts[i].v), pts[i].t);
    }
  }
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

/** Le potard du kit de chaque verrou, le reglage de couche de chaque verrou de couche : audio/locks.ts depuis le 2026-10-27. */
export { KNOB_OF, LAYER_OF };
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
    else if (p && ov?.layer) {
      // ... et ses niveaux de couches aussi (revue du 2026-10-18) : un sample de ce navigateur retire, ou un sample du
      // site renomme, laissait SYNTH a 0 sur le pas, muet ; le pas joue la voix telle qu'elle est
      const { syn: _syn, lev: _lev, ...rest } = ov.layer;
      ov = { ...ov, layer: rest };
      if (Object.keys(rest).length === 0) delete ov.layer;
    }
  }
  return ov;
}

/**
 * Deux changements du kit pour un coup, le second gagne (2026-10-27 : ko0, celui des scenes, P2-22 ; puis celui du verrou
 * du pas) ; null sans aucun.
 */
export function mergeKitOv(a: KitOverride | null, b: KitOverride | null): KitOverride | null {
  if (!a) return b;
  if (!b) return a;
  const out: KitOverride = { ...a, ...b };
  if (a.knobs || b.knobs) out.knobs = { ...(a.knobs ?? {}), ...(b.knobs ?? {}) };
  if (a.layer || b.layer) out.layer = { ...(a.layer ?? {}), ...(b.layer ?? {}) };
  return out;
}

export function hitParams(inst: Inst, open: boolean, lock: Readonly<StepLock> | null, globalTone: number, globalStretch: number, fx: Readonly<VoiceFx>, ko0: KitOverride | null = null, lazy = false): HitParams {
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
  // Une hauteur menee par le crossfader (2026-10-27) : le coup le dit a shots.ts (P2-18)
  if (lazy) hp.lazy = true;
  if (!lock && !ko0) return withPanGain(withBandGain(hp));
  // Ce que le pas change au kit (R2, R3) : le coup se calcule avec (la variante 0, prepare a l'avance) ; celui des scenes
  // d'abord (2026-10-27, P2-22), les cles du verrou gagnent
  const ko = mergeKitOv(ko0, lock ? kitOverride(lock) : null);
  if (ko) {
    hp.ov = { tw: kit.tweakWith(base, ko), sig: kit.sigWith(base, ko) };
    // Un echantillon d'une autre famille, seul, sur la voie du kick n'est pas un kick (2026-10-08, R2)
    if (inst === 'BD') hp.kick = kit.kickWith(ko);
  } else if (lock && (lock.tune !== undefined || lock.fine !== undefined || lock.tone !== undefined)) {
    // Une hauteur verrouillee (TUNE ; FINE et TONE depuis le 2026-10-09) : la variante 0 (le calcul prepare a l'avance est celui-la)
    hp.ov = { tw: kit.tweak(base), sig: kit.sig(base) };
  }
  if (lock && lock.level !== undefined) {
    // Le gain du verrou rapporte a celui de la voix (sa tranche l'applique ensuite) : le niveau exact du VOL
    // verrouille (revue de R2 : le plafond de x4 jouait VOL 80 pour un verrou a 100 sur une voix a 40) ; une
    // voix a VOL 0 reste muette (sa tranche est a 0, le rapport n'y change rien)
    const was = voiceGain(fx.level);
    hp.gain = was > 1e-6 ? voiceGain(lock.level) / was : 1;
  }
  return withPanGain(withBandGain(hp));
}

/** Le passe-bande et sa RESO (2026-10-21, audit F12) : le gain qui garde la voix a son niveau (voicefx.ts bandGain). */
const withBandGain = (hp: HitParams): HitParams => {
  if (hp.filter?.type === 'bandpass') hp.gain *= bandGain(hp.filter.q);
  return hp;
};

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
function voice(g: Graph, inst: Inst, when: number, dest: AudioNode, hp: HitParams, sync = false, ex: HitExtra | null = null): Voice | null {
  const c = g.ctx;
  const { decay, ts, pf } = hp;
  // Rien de pret pour ce son (le tout premier coup, avant le prechauffage) : il ne joue pas, aucun calcul ici
  const shot = shots.get(hp.id, ts, pf, c.sampleRate, sync, hp.ov, hp.lazy === true);
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
  // V.5.1 (le sequenceur des trigs) : le VOL des lock trigs, le VOL des LFO, LEN, la coupe d'un retrig ; aucun au depart
  const gainNode = (): GainNode => {
    const n = c.createGain();
    n.connect(dest);
    nodes.push(n);
    dest = n;
    return n;
  };
  const lvl = ex?.gain ? gainNode() : null;
  // Une valeur posee a l'heure du coup (pas seulement .value) : un lock trig la tient ensuite (cancelAndHoldAtTime) et glisse
  // depuis elle ; sans evenement avant lui, sa rampe partait du debut du contexte
  if (lvl) lvl.gain.setValueAtTime(1, when);
  const lfoG = ex?.dests.has('VOL') ? gainNode() : null;
  const cutG = ex && ex.cut !== null ? gainNode() : null;
  const rollG = ex?.roll ? gainNode() : null;
  let pnLive: StereoPannerNode | null = null;
  // PAN (2026-10-08) : un panoramique pour ce coup, seulement hors du centre (au centre, aucun noeud de plus).
  // Le coup y entre en mono (ses deux canaux sont le meme son) : loi a puissance constante, et x racine de 2
  // (hitParams) pour que pres du centre il sonne comme sans PAN ; tout a un bord, +3 dB de ce cote (le
  // StereoPannerNode en stereo doublait le canal du bord, +6 dB)
  if (hp.pan !== 0 || hp.forcePan) {
    const pn = c.createStereoPanner();
    pnLive = pn;
    // Un echantillon vraiment stereo (revue de R2) : le panoramique stereo (identite au centre, sa largeur
    // gardee, PAN 0.02 sonne comme PAN 0), sans le x racine de 2 de la loi mono ; un son mono : la loi mono
    const stereo = shots.isStereo(shot.buf);
    if (!stereo) {
      pn.channelCount = 1;
      pn.channelCountMode = 'explicit';
    }
    pn.pan.value = Math.max(-1, Math.min(1, hp.pan));
    // Le panoramique en direct (V.5.1) : sa valeur posee a l'heure du coup, comme le VOL des lock trigs
    if (ex) pn.pan.setValueAtTime(Math.max(-1, Math.min(1, hp.pan)), when);
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
  let bqLive: BiquadFilterNode | null = null;
  if (fl) {
    const top = Math.min(20000, c.sampleRate * 0.45);
    const hz = (f: number): number => Math.max(20, Math.min(top, f));
    const bq = c.createBiquadFilter();
    bqLive = bq;
    bq.type = fl.type;
    // Le Q de Web Audio est en dB pour le passe-bas et le passe-haut (lineaire pour le passe-bande) : RESO a 0 donne alors
    // le Butterworth (0.707, aucune bosse), a fond un Q de 12
    bq.Q.value = fl.type === 'bandpass' ? fl.q : 20 * Math.log10(fl.q);
    // Le filtre en direct (V.5.1) : son Q pose a l'heure du coup (un lock trig RESO glisse depuis lui)
    if (ex) bq.Q.setValueAtTime(bq.Q.value, when);
    const f0 = hz(fl.hz);
    if (fl.oct !== 0) {
      const peak = hz(fl.hz * Math.pow(2, fl.oct));
      if (fl.atk > 0) {
        bq.frequency.setValueAtTime(f0, when);
        bq.frequency.exponentialRampToValueAtTime(peak, when + fl.atk);
      } else bq.frequency.setValueAtTime(peak, when);
      bq.frequency.setTargetAtTime(f0, when + fl.atk, fl.tau);
    } else {
      bq.frequency.value = f0;
      // De meme sa coupure (un lock trig FREQ glisse depuis elle)
      if (ex) bq.frequency.setValueAtTime(f0, when);
    }
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
  // LEN (V.5.1) : le coup relache en 8 ms a la fin de LEN, sa source s'arrete juste apres (les envois gardent leur queue)
  if (cutG && ex && ex.cut !== null) {
    const cutAt = when + Math.max(0, ex.cut);
    if (cutAt < when + len && (stopAt === 0 || cutAt < stopAt)) {
      cutG.gain.setValueAtTime(1, cutAt);
      cutG.gain.linearRampToValueAtTime(0, cutAt + LEN_REL_S);
      stopAt = cutAt + LEN_REL_S + 0.002;
      if (ownGate) ohEnd = Math.min(ohEnd, stopAt);
      if (ownBd) bdEnd = Math.min(bdEnd, stopAt);
    }
  }
  if (off > 0) src.start(when, off);
  else src.start(when);
  if (stopAt > 0) src.stop(stopAt);
  let live: LiveHit | undefined;
  if (ex) {
    live = { when, end: stopAt > 0 ? stopAt : when + len, src, lvl, lfoG, roll: rollG, pn: pnLive, bq: bqLive, vol: ex.vol, level: ex.vol, pan: ex.pan, reso: ex.reso, lfo: ex.lfo, anchor: ex.lfo?.anchor ?? 0 };
    lfoCurves(live, when);
  }
  // Un kick : son enveloppe, a sa vitesse, avec son DECAY (le SIDECHAIN du MM-ARP) ; un son verrouille d'une
  // autre famille sur la voie du kick n'en est pas un (2026-10-08 : le SIDECHAIN suit les kicks, pas la voie)
  const kick = inst === 'BD' && hp.kick ? { env: kickEnvelope(shot.buf), rate: shot.rate, hold: Math.max(DECAY_HOLD_S, atk + hp.hold), tau, vel: 1, ...(off > 0 ? { off } : {}) } : undefined;
  return { when, srcs: [src], nodes, kick, choked, gate: ownGate, bdChoked, bdGate: ownBd, ...(live ? { live } : {}) };
}

/**
 * Le coup exact d'une voix (un verrou de pas compris) est-il pret (2026-10-21, audit RS-2 : l'ecoute d'un son choisi a
 * l'arret partait avant lui et faisait entendre le kick par defaut) ? Son calcul passe en tete de file ; true des qu'il
 * est la, false au bout de ms (ou sans contexte audio). actions.ts previewSound l'attend avant de jouer.
 */
export function shotReady(inst: Inst, lock: Readonly<StepLock> | null, ms: number): Promise<boolean> {
  const c = ctx;
  if (!c) return Promise.resolve(false);
  // Ce que le coup jouera, scenes comprises (2026-10-27 : sans scene, le verrou et la voix eux-memes)
  const m = morph.hit(inst, lock, pattern.scenes.get());
  const hp = hitParams(inst, false, m.lock, tone, morph.stretch(), m.fx, m.kit, m.lazy);
  return shots.whenReady(hp.id, hp.ts, hp.pf, c.sampleRate, hp.ov, ms);
}

/**
 * Joue un coup a `when` (temps du contexte ; maintenant par defaut). Ne cree
 * jamais le contexte : sans geste prealable, rien ne sonne. `open` : charley
 * ouvert (pad CH tenu ; les coups du sequenceur sont toujours fermes).
 * `out` recoit la voix programmee (l'horloge, pour pouvoir l'annuler).
 * `vel` : la velocite du pas, en gain (1 fort, 0.6 moyen, 0.32 doux).
 */
export function trigger(inst: Inst, when?: number, open = false, out?: Voice[], vel = 1, lock0: Readonly<StepLock> | null = null, scenes: SceneSet = pattern.scenes.get(), sq?: HitSeq): boolean {
  const g = graph;
  if (!g) return false;
  enforceMute(g);
  const now = g.ctx.currentTime;
  const t = when === undefined || when < now ? now : when;
  // Les scenes au x du moment (2026-10-27, audio/morph.ts) : sans scene pour la voix, le verrou et la voix eux-memes
  const m = morph.hit(inst, lock0, scenes);
  const fx = m.fx;
  // Les LFO pris au moment du coup (V.5.1 : DIST, DELAY, REVERB, TONE, DECAY), sur les valeurs que le coup joue
  const lh = lfoHitLock(sq?.lfo ?? null, fx, m.lock);
  const lock = lh.lock;
  const hp = hitParams(inst, open, lock, tone, morph.stretch(), fx, m.kit, m.lazy || lh.tone);
  const ex = seqExtra(hp, fx, lock, sq);
  // Velocite (2026-10-01) : un gain de plus entre la voix et sa tranche, sous 1 ; un VOL verrouille s'y ajoute (2026-10-08)
  const gain = Math.max(0, vel) * hp.gain;
  const entry = hitEntry(g, inst, hp, fx, gain);
  const v = voice(g, inst, t, entry.dest, hp, false, ex);
  if (!v) {
    for (const n of entry.nodes) n.disconnect();
    return false;
  }
  // Une repetition d'un retrig (V.5.1) : le coup d'avant de la voix s'efface en 8 ms (une voix, un coup a la fois)
  if (sq?.rep && sq.prev) rollCut(sq.prev, t, v);
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

/** Un stop() qui ne leve jamais (un navigateur qui refuse un second appel : le coup finit seul). */
function stopSrc(src: AudioScheduledSourceNode, t: number): void {
  try {
    src.stop(t);
  } catch {
    /* deja arretee */
  }
}

/**
 * La coupe du coup de retrig d'avant (V.5.1) par la repetition v a t ; v la retient (une annulation la retire). Sa source
 * s'arrete juste apres la rampe et ses courbes de LFO s'y arretent (la revue de D2, E2 : chaque repetition tournait
 * sinon a vide jusqu'au bout de son echantillon, des centaines de sources a la fois).
 */
function rollCut(prev: Voice, t: number, v: Voice): void {
  const lv = prev.live;
  if (!lv?.roll || lv.end <= t) return;
  const p = lv.roll.gain;
  p.setValueAtTime(1, t);
  p.linearRampToValueAtTime(0, t + CHOKE_S);
  const stop = t + CHOKE_S + 0.002;
  v.rollCut = { param: p, t, lv, end: lv.end, stop };
  lv.end = t + CHOKE_S;
  stopSrc(lv.src, stop);
  if (lv.lfo) {
    const held = lfoHeld(lv, stop);
    for (const dst of liveDests(lv.lfo)) {
      const param = lfoParam(lv, dst);
      if (param) holdAt(param, stop, held.get(dst));
    }
  }
}

/**
 * Un lock trig (V.5.1, en REC FUNC + pas) : il ne joue pas ; ses verrous vont au coup de la voix qui sonne encore a t, pour
 * ce que le moteur change en direct : VOL, PAN, la frequence et la resonance du filtre (les coups de la voix ont ces noeuds
 * en direct des que le motif a des lock trigs qui les verrouillent), les envois DELAY et REVERB et les inserts DIST et
 * CHORUS de sa tranche (comme le verrou d'un coup, jusqu'au coup suivant de la voix). anchor : LFO.T ON, ses LFO
 * repartent de la. Rend la voix vide qui le porte (l'horloge peut l'annuler, cancelVoice rend au coup ce qu'il avait).
 */
function lockTrigOn(g: Graph, inst: Inst, t: number, lock: Readonly<StepLock> | null, last: Voice | null, anchor: number | null): Voice {
  const pv: Voice = { when: t, srcs: [], nodes: [] };
  postSends(g, inst, t, lock, pv);
  postInserts(g, inst, t, lock, pv);
  lockTrigs += 1;
  const lv = last?.live;
  if (!lv || t >= lv.end || t < lv.when) return pv;
  const u: LiveUndo = { lv, t, level: lv.level, pan: lv.pan, reso: lv.reso, anchor: lv.anchor, params: [] };
  const lfoOn = liveDests(lv.lfo);
  // La valeur des LFO a t avant ce lock trig (ses courbes s'y tiennent, puis repartent)
  const held = lfoHeld(lv, t);
  // De la valeur du moment (quelle que soit la courbe d'avant : une enveloppe, une valeur fixe) vers celle du verrou, en
  // quelques ms : setTargetAtTime part de ce que vaut le parametre a t (une rampe lineaire partait de l'evenement d'avant)
  const glideTo = (p: AudioParam, v: number): void => {
    holdAt(p, t);
    p.setTargetAtTime(v, t, LIVE_TAU_S);
    u.params.push(p);
  };
  if (lock?.level !== undefined && lv.lvl) {
    const b = voiceGain(lv.vol);
    glideTo(lv.lvl.gain, b > 1e-6 ? voiceGain(lock.level) / b : 1);
    lv.level = lock.level;
  }
  if (lock?.pan !== undefined && lv.pn) {
    lv.pan = snapPan(lock.pan);
    if (!lfoOn.has('PAN')) glideTo(lv.pn.pan, lv.pan);
  }
  if (lock?.fcut !== undefined && lv.bq) {
    const top = Math.min(20000, g.ctx.sampleRate * 0.45);
    glideTo(lv.bq.frequency, Math.max(20, Math.min(top, cutHz(lock.fcut))));
  }
  if (lock?.freso !== undefined && lv.bq) {
    lv.reso = lock.freso;
    if (!lfoOn.has('RESO')) {
      const q = resoQ(lv.reso);
      glideTo(lv.bq.Q, lv.bq.type === 'bandpass' ? q : 20 * Math.log10(q));
    }
  }
  if (anchor !== null) lv.anchor = anchor;
  // Les LFO continus repartent de t (une base ou l'ancre a change)
  if (lv.lfo) lfoCurves(lv, t, held);
  if (u.params.length > 0 || lv.lfo) pv.undo = u;
  return pv;
}

/** Un lock trig sur le graphe vivant (l'horloge) ; null sans contexte. */
export function lockTrig(inst: Inst, t: number, lock: Readonly<StepLock> | null, last: Voice | null, anchor: number | null): Voice | null {
  const g = graph;
  if (!g) return null;
  return lockTrigOn(g, inst, Math.max(t, g.ctx.currentTime), lock, last, anchor);
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

/**
 * Les inserts DIST et CHORUS tenus engages pour les voix qui en ont un verrou dans ces verrous (le motif, un rendu), ou
 * dont DIST ou CHORUS est dans une scene (2026-10-27, needs : un crossfader qui passe par 0 ne debranche rien).
 */
function holdInserts(g: Graph, locks: Readonly<Locks> | null | undefined, needs: InsertNeeds = NO_NEEDS, fxOf: (inst: Inst) => Readonly<Partial<Record<string, number>>> | null = (i) => voiceFx.of(i)): void {
  if (!g.ch) return;
  for (const inst of INSTRUMENTS) {
    const row = locks?.[inst];
    // Un LFO de la voix sur DIST (V.5.1) : tenu engage comme pour un verrou
    let dist = needs.dist.has(inst) || lfoDistOf(fxOf(inst), row);
    let chorus = needs.chorus.has(inst);
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

/** Les tenues que demandent les verrous du motif et ses scenes (2026-10-27) : les inserts des voix, DIST et CHORUS du bus. */
function holdScenes(g: Graph, locks: Readonly<Locks> | null | undefined, needs: InsertNeeds, fxOf?: (inst: Inst) => Readonly<Partial<Record<string, number>>> | null): void {
  holdInserts(g, locks, needs, fxOf);
  g.fx.hold(needs.busDist);
  g.kickFx?.hold(needs.busDist);
  g.chorus.lockHold?.(needs.busChorus);
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
      // Q en dB, comme le TONE de la tranche (2026-10-21, audit F13)
      const hpF = c.createBiquadFilter();
      hpF.type = 'highpass';
      hpF.Q.value = TONE_Q_DB;
      hpF.frequency.value = toneHpHz(hp.tone);
      const lpF = c.createBiquadFilter();
      lpF.type = 'lowpass';
      lpF.Q.value = TONE_Q_DB;
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
    const sc = pattern.scenes.get();
    for (const inst of INSTRUMENTS) {
      const row = locks[inst];
      if (!row) continue;
      for (const l of Object.values(row)) {
        if (l.tune === undefined && l.fine === undefined && l.tone === undefined && !kitOverride(l)) continue;
        // Ce que le coup jouera, scenes comprises (2026-10-27 : sans scene, le verrou et la voix eux-memes)
        const m = morph.hit(inst, l, sc);
        const hp = hitParams(inst, false, m.lock, tone, morph.stretch(), m.fx, m.kit, m.lazy);
        shots.prepare(hp.id, hp.ts, hp.pf, c.sampleRate, hp.ov);
      }
    }
  }, 120);
}

/**
 * Les deux bouts d'un balayage prets (2026-10-27, P2-18) : 120 ms apres un changement de scenes, les coups des voix dont
 * une hauteur se morphe (TUNE, FINE, TONE ; le kit en P2-22) a x = 0, x = 1 et au x du moment ; le premier passage d'un
 * balayage joue le calcul le plus proche (shots.ts lazy), ses deux bouts sont toujours exacts.
 */
let scenePrepTimer = 0;
export const scenePrep = { runs: 0, prepared: 0, at: 0 };
function prepareScenes(): void {
  if (!ctx || !graph || typeof window === 'undefined') return;
  window.clearTimeout(scenePrepTimer);
  scenePrepTimer = window.setTimeout(() => {
    scenePrepTimer = 0;
    const c = ctx;
    if (!c) return;
    const sc = pattern.scenes.get();
    const insts = morph.pitchVoices();
    if (insts.length === 0) return;
    scenePrep.runs += 1;
    scenePrep.at = performance.now();
    for (const inst of insts) {
      for (const xv of [0, 1, morph.x()]) {
        const m = morphHitPure(inst, voiceFx.of(inst), null, sc, xv);
        const hp = hitParams(inst, false, m.lock, tone, morph.stretchAt(xv), m.fx, m.kit, true);
        // Toutes les variantes (2026-10-27, revue F3) : au repos, la rotation des variantes revient
        shots.prepare(hp.id, hp.ts, hp.pf, c.sampleRate, hp.ov, true);
        scenePrep.prepared += 1;
      }
    }
  }, 120);
}
let prepKey = '';
let prepLocks = pattern.get().locks;
pattern.subscribe(() => {
  // Seulement quand les verrous changent (pas a chaque pas pose) ; leur objet d'abord (2026-10-27 : choisir une voix ne
  // les touche pas, pas de JSON a chaque choix)
  const lk = pattern.get().locks;
  if (lk === prepLocks) return;
  prepLocks = lk;
  const k = JSON.stringify(lk);
  if (k === prepKey) return;
  prepKey = k;
  prepareLocks();
  // Les inserts DIST et CHORUS des voix qui en ont un verrou : tenus engages tout de suite (le prochain coup les trouve)
  if (graph) holdInserts(graph, pattern.get().locks, morph.inserts());
});
kit.subscribe(() => prepareLocks());
voiceFx.subscribe(() => {
  prepareLocks();
  // Un LFO de voix sur DIST (V.5.1) : l'insert de sa tranche tenu engage, comme pour un verrou
  if (graph) holdInserts(graph, pattern.get().locks, morph.inserts());
});

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
  // Un lock trig annule (V.5.1) : le coup qui sonnait reprend ses valeurs et ses LFO d'avant lui
  if (v.undo) {
    const u = v.undo;
    for (const p of u.params) p.cancelScheduledValues(u.t);
    u.lv.level = u.level;
    u.lv.pan = u.pan;
    u.lv.reso = u.reso;
    u.lv.anchor = u.anchor;
    if (u.lv.lfo) lfoCurves(u.lv, u.t);
  }
  // Une repetition annulee : le coup d'avant n'est plus coupe (sa fin, sa source et ses LFO d'origine)
  if (v.rollCut) {
    const rc = v.rollCut;
    rc.param.cancelScheduledValues(rc.t);
    rc.lv.end = rc.end;
    stopSrc(rc.lv.src, rc.end);
    if (rc.lv.lfo) lfoCurves(rc.lv, rc.stop);
  }
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
/** Les FX globaux d'un etat sur le graphe (2026-10-27 : extrait du store ; le store, ou ce que les scenes en font jouer). */
function applyFx(g: Graph, f: Readonly<Fx>, shape = true): void {
  g.fx.setDrive(f.drive);
  g.kickFx?.setDrive(f.drive);
  g.reverbSend.set(f.reverb);
  g.delaySend.set(f.delay);
  g.chorus.set(f.chorus);
  // DLY TIME et DLY FB (2026-10-09, les encodeurs G et H)
  g.delay.setDiv(delayDiv(f.dtime).steps);
  g.delay.setFeedback(delayFb(f.dfb));
  // Les reglages de chaque FX (2026-10-10) : DELAY TONE, REVERB SIZE TONE PRE, DIST TONE, CHORUS RATE DEPTH, puis BIT et COMP
  applyFxSettings(g, f, shape);
}

pattern.fx.subscribe(() => {
  // Ce qui joue : le store, ou ses reglages menes par les scenes (audio/morph.ts ; sans scene, le store lui-meme). Les
  // scenes menent des fx (2026-10-27) : le changement passe par l'applicateur, au pas des rampes du crossfader
  if (graph) {
    if (applier && morph.fxMorphed()) applier.request();
    else applyFx(graph, morph.fx());
  }
  emitMix();
});

/* Effets par piste : chaque changement du store rejoint les tranches (ce que les scenes en font jouer, 2026-10-27). */
voiceFx.subscribe(() => {
  if (graph) {
    let wait = false;
    for (const inst of INSTRUMENTS) {
      if (applier && morph.voiceMorphed(inst)) wait = true;
      else applyVoice(graph, inst, morph.voice(inst));
    }
    if (wait) applier?.request();
  }
  emitMix();
});

/* ---------------- les scenes : l'applicateur (2026-10-27, la phase 2) ---------------- */

/**
 * Le bus et les tranches suivent le crossfader par audio/morphApplier.ts : au plus une application par pas de 25 ms en
 * temps du contexte, toujours la vue du moment, chaque rampe de 20 ms finie avant la suivante. Ni store ecrit, ni coup
 * re-programme : les classes ramp, worklet et notch seulement (les coups lisent le morphing a leur programmation, P2-18).
 * La forme de la REVERB (settle) attend le repos : la fin du geste, ou XFADE_UI.settleMs sans mouvement (le MIDI).
 */
let applier: Applier | null = null;
/** au prochain passage, toutes les tranches et le bus (des scenes ont change : un domaine qui en sort retrouve sa base) */
let applyAll = false;
/** des mouvements du crossfader il y a moins de settleMs : la forme de la REVERB attend */
let shapeWait = false;
let quietTimer = 0;
/** le dernier mouvement (performance.now) : une seule minuterie par attente, relancee au besoin, pas une par mouvement */
let lastXAt = 0;
function quietCheck(): void {
  const left = XFADE_UI.settleMs - (performance.now() - lastXAt);
  if (left > 1) {
    quietTimer = window.setTimeout(quietCheck, left);
    return;
  }
  quietTimer = 0;
  shapeWait = false;
  if (!sceneCtl.moving()) applier?.request();
}
/** le controle negatif des tests (debug morphStep) : les reglages sautent au lieu de glisser */
let morphStepLive = false;

const liveClock = (c: AudioContext): ApplierClock => ({
  now: () => c.currentTime,
  later(fn: () => void, ms: number): () => void {
    const id = window.setTimeout(fn, ms);
    return () => window.clearTimeout(id);
  },
  frozen: () => c.state !== 'running',
});

const shapeFree = (): boolean => !shapeWait && !sceneCtl.moving();

function applyMorph(): void {
  const g = graph;
  if (!g) return;
  const t0 = performance.now();
  const all = applyAll;
  applyAll = false;
  glideMode.step = morphStepLive;
  try {
    if (all || morph.fxMorphed()) applyFx(g, morph.fx(), shapeFree());
    for (const inst of INSTRUMENTS) if (all || morph.voiceMorphed(inst)) applyVoice(g, inst, morph.voice(inst));
  } finally {
    glideMode.step = false;
  }
  morph.noteApply(performance.now() - t0);
}

if (typeof window !== 'undefined') {
  morph.subscribe((c) => {
    const g = graph;
    if (!g || !applier) return;
    if (c.cause === 'x') {
      shapeWait = true;
      lastXAt = performance.now();
      if (!quietTimer) quietTimer = window.setTimeout(quietCheck, XFADE_UI.settleMs);
      applier.request();
    } else if (c.cause === 'scenes' || c.cause === 'switch') {
      // Les branches se batissent quand une scene arrive, jamais pendant un geste
      applyAll = true;
      holdScenes(g, pattern.get().locks, morph.inserts());
      applier.request(c.at);
      prepareScenes();
    } else if (c.cause === 'settle') {
      window.clearTimeout(quietTimer);
      quietTimer = 0;
      shapeWait = false;
      applier.request();
      // Le crossfader pose : ses coups a ce x, toutes variantes (2026-10-27, revue F3)
      prepareScenes();
    }
    // 'base' : les gestionnaires de pattern.fx et de voiceFx passent eux-memes par l'applicateur
  });
}

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
  /**
   * BIT et COMP (le MIX du compresseur, 2026-10-18) : 0 par defaut hors ligne, le worklet en place mais en bypass reel
   * (le son au bit pres comme sans lui) ; glue false : le rendu sans le worklet du tout
   */
  bits?: number;
  comp?: number;
  glue?: boolean;
  /** les reglages de BIT et du COMP pendant le rendu (2026-10-18, les clics) : [instant (s), reglages 0 a 1], 50 ms d'ecart au moins */
  fxAt?: [number, Partial<Fx>][];
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
  /**
   * Les scenes (2026-10-27, la phase 2, tests seulement) : un jeu de scenes ({ a, b } ou la forme stockee) morphe sur la
   * base du rendu (ses reglages imposes, les autres neutres), au x du rendu (0 par defaut) ; les coups au x de leur
   * instant.
   */
  scenes?: SceneSet | { a?: Record<string, number>; b?: Record<string, number> };
  x?: number;
  /** le crossfader pendant le rendu : [instant (s), x], par LE MEME applicateur qu'en direct sur l'horloge du rendu */
  xAt?: [number, number][];
  /** le controle negatif : chaque application saute (setValueAtTime) au lieu de glisser */
  morphStep?: boolean;
  /** une tension continue ou un sinus dans l'entree de la tranche d'une voix, au lieu de la batterie */
  dcInto?: { inst: Inst; level: number };
  sineInto?: { inst: Inst; hz: number; level: number };
  /**
   * Plusieurs mesures (2026-10-27, P2-18, tests) : chacune ses pas, ses verrous, ses scenes, l'une apres l'autre au tempo
   * du rendu, le SWING du rendu (swing, 0 par defaut) morphe par les scenes de la mesure comme l'horloge le fait.
   */
  bars?: { steps: Record<Inst, string>; locks?: Locks; scenes?: SceneSet | { a?: Record<string, number>; b?: Record<string, number> } }[];
  swing?: number;
  /**
   * La prise rendue (2026-10-27) : 'rytm', la sortie du MM-RYTM (celle de l'oscilloscope, scopeTaps().rytm), avant le
   * limiteur et l'ecreteur de secours (surechantillonne x4, il ondule de quelques 1e-7 aux coins d'une rampe) ; absente :
   * la sortie de toujours.
   */
  tap?: 'rytm';
  /**
   * Le sequenceur des trigs (V.5.1, audio/seq.ts, le motif simple seulement) : les reglages de trig par defaut du motif
   * (aucun par defaut hors ligne) ; FILL tenu pendant tout le rendu (fill) ou par instants ([instant (s), tenu]) ; LST
   * vrai a chaque passage (last) ; log : chaque coup et chaque lock trig dans offlineHits (sans log : seulement avec des
   * scenes, comme avant). Le compteur de passages part de 1 a la premiere mesure du rendu, PROB tire avec la graine seed.
   */
  trigs?: TrigSet;
  fill?: boolean;
  fillAt?: [number, boolean][];
  last?: boolean;
  log?: boolean;
}

/** Ce que l'applicateur du dernier rendu hors ligne a pose (tests) : [instant (s), x]. */
let offlineMorphLog: [number, number][] = [];
/** Les coups du dernier rendu hors ligne (tests) : instant, voix, mesure, pas, hauteur, DECAY. */
export interface OfflineHit {
  t: number;
  inst: Inst;
  bar: number;
  step: number;
  pf: number;
  decay: number;
  /** avec log (V.5.1) : le gain du coup (velocite et VOL), 'note', 'rep' (une repetition) ou 'lock' (un lock trig), LEN (s) */
  gain?: number;
  kind?: 'note' | 'rep' | 'lock';
  len?: number | null;
  /** avec log : la valeur de chaque LFO du coup a son debut, par destination (la somme des deux LFO, -1 a 1) */
  lfo?: Partial<Record<LfoDest, number>>;
}
let offlineHitsLog: OfflineHit[] = [];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Les LFO d'un coup au journal (tests) : leur valeur a son debut, par destination. */
const lfoLog = (l: HitLfo): Partial<Record<LfoDest, number>> => {
  const out: Partial<Record<LfoDest, number>> = {};
  for (const x of l.list) out[x.dest] = lfoSum(l.list, x.dest, l.pos, l.anchor);
  return out;
};

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
  // Les scenes du rendu (2026-10-27) : sans elles, rien de ce qui suit ne change le rendu d'avant
  const sc: SceneSet = o.scenes ? (cleanScenes(o.scenes) ?? NO_SCENES) : NO_SCENES;
  const morphed = sc !== NO_SCENES;
  const xs = (o.xAt ?? []).filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  let xNow = clamp01(o.x ?? 0);
  /** le x d'un coup a son instant (les evenements du crossfader passes) */
  const xOfHit = (t: number): number => {
    let v = clamp01(o.x ?? 0);
    for (const [te, xe] of xs) {
      if (te > t) break;
      v = clamp01(xe);
    }
    return v;
  };
  const baseFx: Fx = { ...pattern.fx.get(), ...FX_SETTINGS, ...(o.fxs ?? {}), drive: o.drive ?? 0, reverb: o.reverb ?? 0, delay: o.delay ?? 0, chorus: o.chorus ?? 0, dtime: o.dtime ?? DTIME_DEFAULT, dfb: o.dfb ?? DFB_DEFAULT, bits: o.bits ?? 0, comp: o.comp ?? 0 };
  const voiceBase = (inst: Inst): VoiceFx => ({ ...VOICE_FX_DEFAULT, ...(o.voice?.[inst] ?? {}) });
  const f0 = morphed ? morphFxPure(baseFx, sc, xNow) : null;
  const settingsOf = (f: Readonly<Fx>): Partial<Record<FxSettingId, number>> => Object.fromEntries(FX_SETTING_IDS.map((k) => [k, f[k] ?? FX_SETTINGS[k]]));
  offlineMorphLog = [];
  offlineHitsLog = [];
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
      drive: f0 ? f0.drive : (o.drive ?? 0),
      reverb: f0 ? f0.reverb : (o.reverb ?? 0),
      delay: f0 ? f0.delay : (o.delay ?? 0),
      chorus: f0 ? f0.chorus : (o.chorus ?? 0),
      dtime: f0 ? f0.dtime : (o.dtime ?? DTIME_DEFAULT),
      dfb: f0 ? f0.dfb : (o.dfb ?? DFB_DEFAULT),
      fxs: f0 ? settingsOf(f0) : (o.fxs ?? {}),
      bpm: o.bpm,
      voice: morphed ? (Object.fromEntries(INSTRUMENTS.map((i) => [i, morphVoicePure(i, voiceBase(i), sc, xNow)])) as Record<Inst, VoiceFx>) : (o.voice ?? {}),
      master: 1,
      bare: o.bare,
    });
    // Les reglages de chaque voix hors ligne : neutres, sauf ceux imposes ; le meme calcul de coup qu'en direct
    const vfx = (inst: Inst): VoiceFx => ({ ...VOICE_FX_DEFAULT, ...(o.voice?.[inst] ?? {}), tone: snapTone(o.voice?.[inst]?.tone ?? 0) });
    /** un coup : sans scene le calcul d'avant ; avec, le morphing du coup au x de son instant (morphHitPure, comme en direct) */
    const hitOf = (inst: Inst, lock: Readonly<StepLock> | null, t: number, s: SceneSet = sc, lfo: HitLfo | null = null): { hp: HitParams; fx: Readonly<VoiceFx>; lock: Readonly<StepLock> | null } => {
      if (s === NO_SCENES) {
        const fx = vfx(inst);
        if (!lfo) return { hp: hitParams(inst, false, lock, tone0, stretch0, fx), fx, lock };
        // Les LFO pris au moment du coup (V.5.1), comme en direct
        const lh = lfoHitLock(lfo, fx, lock);
        return { hp: hitParams(inst, false, lh.lock, tone0, stretch0, fx), fx, lock: lh.lock };
      }
      const m = morphHitPure(inst, vfx(inst), lock, s, xOfHit(t));
      const lh = lfoHitLock(lfo, m.fx, m.lock);
      return { hp: hitParams(inst, false, lh.lock, tone0, stretch0, m.fx, m.kit), fx: m.fx, lock: lh.lock };
    };
    // Les inserts DIST et CHORUS des voix qui en ont un verrou dans le rendu (2026-10-09) : tenus engages, comme en direct ;
    // ceux que les scenes du rendu menent aussi, et DIST et CHORUS du bus (2026-10-27)
    const rLocks = o.single ? (o.singleLock ? ({ [o.single]: { 0: o.singleLock } } as Locks) : null) : o.locks;
    const fxOff = (i: Inst): Readonly<Partial<Record<string, number>>> | null => o.voice?.[i] ?? null;
    if (morphed) holdScenes(g, rLocks, insertNeedsOf(sc), fxOff);
    else holdInserts(g, rLocks, NO_NEEDS, fxOff);
    const probeIn = o.dcInto ?? o.sineInto;
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
    } else if (probeIn) {
      // Une source continue dans la tranche (2026-10-27) : ce que l'applicateur fait de son niveau et de ses envois
      const a = oc.createGain();
      a.gain.value = o.sineInto ? o.sineInto.level : 1;
      a.connect(voiceIn(g, probeIn.inst));
      if (o.sineInto) {
        const osc = oc.createOscillator();
        osc.frequency.value = o.sineInto.hz;
        osc.connect(a);
        osc.start(0);
      } else {
        const dc = oc.createConstantSource();
        dc.offset.value = o.dcInto?.level ?? 0;
        dc.connect(a);
        dc.start(0);
      }
    } else if (o.bars && o.bars.length > 0) {
      // Les mesures l'une apres l'autre (2026-10-27) : chaque coup avec les scenes de sa mesure, au x de son instant ; le
      // SWING du rendu morphe par elles, le retard de l'horloge (les pas pairs, SWING.maxDelay du pas)
      const step = 60 / (o.bpm ?? pattern.get().bpm) / 4;
      const swingBase: Fx = { ...baseFx, swing: o.swing ?? 0 };
      o.bars.forEach((bar, b) => {
        const bs = bar.scenes ? (cleanScenes(bar.scenes) ?? NO_SCENES) : NO_SCENES;
        for (let s = 0; s < STEP_COUNT; s += 1) {
          const t0 = 0.02 + (b * STEP_COUNT + s) * step;
          const sw = (s & 1) === 1 ? morphFxPure(swingBase, bs, xOfHit(t0)).swing * SWING.maxDelay * step : 0;
          const t = t0 + sw;
          if (t >= o.seconds - 0.05) continue;
          for (const inst of INSTRUMENTS) {
            const v = velocity(bar.steps, inst, s);
            if (v === 0) continue;
            const h = hitOf(inst, lockOf(bar.locks, inst, s), t0, bs);
            const hp = h.hp;
            const entry = hitEntry(g, inst, hp, h.fx, VEL_GAIN[v] * hp.gain);
            const vo = voice(g, inst, t, entry.dest, hp, true);
            offlineHitsLog.push({ t, inst, bar: b, step: s, pf: hp.pf, decay: hp.decay });
            if (vo) {
              postSends(g, inst, t, h.lock, vo);
              postInserts(g, inst, t, h.lock, vo);
              voices.push(vo);
            }
          }
        }
      });
    } else if (o.single) {
      const h = hitOf(o.single, o.singleLock ?? null, 0.05);
      const hp = h.hp;
      const entry = hitEntry(g, o.single, hp, h.fx, hp.gain);
      const v = voice(g, o.single, 0.05, entry.dest, hp, true);
      if (v) {
        postSends(g, o.single, 0.05, h.lock, v);
        postInserts(g, o.single, 0.05, h.lock, v);
        voices.push(v);
      }
    } else {
      const steps = o.steps ?? pattern.get().steps;
      const step = 60 / (o.bpm ?? pattern.get().bpm) / 4;
      // Le sequenceur des trigs (V.5.1, audio/seq.ts), le meme qu'en direct : au depart, exactement la boucle d'avant (une
      // voix apres l'autre, un coup par pas a velocite, a l'heure du pas, avec ses verrous)
      const st = seqState(o.seed ?? 808);
      const trigs = o.trigs ?? NO_TRIGS;
      const fills = (o.fillAt ?? []).filter(([t]) => Number.isFinite(t)).sort((a, b) => a[0] - b[0]);
      const fillOf = (t: number): boolean => {
        let f = o.fill === true;
        for (const [te, on] of fills) {
          if (te > t) break;
          f = on;
        }
        return f;
      };
      const log = morphed || o.log === true;
      const fxSeq = (i: Inst): Readonly<Partial<Record<string, number>>> | null => o.voice?.[i] ?? null;
      for (let n = 0, t = 0.02; t < o.seconds - 0.5; n += 1, t += step) {
        const s = n % STEP_COUNT;
        const bar = Math.floor(n / STEP_COUNT);
        const out = seqStep(st, { s, pos: n, when: t, grid: t, dur: step, steps, locks: o.locks, trigs, ctx: { pass: bar + 1, fill: fillOf(t), last: o.last === true }, plays: () => true, fxOf: fxSeq });
        for (const hit of out.hits) {
          const inst = hit.inst;
          // Un uTIME negatif au tout premier pas tombe avant le rendu : au debut
          const th = Math.max(0, hit.t);
          const live = liveNeeds(o.locks, inst);
          const prev = st.v[inst].last as Voice | null;
          const sq: HitSeq | undefined = hit.len !== null || hit.lfo || hit.roll || live ? { len: hit.len, lfo: hit.lfo, roll: hit.roll, rep: hit.rep, prev, live } : undefined;
          const h = hitOf(inst, hit.lock, th, sc, hit.lfo);
          const hp = h.hp;
          const ex = seqExtra(hp, h.fx, h.lock, sq);
          const gain = hit.vel * hp.gain;
          const entry = hitEntry(g, inst, hp, h.fx, gain);
          const vo = voice(g, inst, th, entry.dest, hp, true, ex);
          if (log) offlineHitsLog.push({ t: th, inst, bar, step: s, pf: hp.pf, decay: hp.decay, ...(o.log ? { gain, kind: hit.rep ? ('rep' as const) : ('note' as const), len: hit.len, ...(hit.lfo ? { lfo: lfoLog(hit.lfo) } : {}) } : {}) });
          if (vo) {
            if (hit.rep && prev) rollCut(prev, th, vo);
            postSends(g, inst, th, h.lock, vo);
            postInserts(g, inst, th, h.lock, vo);
            voices.push(vo);
            seqLast(st, inst, vo);
          }
        }
        for (const lt of out.locks) {
          const tl = Math.max(0, lt.t);
          voices.push(lockTrigOn(g, lt.inst, tl, lt.lock, lt.last as Voice | null, lt.anchor));
          if (o.log) offlineHitsLog.push({ t: tl, inst: lt.inst, bar, step: s, pf: 0, decay: 0, gain: 0, kind: 'lock', len: null });
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
  // BIT et COMP (2026-10-18) : le worklet en place comme en direct, avec les reglages du rendu (ceux absents a leur depart)
  let glueFx: Fx = f0 ? { ...f0 } : { ...pattern.fx.get(), ...FX_SETTINGS, ...(o.fxs ?? {}), bits: o.bits ?? 0, comp: o.comp ?? 0 };
  if (!o.bare && o.glue !== false) await attachGlue(oc, g, () => glueFx, false);
  // La sortie comme en direct : le limiteur (rendu sans lui si l'AudioWorklet manque)
  if (!o.bare && o.limiter !== false) await attachLimiter(oc, g);
  if (o.tap === 'rytm') {
    g.master.disconnect();
    g.rytmOut.connect(oc.destination);
  }
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
    .concat(
      (o.fxAt ?? []).map(([t, patch]) => ({
        t,
        run: () => {
          glueFx = { ...glueFx, ...patch };
          if (g.glue) setGlue(g.glue, glueFx);
        },
      }))
    )
    .sort((a, b) => a.t - b.t);
  /*
   * Une seule suspension par quantum (2026-10-27 : les evenements du crossfader et l'applicateur s'y ajoutent ; deux
   * suspensions au meme instant levaient) : chaque instant garde la liste de ce qui s'y fait, dans l'ordre.
   */
  const slots = new Map<number, (() => void | Promise<void>)[]>();
  const endT = oc.length / sr;
  const sched = (t: number, fn: () => void | Promise<void>): void => {
    if (!(t < endT)) return;
    const list = slots.get(t);
    if (list) {
      list.push(fn);
      return;
    }
    const fns = [fn];
    slots.set(t, fns);
    void oc.suspend(t).then(async () => {
      for (const f of fns) await f();
      slots.delete(t);
      void oc.resume();
    });
  };
  const used = new Set<number>();
  for (const e of events) {
    const t0 = at(e.t);
    const t1 = at(e.t + 0.03);
    if (used.has(t0) || used.has(t1)) continue;
    used.add(t0);
    used.add(t1);
    sched(t0, () => e.run());
    sched(t1, () => sleep(80));
  }
  // Le crossfader pendant le rendu : chaque evenement a son quantum, LE MEME applicateur qu'en direct, sur l'horloge du rendu
  if (morphed && xs.length > 0) {
    let settled = false;
    const voicesMorphed = INSTRUMENTS.filter((i) => morphVoicePure(i, VOICE_FX_DEFAULT, sc, 0) !== VOICE_FX_DEFAULT);
    const applyOff = (): void => {
      const f = morphFxPure(baseFx, sc, xNow);
      glideMode.step = o.morphStep === true;
      try {
        if (f !== baseFx) {
          glueFx = { ...f };
          applyFx(g, f, settled);
        }
        for (const inst of voicesMorphed) applyVoice(g, inst, morphVoicePure(inst, voiceBase(inst), sc, xNow));
      } finally {
        glideMode.step = false;
      }
      offlineMorphLog.push([oc.currentTime, xNow]);
    };
    const clock: ApplierClock = {
      now: () => oc.currentTime,
      later(fn: () => void, ms: number): () => void {
        let on = true;
        const now = oc.currentTime;
        let t = Math.ceil((now + ms / 1000) / q - 1e-9) * q;
        if (t <= now + q / 2) t = now + q;
        sched(t, () => {
          if (on) fn();
        });
        return () => {
          on = false;
        };
      },
    };
    const ap = makeApplier(clock, morphGapOf(sr), applyOff);
    for (const [t, v] of xs) {
      sched(Math.max(q, at(t)), () => {
        xNow = clamp01(v);
        ap.request();
      });
    }
    // La fin du geste : la forme de la REVERB une fois, comme au lacher en direct
    sched(Math.max(q, at(xs[xs.length - 1][0] + XFADE_UI.settleMs / 1000)), () => {
      settled = true;
      ap.request();
    });
  }
  const buf = await oc.startRendering();
  return buf.getChannelData(Math.min(buf.numberOfChannels - 1, o.channel ?? 0)).slice();
}

/* ---------------- debug (window.__v4.audio) ---------------- */

/** La source de test du graphe vivant (2026-10-27, probe) */
let probeSrc: { src: AudioScheduledSourceNode; gain: GainNode } | null = null;
function probe(inst: Inst | null, o?: { dc?: number; hz?: number; level: number } | null): void {
  if (!FLAGS.mute || !FLAGS.debug) throw new Error('probe: ?mute=1&debug=1 only');
  if (probeSrc) {
    try {
      probeSrc.src.stop();
    } catch {
      /* deja arretee */
    }
    probeSrc.src.disconnect();
    probeSrc.gain.disconnect();
    probeSrc = null;
  }
  const g = graph;
  const c = ctx;
  if (!inst || !o || !g || !c) return;
  enforceMute(g);
  if (g.master.gain.value !== 0) throw new Error('probe: MASTER is not 0');
  const gain = c.createGain();
  gain.gain.value = Number.isFinite(o.level) ? o.level : 0;
  gain.connect(voiceIn(g, inst));
  let src: AudioScheduledSourceNode;
  if (o.hz !== undefined) {
    const osc = c.createOscillator();
    osc.frequency.value = o.hz;
    src = osc;
  } else {
    const dc = c.createConstantSource();
    dc.offset.value = o.dc ?? 1;
    src = dc;
  }
  src.connect(gain);
  src.start();
  probeSrc = { src, gain };
}


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
  /** les samples de Mika gardes dans ce navigateur (2026-10-18, audio/usersamples.ts : add, remove, list, subscribe) */
  readonly userSamples: typeof userSamples;
  /** les listes de samples (le site puis ce navigateur, audio/samples.ts) : samplesOf, sampleByKey, loadSample, samplePcm, version */
  readonly samples: { samplesOf: typeof samplesOf; sampleByKey: typeof sampleByKey; loadSample: typeof loadSample; samplePcm: typeof samplePcm; version: () => number; status: typeof sampleStatus; stats: typeof sampleStats };
  /** le SIDECHAIN du MM-ARP (2026-10-04) */
  duck(): ReturnType<typeof duckInfo>;
  /** le SIDECHAIN du MM-BASS (2026-10-10) */
  bassDuck(): ReturnType<typeof bassDuckInfo>;
  /** BIT et COMP (2026-10-18) : le worklet en place, ce qu'il a recu en dernier (valeurs reelles) ; null avant lui */
  readonly glue: { ready: boolean; set: GlueSet | null } | null;
  /** la reduction du COMP (dB) que montre l'aiguille de sa page */
  compGr(): number;
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
  /** les lock trigs appliques depuis le chargement (V.5.1 ; en direct et hors ligne) */
  readonly lockTrigs: number;
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
  /** le gain MASTER au dernier bloc rendu (2026-10-27 : 0 sous ?mute=1 ; null avant le premier geste) */
  readonly masterGain: number | null;
  /**
   * Une source de test dans l'entree de la tranche d'une voix du graphe vivant (2026-10-27, les tests des scenes) : une
   * tension continue (dc) ou un sinus (hz), jamais un coup ni RUN ; seulement sous ?mute=1&debug=1 (sinon une exception),
   * MASTER a 0. probe(null) l'enleve.
   */
  probe(inst: Inst | null, o?: { dc?: number; hz?: number; level: number } | null): void;
  /** le controle negatif des tests (2026-10-27) : vrai, l'applicateur des scenes pose ses reglages en sauts */
  morphStep: boolean;
  /** ce que l'applicateur du dernier rendu hors ligne a pose : [instant (s), x] */
  readonly offlineMorph: readonly [number, number][];
  /** les coups du dernier rendu hors ligne avec scenes ou mesures (2026-10-27) */
  readonly offlineHits: readonly OfflineHit[];
  /**
   * Ce qu'un coup de inst demanderait au cache maintenant (2026-10-27, P2-18, tests) : le meme chemin que trigger
   * (morph.hit, hitParams, shots.get paresseux), sans voix, sans son ; sa hauteur, son STRETCH, s'il etait pret.
   */
  hitProbe(inst: Inst, lock?: StepLock | null): { pf: number; ts: number; lazy: boolean; ready: boolean; got: boolean } | null;
  /** les preparations des deux bouts d'un balayage (prepareScenes) */
  readonly scenePrep: { runs: number; prepared: number; at: number };
}

/** DIST, envois et unites REVERB et DELAY, CHORUS du bus (debug). */
export interface FxDebug {
  drive: number;
  driveOn: boolean;
  /** les debranchements de la branche DIST du bus, sa tenue par les scenes (2026-10-27) */
  driveUnlinks: number;
  driveHeld: boolean;
  /** le DIST global sur la voie du kick (2026-10-18) */
  kickDriveOn: boolean;
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
  /** l'insert DIST de la tranche (2026-10-27 : tenu par un verrou ou une scene, ses debranchements) */
  driveIns: ReturnType<DriveStage['insert']>;
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
  userSamples,
  samples: { samplesOf, sampleByKey, loadSample, samplePcm, version: samplesVersion, status: sampleStatus, stats: sampleStats },
  duck: () => duckInfo(),
  bassDuck: () => bassDuckInfo(),
  get glue() {
    return graph ? { ready: graph.glue !== null, set: glueSet } : null;
  },
  compGr,
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
      driveUnlinks: d.unlinks,
      driveHeld: d.held === true,
      kickDriveOn: graph.kickFx ? graph.kickFx.info().driveOn : false,
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
        { gain: ch[i].input.gain.value, tone: ch[i].tone.info(), drive: ch[i].drive.value(), driveIns: ch[i].drive.insert(), chorus: ch[i].chorus.info(), reverb: ch[i].reverb.info(), delay: ch[i].delay.info() },
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
  get lockTrigs() {
    return lockTrigs;
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
  get masterGain() {
    return graph ? graph.master.gain.value : null;
  },
  probe,
  get morphStep() {
    return morphStepLive;
  },
  set morphStep(on: boolean) {
    morphStepLive = on === true;
  },
  get offlineMorph() {
    return offlineMorphLog;
  },
  get offlineHits() {
    return offlineHitsLog;
  },
  hitProbe(inst: Inst, lock: StepLock | null = null) {
    const c = ctx;
    if (!c) return null;
    const m = morph.hit(inst, lock, pattern.scenes.get());
    const hp = hitParams(inst, false, m.lock, tone, morph.stretch(), m.fx, m.kit, m.lazy);
    const ready = shots.ready(hp.id, hp.ts, hp.pf, c.sampleRate, hp.ov);
    const got = shots.get(hp.id, hp.ts, hp.pf, c.sampleRate, false, hp.ov, hp.lazy === true) !== null;
    return { pf: hp.pf, ts: hp.ts, lazy: hp.lazy === true, ready, got };
  },
  scenePrep,
};
