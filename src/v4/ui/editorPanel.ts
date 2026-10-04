/**
 * Le panneau d'un editeur (2026-10-04) : la suite du MM-ARP
 * (ui/SeqLane.tsx), le motif du MM-RYTM (ui/BeatEditor.tsx). Cache tant que
 * le bouton EDIT de la machine ne l'a pas ouvert (state/editor.ts) ; visible
 * quand on utilise cette machine, capot ferme, aucune page ouverte. Sa
 * hauteur remonte le cadrage de la machine (Stage.setInset), sur desktop
 * comme au telephone ; une scene recreee (Dark / Light) la recoit aussi.
 * Cache : hors du clavier et des lecteurs d'ecran (inert).
 */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import type { Stage } from '../scene/renderer';
import { editor, type EditorId } from '../state/editor';
import { explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { section } from '../state/section';

const GAP = 12;
/** L'en-tete du desktop ; au telephone, le bas du selecteur des machines. */
const HEAD_PX = 56;

export function useEditorPanel(id: EditorId, stage: Stage | null): { shown: boolean; ref: RefObject<HTMLElement | null> } {
  const ed = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const opened = useSyncExternalStore(section.subscribe, section.get, section.get);
  const hoodStore = id === 'voy' ? voyExplode : explode;
  const hood = useSyncExternalStore(hoodStore.subscribe, hoodStore.get, hoodStore.get);
  const shown = ed === id && f === id && introState === 'done' && opened === null && hood === 'closed';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [shown]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !stage) return undefined;
    if (!shown) {
      stage.setInset(id, 0);
      return undefined;
    }
    const apply = (): void => {
      const r = el.getBoundingClientRect();
      const host = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const sw = document.querySelector('.v4-mswitch');
      const top = sw ? sw.getBoundingClientRect().bottom - host.top + GAP / 2 : HEAD_PX;
      stage.setInset(id, host.bottom - r.top + GAP, top);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown, stage, id]);

  return { shown, ref };
}
