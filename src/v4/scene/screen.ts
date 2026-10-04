/**
 * L'ecran OLED en haut a gauche du panneau (spec 20.3.8) : un plan de
 * 3.6 x 1.35 pose sur son cadre, texture canvas 640 x 240 (les proportions
 * du verre), texte bone tres contraste sur noir profond, monospace, trois
 * lignes : la section ouverte (ou MM-808) et le tempo ; le transport, ou le
 * titre qui joue et son timecode ; les messages passagers et la valeur de
 * l'encodeur qu'on tourne. Le texte vient de state/lcd.ts (compose au plus
 * 4 fois par seconde, publie seulement quand il change) ; l'ecran le
 * redessine a la meme cadence au plus (un second verrou de 250 ms ici),
 * jamais a chaque frame, et ne demande une frame qu'apres un redessin.
 * Materiau non eclaire, sans tone mapping : les deux teintes s'affichent
 * telles quelles. Page MIX (2026-10-01) : les cinq volumes en potards
 * dessines, a la place des trois lignes, tant que lcd.mix la tient.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { lcd, type LcdState } from '../state/lcd';
import { HEX, LCD_TEXT, OLED, OLED_BAR, OLED_DRAW, OLED_MIX } from '../theme';
import { makeCanvasTexture } from './silk';

export interface ScreenInfo {
  /** redessins de la texture (le premier compris) */
  draws: number;
  /** les trois lignes affichees */
  text: [string, string, string];
  /** performance.now() du dernier redessin */
  lastDrawAt: number;
  /** plus petit ecart mesure entre deux redessins (ms) : jamais sous 250 */
  minGapMs: number;
  font: string;
  size: [number, number];
}

const key = (s: LcdState): string => `${s.text[0]}\n${s.text[1]}\n${s.text[2]}\n${s.bar === null ? -1 : Math.round(s.bar * 200)}`;

export class Screen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  readonly info: ScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timer = 0;
  private shown = '';
  /** pose par listen() : le constructeur ne s'abonne a rien */
  private unsub: () => void = () => undefined;

  constructor(
    anisotropy: number,
    /** demande une frame apres un redessin */
    private invalidate: () => void
  ) {
    const [W, H] = OLED.tex;
    this.info = { draws: 0, text: ['', '', ''], lastDrawAt: -Infinity, minGapMs: Infinity, font: OLED_DRAW.font, size: [W, H] };
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
    this.paint(lcd.get(), performance.now());
  }

  /**
   * Abonnement a state/lcd.ts, pose par le Stage une fois tout son GL
   * construit : un constructeur qui echoue plus loin ne laisse ainsi aucun
   * ecouteur qui retiendrait la scene morte.
   */
  listen(): void {
    this.unsub();
    this.unsub = lcd.subscribe(this.onChange);
    // Un changement entre la construction et l'abonnement n'est pas perdu
    this.onChange();
  }

  private onChange = (): void => {
    const s = lcd.get();
    if (key(s) === this.shown) return;
    const now = performance.now();
    const wait = this.info.lastDrawAt + LCD_TEXT.tickMs - now;
    if (wait > 0) {
      // Trop tot : le dernier etat part au prochain quart de seconde
      if (this.timer === 0) {
        this.timer = window.setTimeout(() => {
          this.timer = 0;
          this.onChange();
        }, wait);
      }
      return;
    }
    this.paint(s, now);
    this.invalidate();
  };

  /**
   * La barre de progression telle que dessinee (px de la texture : x0 a x1,
   * y0 a y1), null quand elle n'est pas a l'ecran : le Stage y lit un clic
   * (seekAt).
   */
  bar: { x0: number; x1: number; y0: number; y1: number } | null = null;

  private paint(s: LcdState, now: number): void {
    const ctx = this.ctx;
    const [W, H] = OLED.tex;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = HEX.oled;
    ctx.fillRect(0, 0, W, H);
    if (s.mix) {
      this.paintMix(s.mix);
      this.bar = null;
      this.done(s, now);
      return;
    }
    ctx.font = OLED_DRAW.font;
    ctx.fillStyle = HEX.bone;
    ctx.textBaseline = 'alphabetic';
    const rows: [string, string][] = [
      [s.l1, s.r1],
      [s.l2, s.r2],
      [s.l3, s.r3],
    ];
    rows.forEach(([l, r], i) => {
      // Mode presets : la ligne 3 devient quatre touches (plus bas)
      if (i === 2 && s.keys) return;
      const y = OLED_DRAW.baselines[i];
      ctx.textAlign = 'left';
      if (l) ctx.fillText(l, OLED_DRAW.pad, y);
      if (r) {
        ctx.textAlign = 'right';
        ctx.fillText(r, W - OLED_DRAW.pad, y);
      }
    });
    // Les presets (2026-10-04, state/presetMode.ts) : une etiquette en negatif au repos, quatre touches en mode presets
    if (s.tag) this.softKey('PRESETS', W - OLED_DRAW.pad, OLED_DRAW.baselines[1], 'right');
    if (s.keys) {
      const cw = (W - 2 * OLED_DRAW.pad) / 4;
      s.keys.forEach((k, i) => {
        if (k) this.softKey(k, OLED_DRAW.pad + cw * (i + 0.5), OLED_DRAW.baselines[2], 'center');
      });
    }
    // Ligne 3, une piste en cours (2026-10-01) : la barre entre la position et la duree
    this.bar = null;
    if (s.bar !== null) {
      const g = OLED_BAR;
      const x0 = OLED_DRAW.pad + ctx.measureText(s.l3).width + g.gap;
      const x1 = W - OLED_DRAW.pad - ctx.measureText(s.r3).width - g.gap;
      const y1 = OLED_DRAW.baselines[2] - g.lift;
      const y0 = y1 - g.h;
      if (x1 - x0 > g.h * 2) {
        ctx.strokeStyle = HEX.bone;
        ctx.lineWidth = g.stroke;
        ctx.strokeRect(x0 + g.stroke / 2, y0 + g.stroke / 2, x1 - x0 - g.stroke, g.h - g.stroke);
        const inner = x1 - x0 - 2 * g.inset;
        ctx.fillStyle = HEX.bone;
        ctx.fillRect(x0 + g.inset, y0 + g.inset, Math.max(0, Math.min(1, s.bar)) * inner, g.h - 2 * g.inset);
        this.bar = { x0, x1, y0, y1 };
      }
    }
    this.done(s, now);
  }

  /** Une touche dessinee : le texte en negatif dans une etiquette arrondie, sur la ligne de base y. */
  private softKey(text: string, x: number, y: number, align: 'right' | 'center'): void {
    const ctx = this.ctx;
    const w = ctx.measureText(text).width + 16;
    const h = 44;
    const x0 = align === 'right' ? x - w + 8 : x - w / 2;
    const y0 = y - 34;
    ctx.fillStyle = HEX.bone;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x0, y0, w, h, 6);
    else ctx.rect(x0, y0, w, h);
    ctx.fill();
    ctx.fillStyle = HEX.oled;
    ctx.textAlign = 'center';
    ctx.fillText(text, x0 + w / 2, y);
    ctx.fillStyle = HEX.bone;
    ctx.textAlign = 'left';
  }

  /** Page MIX : une cellule par voix, son nom, un potard dessine, sa valeur. */
  private paintMix(m: NonNullable<LcdState['mix']>): void {
    const ctx = this.ctx;
    const [W, H] = OLED.tex;
    const M = OLED_MIX;
    const n = m.insts.length;
    const cw = W / n;
    const DEG = Math.PI / 180;
    ctx.fillStyle = HEX.bone;
    ctx.globalAlpha = M.ruleA;
    for (let k = 1; k < n; k += 1) ctx.fillRect(Math.round(k * cw - M.rule / 2), M.ruleInset, M.rule, H - 2 * M.ruleInset);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineCap = 'round';
    m.insts.forEach((inst, k) => {
      const cx = cw * (k + 0.5);
      const v = Math.max(0, Math.min(1, m.levels[k] ?? 0));
      // Nom : la voix reglee en negatif
      ctx.font = M.font;
      if (inst === m.sel) {
        ctx.fillStyle = HEX.bone;
        ctx.beginPath();
        // roundRect manque aux navigateurs anciens : un rectangle simple
        if (typeof ctx.roundRect === 'function') ctx.roundRect(cx - M.tag.w / 2, M.labelY - M.tag.h / 2, M.tag.w, M.tag.h, M.tag.r);
        else ctx.rect(cx - M.tag.w / 2, M.labelY - M.tag.h / 2, M.tag.w, M.tag.h);
        ctx.fill();
        ctx.fillStyle = HEX.oled;
      } else ctx.fillStyle = HEX.bone;
      ctx.fillText(inst, cx, M.labelY + 1);
      // Potard : piste de 270 deg (repere a midi au milieu), arc de la valeur, aiguille
      const a0 = (-90 - 135) * DEG;
      const a = (-90 - 135 + 270 * v) * DEG;
      ctx.strokeStyle = HEX.bone;
      ctx.globalAlpha = M.trackA;
      ctx.lineWidth = M.track;
      ctx.beginPath();
      ctx.arc(cx, M.dialY, M.r, a0, (-90 + 135) * DEG);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (v > 0) {
        ctx.lineWidth = M.arc;
        ctx.beginPath();
        ctx.arc(cx, M.dialY, M.r, a0, a);
        ctx.stroke();
      }
      ctx.lineWidth = M.needle;
      ctx.beginPath();
      ctx.moveTo(cx, M.dialY);
      ctx.lineTo(cx + Math.cos(a) * (M.r - 10), M.dialY + Math.sin(a) * (M.r - 10));
      ctx.stroke();
      // Valeur
      ctx.fillStyle = HEX.bone;
      ctx.font = M.valueFont;
      ctx.fillText(String(Math.round(v * 100)), cx, M.valueY);
    });
    ctx.textBaseline = 'alphabetic';
    ctx.font = OLED_DRAW.font;
  }

  /** Fin d'un redessin : la texture part, les compteurs suivent. */
  private done(s: LcdState, now: number): void {
    const ctx = this.ctx;
    this.texture.needsUpdate = true;
    const info = this.info;
    if (info.draws > 0) info.minGapMs = Math.min(info.minGapMs, now - info.lastDrawAt);
    info.draws += 1;
    info.lastDrawAt = now;
    info.text = [s.text[0], s.text[1], s.text[2]];
    info.font = ctx.font;
    this.shown = key(s);
  }

  dispose(): void {
    this.unsub();
    this.unsub = () => undefined;
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
