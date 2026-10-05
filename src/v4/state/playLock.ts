/**
 * La vue verrouillee en lecture (2026-10-04, Mika : "quand le bouton play
 * est lance dans une machine, qu'il ne soit pas possible de la deplacer en
 * 3d a part de cliquer en dehors de la machine ; mais quand c'est play
 * c'est lock sur la vue la plus adaptee pour utiliser la machine").
 *
 * - Une machine joue : le MM-RYTM quand son horloge tourne, le MM-ARP quand
 *   son arpege joue, le MM-DECKS quand une platine tourne, le MM-SMPL quand
 *   une voix ou un nuage sonne.
 * - Elle demarre : la vue passe a elle, de face (le Stage, scene/renderer.ts).
 * - Tant qu'elle joue, un geste parti sur elle ne bouge plus la vue
 *   (glisser, molette, deux doigts : ui/Hotspots.tsx) ; ses commandes
 *   repondent comme toujours. Un geste parti du fond, hors de la machine,
 *   la tourne et la zoome comme avant.
 */

import { clock } from '../audio/clock';
import { arp } from '../voyager/arp';
import { djLoad } from './djload';
import { smplLoad } from './smplload';
import type { MachineId } from './focus';

/** Une platine du MM-DECKS tourne (rien tant que son code n'est pas arrive). */
function djPlaying(): boolean {
  const s = djLoad.get()?.djState.get();
  return s ? Object.values(s.deck).some((d) => d.playing) : false;
}

/** Le MM-SMPL : une voix ou un nuage sonne (rien tant que son code n'est pas arrive). */
function smplPlaying(): boolean {
  const live = smplLoad.get()?.smplEngine.live();
  return live ? live.voices.size + live.clouds.size > 0 : false;
}

export function machinePlaying(m: MachineId): boolean {
  if (m === 'mm808') return clock.running;
  if (m === 'voy') return arp.get().running;
  if (m === 'smpl') return smplPlaying();
  return djPlaying();
}

/**
 * Quelque chose joue, quelque part (2026-10-05) : le son ne dort pas quand
 * l'onglet se cache (une autre fenetre devant, une autre app), la page ne
 * se recharge pas sous la musique. La sequence du MM-SMPL compte meme entre
 * deux pas.
 */
export function anyPlaying(): boolean {
  return clock.running || arp.get().running || djPlaying() || smplPlaying() || !!smplLoad.get()?.smplSeq.get().running;
}

/**
 * Chaque machine qui se met a jouer (une transition, pas un etat) ; rend
 * de quoi se desabonner.
 */
export function onPlayStart(fn: (m: MachineId) => void): () => void {
  const was: Record<MachineId, boolean> = { mm808: clock.running, voy: arp.get().running, dj: djPlaying(), smpl: smplPlaying() };
  const check = (m: MachineId): void => {
    const now = machinePlaying(m);
    if (now && !was[m]) fn(m);
    was[m] = now;
  };
  const offs = [clock.subscribe(() => check('mm808')), arp.subscribe(() => check('voy'))];
  // Le MM-DECKS arrive apres : on s'abonne a ses platines des que son code est la
  let offDj: (() => void) | null = null;
  const hookDj = (): void => {
    const st = djLoad.get()?.djState;
    if (!st || offDj) return;
    offDj = st.subscribe(() => check('dj'));
  };
  hookDj();
  offs.push(djLoad.subscribe(hookDj));
  // Le MM-SMPL aussi : ses voix, des que son code est la
  let offSmpl: (() => void) | null = null;
  const hookSmpl = (): void => {
    const e = smplLoad.get()?.smplEngine;
    if (!e || offSmpl) return;
    offSmpl = e.subscribeLive(() => check('smpl'));
  };
  hookSmpl();
  offs.push(smplLoad.subscribe(hookSmpl));
  return () => {
    for (const off of offs) off();
    offDj?.();
    offSmpl?.();
  };
}
