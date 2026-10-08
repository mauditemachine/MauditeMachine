/**
 * L'ecran OLED en haut a gauche du panneau (spec 20.3.8) : un plan de
 * 3.6 x 1.35 pose sur son cadre, texture canvas (les proportions du verre).
 *
 * Refait le 2026-10-07 (Mika : "l'ecran du MM-RYTM, je le trouve brouillon,
 * il y a des infos que je ne veux pas voir, c'est trop vieille machine ; je
 * ne veux pas de couleurs dessus, mais j'aimerais un design a la Teenage
 * Engineering OP-1") : plus de police de pixels ni de lignes de texte, un
 * dessin vectoriel net, noir et os seulement (trois intensites : plein,
 * demi, a peine), de grandes formes, tres peu de mots. Mise en page en
 * unites de 320 x 120 :
 * - a gauche, l'anneau des seize pas (le motif de la voix choisie ; sans
 *   voix, le motif entier en demi-teinte) : un point par pas, plus gros
 *   avec la velocite, les temps 1 5 9 13 marques ; la tete de lecture, un
 *   cercle autour du pas qui joue et un trait vers lui ; un coup qui sonne
 *   pulse. Au centre, la voix en grand et son son (909, 808, MM, un
 *   sample), ou MUTE, SOLO ;
 * - a droite, en haut : la lecture (un triangle, un carre a l'arret), le
 *   pattern (il clignote quand il change), le tempo ;
 * - dessous, trois reglages dessines comme sur l'OP-1, chacun son image :
 *   la voix choisie (VOLUME en barres qui montent, TONE en courbe de
 *   filtre qui bascule, DECAY en enveloppe qui s'allonge), sans voix la
 *   machine (SWING en paires de points decalees, STRETCH, MASTER) ;
 * - tout en bas a droite : le message du moment (la valeur d'un potard, un
 *   pas pose), ou la piste qui joue et sa barre (cliquable, bar), sinon rien.
 * EDIT (state/patterns.ts) : l'anneau porte les seize patterns (le courant
 * plein, la chaine reliee, celui qui attend clignote), le pattern en grand
 * au centre. MIX : les volumes de la rangee en faders. SAMPLES : la liste
 * des sons, le courant en pastille. PRESETS : le nom en grand, ses touches.
 * Au repos (desktop, la machine regardee), de temps en temps, une vague
 * lente passe sur l'anneau. Le texte vient de state/lcd.ts (le jumeau le
 * lit) ; l'image se refait quand un store change, au plus tous les 60 ms,
 * et ne demande une frame qu'apres un redessin. Materiau non eclaire, sans
 * tone mapping.
 *
 * La vue PAGE (2026-10-08, la refonte facon Digitakt, Mika : "8 encodeurs
 * assignables a condition de presser les bonnes touches ; l'ecran divise en
 * 8 blocs" ; puis, le meme jour : "RYTM : je ne vois AUCUN changement de ce
 * que j'ai demande ! les valeurs de knobs sont a l'ecran, pas sur les
 * encodeurs, de 0 a 127 ; je veux des ecrans super evolues") : l'ecran PAR
 * DEFAUT, tout le temps (state/rytmPage.ts) ; l'ecran ci-dessus (HOME, au
 * pixel pres) revient par la touche de la page allumee ou H. Dans la meme
 * langue OP-1 :
 * - en haut, la lecture, la page en pastille (SRC), la voix et son son ; a
 *   droite le pattern et le tempo ; un filet dessous ;
 * - huit blocs en 2 x 4 (A B C D, E F G H), chacun exactement au-dessus du
 *   potard de page du meme nom (theme.ts pageKnobX) : un cadre a peine, son
 *   nom et la lettre du potard, sa valeur en grand de 0 a 127 (-64 a +63 a
 *   zero au centre, le nom du cran pour un choix : 909, BLUEPRINT, ON), la
 *   ligne d'unite dessous (216 MS, -3.2 DB, rytm/values.ts), sa petite image
 *   (barres, courbe, enveloppe, petit potard) qui bouge avec la valeur ; un
 *   reglage a venir a peine (--, SOON), celui qu'on vient de tourner cerne
 *   (l'echo), ALL ou NO BD pour ceux de toute la machine ;
 * - le pied : a gauche les seize pas de la voix et la tete de lecture (on
 *   voit le sequenceur passer), a droite le message (BD DECAY 64  640 MS),
 *   la piste (sa barre cliquable, OLED_BAR_PAGE), MUTE et SOLO, sinon les
 *   six pages, celle affichee en pastille.
 * La liste des sons (SAMPLES) y prend toute la largeur ; la page MIX reste a
 * HOME. Les coups qui pulsent et la vague du repos n'y redessinent rien ; la
 * tete de lecture, si (les seize pas du pied), au plus tous les 60 ms.
 *
 * Les verrous (2026-10-08, l'etape R2 des parameter locks, Mika : "on voit a
 * l'ecran que quand le sequenceur passe sur ce step alors le changement est
 * fait ; fait evoluer l'ecran, c'est la cle de ce que je demande") :
 * - en LOCK (un pas tenu, ou fixe, state/rytmLock.ts) : l'en-tete porte la
 *   pastille LOCK 05 (pleine, un petit cadenas) et la page en contour ; un
 *   bloc verrouille sur ce pas passe en negatif (plein, texte noir, le
 *   cadenas) avec sa valeur verrouillee ; un bloc verrouillable mais pas
 *   verrouille montre la valeur de la voix en retrait ; ceux de toute la
 *   machine (GLOBAL) et ceux pas encore verrouillables (NO LOCK), a peine ;
 *   le pied dit quoi faire (TURN A KNOB: STEP 05 ONLY, 2X: UNLOCK, CLEAR:
 *   ALL) ou les verrous du pas ;
 * - en lecture : quand le pas qui joue a des verrous, leurs blocs passent en
 *   negatif avec la valeur verrouillee jusqu'au coup suivant de la voix (au
 *   moins 280 ms depuis la revue de R2), puis reviennent ;
 * - le panneau des verrous (revue de R2) : en LOCK et quand le pas joue, tous
 *   ses verrous ecrits, toutes pages, dans la place que la page laisse vide ;
 *   au desktop un point sur l'onglet des pages qui en portent, au telephone
 *   leur liste au pied (et sinon, toujours, le geste : HOLD A STEP + TURN A
 *   KNOB) ;
 * - les seize pas du pied : un trait court sous chaque pas qui a des verrous,
 *   le pas en LOCK cerne ; l'anneau de HOME, un trait dehors.
 * Les dessins des blocs passent par une palette (pal) : la normale, ou la
 * negative d'un bloc plein ; HOME garde la normale, au pixel pres.
 *
 * La touche i (2026-10-08, l'etape R4, Mika : "je veux un petit bouton i dans
 * l'ecran a activer et de ce fait on peut voir les infos au survol.. et je
 * veux la meme chose pour RYTM aussi !") : un i cercle dans le coin en haut a
 * droite, sur toutes les vues (PAGE, HOME, EDIT, les presets), plein quand
 * INFOS est allume (state/rytmInfos.ts) ; le pattern et le tempo se rangent a
 * sa gauche. Sa zone de saisie (lcd-i, scene/renderer.ts) est posee sur
 * INFO_KEY. INFOS allume, le bloc de l'encodeur dont la carte est montree
 * porte quatre coins (la carte et l'ecran parlent du meme bloc).
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { clock } from '../audio/clock';
import { mix } from '../audio/drums';
import { KIT_MODEL_LABEL, familyOf, kit, type KitFamily, type Plays } from '../audio/kit';
import { sampleByKey } from '../audio/samples';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../audio/pattern';
import { lockMask, lockOf, type StepLock } from '../audio/locks';
import { lockList, lockPages, lockSummary, stepPlays, type LockLine } from '../actions';
import { rytmLock } from '../state/rytmLock';
import type { ShotId } from '../audio/shotsdsp';
import { sc } from '../audio/soundcloud';
import { voiceFx } from '../audio/voicefx';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { lcd, type LcdState } from '../state/lcd';
import { PATTERN_SLOTS, patterns, slotName } from '../state/patterns';
import { playhead } from '../state/playhead';
import { rytmInfos } from '../state/rytmInfos';
import { rytmPage, type RytmPageState, type RytmView } from '../state/rytmPage';
import { voices } from '../state/voices';
import { FONT_DISPLAY, HEX, OLED, PAGE_KNOB_LETTERS, type Inst } from '../theme';
import { RYTM_PAGES, pageLabel, type RytmPageId } from '../rytm/pages';
import { pageBlocks, type Block, type BlockMode } from '../rytm/pageView';
import { v127Text } from '../rytm/values';
import { makeCanvasTexture } from './silk';

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
  /** ce que montre l'ecran (2026-10-08) : HOME, la vue PAGE, EDIT, les presets */
  view: RytmView | 'edit' | 'presets';
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
}

/** Au plus un redessin tous les 60 ms (un potard tourne a la cadence du pointeur). */
const MIN_GAP_MS = 60;
/** Les animations courtes : une image tous les 50 ms. */
const ANIM_MS = 50;
const BLINK_MS = 600;
/** Un coup qui sonne : il pulse PULSE_MS. */
const PULSE_MS = 260;
/** La vague du repos : apres IDLE_MS sans rien, WAVE_MS de vague (desktop). */
const IDLE_MS = 15000;
const WAVE_MS = 7000;

/** La mise en page, en unites. */
const UW = 320;
const UH = 120;

/**
 * La touche i (R4, 2026-10-08), en unites : son centre, dans le coin en haut
 * a droite, et son rayon dessine ; hit : le rayon de sa zone de saisie (au
 * telephone 26 unites, 45 px CSS a 390 x 844 : le contrat veut 44 ; elle mord
 * le tempo de l'en-tete, qui ouvre les presets, rien d'autre : les blocs ne
 * se touchent pas, ce sont les encodeurs). scene/renderer.ts pose la zone
 * lcd-i avec.
 */
export const INFO_KEY = { x: UW - 8, y: 10.5, r: { desk: 5.2, phone: 6.6 }, hit: { desk: 8, phone: 26 } } as const;

/**
 * Le bloc k de la vue PAGE sur le verre (u, v de 0 a 1) : INFOS allume, sa
 * zone (lcd-blk-<k>, scene/renderer.ts) montre la carte de son encodeur au
 * survol ou au toucher (R4 : on regarde l'ecran, pas le potard).
 */
export function blockSpot(k: number): { u0: number; u1: number; v0: number; v1: number } {
  const x = MATRIX.x0 + MATRIX.pitch * (k % 4);
  const y = MATRIX.rows[k >> 2];
  return { u0: x / UW, u1: (x + MATRIX.w) / UW, v0: y / UH, v1: (y + MATRIX.h) / UH };
}

/** La zone de la touche i sur le verre : son centre (u, v de 0 a 1) et son rayon en part de la largeur de l'ecran. */
export const infoKeySpot = (mobile: boolean): { u: number; v: number; r: number } => ({
  u: INFO_KEY.x / UW,
  v: INFO_KEY.y / UH,
  r: (mobile ? INFO_KEY.hit.phone : INFO_KEY.hit.desk) / UW,
});
/** Les coordonnees de texture du reste du site (theme OLED.tex, 640 x 240) : deux par unite. */
const TEX_K = OLED.tex[0] / UW;

/** L'os, et ses deux intensites eteintes (sur le noir de l'OLED). */
const INK: string = HEX.bone;
const HALF: string = 'rgba(246, 241, 231, 0.5)';
const FAINT: string = 'rgba(246, 241, 231, 0.2)';
const BLACK: string = HEX.oled;
/** Le cadre d'un bloc de la vue PAGE : a peine (un reglage a venir, encore moins). */
const FRAME: string = 'rgba(246, 241, 231, 0.14)';
const FRAME_DIM: string = 'rgba(246, 241, 231, 0.07)';

/**
 * La palette des dessins (2026-10-08) : la normale (l'os sur le noir), ou la
 * negative d'un bloc verrouille (le noir sur l'os plein) ; bg : le fond.
 */
interface Pal {
  ink: string;
  half: string;
  faint: string;
  bg: string;
}
const PAL: Pal = { ink: INK, half: HALF, faint: FAINT, bg: BLACK };
const PAL_NEG: Pal = { ink: BLACK, half: 'rgba(0, 0, 0, 0.58)', faint: 'rgba(0, 0, 0, 0.24)', bg: INK };

/** L'anneau des pas : son centre, son rayon ; la colonne de droite. */
const RING = { cx: 60, cy: 60, r: 47 } as const;
const COL = { x0: 124, x1: 314 } as const;
/** Les trois reglages : la zone de leur image, leur nom, leur valeur. */
const CARD = { y0: 30, y1: 64, label: 74, value: 90, gap: 8 } as const;
/** La ligne du bas (message, piste). */
const LINE = { y: 110 } as const;
/** La largeur d'une carte de HOME ((190 - 2 x 8) / 3) : les images des blocs, plus petites, s'y rapportent. */
const CARD_W = 58;

/** Une zone de dessin, en unites. */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Une colonne de texte (x0 a x1). */
interface Col {
  x0: number;
  x1: number;
}

/*
 * La vue PAGE (2026-10-08) : huit blocs de 72 x 37 en 2 x 4, les centres des
 * colonnes (44, 120, 196, 272) au-dessus des potards de page ; dans un bloc
 * le nom et la lettre du potard en haut, la valeur en grand (16, puis 13, 11
 * et 9 pour tenir), la ligne d'unite dessous, l'image a droite de la
 * valeur, l'etiquette ALL ou NO BD au bout de la ligne d'unite.
 */
const MATRIX = { x0: 8, pitch: 76, w: 72, h: 37, rows: [24, 63], r: 3.5 } as const;
const BLOCK = {
  padX: 5,
  /** la largeur de la valeur avant l'image */
  valueW: 34,
  draw: { dx0: 42, dx1: 67, dy0: 13, dy1: 29 },
} as const;
/**
 * Les corps de la vue PAGE (2026-10-08, revue de R1, Mika : "plus gros, plus
 * de detail ; super responsive en mobile") : l'ecran fait 465 px de large au
 * desktop (1.45 px l'unite) et 280 px au telephone (0.88 px l'unite) ; au
 * telephone le nom a 10 et l'unite a 8.6 (7.5 a 8.5 px a l'ecran ; 6.5 et
 * 5.5 n'y faisaient pas 5 px), la valeur a 17 ; ni lettre de potard dans le bloc
 * (elle est imprimee a cote du potard), ni crans au bout de l'unite, ni les
 * six onglets du pied (la touche allumee et la pastille de l'en-tete disent
 * la page) : la place va au texte.
 */
const BLOCK_TYPE = {
  desk: {
    nameSize: 7,
    letterSize: 5.5,
    unitSize: 6,
    valueSizes: [17, 14, 12, 10],
    nameDy: 9.5,
    valueDy: 27.5,
    unitDy: 34.6,
    letters: true,
    notchRow: true,
    tabs: true,
    tabSize: 6.5,
    foot: 8,
    head: { pill: 7.5, pillH: 12, voice: 12, sound: 7.5, bpm: 6.5, num: 12 },
    selR: 0.9,
  },
  phone: {
    nameSize: 10,
    letterSize: 0,
    unitSize: 8.6,
    valueSizes: [17, 14.5, 12, 10],
    nameDy: 10.2,
    // L'unite plus haut (revue de R2 : CENTER, -8.2 DB touchaient le bord du bloc)
    valueDy: 25.9,
    unitDy: 33.5,
    letters: false,
    notchRow: false,
    tabs: false,
    tabSize: 0,
    foot: 9.5,
    head: { pill: 9, pillH: 13.5, voice: 13, sound: 9, bpm: 8, num: 13 },
    selR: 1.3,
  },
} as const;
/** right : le bord droit du pattern et du tempo, a gauche de la touche i (R4 ; 312 avant) ; gap : l'air entre le son, le pattern et le tempo (R4 : 8 et 10 avant, la place rendue au son). */
const PAGE_HEAD = { y: 15.5, iconX: 10, pillX: 23, pillY: 4.5, right: 301, rule: 21.5, gap: 7 } as const;
/** Les seize pas du pied (a gauche) et le reste du pied (a droite). */
const PAGE_STRIP = { x0: 10, y: 105.5, size: 5.5, pitch: 7 } as const;
const PAGE_FOOT = { x0: 132, x1: 312, y: 112.5 } as const;
/**
 * Le flash d'un pas verrouille qui joue (revue de R2 : un seizieme, 115 ms a
 * 130 BPM, ne se lisait pas) : il tient jusqu'au coup suivant de la voix, au
 * moins min, au plus max (ms).
 */
const FLASH = { min: 280, max: 900 } as const;
/** Le pied du LOCK au telephone : ses deux aides alternent (ms). */
const TIP_MS = 2400;
/** La liste des sons (SAMPLES) sur toute la largeur. */
const PAGE_COL: Col = { x0: 10, x1: 310 };

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Coupe a n lettres, un point final quand ca deborde. */
const fit = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}.`);

/** Le son d'une voix : 909, 808, MM ou son sample. */
function soundOf(inst: Inst): string {
  const f = familyOf(inst as ShotId);
  return f ? kit.valueText(f) : 'MM';
}

/** La police : FONT_DISPLAY, en unites (le contexte est a l'echelle). */
const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;

export class Screen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timer = 0;
  private unsubs: (() => void)[] = [];
  /** les coups qui sonnent : l'instant du dernier, par voix */
  private hitAt = new Float64Array(INSTRUMENTS.length);
  private lastStep = -1;
  private blinkUntil = 0;
  private waveFrom = 0;
  private lastCur = -1;
  private activeAt = performance.now();
  private scale: number;
  /** les corps des blocs de la vue PAGE (le telephone : plus gros) */
  private bt: (typeof BLOCK_TYPE)[keyof typeof BLOCK_TYPE];
  /** la palette des dessins (la negative dans un bloc verrouille) */
  private pal: Pal = PAL;
  /** le flash du pas verrouille qui joue (revue de R2) : sa voix, son pas, ses verrous, depuis, jusqu'a */
  private flash: { inst: Inst; step: number; lock: Readonly<StepLock>; from: number; end: number } | null = null;
  /** la tete de lecture vue au dernier dessin (un nouveau pas : un nouveau coup) */
  private flashHead = -1;

  constructor(
    anisotropy: number,
    /** demande une frame apres un redessin */
    private invalidate: () => void,
    /** telephone : pas de vague au repos (aucune image pour rien) */
    private mobile = false
  ) {
    const W = mobile ? 1024 : 1280;
    const H = Math.round((W * UH) / UW);
    this.scale = W / UW;
    this.bt = mobile ? BLOCK_TYPE.phone : BLOCK_TYPE.desk;
    this.info = { draws: 0, text: ['', '', ''], lastDrawAt: -Infinity, minGapMs: Infinity, font: 'vector op-1', size: [W, H], view: 'home', page: rytmPage.get().page, blocks: [], echo: -1, lock: -1, flash: [], strip: '', foot: [], panel: [], footText: '', layers: '', infos: false, infoBlock: -1 };
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
      patterns.subscribe(active),
      editor.subscribe(active),
      voices.subscribe(active),
      voiceFx.subscribe(active),
      mix.subscribe(active),
      clock.subscribe(active),
      // La vue PAGE (2026-10-08) : sa page, ses valeurs (le kit, les effets du pattern) ; la tete de lecture
      // ne redessine que l'ecran d'aujourd'hui (HOME, EDIT), la page ne la montre pas
      rytmPage.subscribe(active),
      // Le LOCK (2026-10-08) : la pastille, les blocs en negatif, le pied
      rytmLock.subscribe(active),
      // INFOS (R4) : la touche i pleine, le bloc de la carte montree
      rytmInfos.subscribe(() => this.request()),
      kit.subscribe(() => active()),
      pattern.fx.subscribe(active),
      // La tete de lecture : l'anneau de HOME, les seize pas du pied de la vue PAGE
      playhead.subscribe(() => this.request()),
      focus.subscribe(() => this.request()),
    ];
    // La police arrivee apres la premiere image : on redessine
    void document.fonts?.ready.then(() => this.request());
    this.request();
  }

  /** Un redessin bientot (au plus tous les MIN_GAP_MS). */
  private request(delay = 0): void {
    if (this.timer !== 0) return;
    // Arrondi au-dessus : setTimeout tronque les fractions, l'ecart tombait a 59,5 ms au lieu de 60
    const wait = Math.ceil(Math.max(delay, this.info.lastDrawAt + MIN_GAP_MS - performance.now(), 0));
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
  private echoTimer = 0;
  private armEcho(ms: number): void {
    window.clearTimeout(this.echoTimer);
    this.echoTimer = 0;
    if (ms <= 0) return;
    this.echoTimer = window.setTimeout(() => {
      this.echoTimer = 0;
      this.request();
    }, ms);
  }

  /** Desktop, la machine regardee, rien ne bouge : la vague viendra dans IDLE_MS. */
  private idleTimer = 0;
  private armIdle(now: number): void {
    window.clearTimeout(this.idleTimer);
    if (this.mobile) return;
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

  /* ---------------- le dessin ---------------- */

  /** Un texte (unites) ; rend sa largeur. spacing : l'air entre les lettres (unites). */
  private text(s: string, x: number, y: number, size: number, color = INK, weight = 500, align: 'left' | 'right' | 'center' = 'left', spacing = 0): number {
    const c = this.ctx;
    c.font = font(weight, size);
    c.fillStyle = color;
    c.textBaseline = 'alphabetic';
    if (spacing <= 0) {
      const w = c.measureText(s).width;
      const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
      c.textAlign = 'left';
      c.fillText(s, x0, y);
      return w;
    }
    const widths = [...s].map((ch) => c.measureText(ch).width);
    const w = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, s.length - 1);
    let cx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    c.textAlign = 'left';
    [...s].forEach((ch, i) => {
      c.fillText(ch, cx, y);
      cx += widths[i] + spacing;
    });
    return w;
  }

  private textWidth(s: string, size: number, weight = 500, spacing = 0): number {
    this.ctx.font = font(weight, size);
    return this.ctx.measureText(s).width + spacing * Math.max(0, s.length - 1);
  }

  private circle(x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  private pill(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
    const c = this.ctx;
    const r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x + r, y + h);
    c.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  /** Un rectangle aux coins arrondis (le contour du bloc tourne). */
  private roundRect(x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null = null, lw = 1): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  private line(pts: readonly number[], color: string, lw = 1.4): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  /** La place du pas i sur l'anneau (le 1 en haut, dans le sens des aiguilles). */
  private ringAt(i: number, r: number = RING.r): { x: number; y: number; a: number } {
    const a = -Math.PI / 2 + (i / STEP_COUNT) * Math.PI * 2;
    return { x: RING.cx + Math.cos(a) * r, y: RING.cy + Math.sin(a) * r, a };
  }

  /** Redessine ; rend dans combien de ms il faut une autre image (0 : aucune). */
  private paint(s: LcdState, now: number): number {
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
    const view: ScreenInfo['view'] = s.keys ? 'presets' : rytmEdit ? 'edit' : lockStep >= 0 ? 'page' : rp.view;
    const paged = view === 'page';
    let next = 0;
    if (ptn.cur !== this.lastCur) {
      this.lastCur = ptn.cur;
      this.blinkUntil = now + BLINK_MS;
    }
    this.stepHits(now);
    // La vague du repos (desktop, la machine regardee, rien ne joue ni ne s'affiche ; jamais sur la page)
    const quiet = !clock.running && sc.get().status !== 'playing' && !s.l3 && !s.mix && !s.samples && !s.keys;
    if (!paged && !this.mobile && quiet && focus.get() === 'mm808' && now - this.activeAt > IDLE_MS) {
      if (this.waveFrom === 0) this.waveFrom = now;
      if (now - this.waveFrom > WAVE_MS) {
        this.waveFrom = 0;
        this.activeAt = now;
      }
    } else this.waveFrom = 0;

    this.bar = null;
    this.tabsShown = false;
    this.info.view = view;
    this.info.page = rp.page;
    this.info.blocks = [];
    this.info.echo = -1;
    this.info.lock = paged ? lockStep : -1;
    this.info.flash = [];
    this.info.strip = '';
    this.info.foot = [];
    this.info.panel = [];
    this.info.footText = '';
    this.info.layers = '';
    this.info.infoBlock = -1;
    if (s.keys) this.paintPresets(s);
    else if (paged) this.armEcho(this.paintPage(s, rp, p.instrument, ptn.cur, now, lockStep));
    else {
      if (rytmEdit) this.paintPatternRing(now);
      else next = Math.max(next, this.paintStepRing(p.instrument, p.steps, now));
      this.paintHead(ptn.cur, now);
      if (s.mix) this.paintMix(s.mix);
      else if (s.samples) this.paintSamples(s.samples);
      else if (rytmEdit) this.paintChain();
      else this.paintCards(p.instrument);
      this.paintLine(s, rytmEdit);
    }
    // La touche i (R4) : par-dessus tout, sur toutes les vues
    this.paintInfoKey(rytmInfos.isOn());
    if (this.blinkUntil > now || (rytmEdit && ptn.next >= 0) || this.waveFrom > 0) next = ANIM_MS;
    // Les coups qui pulsent : sur l'anneau seulement (la page n'en montre rien)
    if (!paged && this.hitAt.some((t) => now - t < PULSE_MS)) next = next || ANIM_MS;
    this.done(s, now);
    return next;
  }

  /** Les coups du pas qui joue : chaque voix qui sonne pulse. */
  private stepHits(now: number): void {
    const st = clock.running ? playhead.get() : -1;
    if (st >= 0 && st !== this.lastStep) {
      const steps = pattern.get().steps;
      INSTRUMENTS.forEach((inst, i) => {
        if (velocity(steps, inst, st) > 0 && voices.plays(inst)) this.hitAt[i] = now;
      });
    }
    this.lastStep = st;
  }

  /** L'en-tete de la colonne de droite : la lecture, le pattern (il clignote quand il change), le tempo. */
  private paintHead(cur: number, now: number): void {
    const y = 17;
    const x = COL.x0;
    this.runIcon(x, y);
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    this.text(slotName(cur), x + 14, y, 12, blinkOff ? FAINT : INK, 600, 'left', 0.6);
    // Le tempo : le nombre, BPM a cote en petit (la ligne 1 du texte porte autre chose sur les pages MIX et SAMPLES)
    const bpm = String(Math.round(pattern.get().bpm));
    // A gauche de la touche i (R4)
    const bw = this.text('BPM', PAGE_HEAD.right, y, 7, HALF, 600, 'right', 0.8);
    this.text(bpm, PAGE_HEAD.right - bw - 4, y, 12, INK, 400, 'right');
  }

  /** La lecture : un triangle ; a l'arret, un carre (x : son bord gauche, y : la ligne de base). */
  private runIcon(x: number, y: number): void {
    const c = this.ctx;
    c.fillStyle = INK;
    if (clock.running) {
      c.beginPath();
      c.moveTo(x, y - 9);
      c.lineTo(x + 8, y - 4.5);
      c.lineTo(x, y);
      c.closePath();
      c.fill();
    } else c.fillRect(x, y - 8.5, 8, 8);
  }

  /** L'anneau des pas de la voix choisie (sans voix : le motif entier en demi-teinte) ; la voix au centre. */
  private paintStepRing(inst: Inst | null, steps: Record<Inst, string>, now: number): number {
    const head = clock.running ? playhead.get() : -1;
    const wave = this.waveFrom > 0 ? (now - this.waveFrom) / 1000 : -1;
    const k = inst ? INSTRUMENTS.indexOf(inst) : -1;
    const pulse = k >= 0 ? Math.max(0, 1 - (now - this.hitAt[k]) / PULSE_MS) : 0;
    // Le cercle du fond, a peine
    this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
    for (let i = 0; i < STEP_COUNT; i += 1) {
      let r = RING.r;
      if (wave >= 0) {
        const env = Math.min(1, wave / 1.2, (WAVE_MS / 1000 - wave) / 1.2);
        r += env * 2.4 * Math.sin(wave * 3.4 - i * 0.55);
      }
      const at = this.ringAt(i, r);
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      if (bars > 0) {
        const rr = [0, 2.6, 3.6, 4.7][bars];
        const on = i === head && pulse > 0 ? rr + 2.2 * pulse : rr;
        this.circle(at.x, at.y, on, inst ? INK : HALF);
      } else this.circle(at.x, at.y, i % 4 === 0 ? 1.5 : 1, i % 4 === 0 ? HALF : FAINT);
      // Un pas qui a des verrous (2026-10-08) : un petit trait dehors
      if (inst && (lockMask(pattern.get().locks, inst) >> i) & 1) {
        // Plus long et plus epais (revue de R2 : 2 a 3 px), un point au bout
        const o0 = this.ringAt(i, r + 5.5);
        const o1 = this.ringAt(i, r + 10.5);
        this.line([o0.x, o0.y, o1.x, o1.y], bars > 0 ? INK : HALF, 1.8);
        this.circle(o1.x, o1.y, 1.3, bars > 0 ? INK : HALF);
      }
      if (i === head) {
        // La tete : un cercle autour du pas, un trait vers le centre
        this.circle(at.x, at.y, 7.2, null, INK, 1.2);
        const a0 = this.ringAt(i, RING.r - 12);
        const a1 = this.ringAt(i, RING.r - 18);
        this.line([a0.x, a0.y, a1.x, a1.y], INK, 1.6);
      }
    }
    // Le centre : la voix en grand, son son (ou MUTE, SOLO) ; sans voix, le pattern
    if (inst) {
      this.text(inst, RING.cx, RING.cy + 7, inst.length > 2 ? 21 : 25, INK, 300, 'center');
      const solo = voices.isSolo(inst);
      const muted = !voices.plays(inst);
      if (solo || muted) {
        const word = solo ? 'SOLO' : 'MUTE';
        const w = this.textWidth(word, 7, 700, 0.8) + 8;
        this.pill(RING.cx - w / 2, RING.cy + 13, w, 10, INK);
        this.text(word, RING.cx, RING.cy + 20.5, 7, BLACK, 700, 'center', 0.8);
      } else this.text(fit(soundOf(inst), 10), RING.cx, RING.cy + 21, 8, HALF, 600, 'center', 0.6);
    } else {
      this.text('ALL', RING.cx, RING.cy + 6, 18, HALF, 300, 'center', 1);
      this.text('PICK A VOICE', RING.cx, RING.cy + 19, 6, FAINT, 600, 'center', 0.5);
    }
    return 0;
  }

  /** Sans voix choisie : le plus fort des coups du pas. */
  private maxVel(steps: Record<Inst, string>, i: number): number {
    let best = 0;
    for (const k of INSTRUMENTS) best = Math.max(best, velocity(steps, k, i));
    return best;
  }

  /** EDIT : l'anneau des seize patterns (le courant plein, la chaine reliee, celui qui attend clignote). */
  private paintPatternRing(now: number): void {
    const p = patterns.get();
    const blinkOn = Math.floor(now / 160) % 2 === 0;
    this.circle(RING.cx, RING.cy, RING.r, null, FAINT, 0.8);
    // La chaine : un arc d'un pattern au suivant
    if (p.chain.length > 1) {
      const c = this.ctx;
      c.strokeStyle = HALF;
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      for (let k = 0; k + 1 < p.chain.length; k += 1) {
        const a = this.ringAt(p.chain[k]);
        const b = this.ringAt(p.chain[k + 1]);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.quadraticCurveTo(RING.cx, RING.cy, b.x, b.y);
        c.stroke();
      }
    }
    for (let i = 0; i < PATTERN_SLOTS; i += 1) {
      const at = this.ringAt(i);
      const inChain = p.chain.length > 1 && p.chain.includes(i);
      if (i === p.cur) {
        this.circle(at.x, at.y, 5.4, INK);
        if (inChain && p.chain[p.pos] === i) this.circle(at.x, at.y, 8.2, null, INK, 1);
      } else if (i === p.next) this.circle(at.x, at.y, 4.6, blinkOn ? INK : null, INK, 1.2);
      else if (patterns.filled(i)) this.circle(at.x, at.y, 3.6, inChain ? INK : HALF);
      else this.circle(at.x, at.y, 1.4, FAINT);
      // Le numero, dehors, sur les temps (1 5 9 13)
      if (i % 4 === 0) {
        const o = this.ringAt(i, RING.r - 11);
        this.text(String(i + 1), o.x, o.y + 2.6, 7, HALF, 600, 'center');
      }
    }
    this.text(slotName(p.cur), RING.cx, RING.cy + 6, 19, INK, 300, 'center', 0.5);
    const w = this.textWidth('EDIT', 7, 700, 0.8) + 8;
    this.pill(RING.cx - w / 2, RING.cy + 12, w, 10, INK);
    this.text('EDIT', RING.cx, RING.cy + 19.5, 7, BLACK, 700, 'center', 0.8);
  }

  /** EDIT, la colonne de droite : la chaine en grand, ce qui attend, l'aide. */
  private paintChain(): void {
    const p = patterns.get();
    const x = COL.x0;
    this.text('CHAIN', x, 42, 8, HALF, 700, 'left', 1);
    const chain = p.chain.length > 1 ? p.chain.map((k) => slotName(k)).join('  ') : slotName(p.cur);
    this.text(fit(chain, 22), x, 62, 13, INK, 400);
    if (p.next >= 0) this.text(`NEXT ${slotName(p.next)}`, x, 82, 9, INK, 600, 'left', 0.8);
  }

  /* ---------------- les trois reglages, facon OP-1 ---------------- */

  /** Les trois reglages de la voix (VOLUME, TONE, DECAY) ou de la machine (SWING, STRETCH, MASTER). */
  private paintCards(inst: Inst | null): void {
    // Les valeurs de 0 a 127 depuis le 2026-10-08 (Mika : "de 0 a 127"), celles des blocs de la vue PAGE et du MIDI
    const fx = inst ? voiceFx.of(inst) : null;
    const cards: { label: string; text: string; draw: (r: Rect) => void }[] = fx
      ? [
          { label: 'VOLUME', text: v127Text(fx.level), draw: (r) => this.drawLevel(r, fx.level) },
          { label: 'TONE', text: v127Text((fx.tone + 1) / 2, true), draw: (r) => this.drawTone(r, fx.tone) },
          { label: 'DECAY', text: v127Text(fx.decay), draw: (r) => this.drawDecay(r, fx.decay) },
        ]
      : [
          { label: 'SWING', text: v127Text(mix.swing), draw: (r) => this.drawSwing(r, mix.swing) },
          { label: 'STRETCH', text: v127Text((mix.stretch + 1) / 2, true), draw: (r) => this.drawStretch(r, mix.stretch) },
          { label: 'MASTER', text: v127Text(mix.level), draw: (r) => this.drawLevel(r, mix.level) },
        ];
    const w = (COL.x1 - COL.x0 - CARD.gap * (cards.length - 1)) / cards.length;
    cards.forEach((card, i) => {
      const x0 = COL.x0 + i * (w + CARD.gap);
      card.draw({ x0, y0: CARD.y0, x1: x0 + w, y1: CARD.y1 });
      this.text(card.label, x0, CARD.label, 7, HALF, 700, 'left', 0.9);
      this.text(card.text, x0, CARD.value, 13, INK, 400);
    });
  }

  /*
   * Les images prennent leur zone (2026-10-08) : la carte de HOME (CARD_W de
   * large, 34 de haut) ou l'image d'un bloc de la vue PAGE (22 x 14). A la
   * taille d'une carte, tout reste comme avant (k = 1) ; plus petites, les
   * ecarts, les points et les traits se resserrent.
   */

  /** L'echelle d'une image par rapport a une carte de HOME (1 a sa taille, jamais plus). */
  private static cardK(r: Rect): number {
    return Math.min(1, (r.x1 - r.x0) / CARD_W);
  }

  /** VOLUME, MASTER : des barres qui montent, allumees jusqu'a la valeur. */
  private drawLevel(r: Rect, v: number): void {
    const n = 7;
    const gap = 2.4 * Screen.cardK(r);
    const bw = (r.x1 - r.x0 - gap * (n - 1)) / n;
    const lit = Math.max(0, Math.min(1, v)) * n;
    const base = Math.min(6, 0.3 * (r.y1 - r.y0));
    for (let k = 0; k < n; k += 1) {
      const h = base + ((r.y1 - r.y0 - base) * (k + 1)) / n;
      const x = r.x0 + k * (bw + gap);
      const on = k + 1 <= lit + 1e-6 ? this.pal.ink : k < lit ? this.pal.half : this.pal.faint;
      this.ctx.fillStyle = on;
      this.ctx.fillRect(x, r.y1 - h, bw, h);
    }
  }

  /** TONE, STRETCH : une courbe de filtre qui bascule (a gauche plus sombre, a droite plus brillant). */
  private drawTone(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 2;
    const pts: number[] = [];
    const n = 28;
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const s = 1 / (1 + Math.exp(-(t - 0.5) * 9));
      pts.push(x0 + (x1 - x0) * t, mid - v * amp * (2 * s - 1));
    }
    this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** DECAY : une enveloppe, l'attaque puis la queue, plus longue avec la valeur. */
  private drawDecay(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const base = r.y1;
    const top = r.y0 + 2;
    const ax = x0 + 3 * Math.max(0.5, Screen.cardK(r));
    const tau = 0.08 + 0.6 * Math.max(0, Math.min(1, v));
    const pts: number[] = [x0, base, ax, top];
    const n = 30;
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      pts.push(ax + (x1 - ax) * t, base - (base - top) * Math.exp(-t / tau));
    }
    this.line([x0, base, x1, base], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** SWING : quatre paires de points, la seconde de chaque paire decalee par le swing. */
  private drawSwing(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const n = 4;
    const cell = (x1 - x0) / n;
    const y = (r.y0 + r.y1) / 2;
    const ks = Screen.cardK(r);
    this.line([x0, y, x1, y], this.pal.faint, 0.8);
    for (let k = 0; k < n; k += 1) {
      const xa = x0 + k * cell + cell * 0.18;
      const xb = x0 + k * cell + cell * (0.5 + 0.32 * Math.max(0, Math.min(1, v)));
      this.circle(xa, y, 3.4 * ks, this.pal.ink);
      this.circle(xb, y, 2.6 * ks, this.pal.half);
    }
  }

  /** STRETCH : une onde dont la longueur s'etire ou se resserre. */
  private drawStretch(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 3;
    const cycles = 3 * Math.pow(2, -Math.max(-1, Math.min(1, v)));
    const pts: number[] = [];
    const n = 48;
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      pts.push(x0 + (x1 - x0) * t, mid - amp * Math.sin(t * cycles * Math.PI * 2) * Math.exp(-t * 1.6));
    }
    this.line([x0, mid, x1, mid], this.pal.faint, 0.8);
    this.line(pts, this.pal.ink, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** Des crans (SOUND, GATE) : un point par cran, le choisi en grand ; plus de 12 : une barre. */
  private drawNotch(r: Rect, n: number, course: number): void {
    if (n < 2 || n > 12) {
      this.drawBar(r, course, false);
      return;
    }
    const y = (r.y0 + r.y1) / 2;
    const cur = Math.round(clamp01(course) * (n - 1));
    const step = (r.x1 - r.x0) / (n - 1);
    for (let i = 0; i < n; i += 1) {
      const x = r.x0 + i * step;
      if (i === cur) this.circle(x, y, n > 6 ? 1.7 : 2.3, this.pal.ink);
      else this.circle(x, y, 0.8, this.pal.half);
    }
  }

  /** Une barre : le trait a peine, la valeur pleine et son point ; centre : depuis le milieu (son repere). */
  private drawBar(r: Rect, course: number, centre: boolean): void {
    const y = (r.y0 + r.y1) / 2;
    const x = r.x0 + (r.x1 - r.x0) * clamp01(course);
    const from = centre ? (r.x0 + r.x1) / 2 : r.x0;
    this.line([r.x0, y, r.x1, y], this.pal.faint, 1.4);
    if (centre) this.line([from, y - 2.4, from, y + 2.4], this.pal.half, 0.8);
    this.line([from, y, x, y], this.pal.ink, 1.8);
    this.circle(x, y, 2, this.pal.ink);
  }

  /**
   * START (2026-10-08) : une onde qui s'eteint, le repere du debut ; ce qui
   * est avant lui (saute) a peine.
   */
  private drawStart(r: Rect, course: number): void {
    const { x0, x1 } = r;
    const mid = (r.y0 + r.y1) / 2;
    const amp = (r.y1 - r.y0) / 2 - 1;
    const cut = x0 + (x1 - x0) * clamp01(course) * 0.9;
    const n = 40;
    const before: number[] = [];
    const after: number[] = [];
    for (let k = 0; k <= n; k += 1) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = mid - amp * Math.sin(t * 5.5 * Math.PI * 2) * Math.exp(-t * 2.6);
      if (x <= cut) before.push(x, y);
      if (x >= cut - (x1 - x0) / n) after.push(x, y);
    }
    if (before.length >= 4) this.line(before, this.pal.faint, 1.2);
    if (after.length >= 4) this.line(after, this.pal.ink, 1.4 * Math.max(0.7, Screen.cardK(r)));
    this.line([cut, r.y0, cut, r.y1], this.pal.ink, 1.2);
  }

  /* ---------------- les pages ---------------- */

  /** Page MIX : les volumes de la rangee en faders (la voix reglee pleine). */
  private paintMix(m: NonNullable<LcdState['mix']>): void {
    const n = m.insts.length;
    const w = (COL.x1 - COL.x0) / n;
    const y0 = 30;
    const y1 = 82;
    m.insts.forEach((inst, k) => {
      const cx = COL.x0 + w * (k + 0.5);
      const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
      const sel = inst === m.sel;
      this.line([cx, y0, cx, y1], FAINT, 1.4);
      const y = y1 - (y1 - y0) * v;
      this.line([cx, y1, cx, y], sel ? INK : HALF, 2.4);
      this.circle(cx, y, sel ? 4.6 : 3.4, sel ? INK : HALF);
      this.text(inst, cx, 96, 8, sel ? INK : HALF, 700, 'center', 0.6);
      this.text(String(Math.round(v * 100)), cx, 26, 7, sel ? INK : FAINT, 600, 'center');
    });
  }

  /** Page SAMPLES : le son precedent, le son du moment en pastille, le suivant ; leur rang. */
  private paintSamples(m: NonNullable<LcdState['samples']>, col: Col = COL): void {
    const n = m.names.length;
    const x = col.x0;
    const ROW = 18;
    for (let k = -1; k <= 1; k += 1) {
      const i = m.cur + k;
      if (i < 0 || i >= n) continue;
      const y = 58 + k * ROW;
      const name = fit(m.names[i], 18);
      if (k === 0) {
        const w = col.x1 - x - 24;
        this.pill(x, y - 10.5, w, 14, INK);
        this.text(name, x + 7, y, 10, BLACK, 600);
      } else this.text(name, x + 7, y, 9, HALF, 500);
    }
    this.text(m.rank, col.x1, 62, 8, HALF, 600, 'right');
    // Le titre : KICK SOUND (le choix de son d'avant), KICK SAMPLE ou KICK SYNTH (les couches de R3, 2026-10-08)
    this.text(/ (SAMPLE|SYNTH)$/.test(m.title) ? m.title : `${m.title} SOUND`, x, 96, 7, HALF, 700, 'left', 0.9);
  }

  /** Mode presets : le titre, le nom en grand entre ses fleches, les quatre touches en pastilles. */
  private paintPresets(s: LcdState): void {
    this.text(fit(s.l1, 24), 10, 18, 9, HALF, 700, 'left', 0.9);
    this.text(s.r1, PAGE_HEAD.right, 18, 9, HALF, 600, 'right');
    const name = s.l2.replace(/^<\s*|\s*>$/g, '').trim();
    this.text(fit(name, 20), UW / 2, 66, 20, INK, 300, 'center');
    if (s.l2.startsWith('<')) {
      this.line([18, 52, 10, 59, 18, 66], INK, 2);
      this.line([UW - 18, 52, UW - 10, 59, UW - 18, 66], INK, 2);
    }
    const keys = s.keys ?? [];
    const cw = UW / 4;
    keys.forEach((k, i) => {
      if (!k) return;
      const w = this.textWidth(k, 8, 700, 0.8) + 14;
      const cx = cw * (i + 0.5);
      this.pill(cx - w / 2, 92, w, 15, null, INK, 1.2);
      this.text(k, cx, 102.5, 8, INK, 700, 'center', 0.8);
    });
  }

  /**
   * La ligne du bas a droite (HOME, EDIT) : le message du moment, ou la piste
   * et sa barre, sinon rien ; la page MIX n'y ecrit rien. La vue PAGE a son
   * pied (paintFoot).
   */
  private paintLine(s: LcdState, rytmEdit: boolean): void {
    const x0 = COL.x0;
    const x1 = COL.x1;
    if (s.mix || s.samples) return;
    if (s.bar !== null) {
      // La piste : son titre, la position et la duree, une barre fine et son point
      const title = s.l2.trim();
      this.text(fit(title, 26), x0, LINE.y - 9, 7, HALF, 600, 'left', 0.5);
      const lw = this.text(s.l3, x0, LINE.y + 4, 7, INK, 600);
      const rw = this.text(s.r3, x1, LINE.y + 4, 7, INK, 600, 'right');
      const a = x0 + lw + 5;
      const b = x1 - rw - 5;
      if (b - a > 10) {
        const y = LINE.y + 1.5;
        const v = Math.max(0, Math.min(1, s.bar));
        this.line([a, y, b, y], FAINT, 1.4);
        this.line([a, y, a + (b - a) * v, y], INK, 1.8);
        this.circle(a + (b - a) * v, y, 2.6, INK);
        this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (LINE.y - 8) * TEX_K, y1: (LINE.y + 8) * TEX_K };
      }
      return;
    }
    if (s.l3) {
      // A la largeur de la colonne (le message garde 40 lettres depuis le 2026-10-08, state/lcd.ts)
      this.text(this.fitText(s.l3, x1 - x0, 9, 0.6, 600), x0, LINE.y, 9, INK, 600, 'left', 0.6);
      return;
    }
    if (rytmEdit) this.text('TAP: PLAY   TAP TAP: CHAIN', x0, LINE.y, 7, FAINT, 700, 'left', 0.6);
    else if (this.paintMode(x0, x1)) return;
    else if (s.tag) this.text('TOUCH: PRESETS', x1, LINE.y, 6.5, FAINT, 700, 'right', 0.8);
  }

  /**
   * MUTE et SOLO (2026-10-07, Mika : "l'ecran affiche la difference et le
   * tip du double MUTE") : le mode du moment a gauche, son tip a droite ;
   * false sans mode ni voix coupee.
   */
  private paintMode(x0: number, x1: number, y: number = LINE.y, big = 9, small = 6.5): boolean {
    const v = voices.get();
    const line = (left: string, tip: string): true => {
      const tw = this.text(tip, x1, y, small, HALF, 700, 'right', 0.8);
      this.text(this.fitText(left, Math.max(20, x1 - x0 - tw - 8), big, 0.6), x0, y, big, INK, 600, 'left', 0.6);
      return true;
    };
    if (v.soloMode) return v.soloMulti ? line('MULTI SOLO', 'TAP VOICES / SOLO: OFF') : line('SOLO 1 VOICE', '2X SOLO: SEVERAL');
    if (v.solo.length) return line(`SOLO ${v.solo.join(' ')}`, 'SOLO: ALL ON');
    if (v.muteMode) return v.muteMulti ? line('MULTI MUTE', 'TAP VOICES / MUTE: OFF') : line('MUTE 1 VOICE', '2X MUTE: SEVERAL');
    if (v.muted.length) return line(`MUTED ${v.muted.join(' ')}`, 'MUTE: ALL ON');
    return false;
  }

  /* ---------------- la vue PAGE (2026-10-08) ---------------- */

  /**
   * La vue PAGE : l'en-tete, les huit blocs (ou la liste des sons sur toute
   * la largeur), le pied (les seize pas et la tete de lecture, le message,
   * la piste ou les six pages) ; rend dans combien de ms l'echo s'eteint
   * (0 : aucun ; paint() en arme le minuteur).
   */
  private paintPage(s: LcdState, rp: RytmPageState, inst: Inst | null, cur: number, now: number, lockStep: number): number {
    let next = 0;
    const mode = this.blockMode(inst, lockStep, now);
    // L'en-tete dit ce que joue le pas montre (revue de R3 : en LOCK et au flash, il disait le kit pendant que les
    // blocs montraient le pas)
    const shownLock = !inst || !mode ? null : mode.kind === 'lock' ? lockOf(pattern.get().locks, inst, mode.step) : mode.lock;
    this.paintPageHead(rp.page, inst, cur, now, lockStep, shownLock);
    if (s.samples && lockStep < 0) this.paintSamples(s.samples, PAGE_COL);
    else {
      const blocks = pageBlocks(rp, inst, now, mode);
      this.paintMatrix(blocks);
      // INFOS (R4) : le bloc de l'encodeur dont la carte est montree, ses quatre coins
      const ik = this.infoKnob();
      if (ik >= 0 && blocks[ik] && blocks[ik].state !== 'empty') this.infoMarks(ik);
      // Les verrous du pas, toutes pages, dans la place que la page laisse vide (revue de R2)
      if (mode) this.paintLockPanel(blocks, mode.step, mode.kind === 'flash' ? mode.lock : undefined);
      this.info.blocks = blocks.map((b) => `${b.label}=${b.text}:${b.state}${b.lock !== 'none' ? `/${b.lock}` : ''}${b.flash ? '!' : ''}${b.quiet ? '~' : ''}`);
      this.info.flash = blocks.filter((b) => b.flash).map((b) => b.k);
      const echo = blocks.find((b) => b.echo);
      if (echo && rp.echo) {
        this.info.echo = echo.k;
        next = Math.max(1, rp.echo.until - now + 1);
      }
    }
    this.paintStrip(inst, rp.sel, lockStep);
    const more = this.paintFoot(s, rp.page, lockStep, now, mode && mode.kind === 'flash' ? mode : null);
    if (more > 0) next = next > 0 ? Math.min(next, more) : more;
    return next;
  }

  /**
   * Les verrous a montrer (2026-10-08) : ceux du pas en LOCK ; sinon, en
   * lecture, ceux du pas qui joue s'il sonne (un coup, la voix pas coupee).
   * Depuis la revue de R2, le flash tient jusqu'au coup suivant de la voix
   * (verrouille ou non : il est la valeur jouee jusque-la, comme sur une
   * Elektron), au moins FLASH.min pour se lire, au plus FLASH.max.
   */
  private blockMode(inst: Inst | null, lockStep: number, now: number): BlockMode | null {
    if (lockStep >= 0) {
      this.flash = null;
      return { kind: 'lock', step: lockStep };
    }
    if (!inst || !clock.running) {
      this.flash = null;
      this.flashHead = -1;
      return null;
    }
    const head = playhead.get();
    if (head !== this.flashHead) {
      this.flashHead = head;
      if (head >= 0 && velocity(pattern.get().steps, inst, head) > 0 && voices.plays(inst)) {
        const lock = lockOf(pattern.get().locks, inst, head);
        const f = this.flash;
        if (lock) this.flash = { inst, step: head, lock, from: now, end: now + FLASH.max };
        else if (f) f.end = Math.min(f.end, Math.max(now, f.from + FLASH.min));
      }
    }
    const f = this.flash;
    if (f && (f.inst !== inst || now >= f.end)) this.flash = null;
    return this.flash ? { kind: 'flash', step: this.flash.step, lock: this.flash.lock } : null;
  }

  /**
   * Le panneau des verrous (revue de R2, Mika : "fais evoluer l'ecran") : les
   * verrous du pas en LOCK, ou du pas qui joue, toutes pages (DEC 93, SOUND
   * CP 909, la page au bout), dans la plus grande place que la page laisse
   * vide (deux rangees si les deux sont libres) ; rien si la page est pleine
   * (le pied les dit alors).
   */
  private paintLockPanel(blocks: readonly Block[], step: number, lockArg?: Readonly<StepLock> | null): void {
    const M = MATRIX;
    const empty = (k: number): boolean => blocks[k]?.state === 'empty';
    // La plus grande place : colonnes contigues vides sur les deux rangees, sinon sur une seule (deux colonnes au moins)
    let best: { c0: number; n: number; r0: number; rows: number } | null = null;
    const consider = (c0: number, n: number, r0: number, rows: number): void => {
      if (n < 1 || (rows === 1 && n < 2)) return;
      if (!best || n * rows > best.n * best.rows || (n * rows === best.n * best.rows && n > best.n)) best = { c0, n, r0, rows };
    };
    for (const rows of [2, 1]) {
      for (let r0 = 0; r0 + rows <= 2; r0 += 1) {
        let c0 = -1;
        for (let c = 0; c <= 4; c += 1) {
          const free = c < 4 && empty(r0 * 4 + c) && (rows === 1 || empty(4 + c));
          if (free && c0 < 0) c0 = c;
          if (!free && c0 >= 0) {
            consider(c0, c - c0, r0, rows);
            c0 = -1;
          }
        }
      }
    }
    const b = best as { c0: number; n: number; r0: number; rows: number } | null;
    if (!b) return;
    const lines: LockLine[] = lockList(step, lockArg);
    const x0 = M.x0 + M.pitch * b.c0;
    const x1 = x0 + M.pitch * (b.n - 1) + M.w;
    const y0 = M.rows[b.r0];
    const y1 = M.rows[b.r0 + b.rows - 1] + M.h;
    const T = this.bt;
    const pad = 5;
    this.roundRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1, M.r, null, FRAME, 0.7);
    // Le titre : le pas, et ce qu'il fait (LOCKS en LOCK, PLAYS quand il joue)
    const title = `STEP ${two(step + 1)} ${lockArg !== undefined ? 'PLAYS' : 'LOCKS'}`;
    this.text(this.fitText(title, x1 - x0 - 2 * pad, T.nameSize, 0.7, 700), x0 + pad, y0 + T.nameDy, T.nameSize, HALF, 700, 'left', 0.7);
    const size = this.mobile ? 9 : 6.8;
    const lh = this.mobile ? 10.4 : 8.2;
    let y = y0 + T.nameDy + lh + 0.6;
    const bottom = y1 - 3;
    const out: string[] = [];
    if (lines.length === 0) {
      this.text(this.fitText('NONE YET: TURN A KNOB', x1 - x0 - 2 * pad, size, 0.5, 600), x0 + pad, y, size, FAINT, 600, 'left', 0.5);
      this.info.panel = ['NONE'];
      return;
    }
    for (let i = 0; i < lines.length; i += 1) {
      // La derniere ligne qui tient dit combien il en reste
      const last = y + lh > bottom;
      if (last && i < lines.length - 1) {
        const more = `+${lines.length - i} MORE`;
        this.text(more, x0 + pad, y, size, HALF, 700, 'left', 0.5);
        out.push(more);
        break;
      }
      const l = lines[i];
      const pw = b.n > 1 ? this.text(l.page, x1 - pad, y, size * 0.82, FAINT, 700, 'right', 0.5) + 4 : 0;
      const nw = this.text(l.name, x0 + pad, y, size, HALF, 700, 'left', 0.5);
      const room = x1 - pad - pw - (x0 + pad + nw + 3);
      this.text(this.fitText(l.text, Math.max(6, room), size, 0.3, 600), x0 + pad + nw + 3, y, size, INK, 600, 'left', 0.3);
      out.push(`${l.page} ${l.name} ${l.text}`);
      y += lh;
      if (y > bottom + 0.01) break;
    }
    this.info.panel = out;
  }

  /** Un petit cadenas (x : son bord gauche, y : le bas de son corps), plein. */
  private padlock(x: number, y: number, s: number, color: string): void {
    const c = this.ctx;
    const w = s;
    const h = s * 0.72;
    c.fillStyle = color;
    c.fillRect(x, y - h, w, h);
    c.beginPath();
    c.arc(x + w / 2, y - h, w * 0.32, Math.PI, 0);
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.7, s * 0.17);
    c.stroke();
  }

  /**
   * L'en-tete de la vue PAGE : la lecture, la page en pastille, la voix et son
   * son (ou MUTE, SOLO ; sans voix ALL, PICK A VOICE) ; a droite le pattern
   * (il clignote quand il change) et le tempo ; un filet dessous.
   */
  private paintPageHead(page: RytmPageId, inst: Inst | null, cur: number, now: number, lockStep = -1, lock: Readonly<StepLock> | null = null): void {
    const H = PAGE_HEAD;
    const T = this.bt.head;
    const y = H.y;
    // A droite d'abord, le pattern et le tempo : la place qui reste va au son
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    const bpm = String(Math.round(pattern.get().bpm));
    const bw = this.text('BPM', H.right, y, T.bpm, HALF, 600, 'right', 0.8);
    const nw = this.text(bpm, H.right - bw - 3, y, T.num, INK, 400, 'right');
    const sw = this.text(slotName(cur), H.right - bw - 3 - nw - H.gap, y, T.num, blinkOff ? FAINT : INK, 600, 'right', 0.6);
    const rightX = H.right - bw - 3 - nw - H.gap - sw - 6;
    this.runIcon(H.iconX, y);
    const label = pageLabel(page);
    const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
    let x: number;
    if (lockStep >= 0) {
      // LOCK (2026-10-08) : la pastille pleine du pas, un cadenas devant ; la page en contour a cote
      const lk = `LOCK ${two(lockStep + 1)}`;
      const gs = T.pill * 0.78;
      const lw = this.textWidth(lk, T.pill, 700, 0.9) + 12 + gs + 3;
      this.roundRect(H.pillX, H.pillY, lw, T.pillH, 2.5, INK);
      this.padlock(H.pillX + 6, ty, gs, BLACK);
      this.text(lk, H.pillX + 6 + gs + 3, ty, T.pill, BLACK, 700, 'left', 0.9);
      const px = H.pillX + lw + 4;
      const pw = this.textWidth(label, T.pill, 700, 0.9) + 10;
      this.roundRect(px, H.pillY + 0.5, pw, T.pillH - 1, 2.5, null, HALF, 0.8);
      this.text(label, px + pw / 2, ty, T.pill, HALF, 700, 'center', 0.9);
      x = px + pw + 7;
    } else {
      const pw = this.textWidth(label, T.pill, 700, 0.9) + 12;
      this.roundRect(H.pillX, H.pillY, pw, T.pillH, 2.5, INK);
      this.text(label, H.pillX + pw / 2, ty, T.pill, BLACK, 700, 'center', 0.9);
      x = H.pillX + pw + 8;
    }
    if (inst) {
      const vw = this.text(inst, x, y, T.voice, INK, 600);
      const solo = voices.isSolo(inst);
      const muted = !voices.plays(inst);
      if (solo || muted) {
        const word = solo ? 'SOLO' : 'MUTE';
        const w = this.textWidth(word, T.sound, 700, 0.8) + 8;
        this.pill(x + vw + 6, H.pillY, w, T.pillH, INK);
        this.text(word, x + vw + 6 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 700, 'center', 0.8);
      } else {
        // Le son a la place qui reste avant le pattern et le tempo (en LOCK la pastille est plus large) ; toute la place,
        // plus de coupe a 12 lettres (revue de R3 : 909+BLUEPRI. avec la moitie de l'en-tete vide) ; SRC et SMPL : les
        // deux couches, ce que le pas montre joue
        const x0 = x + vw + 5;
        const room = rightX - x0;
        const f = familyOf(inst as ShotId);
        const plays = stepPlays(inst, lock);
        const drawn = f && (page === 'src' || page === 'smpl') && room > 30 ? this.paintHeadLayers(plays, f, page, x0, rightX, y, T.sound) : false;
        if (!drawn && room > 14) this.text(this.fitText(kit.playsText(plays), room, T.sound, 0.6, 600), x0, y, T.sound, HALF, 600, 'left', 0.6);
      }
    } else {
      const aw = this.text('ALL', x, y, T.voice, HALF, 600);
      this.text('PICK A VOICE', x + aw + 6, y, T.sound * 0.85, FAINT, 600, 'left', 0.5);
    }
    this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
  }

  /**
   * Les deux couches de la voix dans l'en-tete de SRC et SMPL (revue de R3,
   * 2026-10-08 ; au pied avant, ou elles cachaient les onglets et l'aide du
   * LOCK) : SYN et sa MACHINE, SMP et son sample, chacun suivi de son niveau
   * (0 a 127, OFF), un filet entre les deux ; la couche qui s'entend en
   * clair, l'autre a peine ; celle de la page affichee soulignee. Le pas
   * montre compte (LOCK, flash). Trop long : un corps plus petit, le nom du
   * sample coupe, puis sans les niveaux ; false si rien ne tient (l'appelant
   * ecrit ce qui joue en un mot).
   */
  private paintHeadLayers(p: Readonly<Plays>, f: KitFamily, page: RytmPageId, x0: number, x1: number, y: number, size: number): boolean {
    const halves = [
      { tag: 'SYN', name: KIT_MODEL_LABEL[p.model], lev: p.syn > 0 ? v127Text(p.syn) : 'OFF', on: p.synth, hot: page === 'src' },
      { tag: 'SMP', name: p.sample ? (sampleByKey(p.sample)?.label ?? 'SAMPLE') : 'OFF', lev: p.sample ? (p.lev > 0 ? v127Text(p.lev) : 'OFF') : '', on: p.smp, hot: page === 'smpl' },
    ];
    const room = x1 - x0;
    const sep = 9;
    for (const [k, withLev] of [
      [1, true],
      [0.86, true],
      [0.86, false],
    ] as const) {
      const fs = size * k;
      const ts = fs * 0.78;
      const tagW = halves.map((h) => this.textWidth(h.tag, ts, 700, 0.6) + 3);
      const levW = halves.map((h) => (withLev && h.lev ? this.textWidth(h.lev, fs, 600) + 3 : 0));
      const synW = this.textWidth(halves[0].name, fs, 600, 0.4) + 3;
      const fixed = tagW[0] + synW + levW[0] + sep + tagW[1] + levW[1];
      const nameRoom = room - fixed;
      const smpName = halves[1].name;
      const fitName = this.fitText(smpName, Math.max(1, nameRoom), fs, 0.4, 600);
      // Le nom du sample garde au moins cinq lettres, sinon le cran suivant
      if (fitName.length < Math.min(5, smpName.length) || this.textWidth(fitName, fs, 600, 0.4) > nameRoom) continue;
      let x = x0;
      const parts: string[] = [];
      halves.forEach((h, i) => {
        if (i === 1) {
          // Le filet entre les deux couches
          this.line([x + sep / 2 - 0.5, y - fs * 0.78, x + sep / 2 - 0.5, y + 1], FAINT, 0.7);
          x += sep;
        }
        const tw = this.text(h.tag, x, y, ts, h.on ? HALF : FAINT, 700, 'left', 0.6);
        // La page affichee : la couche soulignee (la pastille pleine de l'en-tete dit deja la page)
        if (h.hot) this.line([x, y + 2, x + tw, y + 2], h.on ? INK : HALF, 0.9);
        x += tw + 3;
        const name = i === 0 ? h.name : fitName;
        x += this.text(name, x, y, fs, h.on ? INK : FAINT, 600, 'left', 0.4) + 3;
        if (withLev && h.lev) x += this.text(h.lev, x, y, fs, h.on ? INK : FAINT, 600) + 3;
        parts.push(`${h.tag} ${name}${withLev && h.lev ? ` ${h.lev}` : ''}`);
      });
      this.info.layers = parts.join(' | ');
      return true;
    }
    return false;
  }

  /**
   * La touche i (R4) : un cercle, le i dedans ; INFOS allume, le disque plein
   * et le i en noir (comme celles du MM-BASS et du MM-ARP).
   */
  private paintInfoKey(on: boolean): void {
    const c = this.ctx;
    const { x, y } = INFO_KEY;
    const r = this.mobile ? INFO_KEY.r.phone : INFO_KEY.r.desk;
    this.circle(x, y, r, on ? INK : BLACK, on ? null : INK, 0.95);
    const ink = on ? BLACK : INK;
    this.circle(x, y - r * 0.46, r * 0.15, ink);
    c.fillStyle = ink;
    const w = r * 0.26;
    c.fillRect(x - w / 2, y - r * 0.16, w, r * 0.68);
    this.info.infos = on;
  }

  /** L'encodeur de page dont la carte INFOS est montree (penc-<k>, ou son bloc lcd-blk-<k>), -1 aucun. */
  private infoKnob(): number {
    const s = rytmInfos.get();
    if (!s.on || !s.id) return -1;
    const m = /^(?:penc|lcd-blk)-([0-7])$/.exec(s.id);
    return m ? Number(m[1]) : -1;
  }

  /** Quatre coins autour du bloc k (INFOS, R4) : la carte parle de lui ; dehors, sans toucher au bloc ni a son echo. */
  private infoMarks(k: number): void {
    const M = MATRIX;
    const x0 = M.x0 + M.pitch * (k % 4) - 1.8;
    const y0 = M.rows[k >> 2] - 1.8;
    const x1 = x0 + M.w + 3.6;
    const y1 = y0 + M.h + 3.6;
    const a = 5;
    const lw = this.mobile ? 1.4 : 1.1;
    this.line([x0, y0 + a, x0, y0, x0 + a, y0], INK, lw);
    this.line([x1 - a, y0, x1, y0, x1, y0 + a], INK, lw);
    this.line([x1, y1 - a, x1, y1, x1 - a, y1], INK, lw);
    this.line([x0 + a, y1, x0, y1, x0, y1 - a], INK, lw);
    this.info.infoBlock = k;
  }

  /**
   * Les huit blocs (A B C D en haut, E F G H dessous, au-dessus des potards
   * du meme nom) : un cadre a peine, le nom et la lettre du potard en haut,
   * la valeur en grand (0 a 127, ou le nom du cran), la ligne d'unite
   * dessous, la petite image a droite ; celui qu'on vient de tourner, cerne
   * (l'echo).
   */
  private paintMatrix(blocks: readonly Block[]): void {
    const M = MATRIX;
    const B = BLOCK;
    const c = this.ctx;
    for (const b of blocks) {
      if (b.state === 'empty') continue;
      this.paintBlock(b, M, B);
      this.pal = PAL;
      c.globalAlpha = 1;
    }
  }

  /**
   * Un bloc de la vue PAGE. En negatif (2026-10-08) : son verrou sur le pas en
   * LOCK, ou celui du pas qui joue ; en retrait : la valeur de la voix en LOCK
   * (base), a peine : GLOBAL et NO LOCK.
   */
  private paintBlock(b: Block, M: typeof MATRIX, B: typeof BLOCK): void {
    const c = this.ctx;
    const bx = M.x0 + M.pitch * (b.k % 4);
    const by = M.rows[b.k >> 2];
    const alive = b.state === 'live';
    const neg = alive && (b.lock === 'locked' || b.flash);
    // Une couche qui ne joue pas (R3) : ses blocs en retrait, lisibles (LEVEL ou SAMPLE la rallument)
    const alpha = b.lock === 'base' ? (b.quiet ? 0.4 : 0.6) : b.lock === 'global' || b.lock === 'nolock' ? 0.32 : b.quiet ? 0.42 : 1;
    if (neg) {
      this.roundRect(bx + 0.5, by + 0.5, M.w - 1, M.h - 1, M.r, INK);
      // Le bloc tourne reste cerne : un filet dehors
      if (b.echo) this.roundRect(bx - 1, by - 1, M.w + 2, M.h + 2, M.r + 1.2, null, INK, 0.8);
    } else {
      c.globalAlpha = b.echo ? 1 : alpha;
      this.roundRect(bx + 0.5, by + 0.5, M.w - 1, M.h - 1, M.r, null, b.echo ? INK : alive ? FRAME : FRAME_DIM, b.echo ? 1.1 : 0.7);
    }
    this.pal = neg ? PAL_NEG : PAL;
    c.globalAlpha = neg ? 1 : alpha;
    const P = this.pal;
    const T = this.bt;
    // Le nom ; au desktop la lettre du potard au bout (au telephone elle est imprimee a cote du potard) ; un cadenas en negatif
    const lockW = neg ? 7 : 0;
    // Un bloc a crans au desktop (MACHINE, GATE) : ses crans tiennent le bout de la ligne d'unite, son etiquette (BOTH,
    // CH+OH) monte sur la ligne du nom, avant la lettre (revue de R3 : elles se chevauchaient)
    const tagName = alive && !!b.tag && b.draw === 'notch' && T.notchRow && b.lock !== 'global' && b.lock !== 'nolock';
    const tnW = tagName ? this.textWidth(b.tag, T.unitSize * 0.92, 700, 0.5) + 4 : 0;
    const nameW = M.w - 2 * B.padX - (T.letters ? 8 : 0) - lockW - (b.tag === 'BOTH' && !T.letters ? 10 : 0) - tnW;
    this.text(this.fitText(b.label, nameW, T.nameSize, 0.7, 700), bx + B.padX, by + T.nameDy, T.nameSize, alive ? P.half : P.faint, 700, 'left', 0.7);
    if (tagName) this.text(b.tag, bx + M.w - B.padX - (T.letters ? 8 : 0) - lockW, by + T.nameDy, T.unitSize * 0.92, P.half, 700, 'right', 0.5);
    if (T.letters) this.text(PAGE_KNOB_LETTERS[b.k], bx + M.w - B.padX, by + T.nameDy, T.letterSize, neg ? P.half : b.echo ? HALF : FAINT, 700, 'right');
    if (neg) this.padlock(bx + M.w - B.padX - (T.letters ? 8 : 0) - 5.5, by + T.nameDy + 0.2, this.mobile ? 6 : 4.6, P.ink);
    if (!alive) {
      this.text('--', bx + B.padX, by + T.valueDy, T.valueSizes[1], P.faint, 300);
      if (b.unit) this.text(this.fitText(b.unit, M.w - 2 * B.padX, T.unitSize), bx + B.padX, by + T.unitDy, T.unitSize, P.faint, 600, 'left', 0.4);
      return;
    }
    const stepped = b.draw === 'notch';
    const v = this.fitValue(b.text, stepped ? M.w - 2 * B.padX : B.valueW);
    this.text(v.text, bx + B.padX, by + T.valueDy, v.size, P.ink, neg ? 400 : 300);
    // La ligne d'unite, et l'etiquette au bout : NO BD, ALL, la voix (la rangee du haut de FX) ; en LOCK GLOBAL, NO LOCK
    // BOTH (R3, les deux couches) au telephone : en haut a droite, ou la lettre du potard n'est pas (sur la ligne
    // d'unite il touchait l'arc du petit potard)
    const tagTop = b.tag === 'BOTH' && !T.letters;
    if (tagTop) this.layersGlyph(bx + M.w - B.padX, by + T.nameDy, P.half);
    const tag = tagTop || tagName ? '' : b.tag;
    const tw = tag ? this.text(tag, bx + M.w - B.padX, by + T.unitDy, T.unitSize, b.noBd || b.all ? P.faint : P.half, 700, 'right', 0.5) + 4 : 0;
    const notchRow = stepped && T.notchRow;
    const unitW = M.w - 2 * B.padX - tw - (notchRow ? 26 : 0);
    // En LOCK, un bloc GLOBAL ou NO LOCK : ni image ni crans (revue de R2 : l'etiquette passait sur la courbe, les
    // arcs, l'interrupteur de GATE) ; il ne se regle pas ici, son nom, sa valeur a peine et l'etiquette suffisent
    const muted = b.lock === 'global' || b.lock === 'nolock';
    const unitRoom = muted ? M.w - 2 * B.padX - tw : unitW;
    if (b.unit) {
      // Son unite si elle tient a cote de l'etiquette (le telephone : l'etiquette seule)
      const u = this.fitText(b.unit, unitRoom, T.unitSize);
      const drop = u !== b.unit && muted;
      if (!drop) this.text(u, bx + B.padX, by + T.unitDy, T.unitSize, P.half, 600, 'left', 0.4);
    }
    if (muted) return;
    if (stepped) {
      if (!notchRow) return;
      // Un reglage a crans : ses crans en ligne au bout de la ligne d'unite ; a deux crans (GATE), un interrupteur
      const nr: Rect = { x0: bx + M.w - B.padX - 22, y0: by + T.unitDy - 4, x1: bx + M.w - B.padX - 1, y1: by + T.unitDy };
      if (b.notches === 2) this.drawSwitch({ x0: nr.x1 - 13, y0: nr.y0 - 1.5, x1: nr.x1, y1: nr.y1 + 0.5 }, b.course >= 0.5);
      else this.drawNotch(nr, b.notches, b.course);
      return;
    }
    const r: Rect = { x0: bx + B.draw.dx0, y0: by + B.draw.dy0, x1: bx + B.draw.dx1, y1: by + B.draw.dy1 };
    switch (b.draw) {
      case 'level':
        this.drawLevel(r, b.course);
        break;
      case 'tone':
        this.drawTone(r, b.value);
        break;
      case 'decay':
        this.drawDecay(r, b.course);
        break;
      case 'swing':
        this.drawSwing(r, b.value);
        break;
      case 'stretch':
        this.drawStretch(r, b.value);
        break;
      case 'start':
        this.drawStart(r, b.course);
        break;
      default:
        this.drawArc(r, b.course, b.draw === 'barc' || b.bipolar);
    }
  }

  /**
   * Deux couches (R3, au telephone a la place de BOTH, qui ne tient pas a cote
   * du nom) : deux petites plaques decalees, l'une pleine ; x : le bord droit,
   * y : la ligne du nom.
   */
  private layersGlyph(x: number, y: number, color: string): void {
    const w = 6.2;
    const h = 4.4;
    this.roundRect(x - w - 2.4, y - h - 3.6, w, h, 1, null, color, 0.9);
    this.roundRect(x - w, y - h - 1.2, w, h, 1, color);
  }

  /** Un interrupteur (un reglage a deux crans, GATE) : une pastille, son bouton a gauche (OFF) ou plein a droite (ON). */
  private drawSwitch(r: Rect, on: boolean): void {
    const h = r.y1 - r.y0;
    const w = r.x1 - r.x0;
    this.pill(r.x0, r.y0, w, h, on ? this.pal.ink : null, on ? null : this.pal.half, 0.8);
    this.circle(on ? r.x1 - h / 2 : r.x0 + h / 2, r.y0 + h / 2, h / 2 - 1.2, on ? this.pal.bg : this.pal.half);
  }

  /**
   * Un petit potard dessine (les reglages sans image a eux) : la piste de
   * 270 deg a peine, l'arc de la valeur plein (depuis midi pour un reglage a
   * zero au centre), l'aiguille.
   */
  private drawArc(r: Rect, course: number, centre: boolean): void {
    const c = this.ctx;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2 + 0.5;
    const rad = Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2 - 0.5;
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const at = a0 + sweep * clamp01(course);
    const from = centre ? a0 + sweep / 2 : a0;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, rad, a0, a0 + sweep);
    c.strokeStyle = this.pal.faint;
    c.lineWidth = 1.4;
    c.stroke();
    if (Math.abs(at - from) > 0.01) {
      c.beginPath();
      c.arc(cx, cy, rad, Math.min(from, at), Math.max(from, at));
      c.strokeStyle = this.pal.ink;
      c.lineWidth = 1.8;
      c.stroke();
    }
    this.line([cx + Math.cos(at) * rad * 0.25, cy + Math.sin(at) * rad * 0.25, cx + Math.cos(at) * rad * 0.85, cy + Math.sin(at) * rad * 0.85], this.pal.ink, 1.3);
  }

  /**
   * Les seize pas de la voix choisie, en bas a gauche (sans voix : le plus
   * fort des voix, en demi-teinte) : plein et blanc fort, demi-teinte doux,
   * vide un cadre a peine ; les temps (1 5 9 13) un peu plus marques ; le pas
   * choisi (la velocite de TRIG) : un point au-dessus. En lecture, la tete :
   * le pas qui joue s'allume en negatif, un carre plein plus grand et un
   * point noir s'il porte un coup, et un trait dessous (2026-10-08, revue de
   * R1, Mika : "on voit a l'ecran quand le sequenceur passe sur ce step" ; le
   * seul trait de 1.6 ne se voyait pas a 1x), comme la lumiere qui court sur
   * les touches trig d'une Elektron.
   */
  private paintStrip(inst: Inst | null, sel: number, lockStep = -1): void {
    const S = PAGE_STRIP;
    const steps = pattern.get().steps;
    const head = clock.running ? playhead.get() : -1;
    // Les pas qui ont des verrous (2026-10-08) : un point dessous ; le pas en LOCK, cerne
    const mask = lockMask(pattern.get().locks, inst);
    let strip = '';
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const x = S.x0 + i * S.pitch;
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      const locked = ((mask >> i) & 1) === 1;
      strip += i === lockStep ? '*' : locked ? (bars > 0 ? 'L' : 'l') : bars > 0 ? 'o' : '.';
      if (i === lockStep) this.roundRect(x - 1.7, S.y - 1.7, S.size + 3.4, S.size + 3.4, 1.4, null, INK, 1.1);
      // Un trait court sous le pas (revue de R2 : le meme point que le pas choisi, au-dessus, se confondait)
      if (locked && i !== head) {
        const ly = S.y + S.size + 2.4;
        this.line([x + 0.9, ly, x + S.size - 0.9, ly], bars > 0 ? INK : HALF, this.mobile ? 1.5 : 1.2);
      }
      if (i === head) {
        // La tete : en negatif, debordant d'un rien sur ses voisins
        this.ctx.fillStyle = INK;
        this.ctx.fillRect(x - 0.9, S.y - 0.9, S.size + 1.8, S.size + 1.8);
        if (bars > 0) this.circle(x + S.size / 2, S.y + S.size / 2, 1.3, BLACK);
        this.line([x - 0.9, S.y + S.size + 2.6, x + S.size + 0.9, S.y + S.size + 2.6], INK, 1.6);
      } else if (bars > 0) {
        this.ctx.fillStyle = !inst ? HALF : bars >= 3 ? INK : bars === 2 ? 'rgba(246, 241, 231, 0.75)' : HALF;
        this.ctx.fillRect(x, S.y, S.size, S.size);
      } else this.roundRect(x + 0.4, S.y + 0.4, S.size - 0.8, S.size - 0.8, 0.6, null, i % 4 === 0 ? HALF : FAINT, 0.7);
      if (i === sel && inst && i !== lockStep) this.circle(x + S.size / 2, S.y - 2.6, this.bt.selR, INK);
    }
    this.info.strip = strip;
  }

  /**
   * Le pied de la vue PAGE, a droite des seize pas, le premier qui vaut :
   * le message du moment (BD DECAY 64  640 MS), la piste qui joue (titre,
   * temps, barre cliquable), MUTE / SOLO, sinon les six pages, celle
   * affichee en pastille : ce que les touches de page sous les potards
   * choisissent.
   */
  private paintFoot(s: LcdState, page: RytmPageId, lockStep: number, now: number, flash: { step: number; lock: Readonly<StepLock> | null } | null): number {
    const F = PAGE_FOOT;
    const x0 = F.x0;
    const x1 = F.x1;
    const y = F.y;
    const fs = this.bt.foot;
    if (lockStep >= 0) {
      // LOCK (2026-10-08) : deux lignes, ce qui vient de se passer (ou les verrous du pas), puis comment faire
      const lk = rytmLock.get();
      const held = !lk.latched;
      // Tenu : lache sans rien tourner, le LOCK reste ; un potard deja tourne pendant la tenue : le lacher en sort
      const used = held && lk.writes > lk.since;
      const names = lockSummary(lockStep);
      // Plus gros au telephone (revue de R2 : 5 a 6 px a l'ecran) : 10 et 8.6, comme les noms et les unites des blocs
      const s1 = this.mobile ? 10 : fs - 1.2;
      const s2 = this.mobile ? 8.6 : 5.8;
      // Les verrous du pas ; trop pour la ligne : combien, et sur quelles pages
      const full = `STEP ${two(lockStep + 1)} LOCKS: ${names.join(' ')}`;
      const list = this.textWidth(full, s1, 600, 0.5) <= x1 - x0 ? full : `STEP ${two(lockStep + 1)}: ${names.length} LOCKS ON ${lockPages(lockStep).join(' ')}`;
      const top = s.l3 && !s.mix ? s.l3 : names.length > 0 ? list : `TURN A KNOB: STEP ${two(lockStep + 1)} ONLY`;
      // Le telephone n'a la place que d'une aide a la fois : elles alternent (comment enlever, comment sortir)
      const phase = this.mobile ? Math.floor(now / TIP_MS) % 2 : 0;
      const tip = used
        ? 'RELEASE: LOCK DONE'
        : held
          ? 'RELEASE: STAY IN LOCK'
          : !this.mobile
            ? '2X: UNLOCK  CLEAR: ALL  STEP: EXIT'
            : phase === 0
              ? '2X: UNLOCK  CLEAR: ALL'
              : `TAP STEP ${two(lockStep + 1)} AGAIN: EXIT`;
      const y1 = this.mobile ? 108.7 : 106.8;
      const y2 = this.mobile ? 118 : 114.8;
      const t1 = this.fitText(top, x1 - x0, s1, 0.5, 600);
      const t2 = this.fitText(tip, x1 - x0, s2, 0.6, 700);
      this.text(t1, x0, y1, s1, INK, 600, 'left', 0.5);
      this.text(t2, x0, y2, s2, HALF, 700, 'left', 0.6);
      this.info.foot = [t1, t2];
      // L'aide suivante a son heure (le telephone, LOCK fixe)
      return this.mobile && !held ? TIP_MS - (now % TIP_MS) + 1 : 0;
    }
    if (s.samples) return 0;
    if (s.bar !== null) {
      // La piste : son titre, le temps, la barre (un corps un peu plus petit que les messages)
      const ts = fs - 1.5;
      const tw = this.text(fit(s.l2.trim(), this.mobile ? 10 : 14), x0, y, ts, HALF, 600, 'left', 0.5);
      const lw = this.text(s.l3, x0 + tw + 6, y, ts, INK, 600);
      const rw = this.text(s.r3, x1, y, ts, INK, 600, 'right');
      const a = x0 + tw + 6 + lw + 5;
      const b = x1 - rw - 5;
      if (b - a > 10) {
        const yb = y - 2.3;
        const v = Math.max(0, Math.min(1, s.bar));
        this.line([a, yb, b, yb], FAINT, 1.4);
        this.line([a, yb, a + (b - a) * v, yb], INK, 1.8);
        this.circle(a + (b - a) * v, yb, 2.4, INK);
        this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (y - 12) * TEX_K, y1: (y + 6) * TEX_K };
      }
      return 0;
    }
    if (s.l3 && !s.mix) {
      const t = this.fitText(s.l3, x1 - x0, fs, 0.5, 600);
      this.text(t, x0, y, fs, INK, 600, 'left', 0.5);
      this.info.footText = t;
      return 0;
    }
    if (this.paintMode(x0, x1, y, fs + 0.5, this.mobile ? 7.5 : 6.5)) return 0;
    // Le pas verrouille qui joue (revue de R2) : ses pages (desktop, un point sur leur onglet) ; au telephone ses
    // verrous ecrits, toutes pages (la page affichee n'en montre peut-etre aucun)
    const fl = flash ? lockList(flash.step, flash.lock) : [];
    const flashPages = new Set(fl.map((l) => l.page));
    if (!this.bt.tabs) {
      // Au telephone, sans onglets : le pas qui joue et ses verrous ; sinon, toujours, le geste des verrous
      // (revue de R2 : seul un message de 800 ms le disait, la face n'a pas la place de l'ecrire)
      const t = flash && fl.length > 0 ? this.flashLine(flash.step, fl, x1 - x0, fs) : this.fitText('HOLD A STEP + TURN A KNOB: LOCK', x1 - x0, fs - 0.5, 0.5, 700);
      this.text(t, x0, y, flash && fl.length > 0 ? fs : fs - 0.5, flash && fl.length > 0 ? INK : HALF, flash && fl.length > 0 ? 600 : 700, 'left', flash && fl.length > 0 ? 0.4 : 0.5);
      this.info.footText = t;
      return 0;
    }
    // Les six pages (desktop) : la page affichee en pastille, les autres a peine ; au telephone, rien
    // (la touche allumee et la pastille de l'en-tete la disent, le texte du bloc a pris la place)
    this.tabsShown = true;
    this.info.footText = 'TABS';
    const n = RYTM_PAGES.length;
    const cw = (x1 - x0) / n;
    RYTM_PAGES.forEach((p, i) => {
      const cx = x0 + cw * (i + 0.5);
      const ts = this.bt.tabSize;
      const hot = flashPages.has(p.label);
      if (p.id === page) {
        const w = this.textWidth(p.label, ts, 700, 0.7) + 8;
        this.roundRect(cx - w / 2, y - ts - 1.6, w, ts + 4, 2, INK);
        this.text(p.label, cx, y, ts, BLACK, 700, 'center', 0.7);
      } else this.text(p.label, cx, y, ts, hot ? INK : FAINT, 700, 'center', 0.7);
      // Une page ou le pas qui joue a des verrous : un point au-dessus de son onglet
      if (hot) this.circle(cx, y - ts - 3.6, 1.1, INK);
    });
    if (flashPages.size > 0) this.info.footText = `TABS ${[...flashPages].join(' ')}`;
    return 0;
  }

  /** Les verrous du pas qui joue sur une ligne : autant qu'il en tient, puis combien il en reste (+2). */
  private flashLine(step: number, fl: readonly LockLine[], maxW: number, size: number): string {
    let t = two(step + 1);
    for (let i = 0; i < fl.length; i += 1) {
      const next = `${t}  ${fl[i].name} ${fl[i].text}`;
      const rest = i < fl.length - 1 ? `  +${fl.length - i - 1}` : '';
      if (this.textWidth(next + rest, size, 600, 0.4) > maxW) return `${t}  +${fl.length - i}`;
      t = next;
    }
    return t;
  }

  /** Coupe un texte a la largeur (unites) ; un point final quand ca deborde. */
  private fitText(s: string, maxW: number, size: number, spacing = 0.4, weight = 600): string {
    if (this.textWidth(s, size, weight, spacing) <= maxW) return s;
    let n = s.length - 1;
    while (n > 1 && this.textWidth(fit(s, n), size, weight, spacing) > maxW) n -= 1;
    return fit(s, n);
  }

  /** La valeur d'un bloc dans sa largeur : 16, sinon 13, 11 puis 9 et coupee. */
  private fitValue(s: string, maxW: number): { text: string; size: number } {
    const sizes = this.bt.valueSizes;
    for (const size of sizes) if (this.textWidth(s, size, 300) <= maxW) return { text: s, size };
    const size = sizes[sizes.length - 1];
    let n = s.length - 1;
    while (n > 1 && this.textWidth(fit(s, n), size, 300) > maxW) n -= 1;
    return { text: fit(s, n), size };
  }

  /** Fin d'un redessin : la texture part, les compteurs suivent. */
  private done(s: LcdState, now: number): void {
    this.texture.needsUpdate = true;
    const info = this.info;
    if (info.draws > 0) info.minGapMs = Math.min(info.minGapMs, now - info.lastDrawAt);
    info.draws += 1;
    info.lastDrawAt = now;
    info.text = [s.text[0], s.text[1], s.text[2]];
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
    window.clearTimeout(this.idleTimer);
    window.clearTimeout(this.echoTimer);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
