/**
 * DIST du bus (revision 2, spec 20.8), branche par drums.ts, et ce qui
 * sert aux autres effets (2026-10-01 : la REVERB passe par audio/sends.ts,
 * partagee avec les envois par voix) :
 *
 *   bus -> sec (1 - m) -----------------------------------> TONE
 *   bus -> pre (D / K) -> WaveShaper -> passe-bas -> mouille (m) -> TONE   DIST
 *
 * Le passe-bas : DIST TONE (2026-10-10, la page DIST du MM-RYTM), ouvert
 * par defaut (le son d'avant).
 * DIST : saturation parallele. Courbe tanh(K u) calculee une fois ; la
 * branche mouillee vaut tanh(D x) avec D = 1 + 12 d, melangee a
 * m = 0.85 d (2026-10-02, plus marquee : D = 1 + 5 d et m = d / 2 avant,
 * trop subtil a 100 % pour Mika).
 * A 0 : sec 1, mouille 0 et la branche debranchee : le signal d'origine,
 * la saturation ne calcule rien (0 = bypass). Avant TONE et LEVEL : LEVEL
 * reste un volume (baisser le niveau ne nettoie pas la saturation), TONE
 * adoucit les harmoniques qu'elle ajoute. buildDrive : la meme saturation
 * en insert a bypass reel, pour une voix seule.
 * La reponse de la REVERB (bruit stereo a decroissance exponentielle,
 * 2.4 s depuis le 2026-10-02 (1.2 avant), -60 dB a la fin, aigus amortis)
 * est generee ici (makeImpulse).
 * Chaque reglage rejoint sa valeur en 20 ms ; une branche revenue a 0 se
 * debranche apres sa rampe.
 */

import { glide } from './glide';
import { Insert, UNLINK_MS } from './insert';

export { GLIDE_S, glide } from './glide';

/** DIST : D = 1 + gain x d, melange m = mix x d, courbe tanh(k u) sur `points` valeurs (nombre impair : 0 exact au centre). */
const DRIVE = { gain: 12, mix: 0.85, k: 8, points: 2049 } as const;

/** REVERB : longueur de la reponse (s), pre-delai, entree en fondu, passe-bas du bruit (Hz) du debut a la fin de la queue, graines. */
const REVERB = { seconds: 2.4, preDelay: 0.02, fadeIn: 0.003, hiStart: 9000, hiEnd: 3000, seeds: [808, 909] } as const;

/**
 * La forme de la reponse (2026-10-10, la page REVERB du MM-RYTM : SIZE, TONE, PRE) : sa duree (s), la coupure
 * ou finit la queue (Hz), le pre-delai (s). IR_DEFAULT : celle d'avant, au bit pres.
 */
export interface IrShape {
  seconds: number;
  hiEnd: number;
  preDelay: number;
}
export const IR_DEFAULT: Readonly<IrShape> = { seconds: REVERB.seconds, hiEnd: REVERB.hiEnd, preDelay: REVERB.preDelay };

/** DIST TONE (2026-10-10) : a 16 kHz et plus, le passe-bas du mouille est ouvert (pose a Nyquist, il laisse tout passer). */
export const DIST_OPEN_HZ = 16000;

/** PRNG a graine (mulberry32) : la meme reponse a chaque visite. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** tanh(k u) pour u de -1 a 1 : l'entree du WaveShaper est pre-divisee par k. */
export function driveCurve(): Float32Array {
  const n = DRIVE.points;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) c[i] = Math.tanh(DRIVE.k * ((i / (n - 1)) * 2 - 1));
  return c;
}

/**
 * Reponse de la reverbe : deux canaux de bruit independants (stereo
 * decorrelee), passe-bas a un pole dont la coupure descend de 9 kHz a
 * 2.5 kHz (les aigus meurent avant les graves), enveloppe exponentielle a
 * -60 dB en fin de reponse, 10 ms de pre-delai, 3 ms d'entree en fondu (pas
 * de clic). Chaque canal ramene a une energie de 1 : le niveau ne depend
 * que de l'envoi, quel que soit le taux d'echantillonnage.
 * La forme s (2026-10-10) : la duree, la fin de la coupure (au-dessus de
 * 9 kHz, la queue reste claire de bout en bout), le pre-delai ; la queue
 * garde sa duree quel que soit le pre-delai. IR_DEFAULT : la reponse d'avant.
 */
export function makeImpulse(c: BaseAudioContext, s: Readonly<IrShape> = IR_DEFAULT): AudioBuffer {
  const sr = c.sampleRate;
  const pre = Math.round(s.preDelay * sr);
  const n = Math.max(pre + 2, Math.round(s.seconds * sr) + pre - Math.round(REVERB.preDelay * sr));
  const len = n - pre;
  const hiEnd = s.hiEnd;
  const hiStart = Math.max(REVERB.hiStart, hiEnd);
  const fade = Math.max(1, Math.round(REVERB.fadeIn * sr));
  const decay = Math.exp(Math.log(0.001) / len);
  const buf = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    const rnd = prng(REVERB.seeds[ch]);
    let y = 0;
    let a = 0;
    let env = 1;
    let energy = 0;
    for (let i = 0; i < len; i += 1) {
      // Coupure recalculee tous les 64 echantillons : assez lisse, peu couteux
      if ((i & 63) === 0) {
        const fc = hiStart * Math.pow(hiEnd / hiStart, i / len);
        a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      }
      y += a * (rnd() * 2 - 1 - y);
      const v = y * env * (i < fade ? i / fade : 1);
      d[pre + i] = v;
      energy += v * v;
      env *= decay;
    }
    const g = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = pre; i < n; i += 1) d[i] *= g;
  }
  return buf;
}

export interface DriveInfo {
  /** reglage applique (0 a 1) */
  drive: number;
  /** DIST TONE (2026-10-10) : la coupure du passe-bas du mouille (Hz, Nyquist : ouvert) */
  toneHz: number;
  /** branche mouillee de DIST branchee sur le bus */
  driveOn: boolean;
  /** branches debranchees depuis la creation */
  unlinks: number;
}

export interface FxChain {
  setDrive(d: number): void;
  /** DIST TONE (2026-10-10) : le passe-bas du mouille (Hz) ; DIST_OPEN_HZ et plus : ouvert, le son d'avant */
  setTone(hz: number): void;
  info(): DriveInfo;
}

export interface FxPorts {
  /** sortie des voix */
  bus: AudioNode;
  /** entree de TONE : recoit le sec et le mouille de DIST */
  tone: AudioNode;
}

/** Branche DIST (parallele) sur le graphe de drums.ts, a sa valeur de depart (0 a 1), et son TONE (Hz, ouvert par defaut). */
export function buildFx(c: BaseAudioContext, io: FxPorts, drive0: number, tone0: number = DIST_OPEN_HZ): FxChain {
  const dry = c.createGain();
  dry.gain.value = 1;
  const pre = c.createGain();
  pre.gain.value = 1 / DRIVE.k;
  const shaper = c.createWaveShaper();
  shaper.curve = driveCurve();
  // Pas de surechantillonnage : il retarde la branche mouillee de 1 a 2 ms
  // (filtres de reechantillonnage), et le melange avec le sec en parallele
  // creuserait un filtre en peigne ; les harmoniques d'un BD a 50-150 Hz
  // restent loin de Nyquist
  shaper.oversample = 'none';
  const wet = c.createGain();
  wet.gain.value = 0;
  /*
   * DIST TONE (2026-10-10) : un passe-bas sur le mouille seul, apres la saturation (le sec garde ses aigus, a DIST 0
   * rien ne change). Butterworth (Q en dB pour un passe-bas : -3 dB). Ouvert, il est pose a Nyquist : le filtre
   * biquad du navigateur y vaut exactement 1 (ses coefficients 1, 0, 0), le mouille d'avant au bit pres.
   */
  const openHz = (hz: number): number => (!Number.isFinite(hz) || hz >= DIST_OPEN_HZ ? c.sampleRate / 2 : Math.max(20, Math.min(c.sampleRate / 2, hz)));
  let toneHz = openHz(tone0);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 20 * Math.log10(Math.SQRT1_2);
  lp.frequency.value = toneHz;
  io.bus.connect(dry);
  dry.connect(io.tone);
  pre.connect(shaper);
  shaper.connect(lp);
  lp.connect(wet);
  wet.connect(io.tone);

  let drive = 0;
  let driveOn = false;
  let driveTimer: ReturnType<typeof setTimeout> | undefined;
  let unlinks = 0;

  const setDrive = (d: number): void => {
    if (d === drive) return;
    drive = d;
    if (d > 0) {
      clearTimeout(driveTimer);
      driveTimer = undefined;
      if (!driveOn) {
        io.bus.connect(pre);
        driveOn = true;
      }
    }
    const m = DRIVE.mix * d;
    glide(dry.gain, 1 - m, c);
    glide(pre.gain, (1 + DRIVE.gain * d) / DRIVE.k, c);
    glide(wet.gain, m, c);
    if (d > 0 || !driveOn) return;
    clearTimeout(driveTimer);
    driveTimer = setTimeout(() => {
      driveTimer = undefined;
      if (drive > 0 || !driveOn) return;
      io.bus.disconnect(pre);
      driveOn = false;
      unlinks += 1;
    }, UNLINK_MS);
  };

  setDrive(drive0);

  const setTone = (hz: number): void => {
    const t = openHz(hz);
    if (t === toneHz) return;
    toneHz = t;
    glide(lp.frequency, t, c);
  };

  return { setDrive, setTone, info: () => ({ drive, toneHz, driveOn, unlinks }) };
}

/** Insert de saturation d'une voix (meme loi que DIST) : bypass reel a 0. */
export interface DriveStage {
  input: AudioNode;
  set(d: number): void;
  value(): number;
  /**
   * Les verrous DIST de la voix (2026-10-09, audio/lockfx.ts) : tenue (la
   * branche reste reliee, au repos le meme signal), et la valeur d'un coup a
   * l'instant when.
   */
  lockHold(on: boolean): void;
  lockAt(when: number, d: number): void;
  /** Appele apres une rampe de set() (elle efface ce qui etait programme) : audio/lockfx.ts repose ses points. */
  onRetime: (() => void) | null;
}

export function buildDrive(c: BaseAudioContext, out: AudioNode): DriveStage {
  const input = c.createGain();
  input.gain.value = 1;
  const pre = c.createGain();
  pre.gain.value = 1 / DRIVE.k;
  const shaper = c.createWaveShaper();
  shaper.curve = driveCurve();
  shaper.oversample = 'none';
  pre.connect(shaper);
  const insert = new Insert(c, input, out);
  insert.setBranch(pre, shaper);
  let drive = 0;
  const stage: DriveStage = {
    input,
    onRetime: null,
    set(d: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      if (t === drive) return;
      drive = t;
      if (t === 0) insert.release();
      else {
        glide(pre.gain, (1 + DRIVE.gain * t) / DRIVE.k, c);
        const m = DRIVE.mix * t;
        insert.engage(1 - m, m);
      }
      stage.onRetime?.();
    },
    value: () => drive,
    lockHold(on: boolean) {
      insert.hold(on);
      // Lache (le dernier verrou DIST retire, revue du 2026-10-09) : l'entree revient a celle de la voix, les points s'effacent
      if (!on) glide(pre.gain, (1 + DRIVE.gain * drive) / DRIVE.k, c);
    },
    lockAt(when: number, d: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      const m = DRIVE.mix * t;
      if (insert.at(when, 1 - m, m)) pre.gain.setValueAtTime((1 + DRIVE.gain * t) / DRIVE.k, Math.max(when, c.currentTime));
    },
  };
  return stage;
}
