/**
 * Les actions du MM-RYTM : LIVE REC (V.5.3 : l'entree, les frappes a l'heure entendue, les potards enregistres, l'effacement). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/live.ts.
 */

import { clock, type StepEvent } from '../audio/clock';
import { resume } from '../audio/drums';
import { isLockTrig, withoutLock } from '../audio/locks';
import { INSTRUMENTS, VEL_MAX, pattern, velocity } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import { slotName } from '../state/patterns';
import { dtFace } from '../state/dtFace';
import { DT_FACE, type Inst } from '../theme';
import { two } from './shared';
import { noHolders, noUsed } from './internal/face';
import { heardNow, liveCur, liveEnter, liveErase, liveEraseAt, liveExit, liveRow, liveRunning, liveWrite, stepAt } from './internal/live';

/** LIVE REC allume (arme ou en lecture), et en lecture. */
export const liveOn = (): boolean => DT_FACE && dtFace.live();

/** MIDI rytm:liverec : entre en LIVE REC, ou en sort (tout l'enregistrement s'eteint). */
export function liveKey(): void {
  if (!DT_FACE) return;
  resume();
  if (dtFace.live()) {
    liveExit(false);
    lcdMessage.show('LIVE REC OFF', 1000);
  } else liveEnter();
}

/**
 * Le pas ou va une frappe entendue a t : le plus proche, dans le pattern qu'on entend. Arrondie au pas 1 de la mesure
 * suivante quand celle-ci est un autre pattern (une chaine, un pattern qui attend), elle reste sur le dernier pas entendu
 * du pattern qu'on entend (le pas 16 d'ordinaire, la revue de D3b R9) : jamais une frappe dans un pattern pas encore
 * entendu.
 */
function liveTarget(t: number): StepEvent | null {
  const e = clock.nearestAt(t);
  const h = clock.entryAt(t);
  return e && h && e.slot !== h.slot ? h : e;
}

/**
 * Une frappe en LIVE REC et en lecture (un pas 1 a 8, un pad, le MIDI) : un trig de la voix au pas le plus proche de l'heure
 * entendue (quantifie, sans uTIME), dans le pattern qu'on entend. at : l'heure entendue (les tests), maintenant sinon.
 * 'play' : ecrite, sa voix sonne tout de suite ; un pas qui la joue deja a ce passage (programme ou deja parti) la joue
 * seul, 'quiet' : la frappe ne sonne pas en plus (la revue de D3b R10 : pas de flam) ; arrondie vers un pas a venir qui ne
 * la joue pas, ce pas ne la rejoue pas a ce passage (la frappe l'a jouee). null : rien d'ecrit.
 */
export function liveHit(inst: Inst, vel = VEL_MAX, at?: number): 'play' | 'quiet' | null {
  if (!liveRunning()) return null;
  const t = at ?? heardNow();
  if (t === null) return null;
  const e = liveTarget(t);
  if (!e) return null;
  // Le pas joue deja la voix a ce passage (le journal : programme, ou parti)
  const plays = (e.mask & (1 << INSTRUMENTS.indexOf(inst))) !== 0;
  if (e.when > t && !plays) clock.skipHit(inst, e.abs);
  const r = liveRow(e.slot);
  const was = velocity(r.steps, inst, e.step);
  if (was !== vel) {
    if (liveCur(e.slot)) pattern.set(inst, e.step, vel);
    else {
      const locks = isLockTrig(r.locks, inst, e.step) ? withoutLock(r.locks, inst, [e.step], 'ltrg') : r.locks;
      liveWrite(e.slot, stepAt(r.steps, inst, e.step, vel), locks);
    }
  }
  // Rien n'a change au motif : le pas deja programme repasse quand meme (il ne rejoue pas la frappe)
  else if (e.when > t && !plays) clock.refresh();
  lcdMessage.show(`LIVE REC ${inst} STEP ${two(e.step + 1)}${liveCur(e.slot) ? '' : ` ${slotName(e.slot)}`}`, 700);
  return plays ? 'quiet' : 'play';
}

/** NO tenue + un pad (V.5.3, LIVE REC en lecture) : la voix s'efface au fil de la tete de lecture tant qu'on tient ; true si pris. */
export function liveEraseDown(inst: Inst): boolean {
  if (!liveRunning() || noHolders.size === 0) return false;
  for (const s of noHolders) noUsed.add(s);
  liveErase.add(inst);
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  if (e) liveEraseAt(inst, e);
  lcdMessage.show(`LIVE ERASE ${inst}`, 1200);
  return true;
}
export function liveEraseUp(inst: Inst): void {
  liveErase.delete(inst);
}
/** Plus rien ne s'efface (la fenetre perd le clavier, la revue de D3b R8 R15 : une touche lachee ailleurs ne revient jamais). */
export function liveEraseAll(): void {
  liveErase.clear();
}
