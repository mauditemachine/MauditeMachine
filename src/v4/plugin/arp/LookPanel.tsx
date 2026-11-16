/**
 * Les reglages d'aspect du plugin MM-ARP (2026-11-16, Mika : "un parametre dans les settings pour attenuer le cuir",
 * le panneau de reglages de Legend HZ pour reference) : une petite icone (des curseurs) sur la face, a gauche de FIRMWARE,
 * et dans l'en-tete d'OPEN, a gauche de la croix ; elle ouvre un petit panneau de verre fume, un curseur par reglage
 * (une tete noire a ligne claire sur un rail fin) : LEATHER TEXTURE (0 : la laque lisse d'avant, 100 : le cuir plein ;
 * 70 au depart) et PANEL LIGHT (50 : neutre). Effet en direct sur la face (FaceLook : le cuir de la serigraphie, la
 * teinte du capot) et dans OPEN (variables CSS, look.ts). Le panneau se ferme au clic dehors (ce clic ne fait rien
 * d'autre : OPEN ne se ferme pas par erreur) ou a Echap (avant la chaine d'Echap du site, hooks/useKeys.ts).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Vector3, type Material, type Mesh, type MeshStandardMaterial } from 'three';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { lightGain } from '../../voyager/silk';
import { VOY_HEAD } from '../../voyager/theme';
import { look, LOOK_DEFAULTS, type Look } from './look';

/* ---------------- le panneau ouvert (un seul a la fois) ---------------- */

let openAt: 'face' | 'hood' | null = null;
const openListeners = new Set<() => void>();
const lookOpen = {
  get: (): 'face' | 'hood' | null => openAt,
  set(v: 'face' | 'hood' | null): void {
    if (v === openAt) return;
    openAt = v;
    openListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    openListeners.add(fn);
    return () => {
      openListeners.delete(fn);
    };
  },
};

const useLook = (): Look => useSyncExternalStore(look.subscribe, look.get, look.get);
const useOpen = () => useSyncExternalStore(lookOpen.subscribe, lookOpen.get, lookOpen.get);
const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);

/* ---------------- la face 3D : le cuir, la teinte du capot ---------------- */

/** Applique les reglages a la scene (le cuir des deux serigraphies, la teinte du capot), une fois par image. */
export const FaceLook: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!stage || !rig) return undefined;
    let raf = 0;
    const apply = (): void => {
      raf = 0;
      const { leather, light } = look.get();
      for (const silk of [rig.panelSilk, rig.deckSilk]) if (silk.setLook(leather, light)) silk.draw();
      const lid = rig.body.lid as Mesh;
      const mats: Material[] = Array.isArray(lid.material) ? lid.material : [lid.material];
      for (const m of mats) (m as MeshStandardMaterial).color?.setScalar(lightGain(light));
      stage.invalidate();
    };
    const queue = (): void => {
      if (!raf) raf = window.requestAnimationFrame(apply);
    };
    apply();
    const off = look.subscribe(queue);
    return () => {
      off();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [stage]);
  return null;
};

/* ---------------- le curseur ---------------- */

const Fader: React.FC<{ label: string; value: number; def: number; onChange: (v: number) => void }> = ({ label, value, def, onChange }) => {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const at = (clientX: number): number => {
    const r = rail.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return value;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  useEffect(() => {
    const node = rail.current;
    if (!node) return undefined;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      onChange(Math.min(1, Math.max(0, value - Math.sign(e.deltaY) * 0.02)));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [value, onChange]);
  const pct = Math.round(value * 100);
  return (
    <div className="mm-look-row">
      <span className="mm-look-label">{label}</span>
      <div
        ref={rail}
        className="mm-look-fader"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus({ preventScroll: true });
          drag.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* rien */
          }
          onChange(at(e.clientX));
        }}
        onPointerMove={(e) => {
          if (drag.current === e.pointerId) onChange(at(e.clientX));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onDoubleClick={() => onChange(def)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.01;
          let v: number;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = value + step;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = value - step;
          else if (e.key === 'Home') v = 0;
          else if (e.key === 'End') v = 1;
          else if (e.key === 'Delete' || e.key === 'Backspace') v = def;
          else return;
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.min(1, Math.max(0, v)));
        }}
      >
        <span className="mm-look-rail" />
        <span className="mm-look-fill" style={{ width: `${value * 100}%` }} />
        <span className="mm-look-head" style={{ left: `${value * 100}%` }} />
      </div>
      <span className="mm-look-val">{pct}</span>
    </div>
  );
};

/** Le panneau : ses curseurs ; ferme au clic dehors (clic avale) et a Echap. */
const Panel: React.FC<{ style: React.CSSProperties; where: 'face' | 'hood'; anchor: React.RefObject<HTMLElement | null> }> = ({ style, where, anchor }) => {
  const v = useLook();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let swallow = false;
    const inside = (t: EventTarget | null): boolean => {
      const n = t instanceof Node ? t : null;
      return !!n && (!!box.current?.contains(n) || !!anchor.current?.contains(n));
    };
    const onDown = (e: PointerEvent): void => {
      if (inside(e.target)) return;
      // dehors : le panneau se ferme, et ce clic ne fait rien d'autre (ni potard, ni fermeture d'OPEN)
      e.preventDefault();
      e.stopImmediatePropagation();
      swallow = true;
      lookOpen.set(null);
    };
    const onClick = (e: MouseEvent): void => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (closed) window.removeEventListener('click', onClick, true);
    };
    let closed = false;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      lookOpen.set(null);
      anchor.current?.focus({ preventScroll: true });
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      // le clic du pointeur qui a ferme le panneau arrive apres : il est avale, puis l'ecoute part
      closed = true;
      if (swallow) window.setTimeout(() => window.removeEventListener('click', onClick, true), 1500);
      else window.removeEventListener('click', onClick, true);
    };
  }, [anchor]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={box} className="mm-look" data-where={where} style={style} role="dialog" aria-label="Settings">
      <div className="mm-look-title">
        SETTINGS
        <button type="button" className="mm-look-reset" title="Back to the starting values" onClick={() => look.set(LOOK_DEFAULTS)}>
          RESET
        </button>
      </div>
      <Fader label="LEATHER TEXTURE" value={v.leather} def={LOOK_DEFAULTS.leather} onChange={(x) => look.set({ leather: x })} />
      <Fader label="PANEL LIGHT" value={v.light} def={LOOK_DEFAULTS.light} onChange={(x) => look.set({ light: x })} />
    </div>
  );
};

/** L'icone : trois curseurs serigraphies. */
const Icon: React.FC = () => (
  <svg className="mm-look-icon" width="14" height="12" viewBox="0 0 14 12" aria-hidden="true">
    <path d="M1 2.5H13M1 6H13M1 9.5H13" />
    <rect x="3" y="1" width="2.4" height="3" rx="0.6" />
    <rect x="8.6" y="4.5" width="2.4" height="3" rx="0.6" />
    <rect x="5.2" y="8" width="2.4" height="3" rx="0.6" />
  </svg>
);

/* ---------------- sur la face ---------------- */

/** Le point de l'icone a l'ecran : a gauche de FIRMWARE, sur le panneau (projete par la camera). */
function iconPoint(stage: Stage): [number, number] | null {
  const rig = stage.voy;
  if (!rig || !VOY_HEAD.sub) return null;
  rig.panel.updateWorldMatrix(true, false);
  // FIRMWARE V.x / 2026 finit a sub.x (aligne a droite) et fait ~1.35 unite : l'icone 0.2 avant
  const p = new Vector3(VOY_HEAD.sub.x - 1.55, 0.004, VOY_HEAD.z);
  rig.panel.localToWorld(p);
  p.project(stage.camera);
  const rect = stage.renderer.domElement.getBoundingClientRect();
  return [rect.left + ((p.x + 1) / 2) * rect.width, rect.top + ((1 - p.y) / 2) * rect.height];
}

export const FaceLookButton: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const open = useOpen();
  const btn = useRef<HTMLButtonElement>(null);
  const [pt, setPt] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    if (!stage) return undefined;
    const on = (): void => setPt(iconPoint(stage));
    on();
    const t = window.setTimeout(on, 300);
    window.addEventListener('resize', on);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', on);
    };
  }, [stage]);
  useEffect(() => {
    if (hood !== 'closed' && open === 'face') lookOpen.set(null);
  }, [hood, open]);
  if (!stage || !pt || hood !== 'closed') return null;
  const k = window.innerWidth / 1100;
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="mm-look-btn"
        data-on={open === 'face' ? '1' : undefined}
        aria-label="Settings"
        aria-expanded={open === 'face'}
        title="Settings"
        style={{ position: 'fixed', left: pt[0] - 11 * k, top: pt[1] - 9 * k, width: 22 * k, height: 18 * k, ['--k' as string]: k }}
        onClick={() => lookOpen.set(open === 'face' ? null : 'face')}
      >
        <Icon />
      </button>
      {open === 'face' && (
        <Panel
          where="face"
          anchor={btn}
          style={{ position: 'fixed', left: pt[0] + 11 * k, top: pt[1] + 14 * k, transform: `translateX(-100%) scale(${k})`, transformOrigin: 'top right' }}
        />
      )}
    </>
  );
};

/* ---------------- dans l'en-tete d'OPEN ---------------- */

export const HoodLookButton: React.FC = () => {
  const open = useOpen();
  const hood = useHood();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (hood === 'closed' && open === 'hood') lookOpen.set(null);
  }, [hood, open]);
  return (
    <span className="mm-look-hood">
      <button
        ref={btn}
        type="button"
        className="mm-key mm-r-set"
        data-on={open === 'hood' ? '1' : undefined}
        aria-label="Settings"
        aria-expanded={open === 'hood'}
        title="Settings"
        onClick={() => lookOpen.set(open === 'hood' ? null : 'hood')}
      >
        <span className="mm-key-cap" aria-hidden="true">
          <Icon />
        </span>
      </button>
      {open === 'hood' && <Panel where="hood" anchor={btn} style={{ position: 'absolute', right: -6, top: 30 }} />}
    </span>
  );
};
