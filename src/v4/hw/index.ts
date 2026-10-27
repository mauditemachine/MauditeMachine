/**
 * Les crochets du site pour le pont MMHW v2 du boitier MM-RYTM (2026-10-27, la phase 3 ; le dossier
 * hardware/mm-rytm-hw/, protocol.js et rytm-bridge.js, n'est pas encore dans le depot : rien ici ne suppose son format de
 * fil). Le contrat : docs/hardware/mmhw-v2-app-side.md. Rien dans le site n'appelle le pont ; seul le debug l'expose
 * (window.__v4.hw, avec ?debug=1). Rien ne demarre a l'import : le premier subscribe, pot ou touch branche le retour sur
 * les potards de la face (rytm/faceKnobs.ts).
 *
 * - resolve(id) : la cible d'un id du registre MIDI (midi/targets.ts targetOf, la fonction de la couche MIDI) ;
 * - getSnapshot() : l'etat d'un coup (hw/snapshot.ts) ;
 * - subscribe((k, value01) => ...) : le potard k doit aller a value01 (hw/motor.ts : toute cause sauf le potard lui-meme,
 *   30 Hz au plus par potard, la derniere valeur toujours, la garde d'echo de 150 ms, rien tant qu'il est touche) ;
 * - pot(k, value01) : le pont rapporte que la main a tourne le potard k (le site le prend comme rytm:knob:k, source hw) ;
 * - touch(k, on) : le potard k touche ou lache (CC 30 a 37 du boitier).
 */

import { dialRange, knobDial, knobDialOf } from '../actions';
import { targetOf, type MidiTarget } from '../midi/targets';
import { faceKnobs, type KnobCause } from '../rytm/faceKnobs';
import { faceTouch } from '../state/ctl';
import { motorFeed, type MotorFeed, type MotorKnobState, type MotorListener } from './motor';
import { getSnapshot as snapshotOf, type HwSnapshot } from './snapshot';
import { HW_PORT, isHwPort } from './port';

export { HW_PORT, isHwPort };
export type { HwSnapshot };

const KNOBS = 8;
/** Un potard tourne il y a moins de POT_MS par le boitier : c'est lui qui a change la valeur (la regle de rytm/faceKnobs.ts). */
const POT_MS = 120;

/** La cible d'un id du registre MIDI ; undefined : inconnue, ou sa machine pas encore chargee. */
export const resolve: (id: string) => MidiTarget | undefined = targetOf;

const causes: KnobCause[] = new Array<KnobCause>(KNOBS).fill('value');
const touched: boolean[] = new Array<boolean>(KNOBS).fill(false);
let feed: MotorFeed | null = null;

const okKnob = (k: number): boolean => Number.isInteger(k) && k >= 0 && k < KNOBS;

/** Le retour branche sur les potards de la face, une fois. */
function start(): MotorFeed {
  if (feed) return feed;
  const f = motorFeed({ now: () => performance.now(), setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: (id) => window.clearTimeout(id as number) });
  feed = f;
  faceKnobs.subscribe((c) => {
    const views = faceKnobs.get();
    const now = performance.now();
    for (const k of c.moved) {
      const v = views[k];
      if (!v) continue;
      causes[k] = c.cause;
      // Une case vide ou un dessin : le moteur reste ou il est (la regle des capuchons 3D)
      if (v.state === 'empty' || v.state === 'picture') continue;
      f.change(k, v.pos, faceTouch.lastSrc(k) === 'hw' && faceTouch.recent(k, POT_MS, now));
    }
  });
  return f;
}

/** L'etat du MM-RYTM d'un coup (page, voix, pattern, tempo, potards, TRK, scenes, crossfader, RUN, LEDs). */
export const getSnapshot = (): HwSnapshot => snapshotOf(causes);

/** Les moteurs : fn(k, value01) quand le potard k doit aller a value01 ; rend la fonction qui desabonne. */
export function subscribe(fn: MotorListener): () => void {
  return start().subscribe(fn);
}

/** La main a tourne le potard k du boitier a value01 : la garde d'echo s'ouvre, le site le prend comme rytm:knob:k. */
export function pot(k: number, value01: number): void {
  if (!okKnob(k) || !Number.isFinite(value01)) return;
  const v = Math.max(0, Math.min(1, value01));
  start().pot(k, v);
  const [lo, hi] = dialRange(knobDialOf(k));
  knobDial(k, lo + v * (hi - lo), 'hw');
}

/** Le potard k du boitier touche (true) ou lache (false) : tenu, le site ne le pousse pas ; lache, sa valeur part une fois. */
export function touch(k: number, on: boolean): void {
  if (!okKnob(k) || touched[k] === on) return;
  const f = start();
  touched[k] = on;
  // Le capuchon 3D ne part pas non plus sous la main (scene/renderer.ts lit faceTouch.held)
  if (on) faceTouch.down(k, 'hw');
  else faceTouch.up(k);
  f.touch(k, on);
}

/** Le debug et les tests : l'etat du retour d'un potard (null : pas encore branche). */
export const motorState = (k: number): MotorKnobState | null => (feed && okKnob(k) ? feed.state(k) : null);

/** window.__v4.hw (FLAGS.debug) */
export const hw = { resolve, getSnapshot, subscribe, pot, touch, motorState, HW_PORT, isHwPort };
