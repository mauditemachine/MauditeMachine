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
 *   O : OPEN (le capot, 2026-10-08) ; I : INFOS (l'aide au survol)
 *   [ ] : la page d'avant, d'apres (VOICE FILTER ENV FX, la machine Elektron
 *         du 2026-10-08, comme sur le MM-RYTM)
 *   Maj + [ ] : l'onglet d'avant, d'apres dans la page (2026-10-09 : VOICE
 *         MAIN, OSC, MIX ; FILTER MAIN, CONTOUR)
 */

import type { Stage } from '../scene/renderer';
import { bassInfos } from '../state/bassInfos';
import { presetMode } from '../state/presetMode';
import { section } from '../state/section';
import { PORTRAIT } from '../theme';
import { bassLockOff, bassLockToggle, bassPageStep, bassStepTap, bassTabStep } from './actions';
import { bassPage } from './pages';
import { bassKeyAction } from './gestures';
import { bassKeyId, bassLockId, bassTrigId } from './rig';
import { bassState } from './state';
import type { BassKeyKind } from './theme';

const STEP_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const STEP_OF = new Map<string, number>(STEP_CODES.map((c, i) => [c, i]));
const KEY_OF: Readonly<Record<string, BassKeyKind>> = {
  Space: 'run',
  KeyE: 'edit',
  KeyO: 'open',
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
  // L'etape 2 (2026-10-09) : une tape sur un pas le met en P-LOCK, la suivante le change
  { keys: '1 to 8  /  Shift + 1 to 8', what: 'Steps 1 to 16: P-LOCK (an empty step gets a note), again: tie, off (in EDIT: the patterns)' },
  { keys: 'Space', what: 'Run or stop, in time with the MM-RYTM' },
  { keys: 'E', what: 'Edit: the sixteen patterns on the steps' },
  { keys: 'O  /  I', what: 'Open the machine (fine settings)  /  INFOS: hover a control to read what it does' },
  // Au telephone (2026-10-09) les blocs de l'ecran tiennent lieu d'encodeurs
  { keys: '[  ]', what: `Previous or next page (VOICE, FILTER, ENV, FX): the eight screen values follow it${PORTRAIT ? '' : ', the knobs stay on the global FX'}` },
  { keys: 'Shift + [  ]', what: 'Previous or next tab of the page (VOICE: MAIN, OSC, MIX; FILTER: MAIN, CONTOUR); a page key pressed again does the same' },
  { keys: 'L  /  Esc', what: 'P-LOCK the chosen step: the screen values change only it  /  out of P-LOCK' },
  { keys: 'G  /  M', what: 'Generate a new line  /  mutate a few steps' },
  { keys: 'A  /  S', what: 'Accent  /  slide on the chosen step' },
  { keys: 'Up  Down', what: 'Chosen step one note up or down in the scale' },
  { keys: 'Z  X', what: 'Chosen step one octave down or up' },
];

const editable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/**
 * Un bouton, un lien ou un interrupteur du DOM qui a le focus (le menu, MERCH, CONTACT...) : Espace et
 * Entree sont a lui, comme ownsSpace de hooks/useKeys.ts pour le MM-RYTM (revue du 2026-10-09 : Espace
 * sur l'interrupteur Dark / Light lancait le MM-BASS au lieu de changer l'apparence).
 */
const ownsPress = (t: EventTarget | null): boolean =>
  t instanceof Element && t.closest('button, a[href], [role="button"], [role="switch"], [role="checkbox"], summary') !== null;

/** Pose l'ecoute (phase de capture, avant les raccourcis des autres machines) ; rend de quoi l'oter. */
export function listenBassKeys(getStage: () => Stage | null, active: () => boolean): () => void {
  const held = new Map<string, string>();
  const press = (id: string, down: boolean): void => getStage()?.bass?.pressKey(id, down);

  const onDown = (e: KeyboardEvent): void => {
    if (!active() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
    // Un jumeau qui a le focus garde ses fleches, Espace et Entree
    const twin = e.target instanceof HTMLElement && e.target.classList.contains('v4-twin');
    if (twin && /^(Arrow|Page|Home|End|Space|Enter)/.test(e.code)) return;
    if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') && ownsPress(e.target)) return;
    // Echap : d'abord le LOCK (le reste, EDIT compris, est a hooks/useKeys.ts) ; une page du site ou PRESETS ouverts
    // par-dessus passent avant (la revue du 2026-10-09 : une tape sur un pas met le P-LOCK, le premier Echap le
    // retirait derriere PRESETS sans que rien ne se voie ; actions.ts escape les ferme dans cet ordre)
    if (e.code === 'Escape') {
      if (bassState.get().lock < 0 || section.get() !== null || presetMode.get().machine) return;
      e.preventDefault();
      e.stopPropagation();
      bassLockOff();
      return;
    }
    // I : INFOS, l'aide au survol (2026-10-08)
    if (e.code === 'KeyI') {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) bassInfos.toggle();
      return;
    }
    // [ et ] : les pages (2026-10-08) ; la LED de la touche de page s'allume avec
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      e.preventDefault();
      e.stopPropagation();
      // Maj : l'onglet d'a cote dans la page (2026-10-09)
      if (e.shiftKey) bassTabStep(e.code === 'BracketLeft' ? -1 : 1);
      else bassPageStep(e.code === 'BracketLeft' ? -1 : 1);
      const id = bassKeyId(`p${bassPage.get()}` as BassKeyKind);
      press(id, true);
      window.setTimeout(() => press(id, false), 120);
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
