/**
 * Les seize pas quand TRK est tenu ou garde (2026-10-27, la phase 2, Mika : "TRK tenu, les pas 1 a 8 s'allument, la voix
 * choisie a pleine intensite") : pur, lu par scene/sequencer3d.ts aujourd'hui et par les LED RGB des pas du boitier
 * demain (hw/snapshot.ts). Une seule couleur depuis V.4.2 (2026-10-27, Mika : "des boutons d'une meme couleur et pas arc
 * en ciel") : RYTM_FACEPLATE.steps.trkColor, l'orange de la machine. Les pas 9 a 16 sont reserves : eteints.
 *
 * V.5.0 (2026-10-29, la face facon Digitakt, au desktop) : la vue TRK en rouge (la voix choisie pleine, les autres 0.22,
 * une voix coupee 0.07), sa barre : verte sur une voix qui joue quand des voix sont coupees ou en solo (le vert du mode
 * MUTE de la Digitakt : la voix joue), blanche sur une voix en solo ; et la vue du mode MUTE (FUNC + TRK, muteLeds) :
 * global, vert = joue, eteint = coupee ; du pattern, magenta = joue ; une voix en solo en blanc. Le telephone garde
 * l'orange et sa barre rouge (MUTE) ou bleue (SOLO). Les couleurs viennent de l'appelant (theme.ts DT_HEX ; le boitier :
 * hw/snapshot.ts) ; ce module ne lit que rytm/faceplate.ts.
 */

import { RYTM_FACEPLATE } from './faceplate';
import type { Inst, KeyLitTone } from '../theme';

export interface TrkLed {
  /** la couleur sRGB d'affichage du pas (rytm/faceplate.ts steps.trkColor, la meme pour les huit) ; '' : eteint */
  readonly color: string;
  /** l'intensite (0 eteint, 1 pleine) : la voix choisie, les autres, une voix coupee (theme.ts TRK_LIT) */
  readonly level: number;
  /**
   * la barre du pas : MUTE (au telephone la voix coupee, en rouge ; au desktop depuis V.5.0 la voix qui joue, en vert),
   * SOLO (en solo) ; null aucune
   */
  readonly bar: 'mute' | 'solo' | null;
  /** la voix du pas (null : 9 a 16) */
  readonly inst: Inst | null;
  /** V.5.0 : la teinte du pas a l'ecran (theme.ts KEY_LIT) ; absente : celle des pas (STEP_TONE) */
  readonly tone?: KeyLitTone;
}

/** Les niveaux (theme.ts TRK_LIT ou TRK_LIT_LIGHT). */
export interface TrkLevels {
  readonly cur: number;
  readonly other: number;
  readonly muted: number;
}

/** La face facon Digitakt (V.5.0) : ses couleurs (sRGB, theme.ts DT_HEX) ; absente : la vue d'avant (le telephone). */
export interface DtLedColors {
  readonly red: string;
  readonly green: string;
  readonly magenta: string;
  readonly white: string;
}

/**
 * Les seize pas en vue TRK : cur la voix choisie, muted et solo les voix coupees et en solo ; dt (V.5.0, le desktop) : le
 * rouge de la Digitakt et la barre verte des voix qui jouent ; pmuted : les voix coupees par le pattern (V.5.0).
 */
export function trkLeds(cur: Inst | null, muted: readonly Inst[], solo: readonly Inst[], lv: TrkLevels, dt?: DtLedColors, pmuted: readonly Inst[] = []): TrkLed[] {
  const voices = RYTM_FACEPLATE.steps.voices as readonly Inst[];
  const out: TrkLed[] = [];
  const anyCut = muted.length > 0 || pmuted.length > 0 || solo.length > 0;
  for (let i = 0; i < 16; i += 1) {
    const inst = i < voices.length ? voices[i] : null;
    if (!inst) {
      out.push({ color: '', level: 0, bar: null, inst: null });
      continue;
    }
    const m = muted.includes(inst) || pmuted.includes(inst);
    const level = inst === cur ? lv.cur : m ? lv.muted : lv.other;
    if (dt) {
      // La voix joue : pas coupee, et dans le solo s'il y en a un
      const plays = solo.length > 0 ? solo.includes(inst) : !m;
      const bar = solo.includes(inst) ? 'solo' : anyCut && plays ? 'mute' : null;
      out.push({ color: dt.red, level, bar, inst, tone: 'dred' });
      continue;
    }
    out.push({ color: RYTM_FACEPLATE.steps.trkColor, level, bar: m ? 'mute' : solo.includes(inst) ? 'solo' : null, inst });
  }
  return out;
}

/**
 * Le mode MUTE de la Digitakt (V.5.0, FUNC + TRK) sur les pas 1 a 8 : global, une voix qui joue en vert, coupee eteinte
 * (muted, les mutes de la machine) ; pattern, en magenta (pmuted, ceux du pattern) ; une voix en solo en blanc, pleine.
 * Les pas 9 a 16 : eteints.
 */
export function muteLeds(kind: 'global' | 'pattern', muted: readonly Inst[], pmuted: readonly Inst[], solo: readonly Inst[], dt: DtLedColors): TrkLed[] {
  const voices = RYTM_FACEPLATE.steps.voices as readonly Inst[];
  const out: TrkLed[] = [];
  for (let i = 0; i < 16; i += 1) {
    const inst = i < voices.length ? voices[i] : null;
    if (!inst) {
      out.push({ color: '', level: 0, bar: null, inst: null });
      continue;
    }
    if (solo.includes(inst)) {
      out.push({ color: dt.white, level: 1, bar: null, inst, tone: 'dwhite' });
      continue;
    }
    const cut = kind === 'global' ? muted.includes(inst) : pmuted.includes(inst);
    const tone: KeyLitTone = kind === 'global' ? 'dgreen' : 'dmagenta';
    out.push({ color: cut ? '' : kind === 'global' ? dt.green : dt.magenta, level: cut ? 0 : 1, bar: null, inst, tone });
  }
  return out;
}
