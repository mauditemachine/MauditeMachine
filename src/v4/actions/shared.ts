/**
 * Les actions du MM-RYTM : les aides partagees (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0), deplacees telles
 * quelles de actions.ts : gesture (exporte par le baril), two, eventAt, rand. Fige apres P0 : un ajout = un message a
 * l'integrateur.
 */

import { ensure, resume } from '../audio/drums';
import { prepareSynth } from '../audio/synth';
import { BASS, VOYAGER } from '../state/focus';
import { bassLoad } from '../state/bassload';

export const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Premier geste : cree le contexte audio ; ensuite, le relance s'il dort. Le moteur du MM-VOYAGER se charge avec. */
export function gesture(): void {
  ensure();
  resume();
  if (VOYAGER) prepareSynth();
  // Le son du MM-BASS se prepare des le premier geste (2026-10-21, audit) : son premier RUN (MACHINES, Roto) ne
  // l'attend plus ; avec la basse cachee, rien ne se charge
  if (BASS) void bassLoad.load()?.then((m) => m.bassEngine.ensure());
}
export function eventAt(): number {
  const now = performance.now();
  const t = typeof window !== 'undefined' ? (window as { event?: Event }).event?.timeStamp : undefined;
  return typeof t === 'number' && t > 0 && t <= now && now - t < 5000 ? t : now;
}
export const rand = (lo: number, hi: number): number => Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;
