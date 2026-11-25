/**
 * La face v3 du plugin MM-RYTM (2026-11-25) : la racine. La scene (1400 x 896, la taille de depart de la fenetre) zoomee a la
 * fenetre ; la face, ou une page d'OPEN par-dessus ; le menu ; le dialogue du nom d'un preset et le menu des conditions d'un
 * pas (ceux de la face d'avant) ; les raccourcis du clavier (hooks/useKeys.ts, comme avant ; O et Echap : l'OPEN).
 * Le son ne vient jamais d'ici : le moteur C++ (plugin/bridge.ts).
 */

import React, { Component, useEffect, useLayoutEffect, useState, type ErrorInfo } from 'react';
import { gesture, trackSelect } from '../../actions';
import { activeTrack } from '../../state/trk';
import { resume } from '../../audio/drums';
import { shots } from '../../audio/shots';
import { useKeys } from '../../hooks/useKeys';
import { boot } from '../../state/boot';
import { presetMode } from '../../state/presetMode';
import type { Stage } from '../../scene/renderer';
import { bridge } from '../bridge';
import { NameDialog } from '../NameDialog';
import { StepMenu } from '../StepMenu';
import { Chassis, useView } from './Chrome';
import { Face } from './Face';
import { Menu } from './Menu';
import { OpenPage } from './Open';
import { attachHood, view } from './view';
import './v3.css';

export const W = 1400;
export const H = 896;

class Boundary extends Component<{ children: React.ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(`${error.message} ${info.componentStack?.split('\n')[1] ?? ''}`.trim());
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Le zoom de la scene : la fenetre entiere (le plugin garde le rapport 1400 x 896 ; ailleurs, centree). */
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

/** Le dialogue du nom d'un preset se pose sur l'ecran de la face (la face d'avant lui donnait celui de la scene 3D). */
const SCREEN_STAGE = {
  screenRect: () => {
    const el = document.querySelector('.mm3-screen') ?? document.querySelector('.mm3-stage');
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  },
} as unknown as Stage;

export const V3Root: React.FC = () => {
  const z = useZoom();
  const v = useView();
  const [error, setError] = useState<string | null>(null);
  const onError = (m: string): void => {
    setError(m);
    bridge.log('face', m);
  };

  useLayoutEffect(() => {
    document.body.classList.add('v4-active', 'mm3-body');
    return () => document.body.classList.remove('v4-active', 'mm3-body');
  }, []);
  // Le premier geste cree le contexte audio du site (muet) ; ses horloges en dependent
  useEffect(() => {
    const opts = { capture: true, passive: true } as const;
    const onGesture = (): void => gesture();
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('keydown', onGesture, opts);
    window.addEventListener('pointerup', resume, opts);
    return () => {
      window.removeEventListener('pointerdown', onGesture, opts);
      window.removeEventListener('keydown', onGesture, opts);
      window.removeEventListener('pointerup', resume, opts);
    };
  }, []);
  useEffect(() => boot.onReady(() => shots.prewarm()), []);
  useEffect(() => attachHood(), []);
  // Une piste toujours choisie : les knobs, les pas et le P-LOCK lisent la piste active
  useEffect(() => {
    if (activeTrack.get() === null) trackSelect('BD');
  }, []);
  // O : l'OPEN (la derniere page) ; Echap : le menu, puis l'OPEN se ferment (avant les raccourcis de la face)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (presetMode.get().stage === 'name') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && (view.get().menu || view.get().page)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (view.get().menu) view.menu(false);
        else view.close();
        return;
      }
      if ((e.key === 'o' || e.key === 'O') && !e.repeat) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (view.get().page) view.close();
        else view.open(view.get().last);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  useKeys(() => null, true);

  return (
    <div className="mm3-root" data-mm-plugin="1" data-mm3-page={v.page ?? 'face'} onContextMenu={(e) => e.preventDefault()}>
      <div className="mm3-stage" style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.k})` }} onPointerDown={() => v.menu && view.menu(false)}>
        <Chassis />
        <Boundary key={v.page ?? 'face'} onError={onError}>{v.page ? <OpenPage page={v.page} /> : <Face />}</Boundary>
        <Boundary key={v.menu ? 'menu' : 'no'} onError={onError}>{v.menu && <Menu />}</Boundary>
      </div>
      <Boundary onError={onError}>
        <NameDialog stage={SCREEN_STAGE} />
        <StepMenu />
      </Boundary>
      {error && (
        <p className="mm3-error" style={{ position: 'fixed' }} role="alert">
          MM-RYTM : {error}
        </p>
      )}
    </div>
  );
};
