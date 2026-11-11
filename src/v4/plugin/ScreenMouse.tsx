/**
 * La souris dans l'ecran du MM-RYTM (le plugin, 2026-11-08, Mika : "quand on cherche un preset je voudrais aussi le
 * selectionner a la souris dans l'ecran" ; "touche Function ... un peu trop difficile a gerer avec un plugin").
 *
 * Une couche HTML transparente posee exactement sur l'ecran (Stage.screenRect), active seulement quand un menu est ouvert
 * (PRESET, SETTINGS, SOUNDS, TEMPO...). Un clic devient ce que ferait la face : le menu le prend s'il sait (onPoint : la
 * liste des presets) ; sinon, dans une liste peinte par paintList (menus/frame.ts lastList), le curseur va a la ligne
 * cliquee (UP / DOWN), un clic sur la ligne du curseur fait YES ; la molette fait LEVEL/DATA. Un clic droit fait NO
 * (revenir d'un cran). Hors menu, la couche laisse passer le pointeur (l'ecran et la face comme avant).
 *
 * Les fleches (2026-11-09, Mika : "a la place des fleches je veux le crossfade A et B" ; "je veux pouvoir toucher l'ecran
 * avec la souris pour voir l'utilisation des fleches parce que c'est un plugin") : la face n'a plus de fleches, quatre
 * touches cliquables dans la bande du cadre sous l'ecran (a gauche, la place du nom de la DT2) font ce que font les fleches
 * du clavier du Mac (useKeys : faceKeyDown) : la sous-page, une ligne d'une liste, la banque en PTN. Tenues, elles se
 * repetent.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { faceKeyTap } from '../actions/face';
import type { Dt2ButtonId } from '../rytm/dtFaceIds';
import { DT2_FACEPLATE } from '../rytm/faceplate';
import type { Stage } from '../scene/renderer';
import { UH, UW } from '../scene/screen/consts';
import { lastList } from '../scene/screen/menus/frame';
import { menuInput, openMenu, openMenuId, subscribeMenu } from '../scene/screen/menus/open';
import type { ScreenMenuInputKind, ScreenPoint } from '../scene/screen/menus/registry';
import { curScreen, lockMode, subscribeDials } from '../actions';
import { srcWave, srcWaveDrag } from '../scene/screen/pluginGfx';
import { explode } from '../state/explode';
import { rytmPage } from '../state/rytmPage';
import { activeTrack } from '../state/trk';

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

/**
 * Le point de l'ecran (unites UW x UH) sous la souris : par le rayon de la camera (la vue penchee du plugin fait de l'ecran
 * un trapeze, 2026-11-09), sinon par la boite ; null hors de l'ecran.
 */
function toScreen(stage: Stage | null, el: HTMLElement, x: number, y: number): { u: number; v: number } | null {
  const hit = stage?.screenUV(x, y);
  if (hit) return { u: hit.u * UW, v: hit.v * UH };
  if (stage) return null;
  const r = el.getBoundingClientRect();
  return { u: ((x - r.left) / r.width) * UW, v: ((y - r.top) / r.height) * UH };
}

type Arrow = 'left' | 'up' | 'down' | 'right';
const ARROWS: readonly { d: Arrow; title: string; path: string }[] = [
  {
    d: 'left',
    title: 'Left (keyboard Left): previous sub-page; in PTN, the bank',
    path: 'M14 5 L8 12 L14 19',
  },
  {
    d: 'up',
    title: 'Up (keyboard Up): previous sub-page; in a list, up',
    path: 'M5 15 L12 9 L19 15',
  },
  {
    d: 'down',
    title: 'Down (keyboard Down): next sub-page; in a list, down',
    path: 'M5 9 L12 15 L19 9',
  },
  {
    d: 'right',
    title: 'Right (keyboard Right): next sub-page; in PTN, the bank',
    path: 'M10 5 L16 12 L10 19',
  },
];

/** La bande du cadre sous la zone active de l'ecran, en mm de la face : sa hauteur ; les touches, leur taille et leur jeu. */
const SCR = DT2_FACEPLATE.screen;
const BAND = (SCR.rect.h - SCR.active.h) / 2;
const PAD = { w: 6.4, h: 4, gap: 1.1 } as const;

/** Les quatre fleches sous l'ecran : un appui, puis la repetition tant qu'elles sont tenues. */
const ArrowPad: React.FC<{ box: Box; stage: Stage | null }> = ({ box, stage }) => {
  const [on, setOn] = useState<Arrow | null>(null);
  const timer = useRef<{ t: number; i: number }>({ t: 0, i: 0 });
  const stop = (): void => {
    window.clearTimeout(timer.current.t);
    window.clearInterval(timer.current.i);
    timer.current = { t: 0, i: 0 };
    setOn(null);
  };
  useEffect(() => stop, []);
  const fire = (d: Arrow): void => faceKeyTap(d as unknown as Dt2ButtonId, stage, 'key');
  const mm = box.width / SCR.active.w;
  const top = box.top + box.height + ((BAND - PAD.h) / 2) * mm;
  return (
    <div
      className="mm-arrow-pad"
      style={{
        position: 'fixed',
        left: box.left,
        top,
        height: PAD.h * mm,
        display: 'flex',
        gap: PAD.gap * mm,
        zIndex: 6,
      }}
    >
      {ARROWS.map((a) => (
        <button
          key={a.d}
          type="button"
          title={a.title}
          aria-label={a.title}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            stop();
            setOn(a.d);
            fire(a.d);
            timer.current.t = window.setTimeout(() => {
              timer.current.i = window.setInterval(() => fire(a.d), 90);
            }, 380);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            stop();
          }}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: PAD.w * mm,
            height: PAD.h * mm,
            padding: 0,
            margin: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 0.9 * mm,
            border: '1px solid rgba(246, 241, 231, 0.22)',
            background: on === a.d ? 'rgba(255, 120, 31, 0.22)' : 'rgba(246, 241, 231, 0.05)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width={PAD.h * mm * 0.95} height={PAD.h * mm * 0.95} aria-hidden="true">
            <path d={a.path} fill="none" stroke={on === a.d ? '#FF781F' : 'rgba(246, 241, 231, 0.85)'} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
};

/**
 * S et E du sample en grand (SRC 2/2, 2026-11-10, Mika : "je ne sais pas comment modifier le start ou le end") : une zone
 * posee sur la forme d'onde de l'ecran (screen/pluginGfx.ts srcWave) ; on y tire le repere le plus proche (S : START, E : la
 * fin), Maj pour le reglage fin, un clic loin des deux y amene le plus proche, un double clic rend le sample entier.
 * Seulement quand cette page est a l'ecran, sans menu ni P-LOCK.
 */
const waveShown = (): boolean => curScreen() === 'synth' && !openMenuId() && !lockMode();
const subscribeWave = (fn: () => void): (() => void) => {
  const offs = [rytmPage.subscribe(fn), subscribeMenu(fn), subscribeDials(fn), activeTrack.subscribe(fn)];
  return () => offs.forEach((off) => off());
};
/** px autour de la forme d'onde ou la souris prend encore (les reperes sont au bord quand le sample joue en entier). */
const WAVE_PAD = 8;
const GRAB_PX = 14;

const WaveDrag: React.FC<{ box: Box }> = ({ box }) => {
  const show = useSyncExternalStore(subscribeWave, waveShown, waveShown);
  const drag = useRef<{ which: 'start' | 'end'; x0: number; f0: number } | null>(null);
  if (!show) return null;
  const { rect } = srcWave();
  const left = box.left + (rect.x0 / UW) * box.width;
  const top = box.top + (rect.y0 / UH) * box.height;
  const width = ((rect.x1 - rect.x0) / UW) * box.width;
  const height = ((rect.y1 - rect.y0) / UH) * box.height;
  const fAt = (clientX: number): number => (clientX - left) / Math.max(1, width);
  const nearest = (clientX: number): { which: 'start' | 'end'; px: number; f: number } => {
    const w = srcWave();
    const f = fAt(clientX);
    const ds = Math.abs(f - w.s) * width;
    const de = Math.abs(f - w.e) * width;
    return ds <= de ? { which: 'start', px: ds, f: w.s } : { which: 'end', px: de, f: w.e };
  };
  return (
    <div
      className="mm-wave-drag"
      title="Drag S (start) and E (end); Shift: fine; double click: the whole sample"
      style={{ position: 'fixed', left: left - WAVE_PAD, top, width: width + 2 * WAVE_PAD, height, zIndex: 5, cursor: 'ew-resize', touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const n = nearest(e.clientX);
        const f = Math.max(0, Math.min(1, fAt(e.clientX)));
        // Loin des deux reperes : le plus proche vient sous la souris
        const jump = n.px > GRAB_PX;
        if (jump) srcWaveDrag(n.which, f);
        drag.current = { which: n.which, x0: e.clientX, f0: jump ? f : n.f };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        e.stopPropagation();
        srcWaveDrag(d.which, d.f0 + ((e.clientX - d.x0) / Math.max(1, width)) * (e.shiftKey ? 0.1 : 1));
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        srcWaveDrag('start', 0);
        srcWaveDrag('end', 1);
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
};

export const ScreenMouse: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const menu = useSyncExternalStore(subscribeMenu, openMenuId, openMenuId);
  const hood = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
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
      const p = toScreen(stage, el, e.clientX, e.clientY);
      if (p) point({ kind: 'wheel', ...p, delta: e.deltaY > 0 ? 1 : -1 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [menu, box, stage]);

  // Capot ouvert (2026-11-11, OPEN : la carte) : l'ecran de la face n'est plus la, ses couches non plus
  if (!box || hood !== 'closed') return null;
  const at = (e: React.MouseEvent<HTMLDivElement>): { u: number; v: number } => toScreen(stage, e.currentTarget, e.clientX, e.clientY) ?? { u: -1, v: -1 };
  return (
    <>
      <ArrowPad box={box} stage={stage} />
      <WaveDrag box={box} />
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
    </>
  );
};
