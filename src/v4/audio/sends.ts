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
 * Depuis le 2026-10-10 (la page de chaque FX du MM-RYTM) : DELAY TONE
 * deplace ce passe-bas (setTone), REVERB SIZE, TONE et PRE changent la
 * forme de la reponse (setShape, un convolueur neuf relaye l'ancien) ; a
 * leurs valeurs de depart, le son d'avant.
 *
 * Plus marques le 2026-10-02 (Mika : a 100 % c'etait trop subtil) : envoi
 * a 1 de la REVERB 1.0 (0.3 avant, +10 dB) pour une salle deux fois plus
 * longue, DELAY 0.9 (0.55) et reinjection 0.58 (0.42) : des repetitions
 * qui s'entendent et durent.
 */

import { GLIDE_S, IR_DEFAULT, glide, makeImpulse, type IrShape } from './fx';
import { UNLINK_MS } from './insert';

/** Envoi a 1 : REVERB 1.0 (reponse d'energie unite), DELAY 0.9. */
const REVERB_SEND = 1.0;
const DELAY = { send: 0.9, feedback: 0.58, lowpass: 4500, highpass: 180, steps: 3, maxS: 2, idleMs: 8000 } as const;
/** DELAY TONE au depart (2026-10-10) : le passe-bas des echos d'avant. */
export const DELAY_TONE_HZ = DELAY.lowpass;
/**
 * Une nouvelle forme de REVERB (2026-10-10, SIZE, TONE, PRE) : la reponse se recalcule 150 ms apres le dernier
 * reglage ; son convolueur neuf recoit les envois 300 ms en silence (il se remplit : la queue ne se creuse pas),
 * puis il prend la place de l'ancien en 60 ms ; l'ancien part 40 ms apres.
 */
const SWAP = { debounceMs: 150, prerollS: 0.3, fadeS: 0.06, tailMs: 40 } as const;

export interface SendInfo {
  value: number;
  linked: boolean;
  /** les points de coups verrouilles en attente (revue de R2) */
  points?: number;
}

/** Un envoi d'une source vers une unite : set(0 a 1). */
export interface Send {
  set(v: number): void;
  info(): SendInfo;
}

/** Un envoi qui suit aussi les coups d'une voix verrouillee (les tranches du MM-RYTM). */
export interface LockSend extends Send {
  /**
   * Un coup de la source a `when` (2026-10-08, revue de R2 : les verrous
   * DELAY et REVERB d'une voix du MM-RYTM, Mika : "est-ce que le voice,
   * est-ce que le FX, est-ce que l'enveloppe") : l'envoi vaut v (un verrou)
   * ou sa propre valeur (null) depuis when, jusqu'au coup suivant ; la queue
   * deja envoyee reste dans l'unite, comme un verrou d'envoi d'une Elektron.
   * Rien ne se pose quand l'envoi ne change pas : une source sans verrou ne
   * recoit aucun point (le son de toujours). true : un point pose, a retirer
   * par cancel(tag) si le coup est annule.
   */
  hit(when: number, v: number | null, tag: object): boolean;
  /** Le coup `tag` annule (re-programmation, STOP) : son point s'en va, les autres restent. */
  cancel(tag: object): void;
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
  /** REVERB (2026-10-10) : sa forme, les relais de convolueur faits, un relais en cours */
  irShape?: IrShape;
  swaps?: number;
  swapping?: boolean;
  /** DELAY (2026-10-10) : la coupure du passe-bas des echos (Hz) */
  toneHz?: number;
}

export interface SendBus {
  attach(src: AudioNode): LockSend;
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

/** Un point d'un coup sur un envoi (revue de R2) : a `when`, la valeur v (null : celle de l'envoi), pose par `tag`. */
interface Point {
  when: number;
  v: number | null;
  tag: object;
}

interface SendState {
  src: AudioNode;
  value: number;
  gain: GainNode | null;
  linked: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** les points des coups, dans l'ordre du temps (vide sans verrou) */
  pts: Point[];
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

  /* Les points des coups verrouilles (revue de R2) : chacun tient l'envoi de son instant au point suivant. */
  const effOf = (s: SendState, p: Point): number => (p.v === null ? s.value : p.v);
  /** La valeur de l'envoi a t : celle du dernier point avant t, sinon la sienne. */
  const valueAt = (s: SendState, t: number): number => {
    let v = s.value;
    for (const p of s.pts) {
      if (p.when > t) break;
      v = effOf(s, p);
    }
    return v;
  };
  /** Les points passes s'en vont, sauf le dernier s'il tient encore une autre valeur que celle de l'envoi. */
  const prune = (s: SendState): void => {
    const now = c.currentTime;
    let k = 0;
    while (k + 1 < s.pts.length && s.pts[k + 1].when <= now) k += 1;
    if (k > 0) s.pts.splice(0, k);
    if (s.pts.length > 0 && s.pts[0].when <= now && effOf(s, s.pts[0]) === s.value) s.pts.shift();
  };
  /** Un point au-dessus de 0 (en cours ou a venir) : l'envoi doit rester branche. */
  const hasLive = (s: SendState): boolean => s.pts.some((p) => effOf(s, p) > 0);
  /** Les points a venir reposes sur le gain (apres une rampe ou une annulation qui les a effaces). */
  const repost = (s: SendState, from: number): void => {
    if (!s.gain) return;
    for (const p of s.pts) if (p.when > from) s.gain.gain.setValueAtTime(scale * effOf(s, p), p.when);
  };
  /** Le debranchement d'un envoi revenu a 0 (ms : apres sa rampe, ou apres le dernier point). */
  const unlinkLater = (s: SendState, ms: number): void => {
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.timer = undefined;
      prune(s);
      if (s.value > 0 || hasLive(s)) return;
      s.pts.length = 0;
      unlink(s);
    }, ms);
  };

  const apply = (s: SendState): void => {
    prune(s);
    // Sans point (le cas de toujours) : la valeur de l'envoi ; sinon celle du moment (un verrou en cours la garde)
    const cur = s.pts.length > 0 ? valueAt(s, c.currentTime) : s.value;
    if (cur > 0 || (s.pts.length > 0 && hasLive(s))) {
      link(s);
      if (s.gain) {
        glide(s.gain.gain, scale * cur, c);
        // La rampe efface ce qui suivait : les points a venir reviennent (ceux de la valeur de l'envoi, a la nouvelle)
        if (s.pts.length > 0) repost(s, c.currentTime + GLIDE_S);
      }
      return;
    }
    if (!s.linked || !s.gain) return;
    glide(s.gain.gain, 0, c);
    unlinkLater(s, UNLINK_MS);
  };

  return {
    attach(src: AudioNode): LockSend {
      const s: SendState = { src, value: 0, gain: null, linked: false, timer: undefined, pts: [] };
      sends.push(s);
      return {
        set(v: number) {
          const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
          if (t === s.value) return;
          s.value = t;
          apply(s);
        },
        hit(when: number, v: number | null, tag: object): boolean {
          const lv = v === null || !Number.isFinite(v) ? null : Math.min(1, Math.max(0, v));
          // Ni verrou ni point d'avant : rien du tout (une voix sans verrou sonne exactement comme avant)
          if (lv === null && s.pts.length === 0) return false;
          prune(s);
          const eff = lv ?? s.value;
          if (eff === valueAt(s, when)) return false;
          if (eff > 0) link(s);
          if (!s.gain) return false;
          s.gain.gain.setValueAtTime(scale * eff, when);
          let i = s.pts.length;
          while (i > 0 && s.pts[i - 1].when > when) i -= 1;
          s.pts.splice(i, 0, { when, v: lv, tag });
          // Revenu a 0 (la voix sans envoi, apres un coup verrouille) : debranche une fois ce point passe
          if (eff === 0 && s.value === 0) unlinkLater(s, Math.max(0, when - c.currentTime) * 1000 + UNLINK_MS);
          return true;
        },
        cancel(tag: object): void {
          const i = s.pts.findIndex((p) => p.tag === tag);
          if (i < 0) return;
          const t0 = s.pts[i].when;
          s.pts.splice(i, 1);
          if (!s.gain) return;
          // Le gain repart de ce qui vaut sans ce point, puis les points qui restent apres lui
          const from = Math.max(t0, c.currentTime);
          const g = s.gain.gain;
          g.cancelScheduledValues(from);
          g.setValueAtTime(scale * valueAt(s, from), from);
          repost(s, from);
        },
        info: () => ({ value: s.value, linked: s.linked, points: s.pts.length }),
      };
    },
    silence() {
      clearTimeout(idleTimer);
      idleTimer = undefined;
      for (const s of sends) {
        clearTimeout(s.timer);
        s.timer = undefined;
        s.pts.length = 0;
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

export interface ReverbBus extends SendBus {
  /**
   * SIZE, TONE et PRE (2026-10-10, la page REVERB du MM-RYTM) : la forme de
   * la reponse (fx.ts IrShape). Sans unite construite, elle attend la
   * prochaine ; sinon la reponse se recalcule et le convolueur est relaye
   * sans clic (SWAP). Rien ne bouge si la forme ne change pas.
   */
  setShape(s: Readonly<IrShape>): void;
}

/** Une forme bornee (NaN : celle d'avant). */
const cleanShape = (s: Readonly<IrShape>): IrShape => {
  const b = (v: number, lo: number, hi: number, d: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return { seconds: b(s.seconds, 0.1, 10, IR_DEFAULT.seconds), hiEnd: b(s.hiEnd, 200, 20000, IR_DEFAULT.hiEnd), preDelay: b(s.preDelay, 0, 0.25, IR_DEFAULT.preDelay) };
};
const sameShape = (a: Readonly<IrShape>, b: Readonly<IrShape>): boolean => a.seconds === b.seconds && a.hiEnd === b.hiEnd && a.preDelay === b.preDelay;

/**
 * REVERB : la reponse generee une fois par forme, gardee pour les
 * convolueurs suivants. Chaque convolueur sort par son gain (1 au repos :
 * le son d'avant) ; le relais d'une forme a l'autre fond l'un dans l'autre.
 */
export function buildReverbBus(c: BaseAudioContext, out: AudioNode, shape0: Readonly<IrShape> = IR_DEFAULT): ReverbBus {
  let shape = cleanShape(shape0);
  let ir: AudioBuffer | null = null;
  let irShape: IrShape | null = null;
  let irSeconds = 0;
  let irMs = 0;
  let swaps = 0;
  /** l'unite construite : son entree, le convolueur qui sonne (et sa forme), celui qui s'efface pendant un relais */
  let live: { input: GainNode; cv: ConvolverNode; g: GainNode; shape: IrShape } | null = null;
  let fading: { cv: ConvolverNode; g: GainNode } | null = null;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let swapTimer: ReturnType<typeof setTimeout> | undefined;
  /** un relais en cours ; dirty : la forme a encore change pendant ce temps */
  let busy = false;
  let dirty = false;

  /** La reponse de la forme voulue (recalculee seulement si elle a change). */
  const impulse = (): AudioBuffer => {
    if (ir && irShape && sameShape(irShape, shape)) return ir;
    const t0 = performance.now();
    ir = makeImpulse(c, shape);
    irShape = { ...shape };
    irMs = performance.now() - t0;
    irSeconds = ir.duration;
    return ir;
  };

  /** Un convolueur branche sur l'entree, sorti par son gain g0. */
  const voice = (input: GainNode, buf: AudioBuffer, g0: number): { cv: ConvolverNode; g: GainNode } => {
    const cv = c.createConvolver();
    // Energie deja ramenee a 1 : pas de normalisation propre au navigateur
    cv.normalize = false;
    cv.buffer = buf;
    const g = c.createGain();
    g.gain.value = g0;
    input.connect(cv);
    cv.connect(g);
    g.connect(out);
    return { cv, g };
  };

  const drop = (v: { cv: ConvolverNode; g: GainNode }): void => {
    v.cv.disconnect();
    v.g.disconnect();
  };

  /** Le relais : le convolueur neuf se remplit en silence, puis les deux gains se croisent (temps du contexte). */
  const swap = (): void => {
    debounce = undefined;
    const u = live;
    if (busy) {
      dirty = true;
      return;
    }
    if (!u || sameShape(u.shape, shape)) return;
    busy = true;
    const buf = impulse();
    const nu = voice(u.input, buf, 0);
    const now = c.currentTime;
    const tA = now + SWAP.prerollS;
    const tB = tA + SWAP.fadeS;
    nu.g.gain.setValueAtTime(0, now);
    nu.g.gain.setValueAtTime(0, tA);
    nu.g.gain.linearRampToValueAtTime(1, tB);
    const old = { cv: u.cv, g: u.g };
    old.g.gain.cancelScheduledValues(now);
    old.g.gain.setValueAtTime(1, now);
    old.g.gain.setValueAtTime(1, tA);
    old.g.gain.linearRampToValueAtTime(0, tB);
    fading = old;
    u.cv = nu.cv;
    u.g = nu.g;
    u.shape = { ...shape };
    // L'ancien part une fois le fondu fini, au temps du contexte (un contexte suspendu le retient)
    const finish = (): void => {
      if (c.currentTime < tB && c.state !== 'closed') {
        swapTimer = setTimeout(finish, SWAP.tailMs);
        return;
      }
      swapTimer = undefined;
      if (fading === old) {
        u.input.disconnect(old.cv);
        drop(old);
        fading = null;
      }
      busy = false;
      swaps += 1;
      if (dirty) {
        dirty = false;
        schedule();
      }
    };
    swapTimer = setTimeout(finish, (SWAP.prerollS + SWAP.fadeS) * 1000 + SWAP.tailMs);
  };

  function schedule(): void {
    if (!live) return;
    if (busy) {
      dirty = true;
      return;
    }
    clearTimeout(debounce);
    debounce = setTimeout(swap, SWAP.debounceMs);
  }

  const bus = sendBus(
    c,
    () => {
      const input = c.createGain();
      const v = voice(input, impulse(), 1);
      const u = { input, cv: v.cv, g: v.g, shape: { ...shape } };
      live = u;
      return {
        input,
        dispose() {
          clearTimeout(debounce);
          clearTimeout(swapTimer);
          debounce = undefined;
          swapTimer = undefined;
          busy = false;
          dirty = false;
          input.disconnect();
          drop(u);
          if (fading) drop(fading);
          fading = null;
          if (live === u) live = null;
        },
      };
    },
    REVERB_SEND,
    Infinity,
    () => ({ irSeconds, irMs: Math.round(irMs * 100) / 100, irShape: { ...shape }, swaps, swapping: busy })
  );
  return {
    ...bus,
    setShape(s: Readonly<IrShape>) {
      const n = cleanShape(s);
      if (sameShape(n, shape)) return;
      shape = n;
      schedule();
    },
  };
}

export interface DelayBus extends SendBus {
  /** Duree d'un pas (s) : le delay reste cale sur le tempo. */
  setStep(stepS: number): void;
  /**
   * Sa division en pas (2026-10-09, DLY TIME : 3 la croche pointee d'avant) et
   * sa reinjection (DLY FB : 0.58 avant), les encodeurs G et H du desktop.
   */
  setDiv(steps: number): void;
  setFeedback(fb: number): void;
  /** DELAY TONE (2026-10-10, la page DELAY du MM-RYTM) : le passe-bas de la boucle (Hz), 4.5 kHz au depart. */
  setTone(hz: number): void;
}

/** La coupure du passe-bas des echos, bornee (NaN : celle d'avant). */
const delayTone = (hz: number): number => (Number.isFinite(hz) ? Math.max(200, Math.min(20000, hz)) : DELAY.lowpass);

/** DELAY : cale sur le tempo (la croche pointee au depart), reinjection filtree. */
export function buildDelayBus(c: BaseAudioContext, out: AudioNode, stepS: number, div0: number = DELAY.steps, fb0: number = DELAY.feedback, tone0: number = DELAY.lowpass): DelayBus {
  let step = stepS;
  let div = div0;
  let feedback = Math.max(0, Math.min(0.9, fb0));
  let time = Math.min(DELAY.maxS, div * step);
  let lowpass = delayTone(tone0);
  let node: DelayNode | null = null;
  let fbNode: GainNode | null = null;
  let lpNode: BiquadFilterNode | null = null;
  const bus = sendBus(
    c,
    () => {
      const input = c.createGain();
      const d = c.createDelay(DELAY.maxS);
      d.delayTime.value = time;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      // Nyquist au plus : un 12 kHz a 22.05 kHz d'echantillonnage reste un filtre (le parametre se borne de lui-meme)
      lp.frequency.value = Math.min(lowpass, c.sampleRate / 2);
      lp.Q.value = Math.SQRT1_2;
      lpNode = lp;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = DELAY.highpass;
      hp.Q.value = Math.SQRT1_2;
      const fb = c.createGain();
      fb.gain.value = feedback;
      fbNode = fb;
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
          fbNode = null;
          lpNode = null;
        },
      };
    },
    DELAY.send,
    DELAY.idleMs,
    () => ({ delayS: Math.round(time * 1000) / 1000, toneHz: Math.round(lowpass) })
  );
  const retime = (): void => {
    const t = Math.min(DELAY.maxS, div * step);
    if (t === time) return;
    time = t;
    if (node) glide(node.delayTime, t, c);
  };
  return {
    ...bus,
    setStep(s: number) {
      step = s;
      retime();
    },
    setDiv(n: number) {
      if (!(n > 0) || n === div) return;
      div = n;
      retime();
    },
    setFeedback(f: number) {
      const v = Math.max(0, Math.min(0.9, Number.isFinite(f) ? f : DELAY.feedback));
      if (v === feedback) return;
      feedback = v;
      if (fbNode) glide(fbNode.gain, v, c);
    },
    setTone(hz: number) {
      const v = delayTone(hz);
      if (v === lowpass) return;
      lowpass = v;
      if (lpNode) glide(lpNode.frequency, Math.min(v, c.sampleRate / 2), c);
    },
  };
}
