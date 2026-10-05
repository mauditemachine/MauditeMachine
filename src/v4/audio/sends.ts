/**
 * Effets a envoi partages (2026-10-01, effets par piste) : la REVERB et le
 * DELAY. Chaque source (le bus entier apres LEVEL, ou une voix seule) a
 * son propre envoi ; tous les envois d'un effet rejoignent UNE unite
 * (un convolueur, une ligne de retard), dont le retour entre dans
 * l'analyseur, avant le master (?mute=1 tient).
 *
 * Bypass reel : un envoi a 0 est debranche de sa source 60 ms apres sa
 * rampe ; l'unite se construit au premier envoi au-dessus de 0. Le delay,
 * boucle de reinjection, s'arrete tout a fait 8 s apres le dernier envoi
 * revenu a 0 (sa queue s'est eteinte) : au repos, rien ne tourne.
 *
 * REVERB : la reponse de fx.ts (bruit stereo, 2.4 s), generee une fois,
 * gardee apres silence(). DELAY : croche pointee (3 pas) calee sur le
 * tempo, reinjection 0.58 a travers un passe-bas (4.5 kHz) et un
 * passe-haut (180 Hz) : les repetitions s'assombrissent, sans boue.
 *
 * Plus marques le 2026-10-02 (Mika : a 100 % c'etait trop subtil) : envoi
 * a 1 de la REVERB 1.0 (0.3 avant, +10 dB) pour une salle deux fois plus
 * longue, DELAY 0.9 (0.55) et reinjection 0.58 (0.42) : des repetitions
 * qui s'entendent et durent.
 */

import { glide, makeImpulse } from './fx';
import { UNLINK_MS } from './insert';

/** Envoi a 1 : REVERB 1.0 (reponse d'energie unite), DELAY 0.9. */
const REVERB_SEND = 1.0;
const DELAY = { send: 0.9, feedback: 0.58, lowpass: 4500, highpass: 180, steps: 3, maxS: 2, idleMs: 8000 } as const;

export interface SendInfo {
  value: number;
  linked: boolean;
}

/** Un envoi d'une source vers une unite : set(0 a 1). */
export interface Send {
  set(v: number): void;
  info(): SendInfo;
}

export interface BusInfo {
  /** unite construite (convolueur ou ligne de retard) */
  live: boolean;
  /** envois branches */
  linked: number;
  unlinks: number;
  irSeconds: number;
  irMs: number;
  delayS: number;
}

export interface SendBus {
  attach(src: AudioNode): Send;
  /** Demontage : l'unite et sa queue sont jetees, les envois debranches (leurs valeurs gardees). */
  silence(): void;
  /** Apres silence() : les envois au-dessus de 0 se rebranchent sur une unite neuve. */
  revive(): void;
  /**
   * L'unite construite d'avance, en temps libre (2026-10-05) : le premier
   * tour de REVERB ne calcule plus sa reponse sous la musique (un gel de
   * 130 ms, une note en retard). Seulement pour un bus jamais arrete.
   */
  warm(): void;
  info(): BusInfo;
}

interface Unit {
  input: AudioNode;
  dispose(): void;
}

interface SendState {
  src: AudioNode;
  value: number;
  gain: GainNode | null;
  linked: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Le bus generique : `make` construit l'unite (entree, sortie deja reliee
 * a out), `scale` l'envoi a 1. idleMs : delai d'arret de l'unite quand
 * plus aucun envoi n'est branche (Infinity : jamais).
 */
function sendBus(c: BaseAudioContext, make: () => Unit, scale: number, idleMs: number, extra: () => Partial<BusInfo>): SendBus {
  let unit: Unit | null = null;
  const sends: SendState[] = [];
  let unlinks = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const ensureUnit = (): Unit => {
    clearTimeout(idleTimer);
    idleTimer = undefined;
    if (!unit) unit = make();
    return unit;
  };

  const maybeIdle = (): void => {
    if (!Number.isFinite(idleMs) || !unit || sends.some((s) => s.linked)) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (!unit || sends.some((s) => s.linked)) return;
      unit.dispose();
      unit = null;
    }, idleMs);
  };

  const link = (s: SendState): void => {
    clearTimeout(s.timer);
    s.timer = undefined;
    const u = ensureUnit();
    if (!s.gain) {
      s.gain = c.createGain();
      s.gain.gain.value = 0;
      s.gain.connect(u.input);
    }
    if (!s.linked) {
      s.src.connect(s.gain);
      s.linked = true;
    }
  };

  const unlink = (s: SendState): void => {
    if (s.linked && s.gain) {
      s.src.disconnect(s.gain);
      unlinks += 1;
    }
    s.linked = false;
    s.gain?.disconnect();
    s.gain = null;
    maybeIdle();
  };

  const apply = (s: SendState): void => {
    if (s.value > 0) {
      link(s);
      if (s.gain) glide(s.gain.gain, scale * s.value, c);
      return;
    }
    if (!s.linked || !s.gain) return;
    glide(s.gain.gain, 0, c);
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.timer = undefined;
      if (s.value > 0) return;
      unlink(s);
    }, UNLINK_MS);
  };

  return {
    attach(src: AudioNode): Send {
      const s: SendState = { src, value: 0, gain: null, linked: false, timer: undefined };
      sends.push(s);
      return {
        set(v: number) {
          const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
          if (t === s.value) return;
          s.value = t;
          apply(s);
        },
        info: () => ({ value: s.value, linked: s.linked }),
      };
    },
    silence() {
      clearTimeout(idleTimer);
      idleTimer = undefined;
      for (const s of sends) {
        clearTimeout(s.timer);
        s.timer = undefined;
        if (s.linked && s.gain) {
          s.src.disconnect(s.gain);
          unlinks += 1;
        }
        s.linked = false;
        s.gain?.disconnect();
        s.gain = null;
      }
      unit?.dispose();
      unit = null;
    },
    revive() {
      for (const s of sends) if (s.value > 0 && !s.linked) apply(s);
    },
    warm() {
      if (!Number.isFinite(idleMs)) ensureUnit();
    },
    info: () => ({
      live: unit !== null,
      linked: sends.filter((s) => s.linked).length,
      unlinks,
      irSeconds: 0,
      irMs: 0,
      delayS: 0,
      ...extra(),
    }),
  };
}

/** REVERB : la reponse generee une fois, gardee pour les convolueurs suivants. */
export function buildReverbBus(c: BaseAudioContext, out: AudioNode): SendBus {
  let ir: AudioBuffer | null = null;
  let irSeconds = 0;
  let irMs = 0;
  return sendBus(
    c,
    () => {
      const t0 = performance.now();
      const first = !ir;
      const buf = ir ?? makeImpulse(c);
      ir = buf;
      if (first) {
        irMs = performance.now() - t0;
        irSeconds = buf.duration;
      }
      const input = c.createGain();
      const cv = c.createConvolver();
      // Energie deja ramenee a 1 : pas de normalisation propre au navigateur
      cv.normalize = false;
      cv.buffer = buf;
      input.connect(cv);
      cv.connect(out);
      return {
        input,
        dispose() {
          input.disconnect();
          cv.disconnect();
        },
      };
    },
    REVERB_SEND,
    Infinity,
    () => ({ irSeconds, irMs: Math.round(irMs * 100) / 100 })
  );
}

export interface DelayBus extends SendBus {
  /** Duree d'un pas (s) : le delay reste une croche pointee. */
  setStep(stepS: number): void;
}

/** DELAY : croche pointee calee sur le tempo, reinjection filtree. */
export function buildDelayBus(c: BaseAudioContext, out: AudioNode, stepS: number): DelayBus {
  let time = Math.min(DELAY.maxS, DELAY.steps * stepS);
  let node: DelayNode | null = null;
  const bus = sendBus(
    c,
    () => {
      const input = c.createGain();
      const d = c.createDelay(DELAY.maxS);
      d.delayTime.value = time;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = DELAY.lowpass;
      lp.Q.value = Math.SQRT1_2;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = DELAY.highpass;
      hp.Q.value = Math.SQRT1_2;
      const fb = c.createGain();
      fb.gain.value = DELAY.feedback;
      input.connect(d);
      d.connect(lp);
      lp.connect(hp);
      hp.connect(fb);
      fb.connect(d);
      hp.connect(out);
      node = d;
      return {
        input,
        dispose() {
          for (const n of [input, d, lp, hp, fb]) n.disconnect();
          node = null;
        },
      };
    },
    DELAY.send,
    DELAY.idleMs,
    () => ({ delayS: Math.round(time * 1000) / 1000 })
  );
  return {
    ...bus,
    setStep(s: number) {
      const t = Math.min(DELAY.maxS, DELAY.steps * s);
      if (t === time) return;
      time = t;
      if (node) glide(node.delayTime, t, c);
    },
  };
}
