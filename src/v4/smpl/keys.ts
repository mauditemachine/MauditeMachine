/**
 * Le clavier du MM-SMPL (2026-10-04) : les touches physiques (e.code : au
 * meme endroit en QWERTY et en AZERTY), seulement quand on utilise le
 * MM-SMPL, jamais pendant qu'on ecrit dans un champ. Les pads comme sur une
 * MPC au clavier, le pad 1 en bas a gauche :
 *
 *   1 2 3 4   pads 13 a 16
 *   Q W E R   pads  9 a 12
 *   A S D F   pads  5 a  8
 *   Z X C V   pads  1 a  4
 *   Espace : PLAY ; M : MODE (SLICE, GRAIN) ; L : LOOP ; B : REV (a l'envers)
 *   O : OPEN (hooks/useKeys.ts, 2026-10-05 : INFO et CLOSE sont dedans)
 * En EDIT (2026-10-05), les memes touches posent ou enlevent les pas.
 */

import type { Stage } from '../scene/renderer';
import { smplLoopToggle, smplModeToggle, smplPlayToggle, smplReverse, smplTrig } from './actions';
import { SMPL_PLAY_ID, smplPadId } from './rig';

const ROWS = [
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
];
const PAD_OF = new Map<string, number>(ROWS.flatMap((row, r) => row.map((code, c) => [code, r * 4 + c] as [string, number])));

export const SMPL_KEY_LEGEND: readonly { keys: string; what: string }[] = [
  { keys: 'Z X C V  /  A S D F  /  Q W E R  /  1 2 3 4', what: 'Trigs 1 to 16 (Z = 1, 4 = 16); in EDIT, the steps' },
  { keys: 'Space', what: 'Play the sequence, or the region, or the grain cloud' },
  { keys: 'M', what: 'Mode: slice or grain' },
  { keys: 'L', what: 'Loop while a pad is held' },
  { keys: 'B', what: 'Reverse' },
  { keys: 'O', what: 'Open the machine: INFO (the user guide) and CLOSE are inside' },
];

const editable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/** Pose l'ecoute (phase de capture, avant les raccourcis des autres machines) ; rend de quoi l'oter. */
export function listenSmplKeys(getStage: () => Stage | null, active: () => boolean): () => void {
  const held = new Map<string, number>();
  const press = (id: string, down: boolean): void => getStage()?.smpl?.pressKey(id, down);

  const onDown = (e: KeyboardEvent): void => {
    if (!active() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
    // Un jumeau qui a le focus garde Espace et Entree
    const twin = e.target instanceof HTMLElement && e.target.classList.contains('v4-twin');
    if (twin && (e.code === 'Space' || e.code === 'Enter')) return;
    const pad = PAD_OF.get(e.code);
    if (pad !== undefined) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || held.has(e.code)) return;
      held.set(e.code, pad);
      press(smplPadId(pad), true);
      smplTrig(pad, true);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      press(SMPL_PLAY_ID, true);
      smplPlayToggle();
      window.setTimeout(() => press(SMPL_PLAY_ID, false), 120);
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      smplModeToggle();
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      e.stopPropagation();
      smplLoopToggle();
    } else if (e.code === 'KeyB') {
      e.preventDefault();
      e.stopPropagation();
      smplReverse();
    }
  };

  const onUp = (e: KeyboardEvent): void => {
    const pad = held.get(e.code);
    if (pad === undefined) return;
    held.delete(e.code);
    e.preventDefault();
    press(smplPadId(pad), false);
    smplTrig(pad, false);
  };

  const releaseAll = (): void => {
    for (const pad of held.values()) {
      press(smplPadId(pad), false);
      smplTrig(pad, false);
    }
    held.clear();
  };

  window.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', releaseAll);
  return () => {
    releaseAll();
    window.removeEventListener('keydown', onDown, true);
    window.removeEventListener('keyup', onUp, true);
    window.removeEventListener('blur', releaseAll);
  };
}
