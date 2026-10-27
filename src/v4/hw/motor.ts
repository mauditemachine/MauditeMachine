/**
 * Le retour vers les potards motorises du boitier MM-RYTM (2026-10-27, la phase 3, MMHW v2 : CC 20 a 27 en sortie, a la
 * position cible ; le toucher CC 30 a 37, 127 tenu, 0 lache). Pur, sans import ni minuteur propre : l'horloge et les
 * minuteries sont injectees (les tests les avancent a la main), le site lui donne performance.now et setTimeout
 * (hw/index.ts).
 *
 * Les regles (la spec de Mika) :
 * - le potard k recoit sa valeur (0 a 1) quand elle change pour toute autre cause que ce potard lui-meme : un preset,
 *   UNDO, une scene, le crossfader, une autre page, une autre voix, le P-LOCK, le MIDI d'un autre appareil ;
 * - au plus hz (30) envois par seconde et par potard ; la derniere valeur part toujours (un envoi differe la porte) ;
 * - la garde d'echo : apres un mouvement du potard rapporte par le pont (pot), plus rien ne part vers lui pendant
 *   echoMs (150 ms, refaite a chaque mouvement) ; a la fin, sa valeur dans le site part seulement si elle n'est pas
 *   celle du potard (un cran qui a happe la valeur, un autre appareil qui l'a changee pendant la garde) ;
 * - le toucher : tant que le potard est touche, le site ne le pousse pas (rien ne part) ; au lacher, la derniere valeur
 *   part une fois.
 * Le site croit le moteur la ou il l'a envoye, ou la ou le pont dit que la main l'a mis : une valeur deja la ne repart pas.
 */

export interface MotorClock {
  /** l'heure, en ms */
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(id: unknown): void;
}

export interface MotorOptions {
  /** les potards (8) */
  knobs?: number;
  /** envois par seconde et par potard, au plus (30) */
  hz?: number;
  /** la garde d'echo apres un mouvement du potard (150 ms) */
  echoMs?: number;
  /** a la fin de la garde, l'ecart a la valeur du potard en dessous duquel rien ne repart (un demi-cran de 127) */
  eps?: number;
}

export type MotorListener = (k: number, value01: number) => void;

/** L'etat d'un potard (les tests, le debug). */
export interface MotorKnobState {
  /** la derniere valeur du site (null : pas encore connue) */
  readonly latest: number | null;
  /** la ou le site croit le moteur (envoyee, ou rapportee par le pont) */
  readonly at: number | null;
  readonly touched: boolean;
  /** dans la garde d'echo */
  readonly guarded: boolean;
  /** un envoi differe attend (le plafond de hz) */
  readonly pending: boolean;
  /** les envois depuis le debut */
  readonly sends: number;
}

export interface MotorFeed {
  /** la valeur du potard k a change dans le site ; fromPot : c'est ce potard qui l'a tournee (jamais renvoyee) */
  change(k: number, value01: number, fromPot?: boolean): void;
  /** le pont rapporte un mouvement du potard k (la main), a value01 : la garde d'echo s'ouvre */
  pot(k: number, value01: number): void;
  /** le potard k touche (true) ou lache (false) */
  touch(k: number, on: boolean): void;
  subscribe(fn: MotorListener): () => void;
  state(k: number): MotorKnobState;
  /** toutes les minuteries s'arretent */
  dispose(): void;
}

interface Knob {
  latest: number | null;
  at: number | null;
  sentAt: number;
  timer: unknown;
  potAt: number;
  potV: number | null;
  guardTimer: unknown;
  touched: boolean;
  sends: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function motorFeed(clock: MotorClock, o: MotorOptions = {}): MotorFeed {
  const n = o.knobs ?? 8;
  const gap = 1000 / (o.hz ?? 30);
  const echoMs = o.echoMs ?? 150;
  const eps = o.eps ?? 0.5 / 127;
  const listeners = new Set<MotorListener>();
  const knobs: Knob[] = Array.from({ length: n }, () => ({ latest: null, at: null, sentAt: -Infinity, timer: null, potAt: -Infinity, potV: null, guardTimer: null, touched: false, sends: 0 }));
  const ok = (k: number): boolean => Number.isInteger(k) && k >= 0 && k < n;
  const guarded = (s: Knob): boolean => s.guardTimer !== null;

  function stopTimer(s: Knob): void {
    if (s.timer !== null) clock.clearTimer(s.timer);
    s.timer = null;
  }

  function deliver(k: number): void {
    const s = knobs[k];
    stopTimer(s);
    if (s.latest === null) return;
    const v = s.latest;
    s.at = v;
    s.sentAt = clock.now();
    s.sends += 1;
    for (const fn of listeners) fn(k, v);
  }

  /** La derniere valeur vers le moteur, sous le plafond de hz : tout de suite, ou a la fin de l'intervalle (elle part alors telle qu'elle sera). */
  function push(k: number, force = false): void {
    const s = knobs[k];
    if (s.latest === null || s.touched || guarded(s)) return;
    if (!force && s.at === s.latest) {
      stopTimer(s);
      return;
    }
    const wait = s.sentAt + gap - clock.now();
    if (wait <= 0) {
      deliver(k);
      return;
    }
    if (s.timer !== null) return;
    // Arrondi au-dessus : une minuterie a la ms pres ne part jamais avant l'intervalle (jamais plus de hz)
    s.timer = clock.setTimer(() => {
      s.timer = null;
      if (s.touched || guarded(s)) return;
      if (force || s.at !== s.latest) deliver(k);
    }, Math.ceil(wait));
  }

  function guardEnd(k: number): void {
    const s = knobs[k];
    s.guardTimer = null;
    if (s.touched || s.latest === null) return;
    // Le moteur est la ou la main l'a laisse (s.at) : seule une autre valeur repart
    if (s.potV !== null && Math.abs(s.latest - s.potV) <= eps) return;
    push(k);
  }

  return {
    change(k, value01, fromPot = false) {
      if (!ok(k) || !Number.isFinite(value01)) return;
      const s = knobs[k];
      s.latest = clamp01(value01);
      // Le potard lui-meme, touche, ou dans la garde d'echo : rien ne part (la fin de la garde ou le lacher s'en chargent)
      if (fromPot || s.touched || guarded(s)) return;
      push(k);
    },
    pot(k, value01) {
      if (!ok(k) || !Number.isFinite(value01)) return;
      const s = knobs[k];
      const v = clamp01(value01);
      s.potAt = clock.now();
      s.potV = v;
      // La main a mis le moteur la : un envoi differe d'avant ne doit pas le ramener en arriere
      s.at = v;
      stopTimer(s);
      if (s.guardTimer !== null) clock.clearTimer(s.guardTimer);
      s.guardTimer = clock.setTimer(() => guardEnd(k), echoMs);
    },
    touch(k, on) {
      if (!ok(k)) return;
      const s = knobs[k];
      if (on) {
        s.touched = true;
        stopTimer(s);
        return;
      }
      if (!s.touched) return;
      s.touched = false;
      // Le lacher : la derniere valeur part une fois, garde d'echo levee (la main est partie)
      if (s.guardTimer !== null) clock.clearTimer(s.guardTimer);
      s.guardTimer = null;
      push(k, true);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    state(k) {
      const s = knobs[k];
      return { latest: s.latest, at: s.at, touched: s.touched, guarded: guarded(s), pending: s.timer !== null, sends: s.sends };
    },
    dispose() {
      for (const s of knobs) {
        stopTimer(s);
        if (s.guardTimer !== null) clock.clearTimer(s.guardTimer);
        s.guardTimer = null;
      }
      listeners.clear();
    },
  };
}
