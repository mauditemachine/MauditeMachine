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
 *
 * 2026-11-10 (Mika : "la disto doit faire comme si c'etait du gros hardcore sale") : la loi refaite, DRIVE plus bas. Le
 * gain monte en dB (jusqu'a 40 dB, x100, contre 22 dB : la queue d'un kick, 40 dB sous sa crete, ecrete encore, elle
 * tient comme une onde carree, le kick du gabber), la courbe n'est plus un tanh propre (distShape : un ecretage dur, une
 * corne sur le front qui monte, un cote arrondi et l'autre non, des harmoniques paires et impaires), et le mouille prend
 * toute la place en haut de course (1 - (1 - d)^2, contre 0.85 d). Apres l'ecretage, le MORDANT (BITE) : une cloche a
 * 2.5 kHz qui monte avec DIST (jusqu'a +8 dB), le medium aigu qui racle d'un kick de hardcore ; DIST TONE, apres, la
 * retient si on veut. Le TRIM par bus (DIST_TRIM) : 2 dB sur la voie du kick, 8 sur le bus des autres voix (un son
 * bref et aigu gagne bien plus de niveau a etre ecrete qu'un kick), 5 pour la DIST d'une voix seule.
 *
 *   bus -> pre (D / K) -> WaveShaper -> mordant -> passe-bas -> mouille (m) -> TONE
 */

import { glide, pointAt } from './glide';
import { Insert, UNLINK_MS, type InsertInfo } from './insert';

export { GLIDE_S, glide } from './glide';

/**
 * DIST (2026-11-10) : le gain D = 10^(maxDb x d / 20), le melange m = 1 - (1 - d)^mixPow, la courbe distShape(k u) sur
 * `points` valeurs (nombre impair : 0 exact au centre) ; k : l'etendue de la courbe (au-dela, le WaveShaper tient sa
 * derniere valeur, le plateau). top et plateau : la crete de la corne et le niveau tenu de l'ecretage.
 */
const DRIVE = { maxDb: 40, mixPow: 2, k: 4, points: 8193, top: 2 / 3, plateau: 0.5 } as const;
/**
 * La courbe de la DIST (2026-11-10), gain 1 autour de 0 des deux cotes. Cote positif : x - x^3 / 3 jusqu'a 1 (la crete,
 * 2 / 3), puis elle REDESCEND vers le plateau (0.5 a partir de 2) : un son pousse loin garde une corne a chaque front
 * montant, le grain sale. Cote negatif : un tanh qui rejoint -0.5 sans corne. Les deux plateaux egaux : pas de continu
 * dans un son ecrete a fond ; les deux cotes differents : des harmoniques paires en plus des impaires.
 */
export function distShape(x: number): number {
  if (x >= 0) {
    if (x <= 1) return x - (x * x * x) / 3;
    if (x < 2) return DRIVE.plateau + (DRIVE.top - DRIVE.plateau) * 0.5 * (1 + Math.cos(Math.PI * (x - 1)));
    return DRIVE.plateau;
  }
  return -DRIVE.plateau * Math.tanh(-x / DRIVE.plateau);
}
/** La loi de la DIST pour un reglage d (0 a 1) : le gain d'entree (x), le melange (0 a 1) ; l'ecran et les cartes la lisent. */
export const distLaw = (d: number): { gain: number; mix: number } => {
  const t = Math.min(1, Math.max(0, d));
  return { gain: Math.pow(10, (DRIVE.maxDb * t) / 20), mix: 1 - Math.pow(1 - t, DRIVE.mixPow) };
};
/**
 * TRIM de la DIST (2026-10-21, audit F5) : sec et mouille x 10^(-TRIM x d / 20), exactement 1 a DIST 0 (le rapport entre
 * eux, le caractere, ne change pas). 2026-11-10 (la loi du gros hardcore) : un TRIM par bus (9 dB partout avant), cale
 * sur le vrai moteur (renderOffline, un coup seul du kit de depart, sans limiteur, fenetres de 50 a 350 ms) : a 100 %,
 * avec 6 et 10 dB le corps du kick sortait 2.2 dB SOUS son niveau sec et celui de la caisse claire 3 dB sous le sien.
 * Avec 2 dB (kick) et 8 dB (pads) : le corps du kick 2 dB au-dessus du sec et sa queue 8 dB au-dessus, la caisse claire
 * a son niveau avec une queue 14 dB plus haute, les charleys et le clap 6 a 8 dB plus fort. C'est voulu : la DIST a fond
 * doit s'entendre, le kick devant.
 */
export const DIST_TRIM = { kick: 2, pads: 8, voice: 5 } as const;
const distTrim = (d: number, trimDb: number): number => (d > 0 ? Math.pow(10, (-trimDb * d) / 20) : 1);
/**
 * Le MORDANT (2026-11-10) : une cloche (peaking) apres l'ecretage, a hz, de largeur q, son gain db x d^pow (rien en bas
 * de course, +8 dB a fond). Mesure sur un kick a 100 % : la part au-dessus de 2 kHz passe de -20.8 dB (l'ancienne loi)
 * a -13.9 dB, au-dessus de 5 kHz de -30 a -20 dB.
 */
const BITE = { hz: 2500, q: 0.9, db: 8, pow: 1.5 } as const;
/** Le gain du mordant (dB) pour un reglage d (0 a 1) ; le plugin a la meme loi (plugin/mm-rytm/dsp/Fx.cpp). */
export const distBiteDb = (d: number): number => BITE.db * Math.pow(Math.min(1, Math.max(0, d)), BITE.pow);
/** Le sec, l'entree de la saturation, le mouille et le mordant (dB) d'un reglage d (0 a 1). */
const driveMix = (d: number, trimDb: number): { dry: number; pre: number; wet: number; bite: number } => {
  const { gain, mix: m } = distLaw(d);
  const k = distTrim(d, trimDb);
  return { dry: k * (1 - m), pre: gain / DRIVE.k, wet: k * m, bite: distBiteDb(d) };
};
/** La cloche du mordant, a plat (gain 0 : elle laisse tout passer). */
function biteFilter(c: BaseAudioContext): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = BITE.hz;
  f.Q.value = BITE.q;
  f.gain.value = 0;
  return f;
}

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

/** distShape(k u) pour u de -1 a 1 : l'entree du WaveShaper est pre-divisee par k (au-dela de 1, il tient le plateau). */
export function driveCurve(): Float32Array {
  const n = DRIVE.points;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) c[i] = distShape(DRIVE.k * ((i / (n - 1)) * 2 - 1));
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
export function buildFx(c: BaseAudioContext, io: FxPorts, drive0: number, tone0: number = DIST_OPEN_HZ, trimDb: number = DIST_TRIM.kick): FxChain {
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
  // Le mordant (2026-11-10) : entre l'ecretage et DIST TONE
  const bite = biteFilter(c);
  io.bus.connect(dry);
  dry.connect(io.tone);
  pre.connect(shaper);
  shaper.connect(bite);
  bite.connect(lp);
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
    const m = driveMix(d, trimDb);
    glide(dry.gain, m.dry, c);
    glide(pre.gain, m.pre, c);
    glide(wet.gain, m.wet, c);
    glide(bite.gain, m.bite, c);
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

export function buildDrive(c: BaseAudioContext, out: AudioNode, tone0: number = DIST_OPEN_HZ, trimDb: number = DIST_TRIM.voice): DriveStage {
  const input = c.createGain();
  input.gain.value = 1;
  const pre = c.createGain();
  pre.gain.value = 1 / DRIVE.k;
  const shaper = c.createWaveShaper();
  shaper.curve = driveCurve();
  shaper.oversample = 'none';
  pre.connect(shaper);
  // Le mordant (2026-11-10), comme buildFx
  const bite = biteFilter(c);
  // DIST TONE (2026-10-21) : le passe-bas apres la saturation, comme buildFx ; ouvert (Nyquist) il vaut exactement 1
  let toneHz = distToneHz(c, tone0);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 20 * Math.log10(Math.SQRT1_2);
  lp.frequency.value = toneHz;
  shaper.connect(bite);
  bite.connect(lp);
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
        const m = driveMix(t, trimDb);
        glide(pre.gain, m.pre, c);
        glide(bite.gain, m.bite, c);
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
      if (!on) {
        const m = driveMix(drive, trimDb);
        glide(pre.gain, m.pre, c);
        glide(bite.gain, m.bite, c);
      }
    },
    lockAt(when: number, d: number, prev?: number) {
      const t = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 0;
      const m = driveMix(t, trimDb);
      const p = prev === undefined || !Number.isFinite(prev) ? null : driveMix(Math.min(1, Math.max(0, prev)), trimDb);
      if (!insert.at(when, m.dry, m.wet, p ?? undefined)) return;
      const at = Math.max(when, c.currentTime);
      if (p) {
        pointAt(pre.gain, p.pre, m.pre, at, c);
        pointAt(bite.gain, p.bite, m.bite, at, c);
      } else {
        pre.gain.setValueAtTime(m.pre, at);
        bite.gain.setValueAtTime(m.bite, at);
      }
    },
    lockClear(t: number) {
      insert.clearFrom(t);
      pre.gain.cancelScheduledValues(Math.max(t, c.currentTime));
      bite.gain.cancelScheduledValues(Math.max(t, c.currentTime));
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
