/**
 * La face du plugin MM-RYTM (2026-11-08, Mika : "lance la WebView avec ma vraie face", plugin/mm-rytm) : la meme machine
 * que le site (la scene three.js, ses touches, ses potards, son ecran, son clavier), seule, vue de dessus, dans la
 * fenetre du VST3. Tout ce qui est du site reste dehors (en-tete, Dock, sections, press kit, SoundCloud, autres
 * machines, intro). Le son du navigateur est coupe : il vient du plugin (plugin/bridge.ts).
 *
 * Monte comme src/v4/index.tsx (V4Shell), en plus court : la racine .v4-root > .v4-stage > .v4-canvas-host, la couche
 * de saisie (HitLayer), les jumeaux (Twins), l'ecran accessible (Lcd), le dialogue des noms de presets.
 */

import React, { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ErrorInfo } from 'react';
import '../v4.css';
import { gesture } from '../actions';
import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import { resume } from '../audio/drums';
import { shots } from '../audio/shots';
import { useKeys } from '../hooks/useKeys';
import { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { boot } from '../state/boot';
import { lcd } from '../state/lcd';
import { applyAppearance } from '../theme';
import { HitLayer, Twins } from '../ui/Hotspots';
import { Lcd } from '../ui/Lcd';
import { PresetNameDialog } from '../ui/PresetNameDialog';
import { bridge } from './bridge';

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

const PluginFace: React.FC = () => {
  const stageRef = useRef<Stage | null>(null);
  const getStage = useCallback(() => stageRef.current, []);
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running);
  const instrument = useSyncExternalStore(pattern.subscribe, () => pattern.get().instrument);

  const onError = useCallback((m: string) => {
    setError(m);
    bridge.log('face', m);
  }, []);

  // La classe du body (v4.css la lit) ; le reste du chrome du site n'existe pas ici
  useLayoutEffect(() => {
    document.body.classList.add('v4-active');
    return () => document.body.classList.remove('v4-active');
  }, []);

  // Le premier geste cree le contexte audio du site (muet : FLAGS.mute) ; ses horloges et l'ecran en dependent
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

  // L'ecran de la machine se compose tant que la face est montee
  useEffect(() => {
    lcd.start();
    return () => lcd.stop();
  }, []);

  useEffect(() => boot.onReady(() => shots.prewarm()), []);
  useKeys(getStage, true);

  // La scene : la MM-RYTM seule (VOYAGER faux en plugin), sans intro, la camera fixe
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
    // Jamais d'orbite, de zoom ni de glisse de camera : un geste sur la face ne la deplace pas
    built.orbit.lock = () => true;
    stageRef.current = built;
    setStage(built);
    bridge.attachStage(built);
    return () => {
      bridge.attachStage(null);
      stageRef.current = null;
      setStage(null);
      built.dispose();
    };
  }, [look, onError]);

  return (
    <div
      className="v4-root mm-plugin"
      style={{ position: 'fixed' }}
      data-v4-state={running ? 'running' : instrument ? 'selected' : 'idle'}
      data-v4-gl={error ? 'fallback' : 'webgl'}
      data-v4-layout="desktop"
      data-v4-motion="full"
      data-v4-muted="1"
      data-v4-intro="0"
      data-v4-running={running ? '1' : '0'}
      data-v4-theme={look}
      data-v4-focus="mm808"
      data-mm-plugin="1"
    >
      <div ref={inputRef} className="v4-stage">
        <Boundary onError={onError}>
          <div ref={hostRef} className="v4-canvas-host" aria-hidden="true" />
        </Boundary>
        <Boundary onError={onError}>
          <HitLayer getStage={getStage} stage={stage} />
          <section id="v4-controls" aria-label="MM-RYTM controls">
            <Twins stage={stage} />
          </section>
        </Boundary>
      </div>
      <Boundary onError={onError}>
        <Lcd />
        <PresetNameDialog mobile={false} />
      </Boundary>
      {error && (
        <p className="mm-plugin-error" role="alert">
          MM-RYTM : {error}
        </p>
      )}
    </div>
  );
};

export default PluginFace;
