/**
 * Entrees pointeur et molette sur la scene : tap (moins de 10 px) = selection,
 * drag = dolly avec inertie, molette = dolly, survol souris = picking
 * (throttle 16 ms) + parallaxe. Un drag ne selectionne jamais.
 */

import { useEffect, type RefObject } from 'react';
import type { AcidLine } from '../scene/AcidLine';

export interface HoverInfo {
  id: string;
  alt: string | null;
  x: number;
  y: number;
}

interface StageInputOpts {
  enabled: boolean;
  onSelect: (id: string, alt: string | null) => void;
  onHover: (h: HoverInfo | null) => void;
  onGesture: () => void;
}

const DRAG_PX = 10;

export function useStageInput(
  stageRef: RefObject<HTMLElement>,
  getScene: () => AcidLine | null,
  opts: StageInputOpts
): void {
  const { enabled, onSelect, onHover, onGesture } = opts;
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled) return;
    let down = false;
    let dragging = false;
    let touch = false;
    let x0 = 0;
    let y0 = 0;
    let lx = 0;
    let ly = 0;
    let lt = 0;
    let vel = 0;
    // Echantillons (temps, s cumule) des 120 dernieres ms : la vitesse de
    // lancer vient d'une fenetre, pas d'un seul evenement (drags synthetiques)
    const samples: { t: number; s: number }[] = [];
    let sAcc = 0;
    let hoverAt = 0;
    let hoverId: string | null = null;

    const setHover = (h: HoverInfo | null) => {
      if ((h?.id ?? null) === hoverId && !h) return;
      hoverId = h?.id ?? null;
      el.classList.toggle('is-over', !!h);
      onHover(h);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      down = true;
      dragging = false;
      touch = e.pointerType !== 'mouse';
      x0 = lx = e.clientX;
      y0 = ly = e.clientY;
      lt = e.timeStamp;
      vel = 0;
      sAcc = 0;
      samples.length = 0;
      samples.push({ t: e.timeStamp, s: 0 });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture refusee : le drag marche quand meme */
      }
    };

    const onMove = (e: PointerEvent) => {
      const scene = getScene();
      if (!scene) return;
      const rect = el.getBoundingClientRect();
      if (down) {
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        lx = e.clientX;
        ly = e.clientY;
        lt = e.timeStamp;
        if (!dragging) {
          const tx = e.clientX - x0;
          const ty = e.clientY - y0;
          if (tx * tx + ty * ty > DRAG_PX * DRAG_PX) {
            dragging = true;
            scene.dragStart();
            el.classList.add('is-dragging');
            setHover(null);
          }
        }
        if (dragging) {
          // Gauche ou haut (tactile) = vers le passe : s diminue
          const ds = (dx + (touch ? dy : 0)) * 0.0012;
          scene.drag(ds);
          sAcc += ds;
          samples.push({ t: e.timeStamp, s: sAcc });
          while (samples.length > 2 && e.timeStamp - samples[0].t > 120) samples.shift();
          const first = samples[0];
          const span = Math.max(16, e.timeStamp - first.t) / 1000;
          vel = Math.max(-1.2, Math.min(1.2, (sAcc - first.s) / span));
        }
        return;
      }
      if (e.pointerType !== 'mouse') return;
      // Parallaxe pointeur (-1..1) et picking survol
      scene.setPointer(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1);
      if (e.timeStamp - hoverAt < 16) return;
      hoverAt = e.timeStamp;
      const hit = scene.pick(e.clientX - rect.left, e.clientY - rect.top, 28);
      if (!hit) setHover(null);
      else if (hit.id !== hoverId) setHover({ id: hit.id, alt: hit.alt, x: hit.x, y: hit.y });
    };

    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      const scene = getScene();
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
      onGesture();
      if (dragging) {
        dragging = false;
        el.classList.remove('is-dragging');
        // Un doigt ou une souris immobile depuis 100 ms ne lance rien
        const last = samples[samples.length - 1];
        scene?.dragEnd(last && e.timeStamp - last.t > 100 ? 0 : vel);
        return;
      }
      if (!scene) return;
      const rect = el.getBoundingClientRect();
      const hit = scene.pick(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === 'mouse' ? 28 : 36);
      if (hit) onSelect(hit.id, hit.alt);
    };

    const onCancel = () => {
      if (dragging) getScene()?.dragEnd(0);
      down = false;
      dragging = false;
      el.classList.remove('is-dragging');
    };

    const onLeave = () => {
      setHover(null);
      getScene()?.setPointer(0, 0);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Molette vers le bas = vers le passe
      getScene()?.wheel(-e.deltaY * 0.0006);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('wheel', onWheel);
      el.classList.remove('is-over', 'is-dragging');
    };
  }, [stageRef, getScene, enabled, onSelect, onHover, onGesture]);
}
