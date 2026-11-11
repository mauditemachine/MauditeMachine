/**
 * La face du plugin MM-ARP (2026-11-09, plugin/mm-arp) : la meme machine que le site (la scene three.js, ses pads
 * d'accords, ses potards, son grand ecran, RUN, EDIT et la suite, les presets), seule, vue de dessus, dans la fenetre du
 * VST3. Comme la face du MM-RYTM (plugin/PluginFace.tsx) : rien du site (en-tete, Dock, sections, autres machines, intro,
 * capot). Le son vient du plugin (plugin/arp/bridge.ts).
 *
 * Le format large (2026-11-11, Mika : "carre c'est pas bon, essaie de faire un peu plus en largeur ... je veux le
 * meilleur synthe de l'histoire, il doit etre magnifique") : une fenetre de 1440 x 810 (16 / 9, scale.ts : le plan), un
 * seul instrument entre deux joues de noyer :
 * - le bandeau du haut (Header.tsx) : le logotype, l'afficheur et les presets d'usine, la touche OPEN / CLOSE ;
 * - la machine 3D, a gauche, a l'echelle de sa fenetre d'avant (.mm-arp-stagebox la rogne de ses joues et de son en-tete ;
 *   la scene garde sa vue entiere de 1100 x 704, decalee dessous) ;
 * - le rack a droite (FrontModule.tsx Rack : OSC +, FILTER +, PHASER, FLANGER, PUMP, CRUSH, SPACE) ;
 * - le sequenceur par pas sous la machine (FrontModule.tsx StepStrip).
 * L'habillage (voyager/skin.ts) : simili noir, bandeaux de metal brosse, capuchons de metal ; ses tuiles passent au CSS
 * par des variables posees ici (--mm-leather, --mm-band, --mm-wood).
 *
 * OPEN (la touche de la machine, celle du bandeau, O) bascule toute la fenetre sur le panneau d'options (HoodPanel.tsx :
 * les TWEAKS, le son, LIBRARY, DISK, MIDI, CLIP) ; CLOSE, OPEN, O ou Echap reviennent. La scene 3D reste fermee dessous
 * (voyager/rig.ts), cachee et inerte le temps du panneau.
 * La fenetre se redimensionne : la scene suit seule (ses cotes sont en vw) ; les couches HTML vivent dans une couche de
 * UI_W px de large mise a l'echelle de la fenetre (.mm-arp-ui, scale.ts).
 */

import React, { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ErrorInfo } from 'react';
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
import { voyExplode } from '../../state/explode';
import { arp } from '../../voyager/arp';
import { skinUrl } from '../../voyager/skin';
import { arpBridge } from './bridge';
import { DiskNameDialog } from './DiskPresets';
import { Cheeks, Rack, StepStrip } from './FrontModule';
import { Header } from './Header';
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
  const boxRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const running = useSyncExternalStore(arp.subscribe, () => arp.get().running);
  const scale = useSyncExternalStore(uiScale.subscribe, uiScale.get, uiScale.get);
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const open = hood === 'opening' || hood === 'open';
  // Les tuiles de l'habillage (voyager/skin.ts), calculees une fois : les fonds des couches HTML (face.css)
  const skin = useMemo(() => ({ '--mm-leather': `url(${skinUrl('leather')})`, '--mm-band': `url(${skinUrl('band')})`, '--mm-wood': `url(${skinUrl('wood')})` }) as React.CSSProperties, []);

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

  // Le panneau d'OPEN couvre la machine : ses jumeaux (les potards et les touches de la scene) ne prennent plus le clavier
  useEffect(() => {
    boxRef.current?.toggleAttribute('inert', open);
  }, [open]);

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
      style={{ position: 'fixed', ...skin }}
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
      data-mm-open={open ? '1' : undefined}
    >
      {/* La machine 3D : sa vue entiere (1100 x 704 a l'echelle), rognee de ses joues et de son en-tete par la boite */}
      <div ref={boxRef} className="mm-arp-stagebox" style={{ position: 'absolute' }} aria-hidden={open ? true : undefined}>
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
      </div>
      <Boundary onError={onError}>
        <VoyInfosCard stage={stage} />
        {/* Les couches HTML, dessinees pour 1440 px de large et mises a l'echelle de la fenetre (scale.ts) */}
        <div className="mm-arp-ui" style={{ position: 'fixed', left: 0, top: 0, width: UI_W, height: `${100 / scale}vh`, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          {/* Les degrades des potards SVG, une fois */}
          <KnobDefs />
          <Cheeks />
          <Header stage={stage} />
          <Rack />
          <StepStrip />
          <HoodPanel />
          <PresetNameDialog mobile={false} />
          <DiskNameDialog />
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
