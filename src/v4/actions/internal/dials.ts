/**
 * Les actions du MM-RYTM, dials : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { resume } from '../../audio/drums';
import { type VoiceParam } from '../../audio/voicefx';
import { KIT_LABEL, isFamily, kit, type KitFamily, type KitId, type KitKnob } from '../../audio/kit';
import { pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { editor } from '../../state/editor';
import { rytmPage } from '../../state/rytmPage';
import { rytmLock } from '../../state/rytmLock';
import { SCREEN_TITLE, type SlotTarget } from '../../rytm/pages';
import { encText, encUnit, kitUnit, v127Text } from '../../rytm/values';
import { PAGE_KNOB_LETTERS, VOICE_PARAM, encLabel, isBipolar, isVoiceEnc, potCourse, type EncId, type Inst } from '../../theme';
import { st } from '../state';
import { ctlAllApply, ctlAllOn, ctlAllStart } from '../ctlall';
import { sceneHint } from './scenes';
import { sampleDial, tapVelDial, voiceMixDial, voiceSoundDial } from './kit';
import { lockWrite } from './locks';
import { liveKnobTurn, liveRunning } from './live';
import { sceneTake } from '../scenes';
import { anyDial, pageKnobLive } from '../anyDial';
import { curScreen, type DialId, pageSlotOf } from '../kit';
import { lockMode, rytmLockEnter } from '../locks';
import { liveOn } from '../live';

/**
 * Valeur affichee sur la ligne du bas de l'ecran, de 0 a 127 depuis le
 * 2026-10-08 (Mika : "les valeurs de knobs sont a l'ecran ... de 0 a 127",
 * le nombre du MIDI) et son unite : BD DECAY 64  640 MS, TONE +12  +1.3 ST,
 * SWING 30  58%, MASTER 102  -2.0 DB.
 */
export function readout(id: ContEnc, v: number, inst: Inst | null): string {
  const who = inst ? `${inst} ` : '';
  return `${who}${encLabel(id)} ${encText(id, v, potCourse(id, v), isBipolar(id))}  ${encUnit(id, v)}`;
}

/** Les potards de la machine qui ne reglent que la couche SYNTH (R3), et leur famille : un message quand elle est a 0. */
const SYNTH_ONLY: Partial<Record<KitKnob, KitFamily>> = { tune: 'bd', decay: 'bd', sweep: 'bd', sdtune: 'sd', sddecay: 'sd', sdtone: 'sd' };

/** Le meme pour un TWEAK du kit : KICK TUNE 64  52 HZ ; un choix de son ou GATE, son nom. */
export function kitReadout(id: KitId): string {
  if (isFamily(id) || id === 'gate') return kit.readout(id);
  const sd = id === 'snappy' || id === 'sdtune' || id === 'sddecay' || id === 'sdtone';
  const label = `${sd ? 'SNARE' : 'KICK'} ${KIT_LABEL[id]}`;
  // La couche SYNTH a 0 (R3, le kit de depart joue les samples de Mika) : ce potard ne s'entend pas encore, l'ecran le dit
  const f = SYNTH_ONLY[id];
  const off = f && kit.layerOf(f).syn <= 0 ? '  SYNTH OFF: LEVEL H' : '';
  return `${label} ${v127Text(kit.value(id))}  ${kitUnit(id)}${off}`;
}

/** Le parametre de voix que regle un potard de la rangee VOICE (VOLUME -> level, DIST -> dist) ; null hors de cette rangee. */
export const voiceParam = (id: EncId): VoiceParam | null => (isVoiceEnc(id) && id !== 'vsound' ? VOICE_PARAM[id] : null);
/** Un potard de la machine a valeur continue (ni TEMPO ni le choix de son). */
export type ContEnc = Exclude<EncId, 'tempo' | 'vsound'>;

/**
 * La vue PAGE de l'ecran du MM-RYTM (2026-10-08, la refonte facon
 * Digitakt, Mika : "8 encodeurs assignables a condition de presser les
 * bonnes touches ; l'ecran divise en 8 blocs") : un reglage touche cerne
 * son bloc quand il est sur la page affichee (state/rytmPage.ts).
 */
export function touchPage(t: SlotTarget, inst: Inst | null): void {
  rytmPage.touch(t, inst);
}
export const presetAbs: { u: (number | undefined)[]; acc: number[] } = { u: [], acc: [] };

/**
 * Un potard de page tourne : il regle ce que son bloc montre ; un bloc vide
 * (ou un dessin) le dit a l'ecran (jamais un geste qui ne fait rien en
 * silence). L'echo (le contour du bloc) une seule fois : le reglage touche
 * l'a deja pose s'il est sur l'ecran (touchPage), sinon il est pose ici.
 */
export function pageDial(k: number, v: number): void {
  resume();
  // LIVE REC (V.5.3, la revue de D3b R2 R11) : le potard d'avant cesse d'ecrire ; celui-ci reprend la main s'il s'enregistre
  // (liveKnobTurn)
  st.liveKnob = null;
  const slot = pageSlotOf(k);
  const screen = curScreen();
  const letter = PAGE_KNOB_LETTERS[k] ?? '?';
  const t = slot && slot.label && !slot.graph ? slot.target : null;
  if (!slot || t === null) {
    lcdMessage.show(slot?.graph ? `${slot.label} IS A PICTURE: ${SCREEN_TITLE[screen]}` : `${letter}: EMPTY ON ${SCREEN_TITLE[screen]}`);
    return;
  }
  // Un pas tenu (deux doigts, ou la souris et un potard MIDI, 2026-10-08) : le LOCK passe sur lui des ce potard,
  // meme avant les 350 ms de la tenue
  // LIVE REC (V.5.3, la revue de D3b R14) : un pas tenu n'y compte pas (c'est un pad)
  const lk = rytmLock.get();
  const held = liveOn() ? [] : lk.held;
  if (editor.get() !== 'mm808' && held.length > 0 && !held.includes(lk.step) && pattern.get().instrument) rytmLockEnter(held[0], false);
  // Une scene armee (2026-10-27) : le bloc ecrit dans la scene, jamais dans la base (un pas tenu gagne : le P-LOCK)
  if (held.length === 0 && sceneTake(`p:${k}` as DialId, v)) return;
  // En P-LOCK (2026-10-08) : le bloc pose le verrou du pas (des pas tenus), jamais la valeur de la voix
  if (lockMode()) {
    lockWrite(k, slot, v);
    return;
  }
  const before = rytmPage.get().echo;
  // CONTROL ALL (V.5.2) : TRK tenue ou gardee, la valeur d'avant des huit voix est notee avant d'ecrire
  const all = ctlAllStart(t);
  if (t === 'step:vel') tapVelDial(v);
  else if (t === 'smpl:sample') sampleDial(v);
  else if (t === 'voice:sound') voiceSoundDial(v);
  else if (t === 'voice:mix') voiceMixDial(v);
  else anyDial(t, v);
  if (all) ctlAllApply(all);
  // LIVE REC en lecture (V.5.3) : le reglage s'enregistre en P-LOCK sur les pas que traverse la tete de lecture ; TRK tenue
  // (CONTROL ALL) gagne, rien ne s'ecrit
  else if (liveRunning() && !ctlAllOn()) liveKnobTurn(slot, v, screen);
  sceneHint(`p:${k}` as DialId);
  // Rien a regler (pas de voix choisie, une voix a un seul son) : le message suffit, pas de contour
  if (!pageKnobLive(k)) return;
  const e = rytmPage.get().echo;
  if (!e || e === before || e.k !== k || e.page !== curScreen()) rytmPage.echo(k, pattern.get().instrument);
}
