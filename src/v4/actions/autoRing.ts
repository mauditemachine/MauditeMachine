/**
 * Le plugin (2026-11-12, Mika : "ce sont les petits carres autour des knobs qui doivent bouger au rythme de ce que nous
 * avons bouge avec l'enregistrement") : ce que l'automation de la piste active donne a chaque potard de la page affichee,
 * au pas sous la tete de lecture du moteur. Un pas verrouille : la course de son verrou (c0) ; s'il glisse vers le pas
 * suivant (audio/locks.ts sld, pose par LIVE REC), celle du pas suivant (c1) : l'anneau va de l'une a l'autre pendant le
 * pas, comme le son (dsp/Engine.cpp startSlide). Un pas sans verrou pour le potard : null, l'anneau montre la base.
 * Lu par scene/renderer.ts a chaque nouveau pas (jamais a chaque image).
 */

import { lockOf, slideBit, type LockId } from '../audio/locks';
import { pattern, velocity } from '../audio/pattern';
import { extHead, nextProgStep, trackStepAt } from '../plugin/head';
import { patterns } from '../state/patterns';
import { knobBlock } from './dials';
import { lockTrack } from './internal/locks';
import { menuKnobs, pageSlotOf } from './kit';
import { pageLockView } from './locks';

export interface AutoRing {
  c0: number;
  c1: number;
}

/** Remplit out (huit cases, des objets gardes) ; true si au moins un potard est automatise sur ce pas. */
export function autoRingPlan(out: (AutoRing | null)[], keep: AutoRing[]): boolean {
  for (let k = 0; k < 8; k += 1) out[k] = null;
  const h = extHead.get();
  const inst = lockTrack();
  // La face montre le pattern que le moteur joue (sinon ses verrous ne sont pas ceux qu'on entend) ; un menu tient les potards
  if (!h || !inst || menuKnobs() || (typeof h.pat === 'number' && h.pat >= 0 && h.pat !== patterns.get().cur)) return false;
  const p = pattern.get();
  const len = pattern.stepCount();
  const loop = pattern.loopPage();
  const tl = Math.round(p.trigs?.[inst]?.tlen ?? 0);
  // Le pas de la piste : le sien si elle a sa longueur (TLEN, Engine.cpp : rel modulo TLEN, hors page bouclee)
  const g = trackStepAt(h, len, loop, tl);
  const s = ((g % 16) + 16) % 16;
  const lock = lockOf(p.locks, inst, s);
  if (!lock) return false;
  const gn = nextProgStep(g, len, loop, tl);
  const sn = gn % 16;
  const ln = gn === g ? null : lockOf(p.locks, inst, sn);
  const nextPlays = !!ln && (velocity(pattern.stepsOfPage(Math.floor(gn / 16)), inst, sn) > 0 || ln.ltrg === 1);
  const sld = lock.sld ?? 0;
  let any = false;
  for (let k = 0; k < 8; k += 1) {
    const b = knobBlock(k);
    const slot = b === null ? null : pageSlotOf(b);
    if (b === null || !slot || !slot.lock || slot.lock === 'vel' || slot.graph) continue;
    if (typeof (lock as Record<string, unknown>)[slot.lock] !== 'number') continue;
    const v0 = pageLockView(b, s, lock);
    if (!v0) continue;
    const a = keep[k];
    a.c0 = Math.max(0, Math.min(1, v0.course));
    a.c1 = a.c0;
    if (ln && nextPlays && sld & slideBit(slot.lock as LockId) && typeof (ln as Record<string, unknown>)[slot.lock] === 'number') {
      const v1 = pageLockView(b, sn, ln);
      if (v1) a.c1 = Math.max(0, Math.min(1, v1.course));
    }
    out[k] = a;
    any = true;
  }
  return any;
}
