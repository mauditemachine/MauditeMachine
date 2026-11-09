/**
 * La face du plugin MM-ARP (2026-11-09, plugin/mm-arp) : la meme machine que le site (la scene three.js, ses pads
 * d'accords, ses potards, son grand ecran, RUN, EDIT et la suite, les presets), seule, vue de dessus, dans la fenetre du
 * VST3. Comme la face du MM-RYTM (plugin/PluginFace.tsx) : rien du site (en-tete, Dock, sections, autres machines, intro,
 * capot). Le son vient du plugin (plugin/arp/bridge.ts).
 *
 * Le capot ne s'ouvre pas : OPEN ouvre a la place, sous la machine, le tiroir des gros potards (ui/KnobPanel.tsx, toutes
 * les sections, les TWEAKS de la carte compris : ACCENT, DRIFT, STACK, GLUE, DLY TIME...). La machine remonte au-dessus
 * (Stage.setInset). A droite des potards, la colonne DISK (2026-11-09) : SAVE TO DISK, OPEN FROM DISK et la liste du dossier
 * des presets (DiskPresets.tsx).
 */

import React, { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ErrorInfo } from 'react';
import '../../v4.css';
import './face.css';
import { gesture } from '../../actions';
import { resume } from '../../audio/drums';
import { useKeys } from '../../hooks/useKeys';
import { Stage } from '../../scene/renderer';
import { appearance } from '../../state/appearance';
import { applyAppearance } from '../../theme';
import { HitLayer } from '../../ui/Hotspots';
import { KnobPanel } from '../../ui/KnobPanel';
import { PresetNameDialog } from '../../ui/PresetNameDialog';
import { VoyTwins } from '../../ui/VoyTwins';
import { VoyInfosCard } from '../../voyager/InfosCard';
import { arp } from '../../voyager/arp';
import { arpBridge } from './bridge';
import { DiskNameDialog, DiskPresets } from './DiskPresets';
import { arpDrawer } from './drawer';

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

/** La section ouverte la premiere fois : TWEAKS (ce qui n'est nulle part ailleurs sur la face). */
const TAB_KEY = 'mm.v4.knobtab.voy';

/** Le tiroir d'OPEN : les gros potards, la machine au-dessus. */
const Drawer: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const open = useSyncExternalStore(arpDrawer.subscribe, arpDrawer.get, arpDrawer.get);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(TAB_KEY) === null) window.localStorage.setItem(TAB_KEY, 'tweaks');
    } catch {
      /* rien de retenu : la premiere section */
    }
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!stage || !el || !open) return undefined;
    const apply = (): void => stage.setInset('voy', el.offsetHeight, 0);
    apply();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      stage.setInset('voy', 0);
    };
  }, [stage, open]);
  if (!open) return null;
  return (
    <section ref={ref} className="mm-arp-drawer" style={{ position: 'fixed' }} aria-label="MM-ARP knobs">
      <KnobPanel machine="voy" />
      <DiskPresets />
      <button type="button" className="mm-arp-drawer-close" aria-label="Close the knobs" onClick={() => arpDrawer.set(false)}>
        CLOSE
      </button>
    </section>
  );
};

const ArpFace: React.FC = () => {
  const stageRef = useRef<Stage | null>(null);
  const getStage = useCallback(() => stageRef.current, []);
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const running = useSyncExternalStore(arp.subscribe, () => arp.get().running);

  const onError = useCallback((m: string) => {
    setError(m);
    arpBridge.log('face', m);
  }, []);

  useLayoutEffect(() => {
    document.body.classList.add('v4-active');
    return () => document.body.classList.remove('v4-active');
  }, []);

  // Le premier geste cree le contexte audio du site (muet : FLAGS.mute ; le moteur du synthe ne se charge pas)
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

  useKeys(getStage, true);

  // La scene : le MM-ARP seul (state/focus.ts), sans intro, la camera fixe
  useEffect(() => {
    applyAppearance(look);
    const host = hostRef.current;
    const input = inputRef.current;
    if (!host || !input) return undefined;
    const built = Stage.create({
      noIntro: true,
      host,
      input,
      mobile: false,
      dev: import.meta.env.DEV,
      onError: (where, message) => onError(`${where}: ${message}`),
      onContextLost: () => onError('webgl: contexte perdu'),
      onContextRestored: () => setError(null),
    });
    if (!built) {
      onError('webgl: la scene ne se construit pas');
      return undefined;
    }
    built.orbit.lock = () => true;
    stageRef.current = built;
    setStage(built);
    return () => {
      stageRef.current = null;
      setStage(null);
      built.dispose();
    };
  }, [look, onError]);

  return (
    <div
      className="v4-root mm-plugin mm-plugin-arp"
      style={{ position: 'fixed' }}
      data-v4-state={running ? 'running' : 'idle'}
      data-v4-gl={error ? 'fallback' : 'webgl'}
      data-v4-layout="desktop"
      data-v4-motion="full"
      data-v4-muted="1"
      data-v4-intro="0"
      data-v4-running={running ? '1' : '0'}
      data-v4-theme={look}
      data-v4-focus="voy"
      data-mm-plugin="arp"
    >
      <div ref={inputRef} className="v4-stage">
        <Boundary onError={onError}>
          <div ref={hostRef} className="v4-canvas-host" aria-hidden="true" />
        </Boundary>
        <Boundary onError={onError}>
          <HitLayer getStage={getStage} stage={stage} />
          <section id="v4-controls" aria-label="MM-ARP controls">
            <VoyTwins stage={stage} />
          </section>
        </Boundary>
      </div>
      <Boundary onError={onError}>
        <VoyInfosCard stage={stage} />
        <PresetNameDialog mobile={false} />
        <DiskNameDialog />
        <Drawer stage={stage} />
      </Boundary>
      {error && (
        <p className="mm-plugin-error" role="alert">
          MM-ARP : {error}
        </p>
      )}
    </div>
  );
};

export default ArpFace;
