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
import { decodeAudio } from './decode';
import { CROSSOVER, bandEnergy, bandGain, bandOverview, beatsToSeconds, dbToGain, eqDb, energy, faderGain, filterOf, fxMix, speedOf } from './math';
import { DJ_CHANNELS_MAX, DJ_FX, deckChannel, type DjDeck, type DjFxId } from './theme';

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
    this.fader.connect(this.xf).connect(out);
  }

  setGain(v: number): void {
    glide(this.input.gain, dbToGain(eqDb(v)), this.ctx);
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
  /** l'overdrive : sa poussee, sa tonalite, son niveau (regles par la dose) */
  private drive: { pre: GainNode; tone: BiquadFilterNode; post: GainNode } | null = null;

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
      case 'overdrive': {
        /*
         * Un overdrive de pedale (2026-10-04, Mika : "au lieu de disto je veux
         * Overdrive") : on pousse le signal dans une saturation douce et
         * asymetrique (le biais donne des harmoniques paires, la chaleur d'un
         * tube), suivie d'une tonalite qui ferme le haut a mesure qu'on pousse
         * (pas de gresillement), puis le niveau est rattrape. La dose regle
         * la poussee : de +0 a +24 dB (drive.set).
         */
        const pre = new GainNode(ctx, { gain: 1 });
        const shape = new WaveShaperNode(ctx, { curve: curve(warm), oversample: '4x' });
        // La saturation asymetrique laisse un decalage continu : un passe-haut a 15 Hz l'ote
        const dc = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 15, Q: BUTTERWORTH_DB });
        const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 12000, Q: BUTTERWORTH_DB });
        const post = new GainNode(ctx, { gain: 1 });
        pre.connect(shape).connect(dc).connect(tone).connect(post);
        this.drive = { pre, tone, post };
        return { input: pre, output: post };
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
    if (id === 'overdrive' && this.drive) {
      // La poussee (0 a +24 dB), la tonalite qui se ferme, le niveau rattrape
      const d = Math.max(0, Math.min(1, v));
      const push = 10 ** ((d * 24) / 20);
      glide(this.drive.pre.gain, push, this.ctx);
      glide(this.drive.tone.frequency, 12000 - d * 6500, this.ctx);
      // Mesure hors ligne (sinus a -6 dBFS) : 0.77 garde le niveau a la plus petite poussee, 0.42 une fois sature
      glide(this.drive.post.gain, 0.42 + 0.35 * Math.exp(-(push - 1) * 1.5), this.ctx);
    }
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
  /** six voies : 1 et 2 les machines, 3 a 6 les platines A a D */
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
    // Plus de crossfader (Mika, 2026-10-04) : chaque voie passe entiere, son fader seul compte
    this.ch = Array.from({ length: DJ_CHANNELS_MAX }, () => new DjChannel(ctx, sum));
    for (const c of this.ch) c.xf.gain.value = 1;
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

export class DjPlayer {
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private token = 0;
  private startPos = 0;
  private startAt = 0;
  private pitch = 0;
  private bendF = 0;
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

  /** Decode des octets (un fichier, ou un telechargement) et les pose sur la platine. */
  async load(bytes: ArrayBuffer): Promise<void> {
    this.pause();
    this.loopAB = null;
    this.buffer = null;
    this.startPos = 0;
    // Le navigateur, puis notre decodeur (AIFF, WAV atypiques) : dj/decode.ts
    const buffer = await decodeAudio(this.ctx, bytes);
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
    return speedOf(this.pitch) * (1 + this.bendF);
  }

  /** Vitesse de lecture du moment (pitch et bend). */
  get speed(): number {
    return this.rate();
  }

  position(): number {
    if (!this.playing) return this.startPos;
    // Un depart programme (SYNC) : rien n'a encore joue avant startAt
    const p = this.startPos + Math.max(0, this.ctx.currentTime - this.startAt) * this.rate();
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
   * Lecture depuis startPos ; at : un instant du contexte ou partir (SYNC
   * part sur un temps de la reference), maintenant par defaut.
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
    s.connect(this.ch.input);
    const token = ++this.token;
    s.onended = () => {
      if (token !== this.token) return;
      this.startPos = this.duration;
      this.playing = false;
      this.source = null;
      this.onEnd?.();
    };
    const when = Math.max(this.ctx.currentTime, at);
    this.startAt = when;
    s.start(when, this.startPos);
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
    // Aller hors de la boucle la quitte (un hot cue, la piste touchee, un recalage)
    if (this.loopAB && (t < this.loopAB.a || t >= this.loopAB.b)) this.loopAB = null;
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
  // La sortie du limiteur du site, si le port la donne (audio/drums.ts synthPort().out)
  const post = (port as { out?: AudioNode }).out;
  if (post) mixer.meterAfter(post);
  // Les platines sur les voies 3 a 6 ; 1 et 2 recoivent le MM-RYTM et le MM-ARP (dj/actions.ts).
  // Les quatre existent toujours : poser C ou D ne touche pas au son en cours
  const p = (d: DjDeck): DjPlayer => new DjPlayer(port.ctx, mixer.ch[deckChannel(d)]);
  engine = { ctx: port.ctx, mixer, decks: { a: p('a'), b: p('b'), c: p('c'), d: p('d') } };
  return engine;
}

/** Le moteur s'il existe deja, sans le creer (la scene le lit a chaque image). */
export const djEngineIfAny = (): DjEngine | null => engine;
