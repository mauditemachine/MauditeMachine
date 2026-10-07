/**
 * Une petite touche posee sur une machine (2026-10-05) : la touche SCOPE sur
 * la plaque TWEAKS du MM-ARP ouvert (ui/Scope.tsx), CLOSE dans la machine
 * ouverte (ui/HoodClose.tsx). Un element du DOM, place a chaque image sur un
 * point de la scene (un calque de la machine, son repere) et a la taille de
 * sa place : il suit la camera, le zoom et l'ouverture du capot.
 */

import React, { useEffect, useRef } from 'react';
import type { Object3D } from 'three';
import type { Stage } from '../scene/renderer';

/** Sa place, dans le repere du calque : centre, largeur (x), profondeur (z), hauteur au-dessus (y). */
export interface KeySpot {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
}

interface Props {
  getStage: () => Stage | null;
  /** le calque de la machine qui porte la touche (null : pas encore la) */
  layer: (stage: Stage) => Object3D | null | undefined;
  spot: KeySpot;
  className: string;
  label: string;
  pressed?: boolean;
  /** une touche qui ouvre un document : un lien (nouvel onglet) */
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

/** La plus petite touche lisible (px). */
const MIN_W = 44;
const MIN_H = 14;

export const MachineKey: React.FC<Props> = ({ getStage, layer, spot, className, label, pressed, href, onClick, children }) => {
  const ref = useRef<HTMLElement | null>(null);
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const spotRef = useRef(spot);
  spotRef.current = spot;

  useEffect(() => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 0 };
    const d = { x: 0, y: 0 };
    let raf = 0;
    let last = '';
    const place = (): void => {
      raf = requestAnimationFrame(place);
      const el = ref.current;
      const st = getStage();
      const ly = st ? layerRef.current(st) : null;
      if (!el || !st || !ly) return;
      const K = spotRef.current;
      st.hit.project(ly, K.x - K.w / 2, K.y, K.z, a);
      st.hit.project(ly, K.x + K.w / 2, K.y, K.z, b);
      st.hit.project(ly, K.x, K.y, K.z - K.d / 2, c);
      st.hit.project(ly, K.x, K.y, K.z + K.d / 2, d);
      // Le canvas peut ne pas commencer au coin de la page
      const cr = st.renderer.domElement.getBoundingClientRect();
      const pr = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const w = Math.max(MIN_W, Math.hypot(b.x - a.x, b.y - a.y));
      const h = Math.max(MIN_H, Math.hypot(d.x - c.x, d.y - c.y));
      const x = Math.round((a.x + b.x) / 2 + cr.left - pr.left - w / 2);
      const y = Math.round((c.y + d.y) / 2 + cr.top - pr.top - h / 2);
      const key = `${x}|${y}|${Math.round(w)}|${Math.round(h)}`;
      if (key === last) return;
      last = key;
      el.style.width = `${Math.round(w)}px`;
      el.style.height = `${Math.round(h)}px`;
      el.style.fontSize = `${Math.max(8, Math.min(14, h * 0.42)).toFixed(1)}px`;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.visibility = 'visible';
    };
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [getStage]);

  const common = { className: `v4-mkey ${className}`, 'aria-label': label, style: { visibility: 'hidden' as const } };
  if (href) {
    return (
      <a
        ref={(el) => {
          ref.current = el;
        }}
        {...common} href={href} target="_blank" rel="noopener">
        {children}
      </a>
    );
  }
  return (
    <button
      ref={(el) => {
        ref.current = el;
      }}
      type="button" {...common} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
};

export default MachineKey;
