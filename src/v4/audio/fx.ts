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
 *
 * 2026-10-21 (audit F3, F5) : TRIM, le sec et le mouille baissent ensemble
 * avec DIST (le rapport entre eux ne change pas : a 100 %, une voix
 * sortait 8 a 9 dB plus fort) ; la DIST d'une voix (buildDrive) a le meme
 * passe-bas que celle du bus, regle par le meme DIST TONE.
 */

import { glide, pointAt } from './glide';
import { Insert, UNLINK_MS, type InsertInfo } from './insert';

export { GLIDE_S, glide } from './glide';

/** DIST : D = 1 + gain x d, melange m = mix x d, courbe tanh(k u) sur `points` valeurs (nombre impair : 0 exact au centre). */
const DRIVE = { gain: 12, mix: 0.85, k: 8, points: 2049 } as const;
/**
 * TRIM de la DIST (2026-10-21, audit F5) : sec et mouille x 10^(-9 x d / 20), exactement 1 a DIST 0 (le rapport entre
 * eux, le caractere, ne change pas). Mesure (un coup, RMS 40-500 ms, sans limiteur) : a 100 %, le kick et la caisse
 * claire restent a 0.3 dB de leur niveau sans DIST (+8 a +9 dB avant) ; un son plus doux, que la saturation tient
 * davantage (toms, charleys, clap, cymbale), sort 3 a 8 dB plus fort (+11 a +17 dB avant).
 */
const DIST_TRIM_DB = 9;
const distTrim = (d: number): number => (d > 0 ? Math.pow(10, (-DIST_TRIM_DB * d) / 20) : 1);
/** Le sec, l'entree de la saturation et le mouille d'un reglage d (0 a 1). */
const driveMix = (d: number): { dry: number; pre: number; wet: number } => {
  const m = DRIVE.mix * d;
  const k = distTrim(d);
  return { dry: k * (1 - m), pre: (1 + DRIVE.gain * d) / DRIVE.k, wet: k * m };
};

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
  /** tenue par les scenes (2026-10-27) */
  held?: boolean;
}

export interface FxChain {
  setDrive(d: number): void;
  /**
   * Tenue (2026-10-27, les scenes) : tant qu'une scene du motif mene DIST, la branche mouillee reste reliee meme a 0
   * (le mouille a 0 : le meme signal), un crossfader qui passe par 0 ne la debranche ni ne la rebranche.
   */
  hold(on: boolean): void;
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
  const openHz = (hz: number): number => distToneHz(c, hz);
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
  let held = false;

  const setDrive = (d: number): void => {
    if (d === drive) return;
    drive = d;
    if (d > 0) {
      if (driveTimer !== undefined) clearTimeout(driveTimer);
      driveTimer = undefined;
      if (!driveOn) {
        io.bus.connect(pre);
        driveOn = true;
      }
    }
    const m = driveMix(d);
    glide(dry.gain, m.dry, c);
    glide(pre.gain, m.pre, c);
    glide(wet.gain, m.wet, c);
    if (d > 0 || !driveOn || held) return;
    unlinkLater();
  };

  function unlinkLater(): void {
    clearTimeout(driveTimer);
    driveTimer = setTimeout(() => {
      driveTimer = undefined;
      if (drive > 0 || !driveOn || held) return;
      io.bus.disconnect(pre);
      driveOn = false;
      unlinks += 1;
    }, UNLINK_MS);
  }

  const hold = (on: boolean): void => {
    if (on === held) return;
    held = on;
    if (on) {
      clearTimeout(driveTimer);
      driveTimer = undefined;
      if (!driveOn) {
        io.bus.connect(pre);
        driveOn = true;
      }
    } else if (drive === 0 && driveOn) unlinkLater();
  };

  setDrive(drive0);

  const setTone = (hz: number): void => {
    const t = openHz(hz);
    if (t === toneHz) return;
    toneHz = t;
    glide(lp.frequency, t, c);
  };

  return { setDrive, hold, setTone, info: () => ({ drive, toneHz, driveOn, unlinks, held }) };
}

/** DIST TONE en Hz : 16 kHz et plus (ou NaN), le passe-bas pose a Nyquist (ouvert, exactement 1) ; sinon borne. */
const distToneHz = (c: BaseAudioContext, hz: number): number => (!Number.isFinite(hz) || hz >= DIST_OPEN_HZ ? c.sampleRate / 2 : Math.max(20, Math.min(c.sampleRate / 2, hz)));

/** Insert de saturation d'une voix (meme loi que DIST) : bypass reel a 0. */
export interface DriveStage {
  input: AudioNode;
  set(d: number): void;
  value(): number;
  /**
   * Les verrous DIST de la voix (2026-10-09, audio/lockfx.ts) : tenue (la
   * branche reste reliee, au repos le meme signal), et la valeur d'un coup a
   * l'instant when (prev, 2026-10-21 : la valeur d'avant, une rampe de 3 ms).
   */
  lockHold(on: boolean): void;
  lockAt(when: number, d: number, prev?: number): void;
  lockClear(t: number): void;
  /** DIST TONE (2026-10-21, audit F3) : le passe-bas du mouille de la voix, le meme reglage que celui du bus. */
  setTone(hz: number): void;
  /** Appele apres une rampe de set() (elle efface ce qui etait programme) : audio/lockfx.ts repose ses points. */
  onRetime: (() => void) | null;
  /** l'insert (2026-10-27, debug : tenu par les scenes, ses debranchements) */
  insert(): InsertInfo & { held: boolean };
}

export function buildDrive(c: BaseAudioContext, out: AudioNode, tone0: number = DIST_OPEN_HZ): DriveStage {
  const input = c.createGain();
  input.gain.value = 1;
  const pre = c.createGain();
  pre.gain.value = 1 / DRIVE.k;
  const shaper = c.createWaveShaper();
  shaper.curve = driveCurve();
  shaper.oversample = 'none';
  pre.connect(shaper);
  // DIST TONE (2026-10-21) : le passe-bas apres la saturation, comme buildFx ; ouvert (Nyquist) il vaut exactement 1
  let toneHz = distToneHz(c, tone0);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 20 * Math.log10(Math.SQRT1_2);
  lp.frequency.value = toneHz;
  shaper.connect(lp);
  const insert = new Insert(c, input, out);
  insert.setBranch(pre, lp);
  let drive = 0;
  /** DIST TONE change pendant le repos : pose sur le filtre avant que la branche se relie */
  let toneLate = false;
  const toneNow = (): void => {
    if (!toneLate) return;
    toneLate = false;
    lp.frequency.cancelScheduledValues(0);
    lp.frequency.value = toneHz;
  };
  const stage: DriveStage = {
    input,
    onRetime: null,
    set(d: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      if (t === drive) return;
      drive = t;
      if (t === 0) insert.release();
      else {
        const m = driveMix(t);
        glide(pre.gain, m.pre, c);
        toneNow();
        insert.engage(m.dry, m.wet);
      }
      stage.onRetime?.();
    },
    value: () => drive,
    insert: () => ({ ...insert.info(), held: insert.isHeld }),
    lockHold(on: boolean) {
      if (on) toneNow();
      insert.hold(on);
      // Lache (le dernier verrou DIST retire, revue du 2026-10-09) : l'entree revient a celle de la voix, les points s'effacent
      if (!on) glide(pre.gain, driveMix(drive).pre, c);
    },
    lockAt(when: number, d: number, prev?: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      const m = driveMix(t);
      const p = prev === undefined || !Number.isFinite(prev) ? null : driveMix(Math.min(1, Math.max(0, prev)));
      if (!insert.at(when, m.dry, m.wet, p ?? undefined)) return;
      const at = Math.max(when, c.currentTime);
      if (p) pointAt(pre.gain, p.pre, m.pre, at, c);
      else pre.gain.setValueAtTime(m.pre, at);
    },
    lockClear(t: number) {
      insert.clearFrom(t);
      pre.gain.cancelScheduledValues(Math.max(t, c.currentTime));
    },
    setTone(hz: number) {
      const v = distToneHz(c, hz);
      if (v === toneHz) return;
      toneHz = v;
      // Au repos (lien direct, la branche debranchee) rien ne passe par ce filtre : la valeur attend que la branche se
      // relie (2026-10-27, les scenes : DIST TONE suivi au crossfader ne touche plus huit filtres muets a chaque pas)
      if (insert.isDirect) {
        toneLate = true;
        return;
      }
      glide(lp.frequency, v, c);
    },
  };
  return stage;
}
