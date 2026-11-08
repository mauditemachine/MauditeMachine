/**
 * La souris dans l'ecran du MM-RYTM (le plugin, 2026-11-08, Mika : "quand on cherche un preset je voudrais aussi le
 * selectionner a la souris dans l'ecran" ; "touche Function ... un peu trop difficile a gerer avec un plugin").
 *
 * Une couche HTML transparente posee exactement sur l'ecran (Stage.screenRect), active seulement quand un menu est ouvert
 * (PRESET, SETTINGS, SOUNDS, TEMPO...). Un clic devient ce que ferait la face : le menu le prend s'il sait (onPoint : la
 * liste des presets) ; sinon, dans une liste peinte par paintList (menus/frame.ts lastList), le curseur va a la ligne
 * cliquee (UP / DOWN), un clic sur la ligne du curseur fait YES ; la molette fait LEVEL/DATA. Un clic droit fait NO
 * (revenir d'un cran). Hors menu, la couche laisse passer le pointeur (l'ecran et la face comme avant).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { UH, UW } from '../scene/screen/consts';
import { lastList } from '../scene/screen/menus/frame';
import { menuInput, openMenu, openMenuId, subscribeMenu } from '../scene/screen/menus/open';
import type { ScreenMenuInputKind, ScreenPoint } from '../scene/screen/menus/registry';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Une touche de navigation, appui puis relacher (YES et NO agissent au relacher). */
function press(kind: ScreenMenuInputKind, delta?: number): void {
  menuInput({ kind, phase: 'down', func: false, ...(delta !== undefined ? { delta } : {}) });
  if (kind === 'yes' || kind === 'no') menuInput({ kind, phase: 'up', func: false });
}

/** Une liste peinte (lastList) : la ligne sous v, -1 hors de la liste. */
function rowAt(u: number, v: number): number {
  const L = lastList;
  if (L.n <= 0 || u < L.area.x0 || u > L.area.x1 || v < L.area.y0 || v > L.area.y1) return -1;
  const r = Math.floor((v - L.area.y0) / L.rh);
  const k = L.top + r;
  return r >= 0 && r < L.n && k < L.count ? k : -1;
}

function point(p: ScreenPoint): void {
  const m = openMenu();
  if (!m) return;
  if (m.onPoint?.(p)) return;
  if (p.kind === 'wheel') {
    press('data', Math.sign(p.delta ?? 0));
    return;
  }
  const k = rowAt(p.u, p.v);
  if (k < 0) return;
  const from = lastList.cursor;
  if (k === from) {
    press('yes');
    return;
  }
  const n = Math.abs(k - from);
  for (let i = 0; i < n; i += 1) press(k > from ? 'down' : 'up');
  if (p.kind === 'dbl') press('yes');
}

export const ScreenMouse: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const menu = useSyncExternalStore(subscribeMenu, openMenuId, openMenuId);
  const [box, setBox] = useState<Box | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // La place de l'ecran sur la page (la vue est fixe : a l'ouverture et quand la fenetre change de taille)
  useEffect(() => {
    if (!stage) return undefined;
    const place = (): void => setBox(stage.screenRect());
    place();
    const t = window.setTimeout(place, 300);
    window.addEventListener('resize', place);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', place);
    };
  }, [stage]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // La molette : pas de defilement de page, un cran par geste
    const onWheel = (e: WheelEvent): void => {
      if (!menu || !box) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      point({ kind: 'wheel', u: ((e.clientX - r.left) / r.width) * UW, v: ((e.clientY - r.top) / r.height) * UH, delta: e.deltaY > 0 ? 1 : -1 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [menu, box]);

  if (!box) return null;
  const at = (e: React.MouseEvent<HTMLDivElement>): { u: number; v: number } => {
    const r = e.currentTarget.getBoundingClientRect();
    return { u: ((e.clientX - r.left) / r.width) * UW, v: ((e.clientY - r.top) / r.height) * UH };
  };
  return (
    <div
      ref={ref}
      className="mm-screen-mouse"
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: 5,
        pointerEvents: menu ? 'auto' : 'none',
        cursor: menu ? 'pointer' : 'default',
      }}
      onPointerDown={(e) => {
        // Le premier geste reste un geste de la page (le contexte audio du site), sans rien d'autre
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail > 1) return;
        point({ kind: 'tap', ...at(e) });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        point({ kind: 'dbl', ...at(e) });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        press('no');
      }}
    />
  );
};
