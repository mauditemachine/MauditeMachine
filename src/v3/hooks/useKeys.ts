/**
 * Clavier global : Espace = play/pause seulement apres un premier geste
 * (clic ou Entree) et avec une piste chargee ; fleches = prev/next si une
 * piste joue, sinon deplacement de la selection ; 1..4 = groupe ; Entree
 * sur la scene = jouer la selection ; Echap = fermer.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { GroupId } from '../data/beads';

export interface KeyHandlers {
  hasGesture: RefObject<boolean>;
  hasCurrent: boolean;
  drawerOpen: boolean;
  stageRef: RefObject<HTMLElement | null>;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMoveSelection: (dir: 1 | -1) => void;
  onEnter: () => void;
  onGroup: (g: GroupId) => void;
  onEscape: () => void;
}

const isEditable = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

export function useKeys(h: KeyHandlers): void {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = ref.current;
      if (e.key === 'Escape') {
        k.onEscape();
        return;
      }
      if (k.drawerOpen || isEditable(e.target)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      // Un bouton focalise garde Espace pour lui (activation native) ;
      // fleches et chiffres passent, sinon la selection est bloquee apres
      // qu'une ligne de la tracklist a mis le focus sur RUN
      const onButton = !!t && t.tagName === 'BUTTON';
      switch (e.key) {
        case ' ':
        case 'Spacebar':
          if (onButton) return;
          if (k.hasCurrent && k.hasGesture.current) {
            e.preventDefault();
            k.onToggle();
          }
          return;
        case 'ArrowLeft':
          e.preventDefault();
          if (k.hasCurrent) k.onPrev();
          else k.onMoveSelection(-1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          if (k.hasCurrent) k.onNext();
          else k.onMoveSelection(1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          k.onMoveSelection(-1);
          return;
        case 'ArrowDown':
          e.preventDefault();
          k.onMoveSelection(1);
          return;
        case 'Enter':
          if (t && t === k.stageRef.current) {
            e.preventDefault();
            k.onEnter();
          }
          return;
        case '1':
        case '2':
        case '3':
        case '4':
          k.onGroup(Number(e.key) as GroupId);
          return;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
