/**
 * Le clavier du MM-DECKS (2026-10-04, Mika : "continue avec le clavier") :
 * les touches physiques (e.code, donc au meme endroit en QWERTY et en
 * AZERTY), la main gauche pour DECK A, la main droite pour DECK B, comme sur
 * un controleur. Actives seulement quand on utilise le MM-DECKS, jamais
 * pendant qu'on ecrit dans un champ. Les memes actions que les touches 3D
 * (dj/gestures.ts keyDown, keyUp) : CUE et BEND agissent tant qu'on les
 * tient, un hot cue tenu 0.6 s s'efface.
 *
 *   DECK A            DECK B
 *   1 2 3 4  hot cues  7 8 9 0
 *   Q W  bend - +      O P
 *   A  cue  S  play    K  cue  L  play
 *   E  browse A        I  browse B
 *   Z X  tempo - + 0.1 BPM (Maj : 1 BPM)   N M
 *   D  sync            J  sync
 *   F  loop 4 temps    H  loop 4 temps
 *   Espace : PLAY de la derniere platine touchee
 *   - et = : zoom des formes d'onde
 *   V : l'affichage des formes d'onde (3BAND, RGB, MONO)
 */

import type { Stage } from '../scene/renderer';
import { djWaveNext, djZoomStep } from './actions';
import { djBrowser } from './browser';
import { keyDown, keyUp } from './gestures';
import { DJ_KEYS, type DjKeySpec } from './layout';
import { djState } from './state';
import type { DjDeck } from './theme';

const key = (id: string): DjKeySpec | undefined => DJ_KEYS.find((k) => k.id === id);

/** Touche physique -> touche du MM-DECKS. */
const MAP: Readonly<Record<string, string>> = {
  Digit1: 'dj-a-hotcue1',
  Digit2: 'dj-a-hotcue2',
  Digit3: 'dj-a-hotcue3',
  Digit4: 'dj-a-hotcue4',
  KeyQ: 'dj-a-bendm',
  KeyW: 'dj-a-bendp',
  KeyA: 'dj-a-cue',
  KeyS: 'dj-a-play',
  Digit7: 'dj-b-hotcue1',
  Digit8: 'dj-b-hotcue2',
  Digit9: 'dj-b-hotcue3',
  Digit0: 'dj-b-hotcue4',
  KeyO: 'dj-b-bendm',
  KeyP: 'dj-b-bendp',
  KeyK: 'dj-b-cue',
  KeyL: 'dj-b-play',
  // Le tempo au dixieme de BPM (Maj : au BPM entier), tenu en continu
  KeyZ: 'dj-a-tempom',
  KeyX: 'dj-a-tempop',
  KeyN: 'dj-b-tempom',
  KeyM: 'dj-b-tempop',
  // SYNC : le centre du jog
  KeyD: 'dj-a-sync',
  KeyJ: 'dj-b-sync',
  // LOOP de quatre temps (les autres longueurs : les touches de la platine)
  KeyF: 'dj-a-loop4',
  KeyH: 'dj-b-loop4',
};

/** La legende, pour l'aide a l'ecran (touches lues en QWERTY). */
export const DJ_KEY_LEGEND: readonly { keys: string; what: string }[] = [
  { keys: '1 2 3 4  /  7 8 9 0', what: 'Hot cues A / B (hold: clear)' },
  { keys: 'A  /  K', what: 'Cue A / B (hold: preview)' },
  { keys: 'S  /  L', what: 'Play A / B' },
  { keys: 'Q W  /  O P', what: 'Bend - + A / B (hold)' },
  { keys: 'E  /  I', what: 'Browse on deck A / B' },
  { keys: 'Z X  /  N M', what: 'Pitch - + 0.1 BPM A / B (Shift: 1 BPM)' },
  { keys: 'D  /  J', what: 'Sync A / B to the tempo you hear' },
  { keys: 'F  /  H', what: 'Loop 4 beats on A / B (again: exit)' },
  { keys: 'Space', what: 'Play the last deck used' },
  { keys: '-  =', what: 'Waveform zoom' },
  { keys: 'V', what: 'Waveform view: 3BAND, RGB, MONO' },
];

const editable = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

/**
 * Pose l'ecoute du clavier (phase de capture : avant les raccourcis des
 * autres machines, qui ignorent un evenement deja pris) ; rend de quoi
 * l'oter. Une touche tenue se relache si la fenetre perd le focus.
 */
export function listenDjKeys(getStage: () => Stage | null, active: () => boolean): () => void {
  const held = new Map<string, DjKeySpec>();
  let last: DjDeck = 'a';

  const deckOf = (k: DjKeySpec): DjDeck | null => ('deck' in k.target ? k.target.deck : null);

  const onDown = (e: KeyboardEvent): void => {
    if (!active() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
    // Un jumeau qui a le focus garde ses fleches, Espace et Entree (dj/Twins.tsx)
    const twin = e.target instanceof HTMLElement && e.target.classList.contains('v4-twin');
    if (twin && /^(Arrow|Page|Home|End|Space|Enter|Delete|Backspace)/.test(e.code)) return;
    const s = djState.get();
    // Le zoom : la repetition du clavier est permise
    if (e.code === 'Minus' || e.code === 'Equal') {
      e.preventDefault();
      for (const d of ['a', 'b'] as const) djZoomStep(d, e.code === 'Minus' ? 1 : -1);
      return;
    }
    // V : l'affichage des formes d'onde, pour toutes les platines
    if (e.code === 'KeyV' && !e.repeat) {
      e.preventDefault();
      djWaveNext();
      return;
    }
    // E et I : la liste des morceaux dans l'ecran de A ou de B
    if ((e.code === 'KeyE' || e.code === 'KeyI') && !e.repeat) {
      e.preventDefault();
      djBrowser.open(e.code === 'KeyE' ? 'a' : 'b');
      return;
    }
    const id = e.code === 'Space' ? `dj-${last}-play` : MAP[e.code];
    const k = id ? key(id) : undefined;
    if (!k) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || held.has(e.code)) return;
    held.set(e.code, k);
    last = deckOf(k) ?? last;
    keyDown(k, getStage(), e.shiftKey);
  };

  const onUp = (e: KeyboardEvent): void => {
    const k = held.get(e.code);
    if (!k) return;
    held.delete(e.code);
    e.preventDefault();
    keyUp(k, getStage(), true);
  };

  const releaseAll = (): void => {
    for (const k of held.values()) keyUp(k, getStage(), false);
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
