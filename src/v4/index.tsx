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
import { attachStage } from './midi/targets';
import { gesture } from './actions';
import { clock } from './audio/clock';
import { reserve } from './audio/sched';
import { anyPlaying } from './state/playLock';
import { quiet, resume, suspend } from './audio/drums';
import { pattern } from './audio/pattern';
import { shots } from './audio/shots';
import { sc } from './audio/soundcloud';
import { installDebug, type DebugState } from './debug';
import { EngineBridge, EngineProvider } from './engine';
import NoWebGL from './fallback/NoWebGL';
import { useKeys } from './hooks/useKeys';
import { useMedia } from './hooks/useMedia';
import { Stage } from './scene/renderer';
import { editor } from './state/editor';
import { bassExplode, explode, voyExplode } from './state/explode';
import { bassInfos } from './state/bassInfos';
import { voyInfos } from './state/voyInfos';
import { BassInfosKey } from './ui/BassInfosKey';
import { BASS, DJ, focus, VOYAGER } from './state/focus';
import { FLAGS, syncFlags } from './state/flags';
import { intro } from './state/intro';
import { lcd } from './state/lcd';
import { appearance } from './state/appearance';
import { djDecks } from './dj/theme';
import { presskit } from './state/presskit';
import { useReducedMotion } from './state/motion';
import { section } from './state/section';
import { HOOD_SECTIONS, SECTION_ROUTES, sectionFromPath, sectionTitle } from './state/sectionRoute';
import { view } from './state/view';
import { BACKDROP, COARSE_QUERY, COPY, MOBILE_QUERY, PORTRAIT, PRESSKIT_ROUTE, applyAppearance } from './theme';
import { BeatPanel } from './ui/BeatEditor';
import { InstallPrompt } from './ui/InstallPrompt';
import { MobileHeader } from './ui/MobileHeader';
import { PcbClose } from './ui/PcbClose';
import { HoodClose } from './ui/HoodClose';
import { Scope } from './ui/Scope';
import { Dock } from './ui/Dock';
import { Header, openHood } from './ui/Header';
import { HitLayer, Twins } from './ui/Hotspots';
import { MachineNav } from './ui/MachineNav';
import { SeqPanel } from './ui/SeqLane';
import { VoyDock } from './ui/VoyDock';
import { VoyTwins } from './ui/VoyTwins';
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
    // Une adresse de section ou de morceau garde le titre de sa page statique (referencement)
    if (!sectionFromPath(window.location.pathname)) document.title = onPresskitRoute() ? PRESSKIT_ROUTE.title : COPY.title;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = theme?.getAttribute('content') ?? null;
    let madeTheme: HTMLMetaElement | null = null;
    if (theme) theme.setAttribute('content', BACKDROP.page);
    else {
      madeTheme = document.createElement('meta');
      madeTheme.name = 'theme-color';
      madeTheme.content = BACKDROP.page;
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
      voyExplode.reset();
      bassExplode.reset();
      bassInfos.set(false);
      voyInfos.set(false);
    };
  }, []);
}

/**
 * Adresses des sections (2026-10-02, state/sectionRoute.ts). Arrivee par
 * /shows/ (etc.) : la section s'ouvre une fois l'intro finie (les puces du
 * PCB ouvrent d'abord la machine). Ensuite l'adresse et le titre de l'onglet
 * suivent la section ouverte (pushState) ; le retour arriere la change.
 */
function useSectionRoute(getStage: () => Stage | null): void {
  // Arrivee sur une adresse de section
  useEffect(() => {
    const id = sectionFromPath(window.location.pathname);
    if (!id) return undefined;
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      const stage = getStage();
      const ready = intro.get() === 'done';
      if (!ready && tries < 50) return;
      window.clearInterval(t);
      if (HOOD_SECTIONS.includes(id)) {
        if (stage) openHood(id as 'goodies' | 'merch' | 'studio', stage);
        else section.set(id);
      } else section.set(id);
    }, 200);
    return () => window.clearInterval(t);
  }, [getStage]);

  // La section ouverte donne l'adresse et le titre ; le retour arriere la suit
  useEffect(() => {
    const sync = (): void => {
      const s = section.get();
      const route = s ? SECTION_ROUTES[s] : undefined;
      const path = window.location.pathname;
      const onSectionPath = sectionFromPath(path) !== null;
      // Une page de morceau (/tracks/<morceau>/) garde son adresse et son titre
      if (s && sectionFromPath(path) === s && path !== route) return;
      if (route && path !== route) window.history.pushState({ v4Section: s }, '', route);
      else if (!route && onSectionPath) window.history.pushState({ v4Section: null }, '', '/');
      const title = s ? sectionTitle(s) : null;
      document.title = title ?? (onPresskitRoute() ? PRESSKIT_ROUTE.title : COPY.title);
    };
    const onPop = (): void => {
      const id = sectionFromPath(window.location.pathname);
      if (id !== section.get()) section.set(id);
    };
    const unsub = section.subscribe(sync);
    window.addEventListener('popstate', onPop);
    return () => {
      unsub();
      window.removeEventListener('popstate', onPop);
    };
  }, []);
}

/**
 * La machine en hauteur (PORTRAIT) se choisit au chargement. Sur un
 * ordinateur (pointeur fin), une fenetre qui passe sous 768 px (ou
 * repasse au-dessus) et y reste 600 ms recharge la page : les machines
 * prennent la forme de la largeur (2026-10-03). Jamais au telephone (une
 * rotation ne recharge rien), ni si ?portrait force la forme.
 */
function useShapeReload(): void {
  useEffect(() => {
    let forced = false;
    try {
      forced = window.sessionStorage.getItem('mm.v4.portrait') !== null;
    } catch {
      forced = true;
    }
    if (forced || window.matchMedia(COARSE_QUERY).matches) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    let t = 0;
    const onChange = (): void => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        // Jamais sous la musique (2026-10-05) : la forme changera au prochain passage a l'arret
        if (mql.matches !== PORTRAIT && !anyPlaying()) window.location.reload();
      }, 600);
    };
    mql.addEventListener('change', onChange);
    return () => {
      window.clearTimeout(t);
      mql.removeEventListener('change', onChange);
    };
  }, []);
}

/**
 * La liste des morceaux du MM-DECKS (la playlist), chargee a part, apres le
 * chargement principal (2026-10-04, l'accueil de Deck ; jamais avec ?dj=0).
 * getStage : le cadrage remonte au-dessus d'elle.
 */
const DjBrowser = lazy(() =>
  import('./dj/TrackBrowser').then((m) => ({ default: m.DjBrowser as React.ComponentType<{ getStage: () => Stage | null; stage: Stage | null }> }))
);
/** Les jumeaux HTML du MM-DECKS (clavier, lecteurs d'ecran), charges a part eux aussi. */
const DjTwins = lazy(() => import('./dj/Twins'));
/** Le MM-BASS (2026-10-07) : ses jumeaux (et son clavier), charges a part */
const BassTwins = lazy(() => import('./bass/Twins'));
/** Ses INFOS (2026-10-08) : la carte et la pastille INFOS ON, avec le reste du MM-BASS */
const BassInfosCard = lazy(() => import('./bass/InfosCard'));
/** Les INFOS du MM-ARP (2026-10-08, la touche i de son grand ecran) : sa carte et sa pastille */
const VoyInfosCard = lazy(() => import('./voyager/InfosCard'));

const V4Shell: React.FC = () => {
  const stageRef = useRef<Stage | null>(null);
  const getStage = useCallback(() => stageRef.current, []);
  const [gl, setGl] = useState<'webgl' | 'fallback'>(() => (FLAGS.nowebgl ? 'fallback' : 'webgl'));
  usePageChrome();
  useShapeReload();
  useSectionRoute(getStage);
  useAudioGestures(getStage);
  useSectionsLifecycle();
  // Sans machine (repli), les raccourcis de la machine se taisent
  useKeys(getStage, gl === 'webgl');
  // Le MIDI (2026-10-05) : ses actions animent les touches de la scene
  useEffect(() => attachStage(getStage), [getStage]);
  const reduced = useReducedMotion();
  const mobile = useMedia(MOBILE_QUERY);
  const instrument = useSyncExternalStore(pattern.subscribe, () => pattern.get().instrument);
  const bpm = useSyncExternalStore(pattern.subscribe, () => pattern.get().bpm);
  const running = useSyncExternalStore(clock.subscribe, () => clock.running);
  const openSection = useSyncExternalStore(section.subscribe, section.get, section.get);
  const scStatus = useSyncExternalStore(sc.subscribe, () => sc.get().status);
  const exploded = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  // Les one-shots du MM-RYTM se calculent (worker) des le chargement, pendant l'intro (2026-10-05 : plus a
  // sa fin) : prets avant RUN, jamais calcules sur le fil principal pendant la lecture
  useEffect(() => {
    shots.prewarm();
  }, []);
  const viewMoved = useSyncExternalStore(view.subscribe, view.get, view.get);
  // Deux machines (2026-10-03) : celle qu'on utilise
  const machineFocus = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const editorOpen = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  // Apparence (2026-10-01) : la machine se reconstruit a chaque changement
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  // Le nombre de platines du MM-DECKS (2026-10-04) : en ajouter ou en retirer reconstruit la scene, comme Dark / Light
  const djCount = useSyncExternalStore(djDecks.subscribe, djDecks.get, djDecks.get);
  const builtOnce = useRef(false);

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
    // Les teintes de la scene, posees avant sa construction (repli SVG compris)
    applyAppearance(look);
    if (FLAGS.nowebgl || glFailed) return undefined;
    const host = hostRef.current;
    const input = stageElRef.current;
    if (!host || !input) return undefined;
    const stage = Stage.create({
      // Une reconstruction (changement d'apparence) ne rejoue pas l'intro
      skipIntro: builtOnce.current,
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
      // Onglet cache ou canvas hors ecran : le rendu dort ; le son aussi, sauf si quelque chose joue
      // (2026-10-05 : une autre fenetre devant ou une autre app ne coupe plus la musique)
      onVisibility: (visible) => {
        if (visible) resume();
        else if (!anyPlaying()) suspend();
      },
    });
    if (!stage) {
      setGl('fallback');
      return undefined;
    }
    builtOnce.current = true;
    stageRef.current = stage;
    setStage(stage);
    // Un premier montage en echec (StrictMode, contexte sature) ne fige pas le repli
    setGl('webgl');
    return () => {
      // La scene se reconstruit (Dark / Light, ADD DECK, REMOVE DECK : plusieurs secondes de fil principal
      // au telephone) : la musique est programmee d'avance, elle ne s'arrete pas (2026-10-05)
      reserve(3);
      stageRef.current = null;
      setStage(null);
      stage.dispose();
    };
  }, [onError, glFailed, look, djCount]);

  /* Fond de la page et theme-color du navigateur selon l'apparence */
  useEffect(() => {
    document.body.classList.toggle('v4-light', look === 'light');
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', look === 'light' ? '#F1EDE5' : BACKDROP.page);
    return () => document.body.classList.remove('v4-light');
  }, [look]);

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
      data-v4-theme={look}
      data-v4-iosbar={IOS_FLOATING_BAR ? '1' : '0'}
      data-v4-focus={machineFocus}
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
            {VOYAGER && <VoyTwins stage={stage} />}
            {DJ && (
              <Suspense fallback={null}>
                <DjTwins stage={stage} />
              </Suspense>
            )}
            {BASS && (
              <Suspense fallback={null}>
                <BassTwins stage={stage} />
              </Suspense>
            )}
          </StageBoundary>
        )}
      </div>
      {gl === 'webgl' && (
        <StageBoundary onError={onError}>
          {/* Hors de .v4-stage : ses pointeurs n'atteignent jamais l'orbite */}
          <ResetView getStage={getStage} />
          <Lcd />
          {/* MM-ARP ouvert : sa touche SCOPE et l'oscilloscope (2026-10-04, ui/Scope.tsx) */}
          <Scope mobile={mobile} getStage={getStage} />
          {/* MM-BASS : la carte INFOS et sa pastille (2026-10-08), hors de .v4-stage : la pastille ne lance pas l'orbite */}
          {BASS && (
            <Suspense fallback={null}>
              <BassInfosCard stage={stage} />
            </Suspense>
          )}
          {/* MM-ARP : la carte INFOS et sa pastille (2026-10-08), allumees par le i de son grand ecran */}
          {VOYAGER && (
            <Suspense fallback={null}>
              <VoyInfosCard stage={stage} />
            </Suspense>
          )}
          {/* Le Dock n'existe que sur la mise en page mobile : pas de rendu React par pas sur desktop ; il programme la 808 */}
          {/* EDIT ouvert (2026-10-04) : l'editeur prend la place du Dock de sa machine */}
          {mobile && machineFocus !== 'voy' && machineFocus !== 'dj' && machineFocus !== 'bass' && editorOpen !== 'mm808' && <Dock getStage={getStage} />}
          {/* Le Voyager a le sien au telephone : accords, octave, arpege en gros boutons */}
          {mobile && VOYAGER && machineFocus === 'voy' && editorOpen !== 'voy' && <VoyDock getStage={getStage} />}
          {/* Le MM-DECKS n'en a plus (2026-10-05, Mika : "le bouton MIXER ne sert a rien") : la table tient dans l'ecran ; le MM-BASS non plus, debout au telephone */}
          {/* Les editeurs (EDIT sur la machine) : la suite de l'arpege, le motif du MM-RYTM et ses velocites */}
          {VOYAGER && <SeqPanel stage={stage} mobile={mobile} />}
          <BeatPanel stage={stage} mobile={mobile} />
          {/* Le MM-DECKS : la liste des morceaux, ouverte par LOAD */}
          {DJ && (
            <Suspense fallback={null}>
              <DjBrowser getStage={getStage} stage={stage} />
            </Suspense>
          )}
          {/* Deux machines : leurs noms, le retour a la vue d'ensemble, le selecteur du telephone */}
          {VOYAGER && <MachineNav stage={stage} mobile={mobile} />}
          {/* Machine ouverte au telephone : CLOSE a portee de pouce, sur l'avant de la carte */}
          {mobile && <PcbClose getStage={getStage} />}
          {/* Desktop : CLOSE sur la plaque de la machine ouverte (2026-10-05, ui/HoodClose.tsx) */}
          {!mobile && <HoodClose getStage={getStage} />}
          {/* Le MM-BASS ouvert : INFOS sur sa plaque (2026-10-08, ui/BassInfosKey.tsx) */}
          <BassInfosKey getStage={getStage} />
          {/* L'en-tete : fin sur desktop ; logo et hamburger sur mobile (2026-10-01) */}
          {mobile ? <MobileHeader getStage={getStage} /> : <Header getStage={getStage} />}
          <Trace stage={stage} panelRef={panelRef} mobile={mobile} />
          <Panel mobile={mobile} panelRef={panelRef} />
        </StageBoundary>
      )}
      <PresskitHost getStage={getStage} />
      {/* L'ecran d'accueil (2026-10-04, Mika : "Il est important de proposer d'avoir mauditemachine.com en icone sur iPhone.. par defaut") : repli compris */}
      <InstallPrompt stage={gl === 'webgl' ? stage : null} mobile={mobile} />
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
/**
 * Safari 26 et plus sur iPhone, hors ecran d'accueil (2026-10-01) : sa
 * barre d'onglets flotte par-dessus le bas de la page, sans zone sure
 * annoncee ; le Dock se pose au-dessus (v4.css, --ios-bar). Les autres
 * navigateurs iOS (CriOS, FxiOS, EdgiOS) ont leur propre barre.
 */
const IOS_FLOATING_BAR = ((): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (!/iPhone|iPod/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return false;
  const m = /Version\/(\d+)/.exec(ua);
  return m !== null && Number(m[1]) >= 26;
})();

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
