/**
 * L'ecran OLED en haut a gauche du panneau (spec 20.3.8) : un plan de
 * 3.6 x 1.35 pose sur son cadre, texture canvas (les proportions du verre).
 * Redessine le 2026-10-05 (Mika : "l'ecran de RYTM dans le design de pixel
 * comme la Digitakt 2, mais bien plus simple ; des fois de petites
 * animations ; l'ecran est important, on devrait avoir plus d'informations ;
 * le meilleur de toutes les machines : Digitakt 2, Analog Rytm, EMX1,
 * Impulse"), puis affine (Mika : "fais les choses plus fines, meilleur
 * graphisme et occupe tout l'ecran, la il y a de l'espace en dessous") :
 * 320 x 120 points, mise en page en unites de 160 x 60 (scene/pixels.ts),
 * bone sur noir, traits d'un point, marges de deux unites. De haut en bas :
 * - l'en-tete : la section ouverte (ou MM-RYTM), le pattern (A01, en
 *   negatif ; il clignote quand il change), la lecture (un triangle, un
 *   carre a l'arret), quatre cases pour les temps de la mesure (allumees
 *   une a une en lecture), le tempo ;
 * - au milieu, a gauche, la voix choisie en grand (BD, SD...) et son son
 *   (909, 808, MM, ou son sample ; MUTE ou SOLO) ; a droite ses seize pas
 *   (la hauteur de chaque coup sa velocite, le temps fort marque, la tete
 *   de lecture soulignee), dessous dix vumetres en segments, un par voix,
 *   qui sautent a chaque coup et retombent (facon Impulse) ;
 * - en EDIT (state/patterns.ts) : le pattern en grand et les seize
 *   emplacements (le courant en negatif, la chaine encadree, celui qui
 *   attend la mesure qui clignote), la chaine sur la ligne du dessous ;
 * - page MIX : les cinq volumes en barres, la voix reglee en negatif ;
 * - mode presets : le nom entre ses fleches, quatre touches en bas ;
 * - les deux lignes du bas : l'etat (READY, RUN, le titre qui defile,
 *   l'etiquette PRESETS) ; puis le message passager, la valeur d'un potard,
 *   la piste en cours et sa barre (cliquable, bar), sinon trois jauges : la
 *   voix choisie (VOLUME, TONE, DECAY) ou la machine (SWING, STRETCH,
 *   MASTER). L'ecran est plein a toute heure.
 * Au repos (desktop, la machine regardee), de temps en temps, une vague
 * lente passe sur les vumetres. Le texte vient de state/lcd.ts ; l'image se
 * refait quand un store change, au plus tous les 60 ms, et ne demande une
 * frame qu'apres un redessin. Materiau non eclaire, sans tone mapping.
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
import { voices } from '../state/voices';
import { HEX, OLED, OLED_BAR, swingRatio, type Inst } from '../theme';
import { PIX_CANVAS, PIX_TEX, PIX_W, PixelBuffer, fitChars, fontHeight, textWidth } from './pixels';
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
}

/** Au plus un redessin tous les 60 ms (un potard tourne a la cadence du pointeur). */
const MIN_GAP_MS = 60;
/** Les animations courtes : une image tous les 50 ms. */
const ANIM_MS = 50;
/** Le clignotement d'un pattern qui change, le glissement d'une voix choisie. */
const BLINK_MS = 600;
const SLIDE_MS = 160;
/** La vague du repos : apres IDLE_MS sans rien, WAVE_MS de vague (desktop). */
const IDLE_MS = 15000;
const WAVE_MS = 7000;
/** Un vumetre retombe de moitie en METER_HALF_S. */
const METER_HALF_S = 0.12;

const rgb = (hex: string): number[] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const OFF = rgb(HEX.oled);
const FULL = rgb(HEX.bone);
const DIM = FULL.map((c, i) => Math.round(OFF[i] + (c - OFF[i]) * 0.4));

/** Coupe a n lettres, un point final quand ca deborde. */
const fit = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}.`);

/** Le son d'une voix : 909, 808, MM ou son sample (CY et PC : MM). */
function soundOf(inst: Inst): string {
  const f = familyOf(inst as ShotId);
  return f ? kit.valueText(f) : 'MM';
}

/* Deux unites de marge de chaque cote */
const X0 = 2;
const X1 = PIX_W - 2;
/* La grille des pas : seize cases de 6, un jour de 1, deux de plus entre les groupes de quatre (41 a 158) */
const GRID = { x: 41, y: 12, w: 6, h: 12, gap: 1, group: 2 } as const;
const cellX = (i: number): number => GRID.x + i * (GRID.w + GRID.gap) + Math.floor(i / 4) * GRID.group;
/* Les dix vumetres sous la grille : six segments d'un point (un point de jour), leur nom dessous */
const METERS = { x: 41, bottom: 33.5, w: 7, segs: 6, label: 35, pitch: 109 / (INSTRUMENTS.length - 1) } as const;
/* Les filets, sous l'en-tete et au-dessus des deux lignes du bas (OLED_BAR.bandY0 : 40 unites) */
const RULE_TOP = 10;
const RULE_BOTTOM = 40;
/* Les deux lignes du bas */
const LINE_A = 42;
const LINE_B = 51;
/* Les trois jauges de la ligne du bas (au repos) */
const GAUGE = { gap: 5, h: 5 } as const;

export class Screen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pix = new PixelBuffer();
  private timer = 0;
  private unsubs: (() => void)[] = [];
  /** les vumetres (0 a 1) et l'instant de leur derniere mise a jour */
  private meters = new Float32Array(INSTRUMENTS.length);
  private metersAt = 0;
  private lastStep = -1;
  /** les animations : le pattern qui clignote, la voix qui glisse, la vague du repos */
  private blinkUntil = 0;
  private slideFrom = 0;
  private waveFrom = 0;
  private lastCur = -1;
  private lastInst: Inst | null = null;
  private activeAt = performance.now();

  constructor(
    anisotropy: number,
    /** demande une frame apres un redessin */
    private invalidate: () => void,
    /** telephone : pas de vague au repos (aucune image pour rien) */
    private mobile = false
  ) {
    const [W, H] = PIX_CANVAS;
    this.info = { draws: 0, text: ['', '', ''], lastDrawAt: -Infinity, minGapMs: Infinity, font: 'pixel 5x7 thin', size: [W, H] };
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('screen: no 2d context');
    this.ctx = ctx;
    // Mipmaps et anisotropie : l'ecran est vu de biais et reduit (sur un
    // telephone il fait 80 px de large), un simple filtre lineaire scintillerait
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
    this.lastInst = pattern.get().instrument;
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
      playhead.subscribe(() => this.request()),
      focus.subscribe(() => this.request()),
    ];
    // Un changement entre la construction et l'abonnement n'est pas perdu
    this.request();
  }

  /** Un redessin bientot (au plus tous les MIN_GAP_MS). */
  private request(delay = 0): void {
    if (this.timer !== 0) return;
    const wait = Math.max(delay, this.info.lastDrawAt + MIN_GAP_MS - performance.now(), 0);
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      const now = performance.now();
      const more = this.paint(lcd.get(), now);
      this.invalidate();
      if (more > 0) this.request(more);
      else this.armIdle(now);
    }, wait);
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
   * La barre de progression telle que dessinee (px de la texture : x0 a x1,
   * y0 a y1), null quand elle n'est pas a l'ecran : le Stage y lit un clic
   * (seekAt).
   */
  bar: { x0: number; x1: number; y0: number; y1: number } | null = null;

  /** Redessine ; rend dans combien de ms il faut une autre image (0 : aucune). */
  private paint(s: LcdState, now: number): number {
    const b = this.pix;
    b.clear();
    const p = pattern.get();
    const ptn = patterns.get();
    const rytmEdit = editor.get() === 'mm808';
    let next = 0;
    // Les animations qui partent : un pattern qui change, une voix choisie
    if (ptn.cur !== this.lastCur) {
      this.lastCur = ptn.cur;
      this.blinkUntil = now + BLINK_MS;
    }
    if (p.instrument !== this.lastInst) {
      this.lastInst = p.instrument;
      if (p.instrument) this.slideFrom = now;
    }
    this.stepMeters(now);
    // La vague du repos (desktop, la machine regardee, rien ne joue ni ne s'affiche)
    const quiet = !clock.running && sc.get().status !== 'playing' && !s.l3 && !s.mix && !s.samples && !s.keys;
    if (!this.mobile && quiet && focus.get() === 'mm808' && now - this.activeAt > IDLE_MS) {
      if (this.waveFrom === 0) this.waveFrom = now;
      if (now - this.waveFrom > WAVE_MS) {
        this.waveFrom = 0;
        this.activeAt = now;
      }
    } else this.waveFrom = 0;

    if (s.keys) this.paintPresets(s);
    else {
      this.paintHead(s, ptn.cur, now);
      if (s.mix) this.paintMix(s.mix);
      else if (s.samples) this.paintSamples(s.samples);
      else if (rytmEdit) next = Math.max(next, this.paintPatterns(now));
      else next = Math.max(next, this.paintVoice(p.instrument, p.steps, now));
      this.paintLines(s, rytmEdit, p.instrument);
    }
    if (this.blinkUntil > now || (rytmEdit && ptn.next >= 0) || this.slideFrom + SLIDE_MS > now || this.waveFrom > 0) next = ANIM_MS;
    // Les vumetres retombent entre deux pas (au telephone, l'ecran est trop petit : au pas seulement)
    if (!this.mobile && this.meters.some((v) => v > 0.02)) next = next || ANIM_MS * 2;
    b.blit(this.ctx, OFF, DIM, FULL);
    this.done(s, now);
    return next;
  }

  /** Les vumetres : un saut a chaque nouveau pas (les voix qui y jouent), puis ils retombent. */
  private stepMeters(now: number): void {
    const dt = this.metersAt > 0 ? (now - this.metersAt) / 1000 : 0;
    this.metersAt = now;
    const k = Math.pow(0.5, dt / METER_HALF_S);
    for (let i = 0; i < this.meters.length; i += 1) this.meters[i] *= k;
    const st = clock.running ? playhead.get() : -1;
    if (st >= 0 && st !== this.lastStep) {
      const steps = pattern.get().steps;
      INSTRUMENTS.forEach((inst, i) => {
        const v = velocity(steps, inst, st);
        if (v > 0 && voices.plays(inst)) this.meters[i] = Math.max(this.meters[i], 0.35 + (0.65 * v) / 9);
      });
    }
    this.lastStep = st;
  }

  /** L'en-tete : la section, le pattern, la lecture, les temps, le tempo ; le filet dessous. */
  private paintHead(s: LcdState, cur: number, now: number): void {
    const b = this.pix;
    const right = s.r1;
    const rw = textWidth(right);
    b.text(right, X1 - rw, 1.5);
    // Les quatre temps de la mesure : le temps en cours allume (en lecture)
    const box = 3;
    const pitch = 4.5;
    const boxesX = X1 - rw - 5 - (3 * pitch + box);
    const running = clock.running && playhead.get() >= 0;
    const beat = running ? Math.floor(playhead.get() / 4) : -1;
    for (let k = 0; k < 4; k += 1) {
      const x = boxesX + k * pitch;
      if (k === beat) b.rect(x, 3.25, box, box, 2);
      else b.frame(x, 3.25, box, box, 1);
    }
    // La lecture : un triangle ; a l'arret, un carre
    const iconX = boxesX - 8;
    if (clock.running) b.play(iconX, 2, 5, 2);
    else b.rect(iconX + 0.5, 3, 4, 4, 2);
    // La section (ou MM-RYTM), puis le pattern en negatif (il clignote quand il change)
    const name = slotName(cur);
    const tagW = textWidth(name) + 2;
    const room = fitChars(iconX - 4 - tagW - 3 - X0);
    const left = fit(s.l1, room);
    const lw = b.text(left, X0, 1.5);
    const tx = X0 + lw + 3;
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    if (blinkOff) {
      b.frame(tx, 0.5, tagW, fontHeight() + 2, 2);
      b.text(name, tx + 1, 1.5, 2);
    } else b.tag(name, tx, 1.5);
    b.dots(0, RULE_TOP, PIX_W, 1);
  }

  /** La voix choisie, ses seize pas, les dix vumetres ; rend 0 (les animations sont comptees par paint). */
  private paintVoice(inst: Inst | null, steps: Record<Inst, string>, now: number): number {
    const b = this.pix;
    // La voix en grand, qui glisse depuis la droite quand on la choisit
    const t = Math.min(1, (now - this.slideFrom) / SLIDE_MS);
    const dx = Math.round((1 - t) * (1 - t) * 14);
    if (inst) {
      b.text(inst, X0 + dx, 12.5, 2, 'big');
      if (voices.get().solo === inst) b.tag('SOLO', X0, 30);
      else if (!voices.plays(inst)) b.tag('MUTE', X0, 30);
      else {
        const snd = soundOf(inst);
        if (textWidth(snd) <= 36) b.text(snd, X0, 30, 1);
        else b.text(fit(snd, fitChars(36, 'mini')), X0, 31, 1, 'mini');
      }
    } else {
      b.text('--', X0, 12.5, 1, 'big');
      b.text('PICK', X0, 30, 1);
    }
    // Les seize pas : la hauteur de chaque coup sa velocite ; vide, un trait (plus fort sur les temps)
    const head = clock.running ? playhead.get() : -1;
    const bottom = GRID.y + GRID.h;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const x = cellX(i);
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      if (bars > 0) {
        // Trois segments (doux, moyen, fort) separes d'un point ; sans voix choisie, en demi-teinte
        const seg = GRID.h / 3;
        for (let k = 0; k < bars; k += 1) b.rect(x, bottom - (k + 1) * seg + 0.5, GRID.w, seg - 0.5, inst ? 2 : 1);
      } else b.rect(x + 1.5, bottom - 0.5, 3, 0.5, i % 4 === 0 ? 2 : 1);
      if (i === head) b.rect(x, bottom + 1, GRID.w, 1, 2);
    }
    // Le temps fort de chaque groupe de quatre : un point au-dessus
    for (let g = 0; g < 4; g += 1) b.rect(cellX(g * 4), GRID.y - 1.5, 0.5, 0.5, 1);
    // Les vumetres : six segments par voix, son nom dessous ; la vague du repos les fait onduler
    const wave = this.waveFrom > 0 ? (now - this.waveFrom) / 1000 : -1;
    INSTRUMENTS.forEach((name, i) => {
      const cx = METERS.x + i * METERS.pitch;
      let v = this.meters[i];
      if (wave >= 0) {
        const env = Math.min(1, wave / 1.2, (WAVE_MS / 1000 - wave) / 1.2);
        v = Math.max(v, env * (0.5 + 0.5 * Math.sin(wave * 3.2 - i * 0.7)) * 0.9);
      }
      const lit = Math.round(v * METERS.segs);
      for (let k = 0; k < METERS.segs; k += 1) {
        const y = METERS.bottom - 0.5 - k;
        if (k < lit) b.rect(cx, y, METERS.w, 0.5, 2);
        else if (k === 0) b.rect(cx, y, METERS.w, 0.5, 1);
      }
      const plays = voices.plays(name);
      const label = name.slice(0, 2);
      const lx = cx + (METERS.w - textWidth(label, 'mini')) / 2;
      if (name === inst) b.tag(label, lx - 0.5, METERS.label, 'mini', 0.5);
      else b.text(label, lx, METERS.label, plays ? 2 : 1, 'mini');
      // Une voix qui se tait : son nom barre
      if (!plays) b.rect(lx - 0.5, METERS.label + 2, textWidth(label, 'mini') + 1, 0.5, name === inst ? 0 : 2);
    });
    return 0;
  }

  /** Sans voix choisie : le plus fort des coups du pas (la grille montre le motif entier). */
  private maxVel(steps: Record<Inst, string>, i: number): number {
    let best = 0;
    for (const k of INSTRUMENTS) best = Math.max(best, velocity(steps, k, i));
    return best;
  }

  /** EDIT : le pattern en grand, les seize emplacements ; rend 0. */
  private paintPatterns(now: number): number {
    const b = this.pix;
    const p = patterns.get();
    b.text(slotName(p.cur), X0, 12.5, 2, 'big');
    b.tag('EDIT', X0, 30);
    const cw = 12.5;
    const ch = 11;
    const blinkOn = Math.floor(now / 160) % 2 === 0;
    for (let i = 0; i < PATTERN_SLOTS; i += 1) {
      const x = 41 + (i % 8) * (cw + 2);
      const y = i < 8 ? 12 : 25;
      const label = String(i + 1).padStart(2, '0');
      const lx = x + (cw - textWidth(label, 'mini')) / 2;
      const ly = y + 3.5;
      const inChain = p.chain.length > 1 && p.chain.includes(i);
      if (i === p.cur) {
        b.rect(x, y, cw, ch, 2);
        b.text(label, lx, ly, 0, 'mini');
      } else {
        if (i === p.next && blinkOn) b.rect(x, y, cw, ch, 1);
        if (inChain || i === p.next) b.frame(x, y, cw, ch, 2);
        else if (patterns.filled(i)) b.frame(x, y, cw, ch, 1);
        else b.rect(x + cw / 2 - 1, y + ch - 1.5, 2, 0.5, 1);
        b.text(label, lx, ly, patterns.filled(i) || inChain ? 2 : 1, 'mini');
      }
      // La position de la chaine qui joue : un trait sous l'emplacement
      if (inChain && p.chain[p.pos] === i) b.rect(x + 2, y + ch + 0.5, cw - 4, 0.5, 2);
    }
    return 0;
  }

  /** Page MIX : les cinq volumes en barres, la voix reglee en negatif. */
  private paintMix(m: NonNullable<LcdState['mix']>): void {
    const b = this.pix;
    const n = m.insts.length;
    const cw = PIX_W / n;
    m.insts.forEach((inst, k) => {
      const x0 = k * cw;
      const cx = x0 + cw / 2;
      const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
      const nw = textWidth(inst);
      if (inst === m.sel) b.tag(inst, cx - nw / 2 - 1, 12.5);
      else b.text(inst, cx - nw / 2, 12.5);
      // La barre : son cadre, son remplissage, la valeur dessous
      const bx = cx - 6;
      b.frame(bx, 21, 12, 10, 1);
      const h = v * 9;
      if (h > 0) b.rect(bx + 0.5, 30.5 - h, 11, h, 2);
      const val = String(Math.round(v * 100));
      b.text(val, cx - textWidth(val) / 2, 32.5, inst === m.sel ? 2 : 1);
      if (k > 0) b.vdots(x0, 12, 27, 1);
    });
  }

  /**
   * Page SAMPLES (2026-10-05) : la liste des sons de la voix choisie, trois
   * lignes (le precedent, le son du moment en negatif, le suivant), son rang
   * a droite et, tout a droite, un rail d'un point par son.
   */
  private paintSamples(m: NonNullable<LcdState['samples']>): void {
    const b = this.pix;
    const n = m.names.length;
    const ROW = 9;
    const top = 12.5;
    for (let k = -1; k <= 1; k += 1) {
      const i = m.cur + k;
      if (i < 0 || i >= n) continue;
      const y = top + (k + 1) * ROW;
      const name = fit(m.names[i], 17);
      if (k === 0) {
        b.tag(name, 14, y);
        b.textRight(`${i + 1}/${n}`, 140, y, 2);
      } else b.text(name, 15, y, 1);
    }
    // Le rail : un point par son, celui du moment en barre
    const pitch = Math.min(3, 24 / Math.max(1, n));
    const y1 = top + 2 + (24 - pitch * n) / 2;
    for (let i = 0; i < n; i += 1) {
      const y = y1 + i * pitch;
      if (i === m.cur) b.rect(147, y - 0.5, 6, 1.5, 2);
      else b.rect(149, y, 2, 0.5, 1);
    }
  }

  /** Mode presets : le titre et le rang, le nom entre ses fleches, les quatre touches. */
  private paintPresets(s: LcdState): void {
    const b = this.pix;
    b.text(fit(s.l1, 18), X0, 1.5);
    b.textRight(s.r1, X1, 1.5);
    b.dots(0, RULE_TOP, PIX_W, 1);
    const name = s.l2.replace(/^<\s*|\s*>$/g, '').trim();
    const shown = fit(name, 22);
    b.text(shown, (PIX_W - textWidth(shown)) / 2, 21);
    if (s.l2.startsWith('<')) {
      b.text('<', X0, 21);
      b.textRight('>', X1, 21);
    }
    b.dots(0, RULE_BOTTOM, PIX_W, 1);
    const keys = s.keys ?? [];
    const cw = PIX_W / 4;
    keys.forEach((k, i) => {
      if (!k) return;
      const w = textWidth(k) + 2;
      b.tag(k, cw * (i + 0.5) - w / 2, LINE_B);
    });
    this.bar = null;
  }

  /** Les deux lignes du bas : l'etat ; le message, la valeur d'un potard, la piste et sa barre, sinon les jauges. */
  private paintLines(s: LcdState, rytmEdit: boolean, inst: Inst | null): void {
    const b = this.pix;
    b.dots(0, RULE_BOTTOM, PIX_W, 1);
    const p = patterns.get();
    const W = X1 - X0;
    // Ligne A : l'etat (EDIT : la chaine), PRESETS en negatif a droite ; MIX : la voix reglee et son volume
    if (s.mix) {
      const k = s.mix.insts.indexOf(s.mix.sel);
      const v = Math.round((s.mix.levels[k] ?? 0) * 100);
      b.text(`VOLUME ${s.mix.sel} ${v}`, X0, LINE_A);
      b.text('THE FOUR VOICES OF ITS ROW', X0, LINE_B, 1);
      this.bar = null;
      return;
    }
    if (s.samples) {
      b.text(fit(`${s.samples.title} SOUND`, 14), X0, LINE_A);
      b.tag(s.samples.inst, X1 - textWidth(s.samples.inst) - 2, LINE_A);
      b.text('PRESS A VOICE: ITS SOUNDS', X0, LINE_B, 1);
      this.bar = null;
      return;
    }
    if (rytmEdit) {
      const chain = p.chain.length > 1 ? `CHAIN ${p.chain.map((k) => String(k + 1).padStart(2, '0')).join('>')}` : 'TAP: PLAY  TAP TAP: CHAIN';
      const right = p.next >= 0 ? `NEXT ${slotName(p.next)}` : '';
      const rw = right ? textWidth(right) + 4 : 0;
      b.text(fit(chain, fitChars(W - rw)), X0, LINE_A);
      if (right) b.textRight(right, X1, LINE_A);
    } else {
      const tagW = s.tag ? textWidth('PRESETS') + 2 : 0;
      const r = s.r2;
      const rw = r ? textWidth(r) + 4 : tagW ? tagW + 3 : 0;
      b.text(fit(s.l2, fitChars(W - rw)), X0, LINE_A);
      if (r) b.textRight(r, X1, LINE_A);
      else if (s.tag) b.tag('PRESETS', X1 - tagW, LINE_A);
    }
    // Ligne B : le message ; sinon la piste (position, barre, duree) ; en EDIT, l'aide ; sinon les jauges
    this.bar = null;
    if (s.bar !== null) {
      const lw = b.text(s.l3, X0, LINE_B);
      const rw = textWidth(s.r3);
      b.text(s.r3, X1 - rw, LINE_B);
      const x0 = X0 + lw + 3;
      const x1 = X1 - rw - 3;
      if (x1 - x0 > 8) {
        b.frame(x0, LINE_B, x1 - x0, 6.5, 2);
        const fill = Math.max(0, Math.min(1, s.bar)) * (x1 - x0 - 3);
        if (fill > 0) b.rect(x0 + 1.5, LINE_B + 1.5, fill, 3.5, 2);
        const S = PIX_TEX;
        this.bar = { x0: x0 * S, x1: x1 * S, y0: LINE_B * S - OLED_BAR.lift, y1: (LINE_B + 7) * S };
      }
    } else if (s.l3) b.text(fit(s.l3, fitChars(W)), X0, LINE_B);
    else if (rytmEdit) b.text('HOLD AN EMPTY ONE: COPY', X0, LINE_B, 1);
    else this.paintGauges(inst);
  }

  /** Au repos, la ligne du bas : trois jauges, la voix choisie (VOLUME, TONE, DECAY) ou la machine (SWING, STRETCH, MASTER). */
  private paintGauges(inst: Inst | null): void {
    const fx = inst ? voiceFx.of(inst) : null;
    const gauges: { label: string; v: number; bip?: boolean; text: string }[] = fx
      ? [
          { label: 'VOL', v: fx.level, text: String(Math.round(fx.level * 100)) },
          { label: 'TONE', v: fx.tone, bip: true, text: `${fx.tone > 0.005 ? '+' : ''}${Math.round(fx.tone * 100)}` },
          { label: 'DECAY', v: fx.decay, text: String(Math.round(fx.decay * 100)) },
        ]
      : [
          { label: 'SWING', v: mix.swing, text: `${swingRatio(mix.swing)}` },
          { label: 'STRETCH', v: mix.stretch, bip: true, text: `${mix.stretch > 0.005 ? '+' : ''}${Math.round(mix.stretch * 100)}` },
          { label: 'MASTER', v: mix.level, text: String(Math.round(mix.level * 100)) },
        ];
    const b = this.pix;
    // Chaque jauge : son nom, sa valeur (trois chiffres), sa barre ; les barres se partagent le reste de la ligne
    const valW = textWidth('+00', 'mini');
    const fixed = gauges.map((g) => textWidth(g.label, 'mini') + 1.5 + valW + 2);
    const barW = (X1 - X0 - 2 * GAUGE.gap - fixed.reduce((a, w) => a + w, 0)) / gauges.length;
    let x = X0;
    gauges.forEach((g, i) => {
      const slot = fixed[i] + barW;
      const y = LINE_B + 0.75;
      const lw = b.text(g.label, x, y + 0.25, 1, 'mini');
      const vx = x + lw + 1.5;
      b.text(g.text, vx, y + 0.25, 2, 'mini');
      const bx = vx + valW + 2;
      x += slot + GAUGE.gap;
      const bw = barW;
      if (bw < 6) return;
      b.frame(bx, y, bw, GAUGE.h, 1);
      const inner = bw - 2;
      if (g.bip) {
        const mid = bx + 1 + inner / 2;
        b.rect(mid - 0.25, y - 0.75, 0.5, GAUGE.h + 1.5, 1);
        const w = Math.max(-1, Math.min(1, g.v)) * (inner / 2);
        if (w > 0) b.rect(mid, y + 1, w, GAUGE.h - 2, 2);
        else if (w < 0) b.rect(mid + w, y + 1, -w, GAUGE.h - 2, 2);
      } else {
        const w = Math.max(0, Math.min(1, g.v)) * inner;
        if (w > 0) b.rect(bx + 1, y + 1, w, GAUGE.h - 2, 2);
      }
    });
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
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
