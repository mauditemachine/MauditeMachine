/**
 * Les sous-pages d'OPEN sur la face d'avant (2026-11-25, Mika : "reprend l'interface d'avant et complete la, bonifie la !
 * ajoute les sous menu ! ca doit etre une Octatrack croisee avec une Digitakt 2"). La face reste la machine (la scene 3D
 * DT2) ; OPEN (sa touche, la touche O, le MIDI) ouvre par-dessus, en plein ecran comme le MM-ARP, les sous-pages : SAMPLE,
 * SEQ, LFO, DISTO, CHORUS, DELAY, REVERB, HELL, MASTER, LIBRARY, MIDI, et le menu. CLOSE, × ou Echap : retour a la machine.
 * Le capot 3D ne s'ouvre plus dans le plugin (actions/nav.ts setOpenHook).
 */

import React, { Component, useEffect, useState, type ErrorInfo } from 'react';
import { setOpenHook } from '../../actions/nav';
import { presetMode } from '../../state/presetMode';
import { bridge } from '../bridge';
import { Chassis, useView } from './Chrome';
import { Menu } from './Menu';
import { OpenPage } from './Open';
import aluDarkUrl from './img/alu-dark.jpg';
import { view } from './view';
import './v3.css';

const W = 1400;
const H = 896;

class Boundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    bridge.log('open', `${error.message} ${info.componentStack?.split('\n')[1] ?? ''}`.trim());
  }
  render() {
    return this.state.failed ? <p className="mm3-error">OPEN : this page failed, CLOSE and try again</p> : this.props.children;
  }
}

/** Le zoom des pages (dessinees en 1400 x 896) a la fenetre, centrees. */
function useZoom(): { k: number; x: number; y: number } {
  const calc = () => {
    const k = Math.min(window.innerWidth / W, window.innerHeight / H);
    return { k, x: Math.max(0, (window.innerWidth - W * k) / 2), y: Math.max(0, (window.innerHeight - H * k) / 2) };
  };
  const [z, setZ] = useState(calc);
  useEffect(() => {
    const on = (): void => setZ(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return z;
}

export const OpenOverlay: React.FC = () => {
  const v = useView();
  const z = useZoom();
  useEffect(() => {
    setOpenHook(() => view.toggle());
    return () => setOpenHook(null);
  }, []);
  // O : les sous-pages (la derniere vue) ; Echap : le menu, puis la page se ferment (avant les raccourcis de la machine)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (presetMode.get().stage === 'name') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === 'o' || e.key === 'O') && !e.repeat) {
        e.preventDefault();
        e.stopImmediatePropagation();
        view.toggle();
        return;
      }
      if (e.key !== 'Escape' || (!view.get().page && !view.get().menu)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (view.get().menu) view.menu(false);
      else view.close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // La face B (lot 47) : le menu de son bandeau s'ouvre sur la face, sans page ; un clic ailleurs le ferme
  if (!v.page && v.menu)
    return (
      <div
        className="mm3-root mm3-overlay"
        style={{ zIndex: 60, background: 'transparent' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.stopPropagation();
          view.menu(false);
        }}
      >
        <div className="mm3-stage" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.k})` }}>
          <Boundary key="menu">
            <Menu />
          </Boundary>
        </div>
      </div>
    );
  if (!v.page) return null;
  return (
    <div
      className="mm3-root mm3-overlay"
      data-mm3-page={v.page}
      style={{ zIndex: 60, backgroundImage: `url(${aluDarkUrl})`, backgroundSize: 'cover' }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mm3-stage" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.k})` }} onPointerDown={() => v.menu && view.menu(false)}>
        <Chassis />
        <Boundary key={v.page}>
          <OpenPage page={v.page} />
        </Boundary>
        <Boundary key={v.menu ? 'menu' : 'no'}>{v.menu && <Menu />}</Boundary>
      </div>
    </div>
  );
};
