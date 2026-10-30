/**
 * Les actions du MM-RYTM, live : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { clock, type StepEvent } from '../../audio/clock';
import { context as audioCtx } from '../../audio/drums';
import { isLockTrig, lockOf, sameLocks, withLock, withoutLock, type LockId, type Locks } from '../../audio/locks';
import { INSTRUMENTS, VEL_MAX, pattern, velocity, type Steps } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { patterns } from '../../state/patterns';
import { undo } from '../../state/undo';
import { dtFace } from '../../state/dtFace';
import { rytmLock } from '../../state/rytmLock';
import { faceTouch, pressVel } from '../../state/ctl';
import { type PageSlot, type RytmScreenId } from '../../rytm/pages';
import { DT_FACE, type Inst } from '../../theme';
import { st } from '../state';
import { ctlAllOn } from '../ctlall';
import { slotDomain } from './locks';
import { noHolders } from './face';
import { curScreen, layerIdOf, soundFamily } from '../kit';
import { liveOn } from '../live';

export const liveRunning = (): boolean => liveOn() && clock.running;

/** La velocite d'une frappe : celle de la note MIDI, sinon HIGH (la souris, le clavier). */
export function liveVel(): number {
  const v = pressVel.v;
  return v === null ? VEL_MAX : Math.max(1, Math.min(VEL_MAX, Math.round(v * VEL_MAX)));
}

/**
 * L'heure entendue maintenant (temps du contexte) : ce qui sort des enceintes a ete programme plus tot de la latence. ts
 * (performance.now() d'un evenement, la revue de D3b R3) : l'heure entendue a ce moment-la.
 */
export function heardNow(ts = -1): number | null {
  const c = audioCtx();
  if (!c) return null;
  const age = ts >= 0 ? Math.max(0, Math.min(0.25, (performance.now() - ts) / 1000)) : 0;
  return c.currentTime - ((c.outputLatency || 0) + (c.baseLatency || 0)) - age;
}

let liveTimer = 0;
/** Le dernier pas entendu (sa position depuis PLAY) : livePoll ecrit a chaque nouveau. */
let liveAbs = -1;
/**
 * Le dernier potard tourne : son bloc, sa valeur, la voix, sa page, le potard de la face (-1 : un autre chemin) et l'heure ;
 * il ecrit sur les pas traverses tant qu'on le tourne (la revue de D3b R2 R11 : lui seul, sur sa page et sa voix).
 */
export interface LiveKnob {
  slot: PageSlot;
  v: number;
  inst: Inst;
  screen: RytmScreenId;
  face: number;
  at: number;
}
/** Tourne il y a moins de ce temps (ou tenu) : le potard ecrit encore sur le pas qui arrive. */
const LIVE_KNOB_MS = 220;
/** Les voix qu'on efface (NO tenue + leur pad). */
export const liveErase = new Set<Inst>();

/** Entrer en LIVE REC (● tenue + ▶, ● deux fois, MIDI rytm:liverec) : arme a l'arret, tout de suite en lecture. */
export function liveEnter(): void {
  if (!DT_FACE) return;
  st.recTapAt = -Infinity;
  if (dtFace.live()) return;
  rytmLock.leave();
  // Une prise entiere, de l'entree a la sortie : une seule etape d'UNDO par pattern touche (state/undo.ts, la revue de D3b R12)
  undo.boundary('mm808');
  undo.hold('mm808', true);
  dtFace.setRec(true);
  dtFace.setLive(true);
  liveAbs = -1;
  window.clearInterval(liveTimer);
  liveTimer = window.setInterval(livePoll, 15);
  lcdMessage.show(clock.running ? 'LIVE REC: PLAY STEPS 1-8, TURN A KNOB' : 'LIVE REC ARMED · PLAY: GO', 2000);
}

/** Sortir de LIVE REC ; rec : le grid rec reste allume (● en LIVE REC), sinon tout l'enregistrement s'eteint. */
export function liveExit(rec: boolean): void {
  if (!dtFace.live()) return;
  dtFace.setLive(false);
  dtFace.setRec(rec);
  window.clearInterval(liveTimer);
  liveTimer = 0;
  liveErase.clear();
  st.liveKnob = null;
  // Sortir n'arme jamais le double appui (la revue de D3b R5)
  st.recTapAt = -Infinity;
  undo.hold('mm808', false);
}

/* Ecrire dans le pattern qu'on entend (la revue de D3b R9) : le courant passe par le motif (audio/pattern.ts, la lecture le
 * re-programme) ; un autre (la fin de la mesure d'avant, la chaine a deja pose le suivant) par son emplacement (patterns),
 * l'UNDO de la prise le note d'abord (une etape par pattern touche). */

/** L'emplacement d'un pas entendu est-il le courant (ou sans patterns) ? */
export const liveCur = (slot: number): boolean => slot < 0 || slot === patterns.get().cur;
/** Les pas et les verrous du pattern d'un pas entendu. */
export function liveRow(slot: number): { steps: Steps; locks: Readonly<Locks> } {
  return liveCur(slot) ? pattern.get() : { steps: patterns.stepsOf(slot), locks: patterns.locksOf(slot) };
}
/** Un emplacement qui n'est pas le courant recoit ses pas et ses verrous (rien s'ils n'ont pas change). */
export function liveWrite(slot: number, steps: Steps, locks: Readonly<Locks>): void {
  const r = liveRow(slot);
  if (sameLocks(r.locks, locks) && INSTRUMENTS.every((k) => r.steps[k] === steps[k])) return;
  undo.slotEdit('mm808', slot);
  patterns.writeSlot(slot, steps, locks);
}
/** Le pas s de inst a la velocite v dans une rangee de pas. */
export const stepAt = (steps: Steps, inst: Inst, s: number, v: number): Steps => ({ ...steps, [inst]: steps[inst].slice(0, s) + String(v) + steps[inst].slice(s + 1) });

/** La voix frappee devient la voix choisie (la revue de D3b R4), sans dire KNOBS > (l'ecran dit LIVE REC). */
export function liveSelect(inst: Inst): void {
  if (pattern.get().instrument === inst) return;
  pattern.select(inst);
  if (lcdSamples.isOpen()) lcdSamples.touch();
}

/** Un bloc qui s'enregistre en P-LOCK (un verrou de nombre : ni le son, ni la machine, ni VEL, ni un reglage de machine entiere). */
function liveLockable(slot: PageSlot): boolean {
  if (!slot.lock || slot.lock === 'vel' || slot.lock === 'snd' || slot.lock === 'mach' || slot.scope === 'all') return false;
  if (slot.target === 'voice:sound' || slot.target === 'voice:mix' || slot.target === 'smpl:sample') return false;
  return !(slot.target && layerIdOf(slot.target) && !soundFamily());
}

/**
 * Le verrou du potard sur le pas s (le manuel [M1] 10.2.3 et 10.9.1 : en LIVE RECORDING, les reglages "are recorded as parameter
 * locks and add lock trigs where needed") : un pas sans trig de la voix recoit un lock trig.
 */
function liveLockAt(k: LiveKnob, e: StepEvent): void {
  const s = e.step;
  const id = k.slot.lock as LockId;
  const v = k.v;
  const val = id === 'pan' || id === 'fenv' ? (Math.abs(v) < 0.02 ? 0 : v) : id === 'tune' ? Math.round(v * 24) / 24 : v;
  const [lo, hi] = slotDomain(k.slot);
  const x = Math.max(lo, Math.min(hi, val));
  const p = liveRow(e.slot);
  const trig = velocity(p.steps, k.inst, s) === 0 && !isLockTrig(p.locks, k.inst, s);
  if (liveCur(e.slot)) {
    if (trig) pattern.setLock(k.inst, [s], 'ltrg', 1);
    pattern.setLock(k.inst, [s], id, x);
    return;
  }
  // Le pattern qu'on entend n'est plus le courant (la revue de D3b R9) : son emplacement
  const l = withLock(trig ? withLock(p.locks, k.inst, [s], 'ltrg', 1) : p.locks, k.inst, [s], id, x);
  liveWrite(e.slot, p.steps, l);
}

/**
 * Un potard d'une page de voix tourne en LIVE REC : il ecrit sur le pas entendu, puis sur ceux que la tete traverse tant
 * qu'on le tourne (livePoll). screen : la page de son bloc.
 */
export function liveKnobTurn(slot: PageSlot, v: number, screen: RytmScreenId): void {
  const inst = pattern.get().instrument;
  if (!inst || !liveLockable(slot)) return;
  st.liveKnob = { slot, v, inst, screen, face: st.liveFace, at: performance.now() };
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  if (e) liveLockAt(st.liveKnob, e);
}

/** Le potard d'avant ecrit-il encore (la revue de D3b R2 R11) : lui, tourne il y a moins de LIVE_KNOB_MS ou tenu, sur sa page et sa voix, hors CONTROL ALL. */
function liveKnobOn(k: LiveKnob): boolean {
  if (ctlAllOn() || pattern.get().instrument !== k.inst || curScreen() !== k.screen) return false;
  return performance.now() - k.at < LIVE_KNOB_MS || (k.face >= 0 && faceTouch.held(k.face));
}

/** Efface la voix au pas entendu e (son trig et ses verrous), dans le pattern qu'on entend. */
export function liveEraseAt(inst: Inst, e: StepEvent): void {
  const s = e.step;
  if (liveCur(e.slot)) {
    const p = pattern.get();
    if (velocity(p.steps, inst, s) > 0) pattern.clearStep(inst, s);
    if (lockOf(pattern.get().locks, inst, s)) pattern.clearLock(inst, [s]);
    return;
  }
  const r = liveRow(e.slot);
  const steps = velocity(r.steps, inst, s) > 0 ? stepAt(r.steps, inst, s, 0) : r.steps;
  const locks = lockOf(r.locks, inst, s) ? withoutLock(r.locks, inst, [s]) : r.locks;
  liveWrite(e.slot, steps, locks);
}

/** La tete de lecture (l'heure entendue) passe sur un autre pas : l'effacement et le potard qui tourne y ecrivent. */
function livePoll(): void {
  if (!liveRunning()) {
    liveAbs = -1;
    return;
  }
  const t = heardNow();
  const e = t === null ? null : clock.entryAt(t);
  if (!e || e.abs === liveAbs) return;
  liveAbs = e.abs;
  // L'effacement : seulement tant que NO est tenue (la revue de D3b R15)
  if (noHolders.size === 0) liveErase.clear();
  for (const inst of liveErase) liveEraseAt(inst, e);
  const k = st.liveKnob;
  if (k && liveKnobOn(k)) liveLockAt(k, e);
}
