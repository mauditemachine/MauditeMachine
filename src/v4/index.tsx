/**
 * /v4 : MM-808, la machine isometrique de Maudite Machine. Montee hors
 * Layout comme /v2 et /v3 (chunk lazy, hors sitemap). La scene (revision
 * 2 : la boite a rythmes noire en coin facon Elektron, ecran OLED, six
 * encodeurs, 12 pads, 16 touches trig, sol et ombres ; la camera orbite,
 * bouton RESET VIEW et data-v4-view), le
 * son (audio/drums.ts, contexte cree au premier geste seulement), le motif
 * (audio/pattern.ts), l'horloge (audio/clock.ts), la couche de saisie
 * (ui/Hotspots.tsx), le Dock du telephone (ui/Dock.tsx), les sections
 * (ui/Panel.tsx : panneau desktop et sa trace, feuille mobile), le moteur
 * SoundCloud de la v2 et son pont (engine.ts, audio/soundcloud.ts),
 * l'etat de l'ecran (state/lcd.ts) et son jumeau accessible (ui/Lcd.tsx),
 * OPEN et la vue eclatee (state/explode.ts), les jumeaux HTML de tous les
 * objets et le clavier (ui/Hotspots.tsx, hooks/useKeys.ts), l'intro
 * (state/intro.ts), le chrome de page (titre, theme-color, body.v4-active ;
 * pas de noindex : le brief veut le panneau indexable, /v4 reste seulement
 * hors sitemap), le repli sans WebGL (fallback/NoWebGL.tsx) et le contrat
 * debug. Tout est rendu tel quel au demontage.
 */

import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
} from 'react';
import './v4.css';
import { gesture } from './actions';
import { clock } from './audio/clock';
import { quiet, resume, suspend } from './audio/drums';
import { pattern } from './audio/pattern';
import { sc } from './audio/soundcloud';
import { installDebug, type DebugState } from './debug';
import { EngineBridge, EngineProvider } from './engine';
import NoWebGL from './fallback/NoWebGL';
import { useKeys } from './hooks/useKeys';
import { useMedia } from './hooks/useMedia';
import { Stage } from './scene/renderer';
import { explode } from './state/explode';
import { FLAGS, syncFlags } from './state/flags';
import { intro } from './state/intro';
import { lcd } from './state/lcd';
import { presskit } from './state/presskit';
import { useReducedMotion } from './state/motion';
import { section } from './state/section';
import { view } from './state/view';
import { COARSE_QUERY, COPY, HEX, MOBILE_QUERY, PRESSKIT_ROUTE } from './theme';
import { Dock } from './ui/Dock';
import { Header } from './ui/Header';
import { HitLayer, Twins } from './ui/Hotspots';
import { Lcd } from './ui/Lcd';
import { Panel } from './ui/Panel';
import { ResetView } from './ui/ResetView';
import { Trace } from './ui/Trace';

const IS_DEV = import.meta.env.DEV;

/**
 * La visionneuse du press kit (2026-10-01) : son propre chunk, charge a
 * l'ouverture seulement ; l'accueil n'en telecharge aucun octet.
 */
const PresskitViewer = lazy(() => import('./ui/PresskitViewer'));

/** /presskit, avec ou sans barre finale : la machine, et le press kit par-dessus. */
const onPresskitRoute = (): boolean => typeof window !== 'undefined' && PRESSKIT_ROUTE.re.test(window.location.pathname);

/**
 * Visionneuse et ligne d'apres fermeture (2026-10-01). Arrivee par
 * /presskit : la visionneuse s'ouvre en fondu 250 ms apres le montage.
 * Pendant qu'elle est ouverte, la machine continue derriere, a 20 images
 * par seconde au plus. A la premiere fermeture (arrivee par /presskit),
 * une ligne discrete, 5 s : "Press kit closed. Reopen from the PRESS
 * button."
 */
const PresskitHost: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const open = useSyncExternalStore(presskit.subscribe, presskit.get, presskit.get);
  const hint = useSyncExternalStore(presskit.subscribe, presskit.hint, presskit.hint);
  useEffect(() => {
    if (!onPresskitRoute()) return undefined;
    const t = window.setTimeout(() => presskit.open('route'), PRESSKIT_ROUTE.delayMs);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    getStage()?.setFrameCap(open ? PRESSKIT_ROUTE.frameCapMs : 0);
  }, [open, getStage]);
  useEffect(() => {
    if (!hint) return undefined;
    const t = window.setTimeout(() => presskit.dismissHint(), PRESSKIT_ROUTE.hintMs);
    return () => window.clearTimeout(t);
  }, [hint]);
  return (
    <>
      {open && (
        <Suspense fallback={null}>
          <PresskitViewer />
        </Suspense>
      )}
      {hint && (
        <p className="v4-kit-hint" role="status">
          Press kit closed. Reopen from the PRESS button.
        </p>
      )}
    </>
  );
};

const devLog = (where: string, message: string): void => {
  if (!IS_DEV) return;
  // console.table passe le filtre de console d'index.html
  console.table([{ where, message }]);
};

interface BoundaryProps {
  onError: (where: string, message: string) => void;
  children: React.ReactNode;
}

/**
 * Une erreur de rendu dans la scene ou dans ses commandes HTML (jumeaux,
 * Dock, panneau...) donne la page de repli, jamais un ecran vide.
 */
class StageBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError('stage', `${error.message} ${info.componentStack?.split('\n')[1] ?? ''}`.trim());
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Son (spec 8.3) : le premier pointerdown ou keydown de la page cree le
 * contexte audio, tout geste le relance s'il dort. pointerup et touchend
 * aussi : sur iOS et Android un doigt n'active l'audio qu'au relachement,
 * le premier coup (programme au pointerdown) part alors. Le premier geste
 * termine aussi l'intro (spec 7.4). Le motif d'arrivee est charge mais ne
 * joue pas tout seul (2026-10-01) : seul RUN le lance.
 * Demontage : la lecture s'arrete, la
 * queue de reverbe est jetee (quiet), le contexte dort, le motif en
 * attente est ecrit.
 */
function useAudioGestures(getStage: () => Stage | null): void {
  useEffect(() => {
    const onGesture = (): void => {
      getStage()?.finishIntro();
      gesture();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('keydown', onGesture, opts);
    window.addEventListener('pointerup', resume, opts);
    window.addEventListener('touchend', resume, opts);
    return () => {
      window.removeEventListener('pointerdown', onGesture, opts);
      window.removeEventListener('keydown', onGesture, opts);
      window.removeEventListener('pointerup', resume, opts);
      window.removeEventListener('touchend', resume, opts);
      clock.stop();
      quiet();
      suspend();
      pattern.flush();
    };
  }, [getStage]);
}

/**
 * Titre, theme-color et classe du body : poses avant la peinture, rendus au
 * demontage. Le robots de la page reste celui d'index.html (index, follow) :
 * le brief veut le panneau "indexable" ; /v4 n'est que hors sitemap.
 */
function usePageChrome(): void {
  useLayoutEffect(() => {
    document.body.classList.add('v4-active');
    const prevTitle = document.title;
    document.title = onPresskitRoute() ? PRESSKIT_ROUTE.title : COPY.title;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = theme?.getAttribute('content') ?? null;
    let madeTheme: HTMLMetaElement | null = null;
    if (theme) theme.setAttribute('content', HEX.ink);
    else {
      madeTheme = document.createElement('meta');
      madeTheme.name = 'theme-color';
      madeTheme.content = HEX.ink;
      document.head.appendChild(madeTheme);
    }
    return () => {
      document.body.classList.remove('v4-active');
      document.title = prevTitle;
      if (theme && prevTheme !== null) theme.setAttribute('content', prevTheme);
      madeTheme?.remove();
    };
  }, []);
}

/**
 * Sections, ecran, vue eclatee : l'etat de l'ecran se compose tant que /v4
 * est monte ; au demontage la section se referme et la machine aussi (un
 * retour sur /v4 repart ferme).
 */
function useSectionsLifecycle(): void {
  useEffect(() => {
    lcd.start();
    return () => {
      lcd.stop();
      section.set(null);
      explode.reset();
    };
  }, []);
}

const V4Shell: React.FC = () => {
  const stageRef = useRef<Stage | null>(null);
  const getStage = useCallback(() => stageRef.current, []);
  const [gl, setGl] = useState<'webgl' | 'fallback'>(() => (FLAGS.nowebgl ? 'fallback' : 'webgl'));
  usePageChrome();
  useAudioGestures(getStage);
  useSectionsLifecycle();
  // Sans machine (repli), les raccourcis de la machine se taisent
  useKeys(getStage, gl === 'webgl');
  const reduced = useReducedMotion();
  const mobile = useMedia(MOBILE_QUERY);
  const instrument = useSyncExternalStore(pattern.subscribe, () => pattern.get().instrument);
  const bpm = useSyncExternalStore(pattern.subscribe, () => pattern.get().bpm);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running);
  const openSection = useSyncExternalStore(section.subscribe, section.get, section.get);
  const scStatus = useSyncExternalStore(sc.subscribe, () => sc.get().status);
  const exploded = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const viewMoved = useSyncExternalStore(view.subscribe, view.get, view.get);

  const hostRef = useRef<HTMLDivElement>(null);
  const stageElRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [devErrors, setDevErrors] = useState<string[]>([]);
  /**
   * Frame ou rendu React en echec : definitif, le Stage et son contexte GL
   * sont liberes. Une perte de contexte garde le Stage (il peut revenir),
   * un echec de creation n'a rien a liberer (et un second montage StrictMode
   * doit pouvoir reussir).
   */
  const [glFailed, setGlFailed] = useState(false);

  const onError = useCallback((where: string, message: string) => {
    devLog(where, message);
    if (IS_DEV) setDevErrors((e) => [...e.slice(-4), `${where}: ${message}`]);
    // Creation, frame ou rendu React en echec : la page continue sans WebGL
    if (where === 'create' || where === 'frame' || where === 'stage') setGl('fallback');
    if (where === 'frame' || where === 'stage') setGlFailed(true);
  }, []);

  /* ---------- la scene ---------- */
  useEffect(() => {
    if (FLAGS.nowebgl || glFailed) return undefined;
    const host = hostRef.current;
    const input = stageElRef.current;
    if (!host || !input) return undefined;
    const stage = Stage.create({
      host,
      input,
      // Palier de qualite par classe d'appareil, pas par largeur : un
      // telephone en paysage (844 px) ou une tablette reste au palier mobile
      // (budget de 16 draw calls, DPR 1.5) ; le cadrage suit la mise en page
      mobile: window.matchMedia(MOBILE_QUERY).matches || window.matchMedia(COARSE_QUERY).matches,
      dev: IS_DEV,
      onError,
      onContextLost: () => {
        // Aucun pas en attente ne doit partir avant l'affichage du repli
        clock.stop();
        setGl('fallback');
      },
      onContextRestored: () => setGl('webgl'),
      // Onglet cache ou canvas hors ecran : le son dort avec le rendu
      onVisibility: (visible) => (visible ? resume() : suspend()),
    });
    if (!stage) {
      setGl('fallback');
      return undefined;
    }
    stageRef.current = stage;
    setStage(stage);
    // Un premier montage en echec (StrictMode, contexte sature) ne fige pas le repli
    setGl('webgl');
    return () => {
      stageRef.current = null;
      setStage(null);
      stage.dispose();
    };
  }, [onError, glFailed]);

  /*
   * Repli affiche (perte de contexte, erreur) : la page n'a plus de RUN/STOP
   * ni d'Espace ; la boite a rythmes s'arrete et RUN est refuse jusqu'au
   * retour du WebGL, sinon le prochain geste relancerait le contexte audio et
   * une boucle impossible a arreter.
   */
  useEffect(() => {
    clock.lock(gl === 'fallback');
    return () => clock.lock(false);
  }, [gl]);

  /* ---------- contrat debug (?debug=1) ---------- */
  const debugState = useRef<DebugState>({ layout: 'desktop', motion: 'full', gl: 'webgl', intro: 'done' });
  debugState.current = {
    layout: mobile ? 'mobile' : 'desktop',
    motion: reduced ? 'reduced' : 'full',
    gl,
    intro: introState,
  };
  useEffect(() => {
    if (!FLAGS.debug) return undefined;
    return installDebug({ stage: () => stageRef.current, state: () => debugState.current });
  }, []);

  return (
    <div
      className="v4-root"
      style={{ position: 'fixed' }}
      data-v4-state={gl === 'fallback' ? 'nogl' : running ? 'running' : instrument ? 'selected' : 'idle'}
      data-v4-gl={gl}
      data-v4-layout={mobile ? 'mobile' : 'desktop'}
      data-v4-motion={reduced ? 'reduced' : 'full'}
      data-v4-muted={FLAGS.mute ? '1' : '0'}
      data-v4-intro={gl === 'webgl' && introState === 'pending' ? '1' : '0'}
      data-v4-instrument={instrument ?? ''}
      data-v4-bpm={bpm}
      data-v4-running={running ? '1' : '0'}
      data-v4-section={openSection ?? ''}
      data-v4-sc={scStatus}
      data-v4-exploded={exploded}
      data-v4-view={viewMoved ? 'moved' : 'default'}
    >
      {gl === 'webgl' && (
        <h1 className="v4-sr">
          {COPY.wordmark} {COPY.model}
        </h1>
      )}
      <div ref={stageElRef} className="v4-stage">
        <StageBoundary onError={onError}>
          <div ref={hostRef} className="v4-canvas-host" aria-hidden="true" />
        </StageBoundary>
        {gl === 'webgl' && (
          <StageBoundary onError={onError}>
            <HitLayer getStage={getStage} stage={stage} />
            <Twins stage={stage} />
          </StageBoundary>
        )}
      </div>
      {gl === 'webgl' && (
        <StageBoundary onError={onError}>
          {/* Hors de .v4-stage : ses pointeurs n'atteignent jamais l'orbite */}
          <ResetView getStage={getStage} />
          <Lcd />
          {/* Le Dock n'existe que sur la mise en page mobile : pas de rendu React par pas sur desktop */}
          {mobile && <Dock getStage={getStage} />}
          {/* L'en-tete fin (logo et menu) n'existe que sur desktop */}
          {!mobile && <Header getStage={getStage} />}
          <Trace stage={stage} panelRef={panelRef} mobile={mobile} />
          <Panel mobile={mobile} panelRef={panelRef} />
        </StageBoundary>
      )}
      <PresskitHost getStage={getStage} />
      {gl === 'fallback' && <NoWebGL />}
      {IS_DEV && devErrors.length > 0 && (
        <ul className="v4-devlog" aria-hidden="true">
          {devErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Le moteur SoundCloud de la v2 enveloppe tout (comme /v3) ; seul
 * EngineBridge le consomme, le reste lit le pont (audio/soundcloud.ts) :
 * aucun re-render de la page a chaque progression du widget.
 */
const V4App: React.FC = () => {
  // Drapeaux relus a chaque montage (navigation SPA comprise)
  useMemo(() => syncFlags(), []);
  return (
    <EngineProvider>
      <EngineBridge />
      <V4Shell />
    </EngineProvider>
  );
};

export default V4App;
