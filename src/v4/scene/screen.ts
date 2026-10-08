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
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { clock } from '../audio/clock';
import { mix } from '../audio/drums';
import { familyOf, kit } from '../audio/kit';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import { sc } from '../audio/soundcloud';
import { voiceFx } from '../audio/voicefx';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { lcd, type LcdState } from '../state/lcd';
import { PATTERN_SLOTS, patterns, slotName } from '../state/patterns';
import { playhead } from '../state/playhead';
import { rytmPage, type RytmPageState, type RytmView } from '../state/rytmPage';
import { voices } from '../state/voices';
import { FONT_DISPLAY, HEX, OLED, PAGE_KNOB_LETTERS, type Inst } from '../theme';
import { RYTM_PAGES, pageLabel, type RytmPageId } from '../rytm/pages';
import { pageBlocks, type Block } from '../rytm/pageView';
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
  nameDy: 9,
  valueDy: 27.5,
  /** la largeur de la valeur avant l'image */
  valueW: 34,
  unitDy: 34,
  draw: { dx0: 42, dx1: 67, dy0: 13, dy1: 29 },
} as const;
/**
 * Les corps des blocs : au telephone un peu plus gros (l'ecran y fait 230 px
 * de large : le nom et l'unite a 6.5 et 5.5 n'y faisaient pas 5 px).
 */
const BLOCK_TYPE = {
  desk: { nameSize: 6.5, letterSize: 5.5, unitSize: 5.5, valueSizes: [16, 13, 11, 9], tabSize: 6 },
  phone: { nameSize: 8, letterSize: 6.5, unitSize: 6.5, valueSizes: [17, 14, 12, 10], tabSize: 7.5 },
} as const;
const PAGE_HEAD = { y: 15, iconX: 10, pillX: 23, pillY: 5.5, pillH: 12, pillSize: 7.5, right: 312, rule: 21 } as const;
/** Les seize pas du pied (a gauche) et le reste du pied (a droite). */
const PAGE_STRIP = { x0: 10, y: 105.5, size: 5.5, pitch: 7 } as const;
const PAGE_FOOT = { x0: 132, x1: 312, y: 112 } as const;
/** La liste des sons (SAMPLES) sur toute la largeur. */
const PAGE_COL: Col = { x0: 10, x1: 310 };

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
    this.info = { draws: 0, text: ['', '', ''], lastDrawAt: -Infinity, minGapMs: Infinity, font: 'vector op-1', size: [W, H], view: 'home', page: rytmPage.get().page, blocks: [], echo: -1 };
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
    const view: ScreenInfo['view'] = s.keys ? 'presets' : rytmEdit ? 'edit' : rp.view;
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
    this.info.view = view;
    this.info.page = rp.page;
    this.info.blocks = [];
    this.info.echo = -1;
    if (s.keys) this.paintPresets(s);
    else if (paged) this.armEcho(this.paintPage(s, rp, p.instrument, ptn.cur, now));
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
    const bw = this.text('BPM', COL.x1, y, 7, HALF, 600, 'right', 0.8);
    this.text(bpm, COL.x1 - bw - 4, y, 12, INK, 400, 'right');
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
      const on = k + 1 <= lit + 1e-6 ? INK : k < lit ? HALF : FAINT;
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
    this.line([x0, mid, x1, mid], FAINT, 0.8);
    this.line(pts, INK, 2 * Math.max(0.7, Screen.cardK(r)));
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
    this.line([x0, base, x1, base], FAINT, 0.8);
    this.line(pts, INK, 2 * Math.max(0.7, Screen.cardK(r)));
  }

  /** SWING : quatre paires de points, la seconde de chaque paire decalee par le swing. */
  private drawSwing(r: Rect, v: number): void {
    const { x0, x1 } = r;
    const n = 4;
    const cell = (x1 - x0) / n;
    const y = (r.y0 + r.y1) / 2;
    const ks = Screen.cardK(r);
    this.line([x0, y, x1, y], FAINT, 0.8);
    for (let k = 0; k < n; k += 1) {
      const xa = x0 + k * cell + cell * 0.18;
      const xb = x0 + k * cell + cell * (0.5 + 0.32 * Math.max(0, Math.min(1, v)));
      this.circle(xa, y, 3.4 * ks, INK);
      this.circle(xb, y, 2.6 * ks, HALF);
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
    this.line([x0, mid, x1, mid], FAINT, 0.8);
    this.line(pts, INK, 2 * Math.max(0.7, Screen.cardK(r)));
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
      if (i === cur) this.circle(x, y, n > 6 ? 1.7 : 2.3, INK);
      else this.circle(x, y, 0.8, HALF);
    }
  }

  /** Une barre : le trait a peine, la valeur pleine et son point ; centre : depuis le milieu (son repere). */
  private drawBar(r: Rect, course: number, centre: boolean): void {
    const y = (r.y0 + r.y1) / 2;
    const x = r.x0 + (r.x1 - r.x0) * clamp01(course);
    const from = centre ? (r.x0 + r.x1) / 2 : r.x0;
    this.line([r.x0, y, r.x1, y], FAINT, 1.4);
    if (centre) this.line([from, y - 2.4, from, y + 2.4], HALF, 0.8);
    this.line([from, y, x, y], INK, 1.8);
    this.circle(x, y, 2, INK);
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
    this.text(`${m.cur + 1}/${n}`, col.x1, 62, 8, HALF, 600, 'right');
    this.text(`${m.title} SOUND`, x, 96, 7, HALF, 700, 'left', 0.9);
  }

  /** Mode presets : le titre, le nom en grand entre ses fleches, les quatre touches en pastilles. */
  private paintPresets(s: LcdState): void {
    this.text(fit(s.l1, 24), 10, 18, 9, HALF, 700, 'left', 0.9);
    this.text(s.r1, UW - 10, 18, 9, HALF, 600, 'right');
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
      this.text(fit(s.l3, 30), x0, LINE.y, 9, INK, 600, 'left', 0.6);
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
  private paintMode(x0: number, x1: number, y: number = LINE.y): boolean {
    const v = voices.get();
    const line = (left: string, tip: string): true => {
      const tw = this.text(tip, x1, y, 6.5, HALF, 700, 'right', 0.8);
      this.text(fit(left, Math.max(6, Math.floor((x1 - x0 - tw - 8) / 6.4))), x0, y, 9, INK, 600, 'left', 0.6);
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
  private paintPage(s: LcdState, rp: RytmPageState, inst: Inst | null, cur: number, now: number): number {
    this.paintPageHead(rp.page, inst, cur, now);
    let next = 0;
    if (s.samples) this.paintSamples(s.samples, PAGE_COL);
    else {
      const blocks = pageBlocks(rp, inst, now);
      this.paintMatrix(blocks);
      this.info.blocks = blocks.map((b) => `${b.label}=${b.text}:${b.state}`);
      const echo = blocks.find((b) => b.echo);
      if (echo && rp.echo) {
        this.info.echo = echo.k;
        next = Math.max(1, rp.echo.until - now + 1);
      }
    }
    this.paintStrip(inst, rp.sel);
    this.paintFoot(s, rp.page);
    return next;
  }

  /**
   * L'en-tete de la vue PAGE : la lecture, la page en pastille, la voix et son
   * son (ou MUTE, SOLO ; sans voix ALL, PICK A VOICE) ; a droite le pattern
   * (il clignote quand il change) et le tempo ; un filet dessous.
   */
  private paintPageHead(page: RytmPageId, inst: Inst | null, cur: number, now: number): void {
    const H = PAGE_HEAD;
    const y = H.y;
    this.runIcon(H.iconX, y);
    const label = pageLabel(page);
    const pw = this.textWidth(label, H.pillSize, 700, 0.9) + 12;
    this.roundRect(H.pillX, H.pillY, pw, H.pillH, 2.5, INK);
    this.text(label, H.pillX + pw / 2, H.pillY + H.pillH - 3, H.pillSize, BLACK, 700, 'center', 0.9);
    const x = H.pillX + pw + 8;
    if (inst) {
      const vw = this.text(inst, x, y, 12, INK, 600);
      const solo = voices.isSolo(inst);
      const muted = !voices.plays(inst);
      if (solo || muted) {
        const word = solo ? 'SOLO' : 'MUTE';
        const w = this.textWidth(word, 7, 700, 0.8) + 8;
        this.pill(x + vw + 6, H.pillY, w, H.pillH, INK);
        this.text(word, x + vw + 6 + w / 2, H.pillY + H.pillH - 3, 7, BLACK, 700, 'center', 0.8);
      } else this.text(fit(soundOf(inst), 12), x + vw + 5, y, 7, HALF, 600, 'left', 0.6);
    } else {
      const aw = this.text('ALL', x, y, 12, HALF, 600);
      this.text('PICK A VOICE', x + aw + 6, y, 6, FAINT, 600, 'left', 0.5);
    }
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    const bpm = String(Math.round(pattern.get().bpm));
    const bw = this.text('BPM', H.right, y, 6.5, HALF, 600, 'right', 0.8);
    const nw = this.text(bpm, H.right - bw - 3, y, 12, INK, 400, 'right');
    this.text(slotName(cur), H.right - bw - 3 - nw - 10, y, 12, blinkOff ? FAINT : INK, 600, 'right', 0.6);
    this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
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
    for (const b of blocks) {
      if (b.state === 'empty') continue;
      const bx = M.x0 + M.pitch * (b.k % 4);
      const by = M.rows[b.k >> 2];
      const alive = b.state === 'live';
      this.roundRect(bx + 0.5, by + 0.5, M.w - 1, M.h - 1, M.r, null, b.echo ? INK : alive ? FRAME : FRAME_DIM, b.echo ? 1.1 : 0.7);
      const T = this.bt;
      this.text(this.fitText(b.label, M.w - 2 * B.padX - 8, T.nameSize, 0.7, 700), bx + B.padX, by + B.nameDy, T.nameSize, alive ? HALF : FAINT, 700, 'left', 0.7);
      this.text(PAGE_KNOB_LETTERS[b.k], bx + M.w - B.padX, by + B.nameDy, T.letterSize, b.echo ? HALF : FAINT, 700, 'right');
      if (!alive) {
        this.text('--', bx + B.padX, by + B.valueDy, T.valueSizes[1], FAINT, 300);
        if (b.unit) this.text(b.unit, bx + B.padX, by + B.unitDy, T.unitSize, FAINT, 600, 'left', 0.4);
        continue;
      }
      const tag = b.noBd ? 'NO BD' : b.all ? 'ALL' : '';
      const stepped = b.draw === 'notch';
      const v = this.fitValue(b.text, stepped ? M.w - 2 * B.padX : B.valueW);
      this.text(v.text, bx + B.padX, by + B.valueDy, v.size, INK, 300);
      // La ligne d'unite, et l'etiquette ALL / NO BD au bout
      const tw = tag ? this.text(tag, bx + M.w - B.padX, by + B.unitDy, T.unitSize, FAINT, 700, 'right', 0.5) + 4 : 0;
      const unitW = M.w - 2 * B.padX - tw - (stepped ? 26 : 0);
      if (b.unit) this.text(this.fitText(b.unit, unitW, T.unitSize), bx + B.padX, by + B.unitDy, T.unitSize, HALF, 600, 'left', 0.4);
      if (stepped) {
        // Un reglage a crans : ses crans en ligne au bout de la ligne d'unite ; a deux crans (GATE), un interrupteur
        const nr: Rect = { x0: bx + M.w - B.padX - 22, y0: by + B.unitDy - 4, x1: bx + M.w - B.padX - 1, y1: by + B.unitDy };
        if (b.notches === 2) this.drawSwitch({ x0: nr.x1 - 13, y0: nr.y0 - 1.5, x1: nr.x1, y1: nr.y1 + 0.5 }, b.course >= 0.5);
        else this.drawNotch(nr, b.notches, b.course);
        continue;
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
        default:
          this.drawArc(r, b.course, b.draw === 'barc' || b.bipolar);
      }
    }
  }

  /** Un interrupteur (un reglage a deux crans, GATE) : une pastille, son bouton a gauche (OFF) ou plein a droite (ON). */
  private drawSwitch(r: Rect, on: boolean): void {
    const h = r.y1 - r.y0;
    const w = r.x1 - r.x0;
    this.pill(r.x0, r.y0, w, h, on ? INK : null, on ? null : HALF, 0.8);
    this.circle(on ? r.x1 - h / 2 : r.x0 + h / 2, r.y0 + h / 2, h / 2 - 1.2, on ? BLACK : HALF);
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
    c.strokeStyle = FAINT;
    c.lineWidth = 1.4;
    c.stroke();
    if (Math.abs(at - from) > 0.01) {
      c.beginPath();
      c.arc(cx, cy, rad, Math.min(from, at), Math.max(from, at));
      c.strokeStyle = INK;
      c.lineWidth = 1.8;
      c.stroke();
    }
    this.line([cx + Math.cos(at) * rad * 0.25, cy + Math.sin(at) * rad * 0.25, cx + Math.cos(at) * rad * 0.85, cy + Math.sin(at) * rad * 0.85], INK, 1.3);
  }

  /**
   * Les seize pas de la voix choisie, en bas a gauche (sans voix : le plus
   * fort des voix, en demi-teinte) : plein et blanc fort, demi-teinte doux,
   * vide un cadre a peine ; les temps (1 5 9 13) un peu plus marques ; en
   * lecture, la tete : un trait plein sous le pas qui joue ; le pas choisi
   * (la velocite de TRIG) : un point au-dessus.
   */
  private paintStrip(inst: Inst | null, sel: number): void {
    const S = PAGE_STRIP;
    const steps = pattern.get().steps;
    const head = clock.running ? playhead.get() : -1;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const x = S.x0 + i * S.pitch;
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      if (bars > 0) {
        this.ctx.fillStyle = !inst ? HALF : bars >= 3 ? INK : bars === 2 ? 'rgba(246, 241, 231, 0.75)' : HALF;
        this.ctx.fillRect(x, S.y, S.size, S.size);
      } else this.roundRect(x + 0.4, S.y + 0.4, S.size - 0.8, S.size - 0.8, 0.6, null, i % 4 === 0 ? HALF : FAINT, 0.7);
      if (i === head) this.line([x - 0.3, S.y + S.size + 2.3, x + S.size + 0.3, S.y + S.size + 2.3], INK, 1.6);
      if (i === sel && inst) this.circle(x + S.size / 2, S.y - 2.4, 0.9, INK);
    }
  }

  /**
   * Le pied de la vue PAGE, a droite des seize pas, le premier qui vaut :
   * le message du moment (BD DECAY 64  640 MS), la piste qui joue (titre,
   * temps, barre cliquable), MUTE / SOLO, sinon les six pages, celle
   * affichee en pastille : ce que les touches de page sous les potards
   * choisissent.
   */
  private paintFoot(s: LcdState, page: RytmPageId): void {
    const F = PAGE_FOOT;
    const x0 = F.x0;
    const x1 = F.x1;
    const y = F.y;
    if (s.samples) return;
    if (s.bar !== null) {
      const tw = this.text(fit(s.l2.trim(), 14), x0, y, 6.5, HALF, 600, 'left', 0.5);
      const lw = this.text(s.l3, x0 + tw + 6, y, 6.5, INK, 600);
      const rw = this.text(s.r3, x1, y, 6.5, INK, 600, 'right');
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
      return;
    }
    if (s.l3 && !s.mix) {
      this.text(this.fitText(s.l3, x1 - x0, 8, 0.5, 600), x0, y, 8, INK, 600, 'left', 0.5);
      return;
    }
    if (this.paintMode(x0, x1, y)) return;
    // Les six pages : la page affichee en pastille, les autres a peine
    const n = RYTM_PAGES.length;
    const cw = (x1 - x0) / n;
    RYTM_PAGES.forEach((p, i) => {
      const cx = x0 + cw * (i + 0.5);
      if (p.id === page) {
        const ts = this.bt.tabSize;
        const w = this.textWidth(p.label, ts, 700, 0.7) + 8;
        this.roundRect(cx - w / 2, y - ts - 1.6, w, ts + 4, 2, INK);
        this.text(p.label, cx, y, ts, BLACK, 700, 'center', 0.7);
      } else this.text(p.label, cx, y, this.bt.tabSize, FAINT, 700, 'center', 0.7);
    });
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
