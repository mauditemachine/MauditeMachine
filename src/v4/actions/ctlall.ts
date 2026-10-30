/**
 * Les actions du MM-RYTM : CONTROL ALL (TRK tenu + un potard : toutes les voix). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/ctlall.ts.
 */

import { lfoOf, voiceFx, type VoiceParam } from '../audio/voicefx';
import { TRIG_DEF, isTrigParam, type TrigParam } from '../audio/trig';
import { type LfoParam } from '../audio/lfo';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import { lcdMessage } from '../state/lcdMessage';
import { patterns } from '../state/patterns';
import { undo } from '../state/undo';
import { dtFace } from '../state/dtFace';
import { ctlAllState, trk } from '../state/trk';
import { type SlotTarget } from '../rytm/pages';
import { DT_FACE, type EncId, type Inst } from '../theme';
import { st } from './state';
import { voiceParam } from './internal/dials';
import { seqDialOf } from './mixer';

/* ---------------- CONTROL ALL (V.5.2, 2026-10-30, docs/v4/digitakt-d3a-spec.md section 2) ---------------- */

/**
 * Ce que CONTROL ALL regle : un reglage de voix (VOL, PITCH, FINE, FLTR, AMP, les FX de la voix), un reglage de trig par
 * defaut ou un LFO. Les reglages de la machine de synthese et le choix du son different d'une famille a l'autre (le kick
 * n'a pas les reglages de la caisse claire) : ils restent sur la voix choisie.
 */
type CtlAllKey = { kind: 'fx'; p: VoiceParam } | { kind: 'trig'; p: TrigParam } | { kind: 'lfo'; p: LfoParam };

export function ctlAllKeyOf(t: SlotTarget): CtlAllKey | null {
  const sd = seqDialOf(t);
  if (sd) return isTrigParam(sd) ? { kind: 'trig', p: sd } : { kind: 'lfo', p: sd };
  const p = t.includes(':') ? null : voiceParam(t as EncId);
  return p ? { kind: 'fx', p } : null;
}

function ctlAllGet(k: CtlAllKey, inst: Inst): number {
  if (k.kind === 'fx') return voiceFx.of(inst)[k.p];
  if (k.kind === 'trig') return pattern.get().trigs[inst]?.[k.p] ?? TRIG_DEF[k.p];
  return lfoOf(voiceFx.of(inst), k.p);
}

function ctlAllSet(k: CtlAllKey, inst: Inst, v: number): void {
  if (k.kind === 'fx') voiceFx.set(inst, k.p, v);
  else if (k.kind === 'trig') pattern.setTrig(inst, k.p, v);
  else voiceFx.setLfo(inst, k.p, v);
}

/** Les reglages touches pendant cette tenue de TRK et la valeur d'avant de chaque voix (NO les rend). */
export const ctlAllBefore = new Map<string, { key: CtlAllKey; was: Record<Inst, number> }>();

/** TRK tenue ou gardee (la revue de D3a, R4 : gardee, elle le reste apres un CONTROL ALL). */
export function ctlAllOn(): boolean {
  if (!DT_FACE) return false;
  const m = trk.get().mode;
  return m === 'held' || m === 'latched';
}

/** Avant l'ecriture : le reglage et la valeur d'avant des huit voix ; null si CONTROL ALL ne s'applique pas. */
export function ctlAllStart(t: SlotTarget): CtlAllKey | null {
  if (!ctlAllOn() || !pattern.get().instrument) return null;
  const key = ctlAllKeyOf(t);
  if (!key) return null;
  // Un CONTROL ALL entier, une seule etape d'UNDO : la rafale d'avant se ferme, celle-ci reste ouverte jusqu'a sa fin
  if (ctlAllBefore.size === 0) {
    // Pendant une prise de LIVE REC (V.5.3), elle reste la seule etape : pas de coupure
    if (!dtFace.live()) undo.boundary('mm808');
    undo.hold('mm808', true);
    st.ctlAllSlot = patterns.get().cur;
  }
  const id = `${key.kind}:${key.p}`;
  if (!ctlAllBefore.has(id)) ctlAllBefore.set(id, { key, was: Object.fromEntries(INSTRUMENTS.map((i) => [i, ctlAllGet(key, i)])) as Record<Inst, number> });
  ctlAllState.set(true);
  return key;
}

/**
 * Apres l'ecriture : les huit voix prennent la valeur de la voix choisie (le manuel [M1] 6.2.2 ne dit pas si c'est la meme
 * valeur ou le meme ecart : le cahier tranche, la meme valeur). TRK tenue : elle a servi (son lacher ne la garde pas) ;
 * gardee : elle le reste jusqu'a une tape sur TRK, le choix d'une voix ou Echap, NO peut annuler tant qu'elle est allumee
 * (la revue de D3a, R4 ; plus de fermeture apres le lacher du potard, R5 et R6).
 */
export function ctlAllApply(key: CtlAllKey): void {
  const inst = pattern.get().instrument;
  if (!inst) return;
  const v = ctlAllGet(key, inst);
  for (const o of INSTRUMENTS) if (o !== inst && ctlAllGet(key, o) !== v) ctlAllSet(key, o, v);
  if (trk.get().mode === 'held') trk.use(performance.now());
}

/** CONTROL ALL est fait (TRK eteinte, une voix choisie, un autre pattern) : les changements restent, son etape d'UNDO se ferme. */
export function ctlAllEnd(): void {
  ctlAllState.set(false);
  if (ctlAllBefore.size === 0) return;
  ctlAllBefore.clear();
  st.ctlAllSlot = -1;
  undo.hold('mm808', false);
}

/**
 * NO (ou Echap, le NO du desktop) tant que TRK est allumee : chaque voix retrouve sa valeur d'avant, puis TRK gardee
 * s'eteint ; true s'il y avait un CONTROL ALL a annuler.
 */
export function ctlAllUndo(): boolean {
  if (ctlAllBefore.size === 0 || !trk.engaged()) return false;
  for (const { key, was } of ctlAllBefore.values()) for (const i of INSTRUMENTS) if (ctlAllGet(key, i) !== was[i]) ctlAllSet(key, i, was[i]);
  ctlAllBefore.clear();
  st.ctlAllSlot = -1;
  // La rafale revient a son depart : elle ne laisse aucune etape
  undo.hold('mm808', false);
  ctlAllState.set(false);
  if (trk.get().mode !== 'held') trk.cancel();
  lcdMessage.show('CONTROL ALL UNDONE', 1400);
  return true;
}
