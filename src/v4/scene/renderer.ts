/**
 * /v4 MM-808 : le Stage. Un WebGLRenderer sur son propre canvas, la camera
 * orthographique en (12, 10, 12), les trois lumieres (cle, ciel, lisere
 * jaune en PointLight), l'intro (spec 7.4), l'ombre portee, la
 * machine et sa serigraphie, les pads, le sequenceur, les huit knobs (TEMPO,
 * les cinq knobs de navigation, TONE, LEVEL) et leurs LED, l'ecran LCD et
 * le bouton OPEN, le PCB et la vue eclatee (explode.ts), le picking
 * (hit.ts), le cadrage quand une section s'ouvre (spec 3.3) et quand la
 * machine s'eclate (spec 3.4). Boucle A LA
 * DEMANDE : une frame seulement si quelque chose a change (invalidate,
 * animateur ou tween vivant), zero frame au repos, rien du tout quand
 * l'onglet ou le canvas n'est pas visible. Pendant la lecture la boucle lit
 * l'horloge audio a chaque rAF mais ne rend qu'au changement de pas (et a
 * la fin d'un flash). Apres chaque frame rendue, les ecouteurs onView (la
 * trace du panneau, les jumeaux qui ont le focus) relisent la projection ;
 * quand la boucle s'arrete, les ecouteurs onIdle (les jumeaux) se recalent
 * une fois. Aucune reprojection du picking par frame.
 * create() et dispose() sont re-executables (StrictMode double-monte les
 * effets en DEV).
 */

import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Object3D,
  type Texture,
} from 'three';
import { clock } from '../audio/clock';
import { context, mix } from '../audio/drums';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import { motion } from '../state/motion';
import { explode as explodeState } from '../state/explode';
import { intro } from '../state/intro';
import { playhead } from '../state/playhead';
import { section } from '../state/section';
import {
  CAMERA,
  CHIP,
  COARSE_QUERY,
  COLOR,
  DPR_MAX,
  EXPLODE,
  FIRST_FRAME_WAIT_MS,
  FIT_H,
  FRAME_DESKTOP,
  FRAME_MOBILE,
  INTRO,
  KNOB,
  KNOB_FX,
  LCD_RIGHT_SX,
  LEVEL_KNOB,
  LIGHT_HEMI,
  LIGHT_KEY,
  LIGHT_RIM,
  MACHINE,
  MACHINE_H,
  MOBILE_QUERY,
  NAV_KNOBS,
  NAV_KNOB_SPECS,
  PAD_FX,
  PARALLAX,
  PLATEAU_W,
  SECTION_FRAME,
  SHADOW_PLANE,
  TEMPO_KNOB,
  TONE_KNOB,
  panelLeft,
  type ChipId,
  type NavId,
} from '../theme';
import { Explode, type ExplodeInfo } from './explode';
import { HitMap, type HotspotDef } from './hit';
import { Knobs, potAngle, tempoAngle } from './knobs';
import { Machine } from './machine';
import { withContactShadow } from './materials';
import { Pads } from './pads';
import { Pcb } from './pcb';
import { Screen } from './screen';
import { Sequencer3D } from './sequencer3d';
import { Mention, PlateauSilk, fontsReady, whenFonts } from './silk';
import { Tweens, easeInOutCubic, easeOutCubic } from './tween';

/* ---------------- parallaxe (spec 3.5) ---------------- */

const DEG = Math.PI / 180;
const AXIS_Y = new Vector3(0, 1, 0);
/** Axe horizontal de l'ecran (la droite de la camera) : un angle positif baisse le bord avant. */
const AXIS_PITCH = new Vector3(1, 0, -1).normalize();
const qYaw = new Quaternion();
const qPitch = new Quaternion();
const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

export class Parallax {
  yaw = 0;
  pitch = 0;
  targetYaw = 0;
  targetPitch = 0;
  /** souris (pointeur fin) et mouvement complet seulement */
  enabled = false;

  /** nx, ny dans [-1, 1] sur l'hote du canvas ; true s'il faut une frame. */
  setPointer(nx: number, ny: number): boolean {
    if (!this.enabled) return false;
    const max = PARALLAX.maxDeg * DEG;
    this.targetYaw = -clamp1(nx) * max;
    this.targetPitch = clamp1(ny) * max;
    return this.moving;
  }

  release(): boolean {
    this.targetYaw = 0;
    this.targetPitch = 0;
    return this.moving;
  }

  get moving(): boolean {
    return this.yaw !== this.targetYaw || this.pitch !== this.targetPitch;
  }

  /**
   * Lissage independant du framerate : 0.06 par frame a 60 fps. Sous
   * 0.0003 rad d'ecart la cible est prise telle quelle et la boucle s'arrete.
   * Renvoie true si la machine a bouge (une frame a rendre).
   */
  step(dt: number, target: Object3D): boolean {
    if (!this.moving) return false;
    const dy = this.targetYaw - this.yaw;
    const dp = this.targetPitch - this.pitch;
    if (Math.abs(dy) <= PARALLAX.epsilon && Math.abs(dp) <= PARALLAX.epsilon) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    } else {
      const k = 1 - Math.pow(1 - PARALLAX.lerp, dt / 16.667);
      this.yaw += dy * k;
      this.pitch += dp * k;
    }
    this.apply(target);
    return true;
  }

  snap(target: Object3D): void {
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.apply(target);
  }

  private apply(target: Object3D): void {
    qYaw.setFromAxisAngle(AXIS_Y, this.yaw);
    qPitch.setFromAxisAngle(AXIS_PITCH, this.pitch);
    target.quaternion.multiplyQuaternions(qPitch, qYaw);
  }
}

/* ---------------- Stage ---------------- */

/**
 * Un animateur renvoie true s'il a change la scene (frame rendue, boucle
 * gardee), 'poll' s'il n'a rien change mais doit etre relu a la prochaine
 * frame (horloge audio, echeance d'un flash : boucle gardee, rien rendu),
 * false s'il n'a plus rien a faire.
 */
export type Animator = (now: number, dt: number) => boolean | 'poll';

export interface StageOpts {
  /** conteneur du canvas : taille, visibilite */
  host: HTMLElement;
  /** element qui recoit les pointermove (parallaxe) */
  input: HTMLElement;
  /** palier de qualite, fige a la creation : antialias, DPR, ombres, textures */
  mobile: boolean;
  dev: boolean;
  onError: (where: string, message: string) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  /** onglet ou canvas visible / cache (le son s'y branchera) */
  onVisibility?: (visible: boolean) => void;
}

export interface StageStats {
  /** frames RENDUES (pas les rAF a vide) */
  frames: number;
  /** rAF executes, rendus ou non (la lecture interroge l'horloge sans rendre) */
  rafs: number;
  drawCalls: number;
  triangles: number;
  lastRenderAt: number;
  loopActive: boolean;
  dpr: number;
}

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StageMeasure {
  viewport: { w: number; h: number };
  canvas: ScreenBox;
  pxPerUnit: number;
  frustum: { hw: number; hh: number };
  /**
   * cadrage de section (spec 3.3) : t de 0 a 1, decalage horizontal du
   * frustum (unites) ; vue eclatee (spec 3.4) : t de 0 a 1, montee de la vue
   */
  framing: { section: number; ox: number; explode: number; oy: number };
  /** empreinte 14 x 9 a coins vifs : la definition du cadrage (spec 3.2) */
  footprint: ScreenBox & { ratio: number };
  /** maillages reels (coins arrondis), en px CSS de la fenetre */
  plateau: ScreenBox & { ratio: number };
  socle: ScreenBox & { ratio: number };
  machine: ScreenBox & { ratio: number };
  parallax: { yawDeg: number; pitchDeg: number };
  explode: ExplodeInfo;
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const v3 = new Vector3();
/** les 16 LED des pas (test de l'intro) */
const STEP_LEDS = 16;

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  readonly machine: Machine;
  readonly silk: PlateauSilk;
  readonly parallax = new Parallax();
  /** tweens de la scene (pads aujourd'hui), avances en tete de chaque frame */
  readonly tweens = new Tweens();
  readonly pads: Pads;
  /** zone B : pas, RUN/STOP, CLEAR, LED (et les LED des knobs de navigation) */
  readonly seq: Sequencer3D;
  /** TEMPO, les cinq knobs de navigation, TONE, LEVEL */
  readonly knobs: Knobs;
  /** zone D : l'ecran LCD, texte de state/lcd.ts */
  readonly screen: Screen;
  /** le PCB de la vue eclatee : carte texturee et composants */
  readonly pcb: Pcb;
  /** OPEN : les trois couches et leur cadrage */
  readonly explode: Explode;
  /** picking en espace ecran : la liste explicite des objets interactifs */
  readonly hit: HitMap;
  readonly stats: StageStats = { frames: 0, rafs: 0, drawCalls: 0, triangles: 0, lastRenderAt: 0, loopActive: false, dpr: 1 };

  private opts: StageOpts;
  private canvas: HTMLCanvasElement;
  private key: DirectionalLight;
  private hemi: HemisphereLight;
  /** lisere jaune depuis la gauche (PointLight, voir theme.ts LIGHT_RIM) */
  private rim: PointLight;
  private shadowMesh: Mesh;
  private animators: Animator[] = [];
  private timers: number[] = [];
  private width = 1;
  private height = 1;
  private hw = 1;
  private ppu = 1;
  private layoutMobile: boolean;
  private hostRect = { left: 0, top: 0, width: 1, height: 1 };
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
  private unsubClock: () => void;
  /** les 16 pas du picking (coupes quand le Dock les remplace) */
  private stepDefs: HotspotDef[];
  /** seq du pas affiche par la tete de lecture, -1 a l'arret */
  private headSeq = -1;
  /** knob de navigation sous la souris : souleve, lisere yellowHi */
  private hoverNav: NavId | null = null;
  /** angle vise par chaque knob de navigation : un tween ne repart que si la cible change */
  private navGoal = new Map<NavId, number>();
  /** cadrage de section (spec 3.3) : 0 = base, 1 = machine decalee pour le panneau */
  private secT = 0;
  private secGoal = 0;
  /** decalage horizontal du frustum, en unites (cadrage de section) */
  private ox = 0;
  /** montee de la vue, en unites (vue eclatee) */
  private oy = 0;
  /** relus apres chaque frame rendue (trace du panneau) : un tableau, pas d'iterateur par frame */
  private viewListeners: (() => void)[] = [];
  /** appeles quand la boucle s'arrete et apres un redimensionnement (jumeaux) */
  private idleListeners: (() => void)[] = [];
  /** densite de pixels observee : un ecran 1x -> 2x ne change pas la taille CSS */
  private dprMql: MediaQueryList | null = null;
  private unsubSection: () => void;
  private unsubMix: () => void;
  private mention: Mention;
  /** les trois puces (allumees pendant l'ouverture et vue ouverte) */
  private chipDefs: HotspotDef[];
  /** puce sous la souris : soulevee */
  private hoverChip: ChipId | null = null;
  /** vue eclatee visee : true pendant l'ouverture et vue ouverte */
  private explodeGoal = false;
  private unsubExplode: () => void;
  private detachExplode: () => void;
  /** intro (spec 7.4) : en cours, et l'instant de sa premiere frame (-1 avant) */
  private introOn = false;
  private introT0 = -1;

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
        antialias: !opts.mobile,
        alpha: false,
        powerPreference: 'high-performance',
      });
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

    renderer.setPixelRatio(this.dprCap());
    renderer.setClearColor(COLOR.ink, 1);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    // three 0.186 a retire PCFSoftShadowMap (il avertit puis bascule sur PCF) :
    // PCF avec shadow.radius donne la meme ombre douce, sans l'avertissement
    renderer.shadowMap.type = PCFShadowMap;

    this.camera = new OrthographicCamera(-10, 10, 10, -10, CAMERA.near, CAMERA.far);
    this.camera.position.set(CAMERA.x, CAMERA.y, CAMERA.z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);

    // Lumiere principale : blanc chaud, seule a projeter une ombre
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
    // Lisere chaud : un PointLight sans ombre (0 Ko), pas le RectAreaLight
    // et ses 101 Ko de tables LTC (section 19)
    this.rim = new PointLight(LIGHT_RIM.color, LIGHT_RIM.intensity, 0, LIGHT_RIM.decay);
    this.rim.position.set(LIGHT_RIM.x, LIGHT_RIM.y, LIGHT_RIM.z);
    this.scene.add(key, key.target, this.hemi, this.rim);

    // La machine, sa serigraphie, le plan d'ombre (enfant du socle : il
    // descendra avec lui pendant l'eclate)
    this.machine = new Machine(mobile);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.silk = new PlateauSilk(mobile, aniso);
    this.machine.plateau.add(this.silk.mesh);
    const shadowGeo: BufferGeometry = new PlaneGeometry(SHADOW_PLANE.size, SHADOW_PLANE.size);
    shadowGeo.rotateX(-Math.PI / 2);
    // L'ombre de la cle tombe derriere la machine (lumiere cote camera) : le
    // meme plan porte aussi une ombre de contact calculee, visible devant
    this.shadowMesh = new Mesh(shadowGeo, withContactShadow(new ShadowMaterial({ opacity: SHADOW_PLANE.opacity, depthWrite: false })));
    this.shadowMesh.name = 'shadowPlane';
    this.shadowMesh.position.y = SHADOW_PLANE.y;
    this.shadowMesh.receiveShadow = true;
    this.machine.socle.add(this.shadowMesh);
    this.scene.add(this.machine.root);

    // Zone A : les pads (ils projettent leur ombre sur mobile aussi, spec 4.3)
    this.pads = new Pads({
      tweens: this.tweens,
      reduced: motion.reduced,
      invalidate: () => this.invalidate(),
      castShadow: true,
    });
    this.machine.plateau.add(this.pads.mesh);
    // Zone B : pas, RUN/STOP, CLEAR et leurs LED (plus les LED des knobs) ;
    // zones C et D : les huit knobs, un draw call par maillage partage
    this.seq = new Sequencer3D(mobile);
    this.knobs = new Knobs([TEMPO_KNOB, ...NAV_KNOB_SPECS, TONE_KNOB, LEVEL_KNOB], { mobile, castShadow: !mobile });
    const plateau = this.machine.plateau;
    plateau.add(this.seq.buttons, this.seq.leds, this.knobs.bodies, this.knobs.caps, this.knobs.rings);
    // Zone D : l'ecran (redessine 4 fois par seconde au plus, jamais par
    // frame) ; il ne s'abonne a state/lcd.ts qu'avec les autres ecouteurs
    this.screen = new Screen(aniso, () => this.invalidate());
    plateau.add(this.screen.mesh);
    // Socle : la mention V.4 / 2026 ; PCB : la carte et ses composants
    this.mention = new Mention(aniso);
    this.machine.socle.add(this.mention.mesh);
    this.pcb = new Pcb(mobile, aniso);
    this.machine.pcb.add(this.pcb.board, this.pcb.parts);
    this.explode = new Explode(
      { plateau, pcb: this.machine.pcb, parts: this.pcb.parts, socle: this.machine.socle },
      (open) => explodeState.settle(open)
    );
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
    // Ordre de la liste = ordre de tabulation des jumeaux (spec 6.1) : pads,
    // pas, RUN, CLEAR, TEMPO, knobs, OPEN, TONE, LEVEL, puces
    this.hit.add(this.pads.hotspots(plateau));
    const seqDefs = this.seq.hotspots(plateau);
    this.stepDefs = seqDefs.filter((d) => d.kind === 'step');
    this.hit.add(seqDefs);
    this.hit.add([this.knobs.hotspot(TEMPO_KNOB.id, 'tempo', plateau)]);
    this.hit.add(NAV_KNOBS.map((k) => this.knobs.hotspot(k.id, 'knob', plateau, `knob-${k.id}`, k.id)));
    this.hit.add([this.seq.openHotspot(plateau)]);
    this.hit.add([this.knobs.hotspot(TONE_KNOB.id, 'tone', plateau), this.knobs.hotspot(LEVEL_KNOB.id, 'level', plateau)]);
    this.chipDefs = this.pcb.hotspots(this.machine.pcb);
    this.hit.add(this.chipDefs);

    // Taille initiale ; le canvas passe a l'encre tout de suite (jamais un noir pur)
    this.width = Math.max(1, opts.host.clientWidth);
    this.height = Math.max(1, opts.host.clientHeight);
    renderer.setSize(this.width, this.height, false);
    this.stats.dpr = renderer.getPixelRatio();
    this.updateCamera();
    this.readHostRect();
    renderer.clear();

    this.animators.push(
      this.stepIntro,
      (now) => this.tweens.update(now),
      (_now, dt) => this.parallax.step(dt, this.machine.root),
      this.stepExplode,
      (now) => this.pads.update(now),
      this.pollPlayhead
    );
    // Intro (spec 7.4) : mouvement complet seulement ; la machine attend
    // plus bas jusqu'a la premiere frame
    if (!motion.reduced()) {
      this.introOn = true;
      this.machine.root.position.y = -INTRO.dropY;
      intro.set('pending');
    } else {
      intro.set('done');
    }

    // Plus rien ne touche au GL d'ici la fin du constructeur : un echec plus
    // haut ne laisse donc aucun ecouteur accroche
    this.screen.listen();
    this.syncParallax();
    this.unsubMotion = motion.subscribe(this.syncParallax);
    this.syncPattern();
    this.unsubPattern = pattern.subscribe(this.syncPattern);
    this.syncMix();
    this.unsubMix = mix.subscribe(this.syncMix);
    // Section deja ouverte (remontage) : etat pose sans animation
    this.applySection(true);
    this.unsubSection = section.subscribe(this.syncSection);
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
    this.coarseMql.addEventListener('change', this.syncParallax);
    this.layoutMql.addEventListener('change', this.onLayout);
    opts.input.addEventListener('pointermove', this.onPointerMove);
    opts.input.addEventListener('pointerleave', this.onPointerLeave);
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

  /** Demande une frame. Sans effet au repos tant que rien ne l'appelle. */
  invalidate(): void {
    this.dirty = true;
    this.kick();
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
   * Cadrage de base (spec 3.2) : 78 % desktop, 92 % mobile, 86 % de la
   * hauteur au plus. Section ouverte sur desktop (spec 3.3) : la machine
   * tient dans la largeur moins la goutiere du panneau (304 px, 200 sous
   * 1100 px), sans que l'ecran passe sous le panneau (16 px de marge), et
   * son centre passe de W/2 a stageW/2. Vue eclatee (spec 3.4) : la pile
   * tient dans 86 % de la hauteur (le frustum s'agrandit si besoin, jamais
   * sur un telephone en portrait) et la vue monte de EXPLODE.shiftY ; les
   * deux cadrages se composent. Les decalages passent par le frustum
   * (left/right/top/bottom), pas par la camera : la parallaxe tourne
   * toujours autour du centre de la machine.
   */
  private updateCamera(): void {
    const W = this.width;
    const aspect = W / this.height;
    const frame = this.layoutMobile ? FRAME_MOBILE : FRAME_DESKTOP;
    const hwBase = Math.max(PLATEAU_W / 2 / frame, (MACHINE_H / FIT_H / 2) * aspect);
    const t = this.layoutMobile ? 0 : this.secT;
    let hw = hwBase;
    // Decalage du centre de la machine vers la gauche, en px (cadrage de section)
    let shiftPx = 0;
    if (t > 0) {
      const gutter = W >= SECTION_FRAME.wideMin ? SECTION_FRAME.gutterWide : SECTION_FRAME.gutterNarrow;
      // Coin droit de l'ecran a stageW x (0.5 + sx / 2 hw) : il reste a gauche du panneau
      const lcdRatio = 0.5 + LCD_RIGHT_SX / (2 * hwBase);
      const fit = (panelLeft(W) - SECTION_FRAME.lcdGap) / lcdRatio;
      const stageW = Math.max(W / 3, Math.min(W - gutter, fit));
      const hwS = (hwBase * W) / stageW;
      hw = hwBase + (hwS - hwBase) * t;
      shiftPx = ((W - stageW) / 2) * t;
    }
    const e = this.explode.p.frame;
    if (e > 0) {
      const hwExp = Math.max(hw, EXPLODE.fitHalfH * aspect);
      hw += (hwExp - hw) * e;
    }
    // px -> unites a l'echelle courante : le centre de la machine reste a stageW / 2
    const ox = shiftPx * ((2 * hw) / W);
    const oy = EXPLODE.shiftY * e;
    const hh = hw / aspect;
    const c = this.camera;
    c.left = -hw + ox;
    c.right = hw + ox;
    c.top = hh + oy;
    c.bottom = -hh + oy;
    c.updateProjectionMatrix();
    this.hw = hw;
    this.ox = ox;
    this.oy = oy;
    this.ppu = W / (2 * hw);
  }

  private dprCap(): number {
    return Math.min(window.devicePixelRatio || 1, this.opts.mobile ? DPR_MAX.mobile : DPR_MAX.desktop);
  }

  private readHostRect(): void {
    const r = this.opts.host.getBoundingClientRect();
    this.hostRect.left = r.left;
    this.hostRect.top = r.top;
    this.hostRect.width = r.width;
    this.hostRect.height = r.height;
  }

  /** Taille du canvas ; rendu synchrone pour ne jamais montrer un tampon vide. */
  resize(w: number, h: number): void {
    if (this.disposed || w < 1 || h < 1) return;
    this.readHostRect();
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
    const plateau = meshBox(this.machine.plate);
    const socle = meshBox(this.machine.base);
    const machine = toBox(
      Math.min(plateau.x, socle.x),
      Math.max(plateau.x + plateau.w, socle.x + socle.w),
      Math.min(plateau.y, socle.y),
      Math.max(plateau.y + plateau.h, socle.y + socle.h)
    );
    // Empreinte a coins vifs du plateau (celle qui definit PLATEAU_W)
    reset();
    const hx = MACHINE.width / 2;
    const hz = MACHINE.depth / 2;
    for (const [x, z] of [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ]) {
      add(v3.set(x, 0, z).applyMatrix4(this.machine.plateau.matrixWorld));
    }
    const footprint = toBox(acc.x0, acc.x1, acc.y0, acc.y1);
    return {
      viewport: { w: vw, h: window.innerHeight },
      canvas: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      pxPerUnit: +this.ppu.toFixed(3),
      frustum: { hw: +this.hw.toFixed(4), hh: +(this.hw * (this.height / this.width)).toFixed(4) },
      framing: {
        section: +this.secT.toFixed(4),
        ox: +this.ox.toFixed(4),
        explode: +this.explode.p.frame.toFixed(4),
        oy: +this.oy.toFixed(4),
      },
      footprint,
      plateau,
      socle,
      machine,
      parallax: { yawDeg: +(this.parallax.yaw / DEG).toFixed(3), pitchDeg: +(this.parallax.pitch / DEG).toFixed(3) },
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
      this.pcb.draw();
      this.mention.draw();
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
    this.invalidate();
  }

  /* ---------------- intro (spec 7.4) ---------------- */

  /**
   * Animateur de l'intro : la machine monte de INTRO.dropY a sa place en
   * 700 ms (easeOutCubic), les LED des pas font leur test (aller et retour
   * en 400 ms). Le temps part de la premiere frame rendue.
   */
  private stepIntro = (now: number): boolean => {
    if (!this.introOn) return false;
    if (this.introT0 < 0) this.introT0 = now;
    const t = now - this.introT0;
    if (t >= INTRO.ms) {
      this.finishIntro();
      return true;
    }
    this.machine.root.position.y = -INTRO.dropY * (1 - easeOutCubic(t / INTRO.ms));
    const u = (t - INTRO.ledFromMs) / INTRO.ledMs;
    const n = STEP_LEDS;
    // 0 -> 15 puis 15 -> 0 : une LED a la fois
    const led = u < 0 || u >= 1 ? -1 : u < 0.5 ? Math.floor(u * 2 * n) : n - 1 - Math.floor((u - 0.5) * 2 * n);
    this.seq.setIntroLed(led);
    return true;
  };

  /** Fin de l'intro, tout de suite (premier geste, fin du temps, reduced motion, demontage). */
  finishIntro(): void {
    if (!this.introOn) return;
    this.introOn = false;
    this.machine.root.position.y = 0;
    this.seq.setIntroLed(-1);
    intro.set('done');
    this.invalidate();
  }

  /* ---------------- boucle ---------------- */

  private kick(): void {
    if (this.raf !== 0 || this.disposed || this.paused || this.contextLost || !this.started) return;
    this.raf = requestAnimationFrame(this.frame);
    this.stats.loopActive = true;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    this.stats.rafs += 1;
    // Reveil apres un repos : un pas de 16.7 ms, pas l'ecart depuis la derniere frame
    const dt = this.last < 0 ? 16.667 : Math.min(50, now - this.last);
    this.last = now;
    let moved = false;
    let poll = false;
    try {
      const list = this.animators;
      for (let i = 0; i < list.length; i += 1) {
        const r = list[i](now, dt);
        if (r === true) moved = true;
        else if (r === 'poll') poll = true;
      }
      if (moved) this.dirty = true;
      if (this.dirty) this.render(now);
    } catch (e) {
      this.stats.loopActive = false;
      this.opts.onError('frame', msg(e));
      return;
    }
    if (moved || poll) {
      this.kick();
    } else {
      this.last = -1;
      this.stats.loopActive = false;
      this.emitIdle();
    }
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
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
    const r = this.renderer.info.render;
    this.stats.frames += 1;
    this.stats.lastRenderAt = now;
    this.stats.drawCalls = r.calls;
    this.stats.triangles = r.triangles;
    // La trace suit le knob (cadrage, parallaxe, taille) ; une erreur chez
    // un ecouteur ne coupe jamais le WebGL. Boucle indexee : aucun iterateur
    const list = this.viewListeners;
    for (let i = 0; i < list.length; i += 1) {
      try {
        list[i]();
      } catch (e) {
        this.opts.onError('view', msg(e));
      }
    }
  }

  /** Appele apres chaque frame rendue ; renvoie la fonction de retrait. */
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
   * Un point du plateau (repere local, parallaxe comprise) en px CSS du
   * canvas ; `out` evite une allocation (la trace l'appelle par frame).
   */
  projectPlateau(x: number, y: number, z: number, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
    this.machine.plateau.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld();
    v3.set(x, y, z).applyMatrix4(this.machine.plateau.matrixWorld).project(this.camera);
    out.x = ((v3.x + 1) / 2) * this.width;
    out.y = ((1 - v3.y) / 2) * this.height;
    return out;
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
    this.updateCamera();
    this.syncSteps();
    this.invalidate();
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || !this.parallax.enabled) return;
    const r = this.hostRect;
    if (r.width < 1 || r.height < 1) return;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (this.parallax.setPointer(nx, ny)) this.kick();
  };

  private onPointerLeave = (): void => {
    if (this.parallax.release()) this.kick();
  };

  /**
   * Survol au pointeur fin (HitLayer) : la LED du pas survole passe en
   * ledHover ; un knob de navigation se souleve de 0.08 en 150 ms et son
   * lisere passe en yellowHi ; le quitter le repose de meme.
   */
  setHover(id: string | null): void {
    const i = id !== null && id.startsWith('step-') ? Number(id.slice(5)) - 1 : -1;
    let changed = this.seq.setHover(i);
    const nav = id !== null && id.startsWith('knob-') ? (id.slice(5) as NavId) : null;
    if (nav !== this.hoverNav) {
      if (this.hoverNav) this.lift(this.hoverNav, false);
      this.hoverNav = nav;
      if (nav) this.lift(nav, true);
      changed = true;
    }
    // Puce du PCB (vue ouverte) : elle se souleve comme un knob
    const chip = id !== null && id.startsWith('chip-') ? (id.slice(5) as ChipId) : null;
    if (chip !== this.hoverChip) {
      if (this.hoverChip) this.liftChip(this.hoverChip, false);
      this.hoverChip = chip;
      if (chip) this.liftChip(chip, true);
      changed = true;
    }
    if (changed) this.invalidate();
  }

  private liftChip(id: ChipId, on: boolean): void {
    this.tweens.run(
      `chip.rise.${id}`,
      (v) => this.pcb.setRise(id, v),
      this.pcb.riseOf(id),
      on ? CHIP.rise : 0,
      motion.reduced() ? 0 : KNOB_FX.riseMs,
      easeOutCubic,
      performance.now()
    );
  }

  /** Animateur de la vue eclatee : les couches, puis le cadrage qui les suit. */
  private stepExplode = (now: number): boolean => {
    if (!this.explode.update(now)) return false;
    this.updateCamera();
    this.syncChips();
    return true;
  };

  /**
   * Les puces repondent au pointeur vue ouverte, et pendant l'ouverture des
   * que le plateau les a decouvertes (EXPLODE.chipsFrom) ; jamais pendant la
   * fermeture. true si un drapeau a change.
   */
  private syncChips(): boolean {
    const s = explodeState.get();
    const live = s === 'open' || (s === 'opening' && this.explode.p.plateau >= EXPLODE.chipsFrom);
    let changed = false;
    for (const d of this.chipDefs) {
      if (d.enabled === live) continue;
      d.enabled = live;
      changed = true;
    }
    if (!live && this.hoverChip) {
      this.liftChip(this.hoverChip, false);
      this.hoverChip = null;
    }
    if (changed) this.hit.invalidate();
    return changed;
  }

  /**
   * OPEN (store state/explode.ts) : opening ou closing lance l'animation
   * (coupe franche a la frame suivante en reduced motion) ; la
   * serigraphie passe de OPEN a CLOSE des le depart ; les puces repondent
   * une fois decouvertes (syncChips). open et closed sont poses par
   * l'animation elle-meme (settle) ; une remise a closed pendant une
   * animation (demontage) coupe net.
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
      this.explode.snap(goal);
      // Pas d'ecouteur de ce Stage encore : pas de reentrance
      if (s === 'opening' || s === 'closing') explodeState.settle(goal);
      changed = true;
    } else if (goal !== this.explodeGoal) {
      this.explodeGoal = goal;
      if (s === 'opening' || s === 'closing') this.explode.start(goal, performance.now(), motion.reduced());
      else this.explode.snap(goal);
      changed = true;
    }
    if (this.silk.setOpenLabel(goal ? 'CLOSE' : 'OPEN')) changed = true;
    if (this.syncChips()) changed = true;
    if (!changed) return;
    this.hit.invalidate();
    this.updateCamera();
    this.invalidate();
  }

  private lift(id: NavId, on: boolean): void {
    this.knobs.setRing(id, on ? 'yellowHi' : 'yellow');
    const dur = motion.reduced() ? 0 : KNOB_FX.riseMs;
    this.tweens.run(
      `knob.rise.${id}`,
      (v) => this.knobs.setRise(id, v),
      this.knobs.riseOf(id),
      on ? KNOB.rise : 0,
      dur,
      easeOutCubic,
      performance.now()
    );
  }

  /**
   * Section ouverte (spec 7.2 KNOB) : le knob actif tourne de 30 deg vers la
   * droite en 220 ms et sa LED s'allume, le precedent revient a 0 ; un seul
   * actif. Sur desktop la camera recadre pour le panneau (400 ms).
   */
  private syncSection = (): void => {
    this.applySection(false);
  };

  private applySection(instant: boolean): void {
    const s = section.get();
    const now = performance.now();
    const dur = instant || motion.reduced() ? 0 : KNOB_FX.turnMs;
    let changed = false;
    NAV_KNOBS.forEach((k, j) => {
      const on = k.id === s;
      if (this.seq.setKnobLed(j, on)) changed = true;
      const goal = on ? KNOB.turnDeg * DEG : 0;
      if (this.navGoal.get(k.id) === goal) return;
      this.navGoal.set(k.id, goal);
      this.tweens.run(`knob.angle.${k.id}`, (v) => this.knobs.setAngle(k.id, v), this.knobs.angleOf(k.id), goal, dur, easeOutCubic, now);
      changed = true;
    });
    if (this.retargetFraming(instant)) changed = true;
    if (changed) this.invalidate();
  }

  /** Cadrage de section : vise 1 si une section est ouverte sur desktop ; true s'il change. */
  private retargetFraming(cut: boolean): boolean {
    const goal = section.get() !== null && !this.layoutMobile ? 1 : 0;
    if (goal === this.secGoal) return false;
    this.secGoal = goal;
    const dur = cut || motion.reduced() ? 0 : SECTION_FRAME.ms;
    this.tweens.run(
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

  /** TONE et LEVEL suivent le bus (glisser, molette, double tape, tests). */
  private syncMix = (): void => {
    let changed = this.knobs.setAngle(TONE_KNOB.id, potAngle(mix.tone));
    if (this.knobs.setAngle(LEVEL_KNOB.id, potAngle(mix.level))) changed = true;
    if (changed) this.invalidate();
  };

  /**
   * Store du motif : le pad de l'instrument selectionne reste allume, les
   * LED suivent les pas programmes, TEMPO tourne avec le tempo.
   */
  private syncPattern = (): void => {
    const p = pattern.get();
    this.pads.setSelected(p.instrument);
    let changed = this.seq.setPattern(p.steps, p.instrument);
    if (this.knobs.setAngle(TEMPO_KNOB.id, tempoAngle(p.bpm))) changed = true;
    if (changed) this.invalidate();
  };

  /** RUN/STOP : couleur du bouton ; la boucle se met a lire l'horloge audio. */
  private syncRun = (): void => {
    if (this.seq.setRunning(clock.running)) this.invalidate();
    this.kick();
  };

  /**
   * Les pas 3D se coupent quand le Dock HTML les remplace (mise en page
   * mobile : 7 px entre deux pas sur un telephone, section 19).
   */
  private syncSteps(): void {
    const on = !this.layoutMobile;
    let changed = false;
    for (const d of this.stepDefs) {
      if (d.enabled === on) continue;
      d.enabled = on;
      changed = true;
    }
    if (!changed) return;
    this.hit.invalidate();
    if (!on && this.seq.setHover(-1)) this.invalidate();
  }

  /**
   * Tete de lecture (spec 7.5 et 14.1). Pendant la lecture chaque rAF lit
   * l'horloge audio ; une frame n'est rendue que quand le pas change : LED,
   * flash des pads du pas (a l'instant ou il sonne, pas a sa programmation),
   * Dock. Entre deux pas, 'poll' garde la boucle sans rien rendre.
   */
  private pollPlayhead = (now: number): boolean | 'poll' => {
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
    return true;
  };

  /** Parallaxe : pointeur fin et mouvement complet seulement ; reduced motion coupe aussi l'intro. */
  private syncParallax = (): void => {
    if (motion.reduced()) this.finishIntro();
    const on = !this.coarseMql.matches && !motion.reduced();
    if (on === this.parallax.enabled) return;
    this.parallax.enabled = on;
    if (!on) {
      this.parallax.release();
      this.parallax.snap(this.machine.root);
      this.invalidate();
    }
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
    // mais recree aussi son fond : la couleur de clear retomberait au noir
    this.contextLost = false;
    this.renderer.setClearColor(COLOR.ink, 1);
    this.opts.onContextRestored();
    this.invalidate();
  };

  /* ---------------- fin de vie ---------------- */

  /** Texture DFG de three (module, partagee) : lue avant de liberer les materiaux. */
  private sharedTextures(): Texture[] {
    const out: Texture[] = [];
    try {
      const p = this.renderer.properties.get(this.machine.body) as {
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
    this.unsubClock();
    this.unsubMix();
    this.unsubSection();
    this.unsubExplode();
    this.detachExplode();
    this.viewListeners.length = 0;
    this.idleListeners.length = 0;
    this.dprMql?.removeEventListener('change', this.onDpr);
    this.dprMql = null;
    playhead.set(-1);
    this.tweens.clear();
    this.coarseMql.removeEventListener('change', this.syncParallax);
    this.layoutMql.removeEventListener('change', this.onLayout);
    this.opts.input.removeEventListener('pointermove', this.onPointerMove);
    this.opts.input.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('webglcontextlost', this.onLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false);
    document.removeEventListener('visibilitychange', this.onVisibility);

    // La texture partagee de three (DFG) est liberee ici et re-televersee au
    // prochain montage depuis ses donnees en memoire
    const shared = this.sharedTextures();
    this.machine.dispose();
    this.silk.dispose();
    this.pads.dispose();
    this.seq.dispose();
    this.knobs.dispose();
    this.screen.dispose();
    this.mention.dispose();
    this.pcb.dispose();
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as ShadowMaterial).dispose();
    this.key.dispose();
    this.hemi.dispose();
    this.rim.dispose();
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
