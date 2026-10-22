/**
 * Le son du MM-VOYAGER (2026-10-03, revu le meme jour apres l'essai de
 * Mika : "beaucoup de knobs qui ne fonctionnent pas", "les FX flagrants",
 * "le plus proche possible d'un Voyager"). Le moteur est un AudioWorklet
 * (audio/moog.worklet.js : trois oscillateurs, filtre en echelle 24 dB,
 * enveloppes analogiques, DIST dans le filtre et a sa sortie), charge au
 * premier geste. Il joue les notes que l'arpegiateur lui envoie, chacune a
 * son instant (temps du contexte). MOD (2026-10-18) : a chaque pas,
 * l'arpegiateur lui dit aussi ou il en est (synthBeat : la place du pas en
 * temps, son tempo) ; le LFO y lit sa phase, cale sur la mesure.
 *
 * Apres lui, dans le graphe :
 *   moteur -> CHORUS (celui du Juno-106 : OFF, I, II, chorus.ts) -> VOLUME -> analyseur
 *   de la boite a rythmes, apres son compresseur (drums.synthPort :
 *   analyseur, limiteur, master, ?mute=1 tient)
 *   VOLUME -> DELAY : le sien, ping-pong stereo en croche pointee calee sur
 *   le tempo, reinjection qui monte avec le potard (0.35 a 0.68)
 *   VOLUME -> REVERB : la reverbe de la boite, envoi renforce.
 * BASS MONO (TWEAKS, 2026-10-04) : un filtre de separation Linkwitz-Riley
 * (24 dB/oct, les deux moities se recomposent sans creux) coupe le son du
 * moteur en deux ; le haut suit la chaine ci-dessus, le bas passe en mono
 * et va droit a la sortie, sans chorus, sans delay ni reverbe : plus de
 * phase qui tourne dans les graves. OFF : la separation descend a 10 Hz,
 * tout passe par le haut, comme avant.
 * Le contexte audio est celui de la page, jamais cree ici.
 */

import workletUrl from './moog.worklet.js?url';
import { chorusMode, delaySixteenths, duckDepthDb, engineParams, fxAmount, monoLowHz, voyParams, type VoyValues } from '../voyager/params';
import { buildJunoChorus, loadChorus, tapeNode, type ChorusStage } from './chorus';
import { setArpDuck, synthPort } from './drums';
import { glide } from './glide';
import { pattern } from './pattern';
import type { Send } from './sends';
import { voyMsg } from '../voyager/msg';

/**
 * Surechantillonnage du moteur (2026-10-03, qualite) : 4 sur ordinateur,
 * 2 au telephone (pointeur grossier : le calcul compte plus).
 */
const coarse = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
const engineOs = (): number => (coarse() ? 2 : 4);
/**
 * Les voix du moteur (2026-10-21, audit F3 : de longs RELEASE gardaient 12 voix calculees en x4, 70 a 135 % du temps
 * reel) : 12 sur ordinateur, 8 au telephone ; la neuvieme note y vole la voix la plus discrete.
 */
const engineVoices = (): number => (coarse() ? 8 : 12);
/**
 * STACK (2026-10-22, audit P8) : trois exemplaires de chaque oscillateur sur ordinateur, deux au telephone (le calcul
 * des oscillateurs double ou triple, celui du filtre non ; mesure : scripts/arp-bench.mjs --cpu).
 */
const engineStack = (): number => (coarse() ? 2 : 3);
/**
 * WIDE (2026-10-22) : quatre notes au plus avec leur filtre de droite au telephone (la cinquieme joue au centre de sa
 * place), huit sur ordinateur (la relecture, mesure scripts/arp-bench.mjs --cpu : 12 voix tenues avec STACK, WIDE et
 * GLUE prenaient 104 % du temps reel en x4 sur la machine de test, 92 % a huit ; les presets jouent 1 a 3 notes).
 */
const engineWide = (): number => (coarse() ? 4 : 8);

/**
 * VOLUME a 1 (gain au carre), et reprise de niveau : DELAY et REVERB
 * s'ajoutent au son sec. 1.03 : le MM-RYTM et le MM-ARP au meme niveau dans
 * les mediums (0.75 le 2026-10-03, quand le synthe passait encore par le
 * compresseur de la batterie et son gain de compensation automatique).
 * 0.7 depuis le 2026-10-07 (Mika : "le kick est la reference, tout ce qu'il
 * y a apres ne doit pas etre aussi fort que lui") : l'arpege par defaut
 * crete vers -9 dBFS, 4 dB sous le kick (il cretait au-dessus). 0.37 le
 * 2026-10-08, mesure en sortie reelle : la batterie n'a plus de compresseur
 * (son gain de compensation gonflait le kick), l'ARP reste 3 a 5 dB sous lui,
 * avec le rattrapage de -3 dB des trois machines (drums.ts RYTM_TRIM).
 */
// 0.66 le 2026-10-10 (+5 dB, le VU du MIXER : l'ARP cretait 10 dB sous le MM-RYTM, drums.ts RYTM_TRIM)
const VOLUME_K = 0.66;
const MAKEUP = { delay: 0.35, reverb: 0.5 } as const;
/** REVERB : envoi renforce vers la reverbe partagee. */
const REVERB_BOOST = 1.25;
/**
 * DELAY ping-pong : croche pointee, reinjection 0.35 a 0.68, filtre dans la boucle. wet 0.8 (2026-10-21, audit F9 ;
 * 1.1 avant : a 100 %, le premier echo sortait 4 dB au-dessus de la note seche, l'arpege semblait recule) : le
 * premier echo au plus au niveau du son sec. retimeS : un changement de tempo regle le temps en glissant, comme une
 * bande (2026-10-21, audit F12 : 20 ms avant, les echos piaillaient quand on tournait TEMPO). retimeRate (2026-10-22,
 * relecture : un cran de DLY TIME glissait aussi en 200 ms, la tete reculait des 1/4 vers 3/8, -2.75x de 1/8 a 1/2) :
 * le temps glisse d'au plus 0.25 s par seconde, la tete lit entre 0.75x et 1.25x (une bande qui ralentit ou
 * accelere, jamais a l'envers) ; un grand ecart glisse donc plus longtemps (3 s de 1/8 a 1/2 a 120 BPM).
 */
const PINGPONG = { steps: 3, fbMin: 0.35, fbMax: 0.68, wet: 0.8, lowpass: 4800, highpass: 260, maxS: 2, retimeS: 0.2, retimeRate: 0.25 } as const;
/**
 * DLY TIME et TAPE (2026-10-22, audit P10) : le temps du DELAY est celui de DLY TIME (en doubles croches ; 3/16, la
 * croche pointee de PINGPONG.steps, au depart et pour un son garde d'avant) ; TAPE au-dessus de 0 passe l'envoi du
 * DELAY des DelayNode (le delai net) au delai a bande (audio/chorus.worklet.js 'mm-tape') : les echos deja partis
 * finissent dans les DelayNode, les nouveaux vont sur la bande (l'envoi glisse en 20 ms d'un chemin a l'autre).
 */
const delayS = (p: Readonly<VoyValues>, bpm?: number): number => Math.min(PINGPONG.maxS, delaySixteenths(p.dlyTime) * (bpm ? 60 / bpm / 4 : stepOf()));
/** BASS MONO coupe : la separation descend ici (rien d'audible dessous). */
const MONO_OFF_HZ = 10;
/** Butterworth (Q en dB pour les passe-bas et passe-haut du Web Audio) : deux en cascade font un Linkwitz-Riley. */
const BUTTER_Q_DB = -3.0103;

interface SynthGraph {
  ctx: BaseAudioContext;
  node: AudioWorkletNode;
  chorus: ChorusStage;
  vol: GainNode;
  delaySend: GainNode;
  delayFb: [GainNode, GainNode];
  delayL: DelayNode;
  delayR: DelayNode;
  /** TAPE (2026-10-22) : l'envoi vers le delai a bande, le noeud (null tant que son module n'est pas la), sa sortie */
  tapeSend: GainNode;
  tape: AudioWorkletNode | null;
  wet: GainNode;
  /** le temps du DELAY pose (DLY TIME, tempo) */
  delayAt: number;
  /** un rendu hors ligne : son tempo (le delai s'y cale, 2026-10-22 ; avant, celui du motif de la page) */
  bpm?: number;
  reverb: Send;
  /** BASS MONO : les quatre filtres de la separation, le gain du bas (le VOLUME) */
  split: BiquadFilterNode[];
  low: GainNode;
}

let sg: SynthGraph | null = null;
let loading: Promise<void> | null = null;
/**
 * Le moteur qui ne se charge pas (2026-10-21, audit F2 : un seul echec, un reseau qui hoquette ou un onglet ouvert
 * avant une mise en ligne, laissait l'ARP muet toute la visite, l'ecran jouant quand meme) : chaque echec est compte,
 * le moteur se recharge de lui-meme a la note suivante apres 1, 3 puis 10 s, ou tout de suite au prochain geste, et
 * l'ecran le dit (NO SOUND, TAP TO RETRY ; une version plus recente en ligne : NEW VERSION, RELOAD).
 */
const RETRY_MS = [1000, 3000, 10000] as const;
const RETRY_TAP_MS = 500;
let failures = 0;
let retryAt = 0;
let lastTry = 0;
/** les voix et le surechantillonnage du moteur charge (debug) */
let built = { voices: 0, os: 0, stack: 0 };
/** notes envoyees avant que le moteur soit pret : parties a son arrivee (EARLY_MAX au plus, les plus recentes) */
const early: { midi: number; time: number; gate: number; accent: number; from: number | null }[] = [];
const EARLY_MAX = 64;
let notes = 0;
/** La porte la plus courte d'une note (2026-10-21, audit F10 : 20 ms avant, le bas de GATE ne faisait rien ; le moteur garde 64 echantillons). */
export const GATE_MIN_S = 0.005;

/**
 * Une ancre du transport (2026-10-18, MOD cale sur la mesure) : a `time` (temps du contexte), l'arpege en est a
 * `beat` temps depuis le debut de sa premiere mesure, au tempo `bpm` jusqu'au pas suivant ; run : le premier pas
 * d'un RUN. Le moteur y lit la phase du LFO (audio/moog.worklet.js).
 */
export interface SynthBeat {
  time: number;
  beat: number;
  bpm: number;
  run: boolean;
}
/** les ancres envoyees avant que le moteur soit pret : parties a son arrivee */
const earlyBeats: SynthBeat[] = [];
/** les dernieres ancres envoyees (debug) */
const beatLog: SynthBeat[] = [];
const BEAT_LOG = 64;
/** les lectures du LFO en attente de la reponse du moteur (debug) */
const probes = new Map<number, (r: SynthLfoProbe) => void>();
let probeId = 0;

/** Le LFO lu dans le moteur (debug, synthDebug.lfo) : le meme calcul que le son. */
export interface SynthLfoProbe {
  /** l'echantillon du contexte de la lecture, la position du transport (en temps) et en cycles du LFO */
  frame: number;
  beat: number;
  cycle: number;
  /** la forme a cet instant (-1 a +1, avant DEPTH et le lissage de 2 ms), la sortie lissee */
  raw: number;
  out: number;
  /** une ancre de l'arpege tient la position (sinon : libre, au tempo) ; le tempo de la droite ; les ancres a venir */
  locked: boolean;
  bpm: number;
  shape: number;
  pending: number;
}

const stepOf = (): number => 60 / pattern.get().bpm / 4;

/** Le delay ping-pong du synthe : gauche, droite, gauche... en croche pointee. */
function buildPingPong(c: BaseAudioContext, out: AudioNode, t: number): { send: GainNode; fb: [GainNode, GainNode]; l: DelayNode; r: DelayNode; wet: GainNode } {
  const send = c.createGain();
  send.gain.value = 0;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = PINGPONG.highpass;
  const l = c.createDelay(PINGPONG.maxS);
  const r = c.createDelay(PINGPONG.maxS);
  l.delayTime.value = t;
  r.delayTime.value = t;
  const lpL = c.createBiquadFilter();
  lpL.type = 'lowpass';
  lpL.frequency.value = PINGPONG.lowpass;
  const lpR = c.createBiquadFilter();
  lpR.type = 'lowpass';
  lpR.frequency.value = PINGPONG.lowpass;
  const fbL = c.createGain();
  const fbR = c.createGain();
  fbL.gain.value = PINGPONG.fbMin;
  fbR.gain.value = PINGPONG.fbMin;
  const merge = c.createChannelMerger(2);
  // Mono vers la gauche ; la gauche repond a droite, la droite a gauche
  send.connect(hp);
  hp.connect(l);
  l.connect(lpL);
  lpL.connect(merge, 0, 0);
  lpL.connect(fbL);
  fbL.connect(r);
  r.connect(lpR);
  lpR.connect(merge, 0, 1);
  lpR.connect(fbR);
  fbR.connect(l);
  const wet = c.createGain();
  wet.gain.value = PINGPONG.wet;
  merge.connect(wet);
  wet.connect(out);
  return { send, fb: [fbL, fbR], l, r, wet };
}

const butter = (c: BaseAudioContext, type: BiquadFilterType): BiquadFilterNode => {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = MONO_OFF_HZ;
  f.Q.value = BUTTER_Q_DB;
  return f;
};

function build(c: BaseAudioContext, out: AudioNode, reverb: { attach(src: AudioNode): Send }, node: AudioWorkletNode, bpm?: number): SynthGraph {
  const vol = c.createGain();
  vol.gain.value = 0;
  vol.connect(out);
  const chorus = buildJunoChorus(c, vol);
  // BASS MONO : le haut vers le chorus, le bas en mono droit a la sortie
  const hp1 = butter(c, 'highpass');
  const hp2 = butter(c, 'highpass');
  node.connect(hp1);
  hp1.connect(hp2);
  hp2.connect(chorus.input);
  const mono = c.createGain();
  mono.channelCount = 1;
  mono.channelCountMode = 'explicit';
  mono.channelInterpretation = 'speakers';
  const lp1 = butter(c, 'lowpass');
  const lp2 = butter(c, 'lowpass');
  const low = c.createGain();
  low.gain.value = 0;
  node.connect(mono);
  mono.connect(lp1);
  lp1.connect(lp2);
  lp2.connect(low);
  low.connect(out);
  const pp = buildPingPong(c, out, delayS(voyParams.get(), bpm));
  vol.connect(pp.send);
  // TAPE (2026-10-22) : l'envoi vers la bande, a 0 tant qu'elle n'est pas la ou que TAPE est a 0
  const tapeSend = c.createGain();
  tapeSend.gain.value = 0;
  vol.connect(tapeSend);
  const boost = c.createGain();
  boost.gain.value = REVERB_BOOST;
  vol.connect(boost);
  const g: SynthGraph = { ctx: c, node, chorus, vol, delaySend: pp.send, delayFb: pp.fb, delayL: pp.l, delayR: pp.r, tapeSend, tape: null, wet: pp.wet, delayAt: delayS(voyParams.get(), bpm), bpm, reverb: reverb.attach(boost), split: [hp1, hp2, lp1, lp2], low };
  tapeNode(c, PINGPONG.maxS, (n) => {
    g.tape = n;
    tapeSend.connect(n);
    n.connect(g.wet);
    tapeTime(n).value = delayS(voyParams.get(), bpm);
    applyFx(g, voyParams.get(), true);
  });
  applyFx(g, voyParams.get(), true);
  return g;
}

const tapeTime = (n: AudioWorkletNode): AudioParam => n.parameters.get('time') as AudioParam;

/** CHORUS, DELAY, REVERB, VOLUME et BASS MONO sur la chaine. */
function applyFx(g: SynthGraph, p: Readonly<VoyValues>, now = false): void {
  // CHORUS (2026-10-12) : OFF, I ou II du Juno-106
  g.chorus.set(chorusMode(p.chorus));
  g.reverb.set(p.reverb);
  const fb = PINGPONG.fbMin + (PINGPONG.fbMax - PINGPONG.fbMin) * p.delay;
  // TAPE (2026-10-22) : l'envoi du DELAY va a la bande ou aux DelayNode, jamais aux deux
  const tape = fxAmount(p.tape);
  const onTape = tape > 0 && g.tape !== null;
  const tp = g.tape?.parameters;
  const v = volGain(p);
  // Le bas : le meme VOLUME, au niveau du synthe sec (mesure hors ligne : le plus proche du son
  // d'avant ; le chorus creusait les graves vers 100 Hz, BASS MONO les rend)
  const hz = monoLowHz(p.monoLow) || MONO_OFF_HZ;
  const low = v;
  for (const f of g.split) {
    if (now) f.frequency.value = hz;
    else glide(f.frequency, hz, g.ctx);
  }
  if (now) {
    g.low.gain.value = low;
    g.vol.gain.value = v;
    g.delaySend.gain.value = onTape ? 0 : p.delay;
    g.tapeSend.gain.value = onTape ? p.delay : 0;
    g.delayFb[0].gain.value = fb;
    g.delayFb[1].gain.value = fb;
    if (tp) {
      (tp.get('fb') as AudioParam).value = fb;
      (tp.get('tape') as AudioParam).value = tape;
    }
  } else {
    glide(g.low.gain, low, g.ctx);
    glide(g.vol.gain, v, g.ctx);
    glide(g.delaySend.gain, onTape ? 0 : p.delay, g.ctx);
    glide(g.tapeSend.gain, onTape ? p.delay : 0, g.ctx);
    glide(g.delayFb[0].gain, fb, g.ctx);
    glide(g.delayFb[1].gain, fb, g.ctx);
    if (tp) {
      glide(tp.get('fb') as AudioParam, fb, g.ctx);
      glide(tp.get('tape') as AudioParam, tape, g.ctx);
    }
  }
  // DLY TIME (2026-10-22) : le temps des deux chemins, en glissant comme une bande (comme un changement de tempo)
  const t = delayS(p, g.bpm);
  if (now) {
    g.delayL.delayTime.value = t;
    g.delayR.delayTime.value = t;
    if (g.tape) tapeTime(g.tape).value = t;
    g.delayAt = t;
  } else if (t !== g.delayAt) retimeAll(g, t);
}

/** Le temps du DELAY qui change (DLY TIME, le tempo) : les deux chemins y glissent (PINGPONG.retimeS, retimeRate). */
function retimeAll(g: SynthGraph, t: number): void {
  g.delayAt = t;
  retime(g.delayL.delayTime, t, g.ctx);
  retime(g.delayR.delayTime, t, g.ctx);
  if (g.tape) retime(tapeTime(g.tape), t, g.ctx);
}

/** Le gain de VOLUME apres le moteur (le sec et le bas de BASS MONO), DELAY et REVERB repris. */
const volGain = (p: Readonly<VoyValues>): number => (p.volume * p.volume * VOLUME_K) / (1 + MAKEUP.delay * p.delay + MAKEUP.reverb * p.reverb);

/**
 * Les reglages du moteur, et le tempo (le LFO de MOD est cale dessus, 2026-10-04) ; outLevel (2026-10-21) : le gain de
 * VOLUME, pour que l'ecreteur doux du moteur (audit F7) parte a -6 dBFS de la sortie, quel que soit VOLUME.
 */
const engineMsg = (v: Readonly<VoyValues>, bpm: number = pattern.get().bpm): Record<string, number> => ({ ...engineParams(v), bpm, outLevel: volGain(v) });

voyParams.subscribe(() => {
  if (!sg) return;
  applyFx(sg, voyParams.get());
  sg.node.port.postMessage({ type: 'params', params: engineMsg(voyParams.get()) });
});

/* SIDECHAIN (2026-10-04) : la prise du MM-ARP baisse a chaque kick du MM-RYTM (audio/duck.ts) */
const applyDuck = (): void => setArpDuck(duckDepthDb(voyParams.of('duck')) / 24);
voyParams.subscribe(applyDuck);
applyDuck();

/*
 * Tempo : le delay garde sa division (DLY TIME, 2026-10-22), le LFO suit. Le temps du delay seulement quand il change
 * (une edition du motif ne le refait plus), en glissant depuis ou il en est (2026-10-21, audit F12) : en
 * PINGPONG.retimeS au moins, plus longtemps pour un grand ecart (retimeRate, 2026-10-22 : la tete jamais a l'envers).
 */
let lastBpm = pattern.get().bpm;
function retime(p: AudioParam, t: number, c: BaseAudioContext): void {
  const now = c.currentTime;
  const from = p.value;
  p.cancelScheduledValues(now);
  p.setValueAtTime(from, now);
  p.linearRampToValueAtTime(t, now + Math.max(PINGPONG.retimeS, Math.abs(t - from) / PINGPONG.retimeRate));
}
pattern.subscribe(() => {
  if (!sg) return;
  const t = delayS(voyParams.get());
  if (t !== sg.delayAt) retimeAll(sg, t);
  const bpm = pattern.get().bpm;
  if (bpm !== lastBpm) {
    lastBpm = bpm;
    sg.node.port.postMessage({ type: 'params', params: { bpm } });
  }
});

/** Le moteur n'a pas pu se charger : l'ecran le dit ; un fichier parti (une version plus recente en ligne) : recharger la page. */
function engineTrouble(): void {
  const show = (stale: boolean): void => voyMsg.show(stale ? 'NEW VERSION, RELOAD' : 'NO SOUND, TAP TO RETRY', 5000);
  if (typeof fetch !== 'function') {
    show(false);
    return;
  }
  fetch(workletUrl, { method: 'HEAD', cache: 'no-store' })
    .then((r) => show(r.status === 404))
    .catch(() => show(false));
}

/**
 * Charge le moteur sur le contexte de la page (au premier geste, et des
 * qu'une note est demandee) ; sans contexte ou sans AudioWorklet, rien.
 * Apres un echec (2026-10-21) : un geste (user) le retente tout de suite,
 * une note apres RETRY_MS.
 */
export function prepareSynth(user = true): void {
  if (sg || loading) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (failures > 0 && (user ? now - lastTry < RETRY_TAP_MS : now < retryAt)) return;
  const port = synthPort();
  if (!port || !port.ctx.audioWorklet) return;
  const c = port.ctx;
  lastTry = now;
  loading = c.audioWorklet
    .addModule(workletUrl)
    .then(() => {
      const node = new AudioWorkletNode(c, 'mm-voyager', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { params: engineMsg(voyParams.get()), os: engineOs(), maxVoices: engineVoices(), maxStack: engineStack(), wideVoices: engineWide() },
      });
      built = { voices: engineVoices(), os: engineOs(), stack: engineStack() };
      node.port.onmessage = (e: MessageEvent) => {
        const m = e.data as { type?: string; id?: number } & SynthLfoProbe;
        if (m?.type !== 'probe' || typeof m.id !== 'number') return;
        const done = probes.get(m.id);
        probes.delete(m.id);
        done?.(m);
      };
      // La prise du MM-ARP (le canal 2 du mixer du MM-DECKS peut la prendre), sa REVERB a lui
      sg = build(c, port.arp, port.reverb, node);
      if (failures > 0) voyMsg.show('SOUND ENGINE READY');
      // Les notes arrivees avant le moteur : celles encore a venir partent
      const now = c.currentTime;
      for (const n of early) if (n.time > now - 0.05) node.port.postMessage({ type: 'note', ...n, time: Math.max(n.time, now) });
      early.length = 0;
      // Les ancres du transport aussi, toutes (une passee compte : le moteur prolonge sa droite jusqu'a maintenant)
      for (const b of earlyBeats) node.port.postMessage({ type: 'beat', ...b });
      earlyBeats.length = 0;
    })
    .catch(() => {
      failures += 1;
      retryAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + RETRY_MS[Math.min(failures, RETRY_MS.length) - 1];
      // Les notes en attente ne partiront pas : elles seraient passees au prochain essai
      early.length = 0;
      engineTrouble();
    })
    .finally(() => {
      loading = null;
    });
}

/**
 * Une note a `time` (temps du contexte), porte de `gate` s ; from : la
 * note precedente (GLIDE). false sans contexte.
 */
export function noteOn(midi: number, time: number, gate: number, from: number | null = null, accent = 1): boolean {
  const msg = { midi, time, gate: Math.max(GATE_MIN_S, gate), accent, from };
  notes += 1;
  if (sg) {
    sg.node.port.postMessage({ type: 'note', ...msg });
    return true;
  }
  if (!synthPort()) return false;
  prepareSynth(false);
  // En attente du moteur (il se charge) : la note partira a son arrivee ; un moteur en echec, entre deux essais : rien
  if (loading) {
    early.push(msg);
    if (early.length > EARLY_MAX) early.shift();
  }
  return true;
}

/**
 * Un vrai relachement (2026-10-22, audit VST3) : la note midi relachee a `time` (temps du contexte), pour une note jouee
 * sans fin (noteOn avec gate Infinity : un clavier MIDI, le futur plugin) ; jamais avant ses 64 premiers echantillons.
 * En attente du moteur : la note gardee prend la duree qui va jusque la.
 */
export function noteOff(midi: number, time: number): void {
  if (sg) {
    sg.node.port.postMessage({ type: 'noteOff', midi, time });
    return;
  }
  for (const n of early) if (n.midi === midi && n.time <= time) n.gate = Math.min(n.gate, Math.max(GATE_MIN_S, time - n.time));
}

/**
 * Re-programmation de l'arpegiateur (2026-10-05) : les notes attendues a
 * partir de `from` (temps du contexte) sont oubliees, ce qui sonne continue.
 */
export function synthCancel(from: number): void {
  for (let i = early.length - 1; i >= 0; i -= 1) if (early[i].time >= from) early.splice(i, 1);
  for (let i = earlyBeats.length - 1; i >= 0; i -= 1) if (earlyBeats[i].time >= from) earlyBeats.splice(i, 1);
  if (sg) sg.node.port.postMessage({ type: 'cancel', time: from });
}

/** STOP de l'arpegiateur : plus rien d'attendu, ce qui sonne s'eteint en 12 ms ; le LFO de MOD tourne librement au tempo. */
export function synthStop(): void {
  early.length = 0;
  earlyBeats.length = 0;
  if (sg) sg.node.port.postMessage({ type: 'stop', time: sg.ctx.currentTime });
}

/**
 * MOD cale sur la mesure (2026-10-18) : chaque pas de l'arpegiateur dit au moteur ou il en est (voyager/arp.ts) ;
 * `time` le pas sur la grille (sans le retard du swing), `beat` sa place en temps, `stepDur` la duree du pas.
 * Un pas re-programme renvoie la meme ancre (synthCancel oublie l'ancienne).
 */
export function synthBeat(time: number, beat: number, stepDur: number, run = false): void {
  if (!Number.isFinite(time) || !Number.isFinite(beat) || !(stepDur > 0)) return;
  const b: SynthBeat = { time, beat, bpm: 60 / (4 * stepDur), run };
  beatLog.push(b);
  if (beatLog.length > BEAT_LOG) beatLog.shift();
  if (sg) sg.node.port.postMessage({ type: 'beat', ...b });
  else if (synthPort()) {
    earlyBeats.push(b);
    if (earlyBeats.length > BEAT_LOG) earlyBeats.shift();
  }
}

/* ---------------- rendu hors ligne (tests : rien ne sort des enceintes) ---------------- */

export interface SynthOfflineOpts {
  seconds: number;
  sampleRate?: number;
  /** notes [midi, debut (s), porte (s), accent ?] ; accent 1 sans lui (2026-10-21 : l'accent de l'arpege, ACC FILTER) */
  notes: ([number, number, number] | [number, number, number, number])[];
  /** reglages imposes (les autres : ceux du store) */
  params?: Partial<VoyValues>;
  /** envois REVERB et DELAY (true par defaut) */
  sends?: boolean;
  /** surechantillonnage du moteur (4 par defaut) */
  os?: 1 | 2 | 4;
  /** les voix du moteur (12 par defaut ; 8 : celles du telephone, 2026-10-21) */
  maxVoices?: number;
  /** les exemplaires de STACK au plus (3 par defaut ; 2 : ceux du telephone, 2026-10-22) */
  maxStack?: number;
  /** les notes de WIDE au plus avec leur filtre de droite (8 par defaut, celles de l'ordinateur ; 4 : le telephone, 2026-10-22) */
  wideVoices?: number;
  /** le hasard du moteur a graine (2026-10-22, audio/moog.worklet.js processorOptions.seed) */
  seed?: number;
  /** tempo du LFO de MOD (celui du motif par defaut) */
  bpm?: number;
  /** MOD (2026-10-18) : les ancres du transport (synthBeat), connues au depart */
  beats?: { time: number; beat: number; bpm: number; run?: boolean }[];
  /** des messages au moteur a leur instant (s) : { type: 'beat' | 'stop' | 'cancel' | 'params', ... }, comme ceux du port */
  timeline?: { at: number; msg: Record<string, unknown> }[];
  /** true : la sortie dit le LFO au lieu du son (gauche : sa forme, -1 a +1 ; droite : la position en temps), sans la chaine d'effets */
  probe?: boolean;
}

/** Rendu stereo hors ligne de la chaine complete ; renvoie [gauche, droite]. */
export async function renderSynthOffline(o: SynthOfflineOpts): Promise<[Float32Array, Float32Array]> {
  const sr = o.sampleRate ?? 48000;
  const oc = new OfflineAudioContext(2, Math.round(o.seconds * sr), sr);
  await oc.audioWorklet.addModule(workletUrl);
  await loadChorus(oc);
  const { buildReverbBus } = await import('./sends');
  const out = oc.createGain();
  out.connect(oc.destination);
  const reverb = buildReverbBus(oc, out);
  const p = { ...voyParams.get(), ...(o.params ?? {}) };
  const extra = { beats: o.beats ?? [], timeline: o.timeline ?? [], probe: o.probe === true };
  let prev: number | null = null;
  const list = o.notes.map(([m, t, gate, accent]) => {
    const n = { midi: m, time: t, gate, accent: accent ?? 1, from: prev };
    prev = m;
    return n;
  });
  const node = new AudioWorkletNode(oc, 'mm-voyager', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    processorOptions: { params: engineMsg(o.sends === false ? { ...p, delay: 0, reverb: 0 } : p, o.bpm), notes: list, os: o.os ?? 4, maxVoices: o.maxVoices ?? 12, maxStack: o.maxStack ?? 3, wideVoices: o.wideVoices ?? 8, ...(Number.isFinite(o.seed) ? { seed: o.seed } : {}), ...extra },
  });
  if (extra.probe) {
    // Le LFO tel quel : droit a la sortie, sans chorus ni filtres de BASS MONO
    node.connect(oc.destination);
    const buf = await oc.startRendering();
    return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
  }
  const noSend = { attach: () => ({ set: () => undefined, info: () => ({ value: 0, linked: false }) }) };
  const g = build(oc, out, o.sends === false ? noSend : reverb, node, o.bpm);
  applyFx(g, o.sends === false ? { ...p, delay: 0, reverb: 0 } : p, true);
  const buf = await oc.startRendering();
  return [buf.getChannelData(0).slice(), buf.getChannelData(1).slice()];
}

/* ---------------- debug (window.__v4.voyager.synth) ---------------- */

export const synthDebug = {
  get built(): boolean {
    return sg !== null;
  },
  /** le dernier chargement du moteur a rate (il sera retente, 2026-10-21) */
  get failed(): boolean {
    return sg === null && failures > 0;
  },
  /** les chargements rates depuis l'ouverture de la page */
  get failures(): number {
    return failures;
  },
  get loading(): boolean {
    return loading !== null;
  },
  /** les voix et le surechantillonnage du moteur charge (0 avant lui ; 2026-10-21 : 8 voix et x2 au telephone) */
  get engine(): { voices: number; os: number; stack: number } {
    return { ...built };
  },
  /** DLY TIME et TAPE (2026-10-22) : le temps pose, la bande chargee, les envois (net, bande) */
  get delay(): { time: number; tape: boolean; send: number; tapeSend: number; tapeAmt: number } | null {
    if (!sg) return null;
    return { time: sg.delayAt, tape: sg.tape !== null, send: sg.delaySend.gain.value, tapeSend: sg.tapeSend.gain.value, tapeAmt: (sg.tape?.parameters.get('tape') as AudioParam | undefined)?.value ?? 0 };
  },
  /** DLY TIME et tempo (2026-10-22, relecture) : le glissement du temps du DELAY, sur un parametre au choix (tests hors ligne) */
  retime,
  get notes(): number {
    return notes;
  },
  get volGain(): number | undefined {
    return sg?.vol.gain.value;
  },
  get chorus() {
    return sg?.chorus.info() ?? null;
  },
  /** MOD (2026-10-18) : les dernieres ancres du transport envoyees au moteur, de la plus ancienne a la plus recente */
  get beats(): SynthBeat[] {
    return beatLog.map((b) => ({ ...b }));
  },
  /** MOD : le LFO lu dans le moteur maintenant (null sans moteur, ou sans reponse en 1 s) */
  lfo(): Promise<SynthLfoProbe | null> {
    const g = sg;
    if (!g) return Promise.resolve(null);
    probeId += 1;
    const id = probeId;
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        probes.delete(id);
        resolve(null);
      }, 1000);
      probes.set(id, (r) => {
        window.clearTimeout(timer);
        resolve(r);
      });
      g.node.port.postMessage({ type: 'probe', id });
    });
  },
  /** la frequence d'echantillonnage du contexte de la page (une ancre, en secondes, contre lfo().frame) */
  get sampleRate(): number | undefined {
    return sg?.ctx.sampleRate;
  },
  renderOffline: renderSynthOffline,
};
