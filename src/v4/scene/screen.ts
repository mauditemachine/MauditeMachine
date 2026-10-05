/**
 * L'ecran OLED en haut a gauche du panneau (spec 20.3.8) : un plan de
 * 3.6 x 1.35 pose sur son cadre, texture canvas 640 x 240 (les proportions
 * du verre). Redessine le 2026-10-05 (Mika : "l'ecran de RYTM dans le
 * design de pixel comme la Digitakt 2, mais bien plus simple ; des fois de
 * petites animations ; l'ecran est important, on devrait avoir plus
 * d'informations ; le meilleur de toutes les machines : Digitakt 2, Analog
 * Rytm, EMX1, Impulse") : 160 x 60 points (scene/pixels.ts), bone sur noir,
 * deux polices bitmap. De haut en bas :
 * - l'en-tete : la section ouverte (ou MM-RYTM), le pattern (A01, en
 *   negatif ; il clignote quand il change), quatre points pour les temps de
 *   la mesure (allumes un a un en lecture), le tempo ;
 * - au milieu, a gauche, la voix choisie en grand (BD, SD...) et son son
 *   (909, 808, MM, ou son sample ; MUTE si elle se tait) ; a droite ses
 *   seize pas, la hauteur de chaque coup sa velocite, la tete de lecture
 *   soulignee ; dessous dix vumetres, un par voix, qui sautent a chaque
 *   coup et retombent (facon Impulse) ;
 * - en EDIT (state/patterns.ts) : le pattern en grand et les seize
 *   emplacements (le courant en negatif, la chaine encadree, celui qui
 *   attend la mesure qui clignote), la chaine sur la ligne du dessous ;
 * - page MIX : les cinq volumes en barres, la voix reglee en negatif ;
 * - mode presets : le nom entre ses fleches, quatre touches en bas ;
 * - les deux lignes du bas : l'etat (READY, RUN, le titre qui defile,
 *   l'etiquette PRESETS) et le message passager, la valeur d'un potard, ou
 *   la piste en cours et sa barre (cliquable, bar).
 * Au repos (desktop, la machine regardee), de temps en temps, une vague
 * lente passe sur les vumetres. Le texte vient de state/lcd.ts ; l'image se
 * refait quand un store change, au plus tous les 60 ms, et ne demande une
 * frame qu'apres un redessin. Materiau non eclaire, sans tone mapping.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { clock } from '../audio/clock';
import { familyOf, kit } from '../audio/kit';
import { INSTRUMENTS, STEP_COUNT, VEL_BARS, pattern, velocity } from '../audio/pattern';
import type { ShotId } from '../audio/shotsdsp';
import { sc } from '../audio/soundcloud';
import { editor } from '../state/editor';
import { focus } from '../state/focus';
import { lcd, type LcdState } from '../state/lcd';
import { PATTERN_SLOTS, patterns, slotName } from '../state/patterns';
import { playhead } from '../state/playhead';
import { voices } from '../state/voices';
import { HEX, OLED, OLED_BAR, type Inst } from '../theme';
import { PIX_H, PIX_SCALE, PIX_W, PixelBuffer, fitChars, textWidth } from './pixels';
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

/* La grille des pas : seize cases de 6 points, un jour de 1, deux de plus entre les groupes de quatre */
const GRID = { x: 41, y: 11, w: 6, h: 10, gap: 1, group: 2 } as const;
const cellX = (i: number): number => GRID.x + i * (GRID.w + GRID.gap) + Math.floor(i / 4) * GRID.group;
/* Les dix vumetres sous la grille */
const METERS = { x: 41, y: 25, h: 7, label: 33, pitch: 11.8 } as const;
/* Les deux lignes du bas */
const LINE_A = 42;
const LINE_B = 51;

export class Screen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
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
    const [W, H] = OLED.tex;
    this.info = { draws: 0, text: ['', '', ''], lastDrawAt: -Infinity, minGapMs: Infinity, font: 'pixel 5x7', size: [W, H] };
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('screen: no 2d context');
    this.ctx = ctx;
    this.img = ctx.createImageData(PIX_W * PIX_SCALE, PIX_H * PIX_SCALE);
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
    const quiet = !clock.running && sc.get().status !== 'playing' && !s.l3 && !s.mix && !s.keys;
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
      else if (rytmEdit) next = Math.max(next, this.paintPatterns(now));
      else next = Math.max(next, this.paintVoice(p.instrument, p.steps, now));
      this.paintLines(s, rytmEdit);
    }
    if (this.blinkUntil > now || (rytmEdit && ptn.next >= 0) || this.slideFrom + SLIDE_MS > now || this.waveFrom > 0) next = ANIM_MS;
    // Les vumetres retombent entre deux pas (au telephone, l'ecran est trop petit : au pas seulement)
    if (!this.mobile && this.meters.some((v) => v > 0.02)) next = next || ANIM_MS * 2;
    b.blit(this.ctx, this.img, OFF, DIM, FULL);
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

  /** L'en-tete : la section, le pattern, les temps, le tempo ; le filet dessous. */
  private paintHead(s: LcdState, cur: number, now: number): void {
    const b = this.pix;
    const right = s.r1;
    const rw = textWidth(right);
    b.text(right, PIX_W - rw, 0);
    // Les quatre temps de la mesure : le temps en cours allume (en lecture)
    const dotsX = PIX_W - rw - 6 - 19;
    const beat = clock.running && playhead.get() >= 0 ? Math.floor(playhead.get() / 4) : -1;
    for (let k = 0; k < 4; k += 1) {
      const x = dotsX + k * 5;
      if (k === beat) b.rect(x, 2, 3, 3, 2);
      else b.frame(x, 2, 3, 3, 1);
    }
    // La section (ou MM-RYTM), puis le pattern en negatif (il clignote quand il change)
    const name = slotName(cur);
    const tagW = textWidth(name) + 2;
    const room = fitChars(dotsX - 6 - tagW - 4);
    const left = fit(s.l1, room);
    const lw = b.text(left, 0, 0);
    const tx = Math.max(lw + 4, 0);
    const blinkOff = this.blinkUntil > now && Math.floor((this.blinkUntil - now) / 100) % 2 === 1;
    if (blinkOff) {
      b.frame(tx, -1, tagW, 9, 2);
      b.text(name, tx + 1, 0, 2);
    } else b.tag(name, tx, 0);
    b.dots(0, 9, PIX_W, 1);
  }

  /** La voix choisie, ses seize pas, les dix vumetres ; rend 0 (les animations sont comptees par paint). */
  private paintVoice(inst: Inst | null, steps: Record<Inst, string>, now: number): number {
    const b = this.pix;
    // La voix en grand, qui glisse depuis la droite quand on la choisit
    const t = Math.min(1, (now - this.slideFrom) / SLIDE_MS);
    const dx = Math.round((1 - t) * (1 - t) * 14);
    if (inst) {
      b.text(inst, dx, 12, 2, 'big');
      const muted = !voices.plays(inst);
      if (muted) b.tag('MUTE', 0, 30, 'std');
      else b.text(fit(soundOf(inst), 6), 0, 30, 1);
    } else {
      b.text('--', 0, 12, 1, 'big');
      b.text('PICK', 0, 30, 1);
    }
    // Les seize pas : la hauteur de chaque coup sa velocite ; vide, un point (plus fort sur les temps)
    const head = clock.running ? playhead.get() : -1;
    for (let i = 0; i < STEP_COUNT; i += 1) {
      const x = cellX(i);
      const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
      const bars = VEL_BARS[v];
      if (bars > 0) {
        const h = [0, 4, 7, 10][bars];
        b.rect(x, GRID.y + GRID.h - h, GRID.w, h, inst ? 2 : 1);
      } else b.rect(x + 2, GRID.y + GRID.h - 1, 2, 1, i % 4 === 0 ? 2 : 1);
      if (i === head) b.rect(x, GRID.y + GRID.h + 2, GRID.w, 2, 2);
    }
    // Les vumetres : une barre par voix, son nom dessous ; la vague du repos les fait onduler
    const wave = this.waveFrom > 0 ? (now - this.waveFrom) / 1000 : -1;
    INSTRUMENTS.forEach((name, i) => {
      const cx = Math.round(METERS.x + i * METERS.pitch);
      let v = this.meters[i];
      if (wave >= 0) {
        const env = Math.min(1, wave / 1.2, (WAVE_MS / 1000 - wave) / 1.2);
        v = Math.max(v, env * (0.5 + 0.5 * Math.sin(wave * 3.2 - i * 0.7)) * 0.9);
      }
      const h = Math.round(v * METERS.h);
      b.rect(cx, METERS.y + METERS.h - 1, 7, 1, 1);
      if (h > 0) b.rect(cx, METERS.y + METERS.h - h, 7, h, 2);
      const plays = voices.plays(name);
      b.text(name.slice(0, 2), cx, METERS.label, name === inst ? 2 : plays ? 1 : 1, 'mini');
      if (!plays) b.rect(cx, METERS.label + 2, 7, 1, 0);
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
    b.text(slotName(p.cur), 0, 12, 2, 'big');
    b.tag('EDIT', 0, 30);
    const cw = 13;
    const ch = 11;
    const blinkOn = Math.floor(now / 160) % 2 === 0;
    for (let i = 0; i < PATTERN_SLOTS; i += 1) {
      const x = 41 + (i % 8) * (cw + 2);
      const y = i < 8 ? 11 : 24;
      const label = String(i + 1).padStart(2, '0');
      const lx = x + Math.floor((cw - textWidth(label, 'mini')) / 2);
      const ly = y + 3;
      const inChain = p.chain.length > 1 && p.chain.includes(i);
      if (i === p.cur) {
        b.rect(x, y, cw, ch, 2);
        b.text(label, lx, ly, 0, 'mini');
      } else {
        if (i === p.next && blinkOn) b.rect(x, y, cw, ch, 1);
        if (inChain || i === p.next) b.frame(x, y, cw, ch, 2);
        else if (patterns.filled(i)) b.frame(x, y, cw, ch, 1);
        b.text(label, lx, ly, patterns.filled(i) || inChain ? 2 : 1, 'mini');
      }
      // La position de la chaine qui joue : un trait sous l'emplacement
      if (inChain && p.chain[p.pos] === i) b.rect(x + 2, y + ch, cw - 4, 1, 2);
    }
    return 0;
  }

  /** Page MIX : les cinq volumes en barres, la voix reglee en negatif. */
  private paintMix(m: NonNullable<LcdState['mix']>): void {
    const b = this.pix;
    const n = m.insts.length;
    const cw = Math.floor(PIX_W / n);
    m.insts.forEach((inst, k) => {
      const x0 = k * cw;
      const cx = x0 + Math.floor(cw / 2);
      const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
      const nw = textWidth(inst);
      if (inst === m.sel) b.tag(inst, cx - Math.floor(nw / 2) - 1, 12);
      else b.text(inst, cx - Math.floor(nw / 2), 12);
      // La barre : son cadre, son remplissage, la valeur dessous
      const bx = cx - 6;
      b.frame(bx, 20, 12, 10, 1);
      const h = Math.round(v * 8);
      if (h > 0) b.rect(bx + 1, 29 - h, 10, h, 2);
      const val = String(Math.round(v * 100));
      b.text(val, cx - Math.floor(textWidth(val) / 2), 31, inst === m.sel ? 2 : 1);
      if (k > 0) for (let y = 11; y < 38; y += 2) b.set(x0, y, 1);
    });
  }

  /** Mode presets : le titre et le rang, le nom entre ses fleches, les quatre touches. */
  private paintPresets(s: LcdState): void {
    const b = this.pix;
    b.text(fit(s.l1, 18), 0, 0);
    b.textRight(s.r1, PIX_W, 0);
    b.dots(0, 9, PIX_W, 1);
    const name = s.l2.replace(/^<\s*|\s*>$/g, '').trim();
    const nw = textWidth(fit(name, 22));
    b.text(fit(name, 22), Math.floor((PIX_W - nw) / 2), 20);
    if (s.l2.startsWith('<')) {
      b.text('<', 0, 20);
      b.text('>', PIX_W - 5, 20);
    }
    b.dots(0, 40, PIX_W, 1);
    const keys = s.keys ?? [];
    const cw = PIX_W / 4;
    keys.forEach((k, i) => {
      if (!k) return;
      const w = textWidth(k) + 2;
      b.tag(k, Math.round(cw * (i + 0.5) - w / 2), LINE_B);
    });
    this.bar = null;
  }

  /** Les deux lignes du bas : l'etat ; le message, la valeur d'un potard ou la piste et sa barre. */
  private paintLines(s: LcdState, rytmEdit: boolean): void {
    const b = this.pix;
    b.dots(0, 39, PIX_W, 1);
    const p = patterns.get();
    // Ligne A : l'etat (EDIT : la chaine), PRESETS en negatif a droite ; MIX : la voix reglee et son volume
    if (s.mix) {
      const k = s.mix.insts.indexOf(s.mix.sel);
      const v = Math.round((s.mix.levels[k] ?? 0) * 100);
      b.text(`VOLUME ${s.mix.sel} ${v}`, 0, LINE_A);
      b.text('THE FIVE VOICES OF ITS ROW', 0, LINE_B, 1);
      this.bar = null;
      return;
    }
    if (rytmEdit) {
      const chain = p.chain.length > 1 ? `CHAIN ${p.chain.map((k) => String(k + 1).padStart(2, '0')).join('>')}` : 'TAP: PLAY  QUICK TAPS: CHAIN';
      const right = p.next >= 0 ? `NEXT ${slotName(p.next)}` : '';
      const rw = right ? textWidth(right) + 6 : 0;
      b.text(fit(chain, fitChars(PIX_W - rw)), 0, LINE_A);
      if (right) b.textRight(right, PIX_W, LINE_A);
    } else {
      const tagW = s.tag ? textWidth('PRESETS') + 2 : 0;
      const r = s.r2;
      const rw = r ? textWidth(r) + 6 : tagW ? tagW + 4 : 0;
      b.text(fit(s.l2, fitChars(PIX_W - rw)), 0, LINE_A);
      if (r) b.textRight(r, PIX_W, LINE_A);
      else if (s.tag) b.tag('PRESETS', PIX_W - tagW, LINE_A);
    }
    // Ligne B : le message ; sinon la piste (position, barre, duree) ; en EDIT, l'aide
    this.bar = null;
    if (s.bar !== null) {
      const lw = b.text(s.l3, 0, LINE_B);
      const rw = textWidth(s.r3);
      b.text(s.r3, PIX_W - rw, LINE_B);
      const x0 = lw + 3;
      const x1 = PIX_W - rw - 4;
      if (x1 - x0 > 8) {
        b.frame(x0, LINE_B, x1 - x0, 7, 2);
        const fill = Math.round(Math.max(0, Math.min(1, s.bar)) * (x1 - x0 - 4));
        if (fill > 0) b.rect(x0 + 2, LINE_B + 2, fill, 3, 2);
        const S = PIX_SCALE;
        this.bar = { x0: x0 * S, x1: x1 * S, y0: LINE_B * S - OLED_BAR.lift, y1: (LINE_B + 7) * S };
      }
    } else if (s.l3) b.text(fit(s.l3, fitChars(PIX_W)), 0, LINE_B);
    else if (rytmEdit) b.text('HOLD AN EMPTY ONE: COPY', 0, LINE_B, 1);
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
