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
import { CROSSOVER, bandGain, beatsToSeconds, dbToGain, eqDb, faderGain, filterOf, fxMix, peaks, speedOf, xfaderGains } from './math';
import { DJ_FX, type DjDeck, type DjFxId } from './theme';

/** Q de Butterworth : en dB pour passe-bas et passe-haut (piege de Web Audio), lineaire pour le passe-tout. */
const BUTTERWORTH_DB = 20 * Math.log10(Math.SQRT1_2);
const BUTTERWORTH = Math.SQRT1_2;
const RESONANCE = 4;
/** Tranches de la forme d'onde de toute la piste (l'ecran de la platine). */
export const OVERVIEW_SLICES = 900;

function peakOf(a: AnalyserNode, buf: Float32Array): number {
  a.getFloatTimeDomainData(buf);
  let max = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = Math.abs(buf[i]);
    if (v > max) max = v;
  }
  return max;
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
  private fader: GainNode;
  private meter: AnalyserNode;
  private buf: Float32Array;

  constructor(
    private ctx: AudioContext,
    out: AudioNode
  ) {
    this.input = new GainNode(ctx);
    this.low = new GainNode(ctx);
    this.mid = new GainNode(ctx);
    this.high = new GainNode(ctx);
    const f = (type: BiquadFilterType, frequency: number): BiquadFilterNode =>
      new BiquadFilterNode(ctx, { type, frequency, Q: type === 'allpass' ? BUTTERWORTH : BUTTERWORTH_DB });
    const sum = new GainNode(ctx);
    this.input.connect(f('lowpass', CROSSOVER.low)).connect(f('lowpass', CROSSOVER.low)).connect(f('allpass', CROSSOVER.high)).connect(this.low).connect(sum);
    const above = this.input.connect(f('highpass', CROSSOVER.low)).connect(f('highpass', CROSSOVER.low));
    above.connect(f('lowpass', CROSSOVER.high)).connect(f('lowpass', CROSSOVER.high)).connect(this.mid).connect(sum);
    above.connect(f('highpass', CROSSOVER.high)).connect(f('highpass', CROSSOVER.high)).connect(this.high).connect(sum);
    this.lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000, Q: BUTTERWORTH_DB });
    this.hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 10, Q: BUTTERWORTH_DB });
    this.fader = new GainNode(ctx, { gain: faderGain(0.8) });
    this.xf = new GainNode(ctx, { gain: Math.SQRT1_2 });
    this.meter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.buf = new Float32Array(this.meter.fftSize);
    sum.connect(this.lp).connect(this.hp).connect(this.fader);
    this.fader.connect(this.meter);
    this.fader.connect(this.xf).connect(out);
  }

  setGain(v: number): void {
    glide(this.input.gain, dbToGain(eqDb(v)), this.ctx);
  }

  setBand(band: 'hi' | 'mid' | 'low', v: number): void {
    glide((band === 'hi' ? this.high : band === 'mid' ? this.mid : this.low).gain, bandGain(v), this.ctx);
  }

  /** Plat au repos ; la resonance (4) seulement quand on le tourne. */
  setFilter(v: number): void {
    const f = filterOf(v);
    glide(this.lp.frequency, f.type === 'low' ? f.freq : 20000, this.ctx);
    glide(this.hp.frequency, f.type === 'high' ? f.freq : 10, this.ctx);
    glide(this.lp.Q, f.type === 'low' ? RESONANCE : BUTTERWORTH_DB, this.ctx);
    glide(this.hp.Q, f.type === 'high' ? RESONANCE : BUTTERWORTH_DB, this.ctx);
  }

  setFader(x: number): void {
    glide(this.fader.gain, faderGain(x), this.ctx);
  }

  /** Crete de 0 a 1 (apres le fader), pour le VU. */
  level(): number {
    return peakOf(this.meter, this.buf);
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
 * Sept effets en serie, globaux (Mika les voulait en potards) : chacun son
 * son sec et son son traite, la dose les melange (math.ts fxMix). Le delay,
 * le flanger et le trans suivent le tempo de la platine qu'on entend le
 * plus, au temps choisi (TIME).
 */
export class DjFx {
  readonly input: GainNode;
  readonly output: GainNode;
  private stages: Stage[] = [];
  private echo: DelayNode;
  private sweep: OscillatorNode;
  private chop: OscillatorNode;
  private bpm = 120;
  private beats = 1;

  constructor(private ctx: AudioContext) {
    this.input = new GainNode(ctx);
    this.output = new GainNode(ctx);
    const t = beatsToSeconds(this.bpm, this.beats);
    this.echo = new DelayNode(ctx, { maxDelayTime: 8, delayTime: t });
    this.sweep = new OscillatorNode(ctx, { frequency: 1 / (t * 4) });
    this.chop = new OscillatorNode(ctx, { type: 'square', frequency: 2 / t });
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
    this.sweep.start();
    this.chop.start();
  }

  private build(id: DjFxId): { input: AudioNode; output: AudioNode } {
    const ctx = this.ctx;
    switch (id) {
      case 'disto': {
        const push = new GainNode(ctx, { gain: 6 });
        const shape = new WaveShaperNode(ctx, { curve: curve((x) => Math.tanh(x)), oversample: '4x' });
        const out = new GainNode(ctx, { gain: 0.35 });
        push.connect(shape).connect(out);
        return { input: push, output: out };
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
        this.sweep.connect(new GainNode(ctx, { gain: 0.0032 })).connect(d.delayTime);
        return { input: d, output: d };
      }
      case 'trans': {
        // Une porte qui coupe le son au rythme : le carre va de -1 a 1, la porte de 0 a 1
        const gate = new GainNode(ctx, { gain: 0.5 });
        this.chop.connect(new GainNode(ctx, { gain: 0.5 })).connect(gate.gain);
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
    const m = fxMix(id, v);
    if (m.wet > 0 && !s.on) {
      window.clearTimeout(s.off);
      s.pre.connect(s.proc);
      s.on = true;
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
      }, 80);
    }
  }

  /** Le tempo des effets rythmiques : le BPM entendu et le temps (TIME). */
  tempo(o: { bpm?: number; beats?: number }): void {
    if (o.bpm !== undefined && o.bpm > 0) this.bpm = o.bpm;
    if (o.beats !== undefined) this.beats = o.beats;
    const t = beatsToSeconds(this.bpm, this.beats);
    const now = this.ctx.currentTime;
    glide(this.echo.delayTime, Math.min(8, t), this.ctx);
    this.sweep.frequency.setValueAtTime(1 / Math.max(0.1, t * 4), now);
    this.chop.frequency.setValueAtTime(2 / Math.max(0.05, t), now);
  }
}

/* ---------------- la table ---------------- */

export class DjMixer {
  readonly ch: readonly [DjChannel, DjChannel];
  readonly fx: DjFx;
  private master: GainNode;
  private meters: [AnalyserNode, AnalyserNode];
  private bufs: [Float32Array, Float32Array];

  constructor(
    readonly ctx: AudioContext,
    out: AudioNode
  ) {
    const sum = new GainNode(ctx);
    this.fx = new DjFx(ctx);
    this.master = new GainNode(ctx, { gain: faderGain(0.88) * 1.1 });
    // Le limiteur des Decks (au-dessus de -2 dBFS), puis celui du site
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -2, knee: 0, ratio: 20, attack: 0.002, release: 0.12 });
    const split = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    this.meters = [new AnalyserNode(ctx, { fftSize: 1024 }), new AnalyserNode(ctx, { fftSize: 1024 })];
    this.bufs = [new Float32Array(1024), new Float32Array(1024)];
    sum.connect(this.fx.input);
    this.fx.output.connect(this.master).connect(limiter);
    limiter.connect(out);
    limiter.connect(split);
    split.connect(this.meters[0], 0);
    split.connect(this.meters[1], 1);
    this.ch = [new DjChannel(ctx, sum), new DjChannel(ctx, sum)];
    this.setXfader(0);
  }

  setXfader(x: number): void {
    const g = xfaderGains(x);
    glide(this.ch[0].xf.gain, g.a, this.ctx);
    glide(this.ch[1].xf.gain, g.b, this.ctx);
  }

  setMaster(x: number): void {
    glide(this.master.gain, faderGain(x) * 1.1, this.ctx);
  }

  /** Cretes gauche et droite du master (0 a 1). */
  masterLevels(): [number, number] {
    return [peakOf(this.meters[0], this.bufs[0]), peakOf(this.meters[1], this.bufs[1])];
  }
}

/* ---------------- une platine ---------------- */

export class DjPlayer {
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private token = 0;
  private startPos = 0;
  private startAt = 0;
  private pitch = 0;
  private bendF = 0;
  /** la forme d'onde de toute la piste */
  overview: Float32Array = new Float32Array(0);
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

  /** Decode des octets (un fichier, ou un telechargement) et les pose sur la platine. */
  async load(bytes: ArrayBuffer): Promise<void> {
    this.pause();
    this.buffer = null;
    this.startPos = 0;
    const buffer = await this.ctx.decodeAudioData(bytes);
    const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    this.overview = peaks(chans, OVERVIEW_SLICES);
    this.buffer = buffer;
  }

  unload(): void {
    this.pause();
    this.buffer = null;
    this.startPos = 0;
    this.overview = new Float32Array(0);
  }

  private rate(): number {
    return speedOf(this.pitch) * (1 + this.bendF);
  }

  /** Vitesse de lecture du moment (pitch et bend). */
  get speed(): number {
    return this.rate();
  }

  position(): number {
    if (!this.playing) return this.startPos;
    return Math.min(this.duration, this.startPos + (this.ctx.currentTime - this.startAt) * this.rate());
  }

  private reanchor(): void {
    this.startPos = this.position();
    this.startAt = this.ctx.currentTime;
  }

  play(): void {
    if (!this.buffer || this.playing) return;
    if (this.startPos >= this.duration - 0.05) return;
    const s = new AudioBufferSourceNode(this.ctx, { buffer: this.buffer, playbackRate: this.rate() });
    s.connect(this.ch.input);
    const token = ++this.token;
    s.onended = () => {
      if (token !== this.token) return;
      this.startPos = this.duration;
      this.playing = false;
      this.source = null;
      this.onEnd?.();
    };
    this.startAt = this.ctx.currentTime;
    s.start(0, this.startPos);
    this.source = s;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.startPos = this.position();
    this.token += 1;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
    this.playing = false;
  }

  seek(seconds: number): void {
    const t = Math.max(0, Math.min(this.duration, seconds));
    if (this.playing) {
      this.pause();
      this.startPos = t;
      this.play();
    } else {
      this.startPos = t;
    }
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

export interface DjEngine {
  readonly ctx: AudioContext;
  readonly mixer: DjMixer;
  readonly decks: Readonly<Record<DjDeck, DjPlayer>>;
}

let engine: DjEngine | null = null;

/** Le moteur, cree au premier appel apres le premier geste (le port du site existe) ; null avant. */
export function djEngine(): DjEngine | null {
  if (engine) return engine;
  const port = synthPort();
  if (!port) return null;
  const mixer = new DjMixer(port.ctx, port.input);
  engine = { ctx: port.ctx, mixer, decks: { a: new DjPlayer(port.ctx, mixer.ch[0]), b: new DjPlayer(port.ctx, mixer.ch[1]) } };
  return engine;
}

/** Le moteur s'il existe deja, sans le creer (la scene le lit a chaque image). */
export const djEngineIfAny = (): DjEngine | null => engine;
