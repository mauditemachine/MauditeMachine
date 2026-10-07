/**
 * Le clavier du MM-BASS (2026-10-07) : les touches physiques (e.code : au
 * meme endroit en QWERTY et en AZERTY), seulement quand on utilise le
 * MM-BASS, jamais pendant qu'on ecrit dans un champ. Les seize pas en deux
 * rangees, comme les trigs d'une Elektron :
 *
 *   1 2 3 4 5 6 7 8         pas 1 a 8
 *   Maj + 1 2 3 4 5 6 7 8   pas 9 a 16 (2026-10-07 : E est EDIT, comme
 *                           sur le MM-RYTM et le MM-ARP)
 *   Espace : RUN ; E : EDIT (les patterns) ; G : GEN ; M : MUTATE
 *   A : ACCENT ; S : SLIDE ; L : LOCK (le pas choisi ; Echap en sort)
 *   Haut, Bas : NOTE + - ; Z, X : OCT - +
 */

import type { Stage } from '../scene/renderer';
import { bassLockOff, bassLockToggle, bassStepTap } from './actions';
import { bassKeyAction } from './gestures';
import { bassKeyId, bassLockId, bassTrigId } from './rig';
import { bassState } from './state';
import type { BassKeyKind } from './theme';

const STEP_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const STEP_OF = new Map<string, number>(STEP_CODES.map((c, i) => [c, i]));
const KEY_OF: Readonly<Record<string, BassKeyKind>> = {
  Space: 'run',
  KeyE: 'edit',
  KeyG: 'gen',
  KeyM: 'mutate',
  KeyA: 'accent',
  KeyS: 'slide',
  ArrowDown: 'notedn',
  ArrowUp: 'noteup',
  KeyZ: 'octdn',
  KeyX: 'octup',
};

export const BASS_KEY_LEGEND: readonly { keys: string; what: string }[] = [
  { keys: '1 to 8  /  Shift + 1 to 8', what: 'Steps 1 to 16: pick, then note, tie, off (in EDIT: the patterns)' },
  { keys: 'Space', what: 'Run or stop, in time with the MM-RYTM' },
  { keys: 'E', what: 'Edit: the sixteen patterns on the steps' },
  { keys: 'L  /  Esc', what: 'Lock the chosen step: the sound knobs change only it  /  out of lock' },
  { keys: 'G  /  M', what: 'Generate a new line  /  mutate a few steps' },
  { keys: 'A  /  S', what: 'Accent  /  slide on the chosen step' },
  { keys: 'Up  Down', what: 'Chosen step one note up or down in the scale' },
  { keys: 'Z  X', what: 'Chosen step one octave down or up' },
];

const editable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/** Pose l'ecoute (phase de capture, avant les raccourcis des autres machines) ; rend de quoi l'oter. */
export function listenBassKeys(getStage: () => Stage | null, active: () => boolean): () => void {
  const held = new Map<string, string>();
  const press = (id: string, down: boolean): void => getStage()?.bass?.pressKey(id, down);

  const onDown = (e: KeyboardEvent): void => {
    if (!active() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
    // Un jumeau qui a le focus garde ses fleches, Espace et Entree
    const twin = e.target instanceof HTMLElement && e.target.classList.contains('v4-twin');
    if (twin && /^(Arrow|Page|Home|End|Space|Enter)/.test(e.code)) return;
    // Echap : d'abord le LOCK (le reste, EDIT compris, est a hooks/useKeys.ts)
    if (e.code === 'Escape') {
      if (bassState.get().lock < 0) return;
      e.preventDefault();
      e.stopPropagation();
      bassLockOff();
      return;
    }
    if (e.code === 'KeyL') {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const id = bassLockId(bassState.get().sel);
      held.set(e.code, id);
      press(id, true);
      bassLockToggle();
      return;
    }
    const s0 = STEP_OF.get(e.code);
    const step = s0 === undefined ? undefined : s0 + (e.shiftKey ? 8 : 0);
    const kind = KEY_OF[e.code];
    if (step === undefined && !kind) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat && step !== undefined) return;
    // NOTE et OCT se repetent quand on les tient ; les autres une fois
    if (e.repeat && kind !== 'notedn' && kind !== 'noteup') return;
    const id = step !== undefined ? bassTrigId(step) : bassKeyId(kind);
    if (!held.has(e.code)) {
      held.set(e.code, id);
      press(id, true);
    }
    if (step !== undefined) bassStepTap(step);
    else bassKeyAction(kind);
  };

  const onUp = (e: KeyboardEvent): void => {
    const id = held.get(e.code);
    if (!id) return;
    held.delete(e.code);
    press(id, false);
  };

  const releaseAll = (): void => {
    for (const id of held.values()) press(id, false);
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
