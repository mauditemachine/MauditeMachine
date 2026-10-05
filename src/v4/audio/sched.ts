/**
 * L'avance des ordonnanceurs (2026-10-05, Mika : "je lance le site et des
 * que je fais un petit truc le son se coupe ; faut arranger ca une bonne
 * fois pour toutes, optimise le tout"). Le MM-RYTM (audio/clock.ts),
 * l'arpegiateur du MM-ARP (voyager/arp.ts) et la sequence du MM-SMPL
 * (smpl/seq.ts) programment leurs notes sur l'horloge AUDIO, reveilles par
 * un minuteur du fil principal. Avant, ils voyaient 100 ms devant eux : une
 * tache de plus de 75 a 100 ms (ouvrir un capot, une premiere visite, une
 * section du site, le ramasse-miettes) suffisait a faire partir des notes
 * en retard, au-dela de 125 ms a en perdre. Maintenant :
 * - l'horizon : 300 ms devant (450 ms au telephone, plus lent) ;
 * - une modification (un pas, un mute, un potard, le tempo, le swing, un
 *   accord) re-programme tout de suite ce qui n'a pas encore sonne : rien
 *   n'attend la fin de l'horizon, on entend le changement au prochain pas ;
 * - reserve(s) : avant un gros travail connu du fil principal (la scene
 *   qui se reconstruit, une texture lourde), les ordonnanceurs programment
 *   d'un coup les s secondes a venir. Le travail peut alors geler l'image,
 *   pas le son.
 * Les voix qui partent dans les GUARD_S a venir ne sont jamais annulees :
 * elles sont peut-etre deja dans le tampon du son.
 */

import { context } from './drums';

/** Reveil des ordonnanceurs, en ms. */
export const TICK_MS = 25;
/** Ce qu'une re-programmation ne touche plus (s). */
export const GUARD_S = 0.03;
/** Un pas rate de plus de 50 ms est saute (et compte), pas rattrape en rafale. */
export const DROP_AFTER_S = 0.05;

const COARSE = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
/** L'horizon de programmation (s) : 300 ms, 450 ms au telephone. */
export const LOOKAHEAD_S = COARSE ? 0.45 : 0.3;

export interface Scheduler {
  /** programme jusqu'a l'horizon (rien s'il ne joue pas) */
  tick(): void;
  /** annule ce qui n'a pas encore sonne (au-dela de GUARD_S) et le re-programme */
  reschedule(): void;
  /** l'ordre des re-programmations groupees : le MM-RYTM (0) d'abord, les autres suivent sa grille */
  order?: number;
}

const all = new Set<Scheduler>();
/** La reserve en cours : l'heure du contexte jusqu'ou programmer (0 : aucune). */
let reserveUntil = 0;

/** Jusqu'ou programmer a `now` (temps du contexte). */
export function horizon(now: number): number {
  return Math.max(now + LOOKAHEAD_S, reserveUntil);
}

export function registerScheduler(s: Scheduler): () => void {
  all.add(s);
  return () => {
    all.delete(s);
  };
}

/**
 * Avant un gros travail du fil principal : les s secondes a venir sont
 * programmees tout de suite (au plus 4 s). Sans contexte audio : rien.
 */
export function reserve(seconds: number): void {
  const c = context();
  if (!c || c.state !== 'running') return;
  reserveUntil = Math.max(reserveUntil, c.currentTime + Math.min(4, Math.max(0, seconds)));
  for (const s of all) s.tick();
}

/** Re-programmations demandees, groupees (un potard tourne : au plus une par image). */
const asked = new Set<Scheduler>();
let askTimer = 0;

export function askReschedule(s: Scheduler): void {
  asked.add(s);
  if (askTimer || typeof window === 'undefined') return;
  askTimer = window.setTimeout(() => {
    askTimer = 0;
    const list = [...asked].sort((a, b) => (a.order ?? 1) - (b.order ?? 1));
    asked.clear();
    for (const x of list) x.reschedule();
  }, 12);
}

/** Toutes (un changement de tempo ou de swing : chacun suit la grille du MM-RYTM). */
export function askRescheduleAll(): void {
  for (const s of all) askReschedule(s);
}
