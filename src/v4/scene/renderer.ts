/**
 * /v4 MM-808 : le Stage. Un WebGLRenderer sur son propre canvas, la camera
 * orthographique qui ORBITE autour de la machine (scene/orbit.ts : glisser,
 * molette, pincement ; vue par defaut azimut 45, elevation 38), les
 * lumieres fixes dans le monde (cle, ciel, lisere jaune en PointLight,
 * contre-jour sur la face arriere), l'intro (spec 7.4), le sol a l'encre
 * (halo, ombres, brouillard : scene/floor.ts) et la machine de la revision
 * 2 (spec 20.3) : le chassis en coin et le panneau anodise incline, la
 * serigraphie, l'ecran OLED, les six encodeurs, RUN/STOP et CLEAR, les 12
 * pads retroeclaires, les 16 touches trig et leurs LED, le PCB et la vue
 * eclatee (explode.ts), le picking (hit.ts), le cadrage quand une section
 * s'ouvre et quand la machine s'eclate (spec 20.2.5). Boucle A LA
 * DEMANDE : une frame seulement si quelque chose a change (invalidate,
 * orbite, animateur ou tween vivant), zero frame au repos, rien du tout
 * quand l'onglet ou le canvas n'est pas visible. La carte d'ombre n'est
 * refaite que si un objet qui projette une ombre a bouge (invalidate,
 * animateur qui renvoie true) : une frame ou seule la vue a bouge, ou
 * seules des couleurs ont change (pas du sequenceur, flash, LED, ecran,
 * survol : repaint, animateur qui renvoie 'paint'), la reutilise.
 * Pendant la lecture la boucle lit l'horloge audio a chaque rAF mais ne
 * rend qu'au changement de pas (et a la fin d'un flash). Dans chaque frame
 * rendue, juste apres le rendu, les ecouteurs onView (les jumeaux, la
 * trace du panneau) relisent la projection : meme passe que le rendu, sans
 * allocation. Quand la boucle s'arrete, onIdle.
 * create() et dispose() sont re-executables (StrictMode double-monte les
 * effets en DEV).
 */

import {
  ACESFilmicToneMapping,
  NeutralToneMapping,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  PerspectiveCamera,
  PCFShadowMap,
  PointLight,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type InstancedMesh,
  type Mesh,
  type Texture,
} from 'three';
import { clock } from '../audio/clock';
import { sc } from '../audio/soundcloud';
import { context, mix } from '../audio/drums';
import { BPM, INSTRUMENTS, pattern } from '../audio/pattern';
import { familyOf, kit } from '../audio/kit';
import type { ShotId } from '../audio/shotsdsp';
import { machinePlaying, onPlayStart } from '../state/playLock';
import { reserve } from '../audio/sched';
import { VOICE_FX_DEFAULT, voiceFx } from '../audio/voicefx';
import { motion } from '../state/motion';
import { editor } from '../state/editor';
import { PATTERN_SLOTS, patterns } from '../state/patterns';
import { presetMode, type PresetKey } from '../state/presetMode';
import { bassExplode, explode as explodeState, voyExplode } from '../state/explode';
import { BASS, DJ, MACHINES, focus, startMachine, VOYAGER, type Focus, type MachineId } from '../state/focus';
import { view } from '../state/view';
import { intro } from '../state/intro';
import { playhead } from '../state/playhead';
import { lcd } from '../state/lcd';
import { rytmPage } from '../state/rytmPage';
import { section } from '../state/section';
import { voices } from '../state/voices';
import {
  BACKDROP,
  BODY,
  BTN_LED,
  CHIP,
  BOARD_CHIPS,
  COARSE_QUERY,
  COLOR,
  DPR_MAX,
  DPR_MIN_DESKTOP,
  ENCODERS,
  EXPLODE,
  OPEN_VIEW,
  EXPOSURE,
  APPEARANCE,
  FIRST_FRAME_WAIT_MS,
  FIT_H,
  FRAME_DESKTOP,
  FRAME_MOBILE,
  FRONT_W,
  INTRO,
  OLED,
  OLED_BAR,
  OLED_BAR_PAGE,
  STEP_PRESS,
  LIGHT_BACK,
  LIGHT_HEMI,
  LIGHT_KEY,
  LIGHT_RIM,
  MACHINE_H,
  MOBILE_QUERY,
  OPEN_BREATHE,
  ORBIT,
  PAD_FX,
  PANEL,
  PANEL_D,
  PCB,
  PORTRAIT,
  potCourse,
  PLATEAU_W,
  SECTION_FRAME,
  TILT,
  TRACE,
  chassisTopY,
  isPage,
  panelLeft,
  type ChipId,
  type PadId,
  type SectionId,
} from '../theme';
import { Encoders } from './encoders';
import { Explode, type ExplodeInfo } from './explode';
import { Floor } from './floor';
import { HitMap, type HotspotDef } from './hit';
import { Machine } from './machine';
import { Orbit } from './orbit';
import { Pads } from './pads';
import { Pcb } from './pcb';
import { RYTM_OPEN_FRAME, RytmTweaks, rytmTweakClear } from './rytmTweaks';
import { Screen } from './screen';
import { BackPlate } from './backplate';
import { BUTTON_INDEX, Sequencer3D, type TransportButton } from './sequencer3d';
import { PanelSilk, fontsReady, makeBrushTexture, whenFonts, whenLogos } from './silk';
import { Tweens, easeInOutCubic, easeOutCubic, linear } from './tween';
import { VoyagerRig } from '../voyager/rig';
import { VOY_BODY, VOY_FRAME, VOY_OPEN_FRAME, VOY_X } from '../voyager/theme';
import type { DjRig } from '../dj/rig';
import { djLoad } from '../state/djload';
import { DJ_FRAME, DJ_TOP_Y, DJ_W, DJ_X, UNIT_X, unitW } from '../dj/theme';
import { djView } from '../dj/view';
import type { BassRig } from '../bass/rig';
import { bassLoad } from '../state/bassload';
import { BASS_D, BASS_FRAME, BASS_OPEN_FRAME, BASS_W, bassX } from '../bass/theme';

const DEG = Math.PI / 180;

/** Eclair d'un temoin : plein sur BTN_LED.hold de sa duree, puis il s'eteint. */
const holdThenOut = (t: number): number => (t < BTN_LED.hold ? 0 : easeOutCubic((t - BTN_LED.hold) / (1 - BTN_LED.hold)));

/**
 * La bande de la barre de l'ecran (px de la texture, OLED.tex) en centre et
 * demi-profondeur du panneau : OLED_BAR sur l'ecran d'aujourd'hui,
 * OLED_BAR_PAGE en vue PAGE (2026-10-08).
 */
function seekBox(band: { bandY0: number; bandY1: number }): { z: number; hz: number } {
  const [, TH] = OLED.tex;
  const z0 = OLED.z - OLED.d / 2 + (band.bandY0 / TH) * OLED.d;
  const z1 = OLED.z - OLED.d / 2 + (band.bandY1 / TH) * OLED.d;
  return { z: (z0 + z1) / 2, hz: (z1 - z0) / 2 };
}

/* ---------------- deux machines (2026-10-03) ---------------- */

/**
 * Le cadrage d'une cible (la 808, le MM-VOYAGER, ou les deux) : centre x
 * du pivot, demi-largeur voulue au pivot (hw0), hauteur projetee fermee
 * (h), pivot ferme et ouvert, rayons du cadrage de section, pile ouverte,
 * etendue de la camera d'ombre. Le Stage interpole entre deux cadrages
 * pendant le zoom d'une machine a l'autre.
 */
interface Frame {
  cx: number;
  hw0: number;
  h: number;
  ty: number;
  explodeTy: number;
  rClosed: number;
  rOpen: number;
  fitHalfH: number;
  extent: number;
  /** ouvert (OPEN, desktop) : la largeur de la plaque a cadrer (0 : la pile entiere, fitHalfH) et son centre dans le monde */
  openW: number;
  openY: number;
  openZ: number;
}

const FRAME_KEYS = ['cx', 'hw0', 'h', 'ty', 'explodeTy', 'rClosed', 'rOpen', 'fitHalfH', 'extent', 'openW', 'openY', 'openZ'] as const;

/**
 * Zoom d'une machine a l'autre (ms) ; la vue d'ensemble garde 88 % de la
 * largeur pour les deux. 450 ms depuis le 2026-10-05 (Mika : "le voyage vers
 * les machines doit etre rapide" ; 900 avant), en ease-out : le depart est
 * immediat, l'arrivee douce.
 */
const FOCUS_MS = 450;
/**
 * Le bout qui depasse (desktop, 2026-10-03, demande de Mika) : une machine
 * utilisee, l'autre se pousse au bord de l'ecran et en montre px pixels (a
 * la vue par defaut) ; au survol elle en montre hoverPx de plus, en ms ;
 * jamais plus pres que gap de la machine utilisee.
 */
/**
 * Le bout de la voisine (desktop) : son bord a px du bord de l'ecran (52 px depuis le 2026-10-07,
 * Mika : "en voyant la machine de droite pour qu'on puisse cliquer dessus et switcher rapidement").
 */
/** openPx (2026-10-08) : capot ouvert, le bord interieur des voisines passe a openPx au-dela du bord de l'ecran (la perspective les ramenait dedans) */
const PEEK = { px: 52, hoverPx: 40, ms: 180, gap: 0.6, openPx: 140 } as const;
/**
 * Une machine utilisee sur desktop (2026-10-07, Mika : "pour cette taille de machine comme la
 * MM-RYTM tu pourrais arriver plus zoome, tout en voyant la machine de droite") : cadree de face,
 * sa vraie largeur sur 80 % de l'ecran (au lieu de la largeur projetee a l'azimut 45 sur 78 %),
 * sa hauteur vue de face ; tournee, elle peut deborder un peu, comme au telephone.
 */
const SINGLE_FILL = 0.8;
const OVERVIEW_FILL = { desktop: 0.88, mobile: 0.92 } as const;
/** Au telephone, d'un bloc du MM-DECKS a l'autre (ms). */
const DJ_UNIT_MS = 420;
/**
 * 60 images par seconde au plus (2026-10-04, Mika : "le son gresille, le
 * CPU chauffe") : un ecran a 120 Hz (MacBook Pro, iPad) rendait deux fois
 * plus d'images pour rien pendant qu'une machine joue. Sous 16.7 ms : a
 * 60 Hz chaque rAF passe, a 120 Hz un sur deux.
 */
const FRAME_MIN_MS = 12;

/* ---------------- Stage ---------------- */

/**
 * Un animateur renvoie true s'il a deplace un objet qui projette une ombre
 * (frame rendue avec la passe d'ombre, boucle gardee), 'paint' s'il n'a
 * change que des couleurs, textures ou objets sans ombre (frame rendue
 * sans passe d'ombre), 'poll' s'il n'a rien change mais doit etre relu a
 * la prochaine frame (horloge audio, echeance d'un flash : boucle gardee,
 * rien rendu), false s'il n'a plus rien a faire.
 */
export type Animator = (now: number, dt: number) => boolean | 'paint' | 'poll';

export interface StageOpts {
  /** conteneur du canvas : taille, visibilite */
  host: HTMLElement;
  /** element des pointeurs de l'orbite (.v4-stage : la couche de saisie y remonte) */
  input: HTMLElement;
  /** palier de qualite, fige a la creation : antialias, DPR, ombres, textures */
  mobile: boolean;
  dev: boolean;
  onError: (where: string, message: string) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  /** onglet ou canvas visible / cache (le son s'y branchera) */
  onVisibility?: (visible: boolean) => void;
  /** pas d'intro (reconstruction apres un changement d'apparence) */
  skipIntro?: boolean;
}

export interface StageStats {
  /** frames RENDUES (pas les rAF a vide) */
  frames: number;
  /** rAF executes, rendus ou non (la lecture interroge l'horloge sans rendre) */
  rafs: number;
  /** derniere frame rendue (une frame d'orbite seule n'a pas de passe d'ombre) */
  drawCalls: number;
  triangles: number;
  /** pire frame depuis le montage ou depuis reset() (passe d'ombre comprise) */
  maxDrawCalls: number;
  maxTriangles: number;
  /** frames qui ont refait la carte d'ombre */
  shadowUpdates: number;
  lastRenderAt: number;
  loopActive: boolean;
  dpr: number;
  /** remet a zero les maxima et le compte des passes d'ombre (tests) */
  reset: () => void;
}

/** Ancre de la trace : un point du canvas (px CSS) et sa visibilite. */
export interface AnchorPoint {
  x: number;
  y: number;
  /** dans le canvas (marge 8 px), calque visible, pas cache par la machine */
  visible: boolean;
}

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Emprise projetee de la machine dans la vue courante (unites monde, sur les axes de l'ecran). */
export interface StageFit {
  /** largeur et hauteur projetees, sommets reels (instances comprises, sol exclu) */
  w: number;
  h: number;
  /** centre vertical projete (le long du haut de l'ecran), et le pivot y qui le centrerait */
  cy: number;
  targetY: number;
  /** plus grande distance horizontale d'un sommet a l'axe vertical du pivot (cadrage de section) */
  radius: number;
}

export interface StageMeasure {
  viewport: { w: number; h: number };
  canvas: ScreenBox;
  /** px CSS par unite, zoom compris */
  pxPerUnit: number;
  /** demi-largeur et demi-hauteur du frustum a zoom 1 (unites) */
  frustum: { hw: number; hh: number };
  /** vue de l'orbite (deg) */
  orbit: { azDeg: number; elDeg: number; zoom: number };
  /**
   * cadrage de section (spec 20.2.5) : t de 0 a 1, decalage horizontal du
   * frustum (unites, a zoom 1) ; vue eclatee : t de 0 a 1, hauteur du pivot
   */
  framing: { section: number; ox: number; explode: number; targetY: number };
  /** empreinte 14 x 9 a coins vifs : la definition du cadrage (spec 3.2) */
  footprint: ScreenBox & { ratio: number };
  /** maillages reels, en px CSS de la fenetre : le panneau, le chassis, leur union */
  plateau: ScreenBox & { ratio: number };
  socle: ScreenBox & { ratio: number };
  machine: ScreenBox & { ratio: number };
  /** emprise de toute la machine (unites), pour caler MACHINE_H, ORBIT.targetY, SECTION_FRAME, EXPLODE */
  fit: StageFit;
  /**
   * etendue en espace lumiere des maillages qui projettent une ombre, dans
   * l'etat courant (fermee ou ouverte), contre celle de la camera d'ombre
   */
  shadow: { x: number; y: number; near: number; far: number; extent: number };
  explode: ExplodeInfo;
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const v3 = new Vector3();
/** les 16 LED des pas (test de l'intro) */
const STEP_LEDS = 16;

/**
 * Le coin du chassis en demi-espaces (repere du socle) et ses 8 coins :
 * l'occulteur du picking et la silhouette de la machine (fond ou non).
 * Les pieds comptent dans la silhouette (du sol au dessus).
 */
function wedgeOccluder(): { planes: number[]; corners: number[] } {
  const hx = BODY.w / 2;
  const hz = BODY.d / 2;
  const tanT = Math.tan(TILT);
  const t0 = chassisTopY(0);
  const planes = [-1, 0, 0, -hx, 1, 0, 0, -hx, 0, 0, -1, -hz, 0, 0, 1, -hz, 0, -1, 0, 0, 0, 1, tanT, -t0];
  const corners: number[] = [];
  for (const x of [-hx, hx]) {
    for (const z of [-hz, hz]) corners.push(x, 0, z, x, chassisTopY(z), z);
  }
  return { planes, corners };
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  /** l'orbite de la camera (glisser, molette, pincement, retour a la vue par defaut) */
  readonly orbit: Orbit;
  readonly machine: Machine;
  readonly silk: PanelSilk;
  readonly backPlate: BackPlate;
  /** tweens des objets qui projettent une ombre (enfoncement des pads) : passe d'ombre */
  readonly tweens = new Tweens();
  /** tweens sans ombre (soulevement des puces, cadrage de section) : frames sans passe d'ombre */
  private paintTweens = new Tweens();
  /** les 12 pads (voix, pages, OPEN) et leurs halos */
  readonly pads: Pads;
  /** touches trig, RUN/STOP, CLEAR et les 16 LED */
  readonly seq: Sequencer3D;
  /** TEMPO, TONE, LEVEL, SWING, DIST, REVERB */
  readonly encoders: Encoders;
  /** l'ecran OLED, texte de state/lcd.ts */
  readonly screen: Screen;
  /** le PCB de la vue eclatee : carte texturee et composants */
  readonly pcb: Pcb;
  /** OPEN : les trois couches et leur cadrage */
  readonly explode: Explode;
  /** picking en espace ecran : la liste explicite des objets interactifs */
  readonly hit: HitMap;
  readonly stats: StageStats = {
    frames: 0,
    rafs: 0,
    drawCalls: 0,
    triangles: 0,
    maxDrawCalls: 0,
    maxTriangles: 0,
    shadowUpdates: 0,
    lastRenderAt: 0,
    loopActive: false,
    dpr: 1,
    reset: () => {
      this.stats.maxDrawCalls = 0;
      this.stats.maxTriangles = 0;
      this.stats.shadowUpdates = 0;
    },
  };

  private opts: StageOpts;
  private canvas: HTMLCanvasElement;
  private key: DirectionalLight;
  private hemi: HemisphereLight;
  /** lisere jaune depuis la gauche (PointLight, voir theme.ts LIGHT_RIM) */
  private rim: PointLight;
  /** contre-jour : la face arriere et sa connectique */
  private back: DirectionalLight;
  /** brossage du panneau (roughnessMap) */
  private brush: CanvasTexture;
  /** le sol a l'encre : halo, ombres, brouillard */
  private floor: Floor;
  /** la carte d'ombre est a refaire (tout sauf une frame d'orbite seule) */
  private shadowDirty = true;
  /** ancre de la trace par section : le pad de la page, la puce LIVE ou STUDIO */
  private anchors = new Map<SectionId, HotspotDef>();
  private animators: Animator[] = [];
  private timers: number[] = [];
  /** le travail d'avance en temps libre (warmIdle) : une fois */
  private warmed = false;
  private width = 1;
  private height = 1;
  private hw = 1;
  private ppu = 1;
  private layoutMobile: boolean;
  private raf = 0;
  private resizeRaf = 0;
  private last = -1;
  private dirty = true;
  private started = false;
  private disposed = false;
  private contextLost = false;
  private docHidden = false;
  private offscreen = false;
  private paused = false;
  private ro: ResizeObserver;
  private io: IntersectionObserver | null = null;
  private layoutMql: MediaQueryList;
  private coarseMql: MediaQueryList;
  private unsubMotion: () => void;
  private unsubPattern: () => void;
  private unsubVoices: () => void;
  private unsubClock: () => void;
  /** les 16 pas du picking (coupes quand le Dock les remplace) */
  private stepDefs: HotspotDef[];
  /** seq du pas affiche par la tete de lecture, -1 a l'arret */
  private headSeq = -1;
  /** cadrage de section (spec 20.2.5) : 0 = base, 1 = machine decalee pour le panneau */
  private secT = 0;
  private secGoal = 0;
  /** decalage horizontal du frustum, en unites a zoom 1 (cadrage de section) */
  private ox = 0;
  /** relus dans chaque frame rendue (jumeaux, trace du panneau) : un tableau, pas d'iterateur par frame */
  private viewListeners: (() => void)[] = [];
  /** appeles quand la boucle s'arrete et apres un redimensionnement (jumeaux) */
  private idleListeners: (() => void)[] = [];
  /** densite de pixels observee : un ecran 1x -> 2x ne change pas la taille CSS */
  private dprMql: MediaQueryList | null = null;
  private unsubSection: () => void;
  private unsubMix: () => void;
  /** les quatre puces (allumees pendant l'ouverture et vue ouverte) */
  private chipDefs: HotspotDef[];
  /** les TWEAKS du MM-RYTM sous le capot (2026-10-04, audio/kit.ts) */
  readonly rytmTweaks: RytmTweaks;
  private tweakDefs: HotspotDef[];
  private unsubKit: () => void = () => undefined;
  private unsubPlay: () => void = () => undefined;
  /** la barre de progression de l'ecran (ligne 3), active quand elle est affichee */
  private seekDef!: HotspotDef;
  /** les touches de l'ecran (mode presets, 2026-10-04) */
  private lcdDefs: HotspotDef[] = [];
  private unsubPresets: () => void = () => undefined;
  private unsubSeek: () => void = () => undefined;
  private raycaster = new Raycaster();
  /** les puces repondent (ouverture decouverte, vue ouverte) */
  private chipsOn = false;
  /** puce sous la souris, puce dont le jumeau a le focus clavier */
  private hoverChip: ChipId | null = null;
  private focusChip: ChipId | null = null;
  /** puces soulevees (et LABEL allumee) : survolees ou au focus */
  private hotChips = new Set<ChipId>();
  /** vue eclatee visee : true pendant l'ouverture et vue ouverte */
  private explodeGoal = false;
  /** le capot du MM-ARP : ouvert (ou s'ouvrant) a la derniere notification */
  private voyGoal = false;
  private unsubExplode: () => void;
  private detachExplode: () => void;
  /** intro (spec 7.4) : en cours ; son horloge (ms, chaque image avance de maxStepMs au plus), la derniere image */
  private introOn = false;
  private introClock = 0;
  private introLast = -1;
  /** l'intro d'une machine (2026-10-05) : celle qui s'ouvre et se ferme, le cote d'ou arrive la camera */
  private introPick: MachineId = 'mm808';
  private introSign = 1;
  /** le MM-DECKS arrive pendant l'intro : pose a sa fin (pas de saccade, pas de saut de cadrage) */
  private pendingDj: typeof DjRig | null = null;
  private pendingBass: typeof BassRig | null = null;
  /** le MM-VOYAGER (2026-10-03, ?voyager=1), null sans lui */
  readonly voy: VoyagerRig | null;
  /** le MM-DECKS (2026-10-04), accroche une fois son code arrive (attachDj) ; null avant, et sans lui (?dj=0) */
  dj: DjRig | null = null;
  /** le MM-BASS (2026-10-07) : son code arrive a part (state/bassload.ts) ; null avant, et sans lui (?bass=0) */
  bass: BassRig | null = null;
  /** l'anisotropie des textures, gardee pour le MM-DECKS qui arrive apres le constructeur */
  private aniso = 1;
  /** cadrage de la cible : courant, depart et arrivee du zoom, cibles, avancement (courbe appliquee) */
  private fr!: Frame;
  private frFrom!: Frame;
  private frTo!: Frame;
  private fFrom: Focus = 'mm808';
  private fTo: Focus = 'mm808';
  private focusK = 1;
  private unsubFocus: () => void = () => undefined;
  private unsubEditor: () => void = () => undefined;
  private unsubPatterns: () => void = () => undefined;
  private unsubVoyExplode: () => void = () => undefined;
  private unsubBassExplode: () => void = () => undefined;
  private bassGoal = false;
  private unsubView: () => void = () => undefined;
  private unsubDjUnit: () => void = () => undefined;
  /** abscisses des machines au depart du zoom (le bout qui depasse les deplace) */
  private nbFrom: Record<MachineId, number> = { mm808: 0, voy: VOY_X, bass: bassX(), dj: DJ_X };
  /** survol du bout de la machine voisine : 0 a 1 */
  private peekHover = 0;
  /**
   * Le panneau HTML pose sous une machine (la playlist du MM-DECKS, la
   * suite du MM-ARP) : sa hauteur (px CSS), courante et visee, et celle de
   * l'en-tete au-dessus ; le cadrage de la machine tient entre les deux.
   */
  private insets: Record<MachineId, { cur: number; goal: number; top: number }> = {
    mm808: { cur: 0, goal: 0, top: 0 },
    voy: { cur: 0, goal: 0, top: 0 },
    bass: { cur: 0, goal: 0, top: 0 },
    dj: { cur: 0, goal: 0, top: 0 },
  };

  static create(opts: StageOpts): Stage | null {
    let canvas: HTMLCanvasElement | null = null;
    let renderer: WebGLRenderer | null = null;
    try {
      canvas = document.createElement('canvas');
      canvas.className = 'v4-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      opts.host.appendChild(canvas);
      // three 0.186 exige WebGL2 : sans lui le constructeur leve, on rend le repli
      renderer = new WebGLRenderer({
        canvas,
        // Lisse aussi sur mobile (2026-10-01) : sans, les aretes crenelaient
        antialias: true,
        // Machine noire : transparent, la page porte le granite (BACKDROP)
        alpha: BACKDROP.transparent,
        powerPreference: 'high-performance',
      });
      // En production, pas de verification des shaders : elle bloquait le fil principal a chaque programme (2026-10-05)
      renderer.debug.checkShaderErrors = opts.dev;
      return new Stage(opts, canvas, renderer);
    } catch (e) {
      opts.onError('create', msg(e));
      // Pas de machine, pas d'intro en attente
      intro.set('done');
      // Un echec APRES la creation du contexte : on le rend tout de suite, il
      // compterait sinon dans le plafond de contextes du navigateur
      if (renderer) {
        try {
          renderer.dispose();
          renderer.forceContextLoss();
        } catch {
          /* contexte deja perdu */
        }
      }
      canvas?.remove();
      return null;
    }
  }

  private constructor(opts: StageOpts, canvas: HTMLCanvasElement, renderer: WebGLRenderer) {
    this.opts = opts;
    this.canvas = canvas;
    this.renderer = renderer;
    const mobile = opts.mobile;
    this.layoutMql = window.matchMedia(MOBILE_QUERY);
    this.coarseMql = window.matchMedia(COARSE_QUERY);
    this.layoutMobile = this.layoutMql.matches;
    // Cadrage de depart : la cible du store (la 808 seule sans le MM-VOYAGER)
    this.fTo = this.fFrom = VOYAGER ? focus.get() : 'mm808';
    this.fr = this.frameOf(this.fTo);
    this.frFrom = { ...this.fr };
    this.frTo = { ...this.fr };

    renderer.setPixelRatio(this.dprCap());
    renderer.setClearColor(COLOR.ink, BACKDROP.transparent ? 0 : 1);
    // Machine claire (2026-10-01) : la courbe Neutral garde ses blancs et l'orange ;
    // l'ACES de la machine noire les grisait
    renderer.toneMapping = APPEARANCE.current === 'light' ? NeutralToneMapping : ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE.value;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    // three 0.186 a retire PCFSoftShadowMap (il avertit puis bascule sur PCF) :
    // PCF avec shadow.radius donne la meme ombre douce, sans l'avertissement
    renderer.shadowMap.type = PCFShadowMap;

    // La carte d'ombre n'est refaite que si une ombre a pu changer : une
    // frame ou seule la camera tourne la reutilise (lumiere et machine fixes)
    renderer.shadowMap.autoUpdate = false;

    // Camera : posee par l'orbite (vue par defaut azimut 45, elevation 38)
    this.camera = new PerspectiveCamera(ORBIT.fovDeg, 1, ORBIT.near, ORBIT.far);
    this.orbit = new Orbit({
      camera: this.camera,
      input: opts.input,
      wake: () => this.kick(),
      onZoom: () => this.updateCamera(),
      reduced: motion.reduced,
    });

    // Lumiere principale : blanc chaud, seule a projeter une ombre ; fixe
    // dans le monde, sa camera d'ombre couvre la machine sous tous les angles
    const key = new DirectionalLight(LIGHT_KEY.color, LIGHT_KEY.intensity);
    key.position.set(LIGHT_KEY.x, LIGHT_KEY.y, LIGHT_KEY.z);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    const map = mobile ? LIGHT_KEY.mapSize.mobile : LIGHT_KEY.mapSize.desktop;
    key.shadow.mapSize.set(map, map);
    const sc = key.shadow.camera;
    sc.left = -LIGHT_KEY.extent;
    sc.right = LIGHT_KEY.extent;
    sc.top = LIGHT_KEY.extent;
    sc.bottom = -LIGHT_KEY.extent;
    sc.near = LIGHT_KEY.near;
    sc.far = LIGHT_KEY.far;
    sc.updateProjectionMatrix();
    key.shadow.bias = LIGHT_KEY.bias;
    key.shadow.normalBias = LIGHT_KEY.normalBias;
    key.shadow.radius = mobile ? LIGHT_KEY.radius.mobile : LIGHT_KEY.radius.desktop;
    this.key = key;
    this.hemi = new HemisphereLight(LIGHT_HEMI.sky, LIGHT_HEMI.ground, LIGHT_HEMI.intensity);
    // Lisere chaud : un PointLight sans ombre (section 19 point 80)
    this.rim = new PointLight(LIGHT_RIM.color, LIGHT_RIM.intensity, 0, LIGHT_RIM.decay);
    this.rim.position.set(LIGHT_RIM.x, LIGHT_RIM.y, LIGHT_RIM.z);
    // Contre-jour (R2-13) : la cle n'atteint jamais la face arriere
    this.back = new DirectionalLight(LIGHT_BACK.color, LIGHT_BACK.intensity);
    this.back.position.set(LIGHT_BACK.x, LIGHT_BACK.y, LIGHT_BACK.z);
    this.back.target.position.set(0, 0, 0);
    this.scene.add(key, key.target, this.hemi, this.rim, this.back, this.back.target);

    // La machine (chassis en coin, panneau brosse), sa serigraphie, le sol
    // (enfant du socle : il suit l'intro, jamais la vue eclatee) ; le
    // brossage sans anisotropie (il doit se fondre de loin, voir silk.ts),
    // les textures a texte avec
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.brush = makeBrushTexture();
    this.machine = new Machine(mobile, this.brush);
    this.silk = new PanelSilk(mobile, aniso);
    // La face arriere (2026-10-01) : logo, noms des prises, numero de serie
    this.backPlate = new BackPlate(mobile, aniso);
    this.machine.socle.add(this.backPlate.mesh);
    // Les logos du panneau arrivent pendant l'intro : un redessin de la serigraphie
    void whenLogos().then(() => {
      if (this.disposed) return;
      this.silk.draw();
      this.backPlate.draw();
      this.repaint();
    });
    const plateau = this.machine.plateau;
    plateau.add(this.silk.mesh);
    this.floor = new Floor();
    // Le sol est a la scene (2026-10-03) : il reste quand la vue cache une machine
    this.scene.add(this.floor.mesh);
    this.scene.add(this.machine.root);

    // Moitie droite : les 12 pads (ils projettent leur ombre sur mobile
    // aussi ; leur lumiere seule ne refait pas la carte d'ombre)
    this.pads = new Pads({
      tweens: this.tweens,
      reduced: motion.reduced,
      repaint: () => this.repaint(),
      castShadow: true,
      mobile,
    });
    // Bas : touches trig, RUN/STOP, CLEAR, LED ; moitie gauche : les six encodeurs
    this.seq = new Sequencer3D({ mobile });
    this.encoders = new Encoders({ mobile, castShadow: !mobile });
    plateau.add(this.pads.mesh, this.pads.halos, this.seq.keys, this.seq.frames, this.seq.buttons, this.seq.leds, this.seq.btnLeds, this.encoders.mesh, this.encoders.skirts);
    // L'ecran (redessine 4 fois par seconde au plus, jamais par frame) ; il
    // ne s'abonne a state/lcd.ts qu'avec les autres ecouteurs
    this.screen = new Screen(aniso, () => this.repaint(), mobile);
    plateau.add(this.screen.mesh);
    // PCB : la carte et ses composants, dans le chassis. Plus de puces de pages
    // (2026-10-04, Mika : "a la place des liens de mauditemachine qui sont deja dans
    // le header") : la plaque des TWEAKS du kit, qui pousse avec les composants
    this.pcb = new Pcb(mobile, aniso, { chips: false, clear: rytmTweakClear() });
    this.machine.pcb.add(this.pcb.board, this.pcb.parts);
    this.rytmTweaks = new RytmTweaks({ mobile, anisotropy: aniso });
    this.pcb.parts.add(this.rytmTweaks.group);
    this.explode = new Explode({ plateau, pcb: this.machine.pcb, parts: this.pcb.parts }, (open) => explodeState.settle(open));
    // Une seule boite relue a chaque frame par le picking (aucune allocation)
    const sizeBox = { w: 1, h: 1 };
    this.hit = new HitMap(
      this.camera,
      () => {
        sizeBox.w = this.width;
        sizeBox.h = this.height;
        return sizeBox;
      },
      () => this.coarseMql.matches
    );
    // Ordre de la liste = ordre de tabulation des jumeaux (spec 20.19) : les
    // 12 pads (4 voix, 7 pages, OPEN), les quatre puces (juste apres OPEN
    // qui les decouvre), les six encodeurs, RUN, CLEAR, les 16 pas
    const padDefs = this.pads.hotspots(plateau);
    this.hit.add(padDefs);
    this.chipDefs = this.pcb.hotspots(this.machine.pcb);
    this.hit.add(this.chipDefs);
    // Les TWEAKS juste apres OPEN qui les decouvre
    this.tweakDefs = this.rytmTweaks.hotspots();
    this.hit.add(this.tweakDefs);
    const encDefs = ENCODERS.map((e) => this.encoders.hotspot(e.id, plateau));
    this.hit.add(encDefs);
    const seqDefs = this.seq.hotspots(plateau);
    this.stepDefs = seqDefs.filter((d) => d.kind === 'step');
    this.hit.add(seqDefs.filter((d) => d.kind !== 'step'));
    this.hit.add(this.stepDefs);
    // La bande de la ligne 3 de l'ecran (2026-10-01) : la barre de progression
    // de la piste courante, cliquable seulement quand elle est affichee
    {
      this.seekDef = {
        id: 'seek',
        kind: 'seek',
        layer: plateau,
        shape: 'box',
        x: OLED.x,
        ...seekBox(OLED_BAR),
        hx: OLED.w / 2,
        y0: OLED.y - 0.005,
        y1: OLED.y + 0.03,
        enabled: false,
      };
      this.hit.add([this.seekDef]);
    }
    // Les presets sur l'ecran (2026-10-04, state/presetMode.ts) : le haut de l'ecran (lignes 1 et 2)
    // ouvre le mode presets ; en mode presets, le haut a gauche et a droite (precedent, suivant), la
    // bande du bas en quatre touches (SAVE NAME DEL EXIT). La barre de la piste garde sa bande hors du mode
    {
      const [, TH] = OLED.tex;
      const zAt = (y: number): number => OLED.z - OLED.d / 2 + (y / TH) * OLED.d;
      const xAt = (u: number): number => OLED.x - OLED.w / 2 + u * OLED.w;
      const box = (key: PresetKey, u0: number, u1: number, ya: number, yb: number, enabled: boolean): HotspotDef => ({
        id: `lcd-${key}`,
        kind: 'lcd',
        lcd: key,
        layer: plateau,
        shape: 'box',
        x: (xAt(u0) + xAt(u1)) / 2,
        z: (zAt(ya) + zAt(yb)) / 2,
        hx: (xAt(u1) - xAt(u0)) / 2,
        hz: (zAt(yb) - zAt(ya)) / 2,
        y0: OLED.y - 0.005,
        y1: OLED.y + 0.03,
        enabled,
      });
      const band = OLED_BAR.bandY0;
      this.lcdDefs = [
        box('open', 0, 1, 0, band, true),
        box('prev', 0, 0.5, 0, band, false),
        box('next', 0.5, 1, 0, band, false),
        ...(['save', 'name', 'del', 'exit'] as const).map((k, i) => box(k, i / 4, (i + 1) / 4, band, TH, false)),
      ];
      this.hit.add(this.lcdDefs);
    }
    // Les volumes pleins de la machine : ils cachent ce qui est derriere eux
    // (picking, ancre de la trace) et dessinent sa silhouette (fond ou machine)
    const pd = PANEL_D / 2;
    this.hit.addOccluder({ layer: plateau, min: [-BODY.w / 2, -PANEL.t, -pd], max: [BODY.w / 2, 0, pd] });
    this.hit.addOccluder({ layer: this.machine.socle, ...wedgeOccluder() });
    this.hit.addOccluder({ layer: this.machine.pcb, min: [-PCB.w / 2, 0, -PCB.d / 2], max: [PCB.w / 2, PCB.h, PCB.d / 2] });
    // Ancres de la trace : le pad de chaque page, les puces LIVE et STUDIO
    for (const d of padDefs) if (d.section) this.anchors.set(d.section, d);
    for (const d of this.chipDefs) if (d.section) this.anchors.set(d.section, d);

    // Le MM-VOYAGER (2026-10-03) : a droite de la 808 sur la meme table ;
    // ses objets et ses volumes apres ceux de la 808, chacun marque de sa machine
    if (VOYAGER) {
      for (const d of [...padDefs, ...this.chipDefs, ...this.tweakDefs, ...encDefs, ...seqDefs, this.seekDef, ...this.lcdDefs]) d.machine = 'mm808';
      const voy = new VoyagerRig({
        mobile,
        anisotropy: aniso,
        tweens: this.tweens,
        paintTweens: this.paintTweens,
        reduced: motion.reduced,
        repaint: () => this.repaint(),
        invalidate: () => this.invalidate(),
      });
      this.voy = voy;
      this.scene.add(voy.root);
      this.hit.add(voy.hotspots);
      for (const o of voy.occluders()) this.hit.addOccluder(o);
      void whenLogos().then(() => {
        if (!this.disposed) {
          voy.redrawText();
          this.repaint();
        }
      });
    } else {
      this.voy = null;
    }
    // Le MM-DECKS (2026-10-04) : son code arrive a part (state/djload.ts), apres
    // le chargement principal ; le rig s'accroche ensuite (attachDj). Avec ?dj=0, rien
    this.aniso = aniso;
    if (VOYAGER && DJ) void djLoad.load()?.then((m) => this.attachDj(m.DjRig));
    // Le MM-BASS (2026-10-07) : de meme, entre le MM-RYTM et le MM-ARP (state/bassload.ts) ; avec ?bass=0, rien
    if (VOYAGER && BASS) void bassLoad.load()?.then((m) => this.attachBass(m.BassRig));

    // Taille initiale ; le canvas passe a l'encre tout de suite (jamais un noir pur)
    this.width = Math.max(1, opts.host.clientWidth);
    this.height = Math.max(1, opts.host.clientHeight);
    renderer.setSize(this.width, this.height, false);
    this.stats.dpr = renderer.getPixelRatio();
    this.updateCamera();
    this.orbit.apply();
    renderer.clear();

    this.animators.push(
      this.stepIntro,
      (now) => this.tweens.update(now),
      (now) => (this.paintTweens.update(now) ? 'paint' : false),
      this.stepExplode,
      (now) => this.pads.update(now),
      this.pollPlayhead,
      this.stepBreathe
    );
    const voyRig = this.voy;
    if (voyRig) {
      this.animators.push(
        (now) => {
          if (!voyRig.stepExplode(now)) return false;
          this.updateCamera();
          return true;
        },
        voyRig.stepKeys,
        voyRig.stepArp,
        voyRig.stepSeq
      );
    }
    // Intro (2026-10-01) : mouvement complet seulement ; la machine attend
    // eclatee jusqu'a la premiere frame, puis s'assemble (stepIntro).
    // Une seule machine depuis le 2026-10-05 (Mika : "aleatoirement qu'une
    // seule machine s'ouvre et se ferme et arrive en 3D zoom pour se mettre
    // dans la vue par defaut") : celle de ?m= (MM-RYTM ou MM-ARP), sinon l'une
    // des deux au hasard ; une machine sans capot demandee (?m=dj) :
    // pas d'intro, on y arrive directement.
    const st = startMachine.take();
    const hood: readonly MachineId[] = this.voy ? ['mm808', 'voy'] : ['mm808'];
    if (!motion.reduced() && !opts.skipIntro && (st === null || hood.includes(st))) {
      this.introOn = true;
      this.introPick = st ?? hood[Math.floor(Math.random() * hood.length)];
      this.introSign = Math.random() < 0.5 ? -1 : 1;
      // L'intro montre le PCB eclate : ses textures se font maintenant
      this.pcb.prepare();
      if (this.introPick === 'mm808') this.explode.assemble(0);
      if (this.voy) {
        if (this.introPick === 'voy') this.voy.assemble(0);
        focus.set(this.introPick);
        this.snapFocus();
      }
      this.introCamera(0);
      this.syncCasters();
      this.updateCamera();
      intro.set('pending');
    } else {
      intro.set('done');
      if (this.voy) {
        // Premiere arrivee sans intro (mouvement reduit) : la machine de ?m= (2026-10-04),
        // sinon desktop, la vue d'ensemble ; au telephone, jamais la vue d'ensemble hors de l'intro
        // (pris une seule fois : une reconstruction avant la fin de l'intro, React en dev, l'arrivee encore)
        if (st) focus.set(st);
        else if (!opts.skipIntro && !this.layoutMobile && focus.changes === 0) focus.set('all');
        if (this.layoutMobile && focus.get() === 'all') focus.set('mm808');
        this.snapFocus();
      }
    }
    this.placeLights();

    // Plus rien ne touche au GL d'ici la fin du constructeur : un echec plus
    // haut ne laisse donc aucun ecouteur accroche
    this.screen.listen();
    this.orbit.listen();
    this.syncMotion();
    this.unsubMotion = motion.subscribe(this.syncMotion);
    this.syncPattern();
    this.unsubPattern = pattern.subscribe(this.syncPattern);
    // Les TWEAKS suivent le kit (un glisser, la molette, un preset) : sous le capot, pas d'ombre a refaire
    this.unsubKit = kit.subscribe(() => {
      if (this.rytmTweaks.sync()) this.repaint();
      // Le potard SAMPLE (la rangee VOICE) suit le son de la voix selectionnee
      this.syncMix();
    });
    this.syncVoices();
    this.unsubVoices = voices.subscribe(this.syncVoices);
    this.syncMix();
    this.unsubMix = mix.subscribe(this.syncMix);
    // Section deja ouverte (remontage) : etat pose sans animation
    this.applySection(true);
    this.unsubSection = section.subscribe(this.syncSection);
    {
      // La bande de la barre suit aussi la vue de l'ecran (HOME, PAGE) et EDIT
      const offs = [lcd.subscribe(this.syncSeek), rytmPage.subscribe(this.syncSeek), editor.subscribe(this.syncSeek)];
      this.unsubSeek = () => {
        for (const off of offs) off();
      };
    }
    this.syncSeek();
    this.syncRun();
    const offRun = clock.subscribe(this.syncRun);
    // Chaque pas programme reveille la boucle (la tete de lecture l'allume a son heure)
    const offStep = clock.onStep(() => this.kick());
    this.unsubClock = () => {
      offRun();
      offStep();
    };
    this.syncSteps();
    // Vue eclatee deja ouverte (remontage) : posee sans animation ; puis le
    // Stage se declare, OPEN devient possible
    this.applyExplode(true);
    this.unsubExplode = explodeState.subscribe(this.syncExplode);
    this.detachExplode = explodeState.attach();
    // EDIT du MM-RYTM (2026-10-04) : allume tant que l'editeur est ouvert ; depuis le 2026-10-05,
    // les seize steps y sont les patterns (state/patterns.ts)
    const syncPatView = (): void => {
      const p = patterns.get();
      const view = editor.get() === 'mm808' ? { cur: p.cur, next: p.next, chain: p.chain, filled: Array.from({ length: PATTERN_SLOTS }, (_, i) => patterns.filled(i)) } : null;
      if (this.seq.setPatternView(view)) this.repaint();
    };
    const syncEditor = (): void => {
      if (this.pads.setEditing(editor.get() === 'mm808')) this.invalidate();
      // Le MM-ARP au desktop : l'ecran de la suite monte a la place des pads
      if (this.voy?.setSeqOpen(editor.get() === 'voy')) this.hit.invalidate();
      syncPatView();
    };
    syncEditor();
    this.unsubEditor = editor.subscribe(syncEditor);
    this.unsubPatterns = patterns.subscribe(syncPatView);
    // Le mode presets : les touches des ecrans suivent
    const syncPresets = (): void => {
      let changed = false;
      // Les deux ecrans : celui du MM-RYTM (lcd) et celui du MM-ARP (vlcd)
      const defs = [...this.lcdDefs, ...(this.voy ? this.voy.hotspots.filter((d) => d.kind === 'vlcd') : [])];
      for (const d of defs) {
        const on = presetMode.on(d.kind === 'lcd' ? 'mm808' : 'voy');
        const want = d.lcd === 'open' ? !on : on;
        if (d.enabled !== want) {
          d.enabled = want;
          changed = true;
        }
      }
      if (changed) this.hit.invalidate();
    };
    syncPresets();
    this.unsubPresets = presetMode.subscribe(syncPresets);
    // La vue verrouillee en lecture (2026-10-04, state/playLock.ts) : un geste parti sur une machine
    // qui joue ne bouge pas la vue ; une machine qui part passe devant, de face (un capot ouvert reste ouvert)
    this.orbit.lock = (x, y, mouse) => {
      const r = this.canvas.getBoundingClientRect();
      const m = this.hit.machineAt(x - r.left, y - r.top);
      if (m === null) return false;
      // Une machine qui joue ; a la souris, celle qu'on utilise (la vue tourne depuis le fond)
      return machinePlaying(m) || (mouse && focus.get() === m);
    };
    this.unsubPlay = onPlayStart((m) => {
      if (this.disposed || this.introOn) return;
      // PLAY du mixer du MM-DECKS (les machines de ses voies 1 a 3) : on reste a la table
      const at = focus.get() === 'dj' ? 'dj' : m;
      if (VOYAGER && focus.get() !== at) focus.set(at);
      else this.orbit.reset();
    });
    if (this.voy) {
      this.voy.listen();
      // Capot deja ouvert (reconstruction) : le cadrage de la pile ouverte
      this.updateCamera();
      this.unsubFocus = focus.subscribe(this.syncFocus);
      // La vue tournee cache la voisine, revenue par defaut elle la remontre
      this.unsubView = view.subscribe(() => {
        if (focus.settled()) this.setShown(this.fTo);
      });
      // Le capot du MM-VOYAGER change le cadrage (pile ouverte) : un recalcul
      this.unsubVoyExplode = voyExplode.subscribe(() => {
        const s = voyExplode.get();
        const goal = s === 'opening' || s === 'open';
        if (goal !== this.voyGoal) {
          this.voyGoal = goal;
          this.openView('voy');
        }
        this.hit.invalidate();
        this.updateCamera();
        this.invalidate();
      });
    }
    this.coarseMql.addEventListener('change', this.onCoarse);
    this.layoutMql.addEventListener('change', this.onLayout);
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.docHidden = document.visibilityState === 'hidden';
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(opts.host);
    this.watchDpr();
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(this.onIntersect, { threshold: 0 });
      this.io.observe(opts.host);
    }
    this.paused = this.docHidden;
    this.gate();
  }

  /* ---------------- API ---------------- */

  /**
   * Demande une frame (le contenu a change : la carte d'ombre est refaite
   * avec). Sans effet au repos tant que rien ne l'appelle.
   */
  invalidate(): void {
    this.dirty = true;
    this.shadowDirty = true;
    this.kick();
  }

  /**
   * Demande une frame sans passe d'ombre : seules des couleurs, des
   * emissifs ou des textures ont change (LED, flash, ecran, survol), aucun
   * objet qui projette une ombre n'a bouge.
   */
  repaint(): void {
    this.dirty = true;
    this.kick();
  }

  /**
   * Appui sur un pas (2026-10-01) : la touche s'enfonce et s'eclaire en
   * 40 ms, remonte et s'eteint en 160 ms (sans passe d'ombre : les touches
   * n'en projettent pas). Reduced motion : l'eclat seul.
   */
  pressStep(i: number): void {
    if (this.disposed || i < 0 || i >= STEP_LEDS) return;
    this.pressKey(i);
  }

  /**
   * Un bouton du transport (2026-10-01 : RUN/STOP, CLEAR, RANDOM, MUTE et
   * SOLO) s'enfonce et s'eclaire comme un pas, quel que soit son etat ; son
   * temoin brille (BTN_LED : plein, puis il s'eteint, sauf si l'etat tient).
   */
  pressButton(b: TransportButton): void {
    if (this.disposed) return;
    const flash = (v: number): void => this.seq.setButtonFlash(b, v);
    this.paintTweens.run(`btn.flash.${b}`, flash, 1, 0, BTN_LED.flashMs, holdThenOut, performance.now());
    this.pressKey(BUTTON_INDEX[b]);
  }

  private pressKey(i: number): void {
    const move = !motion.reduced();
    const set = (v: number): void => this.seq.setKeyPress(i, v, move);
    const tw = this.paintTweens;
    const key = `step.press.${i}`;
    tw.run(key, set, 0, 1, STEP_PRESS.downMs, linear, performance.now(), (end) =>
      tw.run(key, set, 1, 0, STEP_PRESS.upMs, easeOutCubic, end)
    );
    this.repaint();
  }

  /**
   * La barre de l'ecran repond au pointeur quand elle est affichee. En vue
   * PAGE du MM-RYTM (2026-10-08, state/rytmPage.ts) elle tient sur la ligne
   * du bas : sa bande descend sous la seconde rangee de blocs
   * (OLED_BAR_PAGE), EDIT garde l'ecran d'avant et sa bande.
   */
  private syncSeek = (): void => {
    const on = lcd.get().bar !== null;
    const band = seekBox(rytmPage.get().view === 'page' && editor.get() !== 'mm808' ? OLED_BAR_PAGE : OLED_BAR);
    if (this.seekDef.enabled === on && this.seekDef.z === band.z && this.seekDef.hz === band.hz) return;
    this.seekDef.enabled = on;
    this.seekDef.z = band.z;
    this.seekDef.hz = band.hz;
    this.hit.invalidate();
  };

  /**
   * Clic sur la barre de l'ecran (2026-10-01), en px CSS de la fenetre : le
   * point touche sur l'ecran (rayon de la camera, coordonnee de texture)
   * donne la position dans la piste. true si la piste a avance.
   */
  seekAt(clientX: number, clientY: number): boolean {
    const b = this.screen.bar;
    if (!b) return false;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, 1 - ((clientY - rect.top) / rect.height) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.screen.mesh, false)[0];
    if (!hit || !hit.uv) return false;
    const px = hit.uv.x * OLED.tex[0];
    return sc.seek((px - b.x0) / (b.x1 - b.x0));
  }

  /** Alias du contrat debug (spec 14.1). */
  requestRender(): void {
    this.invalidate();
  }

  /** Branche un animateur ; renvoie sa fonction de retrait. */
  addAnimator(fn: Animator): () => void {
    this.animators.push(fn);
    this.kick();
    return () => {
      const i = this.animators.indexOf(fn);
      if (i >= 0) this.animators.splice(i, 1);
    };
  }

  get pxPerUnit(): number {
    return this.ppu;
  }

  /**
   * Le MM-DECKS arrive (son code charge a part) : a droite du MM-ARP, ses
   * objets apres les siens, comme s'il avait ete construit avec la scene ;
   * ses animations (platines, VU, anneaux des jogs, ecrans), son ecoute,
   * le bloc du telephone ; puis la scene se recadre.
   */
  private attachDj(Rig: typeof DjRig): void {
    if (this.disposed || this.dj) return;
    // Pendant l'intro : a sa fin (sa construction et ses shaders ne saccadent pas l'arrivee)
    if (this.introOn) {
      this.pendingDj = Rig;
      return;
    }
    const dj = new Rig({
      mobile: this.opts.mobile,
      anisotropy: this.aniso,
      reduced: motion.reduced,
      repaint: () => this.repaint(),
      invalidate: () => this.invalidate(),
    });
    this.dj = dj;
    this.scene.add(dj.root);
    this.hit.add(dj.hotspots);
    for (const o of dj.occluders()) this.hit.addOccluder(o);
    void whenLogos().then(() => {
      if (!this.disposed) dj.redrawText();
    });
    this.animators.push(dj.step);
    dj.listen();
    this.unsubDjUnit = djView.subscribe(this.syncDjUnit);
    this.setShown(this.fTo);
    this.updateCamera();
    this.precompile();
    this.invalidate();
  }

  /**
   * Le MM-BASS arrive (son code charge a part) : entre le MM-RYTM et le
   * MM-ARP ; ses animations (la tete de lecture, l'ecran), son ecoute ;
   * puis la scene se recadre.
   */
  private attachBass(Rig: typeof BassRig): void {
    if (this.disposed || this.bass) return;
    if (this.introOn) {
      this.pendingBass = Rig;
      return;
    }
    const bs = new Rig({
      mobile: this.opts.mobile,
      anisotropy: this.aniso,
      reduced: motion.reduced,
      repaint: () => this.repaint(),
      invalidate: () => this.invalidate(),
      hitChanged: () => {
        this.hit.invalidate();
        this.invalidate();
      },
    });
    this.bass = bs;
    this.scene.add(bs.root);
    this.hit.add(bs.hotspots);
    for (const o of bs.occluders()) this.hit.addOccluder(o);
    void whenLogos().then(() => {
      if (!this.disposed) bs.redrawText();
    });
    // Son capot (2026-10-08) : les couches, puis le cadrage qui les suit
    this.animators.push(bs.step, (now) => {
      if (!bs.stepExplode(now)) return false;
      this.updateCamera();
      return true;
    });
    bs.listen();
    this.bassGoal = bassExplode.get() === 'opening' || bassExplode.get() === 'open';
    // OPEN et CLOSE : la vue repart de la vue par defaut, le cadrage rejoint l'interieur (ou revient)
    this.unsubBassExplode = bassExplode.subscribe(() => {
      const st = bassExplode.get();
      const goal = st === 'opening' || st === 'open';
      if (goal !== this.bassGoal) {
        this.bassGoal = goal;
        this.openView('bass');
      }
      this.hit.invalidate();
      this.updateCamera();
      this.invalidate();
    });
    this.setShown(this.fTo);
    this.updateCamera();
    this.precompile();
    this.invalidate();
  }

  /**
   * Les programmes d'une machine arrivee, compiles en parallele (2026-10-05) :
   * sa premiere visite ne bloque plus le fil principal (au telephone, une
   * demi-seconde et plus : la musique se coupait).
   */
  private precompile(): void {
    try {
      void this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined);
    } catch {
      /* rien : la premiere image compilera */
    }
  }

  /**
   * Cadrage (spec 20.2.5), fixe par mise en page et proportions, jamais
   * par orientation : tourner ne fait pas "respirer" la machine.
   * 1. Base : 78 % desktop, 92 % mobile de l'empreinte a la vue par defaut,
   *    86 % de la hauteur au plus.
   * 2. Vue eclatee : la pile dans 86 % de la hauteur (le frustum s'agrandit
   *    si besoin, jamais sur un telephone en portrait) ; le pivot de
   *    l'orbite monte de ORBIT.targetY a EXPLODE.targetY.
   * 3. Section ouverte (desktop) : le centre de la machine passe a
   *    stageW / 2 (stageW = bord gauche du panneau - 16) et son cercle
   *    englobant y tient : aucun azimut ne la met sous le panneau a zoom
   *    <= 1 ; jamais plus grande qu'au repos. 400 ms (retargetFraming).
   * 4. Camera perspective (2026-10-01) : hw est la demi-largeur vue dans le
   *    plan du pivot ; la distance de la camera en decoule (champ ORBIT.fovDeg),
   *    le decalage de section passe par setViewOffset, en px (le zoom ne
   *    deplace donc jamais le centre de la machine).
   * 5. Zoom (orthographique, historique) : le decalage du frustum est divise par camera.zoom (three
   *    centre le frustum zoome sur (left + right) / 2) : zoomer ne deplace
   *    jamais le centre de la machine hors de sa zone libre.
   */
  private updateCamera(): void {
    const W = this.width;
    const aspect = W / this.height;
    // La cible (2026-10-03) : la 808, le MM-VOYAGER ou les deux, interpolee pendant le zoom
    const F = this.fr;
    // Le MM-DECKS et le MM-ARP (2026-10-04) : un panneau occupe le bas (playlist, suite) ; la machine
    // tient au-dessus, centree dans la hauteur libre (interpolee pendant le zoom d'une machine a l'autre)
    const k = this.focusK;
    let insetPx = 0;
    let headPx = 0;
    for (const id of ['mm808', 'voy', 'bass', 'dj'] as const) {
      const w = (this.fFrom === id ? 1 - k : 0) + (this.fTo === id ? k : 0);
      insetPx += this.insets[id].cur * w;
      headPx += this.insets[id].top * w;
    }
    const inset = Math.min(this.height * 0.7, insetPx);
    const head = Math.min(this.height * 0.2, headPx);
    const free = Math.max(1, this.height - inset - head);
    const hwBase = Math.max(F.hw0, (F.h / FIT_H / 2) * (W / free));
    const e = this.explodeFrame();
    // Ouvert (desktop, 2026-10-05) : l'interieur (la plaque et sa carte) remplit la vue ; sinon la pile entiere
    const inner = F.openW > 0;
    const hwOpen = inner ? Math.max(F.openW / 2 / OPEN_VIEW.fill, (OPEN_VIEW.h / FIT_H / 2) * (W / free)) : Math.max(hwBase, F.fitHalfH * aspect);
    let hw = hwBase + (hwOpen - hwBase) * e;
    const t = this.layoutMobile ? 0 : this.secT;
    // Decalage du centre de la machine vers la gauche, en px (cadrage de section)
    let shiftPx = 0;
    if (t > 0) {
      const R = F.rClosed + (F.rOpen - F.rClosed) * e;
      const stageW = Math.max(W / 3, panelLeft(W) - SECTION_FRAME.gap);
      // Echelle min(celle du repos, stageW / 2R) : demi-largeur max(hw, W R / stageW)
      const hwS = Math.max(hw, (W * R) / stageW);
      hw += (hwS - hw) * t;
      shiftPx = ((W - stageW) / 2) * t;
    }
    // px -> unites a l'echelle courante (zoom 1) : le centre de la machine reste a stageW / 2
    const ox = shiftPx * ((2 * hw) / W);
    const hh = hw / aspect;
    const c = this.camera;
    const z = c.zoom;
    c.aspect = aspect;
    // La machine glisse a gauche du panneau, et au-dessus de la playlist du MM-DECKS : la fenetre de rendu se decale, en px
    const shiftY = (inset - head) / 2;
    if (shiftPx > 0 || shiftY !== 0) c.setViewOffset(W, this.height, shiftPx, shiftY, W, this.height);
    else c.clearViewOffset();
    c.updateProjectionMatrix();
    this.hw = hw;
    this.ox = ox;
    this.ppu = (W * z) / (2 * hw);
    // Distance : la demi-hauteur hh tient dans le champ vertical, au pivot
    const D = hh / Math.tan((ORBIT.fovDeg * Math.PI) / 360);
    // Le pivot monte avec la pile eclatee : la camera suit
    const ty = F.ty + ((inner ? F.openY : F.explodeTy) - F.ty) * e;
    const tz = inner ? F.openZ * e : 0;
    if (this.orbit.target.y !== ty || this.orbit.target.z !== tz || this.orbit.distance !== D || this.orbit.target.x !== F.cx) {
      this.orbit.target.x = F.cx;
      this.orbit.target.y = ty;
      this.orbit.target.z = tz;
      this.orbit.distance = D;
      this.orbit.place();
    }
    this.placeNeighbors(hw);
  }

  /**
   * Le bout qui depasse (desktop) : une machine utilisee, l'autre se place
   * pour que son bord interieur tombe a PEEK.px du bord de l'ecran (mesure
   * dans le plan du pivot, quelle que soit la largeur de la fenetre) ; vue
   * d'ensemble et telephone : chacune chez elle. Pendant un zoom, les
   * machines glissent avec lui. Le sol suit (ombres de contact).
   */
  private placeNeighbors(hw: number): void {
    const voy = this.voy;
    if (!voy) return;
    const dj = this.dj;
    const bs = this.bass;
    const f = this.fTo;
    const u = (2 * hw) / Math.max(1, this.width);
    // Capot ouvert (2026-10-08, la revue de l'OPEN moins zoome) : les voisines et leurs ecrans vivants sortent du
    // cadre, une marge calme autour de la carte ; elles reviennent avec la fermeture (ferme : Mika, tache 85).
    // Pas pendant l'intro (la machine eclatee qui s'assemble) : les voisines y restent ou elles etaient
    const e = this.introOn ? 0 : this.explodeFrame();
    const peek = ((PEEK.px + PEEK.hoverPx * this.peekHover) * (1 - e) - PEEK.openPx * e) * u;
    const cx = this.fr.cx;
    // Chez elles (vue d'ensemble, telephone) ; une machine utilisee : ses voisines au bord.
    // L'ordre (2026-10-07) : MM-RYTM, MM-BASS, MM-ARP, MM-DECKS (state/focus.ts MACHINES) : celle de gauche
    // et celle de droite de la machine utilisee depassent
    const home: Record<MachineId, number> = { mm808: 0, bass: bassX(), voy: VOY_X, dj: DJ_X };
    const half: Record<MachineId, number> = { mm808: BODY.w / 2, bass: BASS_W / 2, voy: VOY_BODY.w / 2, dj: DJ_W / 2 };
    const goal: Record<MachineId, number> = { ...home };
    const at = f === 'all' ? -1 : MACHINES.indexOf(f);
    if (!this.layoutMobile && at >= 0 && f !== 'all') {
      const left = MACHINES[at - 1];
      const right = MACHINES[at + 1];
      if (left) goal[left] = Math.min(home[f] - half[f] - PEEK.gap - half[left], cx - hw + peek - half[left]);
      if (right) goal[right] = Math.max(home[f] + half[f] + PEEK.gap + half[right], cx + hw - peek + half[right]);
    }
    const k = this.focusK;
    const x808 = this.nbFrom.mm808 + (goal.mm808 - this.nbFrom.mm808) * k;
    const xVoy = this.nbFrom.voy + (goal.voy - this.nbFrom.voy) * k;
    const xDj = this.nbFrom.dj + (goal.dj - this.nbFrom.dj) * k;
    const xBass = this.nbFrom.bass + (goal.bass - this.nbFrom.bass) * k;
    let moved = false;
    if (this.machine.root.position.x !== x808) {
      this.machine.root.position.x = x808;
      moved = true;
    }
    if (voy.root.position.x !== xVoy) {
      voy.root.position.x = xVoy;
      moved = true;
    }
    if (dj && dj.root.position.x !== xDj) {
      dj.root.position.x = xDj;
      moved = true;
    }
    if (bs && bs.root.position.x !== xBass) {
      bs.root.position.x = xBass;
      moved = true;
    }
    if (this.floor.setCenters(x808, xVoy, xDj, xBass)) moved = true;
    if (moved) {
      this.shadowDirty = true;
      this.dirty = true;
    }
  }

  /**
   * La hauteur (px CSS) du panneau pose sous une machine en bas de l'ecran
   * (la playlist du MM-DECKS, la suite du MM-ARP, l'editeur du MM-RYTM), et celle de l'en-tete en
   * haut : son cadrage tient entre les deux (200 ms). 0 : pas de panneau.
   */
  setInset(id: MachineId, px: number, top = 0): void {
    if (this.disposed) return;
    const st = this.insets[id];
    const goal = Math.max(0, Math.round(px));
    const t = Math.max(0, Math.round(top));
    if (t !== st.top) {
      st.top = t;
      this.updateCamera();
      this.invalidate();
    }
    if (goal === st.goal) return;
    st.goal = goal;
    this.tweens.run(
      `inset.${id}`,
      (v) => {
        st.cur = v;
        this.updateCamera();
      },
      st.cur,
      goal,
      motion.reduced() ? 0 : 200,
      easeOutCubic,
      performance.now()
    );
    this.invalidate();
  }

  /** La playlist du MM-DECKS (dj/TrackBrowser.tsx) : setInset('dj'). */
  setDjInset(px: number, top = 0): void {
    this.setInset('dj', px, top);
  }

  /** Survol du bout de la machine voisine : il sort un peu (180 ms). */
  setPeekHover(on: boolean): void {
    if (!this.voy || this.disposed) return;
    const goal = on && focus.get() !== 'all' ? 1 : 0;
    this.tweens.run(
      'peek.hover',
      (v) => {
        this.peekHover = v;
        this.updateCamera();
      },
      this.peekHover,
      goal,
      motion.reduced() ? 0 : PEEK.ms,
      easeOutCubic,
      performance.now()
    );
    this.kick();
  }

  /* ---------------- deux machines (2026-10-03) ---------------- */

  /**
   * Le cadrage d'une cible. La 808 : ses constantes d'origine (desktop :
   * la largeur projetee a l'azimut 45, mobile : la largeur de face). Le
   * MM-VOYAGER : les siennes (voyager/theme.ts). Les deux : de la joue
   * gauche de la 808 a la joue droite du Voyager, 88 % de la largeur.
   */
  private frameOf(f: Focus): Frame {
    const mob = this.layoutMobile;
    const m808: Frame = {
      cx: 0,
      hw0: mob ? FRONT_W / 2 / FRAME_MOBILE : f === 'mm808' ? BODY.w / 2 / SINGLE_FILL : PLATEAU_W / 2 / FRAME_DESKTOP,
      h: !mob && f === 'mm808' ? BODY.d + 0.5 : MACHINE_H,
      ty: ORBIT.targetY,
      explodeTy: EXPLODE.targetY,
      rClosed: SECTION_FRAME.radius.closed,
      rOpen: SECTION_FRAME.radius.open,
      fitHalfH: EXPLODE.fitHalfH,
      extent: LIGHT_KEY.extent,
      // La carte entiere et ses TWEAKS soudes (OPEN_VIEW ; 2026-10-08, moins zoome), au telephone aussi
      openW: RYTM_OPEN_FRAME.w,
      openY: RYTM_OPEN_FRAME.y,
      openZ: RYTM_OPEN_FRAME.z,
    };
    if (!VOYAGER || f === 'mm808') return m808;
    const voy: Frame = {
      cx: VOY_X,
      hw0: mob ? VOY_BODY.w / 2 / FRAME_MOBILE : f === 'voy' ? VOY_BODY.w / 2 / SINGLE_FILL : VOY_FRAME.plate / 2 / FRAME_DESKTOP,
      h: VOY_FRAME.h,
      ty: VOY_FRAME.targetY,
      explodeTy: VOY_FRAME.explodeTargetY,
      rClosed: VOY_FRAME.radius.closed,
      rOpen: VOY_FRAME.radius.open,
      fitHalfH: VOY_FRAME.fitHalfH,
      extent: LIGHT_KEY.extent + 1,
      openW: VOY_OPEN_FRAME.w,
      openY: VOY_OPEN_FRAME.y,
      openZ: VOY_OPEN_FRAME.z,
    };
    if (f === 'voy') return voy;
    // Le MM-DECKS : l'ensemble de face (deux platines, la table) ; au telephone, un bloc a la fois
    const u = djView.get();
    const dj: Frame = {
      cx: mob ? DJ_X + UNIT_X[u] : DJ_X,
      hw0: mob ? unitW(u) / 2 / FRAME_MOBILE : DJ_W / 2 / DJ_FRAME.fill,
      h: DJ_FRAME.h,
      ty: DJ_FRAME.targetY,
      explodeTy: DJ_FRAME.targetY,
      rClosed: DJ_FRAME.radius.closed,
      rOpen: DJ_FRAME.radius.open,
      fitHalfH: DJ_FRAME.h / 2,
      extent: mob ? unitW(u) / 2 + 3 : DJ_FRAME.extent,
      openW: 0,
      openY: DJ_FRAME.targetY,
      openZ: 0,
    };
    if (f === 'dj') return dj;
    // Le MM-BASS (2026-10-07) : le bloc entier de face, comme une platine du MM-DECKS ; ouvert (2026-10-08),
    // sa plaque TWEAKS et sa carte (OPEN_VIEW), au telephone aussi
    const bass: Frame = {
      cx: bassX(),
      hw0: BASS_W / 2 / (mob ? FRAME_MOBILE : SINGLE_FILL),
      h: BASS_FRAME.h,
      ty: BASS_FRAME.targetY,
      explodeTy: DJ_TOP_Y + BASS_OPEN_FRAME.y,
      rClosed: BASS_W / 2 + 0.6,
      rOpen: BASS_W / 2 + 0.6,
      fitHalfH: BASS_FRAME.h / 2,
      extent: BASS_W / 2 + (mob ? 3 : 2),
      openW: BASS_OPEN_FRAME.w + OPEN_VIEW.margin,
      openY: DJ_TOP_Y + BASS_OPEN_FRAME.y,
      openZ: BASS_OPEN_FRAME.z,
    };
    if (f === 'bass') return bass;
    const left = -BODY.w / 2;
    const right = DJ ? DJ_X + DJ_W / 2 : VOY_X + VOY_BODY.w / 2;
    const half = (right - left) / 2;
    return {
      cx: (left + right) / 2,
      hw0: half / (mob ? OVERVIEW_FILL.mobile : OVERVIEW_FILL.desktop),
      h: Math.max(m808.h, voy.h, DJ ? dj.h : 0, BASS ? bass.h : 0),
      ty: (m808.ty + voy.ty) / 2,
      explodeTy: Math.max(m808.explodeTy, voy.explodeTy),
      rClosed: half + 1,
      rOpen: half + 1.8,
      fitHalfH: Math.max(m808.fitHalfH, voy.fitHalfH),
      extent: half + 5,
      openW: 0,
      openY: Math.max(m808.explodeTy, voy.explodeTy),
      openZ: 0,
    };
  }

  /** Avancement de l'ouverture de la cible (les deux : la plus ouverte), interpole pendant le zoom. */
  private explodeOf(f: Focus): number {
    const a = this.explode.p.frame;
    const b = this.voy ? this.voy.explode.p.frame : 0;
    if (f === 'bass') return this.bass ? this.bass.explode.p.frame : 0;
    return f === 'mm808' ? a : f === 'voy' ? b : f === 'dj' ? 0 : Math.max(a, b);
  }

  private explodeFrame(): number {
    const k = this.focusK;
    return k >= 1 ? this.explodeOf(this.fTo) : this.explodeOf(this.fFrom) * (1 - k) + this.explodeOf(this.fTo) * k;
  }

  /**
   * Lumieres de la cible : la cle (et sa camera d'ombre, etendue a la
   * cible), le contre-jour et le lisere suivent le centre ; la carte
   * d'ombre est a refaire.
   */
  private placeLights(): void {
    const F = this.fr;
    const cx = F.cx;
    this.key.position.set(LIGHT_KEY.x + cx, LIGHT_KEY.y, LIGHT_KEY.z);
    this.key.target.position.set(cx, 0, 0);
    this.key.target.updateMatrixWorld();
    const sc = this.key.shadow.camera;
    if (sc.right !== F.extent) {
      sc.left = -F.extent;
      sc.right = F.extent;
      sc.top = F.extent;
      sc.bottom = -F.extent;
      sc.updateProjectionMatrix();
    }
    this.back.position.set(LIGHT_BACK.x + cx, LIGHT_BACK.y, LIGHT_BACK.z);
    this.back.target.position.set(cx, 0, 0);
    this.back.target.updateMatrixWorld();
    // Le lisere jaune reste a gauche de la machine utilisee (vue d'ensemble : la 808)
    this.rim.position.x = LIGHT_RIM.x + (this.fTo === 'voy' || this.fTo === 'dj' || this.fTo === 'bass' ? cx : 0);
    this.shadowDirty = true;
  }

  /**
   * Machines montrees : les deux pendant un zoom et en vue d'ensemble ;
   * celle qu'on utilise seulement, une fois arrivee (l'orbite ne la fait
   * jamais passer derriere l'autre). Le sol suit (ombres de contact).
   */
  private setShown(f: Focus): void {
    const voy = this.voy;
    if (!voy) return;
    // Desktop, vue par defaut : la voisine reste, au bord (le bout qui depasse) ;
    // la vue tournee, elle se cache (elle passerait devant)
    const peek = !this.layoutMobile && !view.get();
    const dj = this.dj;
    const bs = this.bass;
    // Les voisines immediates seulement, dans l'ordre de la scene (state/focus.ts MACHINES :
    // MM-RYTM, MM-BASS, MM-ARP, MM-DECKS)
    const at = f === 'all' ? -1 : MACHINES.indexOf(f);
    const shown = (id: MachineId): boolean => f === 'all' || id === f || (peek && at >= 0 && Math.abs(MACHINES.indexOf(id) - at) === 1);
    const a = shown('mm808');
    const b = shown('voy');
    const c = !!dj && shown('dj');
    const d = !!bs && shown('bass');
    if (this.machine.root.visible === a && voy.root.visible === b && (!dj || dj.root.visible === c) && (!bs || bs.root.visible === d)) return;
    this.machine.root.visible = a;
    voy.root.visible = b;
    if (dj) dj.root.visible = c;
    if (bs) bs.root.visible = d;
    this.floor.setMachines(a, b, c, d);
    this.hit.invalidate();
    this.invalidate();
  }

  /** Les objets de la machine utilisee repondent ; vue d'ensemble ou zoom en cours : aucun. */
  private syncActive(): void {
    if (!this.voy) return;
    this.hit.setActive(focus.settled() ? focus.machine() : null);
  }

  /** Cadrage pose d'un coup sur la cible du store (construction, intro, mouvement reduit). */
  private snapFocus(): void {
    const f = focus.get();
    this.fFrom = this.fTo = f;
    this.focusK = 1;
    this.peekHover = 0;
    this.fr = this.frameOf(f);
    this.frFrom = { ...this.fr };
    this.frTo = { ...this.fr };
    this.tweens.cancel('frame.focus');
    this.setShown(f);
    focus.settle();
    this.syncActive();
    this.placeLights();
    this.updateCamera();
  }

  private syncFocus = (): void => {
    const f = focus.get();
    if (f === this.fTo) {
      this.syncActive();
      return;
    }
    // Pendant l'intro : la cible est posee, l'intro la cadre elle-meme
    if (this.introOn) {
      this.snapFocus();
      return;
    }
    this.frFrom = { ...this.fr };
    this.fFrom = this.fTo;
    this.fTo = f;
    this.frTo = this.frameOf(f);
    this.focusK = 0;
    this.nbFrom = { mm808: this.machine.root.position.x, voy: this.voy ? this.voy.root.position.x : VOY_X, bass: this.bass ? this.bass.root.position.x : bassX(), dj: this.dj ? this.dj.root.position.x : DJ_X };
    this.peekHover = 0;
    this.tweens.cancel('peek.hover');
    this.setShown('all');
    this.syncActive();
    // Une autre machine : la vue revient de face (la vue d'ensemble aussi)
    this.orbit.reset();
    const dur = motion.reduced() ? 0 : FOCUS_MS;
    this.tweens.run(
      'frame.focus',
      (v) => {
        this.focusK = v;
        const a = this.frFrom;
        const b = this.frTo;
        const out = this.fr;
        for (const k of FRAME_KEYS) out[k] = a[k] + (b[k] - a[k]) * v;
        this.placeLights();
        this.updateCamera();
      },
      0,
      1,
      dur,
      easeOutCubic,
      performance.now(),
      () => {
        this.focusK = 1;
        this.setShown(f);
        focus.settle();
        this.syncActive();
      }
    );
    this.invalidate();
  };

  /** Au telephone, le bloc du MM-DECKS change (un glisser) : le cadrage y glisse. */
  private syncDjUnit = (): void => {
    if (this.fTo !== 'dj' || !this.layoutMobile || this.disposed) return;
    this.frFrom = { ...this.fr };
    this.frTo = this.frameOf('dj');
    this.tweens.run(
      'frame.djunit',
      (v) => {
        const a = this.frFrom;
        const b = this.frTo;
        for (const k of FRAME_KEYS) this.fr[k] = a[k] + (b[k] - a[k]) * v;
        this.placeLights();
        this.updateCamera();
      },
      0,
      1,
      motion.reduced() ? 0 : DJ_UNIT_MS,
      easeInOutCubic,
      performance.now()
    );
    this.invalidate();
  };

  private dprCap(): number {
    const dpr = window.devicePixelRatio || 1;
    if (this.opts.mobile) return Math.min(dpr, DPR_MAX.mobile);
    return Math.min(Math.max(dpr, DPR_MIN_DESKTOP), DPR_MAX.desktop);
  }

  /** Taille du canvas ; rendu synchrone pour ne jamais montrer un tampon vide. */
  resize(w: number, h: number): void {
    if (this.disposed || w < 1 || h < 1) return;
    const dpr = this.dprCap();
    if (w === this.width && h === this.height && dpr === this.renderer.getPixelRatio()) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.stats.dpr = dpr;
    this.updateCamera();
    this.dirty = true;
    this.render(performance.now());
    if (this.dirty) this.kick();
    // Rendu direct, hors boucle : les jumeaux se recalent ici si elle dort
    if (this.raf === 0) this.emitIdle();
  }

  /**
   * Emprise de la machine dans la vue courante (revue, calage des
   * constantes) : tous les sommets des maillages visibles, instances
   * comprises, sauf le sol ; projetes sur les axes droite et haut de la
   * camera (unites monde).
   */
  private fit(): StageFit {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const e = cam.matrixWorld.elements;
    // Colonnes de la matrice monde de la camera : droite (x), haut (y)
    const rx = e[0];
    const ry = e[1];
    const rz = e[2];
    const ux = e[4];
    const uy = e[5];
    const uz = e[6];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let radius = 0;
    const tx = this.orbit.target.x;
    const tz = this.orbit.target.z;
    const inst = new Matrix4();
    const lm = new Matrix4();
    this.scene.updateMatrixWorld(true);
    this.scene.traverseVisible((node) => {
      const m = node as Mesh;
      if (!m.isMesh || m === this.floor.mesh) return;
      const im = node as InstancedMesh;
      const n = im.isInstancedMesh ? im.count : 1;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < n; k += 1) {
        lm.copy(m.matrixWorld);
        if (im.isInstancedMesh) {
          im.getMatrixAt(k, inst);
          lm.multiply(inst);
        }
        for (let i = 0; i < pos.count; i += 1) {
          v3.fromBufferAttribute(pos, i).applyMatrix4(lm);
          const px = v3.x * rx + v3.y * ry + v3.z * rz;
          const py = v3.x * ux + v3.y * uy + v3.z * uz;
          if (px < x0) x0 = px;
          if (px > x1) x1 = px;
          if (py < y0) y0 = py;
          if (py > y1) y1 = py;
          const r = Math.hypot(v3.x - tx, v3.z - tz);
          if (r > radius) radius = r;
        }
      }
    });
    const cy = (y0 + y1) / 2;
    const r4 = (v: number): number => +v.toFixed(4);
    return { w: r4(x1 - x0), h: r4(y1 - y0), cy: r4(cy), targetY: r4(cy / uy), radius: r4(radius) };
  }

  /** Revue : boites projetees (px CSS de la fenetre) de l'empreinte et des maillages. */
  measure(): StageMeasure {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    const rect = this.canvas.getBoundingClientRect();
    const vw = window.innerWidth;
    const toBox = (x0: number, x1: number, y0: number, y1: number) => ({
      x: +x0.toFixed(1),
      y: +y0.toFixed(1),
      w: +(x1 - x0).toFixed(1),
      h: +(y1 - y0).toFixed(1),
      ratio: +((x1 - x0) / vw).toFixed(4),
    });
    const acc = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    const reset = () => {
      acc.x0 = Infinity;
      acc.x1 = -Infinity;
      acc.y0 = Infinity;
      acc.y1 = -Infinity;
    };
    const add = (p: Vector3) => {
      p.project(this.camera);
      const x = rect.left + ((p.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - p.y) / 2) * rect.height;
      if (x < acc.x0) acc.x0 = x;
      if (x > acc.x1) acc.x1 = x;
      if (y < acc.y0) acc.y0 = y;
      if (y > acc.y1) acc.y1 = y;
    };
    const meshBox = (m: Mesh) => {
      reset();
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 1) add(v3.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      return toBox(acc.x0, acc.x1, acc.y0, acc.y1);
    };
    const plateau = meshBox(this.machine.panel);
    const socle = meshBox(this.machine.chassis);
    const machine = toBox(
      Math.min(plateau.x, socle.x),
      Math.max(plateau.x + plateau.w, socle.x + socle.w),
      Math.min(plateau.y, socle.y),
      Math.max(plateau.y + plateau.h, socle.y + socle.h)
    );
    // Empreinte 14 x 9 a coins vifs, au sol (celle qui definit PLATEAU_W)
    reset();
    const hx = BODY.w / 2;
    const hz = BODY.d / 2;
    for (const [x, z] of [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ]) {
      add(v3.set(x, 0, z).applyMatrix4(this.machine.root.matrixWorld));
    }
    const footprint = toBox(acc.x0, acc.x1, acc.y0, acc.y1);
    // Espace lumiere : tous les sommets des maillages visibles qui projettent
    // une ombre (instances comprises), contre la camera d'ombre de la cle
    const sc = this.key.shadow.camera;
    sc.updateMatrixWorld(true);
    const lm = new Matrix4();
    const inst = new Matrix4();
    const sh = { x: 0, y: 0, near: Infinity, far: -Infinity };
    this.scene.traverseVisible((node) => {
      const m = node as Mesh;
      if (!m.isMesh || !m.castShadow) return;
      const im = node as InstancedMesh;
      const n = im.isInstancedMesh ? im.count : 1;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < n; k += 1) {
        lm.multiplyMatrices(sc.matrixWorldInverse, m.matrixWorld);
        if (im.isInstancedMesh) {
          im.getMatrixAt(k, inst);
          lm.multiply(inst);
        }
        for (let i = 0; i < pos.count; i += 1) {
          v3.fromBufferAttribute(pos, i).applyMatrix4(lm);
          sh.x = Math.max(sh.x, Math.abs(v3.x));
          sh.y = Math.max(sh.y, Math.abs(v3.y));
          sh.near = Math.min(sh.near, -v3.z);
          sh.far = Math.max(sh.far, -v3.z);
        }
      }
    });
    const DEGR = 180 / Math.PI;
    return {
      viewport: { w: vw, h: window.innerHeight },
      canvas: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      pxPerUnit: +this.ppu.toFixed(3),
      frustum: { hw: +this.hw.toFixed(4), hh: +(this.hw * (this.height / this.width)).toFixed(4) },
      orbit: {
        azDeg: +(this.orbit.azimuth * DEGR).toFixed(3),
        elDeg: +(this.orbit.elevation * DEGR).toFixed(3),
        zoom: +this.orbit.zoom.toFixed(4),
      },
      framing: {
        section: +this.secT.toFixed(4),
        ox: +this.ox.toFixed(4),
        explode: +this.explode.p.frame.toFixed(4),
        targetY: +this.orbit.target.y.toFixed(4),
      },
      footprint,
      plateau,
      socle,
      machine,
      fit: this.fit(),
      shadow: { x: +sh.x.toFixed(3), y: +sh.y.toFixed(3), near: +sh.near.toFixed(3), far: +sh.far.toFixed(3), extent: LIGHT_KEY.extent },
      explode: this.explode.info(),
    };
  }

  /* ---------------- demarrage ---------------- */

  /**
   * Le premier rendu attend les polices (au plus 1.5 s) : la serigraphie
   * n'est pas redessinee sous les yeux. Au-dela, on rend avec la police de
   * repli et la serigraphie se redessine a leur arrivee.
   */
  private gate(): void {
    if (fontsReady()) {
      this.start();
      return;
    }
    this.timers.push(window.setTimeout(() => this.start(), FIRST_FRAME_WAIT_MS));
    void whenFonts().then(() => {
      if (this.disposed) return;
      this.silk.draw();
      this.backPlate.draw();
      this.pcb.redraw();
      this.rytmTweaks.draw();
      this.start();
      this.invalidate();
    });
  }

  private start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.length = 0;
    try {
      // Programmes compiles avant la premiere frame : pas d'a-coup a l'arrivee
      this.renderer.compile(this.scene, this.camera);
    } catch (e) {
      this.opts.onError('compile', msg(e));
    }
    // Sans intro : le travail d'avance tout de suite (avec, a sa fin : finishIntro)
    if (!this.introOn) this.warmIdle();
    this.invalidate();
  }

  /**
   * En temps libre, apres l'intro (2026-10-05, Mika : "des que je fais un
   * petit truc le son se coupe") : au desktop, les PCB du MM-RYTM et du
   * MM-ARP se preparent d'avance et leurs grandes textures partent au GPU ;
   * le premier OPEN ne gele plus la page (plusieurs secondes sur certaines
   * machines). Au telephone, rien d'avance (la memoire) : la preparation
   * reserve la musique (Pcb.prepare), elle ne se coupe pas.
   */
  private warmIdle(): void {
    if (this.warmed || this.opts.mobile) return;
    this.warmed = true;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const later = (fn: () => void, ms: number): void => {
      this.timers.push(
        window.setTimeout(() => {
          if (this.disposed) return;
          if (ric) ric(() => !this.disposed && fn(), { timeout: 4000 });
          else fn();
        }, ms)
      );
    };
    const upload = (pcb: Pcb): void => {
      reserve(1.2);
      for (const t of pcb.bigTextures()) this.renderer.initTexture(t);
    };
    later(() => {
      this.pcb.prepare();
      later(() => upload(this.pcb), 300);
    }, 1500);
    later(() => {
      const v = this.voy;
      if (!v) return;
      v.pcb.prepare();
      later(() => upload(v.pcb), 300);
    }, 2600);
  }

  /* ---------------- intro (spec 7.4) ---------------- */

  /**
   * Animateur de l'intro (2026-10-01) : la machine eclatee s'assemble en
   * 3 s (Explode.assemble, le cadrage la suit), puis les LED des pas font
   * leur test (aller et retour en 400 ms). Le temps part de la premiere
   * frame rendue ; depuis le 2026-10-05 (Mika : "a l'intro l'image flick
   * un peu"), chaque image l'avance de INTRO.maxStepMs au plus : une image
   * lente (les shaders qui se compilent) ralentit l'intro au lieu de la
   * faire sauter. Seule la machine choisie s'assemble.
   */
  private stepIntro = (now: number): boolean => {
    if (!this.introOn) return false;
    this.introClock += this.introLast < 0 ? 0 : Math.min(INTRO.maxStepMs, Math.max(0, now - this.introLast));
    this.introLast = now;
    const t = this.introClock;
    if (t >= INTRO.ms) {
      this.finishIntro();
      return true;
    }
    if (this.introPick === 'mm808') this.explode.assemble(t);
    else if (this.introPick === 'voy') this.voy?.assemble(t);
    this.introCamera(t);
    this.updateCamera();
    this.syncCasters();
    if (this.introPick === 'mm808') {
      const u = (t - INTRO.ledFromMs) / INTRO.ledMs;
      const n = STEP_LEDS;
      // 0 -> 15 puis 15 -> 0 : une LED a la fois
      const led = u < 0 || u >= 1 ? -1 : u < 0.5 ? Math.floor(u * 2 * n) : n - 1 - Math.floor((u - 0.5) * 2 * n);
      this.seq.setIntroLed(led);
    }
    return true;
  };

  /**
   * Pendant l'intro, la camera arrive en 3D (2026-10-05) : elle descend de
   * INTRO.elFromDeg (les couches eclatees se voient) a ORBIT.elDeg, revient
   * de INTRO.azFromDeg (d'un cote ou de l'autre) a l'azimut par defaut et
   * s'approche de INTRO.zoomFrom a 1, le tout en douceur sur la duree de
   * l'intro. Posee directement (pas de commit de l'orbite) : la vue n'est
   * pas "deplacee", RESET VIEW reste cache.
   */
  private introCamera(t: number): void {
    const u = easeInOutCubic(Math.min(1, Math.max(0, t / INTRO.ms)));
    const deg = Math.PI / 180;
    const el = INTRO.elFromDeg + (ORBIT.elDeg - INTRO.elFromDeg) * u;
    const az = (ORBIT.azDeg + this.introSign * INTRO.azFromDeg * (1 - u)) * deg;
    this.orbit.elevation = el * deg;
    this.orbit.azimuth = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    this.orbit.zoom = ORBIT.zoom * Math.exp(Math.log(INTRO.zoomFrom) * (1 - u));
    this.orbit.apply();
  }

  /** Fin de l'intro, tout de suite (premier geste, fin du temps, reduced motion, demontage). */
  finishIntro(): void {
    if (!this.introOn) return;
    this.introOn = false;
    // Assemblee d'un coup (premier geste, fin du temps, demontage), a la vue par defaut
    this.explode.snap(explodeState.get() === 'open');
    this.orbit.elevation = (ORBIT.elDeg * Math.PI) / 180;
    this.orbit.azimuth = (ORBIT.azDeg * Math.PI) / 180;
    this.orbit.zoom = ORBIT.zoom;
    this.orbit.apply();
    this.updateCamera();
    this.syncCasters();
    this.seq.setIntroLed(-1);
    intro.set('done');
    if (this.voy) {
      this.voy.finishIntro();
      this.updateCamera();
      // Au telephone, une machine a la fois (l'intro en montre deja une, celle de ?m= ou au hasard)
      if (this.layoutMobile && focus.get() === 'all') focus.set('mm808');
    }
    // Le MM-DECKS arrive pendant l'intro se pose maintenant
    const dj = this.pendingDj;
    const bs = this.pendingBass;
    this.pendingDj = null;
    this.pendingBass = null;
    if (dj) this.attachDj(dj);
    if (bs) this.attachBass(bs);
    this.warmIdle();
    this.invalidate();
  }

  /* ---------------- boucle ---------------- */

  private kick(): void {
    if (this.raf !== 0 || this.disposed || this.paused || this.contextLost || !this.started) return;
    this.raf = requestAnimationFrame(this.frame);
    this.stats.loopActive = true;
  }

  /**
   * Plafond de cadence (2026-10-01) : une frame toutes les capMs au plus,
   * pendant que la visionneuse du press kit couvre la machine ; 0 : chaque
   * rAF.
   */
  private capMs = 0;
  private lastFrameAt = -Infinity;

  setFrameCap(ms: number): void {
    this.capMs = Math.max(0, ms);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    if (now - this.lastFrameAt < Math.max(this.capMs, FRAME_MIN_MS)) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastFrameAt = now;
    this.stats.rafs += 1;
    // Reveil apres un repos : un pas de 16.7 ms, pas l'ecart depuis la derniere frame
    const dt = this.last < 0 ? 16.667 : Math.min(50, now - this.last);
    this.last = now;
    let moved = false;
    let painted = false;
    let poll = false;
    let viewMoved = false;
    try {
      // L'orbite d'abord : les animateurs (cadrage de l'eclate) partent de la vue de la frame
      viewMoved = this.orbit.update(now, dt);
      const list = this.animators;
      for (let i = 0; i < list.length; i += 1) {
        const r = list[i](now, dt);
        if (r === true) moved = true;
        else if (r === 'paint') painted = true;
        else if (r === 'poll') poll = true;
      }
      // Un objet qui projette une ombre a bouge : la carte d'ombre aussi ;
      // la vue seule, ou des couleurs seules, non
      if (moved) {
        this.dirty = true;
        this.shadowDirty = true;
      }
      if (viewMoved || painted) this.dirty = true;
      if (this.dirty) this.render(now);
    } catch (e) {
      this.stats.loopActive = false;
      this.opts.onError('frame', msg(e));
      return;
    }
    if (viewMoved || moved || painted || poll) {
      this.kick();
    } else {
      this.last = -1;
      this.stats.loopActive = false;
      this.emitIdle();
    }
  };

  private breatheAt = -Infinity;

  /**
   * OPEN respire (OPEN_BREATHE) : une image toutes les frameMs ('paint',
   * sans passe d'ombre), 'poll' entre deux. Machine ouverte, mouvement
   * reduit ou palier mobile : la lumiere pleine, et plus rien a faire.
   */
  private stepBreathe = (now: number): 'paint' | 'poll' | false => {
    const v = this.voy;
    const on808 = this.pads.breathing && this.machine.root.visible;
    const onVoy = !!v && v.breathing && v.root.visible;
    if (this.opts.mobile || motion.reduced() || (!on808 && !onVoy)) {
      const a = this.pads.stopBreath();
      const b = v ? v.stopBreath() : false;
      return a || b ? 'paint' : false;
    }
    if (now - this.breatheAt < OPEN_BREATHE.frameMs) return 'poll';
    this.breatheAt = now;
    let changed = on808 && this.pads.breathe(now);
    if (onVoy && v.breathe(now)) changed = true;
    return changed ? 'paint' : 'poll';
  };

  /** La boucle s'arrete : les jumeaux se recalent une fois (hors de la boucle de rendu). */
  private emitIdle(): void {
    const list = this.idleListeners;
    for (let i = 0; i < list.length; i += 1) {
      try {
        list[i]();
      } catch (e) {
        this.opts.onError('view', msg(e));
      }
    }
  }

  private render(now: number): void {
    if (!this.started || this.paused || this.contextLost || this.disposed) return;
    // Passe d'ombre seulement si une ombre a pu changer (autoUpdate coupe)
    const shadow = this.shadowDirty;
    this.renderer.shadowMap.needsUpdate = shadow;
    this.shadowDirty = false;
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    const r = this.renderer.info.render;
    const s = this.stats;
    s.frames += 1;
    s.lastRenderAt = now;
    s.drawCalls = r.calls;
    s.triangles = r.triangles;
    if (r.calls > s.maxDrawCalls) s.maxDrawCalls = r.calls;
    if (r.triangles > s.maxTriangles) s.maxTriangles = r.triangles;
    if (shadow) s.shadowUpdates += 1;
    // Meme passe que le rendu : les jumeaux et la trace suivent la vue
    // (orbite, cadrage, taille) ; une erreur chez un ecouteur ne coupe
    // jamais le WebGL. Boucle indexee : aucun iterateur
    const list = this.viewListeners;
    for (let i = 0; i < list.length; i += 1) {
      try {
        list[i]();
      } catch (e) {
        this.opts.onError('view', msg(e));
      }
    }
  }

  /**
   * Vignette d'une machine (2026-10-03, le volet des machines) : elle seule,
   * de trois quarts, sans le sol, rendue dans un coin du canevas puis copiee
   * (meme tache : l'ecran n'en montre rien), et la vue normale rendue
   * aussitot par-dessus. dataURL PNG, null sans le MM-VOYAGER.
   */
  thumbnail(m: MachineId, w = 220, h = 138): string | null {
    const voy = this.voy;
    if (!voy || this.disposed || this.contextLost || !this.started) return null;
    const dj = this.dj;
    const bs = this.bass;
    if (m === 'dj' && !dj) return null;
    if (m === 'bass' && !bs) return null;
    const a = this.machine.root.visible;
    const b = voy.root.visible;
    const c = dj ? dj.root.visible : false;
    const dv = bs ? bs.root.visible : false;
    const fl = this.floor.mesh.visible;
    this.machine.root.visible = m === 'mm808';
    voy.root.visible = m === 'voy';
    if (dj) dj.root.visible = m === 'dj';
    if (bs) bs.root.visible = m === 'bass';
    this.floor.mesh.visible = false;
    const cam = new PerspectiveCamera(24, w / h, 0.1, 200);
    const cx = m === 'voy' ? VOY_X : m === 'dj' && dj ? dj.root.position.x : m === 'bass' && bs ? bs.root.position.x : 0;
    const ty = m === 'voy' ? VOY_FRAME.targetY : m === 'dj' ? DJ_FRAME.targetY : m === 'bass' ? BASS_FRAME.targetY : ORBIT.targetY;
    const R = m === 'voy' ? Math.hypot(VOY_BODY.w, VOY_BODY.d) / 2 : m === 'dj' ? (DJ_W / 2) * 0.82 : m === 'bass' ? Math.hypot(BASS_W, BASS_D) / 2 : Math.hypot(BODY.w, BODY.d) / 2;
    const az = (26 * Math.PI) / 180;
    const el = (30 * Math.PI) / 180;
    const D = (R / Math.sin((24 * Math.PI) / 360)) * 0.62;
    cam.position.set(cx + D * Math.cos(el) * Math.sin(az), ty + D * Math.sin(el), D * Math.cos(el) * Math.cos(az));
    cam.lookAt(cx, ty, 0);
    const r = this.renderer;
    let url: string | null = null;
    try {
      r.setScissorTest(true);
      r.setScissor(0, 0, w, h);
      r.setViewport(0, 0, w, h);
      r.clear();
      r.shadowMap.needsUpdate = false;
      r.render(this.scene, cam);
      const dpr = r.getPixelRatio();
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const x = c.getContext('2d');
      if (x) {
        x.drawImage(this.canvas, 0, this.canvas.height - c.height, c.width, c.height, 0, 0, c.width, c.height);
        url = c.toDataURL('image/png');
      }
    } finally {
      r.setScissorTest(false);
      r.setViewport(0, 0, this.width, this.height);
      this.machine.root.visible = a;
      voy.root.visible = b;
      if (dj) dj.root.visible = c;
      if (bs) bs.root.visible = dv;
      this.floor.mesh.visible = fl;
      // La vue normale, tout de suite : le coin rendu ne s'affiche jamais
      this.dirty = true;
      this.render(performance.now());
    }
    return url;
  }

  /** Appele dans chaque frame rendue, juste apres le rendu ; renvoie la fonction de retrait. */
  onView(fn: () => void): () => void {
    this.viewListeners.push(fn);
    return () => {
      const i = this.viewListeners.indexOf(fn);
      if (i >= 0) this.viewListeners.splice(i, 1);
    };
  }

  /**
   * Appele quand la boucle s'arrete (plus rien ne bouge) et apres un
   * redimensionnement rendu hors boucle ; renvoie la fonction de retrait.
   */
  onIdle(fn: () => void): () => void {
    this.idleListeners.push(fn);
    return () => {
      const i = this.idleListeners.indexOf(fn);
      if (i >= 0) this.idleListeners.splice(i, 1);
    };
  }

  /**
   * Un point du panneau (repere local) en px CSS du canvas ; `out` evite
   * une allocation.
   */
  projectPlateau(x: number, y: number, z: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
    return this.hit.project(this.machine.plateau, x, y, z, out);
  }

  /** La section s a-t-elle une ancre de trace (pad de page, puce LIVE ou STUDIO) ? */
  hasAnchor(s: SectionId | null): boolean {
    return s !== null && this.anchorsNow().has(s);
  }

  /** Les ancres de la machine utilisee (le MM-VOYAGER quand on l'utilise, la 808 sinon). */
  private anchorsNow(): Map<SectionId, HotspotDef> {
    return this.voy && this.fTo === 'voy' ? this.voy.anchors : this.anchors;
  }

  /**
   * Ancre de la trace de la section s (spec 20.2.7) : le centre du dessus
   * de l'objet qui l'a ouverte, en px CSS du canvas, et sa visibilite (dans
   * le canvas a 8 px pres, calque visible, pas cachee par la machine : rayon
   * vers la camera contre les volumes de la machine). Appele a chaque frame
   * rendue tant qu'un panneau est ouvert : aucune allocation.
   */
  projectAnchor(s: SectionId, out: AnchorPoint): AnchorPoint {
    const d = this.anchorsNow().get(s);
    if (!d) {
      out.visible = false;
      return out;
    }
    this.hit.project(d.layer, d.x, d.y1, d.z, out);
    const m = TRACE.edgeMargin;
    out.visible =
      out.x >= m && out.x <= this.width - m && out.y >= m && out.y <= this.height - m && this.hit.visible(d.layer, d.x, d.y1, d.z, d.id);
    return out;
  }

  /** Bord droit projete de la machine (px CSS du canvas) : les coins de ses volumes visibles. */
  machineRightEdge(): number {
    return this.hit.rightEdge();
  }

  /* ---------------- evenements ---------------- */

  /**
   * Densite de pixels : une requete (resolution: N dppx) par valeur, reposee
   * a chaque changement (fenetre passee d'un ecran 1x a un ecran 2x).
   */
  private watchDpr(): void {
    this.dprMql?.removeEventListener('change', this.onDpr);
    this.dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprMql.addEventListener('change', this.onDpr);
  }

  private onDpr = (): void => {
    if (this.disposed) return;
    this.watchDpr();
    // resize() compare aussi le DPR plafonne : rien a faire s'il est inchange
    this.resize(this.opts.host.clientWidth, this.opts.host.clientHeight);
  };

  private onResize = (): void => {
    if (this.resizeRaf !== 0) return;
    // Une rafale de notifications = un seul redimensionnement par frame
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.resize(this.opts.host.clientWidth, this.opts.host.clientHeight);
    });
  };

  private onLayout = (): void => {
    const m = this.layoutMql.matches;
    if (m === this.layoutMobile) return;
    this.layoutMobile = m;
    // Le cadrage de section n'existe que sur desktop : coupe franche au changement
    this.retargetFraming(true);
    if (this.voy) {
      // Au telephone pas de vue d'ensemble (sauf l'intro)
      if (m && focus.get() === 'all' && !this.introOn) focus.set('mm808');
      this.snapFocus();
    } else {
      this.fr = this.frameOf('mm808');
    }
    this.updateCamera();
    this.syncSteps();
    this.invalidate();
  };

  /** Le pointeur change de nature (tactile, souris) : les rectangles cibles des jumeaux aussi. */
  private onCoarse = (): void => {
    this.hit.invalidate();
    this.repaint();
  };

  /**
   * Survol au pointeur fin (HitLayer) : la LED du pas survole passe en
   * ledHover ; un pad de page (ou OPEN) s'eclaire un peu plus ; une puce du
   * PCB se souleve (LABEL, qui sort du site, passe aussi au jaune avec son
   * chevron) ; le quitter les repose.
   */
  setHover(id: string | null): void {
    const i = id !== null && id.startsWith('step-') ? Number(id.slice(5)) - 1 : -1;
    let changed = this.seq.setHover(i);
    // Le MM-VOYAGER : ses ids commencent par v (vpad, vbtn, vchip, vk)
    if (this.voy && this.voy.setHover(id !== null && id.startsWith('v') ? id : null)) changed = true;
    if (this.dj && this.dj.setHover(id !== null && id.startsWith('dj-') ? id : null)) changed = true;
    if (this.bass && this.bass.setHover(id !== null && id.startsWith('bass-') ? id : null)) changed = true;
    const pad = id !== null && id.startsWith('pad-') ? (id.slice(4) as PadId) : null;
    if (this.pads.setHover(pad)) changed = true;
    // Puce du PCB (vue ouverte)
    this.hoverChip = id !== null && id.startsWith('chip-') ? (id.slice(5) as ChipId) : null;
    if (this.syncChipHot()) changed = true;
    if (changed) this.repaint();
  }

  /**
   * Focus clavier (focus-visible) sur le jumeau d'une puce, ou null : la
   * puce reagit comme au survol (spec 20.5). Ignore tant que les puces ne
   * repondent pas.
   */
  setChipFocus(id: ChipId | null): void {
    const next = this.chipsOn ? id : null;
    if (next === this.focusChip) return;
    this.focusChip = next;
    if (this.syncChipHot()) this.repaint();
  }

  /** Soulevement (et LABEL allumee) des puces survolees ou au focus ; true si l'une a change. */
  private syncChipHot(): boolean {
    let changed = false;
    for (const c of BOARD_CHIPS) {
      const hot = c.id === this.hoverChip || c.id === this.focusChip;
      if (hot === this.hotChips.has(c.id)) continue;
      if (hot) this.hotChips.add(c.id);
      else this.hotChips.delete(c.id);
      this.liftChip(c.id, hot);
      this.pcb.setLit(c.id, hot);
      changed = true;
    }
    return changed;
  }

  /** Les puces ne projettent pas d'ombre : leur soulevement ne refait pas la carte. */
  private liftChip(id: ChipId, on: boolean): void {
    this.paintTweens.run(
      `chip.rise.${id}`,
      (v) => this.pcb.setRise(id, v),
      this.pcb.riseOf(id),
      on ? CHIP.rise : 0,
      motion.reduced() ? 0 : CHIP.riseMs,
      easeOutCubic,
      performance.now()
    );
  }

  /** Animateur de la vue eclatee : les couches, puis le cadrage qui les suit. */
  private stepExplode = (now: number): boolean => {
    if (!this.explode.update(now)) return false;
    this.updateCamera();
    this.syncChips();
    this.syncCasters();
    return true;
  };

  /**
   * Palier mobile : le panneau ne projette son ombre que leve (revue de la
   * revision 2). Ferme, celle du chassis la couvre (un draw call de moins) ;
   * leve, sans elle les pads qu'il porte jetaient six carres flottants sur
   * le sol derriere la machine. true si le drapeau a change (la carte
   * d'ombre est a refaire : l'appelant invalide).
   */
  private syncCasters(): boolean {
    if (!this.opts.mobile) return false;
    const on = this.explode.p.plateau > 0;
    const panel = this.machine.panel;
    if (panel.castShadow === on) return false;
    panel.castShadow = on;
    return true;
  }

  /**
   * Les puces repondent au pointeur vue ouverte, et pendant l'ouverture des
   * que le panneau les a decouvertes (EXPLODE.chipsFrom) ; jamais pendant
   * la fermeture. true si un drapeau a change.
   */
  private syncChips(): boolean {
    const s = explodeState.get();
    const live = s === 'open' || (s === 'opening' && this.explode.p.plateau >= EXPLODE.chipsFrom);
    this.chipsOn = live;
    let changed = false;
    for (const d of [...this.chipDefs, ...this.tweakDefs]) {
      if (d.enabled === live) continue;
      d.enabled = live;
      changed = true;
    }
    // Le capot leve sort du cadre ouvert (2026-10-08) : ses commandes ne repondent plus tant que la carte repond
    const lid = this.machine.plateau.userData;
    if (lid.noPick !== live) {
      lid.noPick = live;
      changed = true;
    }
    if (!live) {
      // La vue se referme : plus de survol ni de focus sur les puces
      this.hoverChip = null;
      this.focusChip = null;
      if (this.syncChipHot()) changed = true;
    }
    if (changed) this.hit.invalidate();
    return changed;
  }

  /**
   * OPEN et CLOSE d'une machine qu'on regarde (2026-10-05, Mika : "quand on
   * OPEN une machine j'aimerais que ca puisse zoom vers le contenu de
   * l'interieur ; quand on ferme on revient dans la vue reset view") : la vue
   * repart de la vue par defaut (500 ms) ; ouverte, le cadrage (updateCamera)
   * rejoint l'interieur de la machine, fermee il revient a la machine. Pas
   * pendant l'intro, qui conduit sa propre camera.
   */
  private openView(id: 'mm808' | 'voy' | 'bass'): void {
    if (this.introOn || this.fTo !== id) return;
    this.orbit.reset();
  }

  /**
   * OPEN (store state/explode.ts) : opening ou closing lance l'animation
   * (coupe franche a la frame suivante en reduced motion) ; le pad OPEN
   * s'allume (yellowHi) et sa serigraphie passe a CLOSE des le depart ; les
   * puces repondent une fois decouvertes (syncChips). open et closed sont
   * poses par l'animation elle-meme (settle) ; une remise a closed pendant
   * une animation (demontage) coupe net.
   */
  private syncExplode = (): void => {
    this.applyExplode(false);
  };

  private applyExplode(instant: boolean): void {
    const s = explodeState.get();
    const goal = s === 'opening' || s === 'open';
    let changed = false;
    if (instant) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      this.explode.snap(goal);
      // Pas d'ecouteur de ce Stage encore : pas de reentrance
      if (s === 'opening' || s === 'closing') explodeState.settle(goal);
      changed = true;
    } else if (goal !== this.explodeGoal) {
      this.explodeGoal = goal;
      // Le capot s'ouvre : textures, ombres, programmes, la musique est programmee d'avance (2026-10-05)
      if (goal) reserve(1.2);
      // Premiere apparition du PCB : textures de cuivre et de serigraphie
      if (goal) this.pcb.prepare();
      if (s === 'opening' || s === 'closing') this.explode.start(goal, performance.now(), motion.reduced());
      else this.explode.snap(goal);
      this.openView('mm808');
      changed = true;
    }
    if (this.pads.setOpen(goal)) changed = true;
    if (this.silk.setOpenLabel(goal ? 'CLOSE' : 'OPEN')) changed = true;
    if (this.syncChips()) changed = true;
    if (this.syncCasters()) changed = true;
    if (!changed) return;
    this.hit.invalidate();
    this.updateCamera();
    this.invalidate();
  }

  /**
   * Section ouverte (spec 20.6.2 PAGE) : le pad de sa page passe en
   * yellowHi, le precedent revient au jaune faible ; une seule a la fois.
   * Sur desktop la camera recadre pour le panneau (400 ms).
   */
  private syncSection = (): void => {
    this.applySection(false);
  };

  private applySection(instant: boolean): void {
    const s = section.get();
    let changed = this.pads.setActivePage(isPage(s) ? s : null);
    if (this.retargetFraming(instant)) changed = true;
    // Lumiere d'un pad et cadrage : rien qui projette une ombre ne bouge
    if (changed) this.repaint();
  }

  /** Cadrage de section : vise 1 si une section est ouverte sur desktop ; true s'il change. */
  private retargetFraming(cut: boolean): boolean {
    const goal = section.get() !== null && !this.layoutMobile ? 1 : 0;
    if (goal === this.secGoal) return false;
    this.secGoal = goal;
    const dur = cut || motion.reduced() ? 0 : SECTION_FRAME.ms;
    this.paintTweens.run(
      'frame.section',
      (v) => {
        this.secT = v;
        this.updateCamera();
      },
      this.secT,
      goal,
      dur,
      easeInOutCubic,
      performance.now()
    );
    return true;
  }

  /** Un encodeur a tourne : carte d'ombre refaite la ou ils en projettent une (desktop). */
  private encodersMoved(): void {
    if (this.encoders.mesh.castShadow) this.invalidate();
    else this.repaint();
  }

  /**
   * Les potards suivent leur cible : la rangee GLOBAL et MASTER, le
   * pattern ; la rangee VOICE, la voix du pad selectionne (ses valeurs de
   * depart sans selection) ; elle tourne aussi quand la selection change.
   * TONE et STRETCH vont de -1 a 1 : course centree (repere a midi a 0).
   */
  private syncMix = (): void => {
    const inst = pattern.get().instrument;
    const v = inst ? voiceFx.of(inst) : VOICE_FX_DEFAULT;
    const fam = inst ? familyOf(inst as ShotId) : null;
    const e = this.encoders;
    let changed = false;
    for (const [id, t] of [
      ['level', mix.level],
      ['swing', mix.swing],
      ['stretch', potCourse('stretch', mix.stretch)],
      ['dist', mix.drive],
      ['chorus', mix.chorus],
      ['delay', mix.delay],
      ['reverb', mix.reverb],
      ['vol', v.level],
      ['vsound', fam ? kit.value(fam) : 0],
      ['tone', potCourse('tone', v.tone)],
      ['vdecay', v.decay],
      ['vdist', v.dist],
      ['vchorus', v.chorus],
      ['vdelay', v.delay],
      ['vreverb', v.reverb],
    ] as const) {
      if (e.setValue(id, t)) changed = true;
    }
    if (changed) this.encodersMoved();
  };

  /**
   * Store du motif : le pad de l'instrument selectionne reste allume, les
   * LED suivent les pas programmes, TEMPO tourne avec le tempo.
   */
  private syncPattern = (): void => {
    const p = pattern.get();
    let lit = this.pads.setSelected(p.instrument);
    if (this.seq.setPattern(p.steps, p.instrument)) lit = true;
    if (this.syncVoiceKeys()) lit = true;
    if (this.encoders.setValue('tempo', (p.bpm - BPM.min) / (BPM.max - BPM.min))) this.encodersMoved();
    else if (lit) this.repaint();
    // Selection changee : les potards d'effets montrent la nouvelle cible
    this.syncMix();
  };

  /**
   * MUTE et SOLO : allumes tant que leur mode est arme ou qu'une voix reste
   * coupee (en solo) ; un appui de plus les eteint (2026-10-07, state/
   * voices.ts). true s'il faut une frame.
   */
  private syncVoiceKeys = (): boolean => this.seq.setVoiceKeys(voices.lit('mute'), voices.lit('solo'));

  private syncVoices = (): void => {
    const v = voices.get();
    // Les pads aussi : rouge LED pour une voix coupee, bleu pour le solo
    const pads = this.pads.setVoiceState(v.muted, v.solo);
    if (this.syncVoiceKeys() || pads) this.repaint();
  };

  /** RUN/STOP : couleur du bouton ; la boucle se met a lire l'horloge audio. */
  private syncRun = (): void => {
    if (this.seq.setRunning(clock.running)) this.repaint();
    this.kick();
  };

  /**
   * Les pas 3D se coupent quand le Dock HTML les remplace (mise en page
   * mobile : 15 px entre deux touches sur un telephone, section 19) ; en
   * portrait (2026-10-01) ils font environ 40 px : ils repondent.
   */
  private syncSteps(): void {
    const on = !this.layoutMobile || PORTRAIT;
    let changed = false;
    for (const d of this.stepDefs) {
      if (d.enabled === on) continue;
      d.enabled = on;
      changed = true;
    }
    if (!changed) return;
    this.hit.invalidate();
    if (!on && this.seq.setHover(-1)) this.repaint();
  }

  /**
   * Tete de lecture (spec 7.5 et 14.1). Pendant la lecture chaque rAF lit
   * l'horloge audio ; une frame n'est rendue que quand le pas change : LED,
   * flash des pads du pas (a l'instant ou il sonne, pas a sa programmation),
   * Dock ; des couleurs seulement, 'paint' (pas de passe d'ombre). Entre
   * deux pas, 'poll' garde la boucle sans rien rendre.
   */
  private pollPlayhead = (now: number): 'paint' | 'poll' | false => {
    const c = context();
    const e = clock.running && c ? clock.entryAt(c.currentTime) : null;
    const seqNo = e ? e.seq : -1;
    if (seqNo === this.headSeq) return clock.running ? 'poll' : false;
    this.headSeq = seqNo;
    const step = e ? e.step : -1;
    this.seq.setPlayhead(step);
    playhead.set(step);
    if (e && e.mask !== 0) {
      for (let k = 0; k < INSTRUMENTS.length; k += 1) {
        if (e.mask & (1 << k)) this.pads.flash(INSTRUMENTS[k], PAD_FX.seqFlashMs, now);
      }
    }
    return 'paint';
  };

  /**
   * Reduced motion coupe l'intro. (Sous reduced motion l'orbite suit le
   * doigt sans inertie et le retour a la vue par defaut est une coupe.)
   */
  private syncMotion = (): void => {
    if (motion.reduced()) this.finishIntro();
  };

  private setPaused(): void {
    const paused = this.docHidden || this.offscreen;
    if (paused === this.paused) return;
    this.paused = paused;
    this.opts.onVisibility?.(!paused);
    if (paused) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.last = -1;
      this.stats.loopActive = false;
    } else {
      this.invalidate();
    }
  }

  private onVisibility = (): void => {
    this.docHidden = document.visibilityState === 'hidden';
    this.setPaused();
  };

  private onIntersect = (entries: IntersectionObserverEntry[]): void => {
    const e = entries[entries.length - 1];
    if (!e) return;
    this.offscreen = !e.isIntersecting;
    this.setPaused();
  };

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stats.loopActive = false;
    this.opts.onContextLost();
  };

  private onRestored = (): void => {
    // three reconstruit son etat GL (textures et geometries se re-televersent)
    // mais recree aussi son fond : la couleur de clear retomberait au noir ;
    // la carte d'ombre est a refaire (invalidate s'en charge)
    this.contextLost = false;
    this.renderer.setClearColor(COLOR.ink, BACKDROP.transparent ? 0 : 1);
    this.opts.onContextRestored();
    this.invalidate();
  };

  /* ---------------- fin de vie ---------------- */

  /** Texture DFG de three (module, partagee) : lue avant de liberer les materiaux. */
  private sharedTextures(): Texture[] {
    const out: Texture[] = [];
    try {
      const p = this.renderer.properties.get(this.machine.chassisMat) as {
        uniforms?: { dfgLUT?: { value?: Texture | null } };
      };
      const dfg = p.uniforms?.dfgLUT?.value;
      if (dfg) out.push(dfg);
    } catch {
      /* materiau jamais compile */
    }
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.resizeRaf);
    this.raf = 0;
    this.resizeRaf = 0;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.length = 0;
    this.animators.length = 0;
    this.stats.loopActive = false;
    this.introOn = false;
    intro.set('done');
    this.ro.disconnect();
    this.io?.disconnect();
    this.unsubMotion();
    this.unsubPattern();
    this.unsubKit();
    this.unsubVoices();
    this.unsubSeek();
    this.unsubClock();
    this.unsubMix();
    this.unsubSection();
    this.unsubExplode();
    this.detachExplode();
    this.unsubFocus();
    this.unsubEditor();
    this.unsubPatterns();
    this.unsubPresets();
    this.unsubPlay();
    this.orbit.lock = () => false;
    this.unsubVoyExplode();
    this.unsubBassExplode();
    this.unsubView();
    this.viewListeners.length = 0;
    this.idleListeners.length = 0;
    this.dprMql?.removeEventListener('change', this.onDpr);
    this.dprMql = null;
    playhead.set(-1);
    this.tweens.clear();
    this.paintTweens.clear();
    this.orbit.dispose();
    this.coarseMql.removeEventListener('change', this.onCoarse);
    this.layoutMql.removeEventListener('change', this.onLayout);
    this.canvas.removeEventListener('webglcontextlost', this.onLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false);
    document.removeEventListener('visibilitychange', this.onVisibility);

    // La texture partagee de three (DFG) est liberee ici et re-televersee au
    // prochain montage depuis ses donnees en memoire
    const shared = this.sharedTextures();
    this.machine.dispose();
    this.brush.dispose();
    this.silk.dispose();
    this.backPlate.dispose();
    this.pads.dispose();
    this.seq.dispose();
    this.encoders.dispose();
    this.screen.dispose();
    this.pcb.dispose();
    this.rytmTweaks.dispose();
    this.voy?.dispose();
    this.unsubDjUnit();
    this.dj?.dispose();
    this.bass?.dispose();
    this.floor.dispose();
    this.key.dispose();
    this.hemi.dispose();
    this.rim.dispose();
    this.back.dispose();
    for (const t of shared) t.dispose();
    this.scene.clear();
    if (this.opts.dev) {
      // Revue : doit lire 0 / 0 ici, avant la perte de contexte (spec 14.4)
      const m = this.renderer.info.memory;
      window.__v4LastDispose = { geometries: m.geometries, textures: m.textures };
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

declare global {
  interface Window {
    __v4LastDispose?: { geometries: number; textures: number };
  }
}
