/**
 * DIST du bus (revision 2, spec 20.8), branche par drums.ts, et ce qui
 * sert aux autres effets (2026-10-01 : la REVERB passe par audio/sends.ts,
 * partagee avec les envois par voix) :
 *
 *   bus -> sec (1 - m) -----------------------------------> TONE
 *   bus -> pre (D / K) -> WaveShaper -> mouille (m) -------> TONE      DIST
 *
 * DIST : saturation parallele. Courbe tanh(K u) calculee une fois ; la
 * branche mouillee vaut tanh(D x) avec D = 1 + 5 d, melangee a m = d / 2.
 * A 0 : sec 1, mouille 0 et la branche debranchee : le signal d'origine,
 * la saturation ne calcule rien (0 = bypass). Avant TONE et LEVEL : LEVEL
 * reste un volume (baisser le niveau ne nettoie pas la saturation), TONE
 * adoucit les harmoniques qu'elle ajoute. buildDrive : la meme saturation
 * en insert a bypass reel, pour une voix seule.
 * La reponse de la REVERB (bruit stereo a decroissance exponentielle,
 * 1.2 s, -60 dB a la fin, aigus amortis) est generee ici (makeImpulse).
 * Chaque reglage rejoint sa valeur en 20 ms ; une branche revenue a 0 se
 * debranche apres sa rampe.
 */

import { glide } from './glide';
import { Insert, UNLINK_MS } from './insert';

export { GLIDE_S, glide } from './glide';

/** DIST : D = 1 + gain x d, melange m = mix x d, courbe tanh(k u) sur `points` valeurs (nombre impair : 0 exact au centre). */
const DRIVE = { gain: 5, mix: 0.5, k: 8, points: 2049 } as const;

/** REVERB : longueur de la reponse (s), pre-delai, entree en fondu, passe-bas du bruit (Hz) du debut a la fin de la queue, graines. */
const REVERB = { seconds: 1.2, preDelay: 0.01, fadeIn: 0.003, hiStart: 9000, hiEnd: 2500, seeds: [808, 909] } as const;

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
 */
export function makeImpulse(c: BaseAudioContext): AudioBuffer {
  const sr = c.sampleRate;
  const n = Math.max(2, Math.round(REVERB.seconds * sr));
  const pre = Math.round(REVERB.preDelay * sr);
  const len = n - pre;
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
        const fc = REVERB.hiStart * Math.pow(REVERB.hiEnd / REVERB.hiStart, i / len);
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
  /** branche mouillee de DIST branchee sur le bus */
  driveOn: boolean;
  /** branches debranchees depuis la creation */
  unlinks: number;
}

export interface FxChain {
  setDrive(d: number): void;
  info(): DriveInfo;
}

export interface FxPorts {
  /** sortie des voix */
  bus: AudioNode;
  /** entree de TONE : recoit le sec et le mouille de DIST */
  tone: AudioNode;
}

/** Branche DIST (parallele) sur le graphe de drums.ts, a sa valeur de depart (0 a 1). */
export function buildFx(c: BaseAudioContext, io: FxPorts, drive0: number): FxChain {
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
  io.bus.connect(dry);
  dry.connect(io.tone);
  pre.connect(shaper);
  shaper.connect(wet);
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

  return { setDrive, info: () => ({ drive, driveOn, unlinks }) };
}

/** Insert de saturation d'une voix (meme loi que DIST) : bypass reel a 0. */
export interface DriveStage {
  input: AudioNode;
  set(d: number): void;
  value(): number;
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
  return {
    input,
    set(d: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      if (t === drive) return;
      drive = t;
      if (t === 0) {
        insert.release();
        return;
      }
      glide(pre.gain, (1 + DRIVE.gain * t) / DRIVE.k, c);
      const m = DRIVE.mix * t;
      insert.engage(1 - m, m);
    },
    value: () => drive,
  };
}
