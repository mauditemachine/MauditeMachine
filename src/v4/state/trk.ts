/**
 * TRK, la touche des voix (2026-10-27, la phase 2 du MM-RYTM V.4.0, Mika : "comme la DIGITAKT") : tenue, les pas 1 a 8
 * choisissent leur voix (BD a CY), les pas 9 a 16 sont reserves ; tapee, elle se garde jusqu'au choix d'une voix, puis la
 * vue reste PAD_DOUBLE_TAP_MS (la place d'une deuxieme tape) et s'eteint. La machine (state/holdLatch.ts) est pure : ici,
 * la seule minuterie (la fin de la fermeture, posee au premier usage, jamais une par pas), et ce qui l'eteint : une autre
 * machine, la fenetre qui perd le focus (les mains sont parties : tenue, eteinte ; gardee, elle reste), la couche de
 * saisie demontee (ui/Hotspots.tsx), Echap (actions.ts escape).
 */

import { FACE_HOLD_MS, PAD_DOUBLE_TAP_MS } from '../theme';
import { faceTouch } from './ctl';
import { focus } from './focus';
import { holdLatch } from './holdLatch';

export const trk = holdLatch({ tapMs: FACE_HOLD_MS, onUse: 'close', closeMs: PAD_DOUBLE_TAP_MS });

/** CONTROL ALL (V.5.2, actions.ts) : TRK + un potard d'une page de voix regle les huit voix ; l'ecran le dit tant qu'il dure. */
let ctlAllOn = false;
const ctlAllListeners = new Set<() => void>();
export const ctlAllState = {
  get: (): boolean => ctlAllOn,
  set(on: boolean): void {
    if (on === ctlAllOn) return;
    ctlAllOn = on;
    ctlAllListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    ctlAllListeners.add(fn);
    return () => {
      ctlAllListeners.delete(fn);
    };
  },
};

/** La minuterie de la fermeture (0 : aucune) ; un usage pendant la fermeture ne la refait pas, elle se recale a son heure. */
let timer = 0;
/** Les minuteries posees depuis le chargement (les tests : une seule par fermeture). */
let timers = 0;

function arm(): void {
  const s = trk.get();
  if (s.mode !== 'closing') {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    return;
  }
  if (timer) return;
  const wait = Math.max(0, s.since + PAD_DOUBLE_TAP_MS - performance.now());
  timers += 1;
  timer = window.setTimeout(fire, wait + 1);
}

/** Un potard tenu (V.5.2, la revue de D3a, R5) : TRK ne s'eteint pas sous lui, la fermeture attend son lacher. */
const HELD_RETRY_MS = 100;

function fire(): void {
  timer = 0;
  if (faceTouch.anyHeld()) {
    timer = window.setTimeout(fire, HELD_RETRY_MS);
    return;
  }
  trk.tick(performance.now());
  arm();
}

/** Le debug (__v4.rytm.trk) : l'etat et les minuteries posees. */
export const trkDebug = {
  get mode() {
    return trk.get().mode;
  },
  get holders() {
    return trk.get().holders;
  },
  get used() {
    return trk.get().used;
  },
  get timers() {
    return timers;
  },
};

if (typeof window !== 'undefined') {
  trk.subscribe(arm);
  // Une autre machine : TRK s'eteint (comme le P-LOCK, state/rytmLock.ts)
  focus.subscribe(() => {
    if (focus.get() !== 'mm808') trk.cancel();
  });
  window.addEventListener('blur', () => trk.releaseAll());
}
