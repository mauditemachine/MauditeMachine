/**
 * Le moteur audio du MM-DECKS (2026-10-04), repris des Decks de sonaa.ca
 * (src/platines/moteur.ts) et branche sur le son du site :
 *
 *   platine A -> voie 1 \
 *                        > somme -> effets -> MASTER -> limiteur -> port du site
 *   platine B -> voie 2 /
 *
 * Le port du site (audio/drums.ts synthPort) mene a l'analyseur, au
 * limiteur et au master de la page : ?mute=1 coupe aussi les platines, et
 * il n'y a qu'un AudioContext, ne au premier geste. Chaque platine decode
 * son morceau en entier (un AudioBuffer) : depart a l'echantillon pres,
 * vitesse fine, grains du jog en pause. Les reglages glissent en 20 ms
 * (audio/glide.ts, jamais setTargetAtTime). Un effet a zero est vraiment
 * debranche (comme ceux de la 808).
 */

import { glide } from '../audio/glide';
import { synthPort } from '../audio/drums';
import { GUARD_S, TICK_MS, horizon, registerScheduler, reserve } from '../audio/sched';
import { decodeAudio } from './decode';
import { CROSSOVER, bandEnergy, bandGain, bandOverview, beatsToSeconds, dbToGain, eqDb, gainDb, energy, faderGain, filterOf, fxMix, speedOf } from './math';
import { DJ_CHANNELS_MAX, DJ_DECKS_ALL, DJ_FX, DJ_PLAYERS, deckChannel, type DjDeck, type DjFxId } from './theme';

/** Q de Butterworth : en dB pour passe-bas et passe-haut (piege de Web Audio), lineaire pour le passe-tout. */
const BUTTERWORTH_DB = 20 * Math.log10(Math.SQRT1_2);
const BUTTERWORTH = Math.SQRT1_2;
const RESONANCE = 4;
/** Tranches de la forme d'onde de toute la piste (le bas de l'ecran de la platine). */
export const OVERVIEW_SLICES = 1024;
/**
 * La forme d'onde fine : 400 cretes par seconde, une par pixel quand l'ecran
 * montre une seconde ; de quoi poser un cue sur l'attaque d'une grosse
 * caisse (les Decks de Sonaa, DETAIL_PAR_SECONDE).
 */
export const DETAIL_RATE = 400;

/**
 * Les trois bandes d'un morceau arrivent apres lui (quelques centaines de
 * millisecondes de calcul, par morceaux) : la scene s'abonne ici pour
 * reposer ses textures (dj/rig.ts).
 */
const waveListeners = new Set<() => void>();
export const djWaveBands = {
  subscribe(fn: () => void): () => void {
    waveListeners.add(fn);
    return () => {
      waveListeners.delete(fn);
    };
  },
};
/** Le temps de calcul des bandes avant de rendre la main (ms). */
const BAND_SLICE_MS = 10;

function peakOf(a: AnalyserNode, buf: Float32Array): number {
  a.getFloatTimeDomainData(buf);
  let max = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = Math.abs(buf[i]);
    if (v > max) max = v;
  }
  return max;
}

/**
 * La crete exacte d'un point du graphe, gauche et droite (2026-10-04, les
 * vumetres : "precis par rapport au volume de chacun") : un analyseur rend
 * un melange mono (L + R) / 2 qui sous-estime un son large ; on separe donc
 * les deux canaux. 2048 echantillons, plus qu'une image a 30 i/s : aucune
 * crete ne passe entre deux lectures.
 */
class StereoPeak {
  /** un son mono sort des deux enceintes : il se lit a gauche et a droite */
  private up: GainNode;
  private split: ChannelSplitterNode;
  private a: [AnalyserNode, AnalyserNode];
  private buf: [Float32Array, Float32Array];
  private src: AudioNode | null = null;

  constructor(
    private ctx: BaseAudioContext,
    src: AudioNode
  ) {
    this.up = new GainNode(ctx, { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
    this.split = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    this.up.connect(this.split);
    this.a = [new AnalyserNode(ctx, { fftSize: 2048 }), new AnalyserNode(ctx, { fftSize: 2048 })];
    this.buf = [new Float32Array(2048), new Float32Array(2048)];
    this.split.connect(this.a[0], 0);
    this.split.connect(this.a[1], 1);
    this.tap(src);
  }

  /** Mesurer ailleurs (le master du site apres son limiteur). */
  tap(src: AudioNode): void {
    if (this.src) this.src.disconnect(this.up);
    this.src = src;
    src.connect(this.up);
  }

  /** Cretes gauche et droite (lineaires, 1 = 0 dBFS). */
  peaks(): [number, number] {
    return [peakOf(this.a[0], this.buf[0]), peakOf(this.a[1], this.buf[1])];
  }
}

/* ---------------- une voie de la table ---------------- */

/**
 * Isolateur trois bandes : Linkwitz-Riley du quatrieme ordre (deux
 * Butterworth en cascade) a 250 Hz et 2,5 kHz, les graves recales en phase
 * par un passe-tout ; a plat au centre, chaque bande coupable (kill).
 */
export class DjChannel {
  readonly input: GainNode;
  readonly xf: GainNode;
  private low: GainNode;
  private mid: GainNode;
  private high: GainNode;
  private lp: BiquadFilterNode;
  private hp: BiquadFilterNode;
  /**
   * Au centre, l'isolateur et le filtre sont court-circuites (2026-10-04) :
   * meme plat en module, la recombinaison des trois bandes tourne la phase et
   * change la forme d'un kick (sa crete baissait de 3.5 dB, mesure par la
   * session Maudite Machine). Le son d'une voie au repos est donc exactement
   * celui qui entre : celui des machines du site ne change pas. Tourne, le
   * chemin bascule en 20 ms.
   */
  private eqPath: GainNode;
  private eqDirect: GainNode;
  private filterPath: GainNode;
  private filterDirect: GainNode;
  private bands = { hi: 0, mid: 0, low: 0 };
  private fader: GainNode;
  private meter: StereoPeak;
  /** FX TO (2026-10-04) : la voie passe par les effets, ou tout droit au master */
  private toFx: GainNode;
  private toDry: GainNode;

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
    dry: AudioNode = out
  ) {
    this.input = new GainNode(ctx);
    this.low = new GainNode(ctx);
    this.mid = new GainNode(ctx);
    this.high = new GainNode(ctx);
    const f = (type: BiquadFilterType, frequency: number): BiquadFilterNode =>
      new BiquadFilterNode(ctx, { type, frequency, Q: type === 'allpass' ? BUTTERWORTH : BUTTERWORTH_DB });
    // L'isolateur (chemin eqPath) ou tout droit (eqDirect), vers eqOut
    this.eqPath = new GainNode(ctx, { gain: 0 });
    this.eqDirect = new GainNode(ctx, { gain: 1 });
    const eqOut = new GainNode(ctx);
    const sum = new GainNode(ctx);
    this.input.connect(this.eqPath);
    this.input.connect(this.eqDirect).connect(eqOut);
    this.eqPath.connect(f('lowpass', CROSSOVER.low)).connect(f('lowpass', CROSSOVER.low)).connect(f('allpass', CROSSOVER.high)).connect(this.low).connect(sum);
    const above = this.eqPath.connect(f('highpass', CROSSOVER.low)).connect(f('highpass', CROSSOVER.low));
    above.connect(f('lowpass', CROSSOVER.high)).connect(f('lowpass', CROSSOVER.high)).connect(this.mid).connect(sum);
    above.connect(f('highpass', CROSSOVER.high)).connect(f('highpass', CROSSOVER.high)).connect(this.high).connect(sum);
    sum.connect(eqOut);
    // Le filtre (filterPath) ou tout droit (filterDirect), vers le fader
    this.lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000, Q: BUTTERWORTH_DB });
    this.hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10, Q: BUTTERWORTH_DB });
    this.filterPath = new GainNode(ctx, { gain: 0 });
    this.filterDirect = new GainNode(ctx, { gain: 1 });
    this.fader = new GainNode(ctx, { gain: faderGain(0.8) });
    eqOut.connect(this.filterPath).connect(this.lp).connect(this.hp).connect(this.fader);
    eqOut.connect(this.filterDirect).connect(this.fader);
    this.xf = new GainNode(ctx, { gain: Math.SQRT1_2 });
    // Le VU mesure apres le fader : exactement ce que la voie envoie au master
    this.meter = new StereoPeak(ctx, this.fader);
    this.toFx = new GainNode(ctx, { gain: 1 });
    this.toDry = new GainNode(ctx, { gain: 0 });
    this.fader.connect(this.xf);
    this.xf.connect(this.toFx).connect(out);
    this.xf.connect(this.toDry).connect(dry);
  }

  /** FX TO : par les effets (true) ou tout droit (false), en 20 ms. */
  sendFx(on: boolean): void {
    glide(this.toFx.gain, on ? 1 : 0, this.ctx);
    glide(this.toDry.gain, on ? 0 : 1, this.ctx);
  }

  setGain(v: number): void {
    glide(this.input.gain, dbToGain(gainDb(v)), this.ctx);
  }

  setBand(band: 'hi' | 'mid' | 'low', v: number): void {
    glide((band === 'hi' ? this.high : band === 'mid' ? this.mid : this.low).gain, bandGain(v), this.ctx);
    this.bands[band] = v;
    // Les trois au centre : tout droit ; une seule tournee : par l'isolateur
    const flat = Math.abs(this.bands.hi) < 0.005 && Math.abs(this.bands.mid) < 0.005 && Math.abs(this.bands.low) < 0.005;
    glide(this.eqPath.gain, flat ? 0 : 1, this.ctx);
    glide(this.eqDirect.gain, flat ? 1 : 0, this.ctx);
  }

  /** Plat au repos (et court-circuite) ; la resonance (4) seulement quand on le tourne. */
  setFilter(v: number): void {
    const f = filterOf(v);
    glide(this.lp.frequency, f.type === 'low' ? f.freq : 20000, this.ctx);
    glide(this.hp.frequency, f.type === 'high' ? f.freq : 10, this.ctx);
    glide(this.lp.Q, f.type === 'low' ? RESONANCE : BUTTERWORTH_DB, this.ctx);
    glide(this.hp.Q, f.type === 'high' ? RESONANCE : BUTTERWORTH_DB, this.ctx);
    glide(this.filterPath.gain, f.type === 'none' ? 0 : 1, this.ctx);
    glide(this.filterDirect.gain, f.type === 'none' ? 1 : 0, this.ctx);
  }

  setFader(x: number): void {
    glide(this.fader.gain, faderGain(x), this.ctx);
  }

  /** Crete lineaire apres le fader (le plus fort des deux canaux), pour le VU. */
  level(): number {
    const [l, r] = this.meter.peaks();
    return Math.max(l, r);
  }
}

/* ---------------- les effets, sur le bus ---------------- */

interface Stage {
  id: DjFxId;
  pre: AudioNode;
  dry: GainNode;
  wet: GainNode;
  /** l'entree du traitement : branchee seulement quand la dose est au-dessus de zero */
  proc: AudioNode;
  on: boolean;
  off: number;
}

const curve = (fn: (x: number) => number): Float32Array => {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
};

/**
 * La saturation de l'overdrive : douce (tanh), asymetrique (un biais de 0.2,
 * retire pour que le silence reste le silence), ramenee a [-1, 1].
 */
const BIAS = 0.2;
const warmPeak = Math.max(Math.tanh(2 + BIAS) - Math.tanh(BIAS), Math.tanh(BIAS) - Math.tanh(-2 + BIAS));
const warm = (x: number): number => (Math.tanh(2 * x + BIAS) - Math.tanh(BIAS)) / warmPeak;

/**
 * Le niveau rattrape de l'overdrive (2026-10-21, audit) : avant, il etait regle
 * pour un sinus a -6 dBFS ; les machines sonnent autour de -16 a -24 dBFS RMS,
 * et l'OVERDRIVE les rendait de 5 a 16 dB plus fortes (le limiteur du site
 * baissait alors tout). Deux etages :
 * - OD_POST, le gain de sortie par dose (33 crans, interpole), mesure hors
 *   ligne avec la chaine elle-meme : un bruit rose a -18 dBFS RMS garde son
 *   niveau a chaque dose ;
 * - un suiveur lent (OD_FOLLOW), sur le son en direct : le niveau qui sort de
 *   la saturation est ramene a celui qui y entre (moyenne sur 300 ms, de -18
 *   a +6 dB ; la premiere mesure est prise telle quelle, 50 ms apres
 *   l'ouverture), un son discret ou un morceau fort gardent le leur. La dose
 *   change la couleur, pas le volume.
 */
const OD_POST: readonly number[] = [0.74, 0.689, 0.638, 0.607, 0.556, 0.509, 0.485, 0.454, 0.441, 0.403, 0.381, 0.36, 0.338, 0.313, 0.302, 0.298, 0.282, 0.273, 0.27, 0.25, 0.247, 0.241, 0.241, 0.235, 0.232, 0.224, 0.224, 0.224, 0.219, 0.217, 0.217, 0.217, 0.215];
const odPost = (d: number): number => {
  const x = Math.max(0, Math.min(1, d)) * (OD_POST.length - 1);
  const i = Math.min(OD_POST.length - 2, Math.floor(x));
  return OD_POST[i] + (OD_POST[i + 1] - OD_POST[i]) * (x - i);
};
const OD_FOLLOW = { everyMs: 50, tauS: 0.3, minDb: -18, maxDb: 6, quiet: 1e-4 } as const;

/** La moyenne quadratique de ce qu'un analyseur voit (2048 echantillons). */
function rmsOf(a: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  a.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i += 1) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

/** Une salle synthetique : du bruit qui decroit. */
function room(ctx: AudioContext, seconds: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  return b;
}

/**
 * L'arete de la porte du TRANS (2026-10-21, audit) : 2 ms de rampe a chaque
 * ouverture et fermeture. Avant, un oscillateur carre la menait : 0.1 a
 * 0.2 ms de montee, un clic a chaque coupure sur une basse ou un kick.
 */
const EDGE_S = 0.002;

/** Une grille en doubles croches : la premiere frontiere a t ou apres, son rang dans la mesure (0 a 15), sa duree (audio/clock.ts gridAfter). */
export type FxGrid = (t: number) => { time: number; step: number; dur: number } | null;

/**
 * Une automation calee sur les temps (2026-10-21, audit) : la porte du
 * TRANS et le balayage du FLANGER ne sont plus des oscillateurs libres, partis
 * a la creation du moteur et qui coupaient entre les temps. Leurs points sont
 * ecrits d'avance sur l'horloge audio, comme les notes des machines
 * (audio/sched.ts), depuis l'origine d'une mesure de la reference, par
 * demi-periodes : porte ouverte puis fermee, balayage en triangle (en bas sur
 * le temps, en haut a mi-chemin). Une autre grille (un tempo, une platine qui
 * part, les machines qui demarrent) garde ce qui est deja ecrit jusqu'au
 * prochain point et repart de la : pas de saut, pas de clic.
 */
class GridLane {
  /** les points ecrits (fin de rampe) : leur instant et leur valeur */
  private pts: { t: number; v: number }[] = [];
  /** l'instant du dernier point ecrit, et la valeur la */
  private until = 0;
  private v = 0;
  on = false;

  constructor(
    private param: AudioParam,
    private rest: number,
    private kind: 'gate' | 'tri'
  ) {}

  /** La valeur au debut de la demi-periode h : porte ouverte (1) puis fermee (0) ; triangle en bas (-1) puis en haut (1). */
  private at(h: number): number {
    const even = ((h % 2) + 2) % 2 === 0;
    return this.kind === 'gate' ? (even ? 1 : 0) : even ? -1 : 1;
  }

  /** La valeur voulue a t (origine o, demi-periode half). */
  private want(t: number, o: number, half: number): number {
    const x = (t - o) / half;
    const h = Math.floor(x + 1e-9);
    if (this.kind === 'gate') return this.at(h);
    return this.at(h) + (this.at(h + 1) - this.at(h)) * Math.max(0, Math.min(1, x - h));
  }

  private push(t: number, v: number): void {
    this.pts.push({ t, v });
    if (this.pts.length > 512) this.pts.splice(0, this.pts.length - 512);
    this.until = t;
    this.v = v;
  }

  start(t: number, o: number, half: number): void {
    this.on = true;
    this.param.cancelScheduledValues(0);
    const v = this.want(t, o, half);
    this.param.setValueAtTime(v, t);
    this.pts = [];
    this.push(t, v);
  }

  stop(now: number): void {
    if (!this.on) return;
    this.on = false;
    this.pts = [];
    this.param.cancelScheduledValues(0);
    this.param.setValueAtTime(this.rest, now);
  }

  /** Une autre grille : on garde jusqu'au premier point a venir (au-dela de GUARD_S), le reste s'efface. */
  cut(now: number): void {
    const i = this.pts.findIndex((p) => p.t >= now + GUARD_S);
    if (i < 0) return;
    const p = this.pts[i];
    this.param.cancelScheduledValues(p.t + 1e-6);
    this.pts.length = i + 1;
    this.until = p.t;
    this.v = p.v;
  }

  /** Ecrit les points jusqu'a to, plus un au-dela (la rampe en cours d'un balayage lent doit exister). */
  write(now: number, to: number, o: number, half: number): void {
    if (!this.on || !(half > 0)) return;
    // Le fil principal a dormi : rien n'est ecrit devant ; on repart d'un point tenu, juste devant
    if (this.until < now + GUARD_S) {
      this.param.setValueAtTime(this.v, now + GUARD_S);
      this.push(now + GUARD_S, this.v);
    }
    let h = Math.floor((this.until - o) / half + 1e-9);
    if (this.kind === 'gate') {
      // La nouvelle grille veut l'autre etat la ou on reprend : l'arete tout de suite, sauf si la suivante est toute
      // proche (elle remettrait l'etat d'avant : un eclat de quelques millisecondes)
      const w = this.at(h);
      if (w !== this.v && o + (h + 1) * half - this.until > half / 4) this.edge(this.until, w);
    }
    for (let guard = 0; this.until <= to && guard < 1024; guard += 1) {
      h += 1;
      const t = o + h * half;
      const v = this.at(h);
      if (t <= this.until + 1e-6) continue;
      if (this.kind === 'gate') {
        if (v !== this.v) this.edge(t, v);
      } else {
        // Apres un recalage, un point trop proche est saute : la rampe va au suivant, jamais plus raide que deux fois la normale
        if (Math.abs(v - this.v) > (4 / half) * (t - this.until)) continue;
        this.param.linearRampToValueAtTime(v, t);
        this.push(t, v);
      }
    }
  }

  private edge(t: number, v: number): void {
    this.param.setValueAtTime(this.v, t);
    this.param.linearRampToValueAtTime(v, t + EDGE_S);
    this.push(t + EDGE_S, v);
  }
}

/**
 * Sept effets en serie, globaux (Mika les voulait en potards) : chacun son
 * son sec et son son traite, la dose les melange (math.ts fxMix). Le delay,
 * le flanger et le trans suivent le tempo de ce qu'on entend (la platine
 * qu'on entend le plus, sinon les machines du site : dj/actions.ts
 * heardBpm), au temps choisi (TIME) ; le trans et le flanger tombent sur
 * ses temps (follow, 2026-10-21).
 */
export class DjFx {
  readonly input: GainNode;
  readonly output: GainNode;
  private stages: Stage[] = [];
  private echo: DelayNode;
  private bpm = 120;
  private beats = 1;
  /** l'overdrive : sa poussee, sa tonalite, son niveau (regles par la dose), et son suiveur de niveau (OD_FOLLOW) */
  private drive: { pre: GainNode; tone: BiquadFilterNode; post: GainNode; level: GainNode; inA: AnalyserNode; outA: AnalyserNode; buf: Float32Array<ArrayBuffer>; db: number; fresh: boolean; timer: number } | null = null;
  /** la porte du trans et le balayage du flanger, cales sur la grille (GridLane) */
  private lanes: Partial<Record<'trans' | 'flanger', GridLane>> = {};
  /** la source du balayage du flanger (-1 a 1) : les tests hors ligne l'ecoutent */
  private sweepSrc: ConstantSourceNode | null = null;
  /** la grille de la reference (dj/actions.ts), ou null : le tempo seul, depuis l'instant ou l'effet s'ouvre */
  private ref: FxGrid | null = null;
  /** l'origine d'une mesure et la duree d'un temps (s) sur lesquelles les points sont ecrits */
  private o0 = 0;
  private b0 = 0;
  private free = true;
  private dirty = false;
  private timer = 0;
  private unreg: (() => void) | null = null;

  constructor(private ctx: AudioContext) {
    this.input = new GainNode(ctx);
    this.output = new GainNode(ctx);
    const t = beatsToSeconds(this.bpm, this.beats);
    this.echo = new DelayNode(ctx, { maxDelayTime: 8, delayTime: t });
    let pre: AudioNode = this.input;
    for (const id of DJ_FX) {
      const dry = new GainNode(ctx, { gain: 1 });
      const wet = new GainNode(ctx, { gain: 0 });
      const sum = new GainNode(ctx);
      pre.connect(dry).connect(sum);
      const { input, output } = this.build(id);
      output.connect(wet).connect(sum);
      this.stages.push({ id, pre, dry, wet, proc: input, on: false, off: 0 });
      pre = sum;
    }
    pre.connect(this.output);
  }

  private build(id: DjFxId): { input: AudioNode; output: AudioNode } {
    const ctx = this.ctx;
    switch (id) {
      case 'overdrive': {
        /*
         * Un overdrive de pedale (2026-10-04, Mika : "au lieu de disto je veux
         * Overdrive") : on pousse le signal dans une saturation douce et
         * asymetrique (le biais donne des harmoniques paires, la chaleur d'un
         * tube), suivie d'une tonalite qui ferme le haut a mesure qu'on pousse
         * (pas de gresillement), puis le niveau est rattrape (OD_POST, le
         * suiveur, 2026-10-21). La dose regle la poussee : de +0 a +24 dB.
         */
        const pre = new GainNode(ctx, { gain: 1 });
        const shape = new WaveShaperNode(ctx, { curve: curve(warm), oversample: '4x' });
        // La saturation asymetrique laisse un decalage continu : un passe-haut a 15 Hz l'ote
        const dc = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 15, Q: BUTTERWORTH_DB });
        const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 12000, Q: BUTTERWORTH_DB });
        const post = new GainNode(ctx, { gain: 1 });
        // Le suiveur : ce qui entre et ce qui sort de la saturation, mesures (branches seulement quand l'effet est ouvert)
        const level = new GainNode(ctx, { gain: 1 });
        pre.connect(shape).connect(dc).connect(tone).connect(post).connect(level);
        const inA = new AnalyserNode(ctx, { fftSize: 2048 });
        const outA = new AnalyserNode(ctx, { fftSize: 2048 });
        this.drive = { pre, tone, post, level, inA, outA, buf: new Float32Array(2048), db: 0, fresh: true, timer: 0 };
        return { input: pre, output: level };
      }
      case 'crush': {
        const steps = 2 ** 5;
        const shape = new WaveShaperNode(ctx, { curve: curve((x) => Math.round(x * steps) / steps) });
        return { input: shape, output: shape };
      }
      case 'chorus': {
        const d = new DelayNode(ctx, { maxDelayTime: 0.1, delayTime: 0.022 });
        const lfo = new OscillatorNode(ctx, { frequency: 0.8 });
        lfo.connect(new GainNode(ctx, { gain: 0.004 })).connect(d.delayTime);
        lfo.start();
        return { input: d, output: d };
      }
      case 'flanger': {
        const d = new DelayNode(ctx, { maxDelayTime: 0.05, delayTime: 0.004 });
        const fb = new GainNode(ctx, { gain: 0.6 });
        d.connect(fb).connect(d);
        // Le balayage : un triangle de -1 a 1 ecrit sur la grille (GridLane), 3.2 ms de part et d'autre de 4 ms
        const sweep = new ConstantSourceNode(ctx, { offset: 0 });
        sweep.connect(new GainNode(ctx, { gain: 0.0032 })).connect(d.delayTime);
        sweep.start();
        this.sweepSrc = sweep;
        this.lanes.flanger = new GridLane(sweep.offset, 0, 'tri');
        return { input: d, output: d };
      }
      case 'trans': {
        // Une porte qui coupe le son au rythme : ouverte (1) puis fermee (0), sur la grille (GridLane)
        const gate = new GainNode(ctx, { gain: 1 });
        this.lanes.trans = new GridLane(gate.gain, 1, 'gate');
        return { input: gate, output: gate };
      }
      case 'delay': {
        const fb = new GainNode(ctx, { gain: 0.45 });
        const damp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5000 });
        this.echo.connect(damp).connect(fb).connect(this.echo);
        return { input: this.echo, output: this.echo };
      }
      case 'reverb': {
        const c = new ConvolverNode(ctx, { buffer: room(ctx, 2.8) });
        return { input: c, output: c };
      }
    }
  }

  /** La dose d'un effet (0 : coupe et debranche, 1 : plein). */
  dose(id: DjFxId, v: number): void {
    const s = this.stages.find((x) => x.id === id);
    if (!s) return;
    if (id === 'overdrive' && this.drive) {
      // La poussee (0 a +24 dB), la tonalite qui se ferme, le niveau rattrape
      const d = Math.max(0, Math.min(1, v));
      const push = 10 ** ((d * 24) / 20);
      glide(this.drive.pre.gain, push, this.ctx);
      glide(this.drive.tone.frequency, 12000 - d * 6500, this.ctx);
      // Le niveau a -18 dBFS RMS garde (OD_POST, mesure hors ligne), le suiveur fait le reste
      glide(this.drive.post.gain, odPost(d), this.ctx);
    }
    const m = fxMix(id, v);
    if (m.wet > 0 && !s.on) {
      window.clearTimeout(s.off);
      s.pre.connect(s.proc);
      s.on = true;
      this.laneOn(id);
      if (id === 'overdrive') this.follow0(s.pre, true);
    }
    glide(s.dry.gain, m.dry, this.ctx);
    glide(s.wet.gain, m.wet, this.ctx);
    if (m.wet === 0 && s.on) {
      // Debranche une fois la rampe finie (et la queue du delay ou de la reverb coupee par le wet a 0)
      window.clearTimeout(s.off);
      s.off = window.setTimeout(() => {
        if (s.wet.gain.value > 0 || !s.on) return;
        try {
          s.pre.disconnect(s.proc);
        } catch {
          /* deja debranche */
        }
        s.on = false;
        this.laneOff(id);
        if (id === 'overdrive') this.follow0(s.pre, false);
      }, 80);
    }
  }

  /**
   * Le suiveur de niveau de l'overdrive (OD_FOLLOW), branche avec l'effet ;
   * seulement sur le son en direct (un rendu hors ligne n'a pas de temps reel).
   */
  private follow0(pre: AudioNode, on: boolean): void {
    const dr = this.drive;
    if (!dr) return;
    window.clearInterval(dr.timer);
    dr.timer = 0;
    if (on) {
      if (typeof AudioContext === 'undefined' || !(this.ctx instanceof AudioContext)) return;
      pre.connect(dr.inA);
      dr.post.connect(dr.outA);
      dr.fresh = true;
      dr.timer = window.setInterval(() => this.followStep(), OD_FOLLOW.everyMs);
      return;
    }
    try {
      pre.disconnect(dr.inA);
      dr.post.disconnect(dr.outA);
    } catch {
      /* deja debranches */
    }
    dr.db = 0;
    dr.level.gain.cancelScheduledValues(0);
    dr.level.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /** Un pas du suiveur : le niveau de sortie vers celui d'entree, lentement ; un silence ne change rien. */
  private followStep(): void {
    const dr = this.drive;
    if (!dr) return;
    const rin = rmsOf(dr.inA, dr.buf);
    const rout = rmsOf(dr.outA, dr.buf);
    if (rin < OD_FOLLOW.quiet || rout < OD_FOLLOW.quiet * 0.01) return;
    const want = Math.max(OD_FOLLOW.minDb, Math.min(OD_FOLLOW.maxDb, 20 * Math.log10(rin / rout)));
    dr.db = dr.fresh ? want : dr.db + (want - dr.db) * (1 - Math.exp(-OD_FOLLOW.everyMs / 1000 / OD_FOLLOW.tauS));
    dr.fresh = false;
    glide(dr.level.gain, dbToGain(dr.db), this.ctx);
  }

  /** Le tempo des effets rythmiques : le BPM entendu et le temps (TIME). */
  tempo(o: { bpm?: number; beats?: number }): void {
    if (o.bpm !== undefined && o.bpm > 0) this.bpm = o.bpm;
    if (o.beats !== undefined && o.beats > 0) this.beats = o.beats;
    const t = beatsToSeconds(this.bpm, this.beats);
    glide(this.echo.delayTime, Math.min(8, t), this.ctx);
    // Le trans et le flanger se recalent au prochain point (GridLane.cut)
    this.dirty = true;
    if (this.timer) this.tick();
  }

  /** La grille sur laquelle le trans et le flanger tombent (dj/actions.ts : la platine entendue, sinon les machines) ; null : le tempo seul. */
  follow(ref: FxGrid | null): void {
    this.ref = ref;
    this.dirty = true;
  }

  /** Le tempo des effets (BPM), pour l'ecran et les tests. */
  get tempoBpm(): number {
    return this.bpm;
  }

  /**
   * Ecrit d'avance la porte et le balayage jusqu'a until (temps du contexte) ;
   * les tests hors ligne s'en servent (aucun minuteur n'avance dans un rendu).
   */
  schedule(until: number): void {
    this.tick(until);
  }

  /** Demi-periode de la porte (le trans : TIME / 2 par cycle) et du balayage (le flanger : 4 TIME par cycle), en s. */
  private half(id: 'trans' | 'flanger', beat: number): number {
    return id === 'trans' ? (this.beats * beat) / 4 : 2 * this.beats * beat;
  }

  /** La grille du moment : l'origine d'une mesure et la duree d'un temps ; changed si elle n'est plus celle des points ecrits. */
  private grid(now: number): { o: number; beat: number; changed: boolean } {
    const g = this.ref?.(now) ?? null;
    let o: number;
    let beat: number;
    if (g && g.dur > 0) {
      beat = 4 * g.dur;
      o = g.time - g.step * g.dur;
    } else {
      beat = 60 / (this.bpm > 0 ? this.bpm : 120);
      // Sans reference : l'origine de la grille libre tient tant que le tempo tient
      o = this.free && this.b0 > 0 ? this.o0 : now;
    }
    const bar = 4 * beat;
    let d = (o - this.o0) % bar;
    if (d > bar / 2) d -= bar;
    if (d < -bar / 2) d += bar;
    const same = !this.dirty && this.b0 > 0 && Math.abs(beat - this.b0) <= this.b0 * 1e-3 && Math.abs(d) < 0.002 && this.free === !g;
    if (same) return { o: this.o0, beat: this.b0, changed: false };
    this.o0 = o;
    this.b0 = beat;
    this.free = !g;
    this.dirty = false;
    return { o, beat, changed: true };
  }

  private tick = (until?: number): void => {
    const now = this.ctx.currentTime;
    const { o, beat, changed } = this.grid(now);
    const to = until ?? horizon(now);
    for (const id of ['trans', 'flanger'] as const) {
      const lane = this.lanes[id];
      if (!lane?.on) continue;
      if (changed) lane.cut(now);
      lane.write(now, to, o, this.half(id, beat));
    }
  };

  private laneOn(id: DjFxId): void {
    if (id !== 'trans' && id !== 'flanger') return;
    const lane = this.lanes[id];
    if (!lane || lane.on) return;
    const now = this.ctx.currentTime;
    const { o, beat } = this.grid(now);
    // Tout de suite : le son traite part de zero (son fondu de 20 ms), le premier etat ne s'entend pas basculer
    lane.start(now, o, this.half(id, beat));
    // L'autre effet deja ouvert se recale avec lui si la grille vient de changer
    this.dirty = true;
    if (!this.timer) {
      this.timer = window.setInterval(() => this.tick(), TICK_MS);
      // reserve() (un gros travail du fil principal) les fait ecrire d'avance, comme les notes
      this.unreg = registerScheduler({ tick: () => this.tick(), reschedule: () => this.tick(), order: 4 });
    }
    this.tick();
  }

  private laneOff(id: DjFxId): void {
    if (id !== 'trans' && id !== 'flanger') return;
    this.lanes[id]?.stop(this.ctx.currentTime);
    if (this.lanes.trans?.on || this.lanes.flanger?.on) return;
    window.clearInterval(this.timer);
    this.timer = 0;
    this.unreg?.();
    this.unreg = null;
  }
}

/* ---------------- la table ---------------- */

/**
 * La table a quatre voies (2026-10-04, Mika : "1 et 2 doivent etre RYTM et
 * ARP, 3 DECK A et 4 DECK B") : les deux machines du site entrent sur les
 * voies 1 et 2 (audio/drums.ts routeMachines), les platines sur 3 et 4. Le
 * crossfader ne touche que les platines (3 a gauche, 4 a droite) : la
 * batterie et l'arpege ne disparaissent jamais. Plus de limiteur ici : celui
 * du site (apres l'analyseur) suffit, et par defaut (faders 1 et 2 en haut,
 * EQ a plat, MASTER a sa place) le son des machines ne change pas.
 */
export const MASTER_DEFAULT = 0.88;

export class DjMixer {
  /** sept voies : 1 a 3 les machines (MM-RYTM, MM-BASS, MM-ARP), 4 a 7 les platines A a D */
  readonly ch: readonly DjChannel[];
  readonly fx: DjFx;
  private master: GainNode;
  private meters: StereoPeak;

  constructor(
    readonly ctx: AudioContext,
    out: AudioNode
  ) {
    const sum = new GainNode(ctx);
    this.fx = new DjFx(ctx);
    this.master = new GainNode(ctx, { gain: 1 });
    sum.connect(this.fx.input);
    this.fx.output.connect(this.master);
    this.master.connect(out);
    // Le master : ici, juste avant le limiteur du site, tant qu'on ne voit pas sa sortie (meterAfter)
    this.meters = new StereoPeak(ctx, this.master);
    // FX TO : les voies qui ne passent pas par les effets vont tout droit au master
    const dry = new GainNode(ctx);
    dry.connect(this.master);
    // Plus de crossfader (Mika, 2026-10-04) : chaque voie passe entiere, son fader seul compte
    this.ch = Array.from({ length: DJ_CHANNELS_MAX }, () => new DjChannel(ctx, sum, dry));
    for (const c of this.ch) c.xf.gain.value = 1;
  }

  /**
   * FX TO (2026-10-04) : les effets sur toutes les voies (-1), ou sur une
   * seule ; les autres passent tout droit. Les queues deja dans le delay et
   * la reverbe finissent de sonner.
   */
  setFxTo(t: number): void {
    this.ch.forEach((c, i) => c.sendFx(t < 0 || t === i));
  }


  /** MASTER : 1 a sa place par defaut (le son du site ne change pas), +2 dB tout en haut. */
  setMaster(x: number): void {
    glide(this.master.gain, faderGain(x) / faderGain(MASTER_DEFAULT), this.ctx);
  }

  /** Cretes gauche et droite du master (lineaires, 1 = 0 dBFS). */
  masterLevels(): [number, number] {
    return this.meters.peaks();
  }

  /** Le VU du master mesure la sortie du limiteur du site : jamais plus que ce qui sort vraiment. */
  meterAfter(node: AudioNode): void {
    this.meters.tap(node);
  }
}

/* ---------------- une platine ---------------- */

/**
 * Le fondu d'un depart et d'un arret (2026-10-08) : une source ne part ni
 * ne s'arrete plus net. SYNC fait maintenant partir la platine tout de
 * suite, la tete deplacee d'au plus un demi-temps (dj/actions.ts inPhase) :
 * elle peut donc partir en plein milieu d'une grosse caisse, et une onde
 * coupee en son milieu claque. 3 ms : rien ne s'entend du fondu, le clic
 * disparait. Un saut en lecture (hot cue, boucle, recalage de SYNC) passe
 * de l'ancienne source a la nouvelle en fondu croise, sans trou.
 */
const FADE_S = 0.003;
/**
 * Le rattrapage de phase de SYNC (2026-10-08) : au plus 0.3 % de vitesse,
 * cinq centiemes de demi-ton, inaudible (dj/actions.ts phaseLock).
 */
export const NUDGE_MAX = 0.003;

export class DjPlayer {
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  /** le gain de la source du moment (ses fondus) et l'instant ou elle part */
  private env: GainNode | null = null;
  private envAt = 0;
  private token = 0;
  private startPos = 0;
  private startAt = 0;
  private pitch = 0;
  private bendF = 0;
  /** le rattrapage de phase de SYNC (-NUDGE_MAX a NUDGE_MAX) */
  private lockF = 0;
  /**
   * La boucle (2026-10-04, Mika : "continue avec les boucles LOOP") : de a
   * a b, en secondes de la piste ; la source boucle d'elle-meme, a
   * l'echantillon pres (loopStart, loopEnd). null : pas de boucle.
   */
  private loopAB: { a: number; b: number } | null = null;
  /** la forme d'onde de toute la piste (energie, math.ts energy) */
  overview: Float32Array = new Float32Array(0);
  /** la forme d'onde fine (DETAIL_RATE tranches par seconde) */
  detail: Float32Array = new Float32Array(0);
  /**
   * les trois bandes (basses, mediums, aigus, entrelacees : math.ts
   * bandEnergy) de la piste entiere et de la forme d'onde fine ; null tant
   * qu'elles se calculent
   */
  bands: { overview: Float32Array; detail: Float32Array } | null = null;
  /** change a chaque morceau pose (la scene recharge ses textures) */
  loadId = 0;
  playing = false;
  onEnd: (() => void) | null = null;

  constructor(
    private ctx: AudioContext,
    private ch: DjChannel
  ) {}

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get loaded(): boolean {
    return this.buffer !== null;
  }

  /** Les echantillons (le BPM d'un fichier s'en estime). */
  get channel0(): Float32Array | null {
    return this.buffer ? this.buffer.getChannelData(0) : null;
  }

  get sampleRate(): number {
    return this.buffer?.sampleRate ?? this.ctx.sampleRate;
  }

  /**
   * Une copie de [a, b] (secondes) de la piste posee, ses canaux et sa
   * frequence ; null sans piste. Le sampler de la platine y prend ses samples (REC DECK, 2026-10-07).
   */
  excerpt(a: number, b: number): { channels: Float32Array[]; rate: number } | null {
    const buf = this.buffer;
    if (!buf) return null;
    const r = buf.sampleRate;
    const i0 = Math.max(0, Math.floor(Math.min(a, b) * r));
    const i1 = Math.min(buf.length, Math.ceil(Math.max(a, b) * r));
    if (i1 - i0 < 2) return null;
    const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c).slice(i0, i1));
    return { channels, rate: r };
  }

  /** Decode des octets (un fichier, ou un telechargement) et les pose sur la platine. */
  async load(bytes: ArrayBuffer): Promise<void> {
    this.pause();
    this.loopAB = null;
    this.buffer = null;
    this.startPos = 0;
    // Le decodeur de repli (AIFF) et les formes d'onde tournent sur le fil principal : la musique des autres
    // machines est programmee d'avance (2026-10-05, audio/sched.ts), elle ne se coupe pas
    reserve(2.5);
    // Le navigateur, puis notre decodeur (AIFF, WAV atypiques) : dj/decode.ts
    const buffer = await decodeAudio(this.ctx, bytes);
    reserve(2);
    const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    this.overview = energy(chans, OVERVIEW_SLICES);
    this.detail = energy(chans, Math.max(1, Math.floor(buffer.duration * DETAIL_RATE)));
    this.bands = null;
    this.buffer = buffer;
    this.loadId += 1;
    void this.measureBands(chans, buffer.sampleRate, this.detail.length, this.loadId);
  }

  /** Les trois bandes, par morceaux de BAND_SLICE_MS : abandonnees si un autre morceau arrive. */
  private async measureBands(chans: Float32Array[], rate: number, slices: number, id: number): Promise<void> {
    const it = bandEnergy(chans, rate, slices);
    let r = it.next();
    while (!r.done) {
      await new Promise<void>((done) => window.setTimeout(done, 0));
      if (this.loadId !== id) return;
      const t0 = performance.now();
      while (!r.done && performance.now() - t0 < BAND_SLICE_MS) r = it.next();
    }
    if (this.loadId !== id) return;
    this.bands = { detail: r.value, overview: bandOverview(r.value, OVERVIEW_SLICES) };
    waveListeners.forEach((fn) => fn());
  }

  unload(): void {
    this.pause();
    this.loopAB = null;
    this.buffer = null;
    this.startPos = 0;
    this.overview = new Float32Array(0);
    this.detail = new Float32Array(0);
    this.bands = null;
    this.loadId += 1;
  }

  private rate(): number {
    return speedOf(this.pitch) * (1 + this.bendF) * (1 + this.lockF);
  }

  /** Vitesse de lecture du moment (pitch, bend et rattrapage de SYNC). */
  get speed(): number {
    return this.rate();
  }

  /** La main tient-elle la platine (BEND, jog en lecture) ? SYNC ne la rattrape pas pendant ce temps. */
  get bending(): boolean {
    return this.bendF !== 0;
  }

  /** Le rattrapage de phase du moment (dj/actions.ts phaseLock). */
  get nudging(): number {
    return this.lockF;
  }

  /**
   * L'avance d'un depart (s) : le temps du contexte lu ici peut retarder
   * d'un paquet de rendu sur le fil audio ; une source programmee dans le
   * passe partirait plus tard que prevu, sans le dire, et la position
   * calculee (startAt) mentirait de quelques millisecondes. 256 echantillons
   * (5 ms a 48 kHz) suffisent ; bien en dessous de ce qu'une oreille percoit
   * entre le doigt et le son.
   */
  startLead(): number {
    return 256 / this.ctx.sampleRate;
  }

  position(): number {
    return this.positionAt(this.ctx.currentTime);
  }

  /**
   * La position a l'instant t du contexte (2026-10-08) : SYNC calcule un
   * depart et la reference au meme instant ; deux lectures de currentTime
   * peuvent tomber de part et d'autre d'un paquet de rendu (2.9 ms d'ecart).
   */
  positionAt(t: number): number {
    if (!this.playing) return this.startPos;
    // Pendant l'avance d'un depart : rien n'a encore joue avant startAt
    const p = this.startPos + Math.max(0, t - this.startAt) * this.rate();
    // Dans une boucle, la tete revient a a chaque fois qu'elle atteint b
    const L = this.loopAB;
    if (L && this.startPos < L.b && p >= L.b) return L.a + ((p - L.a) % (L.b - L.a));
    return Math.min(this.duration, p);
  }

  /** La boucle du moment, ou null. */
  get loop(): { a: number; b: number } | null {
    return this.loopAB;
  }

  /**
   * Pose une boucle de a a b (secondes de la piste), ou la retire (null) ;
   * en lecture, la source la prend tout de suite. Une boucle qui raccourcit
   * sous la tete la ramene dedans.
   */
  setLoop(L: { a: number; b: number } | null): void {
    if (L && (!(L.b > L.a) || L.a < 0 || L.b > this.duration)) L = null;
    const here = this.position();
    this.reanchor();
    this.loopAB = L;
    const s = this.source;
    if (s) {
      if (L) {
        s.loopStart = L.a;
        s.loopEnd = L.b;
        s.loop = true;
      } else s.loop = false;
    }
    if (L && (here >= L.b || here < L.a)) this.seek(here >= L.b ? L.a + ((here - L.a) % (L.b - L.a)) : L.a);
  }

  private reanchor(): void {
    const now = this.ctx.currentTime;
    if (this.playing && now < this.startAt) return;
    this.startPos = this.position();
    this.startAt = now;
  }

  /**
   * Lecture depuis startPos, tout de suite (2026-10-08, Mika : "quand
   * j'utilise SYNC, quand j'appuie sur play ca met une demi seconde avant
   * de se lancer ! insoutenable") : apres l'avance d'un depart (startLead),
   * jamais plus. SYNC ne retarde plus le depart, il deplace la tete
   * (dj/actions.ts inPhase). at : l'instant du contexte ou partir, calcule
   * par l'appelant (SYNC, un fondu croise) ; respecte a l'echantillon pres.
   */
  play(at = 0): void {
    if (!this.buffer || this.playing) return;
    if (this.startPos >= this.duration - 0.05) return;
    const s = new AudioBufferSourceNode(this.ctx, { buffer: this.buffer, playbackRate: this.rate() });
    // Une boucle posee : la nouvelle source boucle aussi
    if (this.loopAB) {
      s.loopStart = this.loopAB.a;
      s.loopEnd = this.loopAB.b;
      s.loop = true;
    }
    const env = new GainNode(this.ctx, { gain: 0 });
    s.connect(env).connect(this.ch.input);
    const token = ++this.token;
    s.onended = () => {
      s.disconnect();
      env.disconnect();
      if (token !== this.token) return;
      this.startPos = this.duration;
      this.playing = false;
      this.source = null;
      this.env = null;
      this.onEnd?.();
    };
    const when = at > 0 ? Math.max(this.ctx.currentTime, at) : this.ctx.currentTime + this.startLead();
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(1, when + FADE_S);
    this.startAt = when;
    s.start(when, this.startPos);
    this.source = s;
    this.env = env;
    this.envAt = when;
    this.playing = true;
  }

  /** La source du moment s'eteint en FADE_S a partir de t, puis s'arrete (elle se debranche seule a la fin). */
  private release(t: number): void {
    const s = this.source;
    const env = this.env;
    this.source = null;
    this.env = null;
    if (!s || !env) return;
    // Le gain a l'instant t, d'apres son fondu d'entree (cancelAndHoldAtTime n'existe pas partout)
    const g = t <= this.envAt ? 0 : Math.min(1, (t - this.envAt) / FADE_S);
    env.gain.cancelScheduledValues(t);
    env.gain.setValueAtTime(g, t);
    env.gain.linearRampToValueAtTime(0, t + FADE_S);
    try {
      s.stop(t + FADE_S + 0.001);
    } catch {
      /* deja arretee */
    }
  }

  pause(): void {
    if (!this.playing) return;
    this.startPos = this.position();
    this.token += 1;
    this.release(this.ctx.currentTime);
    this.playing = false;
  }

  /**
   * Aller a un instant de la piste. En lecture, une nouvelle source part de
   * la apres l'avance d'un depart (ou a l'instant at du contexte), et
   * l'ancienne joue jusqu'a cet instant, puis s'efface en fondu croise : ni
   * trou ni clic.
   */
  seek(seconds: number, at = 0): void {
    const t = Math.max(0, Math.min(this.duration, seconds));
    // Aller hors de la boucle la quitte (un hot cue, la piste touchee, un recalage)
    if (this.loopAB && (t < this.loopAB.a || t >= this.loopAB.b)) this.loopAB = null;
    if (!this.playing) {
      this.startPos = t;
      return;
    }
    const when = at > 0 ? Math.max(this.ctx.currentTime, at) : this.ctx.currentTime + this.startLead();
    const old = { source: this.source, env: this.env, at: this.envAt };
    this.token += 1;
    this.source = null;
    this.env = null;
    this.playing = false;
    this.startPos = t;
    this.play(when);
    // L'ancienne source s'efface la ou la nouvelle part
    const next = { source: this.source, env: this.env, at: this.envAt };
    this.source = old.source;
    this.env = old.env;
    this.envAt = old.at;
    this.release(when);
    this.source = next.source;
    this.env = next.env;
    this.envAt = next.at;
  }

  /** Pitch en pour cent. */
  setPitch(pct: number): void {
    this.reanchor();
    this.pitch = pct;
    this.source?.playbackRate.setValueAtTime(this.rate(), this.ctx.currentTime);
  }

  /** Le jog ou les touches BEND en lecture : accelere ou freine un instant (-0.5 a 0.5). */
  bend(f: number): void {
    this.reanchor();
    this.bendF = Math.max(-0.5, Math.min(0.5, f));
    this.source?.playbackRate.setValueAtTime(this.rate(), this.ctx.currentTime);
  }

  /** Le rattrapage de phase de SYNC : un ecart de vitesse de NUDGE_MAX au plus (0 : aucun). */
  nudge(f: number): void {
    const next = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, f));
    if (next === this.lockF) return;
    this.reanchor();
    this.lockF = next;
    this.source?.playbackRate.setValueAtTime(this.rate(), this.ctx.currentTime);
  }

  /** Le jog en pause : le point se deplace et on entend un grain, pour poser un cue a l'oreille. */
  grain(seconds: number): void {
    if (!this.buffer || this.playing) return;
    this.startPos = Math.max(0, Math.min(this.duration, seconds));
    const s = new AudioBufferSourceNode(this.ctx, { buffer: this.buffer });
    const env = new GainNode(this.ctx, { gain: 0 });
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.005);
    env.gain.linearRampToValueAtTime(0, t + 0.06);
    s.connect(env).connect(this.ch.input);
    s.start(t, this.startPos, 0.065);
    s.onended = () => {
      s.disconnect();
      env.disconnect();
    };
  }
}

/* ---------------- le moteur entier ---------------- */

/**
 * Ce que SYNC mesure (2026-10-08, dj/actions.ts phaseLock), lu par le debug
 * (window.__v4.dj.phaseErrMs) : l'ecart de phase de chaque platine calee
 * (ms, positif : en retard sur sa reference ; null sans reference), l'ecart
 * qu'on garde (un nudge a la main), le rattrapage en cours, et la duree du
 * dernier PLAY (de l'appui a la source programmee, et l'avance du depart).
 */
export interface DjSyncInfo {
  errMs: Record<DjDeck, number | null>;
  keepMs: Record<DjDeck, number>;
  nudge: Record<DjDeck, number>;
  lastPlay: { deck: DjDeck; callMs: number; leadMs: number; jumpMs: number; sync: boolean } | null;
}

export interface DjEngine {
  readonly ctx: AudioContext;
  readonly mixer: DjMixer;
  readonly decks: Readonly<Record<DjDeck, DjPlayer>>;
  readonly sync: DjSyncInfo;
}

let engine: DjEngine | null = null;
/**
 * Qui cree le moteur le branche aussitot sur le store (2026-10-21, audit) :
 * dj/actions.ts s'inscrit ici. Le sampler d'une platine (un pad, REC DECK,
 * REC MIX, un fichier glisse) creait le moteur sans lui : ni les reglages de
 * la table, ni ses abonnements, ni la memoire de REC MIX, jusqu'au premier
 * geste sur la table.
 */
let created: ((e: DjEngine) => void) | null = null;
export function whenDjEngine(fn: (e: DjEngine) => void): void {
  created = fn;
  if (engine) fn(engine);
}
/** Les lecteurs crees, platine par platine (2026-10-18 : aucun au telephone tenu droit). */
const made: Partial<Record<DjDeck, DjPlayer>> = {};
/** Les platines dont le lecteur existe (le debug et les tests : la table seule n'en cree aucun). */
export const djPlayersMade = (): DjDeck[] => DJ_DECKS_ALL.filter((d) => made[d] !== undefined);

/** Le moteur, cree au premier appel apres le premier geste (le port du site existe) ; null avant. */
export function djEngine(): DjEngine | null {
  if (engine) return engine;
  const port = synthPort();
  if (!port) return null;
  const mixer = new DjMixer(port.ctx, port.input);
  // La sortie du limiteur du site, si le port la donne (audio/drums.ts synthPort().out)
  const post = (port as { out?: AudioNode }).out;
  if (post) mixer.meterAfter(post);
  // Les platines sur les voies 4 a 7 ; 1 a 3 recoivent le MM-RYTM, le MM-BASS et le MM-ARP (dj/actions.ts).
  // Les quatre existent toujours sur desktop : poser C ou D ne touche pas au son en cours. Au telephone tenu
  // droit (2026-10-18, la table seule, theme.ts DJ_PLAYERS) aucune n'est creee ; un acces egare en cree une
  // a la demande (muette tant qu'on ne la charge pas), il ne casse rien
  const p = (d: DjDeck): DjPlayer => (made[d] ??= new DjPlayer(port.ctx, mixer.ch[deckChannel(d)]));
  for (const d of DJ_PLAYERS) p(d);
  const decks = {} as Record<DjDeck, DjPlayer>;
  for (const d of DJ_DECKS_ALL) Object.defineProperty(decks, d, { get: () => p(d), enumerable: true });
  const each = <T>(v: T): Record<DjDeck, T> => ({ a: v, b: v, c: v, d: v });
  const e: DjEngine = { ctx: port.ctx, mixer, decks, sync: { errMs: each<number | null>(null), keepMs: each(0), nudge: each(0), lastPlay: null } };
  engine = e;
  created?.(e);
  return e;
}

/** Le moteur s'il existe deja, sans le creer (la scene le lit a chaque image). */
export const djEngineIfAny = (): DjEngine | null => engine;
