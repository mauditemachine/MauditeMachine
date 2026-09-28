/**
 * /v3 : ACID LINE. Une page, la discographie enfilee sur une ligne de
 * lumiere, un anneau sequenceur, un panneau 303. Montee HORS Layout comme
 * la v2, moteur audio v2 reutilise tel quel (AudioPlayerProvider). La
 * lecture ne part que d'un clic reel (RUN, une ligne de la tracklist, une
 * touche) ; la selection ne touche jamais au moteur.
 */

import React, {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
} from 'react';
import './v3.css';
import {
  BEAD_BY_ID,
  BEAD_BY_TITLE,
  GROUP_TRACKS,
  beadInGroup,
  groupOf,
  stepInGroup,
  type Bead,
  type GroupId,
} from './data/beads';
import { ENGINE_IS_MOCK, EngineProvider, useEngine } from './engine/useEngine';
import StaticLine from './fallback/StaticLine';
import { useKeys } from './hooks/useKeys';
import { useStageInput, type HoverInfo } from './hooks/useStageInput';
import Panel from './panel/Panel';
import { AcidLine, type Tier } from './scene/AcidLine';
import { bridge, type DrawerKind, type V3State } from './state/bridge';
import { motion, useReducedMotion } from './state/motion';
import Drawer from './ui/Drawer';
import Info from './ui/Info';
import Ruler from './ui/Ruler';
import Tooltip from './ui/Tooltip';
import TopBar from './ui/TopBar';
import Tracklist from './ui/Tracklist';

const IS_DEV = import.meta.env.DEV;
const NOGL = IS_DEV && new URLSearchParams(window.location.search).get('v3nogl') === '1';

const readTier = (): Tier => {
  try {
    return sessionStorage.getItem('mm_v3_tier') === 'low' ? 'low' : 'full';
  } catch {
    return 'full';
  }
};

/** matchMedia observe en direct, sans re-render inutile. */
function useMedia(query: string): boolean {
  const mql = useMemo(() => window.matchMedia(query), [query]);
  return useSyncExternalStore(
    (cb) => {
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => mql.matches,
    () => false
  );
}

const devLog = (where: string, message: string) => {
  if (!IS_DEV) return;
  // console.table n'est pas filtre par le script d'index.html
  console.table([{ where, message }]);
};

interface BoundaryProps {
  onError: (where: string, message: string) => void;
  children: React.ReactNode;
}

/** Une erreur dans la scene rend la page sans WebGL ; jamais un ecran blanc. */
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

const V3Shell: React.FC = () => {
  const engine = useEngine();
  const { current, playing, progress, duration, notice } = engine;
  const reduced = useReducedMotion();
  const isMobile = useMedia('(max-width: 767px)');
  const isTouch = useMedia('(hover: none) and (pointer: coarse)');

  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tracklistBtnRef = useRef<HTMLButtonElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);
  const runBtnRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<AcidLine | null>(null);
  const hasGesture = useRef(false);
  const pendingTimer = useRef<number | undefined>(undefined);
  const prevCurrentId = useRef<string | null>(null);

  const [gl, setGl] = useState<'webgl' | 'fallback'>(NOGL ? 'fallback' : 'webgl');
  const [tier, setTier] = useState<Tier>(readTier);
  const [bootDone, setBootDone] = useState<boolean>(() => NOGL || motion.get());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [group, setGroupState] = useState<GroupId>(1);
  const [drawer, setDrawer] = useState<DrawerKind>('none');
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [pending, setPendingState] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [knobsOpen, setKnobsOpen] = useState(false);
  const [live, setLive] = useState('');
  const [noticeKey, setNoticeKey] = useState(0);
  const [devErrors, setDevErrors] = useState<string[]>([]);

  const onError = useCallback((where: string, message: string) => {
    devLog(where, message);
    if (IS_DEV) setDevErrors((e) => [...e.slice(-4), `${where}: ${message}`]);
  }, []);

  /* ---------- pending (LOADING) : 8 s max ---------- */
  const setPending = useCallback((v: boolean) => {
    window.clearTimeout(pendingTimer.current);
    setPendingState(v);
    setTimedOut(false);
    if (v) {
      pendingTimer.current = window.setTimeout(() => {
        setPendingState(false);
        setTimedOut(true);
      }, 8000);
    }
  }, []);
  useEffect(() => () => window.clearTimeout(pendingTimer.current), []);
  useEffect(() => {
    if (pending && playing && progress > 0) setPending(false);
  }, [pending, playing, progress, setPending]);

  /* ---------- la selection suit le moteur ---------- */
  useEffect(() => {
    const id = current?.id ?? null;
    if (id === prevCurrentId.current) return;
    prevCurrentId.current = id;
    if (!id) return;
    const bead = BEAD_BY_ID[id];
    setSelectedId(id);
    if (bead) {
      setGroupState((g) => (beadInGroup(bead, g) ? g : groupOf(bead, g)));
      setLive(`Playing: ${bead.track.title}`);
    }
    setPending(true);
  }, [current, setPending]);

  useEffect(() => {
    if (!current) return;
    setLive(playing ? `Playing: ${current.title}` : 'Paused');
  }, [playing, current]);

  /* ---------- notice : piste sautee ---------- */
  useEffect(() => {
    if (!notice) return;
    const b = BEAD_BY_TITLE[notice];
    bridge.noticeAt = performance.now();
    bridge.noticeId = b ? b.id : null;
    setNoticeKey((k) => k + 1);
    setLive(`Skipped: ${notice}`);
    sceneRef.current?.requestRender();
  }, [notice]);

  /* ---------- etat ---------- */
  const state: V3State = !bootDone
    ? 'boot'
    : pending
      ? 'loading'
      : current
        ? playing
          ? 'playing'
          : 'paused'
        : selectedId
          ? 'selected'
          : 'idle';

  const selectedBead = selectedId ? BEAD_BY_ID[selectedId] ?? null : null;
  const currentBead = current ? BEAD_BY_ID[current.id] ?? null : null;
  const displayBead = selectedBead ?? currentBead;
  const displayIsCurrent = !!displayBead && !!current && displayBead.id === current.id;

  /* ---------- pont vers la scene (un effet, pas de render par frame) ---------- */
  useEffect(() => {
    bridge.currentId = current?.id ?? null;
    bridge.selectedId = selectedId;
    bridge.playing = playing;
    bridge.duration = duration;
    bridge.pending = pending;
    bridge.group = group;
    bridge.drawer = drawer;
    bridge.state = state;
    bridge.hoverId = hover?.id ?? null;
    bridge.isTouch = isTouch;
    sceneRef.current?.requestRender();
  }, [current, selectedId, playing, duration, pending, group, drawer, state, hover, isTouch]);
  const lastSecond = useRef(-1);
  useEffect(() => {
    bridge.progress = progress;
    // Reduced motion : un rendu par seconde de lecture, pas par evenement du widget
    const sec = Math.floor(progress * duration);
    if (sec !== lastSecond.current) {
      lastSecond.current = sec;
      sceneRef.current?.requestRender();
    }
  }, [progress, duration]);

  /* ---------- chrome : body class, titre, theme-color, noindex ---------- */
  useLayoutEffect(() => {
    document.body.classList.add('v3-active');
    const prevTitle = document.title;
    document.title = 'Maudite Machine | Acid Line';
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevTheme = theme?.getAttribute('content') ?? null;
    let madeTheme: HTMLMetaElement | null = null;
    if (theme) theme.setAttribute('content', '#0C0C0C');
    else {
      madeTheme = document.createElement('meta');
      madeTheme.name = 'theme-color';
      madeTheme.content = '#0C0C0C';
      document.head.appendChild(madeTheme);
    }
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prevRobots = robots?.getAttribute('content') ?? null;
    let madeRobots: HTMLMetaElement | null = null;
    if (robots) robots.setAttribute('content', 'noindex, nofollow');
    else {
      madeRobots = document.createElement('meta');
      madeRobots.name = 'robots';
      madeRobots.content = 'noindex, nofollow';
      document.head.appendChild(madeRobots);
    }
    return () => {
      document.body.classList.remove('v3-active');
      document.title = prevTitle;
      if (theme && prevTheme !== null) theme.setAttribute('content', prevTheme);
      madeTheme?.remove();
      if (robots && prevRobots !== null) robots.setAttribute('content', prevRobots);
      madeRobots?.remove();
    };
  }, []);

  /* ---------- la scene ---------- */
  useEffect(() => {
    if (NOGL) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const line = AcidLine.create({
      host,
      root: rootRef.current,
      isMobile: window.matchMedia('(max-width: 767px)').matches,
      isTouch: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
      tier: readTier(),
      dev: IS_DEV,
      onTier: setTier,
      onIntroDone: () => setBootDone(true),
      onContextLost: () => setGl('fallback'),
      onContextRestored: () => setGl('webgl'),
      onError,
    });
    if (!line) {
      setGl('fallback');
      setBootDone(true);
      return undefined;
    }
    sceneRef.current = line;
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => line.resize(host.clientWidth, host.clientHeight), 100);
    });
    ro.observe(host);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      line.dispose();
      sceneRef.current = null;
    };
  }, [onError]);

  useEffect(() => {
    if (!IS_DEV) return;
    const w = window as unknown as { __v3?: { state: { engine: unknown } } };
    if (w.__v3) w.__v3.state.engine = engine;
  }, [engine]);

  /* ---------- actions ---------- */
  const getScene = useCallback(() => sceneRef.current, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setTimedOut(false);
    if (!id) return;
    const b = BEAD_BY_ID[id];
    if (!b) return;
    setGroupState((g) => (beadInGroup(b, g) ? g : groupOf(b, g)));
    setLive(`Selected: ${b.track.title}, ${b.year}, ${b.categoryLabel}`);
  }, []);

  const onStageSelect = useCallback(
    (id: string, alt: string | null) => {
      // Deux perles a moins de 20 px : un second clic passe a l'autre
      setHover(null);
      setSelectedId((prev) => {
        const next = prev === id && alt ? alt : id;
        window.setTimeout(() => select(next), 0);
        return prev;
      });
    },
    [select]
  );

  const onGesture = useCallback(() => {
    hasGesture.current = true;
  }, []);

  useStageInput(stageRef, getScene, {
    enabled: gl === 'webgl',
    onSelect: onStageSelect,
    onHover: setHover,
    onGesture,
  });

  const playBead = useCallback(
    (b: Bead) => {
      hasGesture.current = true;
      if (!b.playable) return;
      const g = beadInGroup(b, group) ? group : groupOf(b, group);
      setGroupState(g);
      setSelectedId(b.id);
      setTimedOut(false);
      // Une ligne de la tracklist joue : le drawer se replie et le focus va sur
      // RUN/STOP (Espace met alors en pause par le bouton lui-meme)
      setDrawer('none');
      window.setTimeout(() => runBtnRef.current?.focus({ preventScroll: true }), 60);
      if (current?.id === b.id) {
        if (!playing) setPending(true);
        engine.toggle();
        return;
      }
      setPending(true);
      engine.play(b.track, GROUP_TRACKS[g]);
    },
    [engine, current, playing, group, setPending]
  );

  const onRun = useCallback(() => {
    hasGesture.current = true;
    if (!displayBead || !displayBead.playable) return;
    playBead(displayBead);
  }, [displayBead, playBead]);

  const onBack = useCallback(() => {
    if (!current) return;
    hasGesture.current = true;
    setPending(true);
    engine.prev();
  }, [engine, current, setPending]);

  const onFwd = useCallback(() => {
    if (!current) return;
    hasGesture.current = true;
    setPending(true);
    engine.next();
  }, [engine, current, setPending]);

  const onClear = useCallback(() => {
    engine.close();
    setSelectedId(null);
    setPending(false);
    setTimedOut(false);
    setLive('Cleared');
  }, [engine, setPending]);

  const onToggle = useCallback(() => {
    if (!current) return;
    if (!playing) setPending(true);
    engine.toggle();
  }, [engine, current, playing, setPending]);

  const onSeek = useCallback(
    (r: number) => {
      if (current) engine.seek(r);
    },
    [engine, current]
  );

  const onGroup = useCallback((g: GroupId) => {
    setGroupState(g);
    setLive(`Pattern group ${g}`);
  }, []);

  const openDrawer = useCallback((kind: DrawerKind) => setDrawer((d) => (d === kind ? 'none' : kind)), []);
  const closeDrawer = useCallback(() => setDrawer('none'), []);

  const onMoveSelection = useCallback(
    (dir: 1 | -1) => {
      const next = stepInGroup(selectedId, group, dir);
      if (next) select(next.id);
    },
    [selectedId, group, select]
  );

  const onEnter = useCallback(() => {
    hasGesture.current = true;
    if (displayBead) playBead(displayBead);
  }, [displayBead, playBead]);

  useKeys({
    hasGesture,
    hasCurrent: !!current,
    drawerOpen: drawer !== 'none',
    stageRef,
    onToggle,
    onPrev: onBack,
    onNext: onFwd,
    onMoveSelection,
    onEnter,
    onGroup,
    onEscape: () => {
      if (drawer !== 'none') closeDrawer();
      else setHover(null);
    },
  });

  const onJumpYear = useCallback((t: number) => sceneRef.current?.jumpToT(t), []);

  /* ---------- intro : un premier geste saute tout ---------- */
  const skipIntro = useCallback(() => {
    if (bootDone) return;
    sceneRef.current?.skipIntro();
    setBootDone(true);
  }, [bootDone]);

  const onRootPointerUp = useCallback(() => {
    hasGesture.current = true;
    skipIntro();
  }, [skipIntro]);
  const onRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') hasGesture.current = true;
      if (e.key !== 'Tab') skipIntro();
    },
    [skipIntro]
  );

  /* ---------- infobulle ---------- */
  const hoverBead = hover ? BEAD_BY_ID[hover.id] : null;
  const altBead = hover?.alt ? BEAD_BY_ID[hover.alt] : null;
  const tipText = hoverBead
    ? `${hoverBead.track.title}, ${hoverBead.year}${altBead ? ` / ${altBead.track.title}, ${altBead.year}` : ''}`
    : null;

  const introPlays = !bootDone && !reduced && gl === 'webgl';

  return (
    <div
      ref={rootRef}
      className="v3-root"
      style={{ position: 'fixed' }}
      data-v3-state={state}
      data-v3-selected={selectedId ?? ''}
      data-v3-current={current?.id ?? ''}
      data-v3-group={group}
      data-v3-notice={notice ? '1' : '0'}
      data-v3-motion={reduced ? 'reduced' : 'full'}
      data-v3-tier={tier}
      data-v3-gl={gl}
      data-v3-drawer={drawer}
      data-v3-intro={introPlays ? '1' : '0'}
      data-v3-mock={ENGINE_IS_MOCK ? '1' : '0'}
      onPointerUpCapture={onRootPointerUp}
      onKeyDownCapture={onRootKeyDown}
    >
      <TopBar
        drawer={drawer}
        onTracklist={() => openDrawer('tracklist')}
        onInfo={() => openDrawer('info')}
        tracklistRef={tracklistBtnRef}
        infoRef={infoBtnRef}
      />

      {!isMobile && gl === 'webgl' && <Ruler activeT={displayBead ? displayBead.t : null} onJump={onJumpYear} />}

      <div
        ref={stageRef}
        className="v3-stage"
        role="group"
        tabIndex={0}
        aria-label="Discography line"
        aria-describedby="v3-stage-help"
      >
        <span id="v3-stage-help" className="v3-sr">
          Arrow keys move between tracks. Enter plays the selected track. Digits 1 to 4 choose a pattern group.
        </span>
        <StageBoundary onError={onError}>
          <div ref={hostRef} className="v3-canvas-host" aria-hidden="true" />
        </StageBoundary>
        {gl === 'fallback' && <StaticLine />}
        {!isTouch && hover && <Tooltip x={hover.x} y={hover.y} text={tipText} />}
      </div>

      <Panel
        runRef={runBtnRef}
        bead={displayBead}
        state={state}
        isCurrent={displayIsCurrent}
        hasCurrent={!!current}
        playing={playing}
        progress={progress}
        duration={duration}
        notice={notice}
        noticeKey={noticeKey}
        timedOut={timedOut}
        group={group}
        isMobile={isMobile}
        isTouch={isTouch}
        reduced={reduced}
        knobsOpen={knobsOpen}
        onKnobsToggle={() => setKnobsOpen((k) => !k)}
        onGroup={onGroup}
        onRun={onRun}
        onBack={onBack}
        onFwd={onFwd}
        onClear={onClear}
        onSeek={onSeek}
      />

      {gl === 'fallback' && (
        <div className="v3-fallback-body">
          <Tracklist currentId={current?.id ?? null} playing={playing} onPlay={playBead} inline />
          <Info inline />
        </div>
      )}

      <Drawer open={drawer === 'tracklist'} kind="tracklist" label="Tracklist" onClose={closeDrawer} returnTo={tracklistBtnRef}>
        <Tracklist currentId={current?.id ?? null} playing={playing} onPlay={playBead} />
      </Drawer>
      <Drawer open={drawer === 'info'} kind="info" label="Info" onClose={closeDrawer} returnTo={infoBtnRef}>
        <Info />
      </Drawer>

      <div className="v3-sr" aria-live="polite" role="status">
        {live}
      </div>

      {IS_DEV && devErrors.length > 0 && (
        <ul className="v3-devlog" aria-hidden="true">
          {devErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

const V3App: React.FC = () => (
  <EngineProvider>
    <V3Shell />
  </EngineProvider>
);

export default V3App;
