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
 * telles quelles.
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { lcd, type LcdState } from '../state/lcd';
import { HEX, LCD_TEXT, OLED, OLED_DRAW } from '../theme';
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

const key = (s: LcdState): string => `${s.text[0]}\n${s.text[1]}\n${s.text[2]}`;

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

  private paint(s: LcdState, now: number): void {
    const ctx = this.ctx;
    const [W, H] = OLED.tex;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = HEX.oled;
    ctx.fillRect(0, 0, W, H);
    ctx.font = OLED_DRAW.font;
    ctx.fillStyle = HEX.bone;
    ctx.textBaseline = 'alphabetic';
    const rows: [string, string][] = [
      [s.l1, s.r1],
      [s.l2, s.r2],
      [s.l3, ''],
    ];
    rows.forEach(([l, r], i) => {
      const y = OLED_DRAW.baselines[i];
      ctx.textAlign = 'left';
      if (l) ctx.fillText(l, OLED_DRAW.pad, y);
      if (r) {
        ctx.textAlign = 'right';
        ctx.fillText(r, W - OLED_DRAW.pad, y);
      }
    });
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
