/**
 * La face du plugin MM-ARP (2026-11-09, plugin/mm-arp) : la meme machine que le site (la scene three.js, ses pads
 * d'accords, ses potards, son grand ecran, RUN, EDIT et la suite, les presets), seule, vue de dessus, dans la fenetre du
 * VST3. Comme la face du MM-RYTM (plugin/PluginFace.tsx) : rien du site (en-tete, Dock, sections, autres machines, intro,
 * capot). Le son vient du plugin (plugin/arp/bridge.ts).
 *
 * OPEN ouvre le vrai capot du site (2026-11-09, Mika : "quand je clique sur OPEN je dois voir l'interieur, le circuit
 * imprime, comme avant") : la carte et ses TWEAKS jouables, cadres au-dessus du panneau du capot (HoodPanel.tsx : DRAG MIDI,
 * DISK, MIDI LEARN, CLOSE). OPEN, CLOSE, Echap ou O le referment, comme au site.
 * SOUND+ (2026-11-10, SoundPlus.tsx) : les reglages du VST3 seul, une page du panneau du capot. La face fermee reste
 * exactement celle du site (Mika : "je veux que tout se retrouve dans OPEN", la pastille SOUND+ de la face est retiree).
 * La fenetre se redimensionne (2026-11-11) : la scene suit seule ; le panneau du capot, les dialogues et la pastille
 * MIDI LEARN vivent dans une couche de UI_W px de large mise a l'echelle de la fenetre (.mm-arp-ui, scale.ts).
 * Le module avant (2026-11-11, FrontModule.tsx) : la fenetre passe a 1100 x 880 ; la scene garde le haut (64 % de la
 * largeur, face.css .v4-stage), le module d'extension toujours visible (STEP SEQUENCER, OSC / FILTER +, FX RACK) prend
 * le bas, dans la meme couche a l'echelle.
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
import { PresetNameDialog } from '../../ui/PresetNameDialog';
import { VoyTwins } from '../../ui/VoyTwins';
import { VoyInfosCard } from '../../voyager/InfosCard';
import { arp } from '../../voyager/arp';
import { arpBridge } from './bridge';
import { DiskNameDialog } from './DiskPresets';
import { FrontModule } from './FrontModule';
import { HoodPanel, LearnMarks } from './HoodPanel';
import { UI_W, uiScale } from './scale';
import { KnobDefs } from './SoundPlus';

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

const ArpFace: React.FC = () => {
  const stageRef = useRef<Stage | null>(null);
  const getStage = useCallback(() => stageRef.current, []);
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const running = useSyncExternalStore(arp.subscribe, () => arp.get().running);
  const scale = useSyncExternalStore(uiScale.subscribe, uiScale.get, uiScale.get);

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
        {/* Les couches HTML, dessinees pour 1100 px de large et mises a l'echelle de la fenetre (scale.ts) */}
        <div className="mm-arp-ui" style={{ position: 'fixed', left: 0, top: 0, width: UI_W, height: `${100 / scale}vh`, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          {/* Les degrades des potards SVG (SOUND+, le module avant), une fois */}
          <KnobDefs />
          <FrontModule />
          <PresetNameDialog mobile={false} />
          <DiskNameDialog />
          <HoodPanel stage={stage} />
          <LearnMarks />
        </div>
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
