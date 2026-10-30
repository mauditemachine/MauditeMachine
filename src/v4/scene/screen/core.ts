/**
 * L'ecran du MM-RYTM, le coeur (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) : la classe Screen (la toile, ses
 * minuteries, ses primitives de dessin, le dessin d'une image et sa repartition), deplacee telle quelle de scene/screen.ts.
 * Ses autres methodes vivent dans les fichiers de scene/screen/ (home, head, dials, grid, glyphs, foot, popups, menus/),
 * posees sur Screen.prototype : importer l'ecran par scene/screen.ts (le baril les charge toutes), jamais ce fichier seul.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { disposeSheen, glassSheen } from '../glassSheen';
import { clock } from '../../audio/clock';
import { compGr, mix } from '../../audio/drums';
import { kit } from '../../audio/kit';
import { onSampleStatus, samplesChanged } from '../../audio/samples';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../../audio/pattern';
import { tempoSync } from '../../state/tempoSync';
import { lockMask, lockOf, type StepLock } from '../../audio/locks';
import { lockCountOf, lockList, lockPages, lockSummary, soundBrowserView, stepPlays, voiceSoundText, type LockLine, type SoundBrowserView } from '../../actions';
import { rytmLock } from '../../state/rytmLock';
import { sceneCtl } from '../../state/sceneCtl';
import { anyScenes, sceneCount, type SceneId } from '../../rytm/sceneData';
import { sc } from '../../audio/soundcloud';
import { FENV_OCT, atkS, cutHz, decayTau, holdS, voiceFx } from '../../audio/voicefx';
import { editor } from '../../state/editor';
import { focus } from '../../state/focus';
import { lcd, type LcdState } from '../../state/lcd';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { BANKS, BANK_SIZE, bankName, bankOf, patterns, slotName } from '../../state/patterns';
import { ctlAllState } from '../../state/trk';
import { playhead } from '../../state/playhead';
import { rytmInfos } from '../../state/rytmInfos';
import { rytmPage, type RytmPageState, type RytmView } from '../../state/rytmPage';
import { voices } from '../../state/voices';
import { dtFace } from '../../state/dtFace';
import { DT_FACE, GLOBAL_ENCODERS, GLOBAL_ENC_LABELS, OLED, OLED_BAR, PORTRAIT, SCREEN_TOUCH, XFADE_UI, type EncId, type Inst } from '../../theme';
import { PRESET_SLOTS } from '../../state/presetMode';
import { softKeyName } from '../../rytm/presetKeys';
import { rytmInfoHit } from '../../rytm/infoIds';
import { FACE_PAGES, HOME_MENU, HOME_MENU_LABEL, RYTM_SCREENS, SCREEN_LABEL, isRytmPage, SCREEN_PAGE, SCREEN_TITLE, freeCells, fxScopeTabs, fxVoiceTabLabel, isFxDetail, pageLabel, pageSlots, screensOf, tabWord, type PageSlot, type RytmPageId, type RytmScreenId, type SlotCell } from '../../rytm/pages';
import { pageBlocks, screenIn, type Block, type BlockMode } from '../../rytm/pageView';
import { encUnit, v127Text } from '../../rytm/values';
import { screenDials, type ScreenDialId } from '../../state/screenDials';
import { makeCanvasTexture, onFonts } from '../silk';
import { CONDS, RATE_DENS, rtrgGain } from '../../audio/trig';
import { LFO_WAVES, waveAt } from '../../audio/lfo';
import { fill } from '../../state/fill';
import { ANIM_MS, BLACK, BLINK_MS, BLOCK, BLOCK_TYPE, CARD, CARD_W, cellRect, clamp01, COL, DIAL_GAP, DIAL_REF, DIAL_TIERS, type DialGeom, type DialTier, DY, FACE_STRIP, FACE_TEXT_SIZES, FACE_UNIT_SHRINK, FAINT, FAINT_TEXT, fit, FLASH, font, FRAME, FRAME_DIM, globalValueOf, GROW, HALF, HEAD_COL, HEAD_FIT, HEAD_FIT_MAX, HEAD_FIT_PHONE, HEAD_HIT_UP, type HeadFit, type HeadLeft, type HeadOp, type HeadPlan, HOVER_FILL, hzShort, IDLE_MS, INFO_KEY, INK, LINE, MATRIX, MENU_HIT_TOP, METER_MS, MIN_GAP_MS, modeLines, PAGE_DOTS, PAGE_FOOT, PAGE_HEAD, PAGE_STRIP, pageKeyWord, type Pal, PAL, PAL_NEG, type PanelArea, plockHints, pmutesNow, PRESET_LAYOUT, presetKeySpot, PULSE_MS, type Rect, RING, SB, SB_HOVER, SB_PITCH, soundOf, TALL, TALL_VALUE, TEX_K, TIP_MS, TURN, two, UH, UW, WAVE_MS } from './consts';

export interface ScreenInfo {
  /** redessins de la texture (le premier compris) */
  draws: number;
  /** les trois lignes du texte (le jumeau les lit) */
  text: [string, string, string];
  /** performance.now() du dernier redessin */
  lastDrawAt: number;
  /** plus petit ecart mesure entre deux redessins (ms) : jamais sous MIN_GAP_MS */
  minGapMs: number;
  font: string;
  size: [number, number];
  /** ce que montre l'ecran (2026-10-08) : HOME, la vue PAGE, EDIT, les presets ; le navigateur des sons (2026-10-18) */
  view: RytmView | 'edit' | 'presets' | 'browser';
  /** les presets dessines (2026-10-27) : la ligne d'avant | le curseur | la ligne d'apres | les touches ; '' ailleurs */
  presetList: string;
  /** le preset charge nomme en tete de HOME (2026-10-27, une etoile s'il a bouge) ; '' : rien */
  presetHead: string;
  /** la page du MM-RYTM (dessinee en vue PAGE) */
  page: RytmPageId;
  /** les blocs dessines en vue PAGE, NOM=VALEUR:etat ; [] ailleurs */
  blocks: string[];
  /** le bloc cerne (l'echo) dessine, -1 aucun */
  echo: number;
  /** le pas en LOCK dessine (2026-10-08), -1 aucun */
  lock: number;
  /** les blocs en negatif pour le pas qui joue (ses verrous) */
  flash: number[];
  /** les seize pas du pied : . vide, o un coup, L un coup verrouille, l des verrous sans coup ; * le pas en LOCK */
  strip: string;
  /** les lignes du pied en LOCK */
  foot: string[];
  /** le panneau des verrous du pas (en LOCK, ou le pas qui joue) dans la place vide de la page : ses lignes */
  panel: string[];
  /** le pied hors LOCK : le message, les verrous du pas qui joue, l'aide (telephone), les onglets ; '' rien */
  footText: string;
  /** les deux couches de la voix dans l'en-tete de SRC et SMPL (R3, revue) : SYN 909 OFF | SMP BLUEPRINT 127 ; '' ailleurs ou sans la place */
  layers: string;
  /** la touche i dessinee pleine : INFOS allume (R4) */
  infos: boolean;
  /** le bloc marque des quatre coins (INFOS : la carte de son encodeur est montree), -1 aucun */
  infoBlock: number;
  /** l'ecran dessine (2026-10-09 : la page et son onglet, VOICE, SYNTH, FLTR, ENV, FXV, FXG) */
  screen: RytmScreenId;
  /** les cases des blocs dessines (colonne, rangee, largeur, hauteur) */
  cells: string[];
  /** le bloc sous la souris dessine (desktop), -1 aucun */
  hover: number;
  /** le popup d'un encodeur du desktop dessine (GLOBAL DELAY 64 64%) ; '' aucun */
  popup: string;
  /** l'en-tete : la page et ses onglets (VOICE|[MAIN]|SYNTH), ou en P-LOCK son texte (P-LOCK STEP 05 | ENV · P-LOCKS) */
  head: string;
  /** la bande du crossfader au pied (2026-10-27, P2-20) : A 0.50 B (REC A, une scene armee) ; '' pas dessinee */
  xfade: string;
  /** le compte des verrous du pas en P-LOCK dans l'en-tete (-1 hors P-LOCK) */
  lockCount: number;
  /** M ou S quand MUTE ou SOLO est arme (M+ : MULTI) ; '' sinon */
  badge: string;
  /** ce que chaque bloc dessine sous sa valeur (revue du 2026-10-09) : NOM:unite|etiquette@name ou @unit */
  tags: string[];
  /** le dessin d'un ecran (ENV : AHD ..., FLTR : FILTER ...) ; '' aucun */
  graph: string;
  /**
   * le navigateur des sons dessine (2026-10-18) : son titre, son rang, la premiere ligne, le son du moment, la ligne du
   * clavier ; ses lignes NOM, * le son du moment, > la ligne du clavier, ! armee (REMOVE?), u un sample de ce navigateur ;
   * null : ferme
   */
  browser: { title: string; rank: string; top: number; cur: number; cursor: number; rows: string[] } | null;
  /** l'annonce d'un fichier glisse au-dessus de la machine (DROP ON A PAD, DROP ON BD) ; '' aucune */
  drop: string;
  /** le menu de la voix dessine sous HOME (2026-10-18) : SOUND VOICE FLTR ENV FX, -SOUND a peine (sans voix) ; [] ailleurs */
  menu: string[];
  /**
   * MASTER et TEMPO dessines (2026-10-19) : MASTER -3.9 DB (ou MASTER 6/7 sans la place du nombre : ses barres
   * allumees) | TEMPO 130 BPM, et * sur celui qui est cerne (tenu), ~ survole ; '' quand ils ne sont pas a l'ecran
   */
  dials: string;
  /** le pattern dessine a leur gauche (A01), '' s'il a cede sa place */
  dialSlot: string;
  /**
   * les places fixes de l'en-tete de la vue PAGE (2026-10-22, audit SB-13) : le palier des cadrans (A01, A01+DB, -),
   * la colonne de la voix (voice@148.8), le palier de serrage des onglets (fit0 a fit3, ! rien ne tient), |DB quand
   * MASTER tenu dit son niveau ; '' hors de la vue PAGE et en P-LOCK
   */
  headFit: string;
  /** les points de page sous la pastille (2026-10-27, desktop, une page a deux onglets) : 1/2, 2/2 ; '' aucun */
  pageDots: string;
}

export class Screen {
  readonly mesh: Mesh;
  /** le reflet du verre, enfant de mesh (glassSheen) */
  readonly sheen: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  timer = 0;
  unsubs: (() => void)[] = [];
  /**
   * Libere (2026-10-21, audit RS-5) : plus aucun redessin. Avant, un appel tardif (la promesse des polices, resolue
   * apres un demontage) relancait la boucle redessin -> vague au repos -> redessin pour toujours : ce minuteur retenait
   * le Stage mort, et par lui tout l'ancien DOM de la page (environ 1900 noeuds et 270 ecouteurs a chaque remontage).
   */
  disposed = false;
  /** les coups qui sonnent : l'instant du dernier, par voix */
  hitAt = new Float64Array(INSTRUMENTS.length);
  lastStep = -1;
  blinkUntil = 0;
  waveFrom = 0;
  lastCur = -1;
  activeAt = performance.now();
  scale: number;
  /** les corps des blocs de la vue PAGE (le telephone : plus gros) */
  bt: (typeof BLOCK_TYPE)[keyof typeof BLOCK_TYPE];
  /** la palette des dessins (la negative dans un bloc verrouille) */
  pal: Pal = PAL;
  /** le flash du pas verrouille qui joue (revue de R2) : sa voix, son pas, ses verrous, depuis, jusqu'a */
  flash: { inst: Inst; step: number; lock: Readonly<StepLock>; from: number; end: number } | null = null;
  /** la tete de lecture vue au dernier dessin (un nouveau pas : un nouveau coup) */
  flashHead = -1;
  /** INFOS (R4) : allume et l'encodeur dont la carte est montree, au dernier redessin demande */
  infoKey = '0|-1';

  constructor(
    anisotropy: number,
    /** demande une frame apres un redessin */
    public invalidate: () => void,
    /** telephone : pas de vague au repos (aucune image pour rien) */
    public mobile = false
  ) {
    // L'ecran 5:3 du desktop (2026-10-27) : 1600 x 960, deux fois les 800 x 480 de la dalle de la machine (5 px l'unite)
    const W = mobile ? 1024 : GROW > 0 ? 1600 : 1280;
    const H = Math.round((W * UH) / UW);
    this.scale = W / UW;
    // L'ecran haut du telephone (2026-10-09) a ses corps a lui ; une tablette (mobile, l'ecran du desktop) garde ceux du telephone ;
    // depuis le 2026-10-18 l'ecran du desktop est haut aussi : les corps du dessin haut (1.56 px l'unite a 1440 x 900)
    // L'ecran 5:3 du desktop (2026-10-27, GROW) : les corps de ses blocs plus hauts
    this.bt = TALL && GROW > 0 ? BLOCK_TYPE.wide : TALL ? BLOCK_TYPE.tall : mobile ? BLOCK_TYPE.phone : BLOCK_TYPE.desk;
    this.info = {
      draws: 0,
      text: ['', '', ''],
      lastDrawAt: -Infinity,
      minGapMs: Infinity,
      font: 'vector op-1',
      size: [W, H],
      view: 'home',
      presetList: '',
      presetHead: '',
      page: rytmPage.get().page,
      blocks: [],
      echo: -1,
      lock: -1,
      flash: [],
      strip: '',
      foot: [],
      panel: [],
      footText: '',
      layers: '',
      infos: false,
      infoBlock: -1,
      screen: 'voice',
      cells: [],
      hover: -1,
      popup: '',
      head: '',
      xfade: '',
      lockCount: -1,
      badge: '',
      graph: '',
      tags: [],
      browser: null,
      drop: '',
      menu: [],
      dials: '',
      dialSlot: '',
      headFit: '',
      pageDots: '',
    };
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('screen: no 2d context');
    this.ctx = ctx;
    // Mipmaps et anisotropie : l'ecran est vu de biais et reduit, un simple filtre lineaire scintillerait
    this.texture = makeCanvasTexture(this.canvas, anisotropy);

    const geo = new PlaneGeometry(OLED.w, OLED.d);
    // Couche sur le cadre, rangee 0 du canvas vers l'arriere : les lignes se lisent le long de +x
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'oled';
    this.mesh = new Mesh(geo, mat);
    this.mesh.name = 'oled';
    this.mesh.position.set(OLED.x, OLED.y, OLED.z);
    // Le reflet du verre (2026-10-22, audit, amelioration 20) : il suit l'ecran, le raycast de l'ecran ne le voit pas ;
    // la face V.4.0 du desktop (2026-10-27) : sur tout le verre de 106 x 67, autour de la zone active (le meme centre)
    this.sheen = PORTRAIT ? glassSheen(OLED.w, OLED.d) : glassSheen(OLED.bezel.w, OLED.bezel.d);
    this.mesh.add(this.sheen);
    this.lastCur = patterns.get().cur;
    this.paint(lcd.get(), performance.now());
  }

  /**
   * Abonnements, poses par le Stage une fois tout son GL construit : un
   * constructeur qui echoue plus loin ne laisse ainsi aucun ecouteur qui
   * retiendrait la scene morte.
   */
  listen(): void {
    for (const off of this.unsubs) off();
    const active = (): void => {
      this.activeAt = performance.now();
      this.request();
    };
    this.unsubs = [
      lcd.subscribe(active),
      pattern.subscribe(active),
      // Le TEMPO qui suit les platines (2026-10-27, le SYNC du MIXER) : 124.0 SYNC a la place de 124 BPM
      tempoSync.subscribe(active),
      patterns.subscribe(active),
      editor.subscribe(active),
      voices.subscribe(active),
      // V.5.0 : le mode MUTE de FUNC + TRK et REC se lisent au pied
      dtFace.subscribe(active),
      // FILL (V.5.1) : sa pastille dans l'en-tete
      fill.subscribe(active),
      // CONTROL ALL (V.5.2) : l'en-tete le dit pendant le geste
      ctlAllState.subscribe(active),
      voiceFx.subscribe(active),
      mix.subscribe(active),
      clock.subscribe(active),
      // La vue PAGE (2026-10-08) : sa page, ses valeurs (le kit, les effets du pattern) ; la tete de lecture
      // ne redessine que l'ecran d'aujourd'hui (HOME, EDIT), la page ne la montre pas
      rytmPage.subscribe(active),
      // Le LOCK (2026-10-08) : la pastille, les blocs en negatif, le pied
      rytmLock.subscribe(active),
      // SCENE A et B (2026-10-27) : l'en-tete de la scene armee, ses cles sur les blocs, leurs valeurs
      sceneCtl.subscribe(active),
      pattern.scenes.subscribe(() => active()),
      // Le crossfader (2026-10-27, P2-20) : un redessin doux (xTick) ; le debut et la fin d'un geste (la bande du pied)
      sceneCtl.onX(() => this.xTick()),
      sceneCtl.onGesture(() => this.request()),
      // INFOS (R4) : la touche i pleine, le bloc de la carte montree ; seulement quand l'un des deux change (revue de R4 : le
      // survol d'un pad ou d'un pas redessinait tout l'ecran et le renvoyait a la carte graphique)
      rytmInfos.subscribe(() => {
        const key = `${rytmInfos.isOn() ? 1 : 0}|${this.infoKnob()}|${this.infoDial() ?? ''}`;
        if (key === this.infoKey) return;
        this.infoKey = key;
        this.request();
      }),
      kit.subscribe(() => active()),
      pattern.fx.subscribe(active),
      // La tete de lecture : l'anneau de HOME, les seize pas du pied de la vue PAGE
      playhead.subscribe(() => this.request()),
      focus.subscribe(() => this.request()),
      // Le navigateur des sons (2026-10-18) : son defilement, son curseur, sa fermeture ; la liste des samples (un ajout, un
      // retrait) ; un fichier glisse au-dessus de la machine
      lcdSamples.subscribe(active),
      samplesChanged.subscribe(active),
      // Un sample qui arrive ou qui manque (2026-10-21) : LOADING..., OFFLINE: 909 PLAYS dans SOUND et la liste
      onSampleStatus(active),
      // MASTER et TEMPO (2026-10-19) : celui qu'on survole ou qu'on tient se cerne
      screenDials.subscribe(() => this.request()),
      // La police arrivee apres la premiere image : on redessine. 2026-10-22 (audit SB-01) : onFonts attend les graisses
      // 300 et 400 des valeurs (document.fonts.ready resolvait avant leur arrivee), et se rappelle si elles tardent ; les
      // places fixes de l'en-tete (headPlan) se mesurent de nouveau
      onFonts(() => {
        this.headPlans.clear();
        this.request();
      }),
    ];
    this.request();
  }

  /**
   * Le crossfader bouge (P2-20) : l'ecran se redessine, doucement, seulement s'il montre ce qui en depend (un bloc morphe,
   * la bande du pied) ; l'activite repousse la vague du repos.
   */
  xLive = false;
  xTick(): void {
    const now = performance.now();
    this.activeAt = now;
    // Au plus tous les XFADE_UI.screenGapMs, geste ou pas (le MIDI, en phase 3, n'en a pas)
    if (this.xLive) this.request(this.info.lastDrawAt + XFADE_UI.screenGapMs - now);
  }

  /** Un redessin bientot (au plus tous les MIN_GAP_MS ; pendant un geste du crossfader, tous les XFADE_UI.screenGapMs). */
  request(delay = 0): void {
    if (this.timer !== 0 || this.disposed) return;
    const gap = sceneCtl.moving() ? Math.max(MIN_GAP_MS, XFADE_UI.screenGapMs) : MIN_GAP_MS;
    // Arrondi au-dessus : setTimeout tronque les fractions, l'ecart tombait a 59,5 ms au lieu de 60
    const wait = Math.ceil(Math.max(delay, this.info.lastDrawAt + gap - performance.now(), 0));
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      const now = performance.now();
      const more = this.paint(lcd.get(), now);
      this.invalidate();
      if (more > 0) this.request(more);
      else this.armIdle(now);
    }, wait);
  }

  /**
   * La fin de l'echo d'un bloc (vue PAGE, 2026-10-08) : un redessin a ce
   * moment, par son propre minuteur (comme la vague) ; celui de request()
   * reste libre, un potard qu'on continue de tourner redessine tout de suite.
   */
  echoTimer = 0;
  /** l'aiguille du COMP est a l'ecran et bouge (2026-10-18) : paintPage redemande une image */
  meterLive = false;
  armEcho(ms: number): void {
    window.clearTimeout(this.echoTimer);
    this.echoTimer = 0;
    if (ms <= 0 || this.disposed) return;
    this.echoTimer = window.setTimeout(() => {
      this.echoTimer = 0;
      this.request();
    }, ms);
  }

  /** Desktop, la machine regardee, rien ne bouge : la vague viendra dans IDLE_MS. */
  idleTimer = 0;
  armIdle(now: number): void {
    window.clearTimeout(this.idleTimer);
    if (this.mobile || this.disposed) return;
    const left = this.activeAt + IDLE_MS - now;
    this.idleTimer = window.setTimeout(() => this.request(), Math.max(200, left));
  }

  /**
   * La barre de progression telle que dessinee (px de la texture du site,
   * OLED.tex : x0 a x1, y0 a y1), null quand elle n'est pas a l'ecran : le
   * Stage y lit un clic (seekAt).
   */
  bar: { x0: number; x1: number; y0: number; y1: number } | null = null;
  /**
   * Les six onglets de page du pied de la vue PAGE sont-ils a l'ecran
   * (desktop, rien d'autre au pied) ? Le Stage y pose leurs zones (une touche
   * de page chacun, 2026-10-08, revue de R1 : dessines, ils ne faisaient rien).
   */
  tabsShown = false;
  /**
   * Les zones du navigateur des sons dessine (2026-10-18) : l'en-tete (head),
   * PREV et NEXT, le corps de la liste (body, sous les lignes), chaque ligne
   * montree (row-<k>, k depuis la premiere montree) et le x d'un sample de ce
   * navigateur (del-<k>, desktop), sur le verre (u, v de 0 a 1) ; le Stage y
   * pose les zones lcd-sb-* (scene/renderer.ts), a la place de celles des blocs
   * (revue du 2026-10-09 : les zones des blocs restaient vivantes sous la liste
   * de trois lignes, une tape sur un nom tombait sur un bloc cache). [] : ferme.
   */
  browserRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /**
   * Les blocs dessines (2026-10-09) : leur rang et leur rectangle sur le verre
   * (u, v de 0 a 1), ceux qui se reglent (ni case vide ni dessin) ; le Stage y
   * pose les zones lcd-blk-<k> (l'ecran est l'editeur, au desktop aussi).
   */
  blockRects: { k: number; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** Le menu de la voix sous HOME (2026-10-18) : ses touches et leur rectangle, les zones lcd-menu-<id> ; [] ailleurs. */
  menuRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** MASTER et TEMPO a l'ecran (2026-10-19) : leurs rectangles, les zones lcd-master et lcd-tempo ; [] quand ils n'y sont pas. */
  dialRects: { id: string; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** au telephone, les zones de l'en-tete montent au-dessus du verre (HEAD_HIT_UP, 2026-10-22) */
  get headUp(): number {
    return this.mobile ? HEAD_HIT_UP : 0;
  }
  /** Les onglets de l'en-tete (VOICE : MAIN SYNTH ; FX : BD FX, GLOBAL) et leur rectangle : les zones lcd-tab-<ecran>. */
  tabSpots: { screen: RytmScreenId; u0: number; u1: number; v0: number; v1: number }[] = [];
  /** Les places fixes de l'en-tete de la vue PAGE par voix et mode arme (headPlan, 2026-10-22), mesurees une fois par police. */
  headPlans = new Map<string, HeadPlan>();

  /** Redessine ; rend dans combien de ms il faut une autre image (0 : aucune). */
  paint(s: LcdState, now: number): number {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const p = pattern.get();
    const ptn = patterns.get();
    const rytmEdit = editor.get() === 'mm808';
    // Ce que montre l'ecran : les presets, EDIT, sinon la vue du MM-RYTM (HOME, ou la page en coup d'oeil)
    const rp = rytmPage.get();
    // Le LOCK (2026-10-08) se montre toujours sur la vue PAGE (HOME n'a pas les blocs)
    const lockStep = rytmEdit ? -1 : rytmLock.get().step;
    // Le navigateur des sons (2026-10-18) : par-dessus HOME et la vue PAGE (EDIT et les presets le ferment)
    const sb = s.keys || rytmEdit ? null : soundBrowserView();
    const view: ScreenInfo['view'] = s.keys ? 'presets' : rytmEdit ? 'edit' : sb ? 'browser' : lockStep >= 0 ? 'page' : rp.view;
    const paged = view === 'page';
    let next = 0;
    if (ptn.cur !== this.lastCur) {
      this.lastCur = ptn.cur;
      this.blinkUntil = now + BLINK_MS;
    }
    this.stepHits(now);
    // La vague du repos (desktop, la machine regardee, rien ne joue ni ne s'affiche ; jamais sur la page)
    const quiet = !clock.running && sc.get().status !== 'playing' && !s.l3 && !s.mix && !sb && !s.keys;
    if (!paged && !this.mobile && quiet && focus.get() === 'mm808' && now - this.activeAt > IDLE_MS) {
      if (this.waveFrom === 0) this.waveFrom = now;
      if (now - this.waveFrom > WAVE_MS) {
        this.waveFrom = 0;
        this.activeAt = now;
      }
    } else this.waveFrom = 0;

    this.bar = null;
    this.tabsShown = false;
    this.browserRects = [];
    this.menuRects = [];
    this.dialRects = [];
    this.info.dials = '';
    this.info.dialSlot = '';
    this.info.headFit = '';
    this.info.pageDots = '';
    this.info.menu = [];
    this.info.browser = null;
    this.info.drop = '';
    this.info.view = view;
    this.info.presetList = '';
    this.info.presetHead = '';
    this.info.page = rp.page;
    this.info.blocks = [];
    this.info.echo = -1;
    this.info.lock = paged || sb ? lockStep : -1;
    this.info.flash = [];
    this.info.strip = '';
    this.info.foot = [];
    this.info.panel = [];
    this.info.footText = '';
    this.info.layers = '';
    this.info.infoBlock = -1;
    this.info.cells = [];
    this.info.graph = '';
    this.info.tags = [];
    this.info.xfade = '';
    this.xLive = false;
    if (!paged) {
      this.blockRects = [];
      this.tabSpots = [];
      this.info.head = '';
      this.info.popup = '';
    }
    // L'ecran haut du telephone (2026-10-09) : le dessin de 120 de HOME, EDIT et des presets, centre (la vue PAGE et le
    // navigateur des sons ont le leur, sur toute la hauteur)
    if (!paged && !sb && DY > 0) c.setTransform(this.scale, 0, 0, this.scale, 0, this.scale * DY);
    if (s.keys) this.paintPresets(s);
    else if (sb) this.paintBrowser(sb, rp, lockStep, now);
    else if (paged) this.armEcho(this.paintPage(s, rp, p.instrument, ptn.cur, now, lockStep));
    else {
      if (rytmEdit) this.paintPatternRing(now);
      else next = Math.max(next, this.paintStepRing(p.instrument, p.steps, now));
      // HOME (2026-10-19) : la lecture, le pattern, MASTER et TEMPO passent dans la bande du haut (paintHomeHead) ; EDIT garde sa ligne
      if (rytmEdit) this.paintHead(ptn.cur, now);
      if (s.mix) this.paintMix(s.mix);
      else if (rytmEdit) this.paintChain();
      else this.paintCards(p.instrument);
      this.paintLine(s, rytmEdit);
    }
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (view === 'home') {
      this.paintHomeHead(ptn.cur, now, s.preset);
      this.paintHomeMenu(p.instrument);
    }
    // Un fichier glisse au-dessus de la machine (2026-10-18) : DROP ON A PAD par-dessus tout, sauf les presets
    const drop = lcdSamples.get().drop;
    if (drop && !s.keys) this.paintDrop(drop);
    // La touche i (R4) : par-dessus tout, sur toutes les vues ; sur l'en-tete negatif du P-LOCK, en negatif aussi
    this.paintInfoKey(rytmInfos.isOn(), (paged || !!sb) && lockStep >= 0 && !drop);
    // La vue BANK (V.5.2, la revue de D3a, R11) : la banque affichee clignote, meme a l'arret
    if (this.blinkUntil > now || (rytmEdit && ptn.next >= 0) || (rytmEdit && DT_FACE && dtFace.bank() && ptn.bank !== bankOf(ptn.cur)) || this.waveFrom > 0) next = ANIM_MS;
    // Les coups qui pulsent : sur l'anneau seulement (la page n'en montre rien)
    if (!paged && this.hitAt.some((t) => now - t < PULSE_MS)) next = next || ANIM_MS;
    this.done(s, now);
    return next;
  }

  /** Les coups du pas qui joue : chaque voix qui sonne pulse. */
  stepHits(now: number): void {
    const st = clock.running ? playhead.get() : -1;
    if (st >= 0 && st !== this.lastStep) {
      const steps = pattern.get().steps;
      INSTRUMENTS.forEach((inst, i) => {
        if (velocity(steps, inst, st) > 0 && voices.plays(inst, pmutesNow())) this.hitAt[i] = now;
      });
    }
    this.lastStep = st;
  }

  /** L'en-tete de la colonne de droite : la lecture, le pattern (il clignote quand il change), le tempo. */
  paintHead(cur: number, now: number): void {
    const y = 17;
    const x = COL.x0;
    this.runIcon(x, y);
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    const nw = this.text(slotName(cur), x + 14, y, 12, blinkOff ? FAINT : INK, 600, 'left', 0.6);
    // La banque que montre la grille (V.5.2, au desktop) : BANK B a cote du pattern ; la vue BANK le dit en plein
    if (DT_FACE) {
      const word = `BANK ${bankName(patterns.shown())}`;
      const bx = x + 14 + nw + 6;
      const bw = this.textWidth(word, 7, 700, 0.8) + 8;
      if (dtFace.bank()) this.pill(bx, y - 8.5, bw, 10, INK);
      else this.roundRect(bx + 0.5, y - 8, bw - 1, 9, 2.5, null, INK, 0.9);
      this.text(word, bx + bw / 2, y - 1, 7, dtFace.bank() ? BLACK : INK, 700, 'center', 0.8);
      this.info.head = `${dtFace.bank() ? 'BANKS|' : ''}${word}|${slotName(cur)}`;
    }
    // Le tempo : le nombre, BPM a cote en petit (la ligne 1 du texte porte autre chose sur les pages MIX et SAMPLES) ;
    // il suit les platines (2026-10-27, le SYNC du MIXER) : au dixieme, SYNC a la place de BPM
    const bpm = tempoSync.text(pattern.get().bpm);
    // A gauche de la touche i (R4)
    const bw = this.text(tempoSync.unit(), PAGE_HEAD.right, y, 7, HALF, 600, 'right', 0.8);
    this.text(bpm, PAGE_HEAD.right - bw - 4, y, 12, INK, 400, 'right');
  }

  /*
   * Les images prennent leur zone (2026-10-08) : la carte de HOME (CARD_W de
   * large, 34 de haut) ou l'image d'un bloc de la vue PAGE (22 x 14). A la
   * taille d'une carte, tout reste comme avant (k = 1) ; plus petites, les
   * ecarts, les points et les traits se resserrent.
   */

  /** L'echelle d'une image par rapport a une carte de HOME (1 a sa taille, jamais plus). */
  static cardK(r: Rect): number {
    return Math.min(1, (r.x1 - r.x0) / CARD_W);
  }

  /** Les sept barres du vumetre de MASTER (2026-10-19) : leur largeur, l'air entre elles, la plus basse et la plus haute. */
  static readonly METER = { n: 7, bw: 2.2, gap: 1.2, h0: 3, h1: 11.5 } as const;

  /** Fin d'un redessin : la texture part, les compteurs suivent. */
  done(s: LcdState, now: number): void {
    this.texture.needsUpdate = true;
    const info = this.info;
    if (info.draws > 0) info.minGapMs = Math.min(info.minGapMs, now - info.lastDrawAt);
    info.draws += 1;
    info.lastDrawAt = now;
    info.text = [s.text[0], s.text[1], s.text[2]];
  }

  dispose(): void {
    this.disposed = true;
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
    window.clearTimeout(this.idleTimer);
    window.clearTimeout(this.echoTimer);
    disposeSheen(this.sheen);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
