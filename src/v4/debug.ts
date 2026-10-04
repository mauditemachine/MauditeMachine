/**
 * window.__v4 (spec 15.2), installe seulement avec ?debug=1, dans tous les
 * builds. Les champs s'ajoutent au fil des stages. Stage 1 : stats, state
 * (live), scene, stage, requestRender / invalidate, measure, silk.
 * Stage 2 : audio (ctx undefined avant le premier geste), state.pattern /
 * instrument / bpm, pattern (le store, pour les tests), pads, hotspots,
 * pick(), reproject(). Stage 3 : clock (scheduled, drift()), state.running
 * et state.playhead, seq (LED, RUN), knobs (TEMPO). Stage 4 : state.section,
 * state.sc, state.lcd, sc (pont SoundCloud : compteurs, simulate() sans
 * moteur ni son), lcd, trace, knobs (les huit), seq.knobLeds. Stage 5 :
 * state.exploded, explode (couches, cadrage, compteurs), screen (texture de
 * l'ecran : redessins, plus petit ecart), pcb (pistes, pastilles,
 * composants), twins (jumeaux montes : liens, cibles), openToggle().
 * Stage 6 : state.intro (store de l'intro), twins pour les 34 objets
 * (role, aria-pressed / expanded / valuenow). Revision 2, etape 1 (spec
 * 20.11) : orbit (azimut, elevation, zoom, moving, dragging, target,
 * reset(), set(), lastTap, lastUp, bgResets), stats.maxDrawCalls /
 * maxTriangles / shadowUpdates / reset(), state.view, trace.anchor /
 * visible / fades, measure().orbit / shadow ; plus de parallaxe.
 * Revision 2, etape 2 (le corps Rytm) : encoders (remplace knobs), pads
 * (12, page active, OPEN), seq sans knobLeds, state.lcd sur trois lignes,
 * hotspots (39), twins (36 fermee, 39 ouverte), measure().fit (emprise de
 * la machine pour caler le cadrage), explode (panneau, PCB). Revision 2,
 * etape 3 (SWING, DIST, REVERB) : audio.fx (branches, reponse de la
 * reverbe), audio.setSwing / setDrive / setReverb, pattern.fx (le store),
 * clock.scheduled[].off (retard du swing), state.pattern.fx (la forme
 * stockee). Revision 2, etape 4 (icones, LABEL, LIVE, SONAA) : pcb.lit et
 * pcb.litDraws (puce LABEL allumee au survol ou au focus), twins.controls
 * (aria-controls des puces GOODIES, MERCH et STUDIO), state.section 'press'. Revue
 * de la revision 2 : orbit.lastTap.quick (moins de 400 ms : la double tape
 * du fond), audio.fx apres le demontage (reverbOn false : la queue est
 * jetee), state type (V4DebugState). Lire l'etat ici, jamais par
 * console.log : index.html filtre la console.
 */

import { openToggle } from './actions';
import { clock, clockDebug, type ClockDebug } from './audio/clock';
import { audioDebug, type AudioDebug } from './audio/drums';
import { pattern, type StoredPattern } from './audio/pattern';
import { scDebug, type ScDebug, type ScState } from './audio/soundcloud';
import { synthDebug } from './audio/synth';
import { focus } from './state/focus';
import { arp, arpDebug } from './voyager/arp';
import { voyParams } from './voyager/params';
import { djEngineIfAny } from './dj/engine';
import { djState } from './dj/state';
import { djView } from './dj/view';
import type { ExplodeInfo } from './scene/explode';
import type { HotspotView } from './scene/hit';
import type { EncodersInfo } from './scene/encoders';
import type { PadsInfo } from './scene/pads';
import type { PcbInfo } from './scene/pcb';
import type { Stage, StageMeasure, StageStats } from './scene/renderer';
import type { ScreenInfo } from './scene/screen';
import type { SequencerInfo } from './scene/sequencer3d';
import type { SilkInfo } from './scene/silk';
import { explode, type ExplodeState } from './state/explode';
import { intro } from './state/intro';
import { lcd, type LcdState } from './state/lcd';
import { lcdMessage } from './state/lcdMessage';
import { playhead } from './state/playhead';
import { section } from './state/section';
import { view } from './state/view';
import type { Inst, SectionId } from './theme';
import { hitDebug } from './ui/Hotspots';
import { traceDebug, type TraceDebug } from './ui/Trace';

export interface DebugState {
  layout: 'desktop' | 'mobile';
  motion: 'full' | 'reduced';
  gl: 'webgl' | 'fallback';
  intro: 'pending' | 'done';
}

export interface DebugSource {
  stage: () => Stage | null;
  state: () => DebugState;
}

export interface V4DebugState extends DebugState {
  /** la forme stockee sous mm.v4.pattern (spec 10) */
  pattern: StoredPattern;
  instrument: Inst | null;
  bpm: number;
  /** RUN : le sequenceur tourne */
  running: boolean;
  /** pas allume par la tete de lecture (0 a 15), -1 a l'arret */
  playhead: number;
  /** message passager de l'ecran encore affiche (STEP 07 BD ON...), ou null */
  lcdMessage: string | null;
  /** section ouverte, null si aucune */
  section: SectionId | null;
  /** lecture SoundCloud vue par le pont : statut, piste, position (s) */
  sc: ScState & { position: number };
  /** les trois lignes de l'ecran telles qu'affichees */
  lcd: [string, string, string];
  /** vue eclatee : closed, opening, open, closing */
  exploded: ExplodeState;
  /** orbite : a la vue par defaut, ou deplacee (RESET VIEW visible) */
  view: 'default' | 'moved';
}

/** L'orbite (revision 2) : lecture en degres, commandes de test. */
export interface OrbitDebug {
  /** deg, 0 a 360 */
  azimuth: number;
  /** deg, 18 a 78 */
  elevation: number;
  zoom: number;
  moving: boolean;
  dragging: boolean;
  target: { x: number; y: number; z: number };
  /** derniere tape jugee : ecart (px), duree (ms), tape ou non, en moins de 400 ms */
  lastTap: { dist: number; ms: number; fired: boolean; quick: boolean };
  /** dernier relachement vu par la couche de saisie : objet, tape, objet parti, fond */
  lastUp: { id: string | null; tap: boolean; fired: string | null; bg: boolean };
  /** retours a la vue par defaut par double tape du fond */
  bgResets: number;
  reset: () => void;
  /** une vue en degres ; instant = posee tout de suite */
  set: (azDeg: number, elDeg: number, zoom?: number, instant?: boolean) => void;
}

/** Un jumeau HTML monte (spec 6.3). */
export interface TwinInfo {
  id: string;
  tag: string;
  role: string | null;
  label: string | null;
  href: string | null;
  target: string | null;
  rel: string | null;
  pressed: string | null;
  expanded: string | null;
  controls: string | null;
  valueNow: string | null;
  tabIndex: number;
  /** rectangle en px CSS de la fenetre */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface V4Debug {
  version: 'v4';
  readonly stats: StageStats;
  readonly state: V4DebugState;
  /** l'orbite de la camera (null sans Stage) */
  readonly orbit: OrbitDebug | null;
  readonly audio: AudioDebug;
  /** horloge : scheduled (64 derniers pas), drift(), resetStats() */
  readonly clock: ClockDebug;
  /** le store du motif (select, toggle, clear, setBpm, flush), pour les tests */
  readonly pattern: typeof pattern;
  readonly pads: PadsInfo | null;
  /** LED des pas (couleurs), RUN, tete de lecture, survol */
  readonly seq: SequencerInfo | null;
  /** les six encodeurs : angles (deg), valeurs (0 a 1) */
  readonly encoders: EncodersInfo | null;
  /** pont SoundCloud : etat, compteurs, simulate() ; mock : ?v4mock actif (DEV) */
  readonly sc: ScDebug;
  /** l'etat complet de l'ecran (parties gauche et droite, mises a jour) */
  readonly lcd: LcdState;
  /** trace du panneau (desktop) : chemin, points, dashoffset, point lumineux */
  readonly trace: TraceDebug;
  /** ouvre ou ferme une section comme un onglet (tests) */
  openSection: (s: SectionId | null) => void;
  /** vue eclatee : etat, demandes, couches, cadrage, duree de la derniere animation */
  readonly explode: (ExplodeInfo & { state: ExplodeState; toggles: number }) | null;
  /** OPEN / CLOSE comme le bouton (la garde closed / open s'applique) */
  openToggle: () => boolean;
  /** la texture de l'ecran : redessins, texte, plus petit ecart entre deux redessins */
  readonly screen: ScreenInfo | null;
  /** le PCB : pistes, pastilles, composants, triangles */
  readonly pcb: PcbInfo | null;
  /** jumeaux HTML montes, dans l'ordre de tabulation (un par objet interactif) */
  readonly twins: TwinInfo[];
  /** objets interactifs projetes, px CSS du canvas (spec 6.1) */
  readonly hotspots: HotspotView[];
  readonly scene: { renderer: Stage['renderer']; scene: Stage['scene']; camera: Stage['camera'] } | null;
  readonly silk: SilkInfo | null;
  /** le Stage lui-meme, pour l'inspection seulement (tests des stages suivants) */
  readonly stage: Stage | null;
  /** l'objet sous un point du canvas (coarse : regle tactile des 24 px) */
  pick: (x: number, y: number, coarse?: boolean) => string | null;
  reproject: () => void;
  requestRender: () => void;
  invalidate: () => void;
  measure: () => StageMeasure | null;
  /**
   * Deux machines (2026-10-03) : la cible (focus, set), le MM-VOYAGER (rig,
   * arpege, synthe et son rendu hors ligne, potards).
   */
  readonly voyager: {
    focus: typeof focus;
    rig: ReturnType<NonNullable<Stage['voy']>['info']> | null;
    arp: typeof arp;
    arpDebug: typeof arpDebug;
    synth: typeof synthDebug;
    params: typeof voyParams;
  };
  /**
   * Le MM-DECKS (2026-10-04, ?dj=1) : le rig, le store des commandes, le
   * bloc cadre au telephone, le moteur (null avant le premier geste). Tests
   * sans son : ?mute=1, les cretes se lisent avant le master.
   */
  readonly dj: {
    rig: ReturnType<NonNullable<Stage['dj']>['info']> | null;
    state: typeof djState;
    view: typeof djView;
    engine: typeof djEngineIfAny;
  };
}

const NO_STATS: StageStats = {
  frames: 0,
  rafs: 0,
  drawCalls: 0,
  triangles: 0,
  maxDrawCalls: 0,
  maxTriangles: 0,
  shadowUpdates: 0,
  lastRenderAt: 0,
  loopActive: false,
  dpr: 0,
  reset: () => undefined,
};
const DEGR = 180 / Math.PI;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Installe window.__v4 ; renvoie la fonction qui le retire (demontage). */
export function installDebug(src: DebugSource): () => void {
  const api: V4Debug = {
    version: 'v4',
    get stats() {
      return src.stage()?.stats ?? NO_STATS;
    },
    get state(): V4DebugState {
      const p = pattern.get();
      return {
        ...src.state(),
        intro: intro.get(),
        pattern: pattern.serialize(),
        instrument: p.instrument,
        bpm: p.bpm,
        running: clock.running,
        playhead: playhead.get(),
        lcdMessage: lcdMessage.get()?.text ?? null,
        section: section.get(),
        sc: scDebug.state,
        lcd: [...lcd.get().text] as [string, string, string],
        exploded: explode.get(),
        view: view.get() ? 'moved' : 'default',
      };
    },
    get orbit() {
      const st = src.stage();
      if (!st) return null;
      const o = st.orbit;
      return {
        azimuth: r3(o.azimuth * DEGR),
        elevation: r3(o.elevation * DEGR),
        zoom: r3(o.zoom),
        moving: o.moving,
        dragging: o.dragging,
        target: { x: r3(o.target.x), y: r3(o.target.y), z: r3(o.target.z) },
        lastTap: { ...o.lastTap },
        lastUp: { ...hitDebug.lastUp },
        bgResets: hitDebug.bgResets,
        reset: () => o.reset(),
        set: (azDeg: number, elDeg: number, zoom = o.zoom, instant = false) => o.set(azDeg, elDeg, zoom, instant),
      };
    },
    audio: audioDebug,
    clock: clockDebug,
    pattern,
    get pads() {
      return src.stage()?.pads.info() ?? null;
    },
    get seq() {
      return src.stage()?.seq.info() ?? null;
    },
    get encoders() {
      return src.stage()?.encoders.info() ?? null;
    },
    sc: scDebug,
    get lcd() {
      return lcd.get();
    },
    trace: traceDebug,
    openSection: (s) => section.set(s),
    get explode() {
      const st = src.stage();
      return st ? { state: explode.get(), toggles: explode.toggles, ...st.explode.info() } : null;
    },
    openToggle: () => openToggle(),
    get screen() {
      const st = src.stage();
      return st ? { ...st.screen.info, text: [...st.screen.info.text] as [string, string, string] } : null;
    },
    get pcb() {
      return src.stage()?.pcb.info() ?? null;
    },
    get twins() {
      return Array.from(document.querySelectorAll<HTMLElement>('.v4-twin')).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.hotspot ?? '',
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          label: el.getAttribute('aria-label'),
          href: el.getAttribute('href'),
          target: el.getAttribute('target'),
          rel: el.getAttribute('rel'),
          pressed: el.getAttribute('aria-pressed'),
          expanded: el.getAttribute('aria-expanded'),
          controls: el.getAttribute('aria-controls'),
          valueNow: el.getAttribute('aria-valuenow'),
          tabIndex: el.tabIndex,
          x: +r.left.toFixed(1),
          y: +r.top.toFixed(1),
          w: +r.width.toFixed(1),
          h: +r.height.toFixed(1),
        };
      });
    },
    get hotspots() {
      return src.stage()?.hit.list() ?? [];
    },
    get scene() {
      const s = src.stage();
      return s ? { renderer: s.renderer, scene: s.scene, camera: s.camera } : null;
    },
    get silk() {
      return src.stage()?.silk.info ?? null;
    },
    get stage() {
      return src.stage();
    },
    pick: (x, y, coarse = false) => src.stage()?.hit.pick(x, y, coarse)?.id ?? null,
    reproject: () => src.stage()?.hit.invalidate(),
    requestRender: () => src.stage()?.invalidate(),
    invalidate: () => src.stage()?.invalidate(),
    measure: () => src.stage()?.measure() ?? null,
    voyager: {
      focus,
      get rig() {
        return src.stage()?.voy?.info() ?? null;
      },
      arp,
      arpDebug,
      synth: synthDebug,
      params: voyParams,
    },
    dj: {
      get rig() {
        return src.stage()?.dj?.info() ?? null;
      },
      state: djState,
      view: djView,
      engine: djEngineIfAny,
    },
  };
  window.__v4 = api;
  return () => {
    if (window.__v4 === api) delete window.__v4;
  };
}

declare global {
  interface Window {
    __v4?: V4Debug;
  }
}
