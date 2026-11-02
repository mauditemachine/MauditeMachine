/**
 * Les jumeaux HTML de la lane B4 SAISIE ET TOUCHES (V.6.0, 2026-11-01, docs/v4/dt2/dt2-master-spec.md 2.7) : ceux des
 * commandes nouvelles de la face DT2 (?face=dt2) : MAIN VOLUME et LEVEL/DATA (des curseurs), KEYBOARD, SONG, PRESET/KIT,
 * SETTINGS, SOUNDS, TEMPO, les quatre fleches et PAGE (des touches a tenir ou a taper : Espace ou Entree tenus tiennent la
 * touche, comme FUNC et TRK). ui/Hotspots.tsx les pose dans l'ordre de lecture de la face (rytm/dtFaceIds.ts DT2_BUTTONS) :
 * le registre de la lane (TWINS_INPUT60) reste vide, Hotspots etant a la lane. Sans le drapeau, rien.
 */

import React, { useEffect, useRef } from 'react';
import { dataTurn, faceKeyDown, faceKeyTap, faceKeyUp, mainVolumeTurn } from '../../actions';
import type { Dt2ButtonId } from '../../rytm/dtFaceIds';
import type { Stage } from '../../scene/renderer';
import { FACE_TITLE } from '../../theme';
import type { LaneTwins } from './types';

export const TWINS_INPUT60: LaneTwins = { at: {} };

/** La lettre de chaque touche nouvelle au clavier (cahier 2.7), dite par le jumeau. */
export const TWIN_KEYS_60: Readonly<Partial<Record<Dt2ButtonId, string>>> = {
  kbd: 'K',
  preset: 'P',
  settings: 'comma',
  sounds: 'U',
  tempo: 'Y',
  up: 'Shift + Up',
  down: 'Shift + Down',
  left: 'Shift + Left',
  right: 'Shift + Right',
  ptnpage: 'G',
};

/** Ce que dit le jumeau d'une touche nouvelle : son nom complet (FACE_TITLE), puis sa lettre. */
export function twinLabel60(id: Dt2ButtonId): string {
  const t = FACE_TITLE[id] ?? id.toUpperCase();
  const k = TWIN_KEYS_60[id];
  return k ? `${t}, key ${k}` : t;
}

const HOLD_KEYS: ReadonlySet<string> = new Set([' ', 'Enter']);
/** Un clic venu du clavier (Entree, Espace) dans ce delai apres une touche : pas une aide technique. */
const HOLD_CLICK_MS = 500;

/**
 * Le jumeau d'une touche de la face DT2 : Espace ou Entree enfonces = la touche enfoncee (relachee au lacher), comme sur la
 * machine ; un clic d'une aide technique (sans clavier) : un appui et un lacher.
 */
export function FaceKeyTwin({ id, refFn, stage, pressed }: { id: Dt2ButtonId; refFn: (el: HTMLElement | null) => void; stage: Stage | null; pressed?: boolean }): React.ReactElement {
  const held = useRef<(() => void) | null>(null);
  const keyAt = useRef(-Infinity);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(() => () => held.current?.(), []);
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    keyAt.current = performance.now();
    if (e.repeat || held.current) return;
    const key = e.key;
    const onUp = (ev: KeyboardEvent): void => {
      if (ev.key !== key) return;
      ev.preventDefault();
      keyAt.current = performance.now();
      off();
      faceKeyUp(id, 'twin', stageRef.current, ev.timeStamp || performance.now(), true);
    };
    const off = (): void => {
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', onBlur);
      held.current = null;
    };
    const onBlur = (): void => {
      off();
      faceKeyUp(id, 'twin', stageRef.current, -1, false);
    };
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', onBlur);
    held.current = off;
    faceKeyDown(id, 'twin', stageRef.current, e.timeStamp || performance.now());
  };
  return React.createElement('button', {
    ref: refFn,
    type: 'button',
    className: 'v4-twin',
    'data-twin': 'dt2key',
    'data-hotspot': id,
    'aria-label': twinLabel60(id),
    'aria-pressed': pressed,
    title: FACE_TITLE[id],
    onKeyDown,
    onKeyUp: (e: React.KeyboardEvent) => {
      if (HOLD_KEYS.has(e.key)) e.preventDefault();
    },
    onClick: (e: React.MouseEvent) => {
      if (e.detail !== 0 || performance.now() - keyAt.current < HOLD_CLICK_MS) return;
      faceKeyTap(id, stageRef.current);
    },
  });
}

/**
 * Le jumeau d'un potard de la colonne gauche : MAIN VOLUME (une valeur, 0 a 100 %) ou LEVEL/DATA (un encodeur sans fin :
 * TRK LEV de la piste active, ou le defilement du menu ouvert). Haut et droite : un cran de plus ; Page haut et bas : huit.
 */
export function SideKnobTwin({ id, refFn, text, now }: { id: 'mvol' | 'data'; refFn: (el: HTMLElement | null) => void; text: string; now?: number }): React.ReactElement {
  const turn = (n: number): void => (id === 'mvol' ? mainVolumeTurn(n, 'twin') : dataTurn(n, 'twin'));
  return React.createElement('div', {
    ref: refFn,
    className: 'v4-twin',
    'data-twin': 'side',
    'data-hotspot': id,
    role: 'slider',
    tabIndex: 0,
    'aria-label': `${FACE_TITLE[id] ?? id}: arrows turn it, page up and down eight steps`,
    'aria-orientation': 'vertical',
    'aria-valuemin': 0,
    'aria-valuemax': 127,
    'aria-valuenow': now ?? 0,
    'aria-valuetext': text,
    onKeyDown: (e: React.KeyboardEvent) => {
      const n = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : e.key === 'PageUp' ? 8 : e.key === 'PageDown' ? -8 : 0;
      if (n === 0) return;
      e.preventDefault();
      turn(n);
    },
  });
}
