/**
 * L'applicateur des scenes (2026-10-27, la phase 2) : ce que le crossfader fait jouer au bus et aux tranches du MM-RYTM
 * part au plus une fois par pas (morphGapOf : une rampe de GLIDE_S puis deux quanta de rendu), mesure en temps du
 * contexte, toujours avec la vue du moment (une application en attente lit la derniere, une minuterie de queue pour le
 * reste). Chaque rampe part apres la fin de la precedente : p.value vaut sa cible, la courbe est continue, lineaire par
 * morceaux, ni escalier ni clic ; environ 40 mises a jour par seconde quel que soit le debit (un pointeur a 60 Hz, le
 * MIDI a 1 kHz coutent pareil), 25 ms au plus avant de partir, 45 ms pour arriver. Pur : drums.ts lui donne l'horloge du
 * contexte et des minuteries, le rendu hors ligne des suspensions, les tests une fausse horloge.
 */

import { GLIDE_S } from './glide';

/** Le pas de l'applicateur (s) : 25.3 ms a 48 kHz. */
export const morphGapOf = (sampleRate: number): number => GLIDE_S + (2 * 128) / sampleRate;

/** Un changement de pattern a la mesure part 4 ms avant elle : le bus arrive sur le temps fort. */
export const SWITCH_LEAD_S = 0.004;

export interface ApplierClock {
  /** l'heure du contexte (s) */
  now(): number;
  /** fn dans ms (une minuterie en direct, une suspension hors ligne) ; rend de quoi l'annuler */
  later(fn: () => void, ms: number): () => void;
  /** l'heure ne passe pas (un contexte suspendu) : chaque demande s'applique tout de suite, rien ne glisse de toute facon */
  frozen?(): boolean;
}

export interface Applier {
  /** la vue du moment a poser ; at : pas avant cette heure (la mesure d'un changement de pattern) */
  request(at?: number): void;
  /** une application attend son heure */
  pending(): boolean;
  /** plus rien en attente (le graphe s'en va) */
  cancel(): void;
  readonly stats: { requests: number; applies: number; rearms: number };
}

export function makeApplier(clock: ApplierClock, gapS: number, apply: () => void): Applier {
  let last = -Infinity;
  let notBefore = -Infinity;
  let due = 0;
  let stop: (() => void) | null = null;
  const stats = { requests: 0, applies: 0, rearms: 0 };
  const dueAt = (): number => Math.max(last + gapS, notBefore);
  const fire = (now: number): void => {
    last = now;
    notBefore = -Infinity;
    stats.applies += 1;
    apply();
  };
  const arm = (t: number, now: number): void => {
    due = t;
    stop = clock.later(run, Math.max(0, (t - now) * 1000));
  };
  function run(): void {
    stop = null;
    const now = clock.now();
    const t = dueAt();
    // L'heure du contexte avance par blocs : une minuterie partie un peu tot attend le reste
    if (now < t && !clock.frozen?.()) {
      stats.rearms += 1;
      arm(t, now);
      return;
    }
    fire(now);
  }
  return {
    request(at?: number): void {
      stats.requests += 1;
      if (at !== undefined && Number.isFinite(at)) notBefore = Math.max(notBefore, at - SWITCH_LEAD_S);
      const now = clock.now();
      const t = dueAt();
      if (stop) {
        // Deja en attente : elle lira la vue du moment ; une mesure plus loin la repousse
        if (t > due) {
          stop();
          arm(t, now);
        }
        return;
      }
      if (now >= t || (clock.frozen?.() && notBefore <= now)) {
        fire(now);
        return;
      }
      arm(t, now);
    },
    pending: (): boolean => stop !== null,
    cancel(): void {
      stop?.();
      stop = null;
      notBefore = -Infinity;
    },
    stats,
  };
}
